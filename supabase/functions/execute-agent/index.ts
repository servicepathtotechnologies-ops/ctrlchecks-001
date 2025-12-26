// Agent Execution Runner for CtrlChecks AI
// Executes agent workflows with reasoning and action planning

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ReasoningEngine, ReasoningContext, Action, ReasoningResult } from "../_shared/reasoning-engine.ts";
import { HybridMemoryService } from "../_shared/memory.ts";
import { LLMAdapter, LLMMessage } from "../_shared/llm-adapter.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface WorkflowNode {
  id: string;
  type: string;
  data: {
    label: string;
    type: string;
    config: Record<string, unknown>;
  };
  position: { x: number; y: number };
}

interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
}

interface AgentConfig {
  goal: string;
  maxIterations: number;
  reasoningModel: string;
  actionModel: string;
  memoryEnabled: boolean;
  temperature?: number;
}

interface AgentState {
  iteration: number;
  currentState: any;
  reasoningHistory: any[];
  actionsTaken: any[];
  goalAchieved: boolean;
}

/**
 * Agent Executor
 * Runs agent workflows with reasoning loop
 */
class AgentExecutor {
  private supabase: any;
  private reasoningEngine: ReasoningEngine;
  private llmAdapter: LLMAdapter;
  private memoryService: HybridMemoryService | null = null;

  constructor(supabase: any) {
    this.supabase = supabase;
    this.reasoningEngine = new ReasoningEngine();
    this.llmAdapter = new LLMAdapter();
  }

  /**
   * Execute agent workflow
   */
  async execute(
    workflowId: string,
    input: any,
    config: AgentConfig,
    nodes: WorkflowNode[],
    edges: WorkflowEdge[]
  ): Promise<{
    executionId: string;
    status: string;
    result: any;
    reasoning: any[];
    actions: any[];
    iterations: number;
  }> {
    // Create execution record
    const { data: execution, error: execError } = await this.supabase
      .from('agent_executions')
      .insert({
        workflow_id: workflowId,
        session_id: input.session_id || `session-${Date.now()}`,
        status: 'running',
        goal: config.goal,
        max_iterations: config.maxIterations,
        reasoning_steps: [],
        actions_taken: [],
        current_state: input,
      })
      .select()
      .single();

    if (execError || !execution) {
      throw new Error(`Failed to create agent execution: ${execError?.message}`);
    }

    const executionId = execution.id;
    const sessionId = execution.session_id;

    // Initialize memory if enabled
    if (config.memoryEnabled) {
      this.memoryService = new HybridMemoryService(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );
      await this.memoryService.initialize();
      await this.memoryService.getOrCreateSession(workflowId, sessionId, input.user_id);
    }

    // Initialize agent state
    let agentState: AgentState = {
      iteration: 0,
      currentState: input,
      reasoningHistory: [],
      actionsTaken: [],
      goalAchieved: false,
    };

    try {
      // Agent execution loop
      for (let i = 0; i < config.maxIterations; i++) {
        agentState.iteration = i + 1;

        // Update execution status
        await this.supabase
          .from('agent_executions')
          .update({
            iteration_count: agentState.iteration,
            current_state: agentState.currentState,
            reasoning_steps: agentState.reasoningHistory,
            actions_taken: agentState.actionsTaken,
          })
          .eq('id', executionId);

        // Get available actions from workflow nodes
        const availableActions = this.getAvailableActions(nodes, agentState.currentState);

        // Build reasoning context
        const reasoningContext: ReasoningContext = {
          goal: config.goal,
          currentState: agentState.currentState,
          availableActions,
          history: agentState.reasoningHistory.map((r, idx) => ({
            step: idx + 1,
            thought: r.thought || '',
            action: r.action,
            result: r.result,
          })),
          maxSteps: 5,
        };

        // Detect provider from model name
        const detectProvider = (model: string): 'openai' | 'claude' | 'gemini' => {
          if (model.startsWith('gpt-') || model.includes('openai')) return 'openai';
          if (model.startsWith('claude-') || model.includes('anthropic')) return 'claude';
          if (model.startsWith('gemini-') || model.includes('gemini')) return 'gemini';
          return 'openai';
        };

        // Reason about next action
        const reasoningResult = await this.reasoningEngine.reason(reasoningContext, {
          model: config.reasoningModel,
          temperature: config.temperature || 0.3,
          apiKey: (agentState.currentState as any)?.apiKey,
          provider: detectProvider(config.reasoningModel),
        });

        // Store reasoning step
        agentState.reasoningHistory.push({
          iteration: agentState.iteration,
          thought: reasoningResult.reasoning[0]?.thought || 'No reasoning provided',
          action: reasoningResult.nextAction?.name,
          confidence: reasoningResult.confidence,
          shouldContinue: reasoningResult.shouldContinue,
        });

        // Check if goal is achieved
        if (!reasoningResult.shouldContinue) {
          agentState.goalAchieved = true;
          break;
        }

        // Execute next action if available
        if (reasoningResult.nextAction) {
          const actionResult = await this.executeAction(
            reasoningResult.nextAction,
            nodes,
            edges,
            agentState.currentState,
            sessionId
          );

          // Store action result
          agentState.actionsTaken.push({
            iteration: agentState.iteration,
            action: reasoningResult.nextAction.name,
            result: actionResult,
            timestamp: new Date().toISOString(),
          });

          // Update current state with action result
          agentState.currentState = {
            ...agentState.currentState,
            lastAction: reasoningResult.nextAction.name,
            lastActionResult: actionResult,
          };

          // Store in memory if enabled
          if (this.memoryService && reasoningResult.nextAction) {
            await this.memoryService.store(
              sessionId,
              'assistant',
              `Executed action: ${reasoningResult.nextAction.name}. Result: ${JSON.stringify(actionResult).substring(0, 200)}`
            );
          }
        } else {
          // No action available, stop
          console.log('No action available, stopping agent');
          break;
        }

        // Small delay between iterations
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Finalize execution
      const finalStatus = agentState.goalAchieved ? 'completed' : 'stopped';
      
      await this.supabase
        .from('agent_executions')
        .update({
          status: finalStatus,
          finished_at: new Date().toISOString(),
          final_output: agentState.currentState,
          reasoning_steps: agentState.reasoningHistory,
          actions_taken: agentState.actionsTaken,
        })
        .eq('id', executionId);

      return {
        executionId,
        status: finalStatus,
        result: agentState.currentState,
        reasoning: agentState.reasoningHistory,
        actions: agentState.actionsTaken,
        iterations: agentState.iteration,
      };
    } catch (error) {
      // Update execution with error
      await this.supabase
        .from('agent_executions')
        .update({
          status: 'failed',
          error: error instanceof Error ? error.message : String(error),
          finished_at: new Date().toISOString(),
        })
        .eq('id', executionId);

      throw error;
    }
  }

  /**
   * Get available actions from workflow nodes
   */
  private getAvailableActions(
    nodes: WorkflowNode[],
    currentState: any
  ): Action[] {
    const actions: Action[] = [];

    // Filter nodes that can be actions (not triggers, not logic-only)
    const actionNodes = nodes.filter(node => {
      const type = node.data.type;
      return !['manual_trigger', 'webhook', 'schedule', 'if_else', 'switch', 'memory'].includes(type);
    });

    for (const node of actionNodes) {
      actions.push({
        id: node.id,
        name: node.data.label,
        description: `${node.data.type} node: ${node.data.label}`,
        nodeId: node.id,
        parameters: node.data.config,
      });
    }

    return actions;
  }

  /**
   * Execute an action (workflow node)
   */
  private async executeAction(
    action: Action,
    nodes: WorkflowNode[],
    edges: WorkflowEdge[],
    currentState: any,
    sessionId: string
  ): Promise<any> {
    // Find the node for this action
    const node = nodes.find(n => n.id === action.nodeId);
    if (!node) {
      throw new Error(`Node not found for action: ${action.name}`);
    }

    // Execute the node (simplified - in production, you'd call execute-workflow logic)
    // For now, return a placeholder result
    return {
      action: action.name,
      nodeId: action.nodeId,
      executed: true,
      result: `Action ${action.name} executed successfully`,
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * Main handler
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const { workflowId, input = {}, config } = await req.json();

    if (!workflowId) {
      return new Response(
        JSON.stringify({ error: "workflowId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch workflow
    const { data: workflow, error: workflowError } = await supabase
      .from("workflows")
      .select("*")
      .eq("id", workflowId)
      .single();

    if (workflowError || !workflow) {
      return new Response(
        JSON.stringify({ error: "Workflow not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if workflow is agent type
    if (workflow.workflow_type !== 'agent') {
      return new Response(
        JSON.stringify({ error: "Workflow is not an agent type. Set workflow_type to 'agent'." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get agent config from workflow or request
    const agentConfig: AgentConfig = config || workflow.agent_config || {
      goal: "Complete the task",
      maxIterations: 10,
      reasoningModel: "gpt-4o",
      actionModel: "gpt-4o",
      memoryEnabled: true,
      temperature: 0.3,
    };

    // Ensure goal is set
    if (!agentConfig.goal) {
      agentConfig.goal = "Complete the task";
    }

    const nodes = workflow.nodes as WorkflowNode[];
    const edges = workflow.edges as WorkflowEdge[];

    // Create executor and run
    const executor = new AgentExecutor(supabase);
    const result = await executor.execute(workflowId, input, agentConfig, nodes, edges);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Agent execution error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
        status: "failed",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

