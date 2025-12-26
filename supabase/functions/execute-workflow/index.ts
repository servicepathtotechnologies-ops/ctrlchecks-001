// Deno global type declaration for TypeScript
declare const Deno: {
  readTextFile(path: string | URL): Promise<string>;
  readFile(path: string | URL): Promise<Uint8Array>;
  writeFile(path: string | URL, data: Uint8Array | ReadableStream<Uint8Array>, options?: { create?: boolean; mode?: number; signal?: AbortSignal }): Promise<void>;
  mkdir(path: string | URL, options?: { recursive?: boolean; mode?: number }): Promise<void>;
  stat(path: string | URL): Promise<{ isFile: boolean; isDirectory: boolean; size: number }>;
  errors: {
    NotFound: ErrorConstructor;
  };
  env: {
    get(key: string): string | undefined;
  };
  cwd(): string;
};

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { executeGoogleSheetsOperation, getGoogleAccessToken } from "../_shared/google-sheets.ts";
import {
  executeGoogleDocsOperation,
  executeGoogleDriveOperation,
  executeGoogleCalendarOperation,
  executeGoogleGmailOperation,
  executeGoogleBigQueryOperation,
  executeGoogleTasksOperation,
  executeGoogleContactsOperation,
} from "../_shared/google-apis.ts";
import { LLMAdapter } from "../_shared/llm-adapter.ts";

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
    category: string;
    config: Record<string, unknown>;
  };
}

interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
}

interface ExecutionLog {
  nodeId: string;
  nodeName: string;
  status: "running" | "success" | "failed" | "skipped";
  startedAt: string;
  finishedAt?: string;
  input?: unknown;
  output?: unknown;
  error?: string;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Declare variables outside try block so they're accessible in catch block
  let executionId: string | undefined;
  let logs: ExecutionLog[] = [];

  try {
    const { workflowId, executionId: providedExecutionId, input = {} } = await req.json();

    if (!workflowId) {
      return new Response(JSON.stringify({ error: "workflowId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch workflow
    const { data: workflow, error: workflowError } = await supabase
      .from("workflows")
      .select("*")
      .eq("id", workflowId)
      .single();

    if (workflowError || !workflow) {
      console.error("Workflow fetch error:", workflowError);
      return new Response(JSON.stringify({ error: "Workflow not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const nodes = workflow.nodes as WorkflowNode[];
    const edges = workflow.edges as WorkflowEdge[];

    let executionId: string;
    let execution: { id: string; started_at: string };

    // If executionId is provided (from webhook-trigger), use existing execution
    if (providedExecutionId) {
      console.log(`Using existing execution: ${providedExecutionId}`);
      const { data: existingExecution, error: fetchError } = await supabase
        .from("executions")
        .select("id, started_at, input")
        .eq("id", providedExecutionId)
        .single();

      console.log(`Fetched execution:`, JSON.stringify(existingExecution));

      if (fetchError || !existingExecution) {
        console.error("Execution fetch error:", fetchError);
        return new Response(JSON.stringify({ error: "Execution not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      executionId = existingExecution.id;
      execution = existingExecution;

      // If started_at is not set, set it now
      if (!execution.started_at) {
        const startedAt = new Date().toISOString();
        await supabase
          .from("executions")
          .update({ started_at: startedAt })
          .eq("id", executionId);
        execution.started_at = startedAt;
      }

      // Update execution status to "running"
      await supabase
        .from("executions")
        .update({ status: "running" })
        .eq("id", executionId);

      console.log(`Execution ${executionId} status updated to running`);
    } else {
      // Create new execution record (for manual triggers)
      console.log("Creating new execution record");
      const { data: newExecution, error: execError } = await supabase
        .from("executions")
        .insert({
          workflow_id: workflowId,
          user_id: workflow.user_id,
          status: "running",
          trigger: "manual",
          input,
          logs: [],
        })
        .select()
        .single();

      if (execError || !newExecution) {
        console.error("Execution creation error:", execError);
        return new Response(JSON.stringify({ error: "Failed to create execution" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      executionId = newExecution.id;
      execution = newExecution;
    }
    logs = [];
    const nodeOutputs: Record<string, unknown> = { trigger: input };
    const ifElseResults: Record<string, boolean> = {}; // Track If/Else condition results
    const switchResults: Record<string, string | null> = {}; // Track Switch matched cases

    // Build execution order (topological sort)
    // Filter out Error Trigger nodes from normal execution - they will be executed only on errors
    const allNodes = topologicalSort(nodes, edges);
    const executionOrder = allNodes.filter(n => n.data.type !== "error_trigger");
    const errorTriggerNodes = allNodes.filter(n => n.data.type === "error_trigger");
    console.log("Execution order:", executionOrder.map(n => n.data.label));
    console.log(`Total nodes to execute: ${executionOrder.length}`);
    if (errorTriggerNodes.length > 0) {
      console.log(`Error Trigger nodes found (will execute only on errors):`, errorTriggerNodes.map(n => n.data.label));
    }

    // Initialize finalOutput with input in case no nodes execute
    let finalOutput: unknown = input;
    let hasError = false;
    let errorMessage = "";

    // If no nodes to execute, return input as output
    if (executionOrder.length === 0) {
      console.warn("No nodes to execute in workflow");
      await supabase
        .from("executions")
        .update({
          status: "success",
          finished_at: new Date().toISOString(),
          duration_ms: 0,
          output: input,
          logs: [],
        })
        .eq("id", executionId);

      return new Response(
        JSON.stringify({
          executionId,
          status: "success",
          output: input,
          logs: [],
          durationMs: 0,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Execute nodes in order
    for (const node of executionOrder) {
      const log: ExecutionLog = {
        nodeId: node.id,
        nodeName: node.data.label,
        status: "running",
        startedAt: new Date().toISOString(),
      };

      try {
        // Get all input edges for this node
        const inputEdges = edges.filter(e => e.target === node.id);

        // Filter out edges from If/Else and Switch nodes that are on the wrong path
        const validInputEdges = inputEdges.filter(edge => {
          // If edge has a sourceHandle, it's from an If/Else or Switch node
          if (edge.sourceHandle) {
            const sourceNodeId = edge.source;
            const sourceNode = nodes.find(n => n.id === sourceNodeId);
            const expectedPath = edge.sourceHandle; // "true"/"false" for If/Else, case value for Switch

            console.log(`Checking edge from ${edge.source} (${edge.sourceHandle}) to ${node.data.label}`);

            // Handle If/Else nodes
            if (sourceNode?.data.type === "if_else") {
              console.log(`If/Else results:`, JSON.stringify(ifElseResults));

              // Check if we have the condition result
              if (ifElseResults[sourceNodeId] !== undefined) {
                const actualResult = ifElseResults[sourceNodeId];
                const isValid = (expectedPath === "true" && actualResult) || (expectedPath === "false" && !actualResult);
                console.log(`Edge from ${edge.source} (${expectedPath}) - condition was ${actualResult}, isValid: ${isValid}`);
                return isValid;
              }
              // If condition not evaluated yet, exclude this edge (shouldn't happen in topological order)
              console.log(`If/Else node ${sourceNodeId} hasn't been evaluated yet, excluding edge`);
              return false;
            }

            // Handle Switch nodes
            if (sourceNode?.data.type === "switch") {
              console.log(`Switch results:`, JSON.stringify(switchResults));

              // Check if we have the switch result
              if (switchResults[sourceNodeId] !== undefined) {
                const matchedCase = switchResults[sourceNodeId];

                // If sourceHandle is set, use it for routing
                if (expectedPath) {
                  const isValid = matchedCase !== null && String(matchedCase) === String(expectedPath);
                  console.log(`Edge from ${edge.source} (${expectedPath}) - matched case was ${matchedCase}, isValid: ${isValid}`);
                  return isValid;
                } else {
                  // If sourceHandle is not set, this edge shouldn't be used for Switch routing
                  // All Switch edges should have sourceHandle set to the case value
                  console.warn(`Edge from Switch node ${sourceNodeId} to ${node.data.label} doesn't have sourceHandle set. Switch routing requires sourceHandle to be set to the case value.`);
                  return false;
                }
              }
              // If switch not evaluated yet, exclude this edge
              console.log(`Switch node ${sourceNodeId} hasn't been evaluated yet, excluding edge`);
              return false;
            }

            // Unknown node type with sourceHandle
            console.log(`Unknown node type ${sourceNode?.data.type} with sourceHandle, excluding edge`);
            return false;
          }
          // Regular edges (no sourceHandle) are always valid
          return true;
        });

        console.log(`Node ${node.data.label} - Total input edges: ${inputEdges.length}, Valid edges: ${validInputEdges.length}`);
        inputEdges.forEach(e => {
          console.log(`  Edge: ${e.source} -> ${e.target}, sourceHandle: ${e.sourceHandle || 'none'}`);
        });

        // If node only has If/Else or Switch inputs and none are valid, skip this node
        const hasOnlyConditionalInputs = inputEdges.length > 0 && inputEdges.every(e => {
          if (!e.sourceHandle) return false;
          const sourceNode = nodes.find(n => n.id === e.source);
          return sourceNode?.data.type === "if_else" || sourceNode?.data.type === "switch";
        });
        if (hasOnlyConditionalInputs && validInputEdges.length === 0) {
          console.log(`Skipping node ${node.data.label} - all conditional inputs are on wrong path`);
          log.status = "skipped";
          log.finishedAt = new Date().toISOString();
          logs.push(log);
          continue;
        }

        let nodeInput: unknown;

        if (validInputEdges.length > 0) {
          // If there's only one connected node, use its output directly
          // For If/Else nodes, extract the 'input' property for downstream nodes
          if (validInputEdges.length === 1) {
            const sourceNodeId = validInputEdges[0].source;
            const sourceOutput = nodeOutputs[sourceNodeId];
            const sourceNode = nodes.find(n => n.id === sourceNodeId);

            console.log(`Node ${node.data.label} - Source node: ${sourceNode?.data.label} (${sourceNode?.data.type}), Source ID: ${sourceNodeId}`);
            console.log(`Node ${node.data.label} - Source output exists:`, sourceOutput !== undefined && sourceOutput !== null);
            console.log(`Node ${node.data.label} - Source output type:`, typeof sourceOutput);
            console.log(`Node ${node.data.label} - Source output keys:`, sourceOutput && typeof sourceOutput === 'object' ? Object.keys(sourceOutput) : 'N/A');

            // If source is If/Else node, extract the 'input' property
            if (sourceNode?.data.type === "if_else" && sourceOutput && typeof sourceOutput === "object") {
              const outputObj = sourceOutput as Record<string, unknown>;
              nodeInput = outputObj.input !== undefined ? outputObj.input : sourceOutput;
              console.log(`Node ${node.data.label} getting input from If/Else node, extracted input:`, JSON.stringify(nodeInput));
            } else {
              nodeInput = sourceOutput;
              console.log(`Node ${node.data.label} getting input from connected node ${sourceNode?.data.label} (${sourceNodeId}):`, JSON.stringify(nodeInput));
              
              // For Google Doc nodes, ensure the output structure is preserved
              if (sourceNode?.data.type === "google_doc" && nodeInput && typeof nodeInput === "object") {
                console.log(`Node ${node.data.label} - Google Doc output structure:`, JSON.stringify(nodeInput));
                console.log(`Node ${node.data.label} - Available fields: content=${!!(nodeInput as any).content}, body=${!!(nodeInput as any).body}, text=${!!(nodeInput as any).text}`);
              }
            }
          } else {
            nodeInput = validInputEdges.reduce((acc, edge) => ({ ...acc, [edge.source]: nodeOutputs[edge.source] }), {});
            console.log(`Node ${node.data.label} getting input from multiple connected nodes:`, JSON.stringify(nodeInput));
          }
        } else {
          // For trigger nodes (no input edges), use the workflow input
          nodeInput = input;
          console.log(`Trigger node ${node.data.label} (${node.data.type}) using workflow input:`, JSON.stringify(nodeInput));
        }

        log.input = nodeInput;
        console.log(`Executing node: ${node.data.label} (${node.data.type})`);
        console.log(`Node input value:`, JSON.stringify(nodeInput));
        console.log(`Node input type:`, typeof nodeInput);
        console.log(`Node input is null?:`, nodeInput === null);
        console.log(`Node input is undefined?:`, nodeInput === undefined);

        // Execute node based on type
        // For AI nodes, retrieve conversation history based on node's memory limit
        let history: Array<{ role: string; content: string }> = [];
        const isAINode = ["openai_gpt", "anthropic_claude", "google_gemini", "text_summarizer", "sentiment_analyzer"].includes(node.data.type);

        if (isAINode) {
          // Get memory limit from node config (default: 10 turns)
          const memoryLimit = (node.data.config.memory as number) || 10;

          // Get session_id from workflow input (passed from webhook-trigger)
          const sessionId = (input as any)?._session_id || (input as any)?.session_id;

          if (sessionId && memoryLimit > 0) {
            try {
              history = await retrieveConversationHistory(supabase, workflowId, sessionId, memoryLimit);
              console.log(`Retrieved ${history.length} messages for ${node.data.label} (memory limit: ${memoryLimit} turns)`);
            } catch (historyError) {
              console.error(`Error retrieving conversation history for ${node.data.label}:`, historyError);
              // Continue without history if retrieval fails
            }
          }
        }

        // Add user_id and workflow_id to node input for context
        // Preserve arrays - don't spread them into objects
        let enrichedInput: unknown;
        if (Array.isArray(nodeInput)) {
          // For arrays, pass them directly (nodes that need metadata can extract it from context)
          enrichedInput = nodeInput;
        } else if (typeof nodeInput === 'object' && nodeInput !== null) {
          // For objects, add metadata properties
          enrichedInput = {
            ...(nodeInput as Record<string, unknown>),
            _user_id: workflow.user_id,
            _workflow_id: workflowId,
          };
        } else {
          // For primitives, wrap in object
          enrichedInput = {
            value: nodeInput,
            _user_id: workflow.user_id,
            _workflow_id: workflowId,
          };
        }
        const output = await executeNode(node, enrichedInput, lovableApiKey, history, workflow.user_id);

        // If this is an If/Else node, store the condition result
        if (node.data.type === "if_else" && typeof output === "object" && output !== null) {
          const outputObj = output as Record<string, unknown>;
          if (typeof outputObj.condition === "boolean") {
            ifElseResults[node.id] = outputObj.condition;
            console.log(`If/Else node ${node.data.label} condition result: ${outputObj.condition}`);
          }
        }

        // If this is a Switch node, store the matched case
        if (node.data.type === "switch" && typeof output === "object" && output !== null) {
          const outputObj = output as Record<string, unknown>;
          if (outputObj.matchedCase !== undefined) {
            switchResults[node.id] = outputObj.matchedCase as string | null;
            console.log(`Switch node ${node.data.label} matched case: ${outputObj.matchedCase}`);
          }
        }

        console.log(`Node output value:`, JSON.stringify(output));
        console.log(`Node output type:`, typeof output);
        console.log(`Node output is null?:`, output === null);
        console.log(`Node output is undefined?:`, output === undefined);

        // Store output - ensure we store the actual value, not null/undefined
        let outputToStore = output;
        if (output === null || output === undefined) {
          console.error(`Node ${node.data.label} (${node.data.type}) returned null/undefined output!`);
          console.error(`Node input was:`, JSON.stringify(nodeInput));
          // For trigger nodes, if output is null, use the input instead
          if (node.data.type === "webhook" || node.data.type === "webhook_trigger_response" ||
            node.data.type === "manual_trigger" || node.data.type === "schedule" ||
            node.data.type === "chat_trigger" || node.data.type === "error_trigger" ||
            node.data.type === "interval" || node.data.type === "workflow_trigger") {
            outputToStore = nodeInput || {};
            console.log(`Using input as output for trigger node:`, JSON.stringify(outputToStore));
          }
        }

        // Store the output (use outputToStore which has fallback for trigger nodes)
        nodeOutputs[node.id] = outputToStore;
        finalOutput = outputToStore;

        console.log(`✅ Stored output for node ${node.data.label} (${node.data.type}), ID: ${node.id}`);
        console.log(`   Output type: ${typeof outputToStore}`);
        console.log(`   Output keys:`, outputToStore && typeof outputToStore === 'object' ? Object.keys(outputToStore) : 'N/A');
        if (node.data.type === "google_doc" && outputToStore && typeof outputToStore === "object") {
          const docOutput = outputToStore as Record<string, unknown>;
          console.log(`   📄 Google Doc output:`);
          console.log(`      - documentId: ${docOutput.documentId}`);
          console.log(`      - title: ${docOutput.title}`);
          console.log(`      - content length: ${typeof docOutput.content === 'string' ? docOutput.content.length : 'N/A'}`);
          console.log(`      - content preview: ${typeof docOutput.content === 'string' ? docOutput.content.substring(0, 100) : 'N/A'}`);
        }
        console.log(`   Full output:`, JSON.stringify(outputToStore).substring(0, 500));

        log.output = outputToStore;
        log.status = "success";
        log.finishedAt = new Date().toISOString();
      } catch (error) {
        console.error(`❌ Node ${node.data.label} (${node.data.type}) ERROR:`, error);
        console.error(`   Node ID: ${node.id}`);
        console.error(`   Error type: ${error instanceof Error ? error.constructor.name : typeof error}`);
        console.error(`   Error message: ${error instanceof Error ? error.message : String(error)}`);
        console.error(`   Stack: ${error instanceof Error ? error.stack : 'N/A'}`);
        
        log.status = "failed";
        const errorObj = error instanceof Error ? error : new Error(String(error));
        log.error = errorObj.message;
        log.finishedAt = new Date().toISOString();
        hasError = true;
        errorMessage = log.error;
        
        // If there are Error Trigger nodes, execute them with error information
        if (errorTriggerNodes.length > 0) {
          console.log(`Error occurred in node ${node.data.label}, executing ${errorTriggerNodes.length} Error Trigger node(s)`);
          
          for (const errorTriggerNode of errorTriggerNodes) {
            const errorTriggerLog: ExecutionLog = {
              nodeId: errorTriggerNode.id,
              nodeName: errorTriggerNode.data.label,
              status: "running",
              startedAt: new Date().toISOString(),
            };
            
            try {
              // Prepare error information for Error Trigger
              const errorInput = {
                failed_node: node.data.label || node.id,
                error_message: errorObj.message,
                stack_trace: errorObj.stack || "",
                ...extractInputObject(finalOutput),
                _user_id: workflow.user_id,
                _workflow_id: workflowId,
              };
              
              console.log(`Executing Error Trigger node ${errorTriggerNode.data.label} with error info:`, JSON.stringify(errorInput));
              const errorTriggerOutput = await executeNode(errorTriggerNode, errorInput, lovableApiKey, undefined, workflow.user_id);
              
              errorTriggerLog.output = errorTriggerOutput;
              errorTriggerLog.status = "success";
              errorTriggerLog.finishedAt = new Date().toISOString();
              
              // Update final output with Error Trigger output
              finalOutput = errorTriggerOutput;
              
              console.log(`Error Trigger node ${errorTriggerNode.data.label} executed successfully`);
            } catch (errorTriggerError) {
              console.error(`Error Trigger node ${errorTriggerNode.data.label} failed:`, errorTriggerError);
              errorTriggerLog.status = "failed";
              errorTriggerLog.error = errorTriggerError instanceof Error ? errorTriggerError.message : "Unknown error";
              errorTriggerLog.finishedAt = new Date().toISOString();
            }
            
            logs.push(errorTriggerLog);
          }
        }
      }

      logs.push(log);

      // Update execution with current logs and status (incremental updates)
      try {
        await supabase
          .from("executions")
          .update({
            logs,
            status: hasError ? "failed" : "running", // Update status as we go
          })
          .eq("id", executionId);
      } catch (updateError) {
        console.error("Failed to update execution logs:", updateError);
        // Continue execution even if log update fails
      }

      if (hasError) break;
    }

    // Finalize execution
    const finishedAt = new Date().toISOString();
    const durationMs = new Date(finishedAt).getTime() - new Date(execution.started_at).getTime();

    // Ensure finalOutput is never null - use last successful node output or input
    let finalOutputToStore = finalOutput;
    if (finalOutputToStore === null || finalOutputToStore === undefined) {
      console.warn("Final output is null/undefined, using last node output or input");
      // Try to get the last successful node output from logs
      const lastSuccessfulLog = logs.filter(l => l.status === "success" && l.output !== null && l.output !== undefined).pop();
      if (lastSuccessfulLog && lastSuccessfulLog.output !== null && lastSuccessfulLog.output !== undefined) {
        finalOutputToStore = lastSuccessfulLog.output;
        console.log(`Using last successful node output:`, JSON.stringify(finalOutputToStore));
      } else {
        // Fallback to input
        finalOutputToStore = input;
        console.log(`Using input as fallback:`, JSON.stringify(finalOutputToStore));
      }
    }

    console.log(`Finalizing execution with output:`, JSON.stringify(finalOutputToStore));
    console.log(`Final output type:`, typeof finalOutputToStore);
    console.log(`Has error:`, hasError);
    console.log(`Total logs:`, logs.length);

    await supabase
      .from("executions")
      .update({
        status: hasError ? "failed" : "success",
        finished_at: finishedAt,
        duration_ms: durationMs,
        output: finalOutputToStore,
        error: hasError ? errorMessage : null,
        logs,
      })
      .eq("id", executionId);

    return new Response(
      JSON.stringify({
        executionId,
        status: hasError ? "failed" : "success",
        output: finalOutputToStore,
        logs,
        durationMs,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Execute workflow error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    // If we have an executionId, update it to failed status
    if (executionId) {
      try {
        await supabase
          .from("executions")
          .update({
            status: "failed",
            error: errorMessage,
            finished_at: new Date().toISOString(),
            logs: logs.length > 0 ? logs : [
              {
                nodeId: "system",
                nodeName: "Workflow Execution",
                status: "failed",
                startedAt: new Date().toISOString(),
                finishedAt: new Date().toISOString(),
                error: errorMessage,
              }
            ],
          })
          .eq("id", executionId);
      } catch (updateError) {
        console.error("Failed to update execution status:", updateError);
      }
    }

    return new Response(
      JSON.stringify({
        executionId: executionId || null,
        status: "failed",
        error: errorMessage,
        logs: logs.length > 0 ? logs : [],
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function topologicalSort(nodes: WorkflowNode[], edges: WorkflowEdge[]): WorkflowNode[] {
  const inDegree: Record<string, number> = {};
  const adjacency: Record<string, string[]> = {};
  const nodeMap: Record<string, WorkflowNode> = {};

  nodes.forEach(node => {
    inDegree[node.id] = 0;
    adjacency[node.id] = [];
    nodeMap[node.id] = node;
  });

  edges.forEach(edge => {
    adjacency[edge.source].push(edge.target);
    inDegree[edge.target] = (inDegree[edge.target] || 0) + 1;
  });

  const queue: string[] = [];
  Object.entries(inDegree).forEach(([nodeId, degree]) => {
    if (degree === 0) queue.push(nodeId);
  });

  const sorted: WorkflowNode[] = [];
  while (queue.length > 0) {
    const nodeId = queue.shift()!;
    sorted.push(nodeMap[nodeId]);

    adjacency[nodeId].forEach(neighbor => {
      inDegree[neighbor]--;
      if (inDegree[neighbor] === 0) queue.push(neighbor);
    });
  }

  return sorted;
}

// ============================================
// UTILITY FUNCTIONS FOR NODE IMPLEMENTATION
// ============================================

/**
 * Safely extracts input object from unknown input type
 * Handles various input formats gracefully
 */
function extractInputObject(input: unknown): Record<string, unknown> {
  if (input && typeof input === 'object' && input !== null) {
    return input as Record<string, unknown>;
  }
  return {};
}

/**
 * Extracts data from input using common field names
 * Tries: data, input, text, body, content, items, or returns input itself if string/array
 */
function extractDataFromInput(input: unknown): unknown {
  // If input is directly a string or array, return it
  if (typeof input === 'string' || Array.isArray(input)) {
    return input;
  }
  
  const inputObj = extractInputObject(input);
  
  // For arrays, check common property names
  if (Array.isArray(inputObj.items)) {
    return inputObj.items;
  }
  if (Array.isArray(inputObj.data)) {
    return inputObj.data;
  }
  if (Array.isArray(inputObj.array)) {
    return inputObj.array;
  }
  
  // For other types, try common field names
  return inputObj.data || inputObj.input || inputObj.text || inputObj.body || inputObj.content || inputObj;
}

/**
 * Validates required string parameter
 * Throws error with node name prefix if validation fails
 */
function validateRequiredString(
  value: unknown,
  paramName: string,
  nodeName: string
): string {
  if (!value || typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${nodeName}: ${paramName} is required. Please provide a valid value in the node configuration.`);
  }
  return value;
}

/**
 * Validates required parameter exists
 * Throws error with node name prefix if validation fails
 */
function validateRequired(
  value: unknown,
  paramName: string,
  nodeName: string
): void {
  if (value === undefined || value === null || value === '') {
    throw new Error(`${nodeName}: ${paramName} is required. Please configure this parameter in the node properties.`);
  }
}

/**
 * Creates standardized node error message
 */
function createNodeError(nodeName: string, message: string, context?: string): string {
  let errorMsg = `${nodeName}: ${message}`;
  if (context) {
    errorMsg += `\n\n${context}`;
  }
  return errorMsg;
}

/**
 * Creates standardized output format with input passthrough
 */
function createStandardOutput(result: unknown, input: unknown): Record<string, unknown> {
  const output: Record<string, unknown> = {
    success: true,
    result,
  };
  
  // Pass through original input for downstream nodes
  const inputObj = extractInputObject(input);
  if (Object.keys(inputObj).length > 0) {
    Object.assign(output, inputObj);
  }
  
  return output;
}

/**
 * Safely parses JSON string with error handling
 */
function parseJSONSafe(jsonString: string, context: string): unknown {
  try {
    return JSON.parse(jsonString);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid JSON in ${context}: ${errorMessage}`);
  }
}

/**
 * Validates URL format
 */
function validateURL(url: string, paramName: string, nodeName: string): void {
  try {
    new URL(url);
  } catch {
    throw new Error(`${nodeName}: Invalid ${paramName}. Please provide a valid URL (e.g., https://example.com).`);
  }
}

/**
 * Validates email format
 */
function validateEmail(email: string, paramName: string, nodeName: string): void {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw new Error(`${nodeName}: Invalid ${paramName} format "${email}". Use format: email@example.com`);
  }
}

/**
 * Type-safe property extraction from record
 */
function getProperty<T>(obj: Record<string, unknown>, key: string, defaultValue: T): T {
  const value = obj[key];
  if (value !== undefined && value !== null) {
    return value as T;
  }
  return defaultValue;
}

/**
 * Type-safe string property extraction
 */
function getStringProperty(obj: Record<string, unknown>, key: string, defaultValue: string): string {
  const value = obj[key];
  if (typeof value === 'string') {
    return value;
  }
  return defaultValue;
}

/**
 * Type-safe number property extraction
 */
function getNumberProperty(obj: Record<string, unknown>, key: string, defaultValue: number): number {
  const value = obj[key];
  if (typeof value === 'number') {
    return value;
  }
  return defaultValue;
}

/**
 * Type-safe boolean property extraction
 */
function getBooleanProperty(obj: Record<string, unknown>, key: string, defaultValue: boolean): boolean {
  const value = obj[key];
  if (typeof value === 'boolean') {
    return value;
  }
  return defaultValue;
}

// Retrieve conversation history for a session with a specific memory limit
async function retrieveConversationHistory(
  supabase: ReturnType<typeof createClient>,
  workflowId: string,
  sessionId: string,
  memoryLimitTurns: number
): Promise<Array<{ role: string; content: string }>> {
  const MAX_EXECUTIONS_TO_CHECK = memoryLimitTurns * 2; // Check more executions to find session matches

  try {
    const { data: previousExecutions } = await supabase
      .from("executions")
      .select("input, output, logs")
      .eq("workflow_id", workflowId)
      .eq("trigger", "webhook")
      .not("input", "is", null)
      .order("started_at", { ascending: false })
      .limit(MAX_EXECUTIONS_TO_CHECK);

    if (!previousExecutions) {
      return [];
    }

    // Filter executions from the same session and build conversation history
    const sessionExecutions = previousExecutions.filter(exec => {
      const execInput = extractInputObject(exec.input);
      const execSessionId = execInput.session_id || execInput._session_id;
      return typeof execSessionId === 'string' && execSessionId === sessionId;
    }).slice(0, memoryLimitTurns); // Last N conversation turns in this session

    const conversationHistory: Array<{ role: string; content: string }> = [];

    // Build conversation history from previous messages (reverse to get chronological order)
    for (const exec of sessionExecutions.reverse()) {
      const execInput = extractInputObject(exec.input);
      const execOutput = exec.output;

      const message = execInput.message;
      if (typeof message === 'string' && message) {
        conversationHistory.push({
          role: "user",
          content: message
        });
      }

      if (execOutput) {
        // Extract AI response from output
        let aiResponse = "";
        if (typeof execOutput === "string") {
          aiResponse = execOutput;
        } else if (typeof execOutput === "object" && execOutput !== null) {
          const outputObj = execOutput as Record<string, unknown>;
          aiResponse = (typeof outputObj.text === 'string' ? outputObj.text : '') ||
            (typeof outputObj.content === 'string' ? outputObj.content : '') ||
            (typeof outputObj.message === 'string' ? outputObj.message : '') ||
            JSON.stringify(execOutput);
        }

        if (aiResponse) {
          conversationHistory.push({
            role: "assistant",
            content: aiResponse
          });
        }
      }
    }

    return conversationHistory;
  } catch (error) {
    console.error("Error retrieving conversation history:", error);
    return [];
  }
}

async function executeNode(
  node: WorkflowNode,
  input: unknown,
  lovableApiKey?: string,
  conversationHistory?: Array<{ role: string; content: string }>,
  userId?: string
): Promise<unknown> {
  const { type, config } = node.data;

  switch (type) {
    case "manual_trigger": {
      // Manual trigger: returns standardized output schema
      const inputObj = extractInputObject(input);
      const workflowId = getStringProperty(inputObj, '_workflow_id', '') || 
                         getStringProperty(inputObj, 'workflow_id', '') || 
                         (userId || "unknown");
      const executedAt = new Date().toISOString();
      const output = {
        trigger: "manual",
        workflow_id: workflowId,
        ...inputObj,
        // Ensure executed_at is always set after spread so it can't be overwritten
        executed_at: executedAt,
      };
      console.log(`Manual trigger returning:`, JSON.stringify(output));
      return output;
    }
    case "webhook":
    case "webhook_trigger_response": {
      // Webhook trigger: returns input with standardized schema
      // Input should already contain method, headers, query, body from webhook-trigger function
      const inputObj = extractInputObject(input);
      const output: Record<string, unknown> = {
        trigger: "webhook",
        method: getStringProperty(inputObj, 'method', 'POST'),
        headers: inputObj.headers || {},
        query: inputObj.query || {},
        body: inputObj.body || inputObj,
        ...inputObj,
      };
      console.log(`Webhook trigger returning:`, JSON.stringify(output));
      return output;
    }
    case "schedule": {
      // Schedule trigger: returns standardized output with time, timezone, and generated cron
      const time = getStringProperty(config, 'time', '09:00');
      const timezone = getStringProperty(config, 'timezone', 'Asia/Kolkata');
      
      // Convert time (HH:MM) to cron expression (runs daily at specified time)
      // Time format: "HH:MM" -> Cron: "MM HH * * *"
      let cron = "";
      if (time && time.match(/^\d{2}:\d{2}$/)) {
        const [hours, minutes] = time.split(':');
        cron = `${minutes} ${hours} * * *`;
      } else {
        // Fallback to old cron format if time is not in HH:MM format
        cron = getStringProperty(config, 'cron', '0 9 * * *');
      }
      
      const inputObj = extractInputObject(input);
      // Only bypass wait if explicitly marked as scheduled execution (from scheduler service)
      const isScheduledExecution = getStringProperty(inputObj, '_scheduled', 'false') === 'true';
      
      // If not a scheduled execution and time is specified, wait until scheduled time
      if (!isScheduledExecution && time && time.match(/^\d{2}:\d{2}$/)) {
        try {
          // Get current time in the specified timezone
          const now = new Date();
          const scheduledHour = parseInt(time.split(':')[0], 10);
          const scheduledMinute = parseInt(time.split(':')[1], 10);
          
          // Format current time in the specified timezone
          const formatter = new Intl.DateTimeFormat('en-US', {
            timeZone: timezone,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false,
          });
          
          const currentTimeStr = formatter.format(now);
          const [currentHour, currentMinute, currentSecond] = currentTimeStr.split(':').map(Number);
          const currentTimeFormatted = `${String(currentHour).padStart(2, '0')}:${String(currentMinute).padStart(2, '0')}`;
          
          // Calculate time difference in minutes
          const currentTimeMinutes = currentHour * 60 + currentMinute;
          const scheduledTimeMinutes = scheduledHour * 60 + scheduledMinute;
          let timeDiffMinutes = scheduledTimeMinutes - currentTimeMinutes;
          
          // If scheduled time has passed today, schedule for tomorrow
          if (timeDiffMinutes < 0) {
            timeDiffMinutes += 24 * 60; // Add 24 hours
          }
          
          // Calculate delay in milliseconds (subtract current seconds to be more precise)
          const delayMs = (timeDiffMinutes * 60 - currentSecond) * 1000;
          
          // Maximum wait time: 5 minutes (300000ms) to prevent long-running requests
          const MAX_WAIT_MS = 5 * 60 * 1000;
          
          if (delayMs > 0 && delayMs <= MAX_WAIT_MS) {
            console.log(`Schedule trigger: Waiting ${Math.round(delayMs / 1000)} seconds until ${time} ${timezone} (current: ${currentTimeFormatted})`);
            // Wait until scheduled time
            await new Promise(resolve => setTimeout(resolve, delayMs));
            console.log(`Schedule trigger: Wait completed, continuing execution at scheduled time`);
          } else if (delayMs > MAX_WAIT_MS) {
            // If delay is too long, log a message but continue (for testing)
            console.warn(
              `Schedule trigger: Scheduled time ${time} ${timezone} is more than 5 minutes away (${Math.round(delayMs / 60000)} minutes). ` +
              `Current time: ${currentTimeFormatted} ${timezone}. ` +
              `Workflow will continue but may not execute at exact scheduled time. ` +
              `For long delays, use a scheduler service or Manual Trigger for testing.`
            );
          } else if (delayMs <= 0) {
            // Time has passed or is very close, continue immediately
            console.log(`Schedule trigger: Scheduled time ${time} ${timezone} has passed or is very close. Continuing execution.`);
          }
        } catch (error) {
          // If timezone conversion fails, log warning but don't block execution
          console.warn(`Schedule trigger time calculation failed:`, error);
          // Continue execution even if time calculation fails
        }
      }
      
      const executedAt = new Date().toISOString();
      const output = {
        trigger: "schedule",
        time,
        cron,
        timezone,
        executed_at: executedAt,
        ...inputObj,
      };
      console.log(`Schedule trigger returning:`, JSON.stringify(output));
      return output;
    }
    case "chat_trigger": {
      // Chat trigger: validates message and session_id, returns standardized output
      const inputObj = extractInputObject(input);
      const message = getStringProperty(inputObj, 'message', '');
      const sessionId = getStringProperty(inputObj, 'session_id', '') || getStringProperty(inputObj, '_session_id', '');
      
      if (!message || message.trim() === '') {
        throw new Error("Chat Trigger: message is required. Please provide a message in the input data.");
      }
      if (!sessionId || sessionId.trim() === '') {
        throw new Error("Chat Trigger: session_id is required. Please provide a session_id in the input data.");
      }
      
      const output = {
        trigger: "chat",
        message,
        session_id: sessionId,
        user_context: inputObj.user_context || inputObj.metadata || {},
        ...inputObj,
      };
      console.log(`Chat trigger returning:`, JSON.stringify(output));
      return output;
    }
    case "error_trigger": {
      // Error trigger: fires on node failures (handled globally, not executed directly)
      // If this is called, it means an error occurred and was captured
      const inputObj = extractInputObject(input);
      const output = {
        trigger: "error",
        failed_node: getStringProperty(inputObj, 'failed_node', 'unknown'),
        error_message: getStringProperty(inputObj, 'error_message', 'Unknown error'),
        stack_trace: getStringProperty(inputObj, 'stack_trace', ''),
        ...inputObj,
      };
      console.log(`Error trigger returning:`, JSON.stringify(output));
      return output;
    }
    case "interval": {
      // Interval trigger: returns standardized output with interval
      const interval = getStringProperty(config, 'interval', '10m');
      const executedAt = new Date().toISOString();
      const inputObj = extractInputObject(input);
      const output = {
        trigger: "interval",
        interval,
        executed_at: executedAt,
        ...inputObj,
      };
      console.log(`Interval trigger returning:`, JSON.stringify(output));
      return output;
    }
    case "workflow_trigger": {
      // Workflow trigger: validates source_workflow_id, returns standardized output
      const sourceWorkflowId = getStringProperty(config, 'source_workflow_id', '');
      if (!sourceWorkflowId || sourceWorkflowId.trim() === '') {
        throw new Error("Workflow Trigger: source_workflow_id is required. Please configure the source workflow ID in the node properties.");
      }
      const inputObj = extractInputObject(input);
      const output = {
        trigger: "workflow",
        source_workflow_id: sourceWorkflowId,
        payload: inputObj.payload || inputObj,
        ...inputObj,
      };
      console.log(`Workflow trigger returning:`, JSON.stringify(output));
      return output;
    }

    case "http_request": {
      const urlTemplate = getStringProperty(config, 'url', '');
      if (!urlTemplate || urlTemplate.trim() === '') {
        throw new Error("HTTP Request: URL is required. Please configure the URL in the node properties.");
      }
      const url = replaceTemplates(urlTemplate, input);
      validateURL(url, 'URL', 'HTTP Request');
      
      const method = getStringProperty(config, 'method', 'GET').toUpperCase();
      const timeout = getNumberProperty(config, 'timeout', 30000);
      
      // Parse headers safely
      let headers: Record<string, string> = {};
      const headersStr = getStringProperty(config, 'headers', '');
      if (headersStr && headersStr.trim() !== '') {
        try {
          const parsedHeaders = parseJSONSafe(replaceTemplates(headersStr, input), 'headers') as Record<string, string>;
          if (parsedHeaders && typeof parsedHeaders === 'object') {
            headers = parsedHeaders;
          }
        } catch (error) {
          throw new Error(`HTTP Request: Invalid headers format. Expected valid JSON object. Error: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
      
      // Parse body safely
      let body: unknown = undefined;
      const bodyStr = getStringProperty(config, 'body', '');
      if (bodyStr && bodyStr.trim() !== '' && method !== 'GET') {
        try {
          body = parseJSONSafe(replaceTemplates(bodyStr, input), 'body');
        } catch (error) {
          throw new Error(`HTTP Request: Invalid body format. Expected valid JSON. Error: ${error instanceof Error ? error.message : String(error)}`);
        }
      }

      // Retry logic for transient connection errors
      const maxRetries = 2;
      let lastError: Error | null = null;

      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        try {
          const response = await fetch(url, {
            method,
            headers: { "Content-Type": "application/json", ...headers },
            body: method !== "GET" ? JSON.stringify(body || input) : undefined,
            signal: controller.signal,
          });
          clearTimeout(timeoutId);

          const text = await response.text();
          try {
            return JSON.parse(text);
          } catch {
            return { text, status: response.status };
          }
        } catch (error) {
          clearTimeout(timeoutId);
          lastError = error instanceof Error ? error : new Error(String(error));

          const errorMessage = lastError.message;

          // Retry on TLS/connection errors (transient issues)
          if (attempt < maxRetries && (
            errorMessage.includes("TLS") ||
            errorMessage.includes("connection error") ||
            errorMessage.includes("close_notify") ||
            errorMessage.includes("unexpected_eof")
          )) {
            console.log(`HTTP Request attempt ${attempt + 1} failed, retrying... (${attempt + 1}/${maxRetries + 1})`);
            // Wait a bit before retrying (exponential backoff)
            await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)));
            continue;
          }

          // Provide better error messages for common network issues
          if (errorMessage.includes("TLS") || errorMessage.includes("connection error") || errorMessage.includes("close_notify") || errorMessage.includes("unexpected_eof")) {
            // Check if it's httpstat.us (known to have TLS issues with Deno)
            if (url.includes("httpstat.us")) {
              throw new Error(
                `HTTP Request failed: TLS connection error with httpstat.us\n\n` +
                `URL: ${url}\n` +
                `Error: ${errorMessage}\n\n` +
                `⚠️ Known Issue: httpstat.us has TLS compatibility issues with Deno/rustls.\n\n` +
                `✅ Recommended Test Endpoints:\n` +
                `  - https://jsonplaceholder.typicode.com/posts/1\n` +
                `  - https://api.github.com\n` +
                `  - https://httpbin.org/get\n` +
                `  - https://reqres.in/api/users/1\n\n` +
                `These endpoints work reliably with Deno's fetch implementation.`
              );
            } else {
              throw new Error(
                `HTTP Request failed: Connection/TLS error\n\n` +
                `URL: ${url}\n` +
                `Error: ${errorMessage}\n\n` +
                `Possible causes:\n` +
                `  - Server closed connection unexpectedly\n` +
                `  - TLS/SSL handshake failed\n` +
                `  - Network timeout or connectivity issue\n` +
                `  - Server may be down or unreachable\n\n` +
                `Solutions:\n` +
                `  - Check if the URL is correct and accessible\n` +
                `  - Try increasing the timeout value\n` +
                `  - Verify the server supports HTTPS/TLS\n` +
                `  - Check your network connection\n` +
                `  - Try a different endpoint (e.g., https://jsonplaceholder.typicode.com/posts/1)`
              );
            }
          } else if (errorMessage.includes("aborted") || errorMessage.includes("timeout")) {
            throw new Error(
              `HTTP Request timeout: Request took longer than ${timeout}ms\n\n` +
              `URL: ${url}\n` +
              `Timeout: ${timeout}ms\n\n` +
              `Solutions:\n` +
              `  - Increase timeout in node properties (current: ${timeout}ms)\n` +
              `  - Check if the server is responding\n` +
              `  - Verify the URL is correct`
            );
          } else if (errorMessage.includes("Failed to fetch") || errorMessage.includes("network")) {
            throw new Error(
              `HTTP Request failed: Network error\n\n` +
              `URL: ${url}\n` +
              `Error: ${errorMessage}\n\n` +
              `Possible causes:\n` +
              `  - No internet connection\n` +
              `  - DNS resolution failed\n` +
              `  - Server is unreachable\n` +
              `  - Firewall blocking the request\n\n` +
              `Solutions:\n` +
              `  - Check your internet connection\n` +
              `  - Verify the URL is correct\n` +
              `  - Try accessing the URL in a browser`
            );
          }

          // For other errors, throw with context
          throw new Error(createNodeError('HTTP Request', `Request failed: ${errorMessage}`, `URL: ${url}`));
        }
      }

      // If we get here, all retries failed
      const finalError = lastError || new Error(`Request failed after ${maxRetries + 1} attempts`);
      throw new Error(createNodeError('HTTP Request', finalError.message, `URL: ${url}\n\nAll ${maxRetries + 1} retry attempts failed.`));
    }

    case "graphql": {
      const urlTemplate = getStringProperty(config, 'url', '');
      if (!urlTemplate || urlTemplate.trim() === '') {
        throw new Error("GraphQL: Endpoint URL is required. Please configure the GraphQL endpoint URL in the node properties.");
      }
      const url = replaceTemplates(urlTemplate, input);
      validateURL(url, 'endpoint URL', 'GraphQL');
      
      const queryTemplate = getStringProperty(config, 'query', '');
      if (!queryTemplate || queryTemplate.trim() === '') {
        throw new Error("GraphQL: Query is required. Please provide a GraphQL query in the node properties.");
      }
      const query = replaceTemplates(queryTemplate, input);
      
      const operationNameTemplate = getStringProperty(config, 'operationName', '');
      const operationName = operationNameTemplate ? replaceTemplates(operationNameTemplate, input) : undefined;
      const timeout = getNumberProperty(config, 'timeout', 30000);
      
      // Parse variables safely
      let variables: Record<string, unknown> = {};
      const variablesStr = getStringProperty(config, 'variables', '');
      if (variablesStr && variablesStr.trim() !== '') {
        try {
          const parsedVariables = parseJSONSafe(replaceTemplates(variablesStr, input), 'variables');
          if (parsedVariables && typeof parsedVariables === 'object' && parsedVariables !== null) {
            variables = parsedVariables as Record<string, unknown>;
          }
        } catch (error) {
          throw new Error(`GraphQL: Invalid variables format. Expected valid JSON object. Error: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
      
      // Parse headers safely
      let headers: Record<string, string> = {};
      const headersStr = getStringProperty(config, 'headers', '');
      if (headersStr && headersStr.trim() !== '') {
        try {
          const parsedHeaders = parseJSONSafe(replaceTemplates(headersStr, input), 'headers') as Record<string, string>;
          if (parsedHeaders && typeof parsedHeaders === 'object') {
            headers = parsedHeaders;
          }
        } catch (error) {
          throw new Error(`GraphQL: Invalid headers format. Expected valid JSON object. Error: ${error instanceof Error ? error.message : String(error)}`);
        }
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      try {
        const requestBody: Record<string, unknown> = {
          query,
        };
        if (operationName) {
          requestBody.operationName = operationName;
        }
        if (Object.keys(variables).length > 0) {
          requestBody.variables = variables;
        }

        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...headers },
          body: JSON.stringify(requestBody),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        const text = await response.text();
        const result = JSON.parse(text);

        // Check for GraphQL errors
        if (result.errors && Array.isArray(result.errors) && result.errors.length > 0) {
          const errorMessages = result.errors.map((e: unknown) => {
            if (e && typeof e === 'object' && 'message' in e) {
              return String(e.message);
            }
            return String(e);
          }).join(", ");
          throw new Error(createNodeError('GraphQL', `Query failed: ${errorMessages}`, `Endpoint: ${url}`));
        }

        return result.data || result;
      } catch (error) {
        clearTimeout(timeoutId);
        const errorMessage = error instanceof Error ? error.message : String(error);
        
        if (errorMessage.includes("aborted") || errorMessage.includes("timeout")) {
          throw new Error(
            createNodeError(
              'GraphQL',
              `Request timeout: Request took longer than ${timeout}ms`,
              `Endpoint: ${url}\nTimeout: ${timeout}ms\n\nSolutions:\n  - Increase timeout in node properties (current: ${timeout}ms)\n  - Check if the GraphQL endpoint is responding\n  - Verify the endpoint URL is correct`
            )
          );
        }
        
        throw new Error(createNodeError('GraphQL', `Query failed: ${errorMessage}`, `Endpoint: ${url}`));
      }
    }

    case "respond_to_webhook": {
      // This node stores the response data that will be returned by the webhook
      // The response body can be a template string or JSON
      const statusCode = (config.statusCode as number) || 200;
      const responseBodyStr = config.responseBody as string;
      const headersStr = config.headers as string;
      
      let responseBody: unknown;
      if (responseBodyStr) {
        try {
          // Try to parse as JSON first
          responseBody = JSON.parse(replaceTemplates(responseBodyStr, input));
        } catch {
          // If not valid JSON, treat as template string
          responseBody = replaceTemplates(responseBodyStr, input);
        }
      } else {
        // If no response body specified, use the input data
        responseBody = input;
      }

      const customHeaders = headersStr ? JSON.parse(replaceTemplates(headersStr, input)) : {};

      // Return response data in a format that webhook-trigger can extract
      return {
        _webhook_response: true,
        statusCode,
        body: responseBody,
        headers: customHeaders,
        // Also include the response in standard format for extraction
        message: typeof responseBody === 'string' ? responseBody : (responseBody as any)?.message || (responseBody as any)?.text || JSON.stringify(responseBody),
        text: typeof responseBody === 'string' ? responseBody : (responseBody as any)?.text || JSON.stringify(responseBody),
        content: typeof responseBody === 'string' ? responseBody : (responseBody as any)?.content || JSON.stringify(responseBody),
        response: responseBody,
      };
    }

    case "http_post": {
      const url = replaceTemplates(config.url as string, input);
      const headersStr = config.headers as string;
      const headers = headersStr ? JSON.parse(replaceTemplates(headersStr, input)) : {};
      const bodyTemplate = config.bodyTemplate as string;
      const body = bodyTemplate ? replaceTemplates(bodyTemplate, input) : JSON.stringify(input);

      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body,
      });

      const text = await response.text();
      try {
        return JSON.parse(text);
      } catch {
        return { text, status: response.status };
      }
    }

    case "openai_gpt":
    case "anthropic_claude":
    case "google_gemini":
    case "text_summarizer":
    case "sentiment_analyzer": {
      const nodeApiKey = config.apiKey as string;

      // Google Gemini uses direct API call
      if (type === "google_gemini") {
        if (!nodeApiKey || !nodeApiKey.trim()) {
          throw new Error(`API Key is required for ${node.data.label || "Google Gemini"} node. Please add your Gemini API key in the node properties.`);
        }
        return executeGeminiNode(config, input, nodeApiKey, conversationHistory);
      }

      // For other AI nodes, API key is mandatory
      if (!nodeApiKey || !nodeApiKey.trim()) {
        const nodeName = type === "openai_gpt" ? "OpenAI GPT" :
          type === "anthropic_claude" ? "Anthropic Claude" :
            type === "text_summarizer" ? "Text Summarizer" :
              "Sentiment Analyzer";
        throw new Error(`API Key is required for ${node.data.label || nodeName} node. Please add your API key in the node properties.`);
      }

      const finalApiKey = nodeApiKey;

      let prompt = (config.prompt as string) || "";
      const temperature = (config.temperature as number) || 0.7;

      // Map node type/model selection to gateway model id
      const configModel = (config.model as string) || "";
      let model = "google/gemini-pro"; // fallback

      const setOpenAI = (val: string) => {
        if (val === "gpt-4o") return "openai/gpt-4o";
        if (val === "gpt-4o-mini" || val === "gpt-4o-mini-2024-07-18" || val === "gpt-4o-mini-2024-07-18") return "openai/gpt-4o-mini";
        if (val === "gpt-4-turbo") return "openai/gpt-4-turbo";
        return undefined;
      };

      const setClaude = (val: string) => {
        if (val === "claude-3-5-sonnet") return "anthropic/claude-3-5-sonnet";
        if (val === "claude-3-5-haiku") return "anthropic/claude-3-5-haiku";
        if (val === "claude-3-sonnet") return "anthropic/claude-3-sonnet";
        if (val === "claude-3-opus") return "anthropic/claude-3-opus";
        if (val === "claude-3-haiku") return "anthropic/claude-3-haiku";
        return undefined;
      };

      const setGemini = (val: string) => {
        if (val === "gemini-2.5-flash") return "google/gemini-2.5-flash";
        if (val === "gemini-2.5-pro") return "google/gemini-2.5-pro";
        if (val === "gemini-2.5-flash-lite") return "google/gemini-2.5-flash-lite";
        return undefined;
      };

      if (type === "openai_gpt") {
        model = setOpenAI(configModel) || model;
      } else if (type === "anthropic_claude") {
        model = setClaude(configModel) || model;
      } else if (type === "text_summarizer" || type === "sentiment_analyzer") {
        // Allow selecting any supported provider for summarizer/sentiment
        // Try all providers in order of preference
        model = setOpenAI(configModel) || setClaude(configModel) || setGemini(configModel) || model;
      }
      // Note: google_gemini is handled earlier with early return, so we don't need to check it here

      // Special prompts for specific node types
      if (type === "text_summarizer") {
        const maxLength = (config.maxLength as number) || 200;
        const style = (config.style as string) || "concise";
        prompt = `Summarize the following text in a ${style} manner. Keep it under ${maxLength} words. ${style === "bullets" ? "Use bullet points." : ""}`;
      } else if (type === "sentiment_analyzer") {
        prompt = "Analyze the sentiment of the following text. Return a JSON object with 'sentiment' (positive/negative/neutral), 'confidence' (0-1), and 'emotions' (array of detected emotions).";
      }

      // Build messages array with conversation history
      const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
        { role: "system", content: prompt || "You are a helpful assistant." }
      ];

      // Add conversation history if available (for memory)
      if (conversationHistory && Array.isArray(conversationHistory) && conversationHistory.length > 0) {
        messages.push(...conversationHistory.map(msg => ({
          role: msg.role as 'user' | 'assistant',
          content: msg.content
        })));
      }

      // Add current user message
      const userMessage = (() => {
        // Extract message from input - handle different input formats
        if (typeof input === "string") {
          return input;
        } else if (typeof input === "object" && input !== null) {
          const inputObj = input as Record<string, unknown>;
          // Try to extract message from common fields
          return (inputObj.message as string) ||
            (inputObj.text as string) ||
            (inputObj.content as string) ||
            (inputObj.input as string) ||
            JSON.stringify(input);
        } else {
          return String(input);
        }
      })();

      messages.push({ role: "user", content: userMessage });

      // Use LLM Adapter for unified interface
      const llmAdapterInstance = new LLMAdapter();
      // Detect provider based on model, with fallback based on node type
      let providerKey = LLMAdapter.detectProvider(model);

      // Override if specific node type implies a provider
      if (type === 'anthropic_claude') providerKey = 'claude';
      else if (type === 'openai_gpt') providerKey = 'openai';

      try {
        const response = await llmAdapterInstance.chat(providerKey, messages, {
          model,
          temperature,
          apiKey: finalApiKey,
        });

        const content = response.content;

        // Try to parse as JSON for sentiment analyzer
        if (type === "sentiment_analyzer") {
          try {
            return JSON.parse(content);
          } catch {
            return { raw: content };
          }
        }

        return content;
      } catch (error) {
        // Fallback to gateway for backward compatibility
        console.warn("LLM Adapter failed, falling back to gateway:", error);

        const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${finalApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model,
            messages,
            temperature,
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          if (response.status === 429) {
            throw new Error("AI rate limit exceeded. Please try again later.");
          }
          if (response.status === 402) {
            throw new Error("AI credits exhausted. Please add more credits.");
          }
          throw new Error(`AI request failed: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content || "";

        // Try to parse as JSON for sentiment analyzer
        if (type === "sentiment_analyzer") {
          try {
            return JSON.parse(content);
          } catch {
            return { raw: content };
          }
        }
        return content;
      }
    }

    case "azure_openai": {
      const endpoint = getStringProperty(config, 'endpoint', '');
      const apiKey = getStringProperty(config, 'apiKey', '');
      const deploymentName = getStringProperty(config, 'deploymentName', '');
      const apiVersion = getStringProperty(config, 'apiVersion', '2024-02-15-preview');
      const prompt = getStringProperty(config, 'prompt', 'You are a helpful assistant.');
      const temperature = (config.temperature as number) || 0.7;

      if (!endpoint || !apiKey || !deploymentName) {
        throw new Error('Azure OpenAI: Endpoint, API Key, and Deployment Name are required');
      }

      // Extract message from input
      const userMessage = typeof input === 'string' 
        ? input 
        : (input as Record<string, unknown>)?.message as string || 
          (input as Record<string, unknown>)?.text as string || 
          JSON.stringify(input);

      const messages: Array<{ role: string; content: string }> = [
        { role: 'system', content: prompt },
        { role: 'user', content: userMessage }
      ];

      // Add conversation history if available
      if (conversationHistory && Array.isArray(conversationHistory) && conversationHistory.length > 0) {
        messages.push(...conversationHistory.map(msg => ({
          role: msg.role,
          content: msg.content
        })));
        messages.push({ role: 'user', content: userMessage });
      }

      try {
        const url = `${endpoint.replace(/\/$/, '')}/openai/deployments/${deploymentName}/chat/completions?api-version=${apiVersion}`;
        
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'api-key': apiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messages: messages.map(m => ({ role: m.role, content: m.content })),
            temperature,
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Azure OpenAI API error: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        return data.choices?.[0]?.message?.content || '';
      } catch (error) {
        throw new Error(`Azure OpenAI: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    case "hugging_face": {
      const apiKey = getStringProperty(config, 'apiKey', '');
      const model = getStringProperty(config, 'model', '');
      const task = getStringProperty(config, 'task', 'text-generation');
      const parameters = (config.parameters as Record<string, unknown>) || {};

      if (!apiKey || !model) {
        throw new Error('Hugging Face: API Key and Model ID are required');
      }

      // Extract input text
      const inputText = typeof input === 'string' 
        ? input 
        : (input as Record<string, unknown>)?.text as string || 
          (input as Record<string, unknown>)?.input as string || 
          JSON.stringify(input);

      try {
        const url = `https://api-inference.huggingface.co/models/${model}`;
        const headers: Record<string, string> = {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        };

        const payload: Record<string, unknown> = {
          inputs: inputText,
        };

        // Add task-specific parameters
        if (task === 'text-generation' && Object.keys(parameters).length > 0) {
          Object.assign(payload, parameters);
        } else if (task === 'question-answering') {
          // For QA, inputs should be { question, context }
          if (typeof input === 'object' && input !== null) {
            const inputObj = input as Record<string, unknown>;
            payload.inputs = {
              question: inputObj.question || inputText,
              context: inputObj.context || '',
            };
          }
        }

        const response = await fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const errorText = await response.text();
          if (response.status === 503) {
            throw new Error('Hugging Face: Model is loading, please try again in a few moments');
          }
          throw new Error(`Hugging Face API error: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        
        // Handle different response formats based on task
        if (task === 'text-generation' && Array.isArray(data) && data[0]?.generated_text) {
          return data[0].generated_text;
        } else if (task === 'text-classification' && Array.isArray(data) && data[0]?.label) {
          return data[0];
        } else if (task === 'question-answering' && data.answer) {
          return data;
        }
        
        return data;
      } catch (error) {
        throw new Error(`Hugging Face: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    case "cohere": {
      const apiKey = getStringProperty(config, 'apiKey', '');
      const model = getStringProperty(config, 'model', 'command');
      const prompt = getStringProperty(config, 'prompt', '');
      const temperature = (config.temperature as number) || 0.7;

      if (!apiKey || !prompt) {
        throw new Error('Cohere: API Key and Prompt are required');
      }

      // Extract input text
      const inputText = typeof input === 'string' 
        ? input 
        : (input as Record<string, unknown>)?.text as string || 
          (input as Record<string, unknown>)?.message as string || 
          JSON.stringify(input);

      // Combine prompt with input
      const fullPrompt = prompt.includes('{{input}}') 
        ? prompt.replace('{{input}}', inputText)
        : `${prompt}\n\n${inputText}`;

      try {
        const response = await fetch('https://api.cohere.ai/v1/generate', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          body: JSON.stringify({
            model,
            prompt: fullPrompt,
            temperature,
            max_tokens: 2048,
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Cohere API error: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        return data.generations?.[0]?.text || '';
      } catch (error) {
        throw new Error(`Cohere: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    case "ollama": {
      const serverUrl = getStringProperty(config, 'serverUrl', 'http://localhost:11434');
      const model = getStringProperty(config, 'model', 'llama2');
      const prompt = getStringProperty(config, 'prompt', '');
      const temperature = (config.temperature as number) || 0.7;

      if (!model || !prompt) {
        throw new Error('Ollama: Model name and Prompt are required');
      }

      // Extract input text
      const inputText = typeof input === 'string' 
        ? input 
        : (input as Record<string, unknown>)?.text as string || 
          (input as Record<string, unknown>)?.message as string || 
          JSON.stringify(input);

      // Combine prompt with input
      const fullPrompt = prompt.includes('{{input}}') 
        ? prompt.replace('{{input}}', inputText)
        : `${prompt}\n\n${inputText}`;

      try {
        const url = `${serverUrl.replace(/\/$/, '')}/api/generate`;
        
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model,
            prompt: fullPrompt,
            temperature,
            stream: false,
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Ollama API error: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        return data.response || '';
      } catch (error) {
        throw new Error(`Ollama: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    case "slack_message":
    case "slack_webhook": {
      const webhookUrl = config.webhookUrl as string;
      if (!webhookUrl) throw new Error("Slack webhook URL is required");

      const payload: Record<string, unknown> = {};

      if (type === "slack_message") {
        const messageValue = config.message;
        payload.text = messageValue ? replaceTemplates(String(messageValue), input) : '';
        if (config.channel) payload.channel = config.channel;
        if (config.username) payload.username = config.username;
        if (config.iconEmoji) payload.icon_emoji = config.iconEmoji;

        const blocksStr = config.blocks as string;
        if (blocksStr) {
          try {
            const blocks = JSON.parse(replaceTemplates(blocksStr, input));
            if (Array.isArray(blocks) && blocks.length > 0) {
              payload.blocks = blocks;
            }
          } catch {
            // Do nothing, we'll fall back to using the text
          }
        }
      } else {
        const textValue = config.text;
        payload.text = textValue ? replaceTemplates(String(textValue), input) : '';
      }

      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Slack webhook failed: ${response.status} - ${errorText}`);
      }

      return { success: true, message: "Slack message sent" };
    }

    case "discord_webhook": {
      const webhookUrl = config.webhookUrl as string;
      if (!webhookUrl) throw new Error("Discord webhook URL is required");

      const contentValue = config.content;
      const payload: Record<string, unknown> = {
        content: contentValue ? replaceTemplates(String(contentValue), input) : '',
      };
      if (config.username) payload.username = config.username;
      if (config.avatarUrl) payload.avatar_url = config.avatarUrl;

      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Discord webhook failed: ${response.status} - ${errorText}`);
      }

      return { success: true, message: "Discord message sent" };
    }

    case "email_resend": {
      const resendApiKey = Deno.env.get("RESEND_API_KEY");
      if (!resendApiKey) {
        console.warn("RESEND_API_KEY not configured. Email node will be skipped.");
        return {
          success: false,
          skipped: true,
          message: "Email skipped: RESEND_API_KEY not configured. Add it to your Supabase secrets to enable email sending.",
          input: input // Pass through input so workflow continues
        };
      }

      // Extract and validate email fields
      const toValue = config.to;
      const fromValue = config.from;
      const subjectValue = config.subject;
      const bodyValue = config.body;
      const replyToValue = config.replyTo;
      
      const to = toValue ? replaceTemplates(String(toValue), input) : '';
      const from = fromValue ? replaceTemplates(String(fromValue), input) : '';
      const subject = subjectValue ? replaceTemplates(String(subjectValue), input) : '';
      const body = bodyValue ? replaceTemplates(String(bodyValue), input) : '';
      const replyTo = replyToValue ? replaceTemplates(String(replyToValue), input) : undefined;

      // Validate required fields
      if (!to || !to.trim()) {
        throw new Error("Email 'To' field is required. Please configure the recipient email address in the node properties.");
      }

      if (!from || !from.trim()) {
        throw new Error("Email 'From' field is required. Please configure the sender email address in the node properties. Format: 'email@example.com' or 'Name <email@example.com>'");
      }

      // Validate email format (basic check)
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const fromEmailMatch = from.match(/<([^>]+)>/) || from.match(/^([^\s<]+)$/);
      const fromEmail = fromEmailMatch ? fromEmailMatch[1] : from.trim();

      if (!emailRegex.test(fromEmail)) {
        // Provide helpful error message with examples
        const currentValue = from.trim();
        let helpfulMessage = `Invalid 'From' email format: "${currentValue}"\n\n`;
        helpfulMessage += `Current value appears to be a domain/URL, not an email address.\n\n`;
        helpfulMessage += `Please update the "From" field in the email node properties to:\n`;
        helpfulMessage += `  - A valid email: "notifications@ctrl-checks-001.vercel.app"\n`;
        helpfulMessage += `  - Or with name: "CtrlChecks <notifications@ctrl-checks-001.vercel.app>"\n\n`;
        helpfulMessage += `Note: The email domain must be verified in your Resend account.`;
        throw new Error(helpfulMessage);
      }

      // Validate 'To' emails
      const toEmails = to.split(",").map(e => e.trim()).filter(e => e);
      if (toEmails.length === 0) {
        throw new Error("Email 'To' field must contain at least one valid email address.");
      }

      for (const email of toEmails) {
        if (!emailRegex.test(email)) {
          throw new Error(`Invalid 'To' email format: "${email}". Use format: 'email@example.com'`);
        }
      }

      if (!subject || !subject.trim()) {
        throw new Error("Email 'Subject' field is required. Please configure the email subject in the node properties.");
      }

      if (!body || !body.trim()) {
        throw new Error("Email 'Body' field is required. Please configure the email body content in the node properties.");
      }

      try {
        const response = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: from.trim(),
            to: toEmails,
            subject: subject.trim(),
            html: body.trim(),
            reply_to: replyTo ? replyTo.trim() : undefined,
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          let errorMessage = `Email send failed: ${response.status}`;
          try {
            const errorJson = JSON.parse(errorText);
            const resendMessage = errorJson.message || errorText;
            errorMessage += ` - ${resendMessage}`;

            // Provide helpful guidance for common Resend errors
            if (response.status === 403 && resendMessage.includes("domain is not verified")) {
              errorMessage += `\n\n`;
              errorMessage += `🔧 SOLUTION:\n`;
              errorMessage += `Your email domain is not verified in Resend.\n\n`;
              errorMessage += `Option 1 (Testing): Use Resend's test domain:\n`;
              errorMessage += `  From: onboarding@resend.dev\n`;
              errorMessage += `  To: delivered@resend.dev\n\n`;
              errorMessage += `Option 2 (Production): Verify your domain:\n`;
              errorMessage += `  1. Go to https://resend.com/domains\n`;
              errorMessage += `  2. Add and verify your domain: ${fromEmail.split('@')[1] || 'your-domain.com'}\n`;
              errorMessage += `  3. Add the required DNS records\n`;
              errorMessage += `  4. Wait for verification (usually a few minutes)\n\n`;
              errorMessage += `For more help: https://resend.com/docs/dashboard/domains/introduction`;
            } else if (response.status === 403 && (resendMessage.includes("free public domains") || resendMessage.includes("don't allow"))) {
              errorMessage += `\n\n`;
              errorMessage += `❌ ISSUE: Resend doesn't allow free subdomains (like vercel.app, netlify.app, etc.)\n\n`;
              errorMessage += `🔧 SOLUTIONS:\n\n`;
              errorMessage += `Option 1 (Testing - Recommended):\n`;
              errorMessage += `  Use Resend's test domain (works immediately):\n`;
              errorMessage += `  From: onboarding@resend.dev\n`;
              errorMessage += `  To: delivered@resend.dev\n\n`;
              errorMessage += `Option 2 (Production):\n`;
              errorMessage += `  Use a domain you own (not a free subdomain):\n`;
              errorMessage += `  - Buy a domain (e.g., yourdomain.com)\n`;
              errorMessage += `  - Or use your existing domain\n`;
              errorMessage += `  - Verify it in Resend: https://resend.com/domains\n\n`;
              errorMessage += `Option 3 (Skip Email):\n`;
              errorMessage += `  Remove or disconnect the email node if you don't need it.\n`;
            } else if (response.status === 403) {
              errorMessage += `\n\n`;
              errorMessage += `This is likely a domain verification or API key issue.\n`;
              errorMessage += `Check: https://resend.com/domains`;
            }
          } catch {
            errorMessage += ` - ${errorText}`;
          }
          throw new Error(errorMessage);
        }

        const data = await response.json();
        return { success: true, emailId: data.id, message: "Email sent successfully" };
      } catch (error) {
        console.error("Email send error:", error);
        throw error;
      }
    }

    case "if_else": {
      const condition = config.condition as string;
      // Extract the actual input data (in case it's wrapped)
      const actualInput = (input && typeof input === "object" && "input" in input)
        ? (input as Record<string, unknown>).input
        : input;

      console.log(`If/Else node evaluating condition: "${condition}"`);
      console.log(`If/Else node input:`, JSON.stringify(actualInput));

      const result = evaluateCondition(condition, actualInput);

      console.log(`If/Else condition result: ${result}`);

      // Return the original input structure for downstream nodes
      return { condition: result, input: actualInput };
    }

    case "switch": {
      const expression = config.expression as string;

      if (!expression || !expression.trim()) {
        throw new Error("Switch expression is required. Please configure the expression in the node properties.");
      }

      // Parse cases - can be a JSON string or already an array
      let cases: Array<{ value: string; label?: string }> = [];
      const casesConfig = config.cases;

      if (casesConfig) {
        if (typeof casesConfig === "string") {
          // Parse JSON string
          try {
            cases = JSON.parse(casesConfig);
          } catch (parseError) {
            console.error("Switch: Failed to parse cases JSON:", parseError);
            throw new Error(`Switch cases must be valid JSON array. Error: ${parseError instanceof Error ? parseError.message : "Invalid JSON"}`);
          }
        } else if (Array.isArray(casesConfig)) {
          // Already an array
          cases = casesConfig;
        } else {
          throw new Error("Switch cases must be a JSON array. Format: [{\"value\": \"active\", \"label\": \"Active\"}]");
        }
      }

      if (!Array.isArray(cases)) {
        throw new Error(`Switch cases must be an array. Received: ${typeof cases}. Please configure cases as JSON array in node properties.`);
      }

      // Evaluate the expression to get the value to match
      const expressionValue = replaceTemplates(expression, input);
      const matchValue = expressionValue.trim();

      console.log(`Switch node evaluating expression: "${expression}"`);
      console.log(`Switch node input:`, JSON.stringify(input));
      console.log(`Switch expression result: "${matchValue}"`);
      console.log(`Switch cases:`, JSON.stringify(cases));

      // Find matching case
      const matchingCase = cases.find(c => String(c.value) === matchValue);

      if (matchingCase) {
        console.log(`Switch matched case: "${matchingCase.value}" (${matchingCase.label || 'no label'})`);
        // Return input with case information for routing
        return {
          matchedCase: matchingCase.value,
          caseLabel: matchingCase.label,
          input: input
        };
      } else {
        console.log(`Switch: No matching case found for "${matchValue}"`);
        console.log(`Available cases:`, cases.map(c => c.value).join(", "));
        // Return input with no match (could route to default branch if implemented)
        return {
          matchedCase: null,
          caseLabel: null,
          input: input
        };
      }
    }

    case "filter": {
      const arrayExpr = config.array as string;
      const conditionExpr = config.condition as string;

      if (!conditionExpr || !conditionExpr.trim()) {
        throw new Error("Filter condition is required. Please configure the filter condition in the node properties.");
      }

      let items: unknown[] = [];

      // Try to extract array from expression
      if (arrayExpr && arrayExpr.trim()) {
        // Handle different expression formats
        const cleanExpr = arrayExpr.trim();

        // If expression starts with input., extractValue should handle it
        if (cleanExpr.startsWith("input.") || cleanExpr.startsWith("{{input.")) {
          // Remove template syntax if present
          const expr = cleanExpr.replace(/^\{\{|\}\}$/g, "").replace(/^input\./, "");
          items = extractValue(expr, input) as unknown[] || [];
        } else {
          // Try direct extraction
          items = extractValue(cleanExpr, input) as unknown[] || [];
        }
      }

      // If no array found, try common patterns
      if (!Array.isArray(items) || items.length === 0) {
        // Check if input itself is an array
        if (Array.isArray(input)) {
          items = input;
        }
        // Check if input has an 'items' property
        else if (typeof input === "object" && input !== null) {
          const inputObj = input as Record<string, unknown>;
          if (Array.isArray(inputObj.items)) {
            items = inputObj.items;
          } else if (Array.isArray(inputObj.data)) {
            items = inputObj.data;
          } else if (Array.isArray(inputObj.array)) {
            items = inputObj.array;
          } else {
            // Try to find any array property
            const arrayKey = Object.keys(inputObj).find(key => Array.isArray(inputObj[key]));
            if (arrayKey) {
              items = inputObj[arrayKey] as unknown[];
            }
          }
        }
      }

      if (!Array.isArray(items)) {
        throw new Error(
          `Filter requires an array input.\n\n` +
          `Received: ${typeof input === "object" ? JSON.stringify(input).substring(0, 200) : String(input)}\n\n` +
          `Please configure the "Array Expression" field to point to an array property.\n` +
          `Examples: "items", "input.items", "{{input.items}}"`
        );
      }

      console.log(`Filter: Processing ${items.length} items with condition: ${conditionExpr}`);

      const filtered = items.filter((item) => {
        try {
          // Evaluate condition with item in scope
          const fn = new Function("item", `return ${conditionExpr};`);
          const result = fn(item);
          console.log(`Filter: Item ${JSON.stringify(item).substring(0, 50)}... -> ${result}`);
          return Boolean(result);
        } catch (error) {
          console.error(`Filter condition evaluation error for item:`, item, error);
          return false;
        }
      });

      console.log(`Filter: Filtered ${items.length} items down to ${filtered.length} items`);
      return filtered;
    }

    case "wait": {
      const duration = (config.duration as number) || 1000;
      await new Promise(resolve => setTimeout(resolve, Math.min(duration, 10000)));
      return input;
    }

    case "javascript": {
      const code = config.code as string;
      if (!code || !code.trim()) {
        return input;
      }
      
      try {
        // Check if code is already a function expression/arrow function
        const trimmedCode = code.trim();
        if (trimmedCode.startsWith('(') || trimmedCode.startsWith('function') || trimmedCode.startsWith('async')) {
          // Try as function expression first
          try {
            const fn = new Function("input", `return (${code})(input);`);
            return fn(input);
          } catch {
            // Fall through to function body approach
          }
        }
        
        // Execute as function body (supports const, let, var, and other statements)
        const fn = new Function("input", code);
        const result = fn(input);
        // If function doesn't return anything, return the input
        return result !== undefined ? result : input;
      } catch (error) {
        console.error(`JavaScript node execution error:`, error);
        throw new Error(`JavaScript execution failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    case "loop": {
      // Loop: Iterate over items with max iterations protection
      const arrayExpr = getStringProperty(config, 'array', '');
      const maxIterations = getNumberProperty(config, 'maxIterations', 100);
      
      if (!arrayExpr || arrayExpr.trim() === '') {
        throw new Error('Loop: Array expression is required. Please configure the array expression in the node properties.');
      }
      
      // Extract array from input
      let items: unknown[] = [];
      
      // Try to extract array from expression
      const cleanExpr = arrayExpr.trim().replace(/^\{\{|\}\}$/g, "").replace(/^input\./, "");
      items = extractValue(cleanExpr, input) as unknown[] || [];
      
      // If no array found, try common patterns
      if (!Array.isArray(items) || items.length === 0) {
        const inputObj = extractInputObject(input);
        if (Array.isArray(inputObj)) {
          items = inputObj;
        } else if (Array.isArray(inputObj.items)) {
          items = inputObj.items;
        } else if (Array.isArray(inputObj.data)) {
          items = inputObj.data;
        } else if (Array.isArray(inputObj.array)) {
          items = inputObj.array;
        } else {
          // Try to find any array property
          const arrayKey = Object.keys(inputObj).find(key => Array.isArray(inputObj[key]));
          if (arrayKey) {
            items = inputObj[arrayKey] as unknown[];
          }
        }
      }
      
      if (!Array.isArray(items)) {
        throw new Error(
          `Loop: Input must be an array.\n\n` +
          `Received: ${typeof input === "object" ? JSON.stringify(input).substring(0, 200) : String(input)}\n\n` +
          `Please configure the "Array Expression" field to point to an array property.\n` +
          `Examples: "items", "input.items", "{{input.items}}"`
        );
      }
      
      // Limit iterations to prevent infinite loops
      const iterations = Math.min(items.length, maxIterations);
      
      const results: unknown[] = [];
      for (let i = 0; i < iterations; i++) {
        results.push({
          item: items[i],
          index: i,
          total: items.length
        });
      }
      
      return {
        items: results,
        count: results.length,
        total: items.length,
        ...extractInputObject(input)
      };
    }

    case "error_handler": {
      // Error Handler: Retry logic with fallback (note: this is a wrapper node)
      // Actual retry logic should be implemented at the workflow execution level
      // This node serves as a marker and can provide fallback values
      const retries = getNumberProperty(config, 'retries', 3);
      const retryDelay = getNumberProperty(config, 'retryDelay', 1000);
      const fallbackValueStr = getStringProperty(config, 'fallbackValue', 'null');
      
      let fallbackValue: unknown = null;
      if (fallbackValueStr && fallbackValueStr.trim() !== 'null' && fallbackValueStr.trim() !== '') {
        try {
          fallbackValue = parseJSONSafe(fallbackValueStr, 'fallbackValue');
        } catch {
          // If parsing fails, use the string value
          fallbackValue = fallbackValueStr;
        }
      }
      
      // Note: Actual retry logic is handled at workflow execution level
      // This node just passes through input, but can be used to mark error handling points
      return {
        ...extractInputObject(input),
        _error_handler_config: {
          retries,
          retryDelay,
          fallbackValue
        }
      };
    }

    case "javascript": {
      const code = getStringProperty(config, 'code', 'return input;');
      const timeout = getNumberProperty(config, 'timeout', 5000);
      
      console.log(`[JAVASCRIPT] Executing code with input:`, JSON.stringify(input));
      console.log(`[JAVASCRIPT] Code:`, code);
      
      try {
        const startTime = Date.now();
        // Execute code directly as a function body (not as a function call)
        const fn = new Function("input", code);
        const result = fn(input);
        const executionTime = Date.now() - startTime;
        
        if (executionTime > timeout) {
          throw new Error(`JavaScript: Execution exceeded timeout of ${timeout}ms`);
        }
        
        console.log(`[JAVASCRIPT] Result:`, JSON.stringify(result));
        return result;
      } catch (error) {
        throw new Error(`JavaScript: Code execution failed. ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    case "function": {
      // Function: Dataset-level execution (operates on entire input array/object)
      const code = getStringProperty(config, 'code', 'return input;');
      const timeout = getNumberProperty(config, 'timeout', 10000);
      
      const inputObj = extractInputObject(input);
      const data = extractDataFromInput(input);
      
      try {
        const startTime = Date.now();
        const fn = new Function("input", "data", `return (${code})(input, data);`);
        const result = fn(input, data);
        const executionTime = Date.now() - startTime;
        
        if (executionTime > timeout) {
          throw new Error(`Function: Execution exceeded timeout of ${timeout}ms`);
        }
        
        return {
          result,
          executionTime,
          ...inputObj
        };
      } catch (error) {
        try {
          const fn = new Function("input", "data", code);
          return fn(input, data);
        } catch (innerError) {
          throw new Error(`Function: Code execution failed. ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    }

    case "function_item": {
      // Function Item: Per-item execution (operates on each item in array)
      const code = getStringProperty(config, 'code', 'return item;');
      const timeout = getNumberProperty(config, 'timeout', 5000);
      
      const inputObj = extractInputObject(input);
      const data = extractDataFromInput(input);
      
      if (!Array.isArray(data)) {
        throw new Error('Function Item: Input must be an array or contain an array');
      }
      
      const results: unknown[] = [];
      
      for (let i = 0; i < data.length; i++) {
        const item = data[i];
        try {
          const startTime = Date.now();
          const fn = new Function("item", "index", "input", `return (${code})(item, index, input);`);
          const result = fn(item, i, input);
          const executionTime = Date.now() - startTime;
          
          if (executionTime > timeout) {
            throw new Error(`Function Item: Execution exceeded timeout of ${timeout}ms for item ${i}`);
          }
          
          results.push(result);
        } catch (error) {
          throw new Error(`Function Item: Code execution failed for item ${i}. ${error instanceof Error ? error.message : String(error)}`);
        }
      }
      
      return {
        items: results,
        count: results.length,
        ...inputObj
      };
    }

    case "execute_command": {
      // Execute Command: Sandboxed command execution (DISABLED by default for security)
      const command = getStringProperty(config, 'command', '');
      const enabled = getBooleanProperty(config, 'enabled', false);
      const timeout = getNumberProperty(config, 'timeout', 30000);
      
      if (!enabled) {
        throw new Error('Execute Command: Command execution is disabled by default for security. Enable it in node configuration if you trust the command.');
      }
      
      if (!command || command.trim() === '') {
        throw new Error('Execute Command: Command is required');
      }
      
      // Security: Basic validation (prevent dangerous commands)
      const dangerousCommands = ['rm', 'delete', 'format', 'mkfs', 'dd', 'sudo', 'su'];
      const commandLower = command.toLowerCase();
      for (const dangerous of dangerousCommands) {
        if (commandLower.includes(dangerous)) {
          throw new Error(`Execute Command: Command contains potentially dangerous operation: ${dangerous}`);
        }
      }
      
      // Note: In Deno, we can use Deno.run() for command execution
      // However, for security, this is disabled by default
      // This is a placeholder implementation
      throw new Error('Execute Command: Command execution is not enabled in this environment for security reasons. Use JavaScript/Function nodes instead.');
    }

    case "json_parser": {
      const expression = config.expression as string;
      if (!expression) return input;
      return extractValue(expression, input);
    }

    case "text_formatter": {
      const template = config.template as string;
      if (!template) return input;

      // Flatten nested Set Variable outputs for easier template access
      // If input has nested objects from Set Variable nodes, merge them
      let flattenedInput = input;
      if (typeof input === "object" && input !== null) {
        const inputObj = input as Record<string, unknown>;
        const keys = Object.keys(inputObj);

        // Check if this looks like multiple Set Variable outputs (nested objects with variable names)
        const hasNestedVariables = keys.some(key => {
          const value = inputObj[key];
          return typeof value === "object" && value !== null && !Array.isArray(value);
        });

        if (hasNestedVariables) {
          // Flatten: merge all nested objects into one
          flattenedInput = {};
          keys.forEach(key => {
            const value = inputObj[key];
            if (typeof value === "object" && value !== null && !Array.isArray(value)) {
              // Merge nested object properties
              Object.assign(flattenedInput as Record<string, unknown>, value as Record<string, unknown>);
            } else {
              // Keep non-object values as-is
              (flattenedInput as Record<string, unknown>)[key] = value;
            }
          });
          console.log(`Text Formatter: Flattened input from ${keys.length} sources:`, JSON.stringify(flattenedInput));
        }
      }

      return replaceTemplates(template, flattenedInput);
    }

    case "set_variable": {
      const name = config.name as string;
      const valueExpr = config.value as string;
      const value = replaceTemplates(valueExpr, input);
      return { [name]: value, ...((typeof input === "object" && input) || {}) };
    }

    case "csv_processor": {
      const delimiter = (config.delimiter as string) || ",";
      const hasHeader = config.hasHeader !== false; // Default to true

      // Extract CSV string from input
      let csvString = "";
      if (typeof input === "string") {
        csvString = input;
      } else if (typeof input === "object" && input !== null) {
        const inputObj = input as Record<string, unknown>;
        // Try to find CSV string in common fields
        csvString = (inputObj.csv as string) ||
          (inputObj.data as string) ||
          (inputObj.text as string) ||
          (inputObj.content as string) ||
          "";

        // If no CSV field found, try to stringify the whole object
        if (!csvString && Object.keys(inputObj).length === 1) {
          const firstValue = Object.values(inputObj)[0];
          if (typeof firstValue === "string") {
            csvString = firstValue;
          }
        }
      }

      if (!csvString || !csvString.trim()) {
        console.warn("CSV Processor: No CSV string found in input");
        return input; // Return input unchanged if no CSV found
      }

      // Parse CSV
      const lines = csvString.trim().split("\n").filter(line => line.trim());
      if (lines.length === 0) {
        return [];
      }

      let headers: string[] = [];
      const rows: Record<string, string>[] = [];

      lines.forEach((line, index) => {
        const values = line.split(delimiter).map(v => v.trim().replace(/^"|"$/g, ""));

        if (index === 0 && hasHeader) {
          headers = values;
        } else {
          if (hasHeader && headers.length > 0) {
            const row: Record<string, string> = {};
            headers.forEach((header, i) => {
              row[header] = values[i] || "";
            });
            rows.push(row);
          } else {
            // No header row - use column indices
            const row: Record<string, string> = {};
            values.forEach((value, i) => {
              row[`column${i + 1}`] = value;
            });
            rows.push(row);
          }
        }
      });

      console.log(`CSV Processor: Parsed ${rows.length} rows with ${hasHeader ? headers.length : 'no'} headers`);

      // Return parsed data, preserving other input fields if they exist
      if (typeof input === "object" && input !== null) {
        const inputObj = input as Record<string, unknown>;
        return {
          ...inputObj,
          csvData: rows,
          csvRows: rows.length,
          csvHeaders: hasHeader ? headers : []
        };
      }

      return rows;
    }

    case "merge":
    case "merge_data": {
      const mode = getStringProperty(config, 'mode', 'merge');
      const inputObj = extractInputObject(input);

      // Merge: Enhanced merge node with multiple modes
      if (typeof input === "object" && input !== null) {
        const keys = Object.keys(inputObj);

        switch (mode) {
          case "append": {
            // Append mode: Add items to array
            const arrays: unknown[] = [];
            keys.forEach(key => {
              const value = inputObj[key];
              if (Array.isArray(value)) {
                arrays.push(...value);
              } else if (value !== undefined && value !== null) {
                arrays.push(value);
              }
            });
            return arrays;
          }
          
          case "key_based": {
            // Key-based merge: Merge objects using specified key
            const mergeKey = getStringProperty(config, 'mergeKey', 'id');
            const mergedMap = new Map<string, Record<string, unknown>>();
            
            keys.forEach(key => {
              const value = inputObj[key];
              if (Array.isArray(value)) {
                value.forEach((item: unknown) => {
                  if (typeof item === 'object' && item !== null) {
                    const itemObj = item as Record<string, unknown>;
                    const keyValue = String(itemObj[mergeKey] || key);
                    if (!mergedMap.has(keyValue)) {
                      mergedMap.set(keyValue, {});
                    }
                    Object.assign(mergedMap.get(keyValue)!, itemObj);
                  }
                });
              } else if (typeof value === 'object' && value !== null) {
                const valueObj = value as Record<string, unknown>;
                const keyValue = String(valueObj[mergeKey] || key);
                if (!mergedMap.has(keyValue)) {
                  mergedMap.set(keyValue, {});
                }
                Object.assign(mergedMap.get(keyValue)!, valueObj);
              }
            });
            
            return Array.from(mergedMap.values());
          }
          
          case "wait_all": {
            // Wait-all mode: Wait for all inputs, return all
            return inputObj;
          }
          
          case "concat": {
            // Concat mode: Concatenate arrays
            const arrays: unknown[] = [];
            keys.forEach(key => {
              const value = inputObj[key];
              if (Array.isArray(value)) {
                arrays.push(...value);
              } else if (value !== undefined && value !== null) {
                arrays.push(value);
              }
            });
            return arrays;
          }
          
          case "merge":
          default: {
            // Merge mode: Combine all object properties
            const merged: Record<string, unknown> = {};
            keys.forEach(key => {
              const value = inputObj[key];
              if (value !== undefined && value !== null) {
                if (typeof value === "object" && !Array.isArray(value)) {
                  Object.assign(merged, value as Record<string, unknown>);
                } else {
                  merged[key] = value;
                }
              }
            });
            return merged;
          }
        }
      }

      // If input is an array and mode is concat/append, flatten it
      if (Array.isArray(input) && (mode === "concat" || mode === "append")) {
        return input.flat();
      }

      return input;
    }

    case "log_output": {
      const messageStr = getStringProperty(config, 'message', '');
      console.log(`[LOG_OUTPUT] About to call replaceTemplates with input:`, JSON.stringify(input));
      console.log(`[LOG_OUTPUT] Message template:`, messageStr);
      const message = replaceTemplates(messageStr, input);
      const level = (config.level as string) || "info";
      console.log(`[${level.toUpperCase()}] ${message}`);
      return { logged: message, level, input };
    }

    case "database_read": {
      // Database Read: Read from Supabase database
      const table = getStringProperty(config, 'table', '');
      if (!table || table.trim() === '') {
        throw new Error('Database Read: Table name is required');
      }
      
      const supabaseUrl = Deno.env.get("SUPABASE_URL");
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      
      if (!supabaseUrl || !supabaseKey) {
        throw new Error('Database Read: Supabase configuration not available');
      }
      
      const supabaseClient = createClient(supabaseUrl, supabaseKey);
      
      try {
        let queryBuilder = supabaseClient.from(table).select(getStringProperty(config, 'columns', '*'));
        
        // Apply filters
        const filtersStr = getStringProperty(config, 'filters', '{}');
        if (filtersStr && filtersStr.trim() !== '{}') {
          try {
            const filters = parseJSONSafe(filtersStr, 'filters') as Record<string, unknown>;
            for (const [key, value] of Object.entries(filters)) {
              queryBuilder = queryBuilder.eq(key, value);
            }
          } catch {
            // Ignore filter parse errors
          }
        }
        
        // Apply limit
        const limit = getNumberProperty(config, 'limit', 100);
        queryBuilder = queryBuilder.limit(limit);
        
        // Apply order
        const orderBy = getStringProperty(config, 'orderBy', '');
        const ascending = getBooleanProperty(config, 'ascending', true);
        if (orderBy) {
          queryBuilder = queryBuilder.order(orderBy, { ascending });
        }
        
        const { data, error } = await queryBuilder;
        if (error) throw error;
        
        return {
          rows: data || [],
          rowCount: Array.isArray(data) ? data.length : 0,
          ...extractInputObject(input)
        };
      } catch (error) {
        throw new Error(`Database Read: Operation failed. ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    case "database_write": {
      // Database Write: Write to Supabase database
      const table = getStringProperty(config, 'table', '');
      if (!table || table.trim() === '') {
        throw new Error('Database Write: Table name is required');
      }
      
      const operation = getStringProperty(config, 'operation', 'insert');
      const supabaseUrl = Deno.env.get("SUPABASE_URL");
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      
      if (!supabaseUrl || !supabaseKey) {
        throw new Error('Database Write: Supabase configuration not available');
      }
      
      const supabaseClient = createClient(supabaseUrl, supabaseKey);
      const inputObj = extractInputObject(input);
      
      // Extract data to write
      const dataTemplate = getStringProperty(config, 'data', '{}');
      let dataToWrite: Record<string, unknown>;
      
      try {
        if (dataTemplate && dataTemplate.trim() !== '{}') {
          dataToWrite = parseJSONSafe(replaceTemplates(dataTemplate, input), 'data') as Record<string, unknown>;
        } else {
          // Use input data
          dataToWrite = inputObj;
        }
      } catch (error) {
        throw new Error(`Database Write: Invalid data JSON. ${error instanceof Error ? error.message : String(error)}`);
      }
      
      try {
        let result;
        
        switch (operation) {
          case 'insert':
            const { data: insertData, error: insertError } = await supabaseClient
              .from(table)
              .insert(dataToWrite)
              .select();
            if (insertError) throw insertError;
            result = insertData;
            break;
            
          case 'update':
            const matchColumn = getStringProperty(config, 'matchColumn', 'id');
            const matchValue = dataToWrite[matchColumn];
            if (!matchValue) {
              throw new Error(`Database Write: matchColumn "${matchColumn}" value is required for update operation`);
            }
            delete dataToWrite[matchColumn];
            const { data: updateData, error: updateError } = await supabaseClient
              .from(table)
              .update(dataToWrite)
              .eq(matchColumn, matchValue)
              .select();
            if (updateError) throw updateError;
            result = updateData;
            break;
            
          case 'upsert':
            const upsertMatchColumn = getStringProperty(config, 'matchColumn', 'id');
            const { data: upsertData, error: upsertError } = await supabaseClient
              .from(table)
              .upsert(dataToWrite, { onConflict: upsertMatchColumn })
              .select();
            if (upsertError) throw upsertError;
            result = upsertData;
            break;
            
          case 'delete':
            const deleteMatchColumn = getStringProperty(config, 'matchColumn', 'id');
            const deleteValue = dataToWrite[deleteMatchColumn];
            if (!deleteValue) {
              throw new Error(`Database Write: matchColumn "${deleteMatchColumn}" value is required for delete operation`);
            }
            const { data: deleteData, error: deleteError } = await supabaseClient
              .from(table)
              .delete()
              .eq(deleteMatchColumn, deleteValue)
              .select();
            if (deleteError) throw deleteError;
            result = deleteData;
            break;
            
          default:
            throw new Error(`Database Write: Unknown operation "${operation}". Supported: insert, update, upsert, delete`);
        }
        
        return {
          rows: result || [],
          rowCount: Array.isArray(result) ? result.length : 0,
          operation,
          ...inputObj
        };
      } catch (error) {
        throw new Error(`Database Write: ${operation} operation failed. ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    case "postgresql":
    case "supabase": {
      // PostgreSQL/Supabase: Use Supabase client (already available in environment)
      const operation = getStringProperty(config, 'operation', 'select');
      const table = getStringProperty(config, 'table', '');
      const query = getStringProperty(config, 'query', '');
      
      if (!table && !query) {
        throw new Error('PostgreSQL: Either table name or SQL query is required');
      }
      
      const supabaseUrl = Deno.env.get("SUPABASE_URL");
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      
      if (!supabaseUrl || !supabaseKey) {
        throw new Error('PostgreSQL: Supabase configuration not available');
      }
      
      const supabaseClient = createClient(supabaseUrl, supabaseKey);
      const inputObj = extractInputObject(input);
      
      try {
        if (query) {
          // Note: Supabase doesn't allow arbitrary SQL - would need RPC function
          // For now, throw error suggesting use of table operations
          throw new Error('PostgreSQL: Raw SQL queries require a database RPC function. Use table operations instead.');
        } else {
          // Table operations
          let queryBuilder = supabaseClient.from(table).select('*');
          
          // Apply filters
          const filtersStr = getStringProperty(config, 'filters', '{}');
          if (filtersStr && filtersStr.trim() !== '{}') {
            try {
              const filters = parseJSONSafe(filtersStr, 'filters') as Record<string, unknown>;
              for (const [key, value] of Object.entries(filters)) {
                queryBuilder = queryBuilder.eq(key, value);
              }
            } catch {
              // Ignore filter parse errors
            }
          }
          
          // Apply limit
          const limit = getNumberProperty(config, 'limit', 100);
          queryBuilder = queryBuilder.limit(limit);
          
          // Apply order
          const orderBy = getStringProperty(config, 'orderBy', '');
          const ascending = getBooleanProperty(config, 'ascending', true);
          if (orderBy) {
            queryBuilder = queryBuilder.order(orderBy, { ascending });
          }
          
          const { data, error } = await queryBuilder;
          if (error) throw error;
          
          return {
            rows: data || [],
            rowCount: Array.isArray(data) ? data.length : 0,
            ...inputObj
          };
        }
      } catch (error) {
        throw new Error(`PostgreSQL: ${operation} operation failed. ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    case "google_sheets": {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

      const operation = (config.operation as string) || 'read';
      const spreadsheetId = replaceTemplates(config.spreadsheetId as string, input);
      const sheetName = config.sheetName ? replaceTemplates(config.sheetName as string, input) : undefined;
      const range = config.range ? replaceTemplates(config.range as string, input) : undefined;
      const outputFormat = (config.outputFormat as string) || 'json';
      const readDirection = (config.readDirection as string) || 'rows';
      const allowWrite = (config.allowWrite as boolean) || false;

      // Get user ID from workflow context
      const userId = (input as any)?._user_id;
      if (!userId) {
        throw new Error('Google Sheets: User ID not found in workflow context. Please ensure the workflow is executed by an authenticated user.');
      }

      // Check write permissions - REMOVED ADMIN CHECK per user request
      /*
      if ((operation === 'write' || operation === 'append' || operation === 'update') && !allowWrite) {
        // Check if user is admin
        const { data: userRole } = await supabaseClient
          .from('user_roles')
          .select('role')
          .eq('user_id', userId)
          .eq('role', 'admin')
          .single();

        if (!userRole) {
          throw new Error('Write access to Google Sheets requires admin privileges. Please enable "Allow Write Access" in node settings (admin only).');
        }
      }
      */

      // Get Google OAuth access token
      const accessToken = await getGoogleAccessToken(supabaseClient, userId);

      if (!accessToken) {
        throw new Error('Google Sheets: OAuth token not found. Please authenticate with Google first by connecting your Google account in settings.');
      }

      // Prepare data for write operations
      let writeData: unknown[][] | undefined;
      if (operation === 'write' || operation === 'append' || operation === 'update') {
        const dataConfig = config.data;
        if (dataConfig) {
          if (typeof dataConfig === 'string') {
            try {
              writeData = JSON.parse(replaceTemplates(dataConfig, input));
            } catch (parseError) {
              throw new Error(`Google Sheets: Invalid JSON format for write data. Expected 2D array: [["col1", "col2"], ["val1", "val2"]]. Error: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
            }
          } else if (Array.isArray(dataConfig)) {
            writeData = dataConfig as unknown[][];
          } else {
            throw new Error('Google Sheets: Write data must be a 2D array (array of rows). Format: [["col1", "col2"], ["val1", "val2"]]');
          }
        } else {
          // Try to extract from input
          const inputObj = extractInputObject(input);
          const inputData = inputObj.data || inputObj.rows || input;
          if (Array.isArray(inputData)) {
            // Check if it's already a 2D array
            if (inputData.length > 0 && Array.isArray(inputData[0])) {
              writeData = inputData as unknown[][];
            } else {
              // Convert 1D array to 2D (single row)
              writeData = [inputData as unknown[]];
            }
          } else {
            throw new Error('Google Sheets: No data provided for write operation. Add data in node config or pass it in input (as input.data or input.rows).');
          }
        }
      }

      // Split sheet names if comma-separated
      const sheetNames = (sheetName || 'Sheet1').split(',').map(s => s.trim()).filter(s => s);
      const results: Array<Record<string, unknown>> = [];
      let consolidatedSuccess = true;
      let consolidatedError = '';

      // Execute for each sheet
      for (const sheet of sheetNames) {
        // Execute Google Sheets operation
        const result = await executeGoogleSheetsOperation({
          spreadsheetId,
          sheetName: sheet,
          range,
          operation: operation as 'read' | 'write' | 'append' | 'update',
          outputFormat: outputFormat as 'json' | 'keyvalue' | 'text',
          readDirection: readDirection as 'rows' | 'columns',
          data: writeData,
          accessToken,
        });

        if (!result.success) {
          consolidatedSuccess = false;
          consolidatedError = result.error || 'Google Sheets operation failed';
        }

        results.push({
          sheetName: sheet,
          success: result.success,
          data: result.data,
          rows: result.rows,
          columns: result.columns,
          error: result.error
        });
      }

      if (!consolidatedSuccess && sheetNames.length === 1) {
        throw new Error(consolidatedError);
      }

      // Return formatted result (consolidated if multiple sheets)
      if (sheetNames.length === 1) {
        const singleResult = results[0];
        return {
          data: singleResult.data,
          rows: singleResult.rows,
          columns: singleResult.columns,
          operation,
          spreadsheetId,
          sheetName: singleResult.sheetName,
          range: range || 'All',
          formatted: outputFormat,
        };
      } else {
        // Multiple sheets result
        return {
          operation,
          spreadsheetId,
          sheets: results.reduce((acc, res) => ({ ...acc, [res.sheetName]: res.data }), {}),
          results: results, // Detailed results per sheet
          count: sheetNames.length,
          success: consolidatedSuccess,
          range: range || 'All',
        };
      }
    }

    case "google_doc": {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

      const userId = (input as any)?._user_id;
      if (!userId) {
        throw new Error('Google Doc node: User ID not found in workflow context. Please ensure you are authenticated.');
      }

      // Replace templates in config values
      const processedConfig: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(config)) {
        if (typeof value === 'string' && value.trim()) {
          processedConfig[key] = replaceTemplates(value, input);
        } else if (value !== null && value !== undefined) {
          // If value is not a string but might contain templates, convert to string first
          if (typeof value === 'object' && value !== null) {
            // For objects, keep as-is (don't try to replace templates in objects)
            processedConfig[key] = value;
          } else {
            // For other types, convert to string and try template replacement
            const strValue = String(value);
            if (strValue.includes('{{')) {
              processedConfig[key] = replaceTemplates(strValue, input);
            } else {
              processedConfig[key] = value;
            }
          }
        }
      }

      const operation = (processedConfig.operation as string) || 'read';
      
      // Extract document ID from URL if full URL is provided
      if (processedConfig.documentId && typeof processedConfig.documentId === 'string') {
        const docIdStr = processedConfig.documentId.trim();
        // Check if it's a full URL and extract the ID
        const urlMatch = docIdStr.match(/\/d\/([a-zA-Z0-9-_]+)/);
        if (urlMatch && urlMatch[1]) {
          processedConfig.documentId = urlMatch[1];
        } else if (docIdStr.includes('docs.google.com')) {
          // Try alternative URL patterns
          const altMatch = docIdStr.match(/document\/d\/([a-zA-Z0-9-_]+)/);
          if (altMatch && altMatch[1]) {
            processedConfig.documentId = altMatch[1];
          }
        }
      }
      
      // Validate required fields based on operation
      if (operation === 'read') {
        if (!processedConfig.documentId || (typeof processedConfig.documentId === 'string' && !processedConfig.documentId.trim())) {
          throw new Error('Google Doc: Document ID is required for read operation. Get it from the document URL: https://docs.google.com/document/d/DOCUMENT_ID/edit (you can paste the full URL or just the ID). Current value: ' + (processedConfig.documentId || 'empty'));
        }
      }
      if (operation === 'create' && !processedConfig.title) {
        throw new Error('Google Doc: Title is required for create operation');
      }
      if (operation === 'update' && !processedConfig.documentId) {
        throw new Error('Google Doc: Document ID is required for update operation');
      }
      if (operation === 'update' && !processedConfig.content) {
        throw new Error('Google Doc: Content is required for update operation');
      }

      const result = await executeGoogleDocsOperation(supabaseClient, userId, operation, processedConfig);

      if (!result.success) {
        const errorMsg = result.error || 'Google Doc operation failed';
        console.error(`Google Doc operation failed: ${errorMsg}`);
        throw new Error(errorMsg);
      }

      // Ensure we return the data
      const docData = result.data;
      if (!docData) {
        throw new Error('Google Doc operation succeeded but returned no data');
      }

      console.log(`✅ Google Doc operation successful. Operation: ${operation}`);
      console.log(`   Data keys:`, Object.keys(docData));
      
      if (operation === 'read') {
        const readData = docData as Record<string, unknown>;
        const documentId = readData.documentId as string;
        const title = readData.title as string;
        const content = readData.content as string || '';
        const contentLength = typeof readData.contentLength === 'number' ? readData.contentLength : (content ? content.length : 0);
        
        console.log(`   Document ID: ${documentId}`);
        console.log(`   Title: ${title}`);
        console.log(`   Content length: ${contentLength}`);
        console.log(`   Content preview (first 200 chars): ${content.substring(0, 200)}`);
        console.log(`   Has content: ${contentLength > 0}`);
        
        // Return structured output similar to Google Sheets for consistency
        // The 'data' field contains the actual content, making it easy to access
        return {
          operation: 'read',
          documentId: documentId,
          title: title,
          data: content, // Main content field (similar to Google Sheets 'data' field)
          content: content, // Alias for backward compatibility
          body: content, // Alias
          text: content, // Alias
          contentLength: contentLength,
          hasContent: contentLength > 0,
          documentUrl: `https://docs.google.com/document/d/${documentId}/edit`,
        };
      } else {
        // For create/update operations, return the data as-is
        return docData;
      }
    }

    case "google_drive": {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

      const userId = (input as any)?._user_id;
      if (!userId) {
        throw new Error('Google Drive node: User ID not found in workflow context');
      }

      // Replace templates in config values
      const processedConfig: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(config)) {
        if (typeof value === 'string' && value) {
          processedConfig[key] = replaceTemplates(value, input);
        } else if (value !== null && value !== undefined) {
          processedConfig[key] = value;
        }
      }

      const operation = (processedConfig.operation as string) || 'list';
      const result = await executeGoogleDriveOperation(supabaseClient, userId, operation, processedConfig);

      if (!result.success) {
        throw new Error(result.error || 'Google Drive operation failed');
      }

      return result.data;
    }

    case "google_calendar": {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

      const userId = (input as any)?._user_id;
      if (!userId) {
        throw new Error('Google Calendar node: User ID not found in workflow context');
      }

      // Replace templates in config values
      const processedConfig: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(config)) {
        if (typeof value === 'string' && value) {
          processedConfig[key] = replaceTemplates(value, input);
        } else if (value !== null && value !== undefined) {
          processedConfig[key] = value;
        }
      }

      const operation = (processedConfig.operation as string) || 'list';
      const result = await executeGoogleCalendarOperation(supabaseClient, userId, operation, processedConfig);

      if (!result.success) {
        throw new Error(result.error || 'Google Calendar operation failed');
      }

      return result.data;
    }

    case "google_gmail": {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

      const userId = (input as any)?._user_id;
      if (!userId) {
        throw new Error('Google Gmail node: User ID not found in workflow context');
      }

      // Replace templates in config values
      const processedConfig: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(config)) {
        if (typeof value === 'string' && value) {
          processedConfig[key] = replaceTemplates(value, input);
        } else if (value !== null && value !== undefined) {
          processedConfig[key] = value;
        }
      }

      const operation = (processedConfig.operation as string) || 'send';
      const result = await executeGoogleGmailOperation(supabaseClient, userId, operation, processedConfig);

      if (!result.success) {
        throw new Error(result.error || 'Gmail operation failed');
      }

      return result.data;
    }

    case "google_bigquery": {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

      const userId = (input as any)?._user_id;
      if (!userId) {
        throw new Error('Google BigQuery node: User ID not found in workflow context');
      }

      // Replace templates in config values
      const processedConfig: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(config)) {
        if (typeof value === 'string' && value) {
          processedConfig[key] = replaceTemplates(value, input);
        } else if (value !== null && value !== undefined) {
          processedConfig[key] = value;
        }
      }

      const result = await executeGoogleBigQueryOperation(supabaseClient, userId, processedConfig);

      if (!result.success) {
        throw new Error(result.error || 'BigQuery operation failed');
      }

      return result.data;
    }

    case "google_tasks": {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

      const userId = (input as any)?._user_id;
      if (!userId) {
        throw new Error('Google Tasks node: User ID not found in workflow context');
      }

      // Replace templates in config values
      const processedConfig: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(config)) {
        if (typeof value === 'string' && value) {
          processedConfig[key] = replaceTemplates(value, input);
        } else if (value !== null && value !== undefined) {
          processedConfig[key] = value;
        }
      }

      const operation = (processedConfig.operation as string) || 'list';
      const result = await executeGoogleTasksOperation(supabaseClient, userId, operation, processedConfig);

      if (!result.success) {
        throw new Error(result.error || 'Google Tasks operation failed');
      }

      return result.data;
    }

    case "google_contacts": {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

      const userId = (input as any)?._user_id;
      if (!userId) {
        throw new Error('Google Contacts node: User ID not found in workflow context');
      }

      // Replace templates in config values
      const processedConfig: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(config)) {
        if (typeof value === 'string' && value) {
          processedConfig[key] = replaceTemplates(value, input);
        } else if (value !== null && value !== undefined) {
          processedConfig[key] = value;
        }
      }

      const operation = (processedConfig.operation as string) || 'list';
      const result = await executeGoogleContactsOperation(supabaseClient, userId, operation, processedConfig);

      if (!result.success) {
        throw new Error(result.error || 'Google Contacts operation failed');
      }

      return result.data;
    }

    case "memory": {
      // Import memory service
      const { HybridMemoryService } = await import("../_shared/memory.ts");

      const operation = (config.operation as string) || 'store';
      const memoryType = (config.memoryType as string) || 'both';
      const ttl = (config.ttl as number) || 3600;
      const maxMessages = (config.maxMessages as number) || 100;

      // Get session ID from input or generate one
      const sessionId = (input as any)?._session_id ||
        (input as any)?.session_id ||
        `session-${Date.now()}`;

      // Get workflow ID from context (passed from execution)
      const workflowId = (input as any)?._workflow_id || '';

      // Initialize memory service
      const memoryService = new HybridMemoryService(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
        { type: memoryType === 'short' ? 'redis' : memoryType === 'long' ? 'vector' : 'hybrid', ttl, maxMessages }
      );

      await memoryService.initialize();

      // Ensure session exists in database
      if (workflowId) {
        await memoryService.getOrCreateSession(workflowId, sessionId, (input as any)?._user_id);
      }

      if (operation === 'store') {
        // Extract message from input
        let message = '';
        let role: 'user' | 'assistant' | 'system' = 'user';

        if (typeof input === 'string') {
          message = input;
        } else if (typeof input === 'object' && input !== null) {
          const inputObj = input as Record<string, unknown>;
          message = (inputObj.message as string) ||
            (inputObj.content as string) ||
            (inputObj.text as string) ||
            JSON.stringify(input);
          role = (inputObj.role as 'user' | 'assistant' | 'system') || 'user';
        }

        if (!message) {
          throw new Error('Memory node (store): No message content found in input');
        }

        await memoryService.store(sessionId, role, message, (input as any)?.metadata);

        return {
          success: true,
          stored: true,
          sessionId,
          message: 'Message stored in memory',
          role,
          content: message.substring(0, 100) + (message.length > 100 ? '...' : '')
        };
      }
      else if (operation === 'retrieve') {
        const messages = await memoryService.retrieve(sessionId, maxMessages);

        return {
          messages,
          count: messages.length,
          sessionId,
          // Also pass through original input for downstream nodes
          ...(typeof input === 'object' && input !== null ? input : {})
        };
      }
      else if (operation === 'clear') {
        await memoryService.clear(sessionId);
        return {
          success: true,
          cleared: true,
          sessionId,
          message: 'Memory cleared'
        };
      }
      else if (operation === 'search') {
        const query = (input as any)?.query ||
          (input as any)?.search ||
          (typeof input === 'string' ? input : '');

        if (!query) {
          throw new Error('Memory node (search): Search query is required');
        }

        const messages = await memoryService.search(sessionId, query, maxMessages);
        return {
          messages,
          query,
          count: messages.length,
          sessionId
        };
      }

      throw new Error(`Unknown memory operation: ${operation}`);
    }

    // ============================================
    // CORE LOGIC NODES
    // ============================================

    case "noop": {
      // NoOp: Exact input → output passthrough
      return input;
    }

    case "stop_and_error": {
      // Stop And Error: Stops workflow and triggers Error Trigger
      const errorMessage = getStringProperty(config, 'errorMessage', 'Workflow stopped by Stop And Error node');
      const errorCode = getStringProperty(config, 'errorCode', 'STOPPED');
      
      const error = new Error(errorMessage);
      (error as Error & { code?: string }).code = errorCode;
      throw error;
    }

    case "split_in_batches": {
      // Split In Batches: Splits array into batches
      const batchSize = getNumberProperty(config, 'batchSize', 10);
      if (batchSize < 1) {
        throw new Error('Split In Batches: batchSize must be at least 1');
      }

      const inputObj = extractInputObject(input);
      const arrayExpression = getStringProperty(config, 'array', '{{input}}');
      
      // Extract array from input
      let array: unknown[] = [];
      
      // Handle template syntax: strip {{}} if present
      let cleanExpression = arrayExpression.trim();
      if (cleanExpression.startsWith('{{') && cleanExpression.endsWith('}}')) {
        cleanExpression = cleanExpression.slice(2, -2).trim();
      }
      
      if (cleanExpression === 'input' || cleanExpression === 'input.data' || arrayExpression === '{{input}}' || arrayExpression === '{{input.data}}') {
        const data = extractDataFromInput(input);
        if (Array.isArray(data)) {
          array = data;
        } else if (typeof data === 'object' && data !== null && Array.isArray((data as Record<string, unknown>).items)) {
          array = (data as Record<string, unknown>).items as unknown[];
        } else {
          throw new Error('Split In Batches: Input must be an array or contain an array in input.data or input.items');
        }
      } else {
        // Evaluate expression to get array
        // Try direct property access first (e.g., "items" or "input.items")
        let extracted: unknown = undefined;
        
        // If expression is just a property name (e.g., "items"), try direct access
        if (!cleanExpression.includes('.')) {
          extracted = inputObj[cleanExpression];
        } else {
          // Use extractValue for nested paths (e.g., "input.items")
          extracted = extractValue(cleanExpression, input);
        }
        
        // If still not found, try common array property names
        if (!Array.isArray(extracted)) {
          if (Array.isArray(inputObj.items)) {
            extracted = inputObj.items;
          } else if (Array.isArray(inputObj.data)) {
            extracted = inputObj.data;
          } else if (Array.isArray(inputObj.array)) {
            extracted = inputObj.array;
          }
        }
        
        if (!Array.isArray(extracted)) {
          throw new Error(
            `Split In Batches: Expression "${arrayExpression}" must evaluate to an array. ` +
            `Found: ${typeof extracted}. ` +
            `Available properties: ${Object.keys(inputObj).join(', ')}. ` +
            `Please use an expression like "items", "{{items}}", "input.items", or "{{input.items}}" to point to an array.`
          );
        }
        array = extracted;
      }

      // Split into batches
      const batches: unknown[][] = [];
      for (let i = 0; i < array.length; i += batchSize) {
        batches.push(array.slice(i, i + batchSize));
      }

      return {
        batches,
        batchCount: batches.length,
        totalItems: array.length,
        batchSize,
        ...extractInputObject(input)
      };
    }

    // ============================================
    // DATA MANIPULATION NODES
    // ============================================

    case "set": {
      // Set: Set field values (similar to Edit Fields but simpler)
      // Handle both cases: fields as object (from JSON type field) or as JSON string
      let fields: Record<string, unknown>;
      
      console.log(`[SET] Config fields value:`, config.fields, `(type: ${typeof config.fields})`);
      const fieldsValue = config.fields;
      
      // If fields is already an object, use it directly
      if (fieldsValue && typeof fieldsValue === 'object' && !Array.isArray(fieldsValue)) {
        fields = fieldsValue as Record<string, unknown>;
        console.log(`[SET] Fields is already an object:`, JSON.stringify(fields, null, 2));
      } else {
        // Otherwise, try to parse it as a JSON string
        const fieldsStr = typeof fieldsValue === 'string' ? fieldsValue : getStringProperty(config, 'fields', '{}');
        console.log(`[SET] Parsing fields string:`, fieldsStr);
        
        // Check if the string is "[object Object]" which indicates a serialization error
        if (fieldsStr === '[object Object]' || fieldsStr.trim() === '[object Object]') {
          throw new Error(
            `Set: Fields configuration contains "[object Object]" which indicates a serialization error. ` +
            `Please ensure your fields JSON is properly formatted. Example: {"url": "https://example.com", "method": "POST"}. ` +
            `If you're using object values, make sure they are properly JSON stringified.`
          );
        }
        
        try {
          fields = parseJSONSafe(fieldsStr, 'fields') as Record<string, unknown>;
          console.log(`[SET] Parsed fields:`, JSON.stringify(fields, null, 2));
        } catch (error) {
          throw new Error(
            `Set: Invalid fields JSON. ${error instanceof Error ? error.message : String(error)}. ` +
            `Please provide a valid JSON object. Example: {"url": "https://example.com", "method": "POST"}`
          );
        }
      }
      
      if (!fields || typeof fields !== 'object' || Array.isArray(fields)) {
        throw new Error('Set: Fields must be a JSON object');
      }

      const inputObj = extractInputObject(input);
      // Start with a fresh object, don't spread inputObj to avoid carrying over unwanted properties
      const output: Record<string, unknown> = {};

      // Set each field value (supporting template expressions)
      for (const [key, valueTemplate] of Object.entries(fields)) {
        let resolvedValue: unknown;
        
        // Check if valueTemplate is the string "[object Object]" which indicates a serialization error
        if (typeof valueTemplate === 'string' && (valueTemplate === '[object Object]' || valueTemplate.trim() === '[object Object]')) {
          throw new Error(
            `Set: Field "${key}" has value "[object Object]" which indicates a serialization error. ` +
            `This usually happens when an object value was incorrectly converted to a string. ` +
            `Please ensure object values in your fields JSON are properly formatted. ` +
            `Example: {"${key}": {"nested": "value"}} instead of {"${key}": "[object Object]"}`
          );
        }
        
        // Preserve objects and arrays as-is (don't convert to string)
        if (valueTemplate !== null && typeof valueTemplate === 'object') {
          // For objects and arrays, preserve them directly
          // If they contain template expressions as string values, we could process them recursively
          // For now, preserve the structure as-is
          resolvedValue = valueTemplate;
          console.log(`[SET] Preserving object/array for field "${key}":`, JSON.stringify(resolvedValue));
        } else if (typeof valueTemplate === 'string') {
          // For strings, apply template replacement
          const resolvedValueStr = replaceTemplates(valueTemplate, input);
          
          // Try to parse as number if it looks like a number and no template was used
          if (!valueTemplate.includes('{{')) {
            const parsed = parseFloat(resolvedValueStr);
            if (!isNaN(parsed) && String(parsed) === resolvedValueStr.trim()) {
              resolvedValue = parsed;
            } else {
              resolvedValue = resolvedValueStr;
            }
          } else {
            resolvedValue = resolvedValueStr;
          }
        } else if (typeof valueTemplate === 'number') {
          // Preserve numbers as-is
          resolvedValue = valueTemplate;
        } else if (typeof valueTemplate === 'boolean') {
          // Preserve booleans as-is
          resolvedValue = valueTemplate;
        } else {
          // For other types (null, undefined, etc.), preserve as-is
          resolvedValue = valueTemplate;
        }
        
        output[key] = resolvedValue;
        console.log(`[SET] Setting field "${key}" =`, resolvedValue, `(type: ${typeof resolvedValue})`);
      }

      // Merge with input object properties (except fields) to preserve workflow metadata
      for (const [key, value] of Object.entries(inputObj)) {
        if (key !== 'fields' && !(key in output)) {
          output[key] = value;
        }
      }

      console.log(`[SET] Final output keys:`, Object.keys(output));
      console.log(`[SET] Final output:`, JSON.stringify(output, null, 2));
      return output;
    }

    case "edit_fields": {
      // Edit Fields: Advanced field editing with operations
      // Handle both cases: operations as array (from JSON type field) or as JSON string
      let operations: Array<{ operation: string; field: string; value?: string }>;
      
      const operationsValue = config.operations;
      
      // If operations is already an array, use it directly
      if (Array.isArray(operationsValue)) {
        operations = operationsValue as Array<{ operation: string; field: string; value?: string }>;
      } else {
        // Otherwise, try to parse it as a JSON string
        const operationsStr = typeof operationsValue === 'string' ? operationsValue : getStringProperty(config, 'operations', '[]');
        try {
          operations = parseJSONSafe(operationsStr, 'operations') as Array<{ operation: string; field: string; value?: string }>;
        } catch (error) {
          throw new Error(`Edit Fields: Invalid operations JSON. ${error instanceof Error ? error.message : String(error)}`);
        }
      }
      
      if (!Array.isArray(operations)) {
        throw new Error('Edit Fields: Operations must be a JSON array');
      }

      const inputObj = extractInputObject(input);
      const output: Record<string, unknown> = { ...inputObj };

      for (const op of operations) {
        const { operation, field, value } = op;
        
        switch (operation) {
          case 'set':
            if (value !== undefined) {
              // Convert value to string for replaceTemplates
              const valueStr = typeof value === 'string' ? value : String(value);
              output[field] = replaceTemplates(valueStr, input);
            }
            break;
          case 'delete':
            delete output[field];
            break;
          case 'rename':
            if (value && output[field] !== undefined) {
              const newKey = typeof value === 'string' ? value : String(value);
              output[newKey] = output[field];
              delete output[field];
            }
            break;
          default:
            console.warn(`Edit Fields: Unknown operation "${operation}"`);
        }
      }

      return output;
    }

    case "rename_keys": {
      // Rename Keys: Rename object keys
      // Handle both cases: mappings as object (from JSON type field) or as JSON string
      let mappings: Record<string, string>;
      
      const mappingsValue = config.mappings;
      
      // If mappings is already an object, use it directly
      if (mappingsValue && typeof mappingsValue === 'object' && !Array.isArray(mappingsValue)) {
        mappings = mappingsValue as Record<string, string>;
      } else {
        // Otherwise, try to parse it as a JSON string
        const mappingsStr = typeof mappingsValue === 'string' ? mappingsValue : getStringProperty(config, 'mappings', '{}');
        try {
          mappings = parseJSONSafe(mappingsStr, 'mappings') as Record<string, string>;
        } catch (error) {
          throw new Error(`Rename Keys: Invalid mappings JSON. ${error instanceof Error ? error.message : String(error)}`);
        }
      }
      
      if (!mappings || typeof mappings !== 'object' || Array.isArray(mappings)) {
        throw new Error('Rename Keys: Mappings must be a JSON object');
      }

      const inputObj = extractInputObject(input);
      const output: Record<string, unknown> = {};

      // Copy all fields
      for (const [key, value] of Object.entries(inputObj)) {
        const newKey = mappings[key] || key;
        output[newKey] = value;
      }

      return output;
    }

    case "aggregate": {
      // Aggregate: Aggregate operations on arrays
      const operation = getStringProperty(config, 'operation', 'sum');
      const field = getStringProperty(config, 'field', '');
      const groupBy = getStringProperty(config, 'groupBy', '');

      // Check if input is directly an array first
      let data: unknown[];
      let inputObj: Record<string, unknown>;
      
      if (Array.isArray(input)) {
        data = input;
        inputObj = {};
      } else {
        inputObj = extractInputObject(input);
        const extractedData = extractDataFromInput(input);
        
        if (!Array.isArray(extractedData)) {
          throw new Error('Aggregate: Input must be an array or contain an array');
        }
        data = extractedData;
      }

      if (groupBy) {
        // Group by operation
        const groups: Record<string, unknown[]> = {};
        
        for (const item of data) {
          if (typeof item === 'object' && item !== null) {
            const itemObj = item as Record<string, unknown>;
            const groupKey = String(itemObj[groupBy] || 'null');
            if (!groups[groupKey]) {
              groups[groupKey] = [];
            }
            groups[groupKey].push(item);
          }
        }

        const results: Record<string, unknown> = {};
        for (const [groupKey, groupItems] of Object.entries(groups)) {
          results[groupKey] = performAggregateOperation(operation, groupItems, field);
        }

        return {
          groups: results,
          groupCount: Object.keys(results).length,
          ...inputObj
        };
      } else {
        // Simple aggregate
        const result = performAggregateOperation(operation, data, field);
        return {
          result,
          operation,
          count: data.length,
          ...inputObj
        };
      }
    }

    case "limit": {
      // Limit: Limit array size
      const limit = getNumberProperty(config, 'limit', 10);
      if (limit < 0) {
        throw new Error('Limit: limit must be non-negative');
      }

      // Check if input is directly an array first
      if (Array.isArray(input)) {
        return input.slice(0, limit);
      }

      const inputObj = extractInputObject(input);
      const data = extractDataFromInput(input);
      
      if (!Array.isArray(data)) {
        throw new Error('Limit: Input must be an array or contain an array');
      }

      const limited = data.slice(0, limit);
      
      // If input was an object with array property, return array directly for chaining
      // Otherwise return wrapped format
      if (Array.isArray(inputObj.items) || Array.isArray(inputObj.data) || Array.isArray(inputObj.array)) {
        return limited;
      }

      return {
        items: limited,
        originalCount: data.length,
        limitedCount: Math.min(limit, data.length),
        ...inputObj
      };
    }

    case "sort": {
      // Sort: Sort array
      const field = getStringProperty(config, 'field', '');
      const direction = getStringProperty(config, 'direction', 'asc');
      const type = getStringProperty(config, 'type', 'auto'); // auto, string, number, date

      // Check if input is directly an array first (including empty arrays)
      if (Array.isArray(input)) {
        // Empty array - just return it
        if (input.length === 0) {
          return [];
        }
        
        const sorted = [...input].sort((a, b) => {
          let aVal: unknown = a;
          let bVal: unknown = b;

          if (field) {
            if (typeof a === 'object' && a !== null) {
              aVal = (a as Record<string, unknown>)[field];
            }
            if (typeof b === 'object' && b !== null) {
              bVal = (b as Record<string, unknown>)[field];
            }
          }

          return compareValues(aVal, bVal, type, direction);
        });
        // Return array directly for chaining with other array nodes
        return sorted;
      }

      // Try to extract array from input object
      const inputObj = extractInputObject(input);
      const data = extractDataFromInput(input);
      
      // Check if we got an array (including empty arrays)
      if (!Array.isArray(data)) {
        // Last attempt: check if input itself might be an array that got wrapped
        if (input && typeof input === 'object' && !Array.isArray(input)) {
          const inputRecord = input as Record<string, unknown>;
          // Check common array property names
          for (const key of ['items', 'data', 'array', 'result', 'output']) {
            if (Array.isArray(inputRecord[key])) {
              const arr = inputRecord[key] as unknown[];
              if (arr.length === 0) return [];
              const sorted = [...arr].sort((a, b) => {
                let aVal: unknown = a;
                let bVal: unknown = b;
                if (field) {
                  if (typeof a === 'object' && a !== null) {
                    aVal = (a as Record<string, unknown>)[field];
                  }
                  if (typeof b === 'object' && b !== null) {
                    bVal = (b as Record<string, unknown>)[field];
                  }
                }
                return compareValues(aVal, bVal, type, direction);
              });
              return sorted;
            }
          }
        }
        throw new Error('Sort: Input must be an array or contain an array');
      }

      // Empty array - just return it
      if (data.length === 0) {
        return [];
      }

      const sorted = [...data].sort((a, b) => {
        let aVal: unknown = a;
        let bVal: unknown = b;

        if (field) {
          if (typeof a === 'object' && a !== null) {
            aVal = (a as Record<string, unknown>)[field];
          }
          if (typeof b === 'object' && b !== null) {
            bVal = (b as Record<string, unknown>)[field];
          }
        }

        return compareValues(aVal, bVal, type, direction);
      });

      // If input was an object with array property, return array directly for chaining
      // Otherwise return wrapped format
      if (Array.isArray(inputObj.items) || Array.isArray(inputObj.data) || Array.isArray(inputObj.array)) {
        return sorted;
      }
      
      return {
        items: sorted,
        count: sorted.length,
        ...inputObj
      };
    }

    case "item_lists": {
      // Item Lists: Convert object to list of items
      const inputObj = extractInputObject(input);
      
      if (Array.isArray(inputObj)) {
        // Already an array, return as-is
        return inputObj;
      }

      // Convert object to array of key-value pairs
      const items: Array<{ key: string; value: unknown }> = [];
      for (const [key, value] of Object.entries(inputObj)) {
        items.push({ key, value });
      }

      return {
        items,
        count: items.length,
        ...inputObj
      };
    }

    case "llm_chain": {
      // LLM Chain: Chain multiple AI prompts together
      const stepsStr = getStringProperty(config, 'steps', '[]');
      const apiKey = getStringProperty(config, 'apiKey', '') || lovableApiKey;
      const model = getStringProperty(config, 'model', 'gpt-4o');
      
      if (!apiKey) {
        throw new Error('LLM Chain: API Key is required. Please provide an API key in the node configuration.');
      }
      
      let steps: Array<{ prompt: string; model?: string }>;
      try {
        steps = parseJSONSafe(stepsStr, 'steps') as Array<{ prompt: string; model?: string }>;
        if (!Array.isArray(steps) || steps.length === 0) {
          throw new Error('Steps must be a non-empty array');
        }
      } catch (error) {
        throw new Error(`LLM Chain: Invalid steps JSON. ${error instanceof Error ? error.message : String(error)}`);
      }
      
      const inputObj = extractInputObject(input);
      const llmAdapter = new LLMAdapter();
      
      let currentInput: string = typeof input === 'string' ? input : JSON.stringify(input);
      const stepOutputs: unknown[] = [];
      
      for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        const stepPrompt = replaceTemplates(step.prompt, { input: currentInput, previous: stepOutputs[stepOutputs.length - 1] || currentInput });
        const stepModel = step.model || model;
        
        try {
          const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
            { role: 'system', content: stepPrompt },
            { role: 'user', content: currentInput }
          ];
          
          const provider = LLMAdapter.detectProvider(stepModel);
          const response = await llmAdapter.chat(provider, messages, {
            model: stepModel,
            temperature: 0.7,
            apiKey
          });
          
          const stepResult = response.content || JSON.stringify(response);
          stepOutputs.push(stepResult);
          currentInput = typeof stepResult === 'string' ? stepResult : JSON.stringify(stepResult);
        } catch (error) {
          throw new Error(`LLM Chain: Step ${i + 1} failed. ${error instanceof Error ? error.message : String(error)}`);
        }
      }
      
      return {
        finalResponse: currentInput,
        stepOutputs,
        stepCount: steps.length,
        ...inputObj
      };
    }

    // ============================================
    // UTILITY NODES
    // ============================================

    case "date_time": {
      // Date & Time: Manipulate dates and times
      const operation = getStringProperty(config, 'operation', 'format');
      const inputObj = extractInputObject(input);
      
      try {
        let result: unknown;
        
        switch (operation) {
          case 'format': {
            const dateTemplate = getStringProperty(config, 'date', '');
            const format = getStringProperty(config, 'format', 'ISO');
            // Resolve template expressions in date field (e.g., {{result}}, {{input.result}})
            const resolvedDateStr = dateTemplate ? replaceTemplates(dateTemplate, input) : '';
            const date = resolvedDateStr ? new Date(resolvedDateStr) : new Date();
            
            if (isNaN(date.getTime())) {
              throw new Error(`Invalid date value: ${resolvedDateStr}`);
            }
            
            if (format === 'ISO') {
              result = date.toISOString();
            } else if (format === 'timestamp') {
              result = date.getTime();
            } else if (format === 'custom') {
              const customFormat = getStringProperty(config, 'customFormat', 'YYYY-MM-DD HH:mm:ss');
              result = customFormat
                .replace('YYYY', date.getFullYear().toString())
                .replace('MM', String(date.getMonth() + 1).padStart(2, '0'))
                .replace('DD', String(date.getDate()).padStart(2, '0'))
                .replace('HH', String(date.getHours()).padStart(2, '0'))
                .replace('mm', String(date.getMinutes()).padStart(2, '0'))
                .replace('ss', String(date.getSeconds()).padStart(2, '0'));
            } else {
              result = date.toISOString();
            }
            break;
          }
          case 'add': {
            const addValue = getNumberProperty(config, 'value', 0);
            const addUnit = getStringProperty(config, 'unit', 'days');
            const dateTemplate = getStringProperty(config, 'date', '');
            // Resolve template expressions in date field (e.g., {{result}}, {{input.result}})
            const resolvedDateStr = dateTemplate ? replaceTemplates(dateTemplate, input) : '';
            const addDate = resolvedDateStr ? new Date(resolvedDateStr) : new Date();
            
            if (isNaN(addDate.getTime())) {
              throw new Error(`Invalid date value: ${resolvedDateStr || '(empty)'}`);
            }
            
            switch (addUnit) {
              case 'seconds': addDate.setSeconds(addDate.getSeconds() + addValue); break;
              case 'minutes': addDate.setMinutes(addDate.getMinutes() + addValue); break;
              case 'hours': addDate.setHours(addDate.getHours() + addValue); break;
              case 'days': addDate.setDate(addDate.getDate() + addValue); break;
              case 'weeks': addDate.setDate(addDate.getDate() + addValue * 7); break;
              case 'months': addDate.setMonth(addDate.getMonth() + addValue); break;
              case 'years': addDate.setFullYear(addDate.getFullYear() + addValue); break;
            }
            result = addDate.toISOString();
            break;
          }
          case 'subtract': {
            const subValue = getNumberProperty(config, 'value', 0);
            const subUnit = getStringProperty(config, 'unit', 'days');
            const dateTemplate = getStringProperty(config, 'date', '');
            // Resolve template expressions in date field (e.g., {{result}}, {{input.result}})
            const resolvedDateStr = dateTemplate ? replaceTemplates(dateTemplate, input) : '';
            const subDate = resolvedDateStr ? new Date(resolvedDateStr) : new Date();
            
            if (isNaN(subDate.getTime())) {
              throw new Error(`Invalid date value: ${resolvedDateStr || '(empty)'}`);
            }
            
            switch (subUnit) {
              case 'seconds': subDate.setSeconds(subDate.getSeconds() - subValue); break;
              case 'minutes': subDate.setMinutes(subDate.getMinutes() - subValue); break;
              case 'hours': subDate.setHours(subDate.getHours() - subValue); break;
              case 'days': subDate.setDate(subDate.getDate() - subValue); break;
              case 'weeks': subDate.setDate(subDate.getDate() - subValue * 7); break;
              case 'months': subDate.setMonth(subDate.getMonth() - subValue); break;
              case 'years': subDate.setFullYear(subDate.getFullYear() - subValue); break;
            }
            result = subDate.toISOString();
            break;
          }
          case 'diff': {
            // For diff operation, use input as date1 and config.date as date2, or both from input
            const inputObj = extractInputObject(input);
            let date1: Date;
            let date2: Date;
            
            // Try to get dates from input first
            const inputDate1 = inputObj.date1 || inputObj.startDate || inputObj.from;
            const inputDate2 = inputObj.date2 || inputObj.endDate || inputObj.to || inputObj.date;
            
            if (inputDate1 && inputDate2) {
              date1 = new Date(String(inputDate1));
              date2 = new Date(String(inputDate2));
            } else {
              // Fallback to config or current date
              const configDate = getStringProperty(config, 'date', '');
              date1 = configDate ? new Date(configDate) : new Date();
              date2 = new Date(); // Current date as default
            }
            
            const diffUnit = getStringProperty(config, 'unit', 'milliseconds');
            const diff = date2.getTime() - date1.getTime();
            
            switch (diffUnit) {
              case 'milliseconds': result = diff; break;
              case 'seconds': result = Math.floor(diff / 1000); break;
              case 'minutes': result = Math.floor(diff / 60000); break;
              case 'hours': result = Math.floor(diff / 3600000); break;
              case 'days': result = Math.floor(diff / 86400000); break;
              default: result = diff;
            }
            break;
          }
          case 'now':
            result = new Date().toISOString();
            break;
          default:
            throw new Error(`Date & Time: Unknown operation "${operation}"`);
        }
        
        return {
          result,
          operation,
          ...inputObj
        };
      } catch (error) {
        throw new Error(`Date & Time: Operation failed. ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    case "math": {
      // Math: Mathematical operations
      const operation = getStringProperty(config, 'operation', 'add');
      const inputObj = extractInputObject(input);
      
      console.log(`[MATH] Operation: ${operation}, value1Template: ${getStringProperty(config, 'value1', '0')}, value2Template: ${getStringProperty(config, 'value2', '0')}`);
      
      try {
        let result: number;
        
        // Get value templates from config (can be numbers or template expressions like {{value1}})
        const value1Template = getStringProperty(config, 'value1', '0');
        const value2Template = getStringProperty(config, 'value2', '0');
        
        // Helper function to extract numeric value from input
        const getNumericValue = (template: string, input: unknown): number => {
          console.log(`[MATH] Getting numeric value for template: "${template}"`);
          
          // First try to resolve template
          const resolvedStr = replaceTemplates(template, input);
          console.log(`[MATH] Template "${template}" resolved to: "${resolvedStr}"`);
          
          // Try to parse as number
          const parsed = parseFloat(resolvedStr);
          if (!isNaN(parsed)) {
            console.log(`[MATH] Parsed as number: ${parsed}`);
            return parsed;
          }
          
          // If template resolution didn't work, try direct access
          // Check if input has the property directly
          if (input && typeof input === 'object' && input !== null) {
            const inputRecord = input as Record<string, unknown>;
            // Try to find the value in input (e.g., value1, value2, result)
            const key = template.replace(/[{}]/g, '').replace(/^input\./, '');
            console.log(`[MATH] Trying direct access with key: "${key}"`);
            if (key in inputRecord) {
              const value = inputRecord[key];
              console.log(`[MATH] Found value in input:`, value, `(type: ${typeof value})`);
              if (typeof value === 'number') {
                return value;
              }
              const numValue = parseFloat(String(value));
              if (!isNaN(numValue)) {
                return numValue;
              }
            }
            
            // Also check if there's a 'fields' JSON string that needs parsing
            if (inputRecord.fields && typeof inputRecord.fields === 'string') {
              try {
                const fieldsObj = JSON.parse(inputRecord.fields) as Record<string, unknown>;
                if (key in fieldsObj) {
                  const value = fieldsObj[key];
                  if (typeof value === 'number') {
                    return value;
                  }
                  const numValue = parseFloat(String(value));
                  if (!isNaN(numValue)) {
                    return numValue;
                  }
                }
              } catch {
                // Ignore JSON parse errors
              }
            }
          }
          
          console.log(`[MATH] Could not resolve template "${template}", defaulting to 0`);
          return 0;
        };
        
        const num1 = getNumericValue(value1Template, input);
        const num2 = getNumericValue(value2Template, input);
        console.log(`[MATH] num1: ${num1}, num2: ${num2}`);
        
        switch (operation) {
          case 'add': result = num1 + num2; break;
          case 'subtract': result = num1 - num2; break;
          case 'multiply': result = num1 * num2; break;
          case 'divide':
            if (num2 === 0) throw new Error('Math: Division by zero');
            result = num1 / num2;
            break;
          case 'modulo':
            if (num2 === 0) throw new Error('Math: Modulo by zero');
            result = num1 % num2;
            break;
          case 'power': result = Math.pow(num1, num2); break;
          case 'sqrt':
            if (num1 < 0) throw new Error('Math: Square root of negative number');
            result = Math.sqrt(num1);
            break;
          case 'abs': result = Math.abs(num1); break;
          case 'round': result = Math.round(num1); break;
          case 'floor': result = Math.floor(num1); break;
          case 'ceil': result = Math.ceil(num1); break;
          case 'min': result = Math.min(num1, num2); break;
          case 'max': result = Math.max(num1, num2); break;
          default:
            throw new Error(`Math: Unknown operation "${operation}"`);
        }
        
        console.log(`[MATH] Calculated result: ${result} for operation: ${operation}`);
        
        // Create output object - spread inputObj first, then override with new values
        // This ensures operation and result from THIS node are used, not previous node's
        const output: Record<string, unknown> = {
          ...inputObj,
        };
        
        // Override with this node's operation and result (must come AFTER spread)
        output.result = result;
        output.operation = operation;
        output.input1 = num1;
        output.input2 = num2;
        
        console.log(`[MATH] Returning output with result: ${output.result}, operation: ${output.operation}`);
        return output;
      } catch (error) {
        throw new Error(`Math: Operation failed. ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    case "crypto": {
      // Crypto: Cryptographic operations
      const operation = getStringProperty(config, 'operation', 'hash');
      const inputObj = extractInputObject(input);
      const data = getStringProperty(inputObj, 'data', '') || getStringProperty(inputObj, 'text', '') || String(input);
      
      try {
        let result: string;
        
        switch (operation) {
          case 'hash': {
            const algorithm = getStringProperty(config, 'algorithm', 'sha256');
            const encoder = new TextEncoder();
            const dataBuffer = encoder.encode(data);
            const hashBuffer = await crypto.subtle.digest(algorithm.toUpperCase() as AlgorithmIdentifier, dataBuffer);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            result = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
            break;
          }
          case 'encode_base64':
            result = btoa(data);
            break;
          case 'decode_base64':
            result = atob(data);
            break;
          case 'uuid':
            result = crypto.randomUUID();
            break;
          case 'random_string': {
            const length = getNumberProperty(config, 'length', 16);
            const charset = getStringProperty(config, 'charset', 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789');
            let randomString = '';
            const randomValues = new Uint8Array(length);
            crypto.getRandomValues(randomValues);
            for (let i = 0; i < length; i++) {
              randomString += charset[randomValues[i] % charset.length];
            }
            result = randomString;
            break;
          }
          default:
            throw new Error(`Crypto: Unknown operation "${operation}"`);
        }
        
        return {
          result,
          operation,
          ...inputObj
        };
      } catch (error) {
          throw new Error(`Crypto: Operation failed. ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    // ============================================
    // ADDITIONAL COMMUNICATION NODES
    // ============================================

    case "microsoft_teams": {
      // Microsoft Teams: Send message to Teams channel
      const webhookUrl = getStringProperty(config, 'webhookUrl', '');
      if (!webhookUrl || webhookUrl.trim() === '') {
        throw new Error('Microsoft Teams: Webhook URL is required. Get it from Teams channel Connectors.');
      }
      
      const message = replaceTemplates(getStringProperty(config, 'message', ''), input);
      const title = replaceTemplates(getStringProperty(config, 'title', 'Workflow Notification'), input);
      
      try {
        const response = await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            '@type': 'MessageCard',
            '@context': 'https://schema.org/extensions',
            summary: title,
            themeColor: '0078D4',
            title,
            text: message
          })
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Microsoft Teams: Request failed with status ${response.status}: ${errorText}`);
        }
        
        const inputObj = extractInputObject(input);
        return {
          success: true,
          message: 'Message sent to Microsoft Teams',
          ...inputObj
        };
      } catch (error) {
        throw new Error(`Microsoft Teams: Failed to send message. ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    case "telegram": {
      // Telegram: Send message via Telegram Bot API
      const botToken = getStringProperty(config, 'botToken', '');
      const chatId = getStringProperty(config, 'chatId', '');
      const message = replaceTemplates(getStringProperty(config, 'message', ''), input);
      
      if (!botToken || !chatId) {
        throw new Error('Telegram: Bot Token and Chat ID are required');
      }
      
      try {
        const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: message,
            parse_mode: 'HTML'
          })
        });
        
        const data = await response.json();
        if (!data.ok) {
          throw new Error(`Telegram API error: ${data.description || 'Unknown error'}`);
        }
        
        const inputObj = extractInputObject(input);
        return {
          success: true,
          messageId: data.result.message_id,
          ...inputObj
        };
      } catch (error) {
        throw new Error(`Telegram: Failed to send message. ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    case "whatsapp_cloud": {
      // WhatsApp Cloud API: Send message via WhatsApp Business API
      const phoneNumberId = getStringProperty(config, 'phoneNumberId', '');
      const accessToken = getStringProperty(config, 'accessToken', '');
      const to = getStringProperty(config, 'to', '');
      const message = replaceTemplates(getStringProperty(config, 'message', ''), input);
      
      if (!phoneNumberId || !accessToken || !to) {
        throw new Error('WhatsApp Cloud: Phone Number ID, Access Token, and recipient number are required');
      }
      
      try {
        const response = await fetch(`https://graph.facebook.com/v18.0/${phoneNumberId}/messages`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            to,
            type: 'text',
            text: { body: message }
          })
        });
        
        const data = await response.json();
        if (data.error) {
          throw new Error(`WhatsApp API error: ${data.error.message || 'Unknown error'}`);
        }
        
        const inputObj = extractInputObject(input);
        return {
          success: true,
          messageId: data.messages?.[0]?.id,
          ...inputObj
        };
      } catch (error) {
        throw new Error(`WhatsApp Cloud: Failed to send message. ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    case "twilio": {
      // Twilio: Send SMS via Twilio
      const accountSid = getStringProperty(config, 'accountSid', '');
      const authToken = getStringProperty(config, 'authToken', '');
      const from = getStringProperty(config, 'from', '');
      const to = getStringProperty(config, 'to', '');
      const message = replaceTemplates(getStringProperty(config, 'message', ''), input);
      
      if (!accountSid || !authToken || !from || !to) {
        throw new Error('Twilio: Account SID, Auth Token, From, and To are required');
      }
      
      try {
        const auth = btoa(`${accountSid}:${authToken}`);
        const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: new URLSearchParams({
            From: from,
            To: to,
            Body: message
          }).toString()
        });
        
        const data = await response.json();
        if (data.error_code) {
          throw new Error(`Twilio API error: ${data.message || 'Unknown error'}`);
        }
        
        const inputObj = extractInputObject(input);
        return {
          success: true,
          messageSid: data.sid,
          status: data.status,
          ...inputObj
        };
      } catch (error) {
        throw new Error(`Twilio: Failed to send SMS. ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    // ============================================
    // FILE OPERATIONS
    // ============================================

    case "read_binary_file": {
      // Read Binary File: Read file from path
      const filePathTemplate = getStringProperty(config, 'filePath', '');
      const maxSize = getNumberProperty(config, 'maxSize', 10 * 1024 * 1024); // 10MB default
      
      if (!filePathTemplate || filePathTemplate.trim() === '') {
        throw new Error('Read Binary File: File path is required');
      }
      
      // Evaluate template variables in file path (e.g., {{path}} from previous node)
      const filePath = replaceTemplates(filePathTemplate, input);
      
      console.log(`[READ_BINARY_FILE] Original path template: "${filePathTemplate}"`);
      console.log(`[READ_BINARY_FILE] Resolved path: "${filePath}"`);
      
      // Sanitize path (prevent directory traversal)
      // Keep absolute paths intact, especially /tmp/ paths
      let sanitizedPath = filePath.replace(/\.\./g, '');
      
      // If path doesn't start with /tmp/ or /, normalize it
      // Match the same logic as Write Binary File
      if (!sanitizedPath.startsWith('/tmp/') && !sanitizedPath.startsWith('tmp/') && !sanitizedPath.startsWith('/')) {
        // If it's a relative path without tmp/, try to find it in /tmp/
        const filename = sanitizedPath.split('/').pop() || sanitizedPath || 'file.txt';
        sanitizedPath = `/tmp/${filename}`;
      } else if (sanitizedPath.startsWith('tmp/')) {
        // Convert relative tmp/ to absolute /tmp/
        sanitizedPath = '/' + sanitizedPath;
      }
      // If it already starts with /tmp/ or another absolute path, keep it as is
      
      console.log(`[READ_BINARY_FILE] Final sanitized path: "${sanitizedPath}"`);
      
      try {
        // Check if file exists first
        let fileData: Uint8Array | null = null;
        try {
          const stat = await Deno.stat(sanitizedPath);
          console.log(`[READ_BINARY_FILE] File exists: ${stat.isFile}, size: ${stat.size}`);
          
          fileData = await Deno.readFile(sanitizedPath);
        } catch (statError) {
          console.error(`[READ_BINARY_FILE] File stat/read failed:`, statError);
          
          // Fallback: Check if previous node (Write Binary File) passed the content
          const inputObj = input as Record<string, unknown>;
          
          // Check if we have content from Write Binary File output
          const hasContent = inputObj.content && typeof inputObj.content === 'string';
          const inputPath = inputObj.path ? String(inputObj.path).trim() : '';
          const pathMatches = inputPath && (
            inputPath === sanitizedPath || 
            inputPath === filePath ||
            sanitizedPath.includes(inputPath) ||
            inputPath.includes(sanitizedPath)
          );
          
          console.log(`[READ_BINARY_FILE] Fallback check: hasContent=${hasContent}, inputPath="${inputPath}", sanitizedPath="${sanitizedPath}", pathMatches=${pathMatches}`);
          
          // If the previous node was Write Binary File and we have the content in input
          if (hasContent && (pathMatches || !inputPath)) {
            console.log(`[READ_BINARY_FILE] File not found on filesystem, but content available from Write Binary File output`);
            console.log(`[READ_BINARY_FILE] Using content from previous node output`);
            
            // Decode the base64 content from Write Binary File output
            try {
              const binaryString = atob(inputObj.content as string);
              fileData = new Uint8Array(binaryString.length);
              for (let i = 0; i < binaryString.length; i++) {
                fileData[i] = binaryString.charCodeAt(i);
              }
              console.log(`[READ_BINARY_FILE] Successfully decoded content from output (size: ${fileData.length} bytes)`);
            } catch (decodeError) {
              console.error(`[READ_BINARY_FILE] Failed to decode content from output:`, decodeError);
              throw new Error(`Read Binary File: File not found and could not use content from previous node. ${statError instanceof Error ? statError.message : String(statError)}`);
            }
          } else {
            // Retry once after a small delay (in case of sync issues)
            console.log(`[READ_BINARY_FILE] No content fallback available, attempting to read from filesystem with retry...`);
            await new Promise(resolve => setTimeout(resolve, 100));
            try {
              fileData = await Deno.readFile(sanitizedPath);
              console.log(`[READ_BINARY_FILE] Successfully read file on retry`);
            } catch (retryError) {
              console.error(`[READ_BINARY_FILE] Retry also failed:`, retryError);
              // If we have content but path didn't match, still try to use it
              if (hasContent) {
                console.log(`[READ_BINARY_FILE] Path didn't match but content available, using it anyway`);
                try {
                  const binaryString = atob(inputObj.content as string);
                  fileData = new Uint8Array(binaryString.length);
                  for (let i = 0; i < binaryString.length; i++) {
                    fileData[i] = binaryString.charCodeAt(i);
                  }
                  console.log(`[READ_BINARY_FILE] Successfully decoded content from output (size: ${fileData.length} bytes)`);
                } catch (decodeError) {
                  throw new Error(`Read Binary File: File not found: ${filePath} (resolved to: ${sanitizedPath}). ${statError instanceof Error ? statError.message : String(statError)}`);
                }
              } else {
                throw new Error(`Read Binary File: File not found: ${filePath} (resolved to: ${sanitizedPath}). ${statError instanceof Error ? statError.message : String(statError)}`);
              }
            }
          }
        }
        
        if (!fileData) {
          throw new Error(`Read Binary File: Could not read file data`);
        }
        
        if (fileData.length > maxSize) {
          throw new Error(`Read Binary File: File size ${fileData.length} exceeds limit ${maxSize}`);
        }
        
        // Convert to base64 for JSON transmission
        const base64 = btoa(String.fromCharCode(...fileData));
        
        const inputObj = extractInputObject(input);
        return {
          content: base64,
          size: fileData.length,
          path: sanitizedPath,
          encoding: 'base64',
          ...inputObj
        };
      } catch (error) {
        if (error instanceof Deno.errors.NotFound) {
          throw new Error(`Read Binary File: File not found: ${filePath} (resolved to: ${sanitizedPath})`);
        }
        throw new Error(`Read Binary File: Failed to read file. ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    case "write_binary_file": {
      // Write Binary File: Write file to path
      const filePath = getStringProperty(config, 'filePath', '');
      const content = getStringProperty(config, 'content', '');
      
      if (!filePath || filePath.trim() === '') {
        throw new Error('Write Binary File: File path is required');
      }
      
      if (!content || content.trim() === '') {
        throw new Error('Write Binary File: Content is required');
      }
      
      // Sanitize path (prevent directory traversal)
      // In Supabase Edge Functions, use /tmp (absolute path) for writable files
      let sanitizedPath = filePath.replace(/\.\./g, '');
      
      // Ensure we're using /tmp (absolute path) for writable files
      // Supabase Edge Functions may only allow writes to /tmp
      if (!sanitizedPath.startsWith('/tmp/') && !sanitizedPath.startsWith('tmp/')) {
        // Extract just the filename if a full path was provided
        const filename = sanitizedPath.split('/').pop() || sanitizedPath || 'file.txt';
        sanitizedPath = `/tmp/${filename}`;
      } else if (sanitizedPath.startsWith('tmp/')) {
        // Convert relative tmp/ to absolute /tmp/
        sanitizedPath = '/' + sanitizedPath;
      } else if (!sanitizedPath.startsWith('/tmp/')) {
        // If it starts with / but not /tmp/, redirect to /tmp/
        const filename = sanitizedPath.split('/').pop() || 'file.txt';
        sanitizedPath = `/tmp/${filename}`;
      }
      
      try {
        // Ensure parent directory exists
        const dirPath = sanitizedPath.split('/').slice(0, -1).join('/');
        if (dirPath) {
          try {
            await Deno.mkdir(dirPath, { recursive: true });
          } catch (dirError) {
            // Check if directory already exists
            try {
              const stat = await Deno.stat(dirPath);
              if (!stat.isDirectory) {
                throw new Error(`Path exists but is not a directory: ${dirPath}`);
              }
              // Directory exists, continue
            } catch (statError) {
              // Directory doesn't exist and mkdir failed
              const errorMsg = dirError instanceof Error ? dirError.message : String(dirError);
              // Only throw if it's not an "already exists" error
              if (!errorMsg.includes('already exists') && !errorMsg.includes('file exists')) {
                throw new Error(`Failed to create directory ${dirPath}: ${errorMsg}`);
              }
            }
          }
        }
        
        // Decode base64 content
        let binaryString: string;
        try {
          binaryString = atob(content);
        } catch (decodeError) {
          throw new Error(`Invalid base64 content: ${decodeError instanceof Error ? decodeError.message : String(decodeError)}`);
        }
        
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        
        // Write file
        try {
          // Check if Deno.writeFile is available
          if (typeof Deno.writeFile !== 'function') {
            throw new Error('Deno.writeFile is not available in this runtime. File writes may not be supported in Supabase Edge Functions.');
          }
          
          // Log for debugging
          console.log(`Attempting to write file: ${sanitizedPath}, size: ${bytes.length} bytes`);
          console.log(`Deno.writeFile available: ${typeof Deno.writeFile}`);
          
          // Try writing the file - use absolute path /tmp/
          await Deno.writeFile(sanitizedPath, bytes, { create: true });
          console.log(`Successfully wrote file: ${sanitizedPath}`);
          
          // Verify file was written by checking if it exists
          try {
            const verifyStat = await Deno.stat(sanitizedPath);
            console.log(`[WRITE_BINARY_FILE] File verification: exists=${verifyStat.isFile}, size=${verifyStat.size} bytes`);
          } catch (verifyError) {
            console.warn(`[WRITE_BINARY_FILE] Warning: Could not verify file after write:`, verifyError);
          }
        } catch (writeError) {
          const errorMsg = writeError instanceof Error ? writeError.message : String(writeError);
          console.error(`Write error details:`, {
            error: errorMsg,
            errorType: writeError instanceof Error ? writeError.constructor.name : typeof writeError,
            path: sanitizedPath,
            dirPath: dirPath,
            fullError: writeError
          });
          
          // Check for specific error patterns
          if (errorMsg.includes('entity not found') || errorMsg.includes('writefile')) {
            // This suggests Deno.writeFile might not be available in Supabase Edge Functions
            throw new Error(`File write not supported: Deno.writeFile is not available in Supabase Edge Functions runtime. Consider using Supabase Storage instead for file operations. Original error: ${errorMsg}`);
          } else if (errorMsg.includes('Permission denied') || errorMsg.includes('permission')) {
            throw new Error(`Permission denied: Cannot write to ${sanitizedPath}. Check file system permissions.`);
          } else if (errorMsg.includes('No such file') || errorMsg.includes('not found')) {
            throw new Error(`Directory not found: ${dirPath || 'root'}. In Supabase Edge Functions, files can only be written to the /tmp directory.`);
          } else {
            throw new Error(`Write failed: ${errorMsg}`);
          }
        }
        
        // Also include the content as base64 in output for downstream nodes
        // This allows Read Binary File to use it directly if filesystem access fails
        const contentBase64 = btoa(String.fromCharCode(...bytes));
        
        const inputObj = extractInputObject(input);
        return {
          success: true,
          path: sanitizedPath,
          size: bytes.length,
          content: contentBase64, // Include content for downstream nodes
          encoding: 'base64',
          ...inputObj
        };
      } catch (error) {
        throw new Error(`Write Binary File: Failed to write file. ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    case "rss_feed_read": {
      // RSS Feed Read: Parse RSS feed
      const feedUrl = getStringProperty(config, 'feedUrl', '');
      const maxItems = getNumberProperty(config, 'maxItems', 10);
      
      if (!feedUrl || feedUrl.trim() === '') {
        throw new Error('RSS Feed Read: Feed URL is required');
      }
      
      validateURL(feedUrl, 'feed URL', 'RSS Feed Read');
      
      try {
        const response = await fetch(feedUrl);
        if (!response.ok) {
          throw new Error(`RSS Feed Read: HTTP ${response.status} ${response.statusText}`);
        }
        
        const xmlText = await response.text();
        
        // Simple XML parsing (basic implementation)
        // In production, use a proper XML parser library
        const items: Array<Record<string, unknown>> = [];
        const itemRegex = /<item[^>]*>([\s\S]*?)<\/item>/gi;
        let match;
        let count = 0;
        
        while ((match = itemRegex.exec(xmlText)) !== null && count < maxItems) {
          const itemXml = match[1];
          const titleMatch = itemXml.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
          const linkMatch = itemXml.match(/<link[^>]*>([\s\S]*?)<\/link>/i);
          const descriptionMatch = itemXml.match(/<description[^>]*>([\s\S]*?)<\/description>/i);
          const pubDateMatch = itemXml.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i);
          
          items.push({
            title: titleMatch ? titleMatch[1].trim() : '',
            link: linkMatch ? linkMatch[1].trim() : '',
            description: descriptionMatch ? descriptionMatch[1].trim() : '',
            pubDate: pubDateMatch ? pubDateMatch[1].trim() : ''
          });
          count++;
        }
        
        const inputObj = extractInputObject(input);
        return {
          items,
          count: items.length,
          feedUrl,
          ...inputObj
        };
      } catch (error) {
        throw new Error(`RSS Feed Read: Failed to read feed. ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    case "html_extract": {
      // HTML Extract: Extract content from HTML
      const selector = getStringProperty(config, 'selector', '');
      const htmlConfig = getStringProperty(config, 'html', '');
      let html: string;
      
      if (htmlConfig && htmlConfig.trim() !== '') {
        html = htmlConfig;
      } else {
        // Extract from input and convert to string
        const inputData = extractDataFromInput(input);
        if (typeof inputData === 'string') {
          html = inputData;
        } else if (inputData && typeof inputData === 'object') {
          html = JSON.stringify(inputData);
        } else {
          html = String(inputData || '');
        }
      }
      
      if (!html || html.trim() === '') {
        throw new Error('HTML Extract: HTML content is required. Provide HTML in config or input data.');
      }
      
      if (!selector || selector.trim() === '') {
        // Return entire HTML if no selector
        const inputObj = extractInputObject(input);
        return {
          html,
          extracted: html,
          ...inputObj
        };
      }
      
      // Basic HTML extraction using regex (simple implementation)
      // In production, use a proper HTML parser
      try {
        const regex = new RegExp(`<${selector}[^>]*>([\\s\\S]*?)<\\/${selector}>`, 'gi');
        const matches = html.match(regex) || [];
        const extracted = matches.map(match => match.replace(/<[^>]+>/g, '').trim());
        
        const inputObj = extractInputObject(input);
        return {
          html,
          extracted: extracted.length === 1 ? extracted[0] : extracted,
          count: extracted.length,
          selector,
          ...inputObj
        };
      } catch (error) {
        throw new Error(`HTML Extract: Failed to extract content. ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    case "xml": {
      // XML: Parse and extract from XML
      const operation = getStringProperty(config, 'operation', 'parse');
      const xmlConfig = getStringProperty(config, 'xml', '');
      let xmlContent: string;
      
      if (xmlConfig && xmlConfig.trim() !== '') {
        xmlContent = xmlConfig;
      } else {
        // Extract from input and convert to string
        const inputData = extractDataFromInput(input);
        if (typeof inputData === 'string') {
          xmlContent = inputData;
        } else if (inputData && typeof inputData === 'object') {
          xmlContent = JSON.stringify(inputData);
        } else {
          xmlContent = String(inputData || '');
        }
      }
      
      if (!xmlContent || xmlContent.trim() === '') {
        throw new Error('XML: XML content is required. Provide XML in config or input data.');
      }
      
      try {
        if (operation === 'parse') {
          // Simple XML parsing (basic implementation)
          const result: Record<string, unknown> = {};
          const tagRegex = /<([^>]+)>([\s\S]*?)<\/\1>/g;
          let match;
          
          while ((match = tagRegex.exec(xmlContent)) !== null) {
            const tagName = match[1];
            const tagContent = match[2].trim();
            result[tagName] = tagContent;
          }
          
          const inputObj = extractInputObject(input);
          return {
            parsed: result,
            xml: xmlContent,
            ...inputObj
          };
        } else if (operation === 'extract') {
          const xpath = getStringProperty(config, 'xpath', '');
          if (!xpath) {
            throw new Error('XML: XPath expression required for extract operation');
          }
          
          const inputObj = extractInputObject(input);
          return {
            extracted: xmlContent,
            xpath,
            ...inputObj
          };
        }
        
        throw new Error(`XML: Unknown operation "${operation}"`);
      } catch (error) {
        throw new Error(`XML: Operation failed. ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    case "aws_s3": {
      // AWS S3: Read/write/list/delete objects in S3
      // Note: Full AWS Signature V4 implementation requires crypto operations
      // This is a simplified version - for production, use AWS SDK or proper signature library
      const accessKeyId = getStringProperty(config, 'accessKeyId', '');
      const secretAccessKey = getStringProperty(config, 'secretAccessKey', '');
      const region = getStringProperty(config, 'region', 'us-east-1');
      const bucket = getStringProperty(config, 'bucket', '');
      const operation = getStringProperty(config, 'operation', 'get');
      const key = getStringProperty(config, 'key', '');
      
      if (!accessKeyId || !secretAccessKey || !bucket) {
        throw new Error('AWS S3: Access Key ID, Secret Access Key, and Bucket are required');
      }

      // For now, provide a placeholder that explains the requirement
      // AWS S3 requires complex signature V4 signing which is better handled by AWS SDK
      // In Deno/Edge Functions, we can use AWS SDK for JavaScript v3 via npm:aws-sdk
      // Or use Presigned URLs for simpler operations
      throw new Error('AWS S3: AWS S3 node requires AWS SDK implementation. For production use, please configure AWS SDK or use presigned URLs via HTTP Request node.');
    }

    case "ftp": {
      // FTP: File Transfer Protocol operations
      const host = getStringProperty(config, 'host', '');
      const port = getNumberProperty(config, 'port', 21);
      const username = getStringProperty(config, 'username', '');
      const password = getStringProperty(config, 'password', '');
      const operation = getStringProperty(config, 'operation', 'get');
      const remotePath = getStringProperty(config, 'remotePath', '');
      
      if (!host || !username || !password || !remotePath) {
        throw new Error('FTP: Host, Username, Password, and Remote Path are required');
      }

      // FTP implementation requires FTP client library
      throw new Error('FTP: FTP node requires FTP client library. For Edge Functions, consider using HTTP-based FTP service or external API gateway.');
    }

    case "sftp": {
      // SFTP: Secure File Transfer Protocol operations
      const host = getStringProperty(config, 'host', '');
      const port = getNumberProperty(config, 'port', 22);
      const username = getStringProperty(config, 'username', '');
      const password = getStringProperty(config, 'password', '');
      const privateKey = getStringProperty(config, 'privateKey', '');
      const operation = getStringProperty(config, 'operation', 'get');
      const remotePath = getStringProperty(config, 'remotePath', '');
      
      if (!host || !username || (!password && !privateKey) || !remotePath) {
        throw new Error('SFTP: Host, Username, Password/Private Key, and Remote Path are required');
      }

      // SFTP requires SSH client library
      throw new Error('SFTP: SFTP node requires SSH/SFTP client library. For Edge Functions, consider using external SFTP service API.');
    }

    case "google_drive": {
      // Google Drive: Read/write/list/delete files
      const accessToken = getStringProperty(config, 'accessToken', '');
      const operation = getStringProperty(config, 'operation', 'read');
      const fileId = getStringProperty(config, 'fileId', '');
      const fileName = getStringProperty(config, 'fileName', '');
      const content = getStringProperty(config, 'content', '');
      const folderId = getStringProperty(config, 'folderId', '');
      
      if (!accessToken) {
        throw new Error('Google Drive: Access Token is required');
      }

      try {
        if (operation === 'read') {
          if (!fileId) throw new Error('Google Drive: File ID is required for read operation');
          
          const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
            },
          });

          if (!response.ok) {
            throw new Error(`Google Drive API error: ${response.status} - ${await response.text()}`);
          }

          const data = await response.arrayBuffer();
          const base64 = btoa(String.fromCharCode(...new Uint8Array(data)));
          return { content: base64, size: data.byteLength, fileId };
        } else if (operation === 'upload') {
          if (!fileName || !content) {
            throw new Error('Google Drive: File Name and Content are required for upload operation');
          }

          // Upload file metadata first, then content
          const metadataResponse = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'multipart/related; boundary=foo_bar_baz',
            },
            body: `--foo_bar_baz\nContent-Type: application/json; charset=UTF-8\n\n${JSON.stringify({ name: fileName, parents: folderId ? [folderId] : [] })}\n--foo_bar_baz\nContent-Type: text/plain\n\n${content}\n--foo_bar_baz--`,
          });

          if (!metadataResponse.ok) {
            throw new Error(`Google Drive Upload failed: ${metadataResponse.status} - ${await metadataResponse.text()}`);
          }

          const fileData = await metadataResponse.json();
          return { success: true, fileId: fileData.id, fileName };
        } else if (operation === 'list') {
          const query = folderId ? `'${folderId}' in parents` : '';
          const url = `https://www.googleapis.com/drive/v3/files?${query ? `q=${encodeURIComponent(query)}&` : ''}fields=files(id,name,mimeType,size)`;
          
          const response = await fetch(url, {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
            },
          });

          if (!response.ok) {
            throw new Error(`Google Drive List failed: ${response.status} - ${await response.text()}`);
          }

          const data = await response.json();
          return { files: data.files || [], count: data.files?.length || 0 };
        } else if (operation === 'delete') {
          if (!fileId) throw new Error('Google Drive: File ID is required for delete operation');
          
          const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
            },
          });

          if (!response.ok && response.status !== 204) {
            throw new Error(`Google Drive Delete failed: ${response.status} - ${await response.text()}`);
          }

          return { success: true, fileId, deleted: true };
        } else {
          throw new Error(`Google Drive: Unknown operation: ${operation}`);
        }
      } catch (error) {
        throw new Error(`Google Drive: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    case "dropbox": {
      // Dropbox: Read/write/list/delete files
      const accessToken = getStringProperty(config, 'accessToken', '');
      const operation = getStringProperty(config, 'operation', 'read');
      const path = getStringProperty(config, 'path', '');
      const content = getStringProperty(config, 'content', '');
      
      if (!accessToken || !path) {
        throw new Error('Dropbox: Access Token and Path are required');
      }

      try {
        if (operation === 'read') {
          const response = await fetch('https://content.dropboxapi.com/2/files/download', {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Dropbox-API-Arg': JSON.stringify({ path }),
            },
          });

          if (!response.ok) {
            throw new Error(`Dropbox API error: ${response.status} - ${await response.text()}`);
          }

          const data = await response.arrayBuffer();
          const text = new TextDecoder().decode(data);
          return { content: text, size: data.byteLength, path };
        } else if (operation === 'upload') {
          if (!content) throw new Error('Dropbox: Content is required for upload operation');
          
          const response = await fetch('https://content.dropboxapi.com/2/files/upload', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/octet-stream',
              'Dropbox-API-Arg': JSON.stringify({
                path,
                mode: 'overwrite',
              }),
            },
            body: content,
          });

          if (!response.ok) {
            throw new Error(`Dropbox Upload failed: ${response.status} - ${await response.text()}`);
          }

          const data = await response.json();
          return { success: true, path: data.path_lower, size: data.size };
        } else if (operation === 'list') {
          const response = await fetch('https://api.dropboxapi.com/2/files/list_folder', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ path }),
          });

          if (!response.ok) {
            throw new Error(`Dropbox List failed: ${response.status} - ${await response.text()}`);
          }

          const data = await response.json();
          return { files: data.entries || [], count: data.entries?.length || 0 };
        } else if (operation === 'delete') {
          const response = await fetch('https://api.dropboxapi.com/2/files/delete_v2', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ path }),
          });

          if (!response.ok) {
            throw new Error(`Dropbox Delete failed: ${response.status} - ${await response.text()}`);
          }

          const data = await response.json();
          return { success: true, path, deleted: true };
        } else {
          throw new Error(`Dropbox: Unknown operation: ${operation}`);
        }
      } catch (error) {
        throw new Error(`Dropbox: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    case "onedrive": {
      // OneDrive: Read/write/list/delete files
      const accessToken = getStringProperty(config, 'accessToken', '');
      const operation = getStringProperty(config, 'operation', 'read');
      const fileId = getStringProperty(config, 'fileId', '');
      const path = getStringProperty(config, 'path', '');
      const fileName = getStringProperty(config, 'fileName', '');
      const content = getStringProperty(config, 'content', '');
      
      if (!accessToken) {
        throw new Error('OneDrive: Access Token is required');
      }

      try {
        const baseUrl = 'https://graph.microsoft.com/v1.0/me/drive';
        
        if (operation === 'read') {
          const endpoint = fileId 
            ? `${baseUrl}/items/${fileId}/content`
            : `${baseUrl}/root:${path}:/content`;
          
          const response = await fetch(endpoint, {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
            },
          });

          if (!response.ok) {
            throw new Error(`OneDrive API error: ${response.status} - ${await response.text()}`);
          }

          const data = await response.arrayBuffer();
          const text = new TextDecoder().decode(data);
          return { content: text, size: data.byteLength, fileId, path };
        } else if (operation === 'upload') {
          if (!fileName || !content) {
            throw new Error('OneDrive: File Name and Content are required for upload operation');
          }

          const endpoint = `${baseUrl}/root:/${fileName}:/content`;
          const response = await fetch(endpoint, {
            method: 'PUT',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'text/plain',
            },
            body: content,
          });

          if (!response.ok) {
            throw new Error(`OneDrive Upload failed: ${response.status} - ${await response.text()}`);
          }

          const fileData = await response.json();
          return { success: true, fileId: fileData.id, fileName };
        } else if (operation === 'list') {
          const endpoint = `${baseUrl}/root/children`;
          const response = await fetch(endpoint, {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
            },
          });

          if (!response.ok) {
            throw new Error(`OneDrive List failed: ${response.status} - ${await response.text()}`);
          }

          const data = await response.json();
          return { files: data.value || [], count: data.value?.length || 0 };
        } else if (operation === 'delete') {
          const endpoint = fileId 
            ? `${baseUrl}/items/${fileId}`
            : `${baseUrl}/root:${path}:`;
          
          const response = await fetch(endpoint, {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
            },
          });

          if (!response.ok && response.status !== 204) {
            throw new Error(`OneDrive Delete failed: ${response.status} - ${await response.text()}`);
          }

          return { success: true, fileId, path, deleted: true };
        } else {
          throw new Error(`OneDrive: Unknown operation: ${operation}`);
        }
      } catch (error) {
        throw new Error(`OneDrive: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    case "box": {
      // Box: Read/write/list/delete files
      const accessToken = getStringProperty(config, 'accessToken', '');
      const operation = getStringProperty(config, 'operation', 'read');
      const fileId = getStringProperty(config, 'fileId', '');
      const fileName = getStringProperty(config, 'fileName', '');
      const content = getStringProperty(config, 'content', '');
      const folderId = getStringProperty(config, 'folderId', '0');
      
      if (!accessToken) {
        throw new Error('Box: Access Token is required');
      }

      try {
        if (operation === 'read') {
          if (!fileId) throw new Error('Box: File ID is required for read operation');
          
          const response = await fetch(`https://api.box.com/2.0/files/${fileId}/content`, {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
            },
          });

          if (!response.ok) {
            throw new Error(`Box API error: ${response.status} - ${await response.text()}`);
          }

          const data = await response.arrayBuffer();
          const text = new TextDecoder().decode(data);
          return { content: text, size: data.byteLength, fileId };
        } else if (operation === 'upload') {
          if (!fileName || !content) {
            throw new Error('Box: File Name and Content are required for upload operation');
          }

          // Box upload requires multipart form data
          const formData = new FormData();
          const fileBlob = new Blob([content], { type: 'text/plain' });
          formData.append('file', fileBlob, fileName);
          formData.append('parent_id', folderId);

          const response = await fetch(`https://upload.box.com/api/2.0/files/content`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
            },
            body: formData,
          });

          if (!response.ok) {
            throw new Error(`Box Upload failed: ${response.status} - ${await response.text()}`);
          }

          const data = await response.json();
          return { success: true, fileId: data.entries[0]?.id, fileName };
        } else if (operation === 'list') {
          const response = await fetch(`https://api.box.com/2.0/folders/${folderId}/items`, {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
            },
          });

          if (!response.ok) {
            throw new Error(`Box List failed: ${response.status} - ${await response.text()}`);
          }

          const data = await response.json();
          return { files: data.entries || [], count: data.entries?.length || 0 };
        } else if (operation === 'delete') {
          if (!fileId) throw new Error('Box: File ID is required for delete operation');
          
          const response = await fetch(`https://api.box.com/2.0/files/${fileId}`, {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
            },
          });

          if (!response.ok && response.status !== 204) {
            throw new Error(`Box Delete failed: ${response.status} - ${await response.text()}`);
          }

          return { success: true, fileId, deleted: true };
        } else {
          throw new Error(`Box: Unknown operation: ${operation}`);
        }
      } catch (error) {
        throw new Error(`Box: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    case "minio": {
      // MinIO: Object storage operations (S3-compatible)
      const endpoint = getStringProperty(config, 'endpoint', '');
      const accessKey = getStringProperty(config, 'accessKey', '');
      const secretKey = getStringProperty(config, 'secretKey', '');
      const bucket = getStringProperty(config, 'bucket', '');
      const operation = getStringProperty(config, 'operation', 'get');
      const key = getStringProperty(config, 'key', '');
      const useSSL = getBooleanProperty(config, 'useSSL', false);
      
      if (!endpoint || !accessKey || !secretKey || !bucket) {
        throw new Error('MinIO: Endpoint, Access Key, Secret Key, and Bucket are required');
      }

      // MinIO uses S3-compatible API, but signature implementation is complex
      throw new Error('MinIO: MinIO node requires S3-compatible client library. For production use, please configure MinIO client library or use presigned URLs via HTTP Request node.');
    }

    case "vector_store": {
      // Vector Store: Store and search vectors (embeddings)
      const provider = getStringProperty(config, 'provider', 'pinecone');
      const apiKey = getStringProperty(config, 'apiKey', '');
      const indexName = getStringProperty(config, 'indexName', '');
      const operation = getStringProperty(config, 'operation', 'upsert');
      
      if (!apiKey || !indexName) {
        throw new Error('Vector Store: API Key and Index Name are required');
      }

      try {
        if (provider === 'pinecone') {
          const baseUrl = `https://${indexName}-${apiKey.substring(0, 8)}.svc.pinecone.io`;
          
          if (operation === 'upsert') {
            const vectorsStr = getStringProperty(config, 'vectors', '[]');
            const vectors = parseJSONSafe(vectorsStr, 'vectors') as Array<Record<string, unknown>>;
            
            if (!Array.isArray(vectors) || vectors.length === 0) {
              throw new Error('Vector Store: Vectors array is required for upsert operation');
            }
            
            const response = await fetch(`${baseUrl}/vectors/upsert`, {
              method: 'POST',
              headers: {
                'Api-Key': apiKey,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ vectors }),
            });
            
            if (!response.ok) {
              throw new Error(`Vector Store Upsert failed: ${response.status} - ${await response.text()}`);
            }
            
            const data = await response.json();
            return { success: true, upsertedCount: data.upsertedCount || vectors.length };
          } else if (operation === 'query') {
            const queryVectorStr = getStringProperty(config, 'queryVector', '{}');
            const queryVector = parseJSONSafe(queryVectorStr, 'queryVector') as Record<string, unknown>;
            
            if (!queryVector.vector || !Array.isArray(queryVector.vector)) {
              throw new Error('Vector Store: Query vector is required for query operation');
            }
            
            const response = await fetch(`${baseUrl}/query`, {
              method: 'POST',
              headers: {
                'Api-Key': apiKey,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                vector: queryVector.vector,
                topK: queryVector.topK || 5,
                includeMetadata: queryVector.includeMetadata !== false,
              }),
            });
            
            if (!response.ok) {
              throw new Error(`Vector Store Query failed: ${response.status} - ${await response.text()}`);
            }
            
            const data = await response.json();
            return { matches: data.matches || [], count: data.matches?.length || 0 };
          } else if (operation === 'delete') {
            const idsStr = getStringProperty(config, 'ids', '[]');
            const ids = parseJSONSafe(idsStr, 'ids') as string[];
            
            if (!Array.isArray(ids) || ids.length === 0) {
              throw new Error('Vector Store: IDs array is required for delete operation');
            }
            
            const response = await fetch(`${baseUrl}/vectors/delete`, {
              method: 'POST',
              headers: {
                'Api-Key': apiKey,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ ids }),
            });
            
            if (!response.ok) {
              throw new Error(`Vector Store Delete failed: ${response.status} - ${await response.text()}`);
            }
            
            return { success: true, deletedCount: ids.length };
          } else {
            throw new Error(`Vector Store: Unknown operation: ${operation}`);
          }
        } else if (provider === 'supabase') {
          // Supabase pgvector - use Supabase database
          const supabaseUrl = Deno.env.get("SUPABASE_URL");
          const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
          
          if (!supabaseUrl || !supabaseKey) {
            throw new Error('Vector Store: Supabase configuration not available');
          }
          
          const supabaseClient = createClient(supabaseUrl, supabaseKey);
          
          if (operation === 'upsert') {
            const vectorsStr = getStringProperty(config, 'vectors', '[]');
            const vectors = parseJSONSafe(vectorsStr, 'vectors') as Array<Record<string, unknown>>;
            
            if (!Array.isArray(vectors) || vectors.length === 0) {
              throw new Error('Vector Store: Vectors array is required for upsert operation');
            }
            
            // Insert/update vectors in the index table
            const { data, error } = await supabaseClient
              .from(indexName)
              .upsert(vectors.map(v => ({
                id: v.id,
                embedding: v.values || v.vector,
                metadata: v.metadata || {},
              })));
            
            if (error) throw error;
            return { success: true, upsertedCount: vectors.length };
          } else if (operation === 'query') {
            const queryVectorStr = getStringProperty(config, 'queryVector', '{}');
            const queryVector = parseJSONSafe(queryVectorStr, 'queryVector') as Record<string, unknown>;
            
            if (!queryVector.vector || !Array.isArray(queryVector.vector)) {
              throw new Error('Vector Store: Query vector is required for query operation');
            }
            
            // Use pgvector similarity search via RPC or direct query
            const topK = (queryVector.topK as number) || 5;
            const { data, error } = await supabaseClient.rpc('match_documents', {
              query_embedding: queryVector.vector,
              match_threshold: 0.7,
              match_count: topK,
            });
            
            if (error) throw error;
            return { matches: data || [], count: data?.length || 0 };
          } else {
            throw new Error(`Vector Store: Operation ${operation} not yet supported for Supabase provider`);
          }
        } else {
          throw new Error(`Vector Store: Unsupported provider: ${provider}`);
        }
      } catch (error) {
        throw new Error(`Vector Store: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    case "chat_model": {
      // Chat Model: Unified interface for multiple LLM providers
      const provider = getStringProperty(config, 'provider', 'openai');
      const apiKey = getStringProperty(config, 'apiKey', '');
      const model = getStringProperty(config, 'model', 'gpt-4o');
      const prompt = getStringProperty(config, 'prompt', 'You are a helpful assistant.');
      const temperature = (config.temperature as number) || 0.7;
      
      if (!apiKey) {
        throw new Error('Chat Model: API Key is required');
      }

      // Extract message from input
      const userMessage = typeof input === 'string' 
        ? input 
        : (input as Record<string, unknown>)?.message as string || 
          (input as Record<string, unknown>)?.text as string || 
          JSON.stringify(input);

      const messages: Array<{ role: string; content: string }> = [
        { role: 'system', content: prompt },
        { role: 'user', content: userMessage }
      ];

      // Add conversation history if available
      if (conversationHistory && Array.isArray(conversationHistory) && conversationHistory.length > 0) {
        messages.push(...conversationHistory.map(msg => ({
          role: msg.role,
          content: msg.content
        })));
        messages.push({ role: 'user', content: userMessage });
      }

      try {
        if (provider === 'openai') {
          const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model,
              messages: messages.map(m => ({ role: m.role, content: m.content })),
              temperature,
            }),
          });

          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
          }

          const data = await response.json();
          return data.choices?.[0]?.message?.content || '';
        } else if (provider === 'anthropic') {
          const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
              'x-api-key': apiKey,
              'anthropic-version': '2023-06-01',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model,
              max_tokens: 4096,
              messages: messages.filter(m => m.role !== 'system').map(m => ({
                role: m.role === 'user' ? 'user' : 'assistant',
                content: m.content
              })),
              system: prompt,
            }),
          });

          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Anthropic API error: ${response.status} - ${errorText}`);
          }

          const data = await response.json();
          return data.content[0]?.text || '';
        } else if (provider === 'gemini') {
          const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              contents: [{ parts: [{ text: userMessage }] }],
              generationConfig: { temperature },
            }),
          });

          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
          }

          const data = await response.json();
          return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        } else if (provider === 'azure') {
          const endpoint = getStringProperty(config, 'endpoint', '');
          const deploymentName = getStringProperty(config, 'deploymentName', '');
          const apiVersion = '2024-02-15-preview';
          
          if (!endpoint || !deploymentName) {
            throw new Error('Chat Model: Endpoint and Deployment Name are required for Azure provider');
          }

          const url = `${endpoint.replace(/\/$/, '')}/openai/deployments/${deploymentName}/chat/completions?api-version=${apiVersion}`;
          
          const response = await fetch(url, {
            method: 'POST',
            headers: {
              'api-key': apiKey,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              messages: messages.map(m => ({ role: m.role, content: m.content })),
              temperature,
            }),
          });

          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Azure OpenAI API error: ${response.status} - ${errorText}`);
          }

          const data = await response.json();
          return data.choices?.[0]?.message?.content || '';
        } else {
          throw new Error(`Chat Model: Unsupported provider: ${provider}`);
        }
      } catch (error) {
        throw new Error(`Chat Model: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    case "ai_agent": {
      // AI Agent: Autonomous AI agent with tool usage
      const apiKey = getStringProperty(config, 'apiKey', '');
      const model = getStringProperty(config, 'model', 'gpt-4o');
      const prompt = getStringProperty(config, 'prompt', 'You are an AI agent that can use tools.');
      const toolsStr = getStringProperty(config, 'tools', '[]');
      const maxIterations = getNumberProperty(config, 'maxIterations', 5);
      const temperature = (config.temperature as number) || 0.7;
      
      if (!apiKey) {
        throw new Error('AI Agent: API Key is required');
      }

      const tools = parseJSONSafe(toolsStr, 'tools') as Array<Record<string, unknown>>;
      
      // Extract task from input
      const task = typeof input === 'string' 
        ? input 
        : (input as Record<string, unknown>)?.task as string || 
          (input as Record<string, unknown>)?.message as string || 
          JSON.stringify(input);

      try {
        // Simple agent implementation - iterate with tool calling
        let currentInput = task;
        let iteration = 0;
        let finalResponse = '';

        while (iteration < maxIterations) {
          const messages: Array<{ role: string; content: string }> = [
            { role: 'system', content: `${prompt}\n\nAvailable tools: ${JSON.stringify(tools.map(t => t.name))}` },
            { role: 'user', content: currentInput }
          ];

          const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model,
              messages,
              tools: tools.length > 0 ? tools.map(tool => ({
                type: 'function',
                function: {
                  name: tool.name,
                  description: tool.description || '',
                  parameters: tool.parameters || {},
                }
              })) : undefined,
              tool_choice: tools.length > 0 ? 'auto' : undefined,
              temperature,
            }),
          });

          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`AI Agent API error: ${response.status} - ${errorText}`);
          }

          const data = await response.json();
          const message = data.choices?.[0]?.message;
          
          if (message.tool_calls && message.tool_calls.length > 0) {
            // Agent wants to use tools - simulate tool execution
            // In a full implementation, you would execute the actual tools
            const toolResults = message.tool_calls.map((toolCall: Record<string, unknown>) => ({
              tool_call_id: toolCall.id,
              role: 'tool',
              name: toolCall.function?.name,
              content: JSON.stringify({ result: 'Tool executed (simulated)' }),
            }));
            
            messages.push(message);
            messages.push(...toolResults);
            currentInput = 'Continue with the next step';
          } else {
            // Agent provided final answer
            finalResponse = message.content || '';
            break;
          }

          iteration++;
        }

        return {
          response: finalResponse,
          iterations: iteration,
          completed: iteration < maxIterations,
        };
      } catch (error) {
        throw new Error(`AI Agent: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    case "embeddings": {
      // Embeddings: Generate text embeddings/vectors
      const provider = getStringProperty(config, 'provider', 'openai');
      const apiKey = getStringProperty(config, 'apiKey', '');
      const model = getStringProperty(config, 'model', 'text-embedding-ada-002');
      const textInput = getStringProperty(config, 'text', '');
      const dimensions = config.dimensions as number | undefined;

      if (!apiKey) {
        throw new Error('Embeddings: API Key is required');
      }

      // Extract text from input or config
      const text = textInput || (typeof input === 'string' 
        ? input 
        : (input as Record<string, unknown>)?.text as string || 
          (input as Record<string, unknown>)?.message as string || 
          JSON.stringify(input));

      if (!text || text.trim() === '') {
        throw new Error('Embeddings: Text to embed is required');
      }

      try {
        if (provider === 'openai') {
          const url = 'https://api.openai.com/v1/embeddings';
          const payload: Record<string, unknown> = {
            model,
            input: text,
          };
          
          if (dimensions && (model.includes('text-embedding-3') || model.includes('embedding-3'))) {
            payload.dimensions = dimensions;
          }

          const response = await fetch(url, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
          });

          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`OpenAI Embeddings API error: ${response.status} - ${errorText}`);
          }

          const data = await response.json();
          return {
            embedding: data.data[0]?.embedding || [],
            model: data.model,
            usage: data.usage,
            dimensions: data.data[0]?.embedding?.length || dimensions || 1536,
          };
        } else if (provider === 'gemini') {
          // Gemini embeddings via Google AI API
          const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:embedContent?key=${apiKey}`;
          
          const response = await fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              content: {
                parts: [{ text }],
              },
            }),
          });

          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Gemini Embeddings API error: ${response.status} - ${errorText}`);
          }

          const data = await response.json();
          return {
            embedding: data.embedding?.values || [],
            model: data.model || model,
            dimensions: data.embedding?.values?.length || 768,
          };
        } else {
          throw new Error(`Embeddings: Unsupported provider: ${provider}`);
        }
      } catch (error) {
        throw new Error(`Embeddings: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    // ============================================
    // ADDITIONAL DATABASE NODES
    // ============================================

    case "mysql": {
      // MySQL: MySQL database operations (placeholder - requires connection setup)
      const operation = getStringProperty(config, 'operation', 'select');
      throw new Error('MySQL: MySQL node requires database connection configuration. Use PostgreSQL/Supabase node for Supabase database, or configure MySQL connection in environment.');
    }

    case "mongodb": {
      // MongoDB: MongoDB operations (placeholder - requires connection setup)
      const operation = getStringProperty(config, 'operation', 'find');
      throw new Error('MongoDB: MongoDB node requires database connection configuration. Please configure MongoDB connection in environment variables.');
    }

    case "redis": {
      // Redis: Redis operations (beyond Memory node)
      const operation = getStringProperty(config, 'operation', 'get');
      const key = getStringProperty(config, 'key', '');
      
      if (!key) {
        throw new Error('Redis: Key is required');
      }
      
      // Note: Redis connection would need to be configured
      // This is a placeholder implementation
      throw new Error('Redis: Redis node requires connection configuration. Use Memory node for conversation memory, or configure Redis connection in environment.');
    }

    case "mssql": {
      // Microsoft SQL Server: Database operations
      const server = getStringProperty(config, 'server', '');
      const database = getStringProperty(config, 'database', '');
      const username = getStringProperty(config, 'username', '');
      const password = getStringProperty(config, 'password', '');
      const operation = getStringProperty(config, 'operation', 'select');
      
      if (!server || !database || !username || !password) {
        throw new Error('Microsoft SQL Server: Server, Database, Username, and Password are required');
      }

      // SQL Server requires specific driver library
      throw new Error('Microsoft SQL Server: SQL Server node requires database driver library. For production use, please configure SQL Server connection driver or use HTTP-based database API.');
    }

    case "sqlite": {
      // SQLite: Database operations
      const databasePath = getStringProperty(config, 'databasePath', '');
      const operation = getStringProperty(config, 'operation', 'select');
      
      if (!databasePath) {
        throw new Error('SQLite: Database Path is required');
      }

      // SQLite requires file system access and SQLite library
      throw new Error('SQLite: SQLite node requires file system access and SQLite library. For Edge Functions, consider using database API or cloud SQLite service.');
    }

    case "snowflake": {
      // Snowflake: Data warehouse operations
      const account = getStringProperty(config, 'account', '');
      const username = getStringProperty(config, 'username', '');
      const password = getStringProperty(config, 'password', '');
      const warehouse = getStringProperty(config, 'warehouse', '');
      const database = getStringProperty(config, 'database', '');
      const schema = getStringProperty(config, 'schema', 'PUBLIC');
      const operation = getStringProperty(config, 'operation', 'select');
      
      if (!account || !username || !password || !warehouse || !database) {
        throw new Error('Snowflake: Account, Username, Password, Warehouse, and Database are required');
      }

      // Snowflake requires Snowflake SDK or REST API
      throw new Error('Snowflake: Snowflake node requires Snowflake SDK or REST API. For production use, please configure Snowflake connection using Snowflake SDK or REST API.');
    }

    case "timescaledb": {
      // TimescaleDB: Time-series PostgreSQL operations
      const host = getStringProperty(config, 'host', '');
      const port = getNumberProperty(config, 'port', 5432);
      const database = getStringProperty(config, 'database', '');
      const username = getStringProperty(config, 'username', '');
      const password = getStringProperty(config, 'password', '');
      const operation = getStringProperty(config, 'operation', 'select');
      
      if (!host || !database || !username || !password) {
        throw new Error('TimescaleDB: Host, Database, Username, and Password are required');
      }

      // TimescaleDB is PostgreSQL extension, requires PostgreSQL driver
      throw new Error('TimescaleDB: TimescaleDB node requires PostgreSQL driver. For production use, please configure PostgreSQL connection driver or use HTTP-based database API.');
    }

    default:
      console.log(`Node type ${type} executed with passthrough`);
      return input;
  }
}

// ============================================
// HELPER FUNCTIONS FOR DATA MANIPULATION
// ============================================

function performAggregateOperation(
  operation: string,
  items: unknown[],
  field: string
): unknown {
  if (items.length === 0) {
    return operation === 'count' ? 0 : null;
  }

  switch (operation) {
    case 'count':
      return items.length;

    case 'sum':
      return items.reduce((sum: number, item: unknown) => {
        const val = field ? extractNestedValue(item, field) : item;
        return sum + (typeof val === 'number' ? val : 0);
      }, 0);

    case 'avg':
    case 'average':
      const sum = items.reduce((sum: number, item: unknown) => {
        const val = field ? extractNestedValue(item, field) : item;
        return sum + (typeof val === 'number' ? val : 0);
      }, 0);
      return items.length > 0 ? sum / items.length : 0;

    case 'min':
      return items.reduce((min: unknown, item: unknown) => {
        const val = field ? extractNestedValue(item, field) : item;
        if (min === null || min === undefined) return val;
        if (typeof val === 'number' && typeof min === 'number') {
          return val < min ? val : min;
        }
        return String(val) < String(min) ? val : min;
      }, null);

    case 'max':
      return items.reduce((max: unknown, item: unknown) => {
        const val = field ? extractNestedValue(item, field) : item;
        if (max === null || max === undefined) return val;
        if (typeof val === 'number' && typeof max === 'number') {
          return val > max ? val : max;
        }
        return String(val) > String(max) ? val : max;
      }, null);

    default:
      throw new Error(`Aggregate: Unknown operation "${operation}". Supported: count, sum, avg, min, max`);
  }
}

function extractNestedValue(obj: unknown, path: string): unknown {
  if (!path || typeof obj !== 'object' || obj === null) {
    return obj;
  }

  const keys = path.split('.');
  let value: unknown = obj;

  for (const key of keys) {
    if (value && typeof value === 'object' && key in value) {
      value = (value as Record<string, unknown>)[key];
    } else {
      return undefined;
    }
  }

  return value;
}

function compareValues(a: unknown, b: unknown, type: string, direction: string): number {
  let comparison = 0;

  // Type conversion
  let aComp: unknown = a;
  let bComp: unknown = b;

  if (type === 'number') {
    aComp = typeof a === 'number' ? a : parseFloat(String(a));
    bComp = typeof b === 'number' ? b : parseFloat(String(b));
  } else if (type === 'string') {
    aComp = String(a);
    bComp = String(b);
  } else if (type === 'date') {
    aComp = new Date(String(a)).getTime();
    bComp = new Date(String(b)).getTime();
  } else {
    // Auto type detection
    if (typeof a === 'number' && typeof b === 'number') {
      aComp = a;
      bComp = b;
    } else {
      aComp = String(a);
      bComp = String(b);
    }
  }

  // Comparison
  if (aComp < bComp) comparison = -1;
  else if (aComp > bComp) comparison = 1;
  else comparison = 0;

  // Direction
  return direction === 'desc' ? -comparison : comparison;
}

async function executeGeminiNode(
  config: Record<string, unknown>,
  input: unknown,
  apiKey: string,
  conversationHistory?: Array<{ role: string; content: string }>
): Promise<unknown> {
  const model = (config.model as string) || "gemini-2.5-flash";
  const prompt = (config.prompt as string) || "You are a helpful assistant.";
  const temperature = (config.temperature as number) || 0.7;

  // Extract message from input - handle different input formats
  let userMessage = "";
  if (typeof input === "string") {
    userMessage = input;
  } else if (typeof input === "object" && input !== null) {
    const inputObj = input as Record<string, unknown>;
    // Try to extract message from common fields
    userMessage = (inputObj.message as string) ||
      (inputObj.text as string) ||
      (inputObj.content as string) ||
      (inputObj.input as string) ||
      JSON.stringify(input);
  } else {
    userMessage = String(input);
  }

  // Build conversation history for Gemini
  const conversationParts: Array<{ text: string }> = [];

  // Add system prompt
  conversationParts.push({ text: prompt });

  // Add conversation history if available (for memory)
  if (conversationHistory && Array.isArray(conversationHistory) && conversationHistory.length > 0) {
    // Format conversation history for Gemini
    const historyText = conversationHistory
      .map(msg => `${msg.role === "user" ? "User" : "Assistant"}: ${msg.content}`)
      .join("\n\n");
    conversationParts.push({ text: `Previous conversation:\n${historyText}\n\nCurrent message:` });
  }

  // Add current user message
  conversationParts.push({ text: userMessage });

  const API_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

  const response = await fetch(API_ENDPOINT, {
    method: "POST",
    headers: {
      "x-goog-api-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contents: [
        {
          parts: conversationParts,
        },
      ],
      generationConfig: {
        temperature,
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Google Gemini request failed: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
}

/**
 * Safely parses a JSON string if the value is a string that looks like JSON.
 * Returns the parsed object if successful, otherwise returns the original value.
 */
function tryParseJson(value: unknown): unknown {
  if (typeof value === "string" && value.trim().startsWith("{")) {
    try {
      return JSON.parse(value);
    } catch (e) {
      // If parsing fails, return the original string
      return value;
    }
  }
  return value;
}

function replaceTemplates(template: unknown, input: unknown): string {
  // Handle non-string values safely
  if (template === null || template === undefined) {
    return "";
  }
  
  // Convert to string if not already
  const templateStr = typeof template === "string" ? template : String(template);
  
  if (!templateStr) return "";

  console.log(`[TEMPLATE] Replacing templates in: "${templateStr}"`);
  console.log(`[TEMPLATE] Input:`, JSON.stringify(input));

  // First replace {{input.property}} patterns
  let result = templateStr.replace(/\{\{input\.([\w.]+)\}\}/g, (match, path) => {
    console.log(`[TEMPLATE] Replacing ${match} with path: ${path}`);

    if (input && typeof input === "object" && input !== null) {
      const inputObj = input as Record<string, unknown>;
      const keys = path.split('.');
      let value: unknown = inputObj;
      let found = true;

      for (const key of keys) {
        // Always try to parse JSON strings first before accessing properties
        value = tryParseJson(value);
        
        if (value && typeof value === "object" && value !== null) {
          if (key in value) {
            value = (value as Record<string, unknown>)[key];
          } else {
            console.log(`[TEMPLATE] Key "${key}" not found in object:`, Object.keys(value));
            found = false;
            break;
          }
        } else {
          console.log(`[TEMPLATE] Value is not an object after parsing. Type: ${typeof value}, Value:`, value);
          found = false;
          break;
        }
      }

      // Special handling for executed_at: fallback to _timestamp if not found
      if (!found && path === "executed_at") {
        const timestampValue = inputObj._timestamp;
        if (timestampValue !== undefined) {
          console.log(`[TEMPLATE] Using _timestamp fallback for executed_at:`, timestampValue);
          value = timestampValue;
          found = true;
        }
      }

      if (!found) {
        console.log(`[TEMPLATE] Failed to find key in path "${path}"`);
        return match; // Return original if not found
      }

      console.log(`[TEMPLATE] Extracted value for "${path}":`, value);

      // Return the value as string
      if (typeof value === "string") {
        return value;
      } else if (value === null || value === undefined) {
        return String(value);
      } else if (typeof value === "object") {
        // For objects and arrays, use JSON.stringify
        return JSON.stringify(value);
      } else {
        return String(value);
      }
    }

    return match; // Return original if input is not an object
  });

  // Then replace {{property}} patterns (direct property access without input. prefix)
  result = result.replace(/\{\{([\w.]+)\}\}/g, (match, path) => {
    // Skip if already processed as {{input.property}}
    if (match.includes('input.')) {
      return match;
    }

    console.log(`[TEMPLATE] Replacing direct property ${match} with path: ${path}`);

    if (input && typeof input === "object" && input !== null) {
      const inputObj = input as Record<string, unknown>;
      const keys = path.split('.');
      let value: unknown = inputObj;
      let found = true;

      for (const key of keys) {
        // Always try to parse JSON strings first before accessing properties
        value = tryParseJson(value);
        
        if (value && typeof value === "object" && value !== null) {
          if (key in value) {
            value = (value as Record<string, unknown>)[key];
          } else {
            console.log(`[TEMPLATE] Key "${key}" not found in object:`, Object.keys(value));
            found = false;
            break;
          }
        } else {
          console.log(`[TEMPLATE] Value is not an object after parsing. Type: ${typeof value}, Value:`, value);
          found = false;
          break;
        }
      }

      if (!found) {
        console.log(`[TEMPLATE] Failed to find direct property "${path}"`);
        return match; // Return original if not found
      }

      console.log(`[TEMPLATE] Extracted direct property value for "${path}":`, value);

      // Return the value as string
      if (typeof value === "string") {
        return value;
      } else if (value === null || value === undefined) {
        return String(value);
      } else if (typeof value === "object") {
        return JSON.stringify(value);
      } else {
        return String(value);
      }
    }

    return match; // Return original if input is not an object
  });

  // Finally replace {{input}} pattern
  result = result.replace(/\{\{input\}\}/g, () => {
    return typeof input === "string" ? input : JSON.stringify(input);
  });

  console.log(`[TEMPLATE] Final result: "${result}"`);
  return result;
}

function extractValue(expression: string, input: unknown): unknown {
  if (!expression) return input;

  // Handle {{input}} and {{input.field}} patterns
  const cleanExpr = expression.replace(/^\$\.?/, "").replace(/^input\.?/, "");

  if (!cleanExpr) return input;

  const parts = cleanExpr.split(".");
  let result: unknown = input;

  for (const part of parts) {
    // Check if result is a JSON string and parse it first
    result = tryParseJson(result);

    if (result && typeof result === "object") {
      // Handle array indexing like items[0]
      const arrayMatch = part.match(/^(\w+)\[(\d+)\]$/);
      if (arrayMatch) {
        const [, key, index] = arrayMatch;
        const arr = (result as Record<string, unknown>)[key];
        if (Array.isArray(arr)) {
          result = arr[parseInt(index, 10)];
        } else {
          result = undefined;
        }
      } else {
        result = (result as Record<string, unknown>)[part];
      }
    } else {
      return undefined;
    }
  }

  return result;
}

function evaluateCondition(condition: string, input: unknown): boolean {
  try {
    if (!condition || !condition.trim()) {
      console.error("Empty condition provided");
      return false;
    }

    console.log(`[CONDITION] Starting evaluation`);
    console.log(`[CONDITION] Original condition: "${condition}"`);
    console.log(`[CONDITION] Input:`, JSON.stringify(input));

    // First, replace template variables with actual values
    // IMPORTANT: Replace {{input.property}} FIRST, then {{input}}
    let sanitized = condition.trim();

    // Replace {{input.property}} with actual values FIRST
    sanitized = sanitized.replace(/\{\{input\.([\w.]+)\}\}/g, (match, path) => {
      console.log(`[CONDITION] Replacing ${match} with path: ${path}`);
      if (input && typeof input === "object" && input !== null) {
        const inputObj = input as Record<string, unknown>;
        const keys = path.split('.');
        let value: unknown = inputObj;

        for (const key of keys) {
          // Always try to parse JSON strings first before accessing properties
          value = tryParseJson(value);

          if (value && typeof value === "object" && value !== null && key in value) {
            value = (value as Record<string, unknown>)[key];
          } else {
            console.log(`[CONDITION] Failed to find key "${key}" in path "${path}"`);
            console.log(`[CONDITION] Current value:`, value, `(type: ${typeof value})`);
            return "undefined";
          }
        }

        console.log(`[CONDITION] Extracted value for "${path}":`, value, `(type: ${typeof value})`);

        // Return properly formatted value for JavaScript evaluation
        if (typeof value === "string") {
          return `"${value.replace(/"/g, '\\"')}"`;
        } else if (value === null) {
          return "null";
        } else if (value === undefined) {
          return "undefined";
        } else if (typeof value === "boolean") {
          return String(value);
        } else {
          return String(value);
        }
      }
      console.log(`[CONDITION] Input is not an object, returning undefined`);
      return "undefined";
    });

    // Then replace {{input}} with the full input object (only if not already replaced)
    sanitized = sanitized.replace(/\{\{input\}\}/g, () => {
      return JSON.stringify(input);
    });

    console.log(`[CONDITION] Sanitized condition: "${sanitized}"`);

    // Evaluate the condition
    const fn = new Function(`return ${sanitized};`);
    const result = fn();
    const boolResult = Boolean(result);

    console.log(`[CONDITION] Evaluation result: ${result} -> ${boolResult}`);
    return boolResult;
  } catch (error) {
    console.error("[CONDITION] Evaluation error:", error);
    console.error("[CONDITION] Condition was:", condition);
    console.error("[CONDITION] Input was:", JSON.stringify(input));
    if (error instanceof Error) {
      console.error("[CONDITION] Error message:", error.message);
      console.error("[CONDITION] Error stack:", error.stack);
    }
    return false;
  }
}
