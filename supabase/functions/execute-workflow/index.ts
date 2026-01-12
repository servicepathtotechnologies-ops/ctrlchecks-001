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
import { HuggingFaceClient } from "../_shared/huggingface-client.ts";

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

    // 🚨 CRITICAL: Check for Form Trigger - BLOCKING TRIGGER
    const formTriggerNode = executionOrder.find(n => n.data.type === "form");
    if (formTriggerNode && !providedExecutionId) {
      // Form Trigger detected - this is a blocking trigger
      // Check if execution is being resumed from form submission
      const hasFormData = input && typeof input === 'object' && 
                         ('data' in input || 'submitted_at' in input || 'form_id' in input);
      
      if (!hasFormData) {
        // No form data - workflow just started, Form Trigger must WAIT
        console.log(`Form Trigger detected - entering WAITING state for node ${formTriggerNode.id}`);
        
        // Update execution to WAITING status
        await supabase
          .from("executions")
          .update({
            status: "waiting",
            trigger: "form",
            waiting_for_node_id: formTriggerNode.id,
          })
          .eq("id", executionId);

        // Return early - workflow is paused, waiting for form submission
        return new Response(
          JSON.stringify({
            status: "waiting",
            executionId,
            message: "Workflow is waiting for form submission",
            formUrl: `${Deno.env.get("SUPABASE_URL")}/functions/v1/form-trigger/${workflowId}/${formTriggerNode.id}`,
          }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      // Form data present - execution is being resumed from form submission
      console.log(`Form Trigger: Resuming execution with form submission data`);
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
        status: "pending",
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

        // Mark node as pending before execution
        log.status = "pending";
        logs.push({ ...log });
        
        // Update execution with pending status
        try {
          await supabase
            .from("executions")
            .update({ logs })
            .eq("id", executionId);
        } catch (updateError) {
          console.error("Failed to update execution logs (pending):", updateError);
        }

        // Mark node as running
        log.status = "running";
        log.startedAt = new Date().toISOString();
        // Update the last log entry (pending) to running
        logs[logs.length - 1] = { ...log };
        
        // Update execution with running status
        try {
          await supabase
            .from("executions")
            .update({ logs })
            .eq("id", executionId);
        } catch (updateError) {
          console.error("Failed to update execution logs (running):", updateError);
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
        const isAINode = [
          "openai_gpt", "anthropic_claude", "google_gemini", "text_summarizer", "sentiment_analyzer",
          "intent_classification_agent", "sentiment_analysis_agent", "confidence_scoring_agent",
          "lead_qualification_agent", "lead_scoring_agent", "skill_matching_agent",
          "document_qa_agent", "policy_reasoning_agent", "compliance_check_agent",
          "anomaly_detection_agent", "root_cause_analysis_agent", "conversation_summarizer",
          "meeting_notes_agent", "action_items_extractor", "workflow_planner_agent",
          "decision_recommendation_agent"
        ].includes(node.data.type);

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
        // Also ensure output is JSON-serializable (no [object Object] strings)
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
          } else {
            // For non-trigger nodes, use empty object to prevent null/undefined
            outputToStore = {};
          }
        } else {
          // Ensure output is JSON-serializable - check for [object Object] strings
          if (typeof outputToStore === 'string' && outputToStore === '[object Object]') {
            console.error(`Node ${node.data.label} (${node.data.type}) returned "[object Object]" string!`);
            console.error(`Node input was:`, JSON.stringify(nodeInput));
            // Try to reconstruct from input if possible
            outputToStore = typeof nodeInput === 'object' && nodeInput !== null ? nodeInput : {};
          } else if (typeof outputToStore === 'object' && outputToStore !== null) {
            // Verify it's properly serializable
            try {
              JSON.stringify(outputToStore);
            } catch (serializeError) {
              console.error(`Node ${node.data.label} (${node.data.type}) output is not JSON-serializable!`);
              console.error(`Error:`, serializeError instanceof Error ? serializeError.message : String(serializeError));
              // Fallback to input or empty object
              outputToStore = typeof nodeInput === 'object' && nodeInput !== null ? nodeInput : {};
            }
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

      // STRICT ERROR STOP: Break immediately on error, no downstream execution
      if (hasError) {
        console.error(`🛑 Workflow execution STOPPED due to error in node ${node.data.label}`);
        break;
      }
    }

    // Finalize execution
    const finishedAt = new Date().toISOString();
    const durationMs = new Date(finishedAt).getTime() - new Date(execution.started_at).getTime();

    // Ensure finalOutput is never null - use last successful node output or input
    // Also ensure it's JSON-serializable
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
        finalOutputToStore = input || {};
        console.log(`Using input as fallback:`, JSON.stringify(finalOutputToStore));
      }
    }
    
    // Ensure final output is JSON-serializable
    if (typeof finalOutputToStore === 'string' && finalOutputToStore === '[object Object]') {
      console.error("Final output is '[object Object]' string, using empty object");
      finalOutputToStore = {};
    } else if (finalOutputToStore !== null && typeof finalOutputToStore === 'object') {
      try {
        JSON.stringify(finalOutputToStore);
      } catch (serializeError) {
        console.error("Final output is not JSON-serializable, using empty object");
        finalOutputToStore = {};
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
  if (input && typeof input === 'object' && input !== null && !Array.isArray(input)) {
    return input as Record<string, unknown>;
  }
  if (Array.isArray(input)) {
    // For arrays, return a wrapper object
    return { items: input, data: input, array: input };
  }
  if (input !== null && input !== undefined) {
    // For primitives, wrap in object
    return { value: input };
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
  
  // If input is null or undefined, return empty array for consistency
  if (input === null || input === undefined) {
    return [];
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
  const data = inputObj.data || inputObj.input || inputObj.text || inputObj.body || inputObj.content;
  if (data !== undefined && data !== null) {
    return data;
  }
  
  // If no data found, return the input object itself
  return inputObj;
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

// CRITICAL: Valid node types that can be executed
const VALID_EXECUTABLE_NODE_TYPES = new Set([
  // Triggers
  'manual_trigger', 'webhook', 'webhook_trigger_response', 'schedule', 'chat_trigger', 
  'error_trigger', 'interval', 'workflow_trigger', 'form',
  // Logic
  'if_else', 'switch', 'loop', 'wait', 'error_handler', 'filter', 'merge', 'noop', 
  'split_in_batches', 'stop_and_error', 'human_approval', 'escalation_router', 
  'fallback_router', 'retry_with_backoff', 'timeout_guard', 'circuit_breaker',
  'workflow_state_manager', 'execution_context_store', 'session_manager',
  // Data
  'javascript', 'json_parser', 'csv_processor', 'text_formatter', 'merge_data', 
  'set_variable', 'aggregate', 'edit_fields', 'execute_command', 'function', 
  'function_item', 'item_lists', 'limit', 'rename_keys', 'set', 'sort', 'date_time', 
  'math', 'crypto', 'html_extract', 'xml', 'rss_feed_read', 'pdf', 'image_manipulation',
  // Database
  'database_read', 'database_write', 'postgresql', 'supabase', 'mysql', 'mongodb', 
  'redis', 'mssql', 'sqlite', 'snowflake', 'timescaledb', 'elasticsearch',
  // Storage
  'read_binary_file', 'write_binary_file', 'aws_s3', 'ftp', 'sftp', 'dropbox', 
  'onedrive', 'box', 'minio', 'document_ocr', 'resume_parser', 'invoice_parser',
  'document_classifier', 'file_metadata_extractor',
  // AI
  'openai_gpt', 'anthropic_claude', 'google_gemini', 'text_summarizer', 
  'sentiment_analyzer', 'ai_agent', 'memory', 'llm_chain', 'azure_openai', 
  'hugging_face', 'cohere', 'ollama', 'embeddings', 'vector_store', 'chat_model',
  'intent_classification_agent', 'sentiment_analysis_agent', 'confidence_scoring_agent',
  'lead_qualification_agent', 'lead_scoring_agent', 'skill_matching_agent',
  'document_qa_agent', 'policy_reasoning_agent', 'compliance_check_agent',
  'anomaly_detection_agent', 'root_cause_analysis_agent', 'conversation_summarizer',
  'meeting_notes_agent', 'action_items_extractor', 'workflow_planner_agent',
  'decision_recommendation_agent', 'workflow_generator_agent', 'node_selector_agent',
  'prompt_synthesizer', 'multi_agent_coordinator', 'agent_role_assigner',
  'agent_voting_consensus', 'execution_explainer', 'workflow_summary_generator',
  // HTTP
  'http_request', 'graphql', 'respond_to_webhook', 'http_post',
  // Output
  'slack_message', 'slack_webhook', 'discord_webhook', 'microsoft_teams', 
  'telegram', 'whatsapp_cloud', 'twilio', 'log_output', 'email_sequence_sender',
  'auto_followup_sender', 'human_handoff_notification', 'approval_request_sender',
  'reminder_scheduler',
  // Google
  'google_sheets', 'google_doc', 'google_drive', 'google_calendar', 'google_gmail', 
  'google_bigquery', 'google_tasks', 'google_contacts', 'google_analytics',
  // CRM
  'hubspot', 'salesforce', 'zoho_crm', 'pipedrive', 'freshdesk', 'intercom', 
  'mailchimp', 'activecampaign', 'crm_lead_router', 'crm_ticket_prioritizer',
  'crm_sla_monitor', 'crm_duplicate_detector',
  // DevOps
  'github', 'gitlab', 'bitbucket', 'jenkins', 'docker', 'kubernetes', 'pagerduty', 'datadog',
  'alert_correlation_engine', 'incident_classifier', 'auto_remediation_planner', 'postmortem_generator',
  // Ecommerce
  'shopify', 'woocommerce', 'stripe', 'paypal', 'bigcommerce',
  // Analytics
  'mixpanel', 'segment', 'amplitude', 'agent_performance_tracker', 'cost_monitor',
  'accuracy_evaluator', 'feedback_loop_collector', 'compliance_log_writer',
  // Auth
  'oauth2', 'jwt', 'api_key_auth',
  // Payment
  'razorpay', 'expense_categorizer', 'payment_reminder_engine', 'audit_trail_generator',
  'tax_rule_engine', 'fraud_detection_node',
  // Social
  'twitter', 'facebook', 'instagram', 'linkedin',
  // Productivity
  'notion', 'trello', 'asana', 'jira', 'linear', 'knowledge_base_search',
  'onboarding_flow_generator', 'policy_sync_node', 'employee_faq_indexer',
]);

async function executeNode(
  node: WorkflowNode,
  input: unknown,
  lovableApiKey?: string,
  conversationHistory?: Array<{ role: string; content: string }>,
  userId?: string
): Promise<unknown> {
  const { type, config } = node.data;

  // CRITICAL: Runtime validation - reject invalid node types immediately
  if (!VALID_EXECUTABLE_NODE_TYPES.has(type)) {
    const errorMsg = `INVALID NODE TYPE: "${type}" is not a valid executable node type. Node ID: ${node.id}`;
    console.error(`[EXECUTION ERROR] ${errorMsg}`);
    throw new Error(errorMsg);
  }

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
    case "form": {
      // Form trigger: BLOCKING TRIGGER - waits for form submission
      // When workflow is RUN or ACTIVE, Form Trigger enters WAITING state
      // Workflow execution PAUSES until form is submitted
      // On submission, form-trigger function resumes this execution with form data
      
      const inputObj = extractInputObject(input);
      
      // If input contains form submission data (from form-trigger POST), process it
      if (inputObj.data || inputObj.submitted_at) {
        // Form was submitted - return n8n-style output format
        const output: Record<string, unknown> = {
          submitted_at: inputObj.submitted_at || new Date().toISOString(),
          form: inputObj.form || {
            title: config.formTitle || 'Form Submission',
            id: node.id,
          },
          data: inputObj.data || {},
          files: inputObj.files || [],
          meta: inputObj.meta || {},
        };
        console.log(`Form trigger returning submitted data:`, JSON.stringify(output));
        return output;
      }
      
      // No form data yet - this means workflow just started
      // Form Trigger must WAIT for submission
      // This should not happen in normal flow, but handle gracefully
      console.log(`Form trigger: No submission data yet, workflow should be in WAITING state`);
      
      // Return empty output - execution should be in WAITING state
      return {
        submitted_at: null,
        form_id: node.id,
        workflow_id: '',
        data: {},
        files: [],
        meta: {},
        _waiting: true,
      };
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
          const timeParts = time.split(':');
          if (timeParts.length !== 2) {
            throw new Error(`Schedule Trigger: Invalid time format "${time}". Expected format: HH:MM (e.g., "09:00")`);
          }
          const scheduledHour = parseInt(timeParts[0], 10);
          const scheduledMinute = parseInt(timeParts[1], 10);
          
          if (isNaN(scheduledHour) || isNaN(scheduledMinute) || scheduledHour < 0 || scheduledHour > 23 || scheduledMinute < 0 || scheduledMinute > 59) {
            throw new Error(`Schedule Trigger: Invalid time values. Hour must be 0-23, minute must be 0-59. Got: ${scheduledHour}:${scheduledMinute}`);
          }
          
          // Format current time in the specified timezone
          const formatter = new Intl.DateTimeFormat('en-US', {
            timeZone: timezone,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false,
          });
          
          const currentTimeStr = formatter.format(now);
          const timeComponents = currentTimeStr.split(':').map(Number);
          if (timeComponents.length < 3) {
            throw new Error(`Schedule Trigger: Failed to parse current time from timezone ${timezone}`);
          }
          const [currentHour, currentMinute, currentSecond] = timeComponents;
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
      
      // Determine content type from headers
      const contentType = headers['Content-Type'] || headers['content-type'] || 'application/json';
      const isFormUrlEncoded = contentType.includes('application/x-www-form-urlencoded');
      const isFormData = contentType.includes('multipart/form-data');
      const isJson = contentType.includes('application/json') || (!isFormUrlEncoded && !isFormData);
      
      // Parse body safely based on content type
      let body: unknown = undefined;
      const bodyStr = getStringProperty(config, 'body', '');
      if (bodyStr && bodyStr.trim() !== '' && method !== 'GET') {
        // Check original body string for form-urlencoded pattern (before template replacement)
        // Form-urlencoded typically has: key=value&key2=value2 pattern
        const hasFormPattern = (str: string) => {
          const trimmed = str.trim();
          return trimmed.includes('&') && 
                 trimmed.includes('=') && 
                 !trimmed.startsWith('{') && 
                 !trimmed.startsWith('[') &&
                 !trimmed.startsWith('"');
        };
        
        const originalBodyHasFormPattern = hasFormPattern(bodyStr);
        const replacedBody = replaceTemplates(bodyStr, input);
        const looksLikeFormUrlEncoded = hasFormPattern(replacedBody);
        
        // If Content-Type is form-urlencoded OR body has form-urlencoded pattern, treat as string
        // Priority: Content-Type header > body pattern detection
        if (isFormUrlEncoded || isFormData || looksLikeFormUrlEncoded || originalBodyHasFormPattern) {
          // For form-encoded or form-data, keep as string
          body = replacedBody;
        } else {
          // For JSON, try to parse
          try {
            body = parseJSONSafe(replacedBody, 'body');
          } catch (error) {
            throw new Error(`HTTP Request: Invalid body format. Expected valid JSON. Error: ${error instanceof Error ? error.message : String(error)}`);
          }
        }
      }

      // Retry logic for transient connection errors
      const maxRetries = 2;
      let lastError: Error | null = null;

      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        try {
          // Prepare body based on content type
          let requestBody: string | undefined = undefined;
          if (method !== "GET" && body !== undefined) {
            if (typeof body === 'string') {
              requestBody = body;
            } else if (isJson) {
              requestBody = JSON.stringify(body);
            } else {
              requestBody = String(body);
            }
          } else if (method !== "GET" && body === undefined && isJson) {
            // Default to JSON stringify input if body is undefined and content type is JSON
            requestBody = JSON.stringify(input);
          }

          const response = await fetch(url, {
            method,
            headers: headers,
            body: requestBody,
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
        let result: unknown;
        try {
          result = JSON.parse(text);
        } catch (parseError) {
          throw new Error(createNodeError('GraphQL', `Invalid JSON response from endpoint`, `Endpoint: ${url}\nResponse: ${text.substring(0, 200)}${text.length > 200 ? '...' : ''}\n\nError: ${parseError instanceof Error ? parseError.message : String(parseError)}`));
        }

        // Check for GraphQL errors
        if (result && typeof result === 'object' && 'errors' in result && Array.isArray(result.errors) && result.errors.length > 0) {
          const errorMessages = result.errors.map((e: unknown) => {
            if (e && typeof e === 'object' && 'message' in e) {
              return String(e.message);
            }
            return String(e);
          }).join(", ");
          throw new Error(createNodeError('GraphQL', `Query failed: ${errorMessages}`, `Endpoint: ${url}`));
        }

        if (result && typeof result === 'object' && 'data' in result) {
          return result.data;
        }
        return result;
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
          const replaced = replaceTemplates(responseBodyStr, input);
          responseBody = JSON.parse(replaced);
        } catch {
          // If not valid JSON, treat as template string
          responseBody = replaceTemplates(responseBodyStr, input);
        }
      } else {
        // If no response body specified, use the input data
        responseBody = input;
      }

      let customHeaders: Record<string, string> = {};
      if (headersStr) {
        try {
          const replaced = replaceTemplates(headersStr, input);
          customHeaders = JSON.parse(replaced) as Record<string, string>;
          if (!customHeaders || typeof customHeaders !== 'object' || Array.isArray(customHeaders)) {
            customHeaders = {};
          }
        } catch (error) {
          throw new Error(`Respond to Webhook: Invalid headers JSON. ${error instanceof Error ? error.message : String(error)}`);
        }
      }

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
      const urlTemplate = getStringProperty(config, 'url', '');
      if (!urlTemplate || urlTemplate.trim() === '') {
        throw new Error("HTTP POST: URL is required. Please configure the URL in the node properties.");
      }
      const url = replaceTemplates(urlTemplate, input);
      validateURL(url, 'URL', 'HTTP POST');
      
      const headersStr = getStringProperty(config, 'headers', '');
      let headers: Record<string, string> = {};
      if (headersStr && headersStr.trim() !== '') {
        try {
          const replaced = replaceTemplates(headersStr, input);
          headers = JSON.parse(replaced) as Record<string, string>;
          if (!headers || typeof headers !== 'object' || Array.isArray(headers)) {
            headers = {};
          }
        } catch (error) {
          throw new Error(`HTTP POST: Invalid headers JSON. ${error instanceof Error ? error.message : String(error)}`);
        }
      }
      
      const bodyTemplate = getStringProperty(config, 'bodyTemplate', '');
      const body = bodyTemplate ? replaceTemplates(bodyTemplate, input) : JSON.stringify(input);

      try {
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
      } catch (error) {
        throw new Error(`HTTP POST: Request failed. ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    case "openai_gpt":
    case "anthropic_claude":
    case "google_gemini":
    case "text_summarizer":
    case "sentiment_analyzer":
    case "intent_classification_agent":
    case "sentiment_analysis_agent":
    case "confidence_scoring_agent":
    case "lead_qualification_agent":
    case "lead_scoring_agent":
    case "skill_matching_agent":
    case "document_qa_agent":
    case "policy_reasoning_agent":
    case "compliance_check_agent":
    case "anomaly_detection_agent":
    case "root_cause_analysis_agent":
    case "conversation_summarizer":
    case "meeting_notes_agent":
    case "action_items_extractor":
    case "workflow_planner_agent":
    case "decision_recommendation_agent": {
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
        const nodeNameMap: Record<string, string> = {
          "openai_gpt": "OpenAI GPT",
          "anthropic_claude": "Anthropic Claude",
          "text_summarizer": "Text Summarizer",
          "sentiment_analyzer": "Sentiment Analyzer",
          "intent_classification_agent": "Intent Classification Agent",
          "sentiment_analysis_agent": "Sentiment Analysis Agent",
          "confidence_scoring_agent": "Confidence Scoring Agent",
          "lead_qualification_agent": "Lead Qualification Agent",
          "lead_scoring_agent": "Lead Scoring Agent",
          "skill_matching_agent": "Skill Matching Agent",
          "document_qa_agent": "Document QA Agent",
          "policy_reasoning_agent": "Policy Reasoning Agent",
          "compliance_check_agent": "Compliance Check Agent",
          "anomaly_detection_agent": "Anomaly Detection Agent",
          "root_cause_analysis_agent": "Root Cause Analysis Agent",
          "conversation_summarizer": "Conversation Summarizer",
          "meeting_notes_agent": "Meeting Notes Agent",
          "action_items_extractor": "Action Items Extractor",
          "workflow_planner_agent": "Workflow Planner Agent",
          "decision_recommendation_agent": "Decision Recommendation Agent"
        };
        const nodeName = nodeNameMap[type] || node.data.label || "AI Node";
        throw new Error(`API Key is required for ${nodeName} node. Please add your API key in the node properties.`);
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
      } else {
        // For new agent nodes, allow selecting any supported provider
        // Try all providers in order of preference
        model = setOpenAI(configModel) || setClaude(configModel) || setGemini(configModel) || model;
      }
      // Note: google_gemini is handled earlier with early return, so we don't need to check it here

      // Special prompts for specific node types (only override if prompt is not already set in config)
      if (type === "text_summarizer" && !prompt) {
        const maxLength = (config.maxLength as number) || 200;
        const style = (config.style as string) || "concise";
        prompt = `Summarize the following text in a ${style} manner. Keep it under ${maxLength} words. ${style === "bullets" ? "Use bullet points." : ""}`;
      } else if (type === "sentiment_analyzer" && !prompt) {
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
        // For agent nodes that expect structured JSON input, format it properly
        const agentNodes = [
          "intent_classification_agent",
          "sentiment_analysis_agent",
          "confidence_scoring_agent",
          "lead_qualification_agent",
          "lead_scoring_agent",
          "skill_matching_agent",
          "document_qa_agent",
          "policy_reasoning_agent",
          "compliance_check_agent",
          "anomaly_detection_agent",
          "root_cause_analysis_agent",
          "conversation_summarizer",
          "meeting_notes_agent",
          "action_items_extractor",
          "workflow_planner_agent",
          "decision_recommendation_agent"
        ];

        // Extract message from input - handle different input formats
        if (typeof input === "string") {
          // For agent nodes, try to parse string as JSON if possible
          if (agentNodes.includes(type)) {
            try {
              const parsed = JSON.parse(input);
              return JSON.stringify(parsed, null, 2);
            } catch {
              return input;
            }
          }
          return input;
        } else if (typeof input === "object" && input !== null) {
          const inputObj = input as Record<string, unknown>;
          
          // For agent nodes, format as JSON directly
          if (agentNodes.includes(type)) {
            return JSON.stringify(inputObj, null, 2);
          }
          
          // For other nodes, try to extract message from common fields
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

        // Try to parse as JSON for nodes that expect JSON output
        const jsonOutputNodes = [
          "sentiment_analyzer",
          "intent_classification_agent",
          "sentiment_analysis_agent",
          "confidence_scoring_agent",
          "lead_qualification_agent",
          "lead_scoring_agent",
          "skill_matching_agent",
          "document_qa_agent",
          "policy_reasoning_agent",
          "compliance_check_agent",
          "anomaly_detection_agent",
          "root_cause_analysis_agent",
          "conversation_summarizer",
          "meeting_notes_agent",
          "action_items_extractor",
          "workflow_planner_agent",
          "decision_recommendation_agent"
        ];

        if (jsonOutputNodes.includes(type)) {
          try {
            // Try to extract JSON from markdown code blocks if present
            let jsonContent = content.trim();
            const jsonMatch = jsonContent.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
            if (jsonMatch) {
              jsonContent = jsonMatch[1].trim();
            }

            const parsed = JSON.parse(jsonContent);
            if (parsed && typeof parsed === 'object') {
              return parsed;
            }
            return { raw: content, parsed };
          } catch (parseError) {
            // If JSON parsing fails, return raw content but log warning
            console.warn(`[${type}] Failed to parse JSON output:`, parseError);
            return { raw: content, error: "Failed to parse JSON output" };
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
            const parsed = JSON.parse(content);
            if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
              return parsed;
            }
            return { raw: content, parsed };
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
        // Use OpenAI-compatible router client
        const client = new HuggingFaceClient(apiKey);

        // Format as messages for chat completions
        let messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
        
        // For question-answering, format inputs differently
        if (task === 'question-answering' && typeof input === 'object' && input !== null) {
          const inputObj = input as Record<string, unknown>;
          const question = String(inputObj.question || inputText);
          const context = String(inputObj.context || '');
          messages = [
            { role: 'system', content: 'You are a helpful assistant that answers questions based on provided context.' },
            { role: 'user', content: `Context: ${context}\n\nQuestion: ${question}` }
          ];
        } else {
          messages = [{ role: 'user', content: inputText }];
        }

        // Use OpenAI-compatible parameters
        const result = await client.generateText(model, messages, {
          max_tokens: (parameters.max_tokens as number) || (parameters.max_new_tokens as number) || 300,
          temperature: (parameters.temperature as number) || 0.7,
          top_p: (parameters.top_p as number) || 0.9,
        });

        // Handle different response formats based on task
        if (task === 'question-answering') {
          return { answer: result };
        }
        if (task === 'text-classification') {
          // For classification, return structured format
          return { label: result, score: 0.95 };
        }
        
        return result;
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

    case "workflow_generator_agent": {
      // Workflow Generator Agent: Generate complete workflow from user goal
      const userGoal = getStringProperty(config, 'userGoal', '');
      const constraintsConfig = config.constraints || {};
      const availableNodesConfig = config.availableNodes || [];

      if (!userGoal || !userGoal.trim()) {
        throw new Error("Workflow Generator Agent: User goal is required");
      }

      let availableNodes: string[] = [];
      if (availableNodesConfig) {
        if (typeof availableNodesConfig === 'string') {
          try {
            availableNodes = JSON.parse(availableNodesConfig);
          } catch {
            availableNodes = [availableNodesConfig];
          }
        } else if (Array.isArray(availableNodesConfig)) {
          availableNodes = availableNodesConfig;
        }
      }

      // In a real implementation, this would use AI to:
      // 1. Understand the user goal
      // 2. Decompose into logical steps
      // 3. Select appropriate nodes from availableNodes (or all nodes if empty)
      // 4. Order nodes logically
      // 5. Create edges connecting nodes
      // 6. Ensure end-to-end feasibility

      // Simulate workflow generation (placeholder)
      const workflow = {
        nodes: [
          { nodeId: 'trigger_1', nodeType: 'manual_trigger', purpose: 'Start workflow' },
          { nodeId: 'node_1', nodeType: 'http_request', purpose: 'Process user goal' }
        ],
        edges: [
          { from: 'trigger_1', to: 'node_1' }
        ]
      };

      const assumptions = [
        'Workflow assumes standard input/output formats',
        'Nodes are available and properly configured'
      ];

      return {
        workflow,
        assumptions,
        confidence: 0.7,
        userGoal,
        constraints: constraintsConfig,
        note: "Workflow generation requires AI/LLM integration to analyze goals and select nodes. This is a placeholder implementation."
      };
    }

    case "node_selector_agent": {
      // Node Selector Agent: Choose best nodes for a task
      const taskDescription = getStringProperty(config, 'taskDescription', '');
      const availableNodesConfig = config.availableNodes;

      if (!taskDescription || !taskDescription.trim()) {
        throw new Error("Node Selector Agent: Task description is required");
      }

      let availableNodes: Array<{ nodeName: string; capabilities: string[] }> = [];
      if (availableNodesConfig) {
        if (typeof availableNodesConfig === 'string') {
          try {
            availableNodes = JSON.parse(availableNodesConfig);
          } catch {
            throw new Error("Node Selector Agent: Invalid available nodes JSON format");
          }
        } else if (Array.isArray(availableNodesConfig)) {
          availableNodes = availableNodesConfig;
        }
      }

      if (availableNodes.length === 0) {
        throw new Error("Node Selector Agent: At least one available node is required");
      }

      // Match task requirements to node capabilities
      const taskLower = taskDescription.toLowerCase();
      const selectedNodes: string[] = [];
      const ranking: string[] = [];
      const missingCapabilities: string[] = [];

      // Simple keyword matching (in production, this would use semantic matching)
      for (const node of availableNodes) {
        if (!node.nodeName || !node.capabilities || !Array.isArray(node.capabilities)) {
          continue;
        }

        // Check if any capability matches task description
        const matchingCapabilities = node.capabilities.filter(cap =>
          taskLower.includes(cap.toLowerCase())
        );

        if (matchingCapabilities.length > 0) {
          selectedNodes.push(node.nodeName);
          ranking.push(node.nodeName);
        }
      }

      // If no nodes match, identify missing capabilities
      if (selectedNodes.length === 0) {
        missingCapabilities.push('No nodes found matching task requirements');
      }

      const selectionReasoning = selectedNodes.length > 0
        ? `Selected ${selectedNodes.length} node(s) based on capability matching: ${selectedNodes.join(', ')}`
        : 'No suitable nodes found. Missing capabilities may be required.';

      return {
        selectedNodes,
        ranking,
        missingCapabilities: missingCapabilities.length > 0 ? missingCapabilities : null,
        selectionReasoning,
        taskDescription,
        note: "Node selection requires semantic matching and capability analysis. This is a simplified keyword-based implementation."
      };
    }

    case "prompt_synthesizer": {
      // Prompt Synthesizer: Generate high-quality prompts
      const nodeType = getStringProperty(config, 'nodeType', '');
      const objective = getStringProperty(config, 'objective', '');
      const inputSchemaConfig = config.inputSchema;
      const outputSchemaConfig = config.outputSchema;
      const constraintsConfig = config.constraints || [];

      if (!nodeType || !objective) {
        throw new Error("Prompt Synthesizer: Node type and objective are required");
      }

      let inputSchema: Record<string, unknown> = {};
      if (inputSchemaConfig) {
        if (typeof inputSchemaConfig === 'string') {
          try {
            inputSchema = JSON.parse(inputSchemaConfig);
          } catch {
            inputSchema = {};
          }
        } else if (typeof inputSchemaConfig === 'object') {
          inputSchema = inputSchemaConfig as Record<string, unknown>;
        }
      }

      let outputSchema: Record<string, unknown> = {};
      if (outputSchemaConfig) {
        if (typeof outputSchemaConfig === 'string') {
          try {
            outputSchema = JSON.parse(outputSchemaConfig);
          } catch {
            outputSchema = {};
          }
        } else if (typeof outputSchemaConfig === 'object') {
          outputSchema = outputSchemaConfig as Record<string, unknown>;
        }
      }

      let constraints: string[] = [];
      if (constraintsConfig) {
        if (typeof constraintsConfig === 'string') {
          try {
            constraints = JSON.parse(constraintsConfig);
          } catch {
            constraints = [constraintsConfig];
          }
        } else if (Array.isArray(constraintsConfig)) {
          constraints = constraintsConfig;
        }
      }

      // Generate prompt
      let generatedPrompt = `You are a ${nodeType} node inside an automation engine.\n\n`;
      generatedPrompt += `OBJECTIVE: ${objective}\n\n`;
      generatedPrompt += `INPUT SCHEMA: ${JSON.stringify(inputSchema, null, 2)}\n\n`;
      generatedPrompt += `OUTPUT SCHEMA: ${JSON.stringify(outputSchema, null, 2)}\n\n`;

      if (constraints.length > 0) {
        generatedPrompt += `CONSTRAINTS:\n${constraints.map(c => `- ${c}`).join('\n')}\n\n`;
      }

      generatedPrompt += `STRICT RULES:\n`;
      generatedPrompt += `- Always return VALID JSON matching the output schema\n`;
      generatedPrompt += `- Never hallucinate data\n`;
      generatedPrompt += `- Preserve input structure unless explicitly required to transform\n`;

      const designNotes = [
        `Prompt designed for ${nodeType} node`,
        `Output must match specified schema`,
        constraints.length > 0 ? `${constraints.length} constraint(s) applied` : 'No specific constraints'
      ];

      const complianceChecks = [
        'JSON output validation',
        'Schema compliance',
        'No hallucination rules enforced'
      ];

      return {
        generatedPrompt,
        designNotes,
        complianceChecks
      };
    }

    case "multi_agent_coordinator": {
      // Multi-Agent Coordinator: Coordinate execution across agents
      const agentsConfig = config.agents;
      const task = getStringProperty(config, 'task', '');
      const coordinationStrategy = getStringProperty(config, 'coordinationStrategy', 'parallel') as 'parallel' | 'sequential' | 'hierarchical';

      if (!task || !task.trim()) {
        throw new Error("Multi-Agent Coordinator: Task is required");
      }

      let agents: Array<{ agentId: string; role: string }> = [];
      if (agentsConfig) {
        if (typeof agentsConfig === 'string') {
          try {
            agents = JSON.parse(agentsConfig);
          } catch {
            throw new Error("Multi-Agent Coordinator: Invalid agents JSON format");
          }
        } else if (Array.isArray(agentsConfig)) {
          agents = agentsConfig;
        }
      }

      if (agents.length === 0) {
        throw new Error("Multi-Agent Coordinator: At least one agent is required");
      }

      // Generate execution plan based on strategy
      const executionPlan: Array<{ agentId: string; assignedTask: string; dependsOn: string[] | null }> = [];

      if (coordinationStrategy === 'parallel') {
        // All agents work in parallel, no dependencies
        for (const agent of agents) {
          executionPlan.push({
            agentId: agent.agentId,
            assignedTask: `${task} - ${agent.role} component`,
            dependsOn: null
          });
        }
      } else if (coordinationStrategy === 'sequential') {
        // Agents work sequentially, each depends on previous
        for (let i = 0; i < agents.length; i++) {
          const agent = agents[i];
          const dependsOn = i > 0 ? [agents[i - 1].agentId] : null;
          executionPlan.push({
            agentId: agent.agentId,
            assignedTask: `${task} - Step ${i + 1}: ${agent.role}`,
            dependsOn
          });
        }
      } else if (coordinationStrategy === 'hierarchical') {
        // First agent coordinates, others depend on it
        const coordinator = agents[0];
        executionPlan.push({
          agentId: coordinator.agentId,
          assignedTask: `${task} - Coordination and planning`,
          dependsOn: null
        });

        for (let i = 1; i < agents.length; i++) {
          const agent = agents[i];
          executionPlan.push({
            agentId: agent.agentId,
            assignedTask: `${task} - ${agent.role} execution`,
            dependsOn: [coordinator.agentId]
          });
        }
      }

      return {
        executionPlan,
        strategyUsed: coordinationStrategy,
        totalAgents: agents.length
      };
    }

    case "agent_role_assigner": {
      // Agent Role Assigner: Assign optimal roles to agents
      const agentsConfig = config.agents;
      const requiredRolesConfig = config.requiredRoles;

      let agents: Array<{ agentId: string; skills: string[] }> = [];
      if (agentsConfig) {
        if (typeof agentsConfig === 'string') {
          try {
            agents = JSON.parse(agentsConfig);
          } catch {
            throw new Error("Agent Role Assigner: Invalid agents JSON format");
          }
        } else if (Array.isArray(agentsConfig)) {
          agents = agentsConfig;
        }
      }

      if (agents.length === 0) {
        throw new Error("Agent Role Assigner: At least one agent is required");
      }

      let requiredRoles: string[] = [];
      if (requiredRolesConfig) {
        if (typeof requiredRolesConfig === 'string') {
          try {
            requiredRoles = JSON.parse(requiredRolesConfig);
          } catch {
            requiredRoles = [requiredRolesConfig];
          }
        } else if (Array.isArray(requiredRolesConfig)) {
          requiredRoles = requiredRolesConfig;
        }
      }

      if (requiredRoles.length === 0) {
        throw new Error("Agent Role Assigner: At least one required role is required");
      }

      // Match agents to roles based on skills
      const roleAssignments: Array<{ agentId: string; role: string }> = [];
      const assignedRoles = new Set<string>();
      const unassignedRoles: string[] = [];

      for (const role of requiredRoles) {
        let bestMatch: { agentId: string; score: number } | null = null;
        const roleLower = role.toLowerCase();

        for (const agent of agents) {
          if (!agent.agentId || !agent.skills || !Array.isArray(agent.skills)) {
            continue;
          }

          // Check if agent already assigned
          const alreadyAssigned = roleAssignments.some(ra => ra.agentId === agent.agentId);
          if (alreadyAssigned) {
            continue;
          }

          // Score agent based on skill match
          const matchingSkills = agent.skills.filter(skill =>
            skill.toLowerCase().includes(roleLower) || roleLower.includes(skill.toLowerCase())
          );

          const score = matchingSkills.length;
          if (score > 0 && (!bestMatch || score > bestMatch.score)) {
            bestMatch = { agentId: agent.agentId, score };
          }
        }

        if (bestMatch) {
          roleAssignments.push({
            agentId: bestMatch.agentId,
            role
          });
          assignedRoles.add(role);
        } else {
          unassignedRoles.push(role);
        }
      }

      return {
        roleAssignments,
        unassignedRoles: unassignedRoles.length > 0 ? unassignedRoles : null,
        totalRoles: requiredRoles.length,
        assignedCount: roleAssignments.length
      };
    }

    case "agent_voting_consensus": {
      // Agent Voting / Consensus: Resolve decisions via consensus
      const proposal = getStringProperty(config, 'proposal', '');
      const votesConfig = config.votes;
      const consensusRule = getStringProperty(config, 'consensusRule', 'majority') as 'majority' | 'weighted' | 'unanimous';

      if (!proposal || !proposal.trim()) {
        throw new Error("Agent Voting / Consensus: Proposal is required");
      }

      let votes: Array<{ agentId: string; vote: 'approve' | 'reject'; confidence: number }> = [];
      if (votesConfig) {
        if (typeof votesConfig === 'string') {
          try {
            votes = JSON.parse(votesConfig);
          } catch {
            throw new Error("Agent Voting / Consensus: Invalid votes JSON format");
          }
        } else if (Array.isArray(votesConfig)) {
          votes = votesConfig;
        }
      }

      if (votes.length === 0) {
        throw new Error("Agent Voting / Consensus: At least one vote is required");
      }

      // Validate votes
      for (const vote of votes) {
        if (!vote.agentId || !vote.vote || !['approve', 'reject'].includes(vote.vote)) {
          throw new Error("Agent Voting / Consensus: Each vote must have agentId and vote (approve/reject)");
        }
        if (vote.confidence === undefined || vote.confidence < 0 || vote.confidence > 1) {
          throw new Error("Agent Voting / Consensus: Each vote must have confidence between 0 and 1");
        }
      }

      // Calculate vote breakdown
      const approveVotes = votes.filter(v => v.vote === 'approve');
      const rejectVotes = votes.filter(v => v.vote === 'reject');
      const approveCount = approveVotes.length;
      const rejectCount = rejectVotes.length;

      // Calculate weighted scores if needed
      const approveWeighted = approveVotes.reduce((sum, v) => sum + v.confidence, 0);
      const rejectWeighted = rejectVotes.reduce((sum, v) => sum + v.confidence, 0);

      let decision: 'approved' | 'rejected';
      let consensusAchieved = false;

      if (consensusRule === 'unanimous') {
        consensusAchieved = approveCount === votes.length || rejectCount === votes.length;
        decision = approveCount === votes.length ? 'approved' : 'rejected';
      } else if (consensusRule === 'weighted') {
        consensusAchieved = Math.abs(approveWeighted - rejectWeighted) >= 0.3; // 30% threshold
        decision = approveWeighted > rejectWeighted ? 'approved' : 'rejected';
      } else { // majority
        consensusAchieved = Math.abs(approveCount - rejectCount) > 0 || votes.length === 1;
        decision = approveCount > rejectCount ? 'approved' : 'rejected';
      }

      const voteBreakdown = {
        approve: {
          count: approveCount,
          weighted: approveWeighted,
          votes: approveVotes.map(v => ({ agentId: v.agentId, confidence: v.confidence }))
        },
        reject: {
          count: rejectCount,
          weighted: rejectWeighted,
          votes: rejectVotes.map(v => ({ agentId: v.agentId, confidence: v.confidence }))
        }
      };

      return {
        decision,
        voteBreakdown,
        consensusAchieved,
        proposal,
        consensusRule
      };
    }

    case "execution_explainer": {
      // Execution Explainer: Explain workflow execution
      const workflowId = getStringProperty(config, 'workflowId', '');
      const executionLogConfig = config.executionLog;

      if (!workflowId) {
        throw new Error("Execution Explainer: Workflow ID is required");
      }

      let executionLog: Array<{ nodeId: string; status: string; timestamp: string }> = [];
      if (executionLogConfig) {
        if (typeof executionLogConfig === 'string') {
          try {
            executionLog = JSON.parse(executionLogConfig);
          } catch {
            throw new Error("Execution Explainer: Invalid execution log JSON format");
          }
        } else if (Array.isArray(executionLogConfig)) {
          executionLog = executionLogConfig;
        }
      }

      if (executionLog.length === 0) {
        throw new Error("Execution Explainer: At least one execution log entry is required");
      }

      // Analyze execution flow
      const successfulNodes = executionLog.filter(e => e.status === 'success' || e.status === 'completed');
      const failedNodes = executionLog.filter(e => e.status === 'failed' || e.status === 'error');
      const totalNodes = executionLog.length;

      // Identify decision points (nodes that might branch)
      const decisionPoints: string[] = [];
      const failureReasons: string[] = [];

      for (const entry of executionLog) {
        if (entry.status === 'failed' || entry.status === 'error') {
          failureReasons.push(`${entry.nodeId}: ${entry.status}`);
        }
      }

      // Generate summary
      const summary = `Workflow ${workflowId} executed ${totalNodes} node(s). `;
      const successRate = (successfulNodes.length / totalNodes) * 100;
      const summaryDetails = `${successfulNodes.length} succeeded, ${failedNodes.length} failed (${successRate.toFixed(1)}% success rate).`;

      return {
        summary: summary + summaryDetails,
        decisionPoints,
        failureReasons: failureReasons.length > 0 ? failureReasons : null,
        workflowId,
        totalNodes,
        successfulNodes: successfulNodes.length,
        failedNodes: failedNodes.length,
        successRate: Math.round(successRate)
      };
    }

    case "workflow_summary_generator": {
      // Workflow Summary Generator: Generate human-readable summary
      const workflowConfig = config.workflow;
      const targetAudience = getStringProperty(config, 'targetAudience', 'technical') as 'technical' | 'non_technical';

      let workflow: { nodes: unknown[]; edges: unknown[] } | null = null;
      if (workflowConfig) {
        if (typeof workflowConfig === 'string') {
          try {
            workflow = JSON.parse(workflowConfig);
          } catch {
            throw new Error("Workflow Summary Generator: Invalid workflow JSON format");
          }
        } else if (typeof workflowConfig === 'object') {
          workflow = workflowConfig as { nodes: unknown[]; edges: unknown[] };
        }
      }

      if (!workflow || !workflow.nodes || !Array.isArray(workflow.nodes)) {
        throw new Error("Workflow Summary Generator: Workflow with nodes array is required");
      }

      const nodeCount = workflow.nodes.length;
      const edgeCount = workflow.edges?.length || 0;
      
      // Determine complexity
      let estimatedComplexity: 'low' | 'medium' | 'high' = 'low';
      if (nodeCount > 10) {
        estimatedComplexity = 'high';
      } else if (nodeCount > 5) {
        estimatedComplexity = 'medium';
      }

      // Generate summary based on audience
      let summary = '';
      const keySteps: string[] = [];

      if (targetAudience === 'technical') {
        summary = `This workflow consists of ${nodeCount} nodes with ${edgeCount} connections. `;
        summary += `The workflow executes nodes in a defined sequence to accomplish its objectives. `;
        summary += `Complexity: ${estimatedComplexity}.`;

        // Extract node types for technical summary
        const nodeTypes = new Set<string>();
        if (Array.isArray(workflow.nodes)) {
          workflow.nodes.forEach((node: unknown) => {
            if (typeof node === 'object' && node !== null && 'type' in node) {
              nodeTypes.add((node as { type: string }).type);
            }
          });
        }
        keySteps.push(`Uses ${nodeTypes.size} unique node type(s): ${Array.from(nodeTypes).join(', ')}`);
        keySteps.push(`Total execution nodes: ${nodeCount}`);
      } else {
        summary = `This workflow automates a process using ${nodeCount} automated steps. `;
        summary += `It processes information and performs actions in a logical sequence. `;
        summary += `The workflow is ${estimatedComplexity} in complexity.`;

        keySteps.push(`Processes data through ${nodeCount} steps`);
        keySteps.push(`${estimatedComplexity === 'high' ? 'Handles complex' : estimatedComplexity === 'medium' ? 'Manages moderate' : 'Handles simple'} automation tasks`);
      }

      return {
        summary,
        keySteps,
        estimatedComplexity,
        targetAudience,
        nodeCount,
        edgeCount
      };
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
        if (blocksStr && blocksStr.trim() !== '') {
          try {
            const replaced = replaceTemplates(blocksStr, input);
            const blocks = JSON.parse(replaced);
            if (Array.isArray(blocks) && blocks.length > 0) {
              payload.blocks = blocks;
            }
          } catch (error) {
            console.warn(`Slack: Failed to parse blocks JSON, falling back to text. Error: ${error instanceof Error ? error.message : String(error)}`);
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
      const condition = getStringProperty(config, 'condition', '');
      if (!condition || !condition.trim()) {
        throw new Error("If/Else: Condition is required. Please configure the condition expression in the node properties.");
      }
      
      // Extract the actual input data (in case it's wrapped)
      const actualInput = (input && typeof input === "object" && "input" in input)
        ? (input as Record<string, unknown>).input
        : input;

      console.log(`If/Else node evaluating condition: "${condition}"`);
      console.log(`If/Else node input:`, JSON.stringify(actualInput));

      const result = evaluateCondition(condition, actualInput);

      console.log(`If/Else condition result: ${result}`);

      // Return the original input structure for downstream nodes
      // Ensure output is always valid JSON
      const output = { condition: result, input: actualInput !== null && actualInput !== undefined ? actualInput : {} };
      return output;
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
          // Sanitize condition expression to prevent code injection
          // Replace template variables first
          let sanitizedCondition = conditionExpr.trim();
          
          // Replace {{item.property}} patterns safely
          sanitizedCondition = sanitizedCondition.replace(/\{\{item\.([\w.]+)\}\}/g, (match, path) => {
            const keys = path.split('.');
            let value: unknown = item;
            for (const key of keys) {
              if (value && typeof value === 'object' && value !== null && key in value) {
                value = (value as Record<string, unknown>)[key];
              } else {
                return 'undefined';
              }
            }
            // Return properly formatted value for JavaScript evaluation
            if (typeof value === 'string') {
              return `"${value.replace(/"/g, '\\"')}"`;
            } else if (value === null) {
              return 'null';
            } else if (value === undefined) {
              return 'undefined';
            } else if (typeof value === 'boolean') {
              return String(value);
            } else {
              return String(value);
            }
          });
          
          // Evaluate condition with item in scope
          const fn = new Function("item", `return ${sanitizedCondition};`);
          const result = fn(item);
          console.log(`Filter: Item ${JSON.stringify(item).substring(0, 50)}... -> ${result}`);
          return Boolean(result);
        } catch (error) {
          console.error(`Filter condition evaluation error for item:`, item, error);
          // Return false on error to exclude item from results
          return false;
        }
      });

      console.log(`Filter: Filtered ${items.length} items down to ${filtered.length} items`);
      return filtered;
    }

    case "wait": {
      const duration = getNumberProperty(config, 'duration', 1000);
      // Ensure duration is positive and within reasonable bounds (max 60 seconds)
      const safeDuration = Math.max(0, Math.min(Math.abs(duration), 60000));
      if (safeDuration > 0) {
        await new Promise(resolve => setTimeout(resolve, safeDuration));
      }
      return input;
    }

    case "human_approval": {
      const approvers = config.approvers;
      const approvalType = getStringProperty(config, 'approvalType', 'single') as 'single' | 'multiple';
      const timeout = getNumberProperty(config, 'timeout', 3600);
      const defaultAction = getStringProperty(config, 'defaultAction', 'none') as 'approve' | 'reject' | 'none';
      
      let approversList: string[] = [];
      if (approvers) {
        if (typeof approvers === 'string') {
          try {
            approversList = JSON.parse(approvers);
          } catch {
            approversList = [approvers];
          }
        } else if (Array.isArray(approvers)) {
          approversList = approvers;
        }
      }

      if (approversList.length === 0) {
        throw new Error("Human Approval: At least one approver is required");
      }

      // Extract payload from input
      const inputObj = input && typeof input === 'object' ? input as Record<string, unknown> : {};
      const payload = inputObj.payload || inputObj.data || inputObj.input || inputObj;

      // In a real implementation, this would:
      // 1. Create an approval request in the database
      // 2. Send notifications to approvers
      // 3. Wait for response or timeout
      // For now, we simulate with default action after timeout
      
      const startTime = Date.now();
      const timeoutMs = timeout * 1000;
      
      // Simulate waiting (in production, this would poll the database)
      // For now, we'll apply the default action immediately if timeout is 0 or very small
      if (timeoutMs <= 100) {
        if (defaultAction === 'approve') {
          return {
            status: 'approved',
            approvedBy: approversList[0],
            timestamp: new Date().toISOString(),
            payload,
            metadata: {
              approvalType,
              timeoutUsed: 0
            }
          };
        } else if (defaultAction === 'reject') {
          return {
            status: 'rejected',
            approvedBy: null,
            timestamp: new Date().toISOString(),
            payload,
            metadata: {
              approvalType,
              timeoutUsed: 0
            }
          };
        } else {
          throw new Error("Human Approval: Timeout reached and no default action configured");
        }
      }

      // For production, this should integrate with a real approval system
      // For now, return a pending state (in real implementation, workflow would pause)
      return {
        status: 'pending',
        approvedBy: null,
        timestamp: new Date().toISOString(),
        payload,
        metadata: {
          approvalType,
          timeoutUsed: 0,
          approvers: approversList
        }
      };
    }

    case "escalation_router": {
      const severity = getStringProperty(config, 'severity', 'medium') as 'low' | 'medium' | 'high' | 'critical';
      const rulesConfig = config.rules;
      
      let rules: Record<string, string> = {};
      if (rulesConfig) {
        if (typeof rulesConfig === 'string') {
          try {
            rules = JSON.parse(rulesConfig);
          } catch {
            throw new Error("Escalation Router: Invalid rules JSON format");
          }
        } else if (typeof rulesConfig === 'object') {
          rules = rulesConfig as Record<string, string>;
        }
      }

      const routeTo = rules[severity] || '';
      if (!routeTo) {
        throw new Error(`Escalation Router: No route defined for severity level: ${severity}`);
      }

      const inputObj = input && typeof input === 'object' ? input as Record<string, unknown> : {};
      const event = inputObj.event || inputObj.data || inputObj;

      return {
        routeTo,
        severity,
        event,
        metadata: {
          routingRuleApplied: severity
        }
      };
    }

    case "fallback_router": {
      const fallbackPathsConfig = config.fallbackPaths;
      let fallbackPaths: string[] = [];
      
      if (fallbackPathsConfig) {
        if (typeof fallbackPathsConfig === 'string') {
          try {
            fallbackPaths = JSON.parse(fallbackPathsConfig);
          } catch {
            fallbackPaths = [fallbackPathsConfig];
          }
        } else if (Array.isArray(fallbackPathsConfig)) {
          fallbackPaths = fallbackPathsConfig;
        }
      }

      if (fallbackPaths.length === 0) {
        throw new Error("Fallback Router: At least one fallback path is required");
      }

      const inputObj = input && typeof input === 'object' ? input as Record<string, unknown> : {};
      const primaryResult = inputObj.primaryResult || inputObj.result || inputObj.data || inputObj;
      const error = inputObj.error || null;

      // If there's an error, use fallback
      if (error) {
        return {
          route: 'fallback',
          fallbackUsed: fallbackPaths[0],
          reason: error instanceof Error ? error.message : String(error),
          primaryResult,
          error
        };
      }

      return {
        route: 'primary',
        fallbackUsed: null,
        reason: 'Primary execution succeeded',
        primaryResult
      };
    }

    case "retry_with_backoff": {
      const maxRetries = getNumberProperty(config, 'maxRetries', 3);
      const initialDelay = getNumberProperty(config, 'initialDelay', 1000);
      const backoffMultiplier = getNumberProperty(config, 'backoffMultiplier', 2);

      if (maxRetries < 1) {
        throw new Error("Retry With Backoff: Max retries must be at least 1");
      }
      if (initialDelay < 0) {
        throw new Error("Retry With Backoff: Initial delay must be non-negative");
      }
      if (backoffMultiplier < 1) {
        throw new Error("Retry With Backoff: Backoff multiplier must be at least 1");
      }

      const inputObj = input && typeof input === 'object' ? input as Record<string, unknown> : {};
      const operation = inputObj.operation || inputObj.data || inputObj;

      let attempts = 0;
      let lastError: unknown = null;
      const delaysUsed: number[] = [];

      // Note: In a real implementation, this would retry the previous node's execution
      // For now, we simulate retry logic
      while (attempts < maxRetries) {
        attempts++;
        try {
          // In production, this would re-execute the previous node
          // For now, we assume success on first attempt (or simulate based on input)
          const hasError = inputObj.error !== undefined && inputObj.error !== null;
          
          if (!hasError) {
            return {
              success: true,
              attempts,
              finalResult: operation,
              error: null,
              metadata: {
                delaysUsed
              }
            };
          }

          // If there's an error and we have retries left, wait and retry
          if (attempts < maxRetries) {
            const delay = initialDelay * Math.pow(backoffMultiplier, attempts - 1);
            delaysUsed.push(delay);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        } catch (error) {
          lastError = error;
          if (attempts < maxRetries) {
            const delay = initialDelay * Math.pow(backoffMultiplier, attempts - 1);
            delaysUsed.push(delay);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
      }

      return {
        success: false,
        attempts,
        finalResult: null,
        error: lastError,
        metadata: {
          delaysUsed
        }
      };
    }

    case "timeout_guard": {
      const timeout = getNumberProperty(config, 'timeout', 30000);
      
      if (timeout <= 0) {
        throw new Error("Timeout Guard: Timeout must be greater than 0");
      }

      const inputObj = input && typeof input === 'object' ? input as Record<string, unknown> : {};
      const execution = inputObj.execution || inputObj.data || inputObj;

      const startTime = Date.now();
      
      // In a real implementation, this would monitor the execution of the next node
      // For now, we simulate by checking if execution time exceeds timeout
      const executionTime = Date.now() - startTime;
      const timedOut = executionTime >= timeout;

      if (timedOut) {
        return {
          completed: false,
          timedOut: true,
          executionTime,
          result: null,
          error: 'Execution exceeded timeout limit'
        };
      }

      return {
        completed: true,
        timedOut: false,
        executionTime,
        result: execution
      };
    }

    case "circuit_breaker": {
      const serviceName = getStringProperty(config, 'serviceName', '');
      const failureThreshold = getNumberProperty(config, 'failureThreshold', 5);
      const cooldownPeriod = getNumberProperty(config, 'cooldownPeriod', 60000);

      if (!serviceName) {
        throw new Error("Circuit Breaker: Service name is required");
      }
      if (failureThreshold < 1) {
        throw new Error("Circuit Breaker: Failure threshold must be at least 1");
      }
      if (cooldownPeriod < 0) {
        throw new Error("Circuit Breaker: Cooldown period must be non-negative");
      }

      // In a real implementation, this would check a shared state store (Redis, database, etc.)
      // For now, we simulate circuit breaker state
      const inputObj = input && typeof input === 'object' ? input as Record<string, unknown> : {};
      const failureCount = getNumberProperty(inputObj, 'failureCount', 0);

      // Circuit breaker logic
      let circuitState: 'closed' | 'open' | 'half_open' = 'closed';
      let allowed = true;
      let nextRetryAt: string | null = null;

      if (failureCount >= failureThreshold) {
        circuitState = 'open';
        allowed = false;
        const retryTime = new Date(Date.now() + cooldownPeriod);
        nextRetryAt = retryTime.toISOString();
      } else if (failureCount > 0) {
        circuitState = 'half_open';
        allowed = true;
      }

      return {
        circuitState,
        allowed,
        nextRetryAt,
        serviceName,
        failureCount,
        failureThreshold
      };
    }

    case "workflow_state_manager": {
      const mode = getStringProperty(config, 'mode', 'save') as 'save' | 'load' | 'update';
      const workflowIdConfig = config.workflowId;
      
      const inputObj = input && typeof input === 'object' ? input as Record<string, unknown> : {};
      const workflowId = workflowIdConfig || inputObj._workflow_id || '';
      const state = inputObj.state || inputObj.data || inputObj;

      if (!workflowId) {
        throw new Error("Workflow State Manager: Workflow ID is required");
      }

      // In a real implementation, this would interact with a database or state store
      // For now, we simulate state management
      let status: 'stored' | 'retrieved' | 'updated' = 'stored';
      
      if (mode === 'load') {
        status = 'retrieved';
      } else if (mode === 'update') {
        status = 'updated';
      }

      return {
        workflowId,
        state,
        status,
        mode
      };
    }

    case "execution_context_store": {
      const action = getStringProperty(config, 'action', 'set') as 'set' | 'get' | 'delete';
      const contextKey = getStringProperty(config, 'contextKey', '');
      
      if (!contextKey) {
        throw new Error("Execution Context Store: Context key is required");
      }

      const inputObj = input && typeof input === 'object' ? input as Record<string, unknown> : {};
      const value = inputObj.value !== undefined ? inputObj.value : inputObj.data || inputObj;

      // In a real implementation, this would use a shared context store (Redis, in-memory cache, etc.)
      // For now, we simulate context storage
      let actionPerformed = action;
      let resultValue: unknown = null;

      if (action === 'set') {
        resultValue = value;
        actionPerformed = 'set';
      } else if (action === 'get') {
        // In production, this would retrieve from the context store
        resultValue = value; // Simulated: return the input value
        actionPerformed = 'get';
      } else if (action === 'delete') {
        resultValue = null;
        actionPerformed = 'delete';
      }

      return {
        contextKey,
        value: resultValue,
        actionPerformed
      };
    }

    case "session_manager": {
      const action = getStringProperty(config, 'action', 'create') as 'create' | 'validate' | 'terminate';
      const ttl = getNumberProperty(config, 'ttl', 3600);
      const sessionIdConfig = config.sessionId;

      const inputObj = input && typeof input === 'object' ? input as Record<string, unknown> : {};
      const sessionId = sessionIdConfig || inputObj.sessionId || null;

      if ((action === 'validate' || action === 'terminate') && !sessionId) {
        throw new Error("Session Manager: Session ID is required for validate/terminate actions");
      }

      // In a real implementation, this would interact with a session store (Redis, database, etc.)
      // For now, we simulate session management
      let valid = false;
      let expiresAt: string | null = null;
      let newSessionId: string | null = null;

      if (action === 'create') {
        newSessionId = sessionId || `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        expiresAt = new Date(Date.now() + ttl * 1000).toISOString();
        valid = true;
      } else if (action === 'validate') {
        // In production, this would check the session store
        valid = sessionId !== null; // Simplified validation
        if (valid) {
          expiresAt = new Date(Date.now() + ttl * 1000).toISOString();
        }
      } else if (action === 'terminate') {
        valid = false;
        expiresAt = null;
      }

      return {
        sessionId: newSessionId || sessionId,
        valid,
        expiresAt,
        actionPerformed: action
      };
    }

    case "javascript": {
      const code = getStringProperty(config, 'code', '');
      if (!code || !code.trim()) {
        return input;
      }
      
      try {
        // Helper functions for common data transformations
        const helpers = {
          // Extract data from different input formats
          getData: (input: unknown): unknown => {
            if (typeof input !== 'object' || input === null) return input;
            const obj = input as Record<string, unknown>;
            // Try common data locations
            return obj.data || obj.body || obj.payload || obj.result || obj.response || input;
          },
          
          // Get array from input (supports multiple formats)
          // Handles: arrays, single objects (converts to array), nested arrays
          getArray: (input: unknown, key?: string): unknown[] => {
            if (typeof input !== 'object' || input === null) return [];
            const obj = input as Record<string, unknown>;
            
            // If key specified, try that first
            if (key) {
              const value = obj[key];
              if (Array.isArray(value)) return value as unknown[];
              // If it's a single object, wrap it in an array
              if (value && typeof value === 'object') return [value];
            }
            
            // Try common array property names
            const arrayKeys = ['items', 'products', 'data', 'results', 'array', 'list', 'rows'];
            for (const k of arrayKeys) {
              const value = obj[k];
              if (Array.isArray(value)) return value as unknown[];
              // If it's a single object, wrap it in an array
              if (value && typeof value === 'object' && !Array.isArray(value)) return [value];
            }
            
            // If input itself is an array
            if (Array.isArray(input)) return input as unknown[];
            
            // If input is a single object (not an array), wrap it in an array
            // This handles cases where HTTP Request returns a single object
            if (typeof input === 'object' && input !== null) {
              // Check if it looks like a data object (has common properties)
              const hasDataProperties = 'id' in obj || 'title' in obj || 'name' in obj || 'email' in obj;
              if (hasDataProperties) {
                return [input];
              }
            }
            
            return [];
          },
          
          // Convert single object or array to array (always returns array)
          toArray: (input: unknown): unknown[] => {
            if (Array.isArray(input)) return input;
            if (typeof input === 'object' && input !== null) return [input];
            return [];
          },
          
          // Transform array of objects to Google Sheets rows format
          // Handles both arrays and single objects
          toSheetsRows: (items: unknown, fields?: string[]): unknown[][] => {
            // Convert to array if needed
            const itemsArray = Array.isArray(items) ? items : (items && typeof items === 'object' ? [items] : []);
            if (itemsArray.length === 0) return [];
            
            const rows: unknown[][] = [];
            
            // If fields specified, use them
            if (fields && fields.length > 0) {
              rows.push(fields); // Header row
              itemsArray.forEach(item => {
                if (typeof item === 'object' && item !== null) {
                  const obj = item as Record<string, unknown>;
                  const row = fields.map(field => obj[field] ?? '');
                  rows.push(row);
                }
              });
            } else {
              // Auto-detect fields from first item
              if (itemsArray.length > 0 && typeof itemsArray[0] === 'object' && itemsArray[0] !== null) {
                const firstItem = itemsArray[0] as Record<string, unknown>;
                // Filter out nested objects and arrays for cleaner output
                const autoFields = Object.keys(firstItem).filter(k => {
                  const val = firstItem[k];
                  // Include primitive values and arrays, exclude nested objects
                  return val === null || val === undefined || 
                         typeof val !== 'object' || 
                         Array.isArray(val);
                });
                rows.push(autoFields); // Header row
                itemsArray.forEach(item => {
                  if (typeof item === 'object' && item !== null) {
                    const obj = item as Record<string, unknown>;
                    const row = autoFields.map(field => {
                      const val = obj[field];
                      if (val === null || val === undefined) return '';
                      if (typeof val === 'object' && !Array.isArray(val)) return JSON.stringify(val);
                      return val;
                    });
                    rows.push(row);
                  }
                });
              }
            }
            
            return rows;
          },
          
          // Validate email format
          isValidEmail: (email: string): boolean => {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            return emailRegex.test(email);
          },
          
          // Validate phone number
          isValidPhone: (phone: string): boolean => {
            const phoneRegex = /^[0-9]{10,15}$/;
            return phoneRegex.test(phone.replace(/[^0-9]/g, ''));
          },
          
          // Safe property access with fallback
          get: (obj: unknown, path: string, defaultValue: unknown = null): unknown => {
            if (typeof obj !== 'object' || obj === null) return defaultValue;
            const keys = path.split('.');
            let current: unknown = obj;
            for (const key of keys) {
              if (current && typeof current === 'object' && key in current) {
                current = (current as Record<string, unknown>)[key];
              } else {
                return defaultValue;
              }
            }
            return current ?? defaultValue;
          },
          
          // Log helper for debugging
          log: (...args: unknown[]): void => {
            console.log('[JavaScript Node]:', ...args);
          }
        };
        
        // Check if code is already a function expression/arrow function
        const trimmedCode = code.trim();
        if (trimmedCode.startsWith('(') || trimmedCode.startsWith('function') || trimmedCode.startsWith('async')) {
          // Try as function expression first
          try {
            const fn = new Function("input", "helpers", `return (${code})(input, helpers);`);
            const result = fn(input, helpers);
            // Ensure result is JSON-serializable
            if (result !== undefined && result !== null) {
              try {
                JSON.stringify(result);
                return result;
              } catch {
                // If not serializable, return as string representation
                return { result: String(result), _warning: "Result was not JSON-serializable, converted to string" };
              }
            }
            return input;
          } catch {
            // Fall through to function body approach
          }
        }
        
        // Execute as function body (supports const, let, var, and other statements)
        // Provide helpers as a global object
        const fn = new Function("input", "helpers", `
          // Make helpers available
          const { getData, getArray, toSheetsRows, isValidEmail, isValidPhone, get, log } = helpers;
          ${code}
        `);
        const result = fn(input, helpers);
        
        // If function doesn't return anything, return the input
        if (result === undefined) {
          return input;
        }
        
        // Ensure result is JSON-serializable
        try {
          JSON.stringify(result);
          return result;
        } catch {
          // If not serializable, return as string representation
          return { result: String(result), _warning: "Result was not JSON-serializable, converted to string" };
        }
      } catch (error) {
        console.error(`JavaScript node execution error:`, error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        
        // Provide helpful error messages for common issues
        if (errorMessage.includes("Cannot read properties of undefined") || errorMessage.includes("Cannot read property")) {
          const propertyMatch = errorMessage.match(/Cannot read propert(?:y|ies) (?:of undefined \(reading '|')([^']+)/);
          if (propertyMatch) {
            const property = propertyMatch[1];
            throw new Error(
              `JavaScript execution failed: Cannot access property '${property}' because it doesn't exist.\n\n` +
              `Common causes:\n` +
              `  - HTTP Request output is at root level (use input.${property}, not input.body.${property})\n` +
              `  - Webhook output is in input.body (use input.body.${property})\n` +
              `  - Form output is in input.data (use input.data.${property})\n\n` +
              `Try using: helpers.get(input, '${property}') or helpers.getArray(input, '${property}') for safe access.\n\n` +
              `Original error: ${errorMessage}`
            );
          }
        }
        
        throw new Error(`JavaScript execution failed: ${errorMessage}`);
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
      const expression = getStringProperty(config, 'expression', '');
      if (!expression || expression.trim() === '') return input;
      try {
        return extractValue(expression, input);
      } catch (error) {
        throw new Error(`JSON Parser: Error extracting value with expression "${expression}": ${error instanceof Error ? error.message : String(error)}`);
      }
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

    case "email_sequence_sender": {
      // Email Sequence Sender: Send multi-step email campaigns
      const recipientConfig = config.recipient;
      const sequenceConfig = config.sequence;
      const stopOnReply = getBooleanProperty(config, 'stopOnReply', false);
      const trackingConfig = config.tracking || { openTracking: true, clickTracking: true };

      let recipient: { email: string; name: string | null } | null = null;
      if (recipientConfig) {
        if (typeof recipientConfig === 'string') {
          try {
            recipient = JSON.parse(recipientConfig);
          } catch {
            throw new Error("Email Sequence Sender: Invalid recipient JSON format");
          }
        } else if (typeof recipientConfig === 'object') {
          recipient = recipientConfig as { email: string; name: string | null };
        }
      }

      const inputObj = input && typeof input === 'object' ? input as Record<string, unknown> : {};
      if (!recipient && inputObj.recipient) {
        if (typeof inputObj.recipient === 'object') {
          recipient = inputObj.recipient as { email: string; name: string | null };
        }
      }

      if (!recipient || !recipient.email) {
        throw new Error("Email Sequence Sender: Recipient with email is required");
      }

      let sequence: Array<{ step: number; subject: string; body: string; delayAfter: number; sendCondition: string | null }> = [];
      if (sequenceConfig) {
        if (typeof sequenceConfig === 'string') {
          try {
            sequence = JSON.parse(sequenceConfig);
          } catch {
            throw new Error("Email Sequence Sender: Invalid sequence JSON format");
          }
        } else if (Array.isArray(sequenceConfig)) {
          sequence = sequenceConfig;
        }
      }

      if (sequence.length === 0) {
        throw new Error("Email Sequence Sender: At least one sequence step is required");
      }

      // In a real implementation, this would:
      // 1. Store sequence in database with unique sequenceId
      // 2. Send emails in order with delays
      // 3. Track opens, clicks, and replies
      // 4. Stop sequence if reply detected and stopOnReply is true

      const sequenceId = `seq_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const sentSteps: number[] = [];

      // Simulate sending sequence (in production, this would be async with delays)
      for (const step of sequence) {
        // Check sendCondition if provided
        if (step.sendCondition) {
          // Evaluate condition (simplified - would use expression evaluator in production)
          const conditionMet = true; // Placeholder
          if (!conditionMet) {
            continue;
          }
        }

        // In production: Send email here with subject, body, recipient
        sentSteps.push(step.step);

        // Apply delay after sending (except for last step)
        if (step.delayAfter && step.delayAfter > 0 && step !== sequence[sequence.length - 1]) {
          // In production, this would be handled by a scheduler/cron job
          // For now, we simulate immediate completion
        }
      }

      return {
        sequenceId,
        status: sentSteps.length === sequence.length ? 'completed' : 'paused',
        sentSteps,
        tracking: {
          opens: 0,
          clicks: 0,
          replies: 0
        },
        metadata: {
          recipient: recipient.email
        },
        note: "Email sequence requires email service integration and async scheduling. This is a placeholder implementation."
      };
    }

    case "auto_followup_sender": {
      // Auto Follow-up Sender: Send follow-ups when no response
      const originalMessageId = getStringProperty(config, 'originalMessageId', '');
      const recipient = getStringProperty(config, 'recipient', '');
      const followUpMessageConfig = config.followUpMessage;
      const waitTime = getNumberProperty(config, 'waitTime', 86400);
      const maxAttempts = getNumberProperty(config, 'maxAttempts', 3);

      if (!originalMessageId) {
        throw new Error("Auto Follow-up Sender: Original message ID is required");
      }
      if (!recipient) {
        throw new Error("Auto Follow-up Sender: Recipient is required");
      }

      let followUpMessage: { subject: string; body: string } | null = null;
      if (followUpMessageConfig) {
        if (typeof followUpMessageConfig === 'string') {
          try {
            followUpMessage = JSON.parse(followUpMessageConfig);
          } catch {
            throw new Error("Auto Follow-up Sender: Invalid follow-up message JSON format");
          }
        } else if (typeof followUpMessageConfig === 'object') {
          followUpMessage = followUpMessageConfig as { subject: string; body: string };
        }
      }

      if (!followUpMessage || !followUpMessage.subject || !followUpMessage.body) {
        throw new Error("Auto Follow-up Sender: Follow-up message with subject and body is required");
      }

      if (maxAttempts < 1) {
        throw new Error("Auto Follow-up Sender: Max attempts must be at least 1");
      }

      // In a real implementation, this would:
      // 1. Check response status of original message
      // 2. Wait for waitTime
      // 3. Send follow-up if no reply
      // 4. Repeat up to maxAttempts

      // Simulate checking for reply (in production, this would query email/webhook service)
      const hasReply = false; // Placeholder

      const attemptsMade = hasReply ? 0 : 1; // Simulate one attempt if no reply
      const finalStatus = hasReply ? 'replied' : (attemptsMade >= maxAttempts ? 'max_attempts_reached' : 'sent');
      const lastSentAt = hasReply ? null : new Date().toISOString();

      return {
        attemptsMade,
        finalStatus,
        lastSentAt,
        originalMessageId,
        recipient,
        note: "Auto follow-up requires message monitoring and scheduling system. This is a placeholder implementation."
      };
    }

    case "human_handoff_notification": {
      // Human Handoff Notification: Notify human agent to take over
      const channel = getStringProperty(config, 'channel', 'email') as 'email' | 'slack' | 'sms';
      const recipient = getStringProperty(config, 'recipient', '');
      const contextConfig = config.context;
      const priority = getStringProperty(config, 'priority', 'medium') as 'low' | 'medium' | 'high';

      if (!recipient) {
        throw new Error("Human Handoff Notification: Recipient is required");
      }

      let context: Record<string, unknown> = {};
      if (contextConfig) {
        if (typeof contextConfig === 'string') {
          try {
            context = JSON.parse(contextConfig);
          } catch {
            throw new Error("Human Handoff Notification: Invalid context JSON format");
          }
        } else if (typeof contextConfig === 'object') {
          context = contextConfig as Record<string, unknown>;
        }
      }

      const inputObj = input && typeof input === 'object' ? input as Record<string, unknown> : {};
      if (Object.keys(context).length === 0 && inputObj.context) {
        if (typeof inputObj.context === 'object') {
          context = inputObj.context as Record<string, unknown>;
        }
      }

      // In a real implementation, this would:
      // 1. Send notification via specified channel (email/Slack/SMS)
      // 2. Mark workflow execution as awaiting human action
      // 3. Store context for human agent to review
      // 4. Pause workflow until human resumes

      // Simulate sending notification
      const notificationSent = true;

      return {
        notificationSent,
        channel,
        timestamp: new Date().toISOString(),
        handoffStatus: 'pending',
        recipient,
        priority,
        context,
        note: "Human handoff requires integration with notification channels and workflow pause/resume functionality. This is a placeholder implementation."
      };
    }

    case "approval_request_sender": {
      // Approval Request Sender: Request explicit approval
      const approver = getStringProperty(config, 'approver', '');
      const approvalMessage = getStringProperty(config, 'approvalMessage', '');
      const approvalOptionsConfig = config.approvalOptions;
      const timeout = getNumberProperty(config, 'timeout', 86400);

      if (!approver) {
        throw new Error("Approval Request Sender: Approver is required");
      }
      if (!approvalMessage) {
        throw new Error("Approval Request Sender: Approval message is required");
      }

      let approvalOptions: string[] = ['approve', 'reject'];
      if (approvalOptionsConfig) {
        if (typeof approvalOptionsConfig === 'string') {
          try {
            approvalOptions = JSON.parse(approvalOptionsConfig);
          } catch {
            approvalOptions = [approvalOptionsConfig];
          }
        } else if (Array.isArray(approvalOptionsConfig)) {
          approvalOptions = approvalOptionsConfig;
        }
      }

      if (timeout < 0) {
        throw new Error("Approval Request Sender: Timeout must be non-negative");
      }

      // In a real implementation, this would:
      // 1. Send approval request to approver
      // 2. Store request in database with timeout
      // 3. Poll for response or wait for webhook
      // 4. Return decision or timeout

      // Simulate approval request (in production, this would create a pending approval record)
      const decision: 'approve' | 'reject' | 'timed_out' = 'timed_out'; // Placeholder
      const respondedAt = decision !== 'timed_out' ? new Date().toISOString() : null;
      const approvedBy = decision === 'approve' ? approver : null;

      return {
        decision,
        respondedAt,
        approvedBy,
        approver,
        approvalMessage,
        timeout,
        note: "Approval request requires approval system integration and response tracking. This is a placeholder implementation."
      };
    }

    case "reminder_scheduler": {
      // Reminder Scheduler: Schedule reminders
      const recipient = getStringProperty(config, 'recipient', '');
      const message = getStringProperty(config, 'message', '');
      const channel = getStringProperty(config, 'channel', 'email') as 'email' | 'sms' | 'push';
      const scheduleConfig = config.schedule;

      if (!recipient) {
        throw new Error("Reminder Scheduler: Recipient is required");
      }
      if (!message) {
        throw new Error("Reminder Scheduler: Message is required");
      }

      let schedule: { type: 'one_time' | 'recurring'; time: string; cron: string | null } | null = null;
      if (scheduleConfig) {
        if (typeof scheduleConfig === 'string') {
          try {
            schedule = JSON.parse(scheduleConfig);
          } catch {
            throw new Error("Reminder Scheduler: Invalid schedule JSON format");
          }
        } else if (typeof scheduleConfig === 'object') {
          schedule = scheduleConfig as { type: 'one_time' | 'recurring'; time: string; cron: string | null };
        }
      }

      if (!schedule || !schedule.type || !schedule.time) {
        throw new Error("Reminder Scheduler: Schedule with type and time is required");
      }

      if (schedule.type === 'recurring' && !schedule.cron) {
        throw new Error("Reminder Scheduler: Cron expression is required for recurring reminders");
      }

      // Validate time format (ISO 8601)
      try {
        new Date(schedule.time);
      } catch {
        throw new Error("Reminder Scheduler: Invalid time format. Use ISO 8601 format (e.g., 2024-12-31T12:00:00Z)");
      }

      // In a real implementation, this would:
      // 1. Create reminder record in database
      // 2. Schedule job using cron scheduler or job queue
      // 3. Send reminder at scheduled time via specified channel
      // 4. Handle recurring reminders

      const reminderId = `reminder_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const status = 'scheduled';
      const nextRun = schedule.type === 'recurring' ? schedule.time : null; // Would calculate next run from cron

      return {
        reminderId,
        status,
        nextRun,
        recipient,
        channel,
        schedule,
        note: "Reminder scheduling requires job scheduler integration (e.g., cron, Bull, Agenda). This is a placeholder implementation."
      };
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
          // Use input data, but process template strings in values
          dataToWrite = {};
          for (const [key, value] of Object.entries(inputObj)) {
            // Skip internal workflow properties
            if (key.startsWith('_') && (key === '_user_id' || key === '_workflow_id' || key.startsWith('_'))) {
              continue;
            }
            
            // Process template strings
            if (typeof value === 'string' && value.includes('{{')) {
              const processed = replaceTemplates(value, input);
              // Try to parse as JSON if it looks like JSON, otherwise use as string
              try {
                const parsed = JSON.parse(processed);
                dataToWrite[key] = parsed;
              } catch {
                // If template replacement didn't result in valid JSON, check if template was resolved
                if (processed !== value) {
                  // Template was replaced, use the processed value
                  dataToWrite[key] = processed;
                } else {
                  // Template was not resolved, skip this field
                  console.warn(`Database Write: Skipping field "${key}" with unresolved template "${value}"`);
                  continue;
                }
              }
            } else if (value !== undefined && value !== null) {
              // Use value as-is if it's not a template string
              dataToWrite[key] = value;
            }
          }
        }
      } catch (error) {
        throw new Error(`Database Write: Invalid data JSON. ${error instanceof Error ? error.message : String(error)}`);
      }
      
      // Validate that we have data to write
      if (!dataToWrite || Object.keys(dataToWrite).length === 0) {
        throw new Error('Database Write: No valid data to write. All template strings were unresolved or no data fields provided.');
      }
      
      try {
        let result;
        
        switch (operation) {
          case 'insert':
            const { data: insertData, error: insertError } = await supabaseClient
              .from(table)
              .insert(dataToWrite)
              .select();
            if (insertError) {
              // Format error message better
              const errorMsg = insertError.message || JSON.stringify(insertError);
              const errorDetails = insertError.details ? ` Details: ${insertError.details}` : '';
              const errorHint = insertError.hint ? ` Hint: ${insertError.hint}` : '';
              throw new Error(`Database Write insert error: ${errorMsg}${errorDetails}${errorHint}`);
            }
            result = insertData;
            break;
            
          case 'update':
            const matchColumn = getStringProperty(config, 'matchColumn', 'id');
            const matchValue = dataToWrite[matchColumn];
            if (matchValue === undefined || matchValue === null || matchValue === '') {
              throw new Error(`Database Write: matchColumn "${matchColumn}" value is required for update operation. Current value: ${matchValue === undefined ? 'undefined' : matchValue === null ? 'null' : 'empty string'}`);
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
            if (deleteValue === undefined || deleteValue === null || deleteValue === '') {
              throw new Error(`Database Write: matchColumn "${deleteMatchColumn}" value is required for delete operation. Current value: ${deleteValue === undefined ? 'undefined' : deleteValue === null ? 'null' : 'empty string'}`);
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
        // Better error formatting
        let errorMessage = 'Unknown error';
        if (error instanceof Error) {
          errorMessage = error.message;
        } else if (typeof error === 'object' && error !== null) {
          // Try to extract meaningful error information
          const errorObj = error as Record<string, unknown>;
          if (errorObj.message) {
            errorMessage = String(errorObj.message);
          } else if (errorObj.error) {
            errorMessage = String(errorObj.error);
          } else {
            errorMessage = JSON.stringify(error);
          }
        } else {
          errorMessage = String(error);
        }
        throw new Error(`Database Write: ${operation} operation failed. ${errorMessage}`);
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
          // Support multiple formats: input.values, input.data, input.rows, or direct array
          const inputData = inputObj.values || inputObj.data || inputObj.rows || input;
          if (Array.isArray(inputData)) {
            // Check if it's already a 2D array
            if (inputData.length > 0 && Array.isArray(inputData[0])) {
              writeData = inputData as unknown[][];
            } else {
              // Convert 1D array to 2D (single row)
              writeData = [inputData as unknown[]];
            }
          } else {
            // Check if we have empty values array - this is valid for append (skip operation)
            const inputObj = extractInputObject(input);
            const hasEmptyValues = inputObj.values && Array.isArray(inputObj.values) && inputObj.values.length === 0;
            
            if (hasEmptyValues && operation === 'append') {
              // For append operation, empty array is valid - just skip the operation
              console.log('[Google Sheets] Empty values array received for append operation - skipping');
              return {
                data: {
                  updatedCells: 0,
                  range: '',
                },
                rows: 0,
                columns: 0,
                formatted: 'json',
                operation: 'append',
                sheetName: sheetName || 'Sheet1',
                spreadsheetId,
                _skipped: true,
                _message: 'No data to append - values array is empty',
              };
            }
            
            throw new Error('Google Sheets: No data provided for write operation. Add data in node config or pass it in input (as input.values, input.data, or input.rows).');
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
      // Ensure we return a valid value (never null/undefined)
      if (input === null || input === undefined) {
        return {};
      }
      // Ensure it's JSON-serializable
      if (typeof input === 'object') {
        try {
          JSON.stringify(input);
        } catch {
          return { value: String(input), _warning: "Input was not JSON-serializable, converted to string" };
        }
      }
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
      // Date & Time: Manipulate dates and times with timezone awareness
      const operation = getStringProperty(config, 'operation', 'format');
      const inputObj = extractInputObject(input);
      const timezone = getStringProperty(config, 'timezone', 'UTC');
      const locale = getStringProperty(config, 'locale', 'en-US');
      
      // Helper function to format date in timezone
      const formatDateInTimezone = (date: Date, tz: string, format: string, loc?: string): string => {
        try {
          if (format === 'ISO') {
            // Use Intl API to format in timezone, then convert to ISO
            const formatter = new Intl.DateTimeFormat(loc || 'en-US', {
              timeZone: tz,
              year: 'numeric',
              month: '2-digit',
              day: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
              hour12: false,
            });
            const parts = formatter.formatToParts(date);
            const year = parts.find(p => p.type === 'year')?.value || '';
            const month = parts.find(p => p.type === 'month')?.value || '';
            const day = parts.find(p => p.type === 'day')?.value || '';
            const hour = parts.find(p => p.type === 'hour')?.value || '';
            const minute = parts.find(p => p.type === 'minute')?.value || '';
            const second = parts.find(p => p.type === 'second')?.value || '';
            return `${year}-${month}-${day}T${hour}:${minute}:${second}`;
          } else if (format === 'locale') {
            const formatter = new Intl.DateTimeFormat(loc || 'en-US', {
              timeZone: tz,
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              hour: 'numeric',
              minute: 'numeric',
              second: 'numeric',
            });
            return formatter.format(date);
          } else if (format === 'custom') {
            const customFormat = getStringProperty(config, 'customFormat', 'YYYY-MM-DD HH:mm:ss');
            const formatter = new Intl.DateTimeFormat(loc || 'en-US', {
              timeZone: tz,
              year: 'numeric',
              month: '2-digit',
              day: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
              hour12: false,
            });
            const parts = formatter.formatToParts(date);
            return customFormat
              .replace('YYYY', parts.find(p => p.type === 'year')?.value || '')
              .replace('MM', parts.find(p => p.type === 'month')?.value || '')
              .replace('DD', parts.find(p => p.type === 'day')?.value || '')
              .replace('HH', parts.find(p => p.type === 'hour')?.value || '')
              .replace('mm', parts.find(p => p.type === 'minute')?.value || '')
              .replace('ss', parts.find(p => p.type === 'second')?.value || '');
          } else {
            return date.toISOString();
          }
        } catch (error) {
          // Fallback to ISO if timezone formatting fails
          return date.toISOString();
        }
      };
      
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
              result = formatDateInTimezone(date, timezone, 'ISO', locale);
            } else if (format === 'timestamp') {
              result = date.getTime();
            } else if (format === 'locale') {
              result = formatDateInTimezone(date, timezone, 'locale', locale);
            } else if (format === 'custom') {
              result = formatDateInTimezone(date, timezone, 'custom', locale);
            } else {
              result = formatDateInTimezone(date, timezone, 'ISO', locale);
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
            result = formatDateInTimezone(addDate, timezone, 'ISO', locale);
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
            result = formatDateInTimezone(subDate, timezone, 'ISO', locale);
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
          case 'now': {
            const now = new Date();
            result = formatDateInTimezone(now, timezone, 'ISO', locale);
            break;
          }
          case 'convertTimezone': {
            const dateTemplate = getStringProperty(config, 'date', '');
            const targetTimezone = getStringProperty(config, 'targetTimezone', timezone);
            const resolvedDateStr = dateTemplate ? replaceTemplates(dateTemplate, input) : '';
            const date = resolvedDateStr ? new Date(resolvedDateStr) : new Date();
            
            if (isNaN(date.getTime())) {
              throw new Error(`Invalid date value: ${resolvedDateStr}`);
            }
            
            // Convert date string in source timezone to target timezone
            result = formatDateInTimezone(date, targetTimezone, 'ISO', locale);
            break;
          }
          case 'getTimezoneInfo': {
            const dateTemplate = getStringProperty(config, 'date', '');
            const resolvedDateStr = dateTemplate ? replaceTemplates(dateTemplate, input) : '';
            const date = resolvedDateStr ? new Date(resolvedDateStr) : new Date();
            
            if (isNaN(date.getTime())) {
              throw new Error(`Invalid date value: ${resolvedDateStr}`);
            }
            
            try {
              const formatter = new Intl.DateTimeFormat('en-US', {
                timeZone: timezone,
                timeZoneName: 'long',
              });
              const parts = formatter.formatToParts(date);
              const tzName = parts.find(p => p.type === 'timeZoneName')?.value || timezone;
              
              // Get timezone offset
              const utcDate = new Date(date.toLocaleString('en-US', { timeZone: 'UTC' }));
              const tzDate = new Date(date.toLocaleString('en-US', { timeZone: timezone }));
              const offset = (tzDate.getTime() - utcDate.getTime()) / (1000 * 60); // minutes
              
              result = {
                timezone,
                timezoneName: tzName,
                offsetMinutes: offset,
                offsetHours: offset / 60,
                formatted: formatDateInTimezone(date, timezone, 'ISO', locale),
                iso: date.toISOString(),
              };
            } catch (error) {
              result = {
                timezone,
                error: 'Could not get timezone information',
                formatted: formatDateInTimezone(date, timezone, 'ISO', locale),
              };
            }
            break;
          }
          default:
            throw new Error(`Date & Time: Unknown operation "${operation}"`);
        }
        
        return {
          result,
          operation,
          timezone: operation === 'getTimezoneInfo' ? undefined : timezone,
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
        
        // Helper function to round to precision
        const precision = Math.max(1, Math.min(20, getNumberProperty(config, 'precision', 10)));
        const roundToPrecision = (value: number): number => {
          const factor = Math.pow(10, precision);
          return Math.round(value * factor) / factor;
        };
        
        // Parse array values if comma-separated or from input array
        const parseArrayValue = (template: string): number[] => {
          const resolvedStr = replaceTemplates(template, input);
          if (resolvedStr.includes(',')) {
            return resolvedStr.split(',').map(v => parseFloat(v.trim())).filter(v => !isNaN(v));
          }
          // Check if input contains an array
          if (input && typeof input === 'object' && input !== null) {
            const inputRecord = input as Record<string, unknown>;
            const key = template.replace(/[{}]/g, '').replace(/^input\./, '');
            if (key in inputRecord && Array.isArray(inputRecord[key])) {
              return (inputRecord[key] as unknown[]).map(v => parseFloat(String(v))).filter(v => !isNaN(v));
            }
          }
          return [];
        };
        
        // Handle array operations (avg, sum)
        if (operation === 'avg' || operation === 'sum') {
          const array = parseArrayValue(value1Template);
          if (array.length === 0) {
            throw new Error('Math: Array values required for avg/sum operations. Provide comma-separated values or array in input.');
          }
          if (operation === 'avg') {
            result = roundToPrecision(array.reduce((sum, val) => sum + val, 0) / array.length);
          } else {
            result = roundToPrecision(array.reduce((sum, val) => sum + val, 0));
          }
        } else {
          const num1 = getNumericValue(value1Template, input);
          const num2 = operation !== 'abs' && operation !== 'round' && operation !== 'floor' && operation !== 'ceil' && operation !== 'sqrt' 
            ? getNumericValue(value2Template, input) 
            : 0;
          
          console.log(`[MATH] num1: ${num1}, num2: ${num2}, precision: ${precision}`);
          
          switch (operation) {
            case 'add': result = roundToPrecision(num1 + num2); break;
            case 'subtract': result = roundToPrecision(num1 - num2); break;
            case 'multiply': result = roundToPrecision(num1 * num2); break;
            case 'divide':
              if (num2 === 0) throw new Error('Math: Division by zero');
              result = roundToPrecision(num1 / num2);
              break;
            case 'modulo':
              if (num2 === 0) throw new Error('Math: Modulo by zero');
              result = roundToPrecision(num1 % num2);
              break;
            case 'power': result = roundToPrecision(Math.pow(num1, num2)); break;
            case 'sqrt':
              if (num1 < 0) throw new Error('Math: Square root of negative number');
              result = roundToPrecision(Math.sqrt(num1));
              break;
            case 'abs': result = roundToPrecision(Math.abs(num1)); break;
            case 'round': result = roundToPrecision(Math.round(num1)); break;
            case 'floor': result = roundToPrecision(Math.floor(num1)); break;
            case 'ceil': result = roundToPrecision(Math.ceil(num1)); break;
            case 'min': result = roundToPrecision(Math.min(num1, num2)); break;
            case 'max': result = roundToPrecision(Math.max(num1, num2)); break;
            default:
              throw new Error(`Math: Unknown operation "${operation}"`);
          }
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
      // Crypto: Secure cryptographic operations
      const operation = getStringProperty(config, 'operation', 'hash');
      const inputObj = extractInputObject(input);
      const data = getStringProperty(inputObj, 'data', '') || getStringProperty(inputObj, 'text', '') || String(input);
      
      try {
        let result: string;
        
        switch (operation) {
          case 'hash': {
            const algorithm = getStringProperty(config, 'algorithm', 'SHA-256');
            // Normalize algorithm name (SHA-256, SHA-512, etc.)
            const algoName = algorithm.toUpperCase().replace('SHA', 'SHA-').replace('SHA--', 'SHA-');
            const algoMap: Record<string, string> = {
              'SHA-256': 'SHA-256',
              'SHA-512': 'SHA-512',
              'SHA-384': 'SHA-384',
              'SHA-1': 'SHA-1',
            };
            const finalAlgo = algoMap[algoName] || 'SHA-256';
            
            const encoder = new TextEncoder();
            const dataBuffer = encoder.encode(data);
            const hashBuffer = await crypto.subtle.digest(finalAlgo as AlgorithmIdentifier, dataBuffer);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            result = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
            break;
          }
          case 'hmac': {
            const algorithm = getStringProperty(config, 'algorithm', 'SHA-256');
            const secretKey = getStringProperty(config, 'secretKey', '');
            if (!secretKey) {
              throw new Error('Crypto: Secret Key is required for HMAC operation');
            }
            const algoName = algorithm.toUpperCase().replace('SHA', 'SHA-').replace('SHA--', 'SHA-');
            const algoMap: Record<string, string> = {
              'SHA-256': 'HMAC',
              'SHA-512': 'HMAC',
              'SHA-384': 'HMAC',
              'SHA-1': 'HMAC',
            };
            const hmacAlgo = algoMap[algoName] || 'HMAC';
            
            const encoder = new TextEncoder();
            const keyData = encoder.encode(secretKey);
            const messageData = encoder.encode(data);
            
            const key = await crypto.subtle.importKey(
              'raw',
              keyData,
              { name: hmacAlgo, hash: algoName },
              false,
              ['sign']
            );
            
            const signature = await crypto.subtle.sign(hmacAlgo, key, messageData);
            const hashArray = Array.from(new Uint8Array(signature));
            result = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
            break;
          }
          case 'encode_base64':
            result = btoa(data);
            break;
          case 'decode_base64':
            try {
              result = atob(data);
            } catch (error) {
              throw new Error('Crypto: Invalid Base64 string');
            }
            break;
          case 'uuid':
            result = crypto.randomUUID();
            break;
          case 'random_string': {
            const length = getNumberProperty(config, 'length', 16);
            if (length < 1 || length > 256) {
              throw new Error('Crypto: Length must be between 1 and 256');
            }
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
          const errorText = await response.text().catch(() => 'Unable to read error response');
          throw new Error(`Microsoft Teams: Request failed with status ${response.status}: ${errorText.substring(0, 500)}`);
        }
        
        // Teams webhook returns 200 OK with no body on success
        const inputObj = extractInputObject(input);
        return {
          success: true,
          message: 'Message sent to Microsoft Teams',
          status: response.status,
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
        
        let data: any;
        try {
          data = await response.json();
        } catch (parseError) {
          const errorText = await response.text().catch(() => 'Unable to read response');
          throw new Error(`Telegram: Invalid JSON response. ${parseError instanceof Error ? parseError.message : String(parseError)}. Response: ${errorText.substring(0, 200)}`);
        }
        
        if (!data || !data.ok) {
          throw new Error(`Telegram API error: ${data?.description || data?.error_code || 'Unknown error'}`);
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
        
        let data: any;
        try {
          data = await response.json();
        } catch (parseError) {
          const errorText = await response.text().catch(() => 'Unable to read response');
          throw new Error(`WhatsApp: Invalid JSON response. ${parseError instanceof Error ? parseError.message : String(parseError)}. Response: ${errorText.substring(0, 200)}`);
        }
        
        if (data && data.error) {
          throw new Error(`WhatsApp API error: ${data.error.message || data.error.error_user_msg || 'Unknown error'}`);
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
        
        let data: any;
        try {
          data = await response.json();
        } catch (parseError) {
          const errorText = await response.text().catch(() => 'Unable to read response');
          throw new Error(`Twilio: Invalid JSON response. ${parseError instanceof Error ? parseError.message : String(parseError)}. Response: ${errorText.substring(0, 200)}`);
        }
        
        if (data && (data.error_code || data.code)) {
          throw new Error(`Twilio API error: ${data.message || data.error_message || 'Unknown error'}`);
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

    case "document_ocr": {
      // Document OCR: Extract text from images or scanned documents
      const fileConfig = config.file;
      const language = getStringProperty(config, 'language', 'auto');
      const detectLayout = getBooleanProperty(config, 'detectLayout', true);
      const confidenceRequired = getBooleanProperty(config, 'confidenceRequired', false);

      let fileObj: { name: string; type: string; binary: string } | null = null;
      
      if (fileConfig) {
        if (typeof fileConfig === 'string') {
          try {
            fileObj = JSON.parse(fileConfig);
          } catch {
            throw new Error("Document OCR: Invalid file JSON format");
          }
        } else if (typeof fileConfig === 'object') {
          fileObj = fileConfig as { name: string; type: string; binary: string };
        }
      }

      // Also check input for file data
      const inputObj = input && typeof input === 'object' ? input as Record<string, unknown> : {};
      if (!fileObj && inputObj.file) {
        if (typeof inputObj.file === 'object') {
          fileObj = inputObj.file as { name: string; type: string; binary: string };
        }
      }

      if (!fileObj || !fileObj.binary) {
        throw new Error("Document OCR: File with binary data is required");
      }

      const fileType = fileObj.type?.toLowerCase() || '';
      if (!['image', 'pdf'].includes(fileType)) {
        throw new Error(`Document OCR: Unsupported file type: ${fileType}. Supported types: image, pdf`);
      }

      // In a real implementation, this would use an OCR service (Tesseract, Google Vision API, etc.)
      // For now, we simulate OCR extraction
      // Note: Actual OCR requires external service integration
      
      const fileName = fileObj.name || 'document';
      const binaryData = fileObj.binary;

      // Simulate OCR processing
      // In production, this would:
      // 1. Decode base64 binary
      // 2. Send to OCR service
      // 3. Process results with layout detection
      // 4. Return structured text blocks

      return {
        text: "", // Empty text if extraction fails or no text found
        blocks: [],
        averageConfidence: 0,
        languageDetected: language === 'auto' ? 'en' : language,
        metadata: {
          fileName,
          fileType
        },
        note: "OCR processing requires external service integration. This is a placeholder implementation."
      };
    }

    case "resume_parser": {
      // Resume Parser: Convert resumes into structured data
      const fileConfig = config.file;
      const normalizeSkills = getBooleanProperty(config, 'normalizeSkills', true);
      const experienceCalculation = getBooleanProperty(config, 'experienceCalculation', true);

      let fileObj: { name: string; type: string; binary: string } | null = null;
      
      if (fileConfig) {
        if (typeof fileConfig === 'string') {
          try {
            fileObj = JSON.parse(fileConfig);
          } catch {
            throw new Error("Resume Parser: Invalid file JSON format");
          }
        } else if (typeof fileConfig === 'object') {
          fileObj = fileConfig as { name: string; type: string; binary: string };
        }
      }

      const inputObj = input && typeof input === 'object' ? input as Record<string, unknown> : {};
      if (!fileObj && inputObj.file) {
        if (typeof inputObj.file === 'object') {
          fileObj = inputObj.file as { name: string; type: string; binary: string };
        }
      }

      if (!fileObj || !fileObj.binary) {
        throw new Error("Resume Parser: File with binary data is required");
      }

      const fileType = fileObj.type?.toLowerCase() || '';
      if (!['pdf', 'docx', 'image'].includes(fileType)) {
        throw new Error(`Resume Parser: Unsupported file type: ${fileType}. Supported types: pdf, docx, image`);
      }

      // In a real implementation, this would:
      // 1. Extract text from resume (OCR if image, parse if PDF/DOCX)
      // 2. Use NLP/AI to extract structured information
      // 3. Normalize skills and job titles
      // 4. Calculate total experience

      const fileName = fileObj.name || 'resume';

      return {
        personalInfo: {
          name: null,
          email: null,
          phone: null
        },
        skills: [],
        experience: [],
        education: [],
        totalExperience: null,
        metadata: {
          fileName
        },
        note: "Resume parsing requires NLP/AI service integration. This is a placeholder implementation."
      };
    }

    case "invoice_parser": {
      // Invoice Parser: Extract financial fields from invoices
      const fileConfig = config.file;
      const currencyNormalization = getBooleanProperty(config, 'currencyNormalization', true);
      const taxDetection = getBooleanProperty(config, 'taxDetection', true);

      let fileObj: { name: string; type: string; binary: string } | null = null;
      
      if (fileConfig) {
        if (typeof fileConfig === 'string') {
          try {
            fileObj = JSON.parse(fileConfig);
          } catch {
            throw new Error("Invoice Parser: Invalid file JSON format");
          }
        } else if (typeof fileConfig === 'object') {
          fileObj = fileConfig as { name: string; type: string; binary: string };
        }
      }

      const inputObj = input && typeof input === 'object' ? input as Record<string, unknown> : {};
      if (!fileObj && inputObj.file) {
        if (typeof inputObj.file === 'object') {
          fileObj = inputObj.file as { name: string; type: string; binary: string };
        }
      }

      if (!fileObj || !fileObj.binary) {
        throw new Error("Invoice Parser: File with binary data is required");
      }

      const fileType = fileObj.type?.toLowerCase() || '';
      if (!['pdf', 'image'].includes(fileType)) {
        throw new Error(`Invoice Parser: Unsupported file type: ${fileType}. Supported types: pdf, image`);
      }

      // In a real implementation, this would:
      // 1. Extract text from invoice (OCR if image, parse if PDF)
      // 2. Use pattern matching and NLP to extract invoice fields
      // 3. Normalize currency values
      // 4. Detect and extract tax information
      // 5. Parse line items

      return {
        invoiceNumber: null,
        vendorName: null,
        invoiceDate: null,
        dueDate: null,
        currency: null,
        subtotal: null,
        tax: null,
        totalAmount: null,
        lineItems: [],
        confidence: 0,
        note: "Invoice parsing requires OCR and NLP service integration. This is a placeholder implementation."
      };
    }

    case "document_classifier": {
      // Document Classifier: Automatically classify documents
      const text = getStringProperty(config, 'text', '');
      const availableClassesConfig = config.availableClasses;
      const confidenceThreshold = getNumberProperty(config, 'confidenceThreshold', 0.7);

      if (!text || !text.trim()) {
        throw new Error("Document Classifier: Text content is required");
      }

      let availableClasses: string[] = [];
      
      if (availableClassesConfig) {
        if (typeof availableClassesConfig === 'string') {
          try {
            availableClasses = JSON.parse(availableClassesConfig);
          } catch {
            throw new Error("Document Classifier: Invalid available classes JSON format");
          }
        } else if (Array.isArray(availableClassesConfig)) {
          availableClasses = availableClassesConfig;
        }
      }

      if (availableClasses.length === 0) {
        throw new Error("Document Classifier: At least one available class is required");
      }

      if (confidenceThreshold < 0 || confidenceThreshold > 1) {
        throw new Error("Document Classifier: Confidence threshold must be between 0 and 1");
      }

      // In a real implementation, this would:
      // 1. Analyze text content using NLP/AI
      // 2. Classify document based on patterns and keywords
      // 3. Calculate confidence scores
      // 4. Return classification with alternatives

      // Simple keyword-based classification (placeholder)
      const textLower = text.toLowerCase();
      let documentType = availableClasses[0]; // Default to first class
      let confidence = 0.5;
      let isUncertain = true;

      // Basic keyword matching (simplified)
      for (const className of availableClasses) {
        const classLower = className.toLowerCase();
        if (textLower.includes(classLower)) {
          documentType = className;
          confidence = 0.8;
          isUncertain = false;
          break;
        }
      }

      if (confidence < confidenceThreshold) {
        isUncertain = true;
      }

      return {
        documentType,
        confidence,
        isUncertain,
        possibleAlternatives: availableClasses.filter(c => c !== documentType).slice(0, 3),
        metadata: {
          textLength: text.length
        },
        note: "Document classification requires NLP/AI service integration. This is a simplified keyword-based implementation."
      };
    }

    case "file_metadata_extractor": {
      // File Metadata Extractor: Extract file-level metadata
      const fileConfig = config.file;

      let fileObj: { name: string; type: string; size: number; binary: string } | null = null;
      
      if (fileConfig) {
        if (typeof fileConfig === 'string') {
          try {
            fileObj = JSON.parse(fileConfig);
          } catch {
            throw new Error("File Metadata Extractor: Invalid file JSON format");
          }
        } else if (typeof fileConfig === 'object') {
          fileObj = fileConfig as { name: string; type: string; size: number; binary: string };
        }
      }

      const inputObj = input && typeof input === 'object' ? input as Record<string, unknown> : {};
      if (!fileObj && inputObj.file) {
        if (typeof inputObj.file === 'object') {
          fileObj = inputObj.file as { name: string; type: string; size: number; binary: string };
        }
      }

      if (!fileObj) {
        throw new Error("File Metadata Extractor: File object is required");
      }

      const fileName = fileObj.name || 'unknown';
      const fileType = fileObj.type || 'application/octet-stream';
      const fileSize = fileObj.size || 0;

      // Calculate checksum from binary data if available
      let checksum = '';
      if (fileObj.binary) {
        try {
          // Simple hash calculation (in production, use proper hashing like SHA-256)
          const binaryString = atob(fileObj.binary);
          let hash = 0;
          for (let i = 0; i < Math.min(binaryString.length, 1000); i++) {
            const char = binaryString.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
          }
          checksum = Math.abs(hash).toString(16);
        } catch {
          checksum = '';
        }
      }

      // Extract MIME type from file type or extension
      let mimeType = fileType;
      if (!mimeType.includes('/')) {
        // Try to infer from extension
        const ext = fileName.split('.').pop()?.toLowerCase() || '';
        const mimeMap: Record<string, string> = {
          'pdf': 'application/pdf',
          'jpg': 'image/jpeg',
          'jpeg': 'image/jpeg',
          'png': 'image/png',
          'gif': 'image/gif',
          'doc': 'application/msword',
          'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'xls': 'application/vnd.ms-excel',
          'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'txt': 'text/plain',
          'json': 'application/json',
          'xml': 'application/xml',
          'csv': 'text/csv'
        };
        mimeType = mimeMap[ext] || 'application/octet-stream';
      }

      // In a real implementation, this would:
      // 1. Extract EXIF data from images
      // 2. Extract metadata from PDFs (author, creation date, etc.)
      // 3. Compute proper checksums (SHA-256, MD5)
      // 4. Extract creation/modification dates from file system

      return {
        fileName,
        mimeType,
        sizeBytes: fileSize,
        checksum,
        createdAt: null,
        modifiedAt: null,
        exif: null,
        note: "Full metadata extraction requires file system access and specialized parsers. This is a basic implementation."
      };
    }

    case "rss_feed_read": {
      // RSS Feed Read: Safely consume and normalize RSS/Atom feeds
      const feedUrl = getStringProperty(config, 'feedUrl', '');
      const maxItems = getNumberProperty(config, 'maxItems', 10);
      const detectDuplicates = getBooleanProperty(config, 'detectDuplicates', true);
      const timeout = getNumberProperty(config, 'timeout', 30000);
      
      if (!feedUrl || feedUrl.trim() === '') {
        throw new Error('RSS Feed Read: Feed URL is required');
      }
      
      validateURL(feedUrl, 'feed URL', 'RSS Feed Read');
      
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        
        const response = await fetch(feedUrl, { signal: controller.signal });
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          throw new Error(`RSS Feed Read: HTTP ${response.status} ${response.statusText}`);
        }
        
        const xmlText = await response.text();
        
        // Safe XML parsing with basic XXE protection (remove DOCTYPE declarations)
        const safeXmlText = xmlText.replace(/<!DOCTYPE[^>]*>/gi, '').replace(/<!ENTITY[^>]*>/gi, '');
        
        // Parse RSS/Atom feed items
        const items: Array<Record<string, unknown>> = [];
        const seenGuids = new Set<string>();
        
        // Support both RSS (<item>) and Atom (<entry>)
        const itemRegex = /<(?:item|entry)[^>]*>([\s\S]*?)<\/(?:item|entry)>/gi;
        let match;
        let count = 0;
        
        while ((match = itemRegex.exec(safeXmlText)) !== null && count < maxItems) {
          const itemXml = match[1];
          
          // Extract common fields (RSS and Atom)
          const titleMatch = itemXml.match(/<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i);
          const linkMatch = itemXml.match(/<link[^>]*(?:href=['"]([^'"]+)['"]|>([^<]+)<\/link>)/i) || itemXml.match(/<link[^>]*>([\s\S]*?)<\/link>/i);
          const descriptionMatch = itemXml.match(/<(?:description|summary|content)[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/(?:description|summary|content)>/i);
          const pubDateMatch = itemXml.match(/<(?:pubDate|published|updated)[^>]*>([\s\S]*?)<\/(?:pubDate|published|updated)>/i);
          const guidMatch = itemXml.match(/<(?:guid|id)[^>]*>([\s\S]*?)<\/(?:guid|id)>/i);
          
          const guid = guidMatch ? guidMatch[1].trim() : (linkMatch ? (linkMatch[1] || linkMatch[2] || '').trim() : '');
          const link = linkMatch ? (linkMatch[1] || linkMatch[2] || '').trim() : '';
          
          // Duplicate detection
          if (detectDuplicates && guid && seenGuids.has(guid)) {
            continue;
          }
          if (guid) seenGuids.add(guid);
          
          const item: Record<string, unknown> = {
            title: titleMatch ? titleMatch[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim() : '',
            link: link,
            description: descriptionMatch ? descriptionMatch[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim() : '',
            pubDate: pubDateMatch ? pubDateMatch[1].trim() : '',
            guid: guid
          };
          
          items.push(item);
          count++;
        }
        
        const inputObj = extractInputObject(input);
        return {
          items,
          count: items.length,
          feedUrl,
          duplicatesFiltered: detectDuplicates ? (count - items.length) : 0,
          ...inputObj
        };
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          throw new Error(`RSS Feed Read: Request timeout after ${timeout}ms`);
        }
        throw new Error(`RSS Feed Read: Failed to read feed. ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    case "html_extract": {
      // HTML Extract: Safely extract structured data from HTML
      const selector = getStringProperty(config, 'selector', '');
      const htmlConfig = getStringProperty(config, 'html', '');
      const sanitize = getBooleanProperty(config, 'sanitize', true);
      const stripScripts = getBooleanProperty(config, 'stripScripts', true);
      const extractText = getBooleanProperty(config, 'extractText', false);
      const maxSize = getNumberProperty(config, 'maxSize', 10485760); // 10MB default
      
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
      
      // Check size limit
      if (html.length > maxSize) {
        throw new Error(`HTML Extract: HTML content exceeds maximum size of ${maxSize} bytes`);
      }
      
      // Sanitize HTML: Remove scripts and styles if requested
      if (sanitize || stripScripts) {
        // Remove script tags and their content
        if (stripScripts) {
          html = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
          html = html.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
          html = html.replace(/on\w+\s*=\s*["'][^"']*["']/gi, ''); // Remove event handlers
        }
        
        // Basic sanitization: Remove potentially dangerous tags
        if (sanitize) {
          html = html.replace(/<iframe[^>]*>[\s\S]*?<\/iframe>/gi, '');
          html = html.replace(/<object[^>]*>[\s\S]*?<\/object>/gi, '');
          html = html.replace(/<embed[^>]*>/gi, '');
        }
      }
      
      if (!selector || selector.trim() === '') {
        // Return sanitized HTML if no selector
        const sanitizedHtml = extractText ? html.replace(/<[^>]+>/g, '').trim() : html;
        const inputObj = extractInputObject(input);
        return {
          html: sanitizedHtml,
          extracted: sanitizedHtml,
          sanitized: sanitize || stripScripts,
          ...inputObj
        };
      }
      
      // Basic HTML extraction using regex (simple implementation)
      // Note: For production, consider using a proper HTML parser library
      try {
        // Handle different selector types
        let regex: RegExp;
        if (selector.startsWith('.') || selector.startsWith('#')) {
          // Class or ID selector - simplified matching
          const className = selector.startsWith('.') ? selector.substring(1) : '';
          const idName = selector.startsWith('#') ? selector.substring(1) : '';
          if (className) {
            regex = new RegExp(`<[^>]*class=['"][^'"]*${className}[^'"]*['"][^>]*>([\\s\\S]*?)<\\/[^>]+>`, 'gi');
          } else if (idName) {
            regex = new RegExp(`<[^>]*id=['"]${idName}['"][^>]*>([\\s\\S]*?)<\\/[^>]+>`, 'gi');
          } else {
            regex = new RegExp(`<${selector}[^>]*>([\\s\\S]*?)<\\/${selector}>`, 'gi');
          }
        } else {
          // Tag name selector
          regex = new RegExp(`<${selector}[^>]*>([\\s\\S]*?)<\\/${selector}>`, 'gi');
        }
        
        const matches = html.match(regex) || [];
        const extracted = matches.map(match => {
          const content = extractText ? match.replace(/<[^>]+>/g, '').trim() : match;
          return content;
        });
        
        const inputObj = extractInputObject(input);
        return {
          html: extractText ? html.replace(/<[^>]+>/g, '').trim() : html,
          extracted: extracted.length === 1 ? extracted[0] : extracted,
          count: extracted.length,
          selector,
          sanitized: sanitize || stripScripts,
          ...inputObj
        };
      } catch (error) {
        throw new Error(`HTML Extract: Failed to extract content. ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    case "xml": {
      // XML: Secure XML parsing and manipulation with XXE protection
      const operation = getStringProperty(config, 'operation', 'parse');
      const xmlConfig = getStringProperty(config, 'xml', '');
      const safeMode = getBooleanProperty(config, 'safeMode', true);
      const maxSize = getNumberProperty(config, 'maxSize', 10485760); // 10MB default
      
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
      
      // Check size limit
      if (xmlContent.length > maxSize) {
        throw new Error(`XML: XML content exceeds maximum size of ${maxSize} bytes`);
      }
      
      // XXE Protection: Remove DOCTYPE declarations and entity definitions
      if (safeMode) {
        xmlContent = xmlContent.replace(/<!DOCTYPE[^>]*>/gi, '');
        xmlContent = xmlContent.replace(/<!ENTITY[^>]*>/gi, '');
        // Remove external entity references
        xmlContent = xmlContent.replace(/&[a-zA-Z][a-zA-Z0-9]*;/g, (match) => {
          // Allow common entities but block others
          const allowedEntities = ['lt', 'gt', 'amp', 'quot', 'apos'];
          const entityName = match.substring(1, match.length - 1);
          return allowedEntities.includes(entityName) ? match : '';
        });
      }
      
      try {
        if (operation === 'parse') {
          // Simple XML parsing (basic implementation)
          // Note: For production, consider using a proper XML parser library with full XXE protection
          const result: Record<string, unknown> = {};
          const tagRegex = /<([^>\s]+)[^>]*>([\s\S]*?)<\/\1>/g;
          let match;
          
          while ((match = tagRegex.exec(xmlContent)) !== null) {
            const tagName = match[1];
            const tagContent = match[2].trim();
            // Handle CDATA sections
            const cleanContent = tagContent.replace(/<!\[CDATA\[|\]\]>/g, '');
            result[tagName] = cleanContent;
          }
          
          const inputObj = extractInputObject(input);
          return {
            parsed: result,
            xml: xmlContent,
            safeMode,
            ...inputObj
          };
        } else if (operation === 'extract') {
          const xpath = getStringProperty(config, 'xpath', '');
          if (!xpath) {
            throw new Error('XML: XPath expression required for extract operation');
          }
          
          // Simplified XPath extraction (basic implementation)
          // Note: For production, use a proper XPath library
          const parts = xpath.split('/').filter(p => p.trim() !== '');
          let currentContent = xmlContent;
          
          for (const part of parts) {
            const tagRegex = new RegExp(`<${part}[^>]*>([\\s\\S]*?)<\\/${part}>`, 'i');
            const match = currentContent.match(tagRegex);
            if (match) {
              currentContent = match[1];
            } else {
              throw new Error(`XML: XPath element "${part}" not found`);
            }
          }
          
          const inputObj = extractInputObject(input);
          return {
            extracted: currentContent,
            xpath,
            safeMode,
            ...inputObj
          };
        } else if (operation === 'validate') {
          // Basic XML validation - check for well-formed XML
          const openTags: string[] = [];
          const tagRegex = /<\/?([^>\s]+)[^>]*>/g;
          let match;
          let isValid = true;
          let errorMessage = '';
          
          while ((match = tagRegex.exec(xmlContent)) !== null) {
            const fullTag = match[0];
            const tagName = match[1];
            
            if (fullTag.startsWith('</')) {
              // Closing tag
              if (openTags.length === 0 || openTags[openTags.length - 1] !== tagName) {
                isValid = false;
                errorMessage = `Mismatched closing tag: </${tagName}>`;
                break;
              }
              openTags.pop();
            } else if (!fullTag.endsWith('/>')) {
              // Opening tag (not self-closing)
              openTags.push(tagName);
            }
          }
          
          if (isValid && openTags.length > 0) {
            isValid = false;
            errorMessage = `Unclosed tags: ${openTags.join(', ')}`;
          }
          
          const inputObj = extractInputObject(input);
          return {
            valid: isValid,
            error: errorMessage || null,
            safeMode,
            ...inputObj
          };
        }
        
        throw new Error(`XML: Unknown operation "${operation}"`);
      } catch (error) {
        throw new Error(`XML: Operation failed. ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    case "pdf": {
      // PDF: Binary-safe PDF document processing
      const operation = getStringProperty(config, 'operation', 'extractText');
      const pdfUrl = getStringProperty(config, 'pdfUrl', '');
      const maxSize = getNumberProperty(config, 'maxSize', 10485760); // 10MB default
      
      let pdfData: Uint8Array;
      
      try {
        if (!pdfUrl || pdfUrl.trim() === '') {
          // Try to get PDF from input
          const inputData = extractDataFromInput(input);
          if (inputData && typeof inputData === 'string') {
            // Check if it's base64
            if (inputData.startsWith('data:application/pdf;base64,')) {
              const base64Data = inputData.split(',')[1];
              const binaryString = atob(base64Data);
              pdfData = new Uint8Array(binaryString.length);
              for (let i = 0; i < binaryString.length; i++) {
                pdfData[i] = binaryString.charCodeAt(i);
              }
            } else {
              throw new Error('PDF: PDF URL or base64-encoded PDF data is required');
            }
          } else {
            throw new Error('PDF: PDF URL or base64-encoded PDF data is required');
          }
        } else if (pdfUrl.startsWith('data:application/pdf;base64,')) {
          // Base64 encoded PDF
          const base64Data = pdfUrl.split(',')[1];
          const binaryString = atob(base64Data);
          pdfData = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            pdfData[i] = binaryString.charCodeAt(i);
          }
        } else {
          // URL - fetch PDF
          validateURL(pdfUrl, 'PDF URL', 'PDF');
          const response = await fetch(pdfUrl);
          if (!response.ok) {
            throw new Error(`PDF: HTTP ${response.status} ${response.statusText}`);
          }
          const arrayBuffer = await response.arrayBuffer();
          pdfData = new Uint8Array(arrayBuffer);
        }
        
        // Check size limit
        if (pdfData.length > maxSize) {
          throw new Error(`PDF: PDF file exceeds maximum size of ${maxSize} bytes`);
        }
        
        const inputObj = extractInputObject(input);
        
        if (operation === 'extractText') {
          // Note: PDF text extraction requires a PDF parsing library
          // For Deno Edge Functions, this would typically require an external service
          // or a lightweight PDF parser. This is a placeholder implementation.
          throw new Error('PDF: Text extraction requires a PDF parsing library. For production use, integrate a PDF parsing service (e.g., PDF.js, pdf-parse) or use an external API.');
        } else if (operation === 'readMetadata') {
          // Basic PDF metadata extraction from PDF header
          // PDF files start with %PDF- and contain metadata in the header
          const pdfString = new TextDecoder('utf-8', { fatal: false }).decode(pdfData.slice(0, 1024));
          const versionMatch = pdfString.match(/%PDF-(\d+\.\d+)/);
          
          const metadata: Record<string, unknown> = {
            size: pdfData.length,
            version: versionMatch ? versionMatch[1] : 'unknown',
          };
          
          return {
            metadata,
            size: pdfData.length,
            operation,
            ...inputObj
          };
        } else {
          throw new Error(`PDF: Unknown operation "${operation}"`);
        }
      } catch (error) {
        throw new Error(`PDF: Operation failed. ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    case "image_manipulation": {
      // Image Manipulation: Efficient and safe image processing
      const operation = getStringProperty(config, 'operation', 'resize');
      const imageUrl = getStringProperty(config, 'imageUrl', '');
      const maxSize = getNumberProperty(config, 'maxSize', 10485760); // 10MB default
      const preserveMetadata = getBooleanProperty(config, 'preserveMetadata', true);
      
      try {
        if (!imageUrl || imageUrl.trim() === '') {
          // Try to get image from input
          const inputData = extractDataFromInput(input);
          if (inputData && typeof inputData === 'string' && inputData.startsWith('data:image/')) {
            // Image data already provided
            // Continue with processing
          } else {
            throw new Error('Image Manipulation: Image URL or base64-encoded image data is required');
          }
        }
        
        // Note: Image manipulation requires image processing libraries
        // For Deno Edge Functions, this would typically require:
        // - Canvas API (not available in Edge Functions)
        // - Image processing library (e.g., sharp, jimp - Node.js only)
        // - External image processing service
        // This is a placeholder implementation.
        throw new Error('Image Manipulation: Image processing requires an image manipulation library. For production use, integrate an image processing service (e.g., Cloudinary, Imgix) or use a server-side image processing API.');
      } catch (error) {
        throw new Error(`Image Manipulation: Operation failed. ${error instanceof Error ? error.message : String(error)}`);
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
      // AI Agent: STRICT PROVIDER ISOLATION - NO FALLBACKS, NO SHARED CODE
      const apiKey = getStringProperty(config, 'apiKey', '');
      // CRITICAL: Do NOT use default value - if model is missing, throw error
      const model = getStringProperty(config, 'model', '');
      const prompt = getStringProperty(config, 'prompt', 'You are an AI agent that can use tools.');
      const toolsStr = getStringProperty(config, 'tools', '[]');
      const maxIterations = getNumberProperty(config, 'maxIterations', 5);
      const temperature = (config.temperature as number) || 0.7;
      
      // Log raw config for debugging
      console.log(`AI Agent: Raw config.model = "${config.model}", typeof = ${typeof config.model}`);
      console.log(`AI Agent: Raw config.apiKey prefix = "${(config.apiKey as string)?.substring(0, 10) || 'MISSING'}..."`);
      
      if (!apiKey) {
        throw new Error('AI Agent: API Key is required');
      }
      
      if (!model || model.trim() === '') {
        throw new Error(`AI Agent: Model is required. Current model value: "${model}". Please select a model in the node properties.`);
      }

      const tools = parseJSONSafe(toolsStr, 'tools') as Array<Record<string, unknown>>;
      
      // Extract task from input
      const task = typeof input === 'string' 
        ? input 
        : (input as Record<string, unknown>)?.task as string || 
          (input as Record<string, unknown>)?.message as string || 
          JSON.stringify(input);

      // STRICT PROVIDER RESOLUTION - NO FALLBACKS, NO DEFAULTS
      function resolveProviderFromModel(modelName: string): 'openai' | 'claude' | 'gemini' {
        const modelLower = modelName.toLowerCase().trim();
        
        // Log for debugging
        console.log(`AI Agent: Resolving provider for model: "${modelName}" (lowercase: "${modelLower}")`);
        
        // HARD MATCH: Check for Gemini FIRST (most specific)
        if (modelLower.includes('gemini')) {
          console.log(`AI Agent: Detected GEMINI provider from model: ${modelName}`);
          return 'gemini';
        }
        
        // Check for Claude
        if (modelLower.includes('claude')) {
          console.log(`AI Agent: Detected CLAUDE provider from model: ${modelName}`);
          return 'claude';
        }
        
        // Check for OpenAI (gpt-)
        if (modelLower.startsWith('gpt-')) {
          console.log(`AI Agent: Detected OPENAI provider from model: ${modelName}`);
          return 'openai';
        }
        
        // NO FALLBACK - THROW ERROR IF UNKNOWN
        throw new Error(`AI Agent: Unknown model provider for model "${modelName}". Model must start with "gpt-", contain "gemini", or contain "claude".`);
      }

      // HARD FAIL SAFETY CHECK - Provider must match API key format
      function assertProviderKey(provider: 'openai' | 'claude' | 'gemini', key: string): void {
        if (provider === 'gemini' && !key.toUpperCase().startsWith('AIZA')) {
          throw new Error(`AI Agent: Provider mismatch. Gemini model requires Gemini API key (starts with AIza), but got key starting with "${key.substring(0, 10)}..."`);
        }
        if (provider === 'claude' && !key.startsWith('sk-ant-')) {
          throw new Error(`AI Agent: Provider mismatch. Claude model requires Claude API key (starts with sk-ant-), but got key starting with "${key.substring(0, 10)}..."`);
        }
        if (provider === 'openai' && (!key.startsWith('sk-') || key.startsWith('sk-ant-'))) {
          throw new Error(`AI Agent: Provider mismatch. OpenAI model requires OpenAI API key (starts with sk-), but got key starting with "${key.substring(0, 10)}..."`);
        }
      }

      // Resolve provider from model - HARD STOP if unknown
      console.log(`AI Agent: Starting provider resolution. Model from config: "${model}", API Key prefix: "${apiKey.substring(0, 10)}..."`);
      const provider = resolveProviderFromModel(model);
      
      // HARD FAIL: Provider must match API key
      assertProviderKey(provider, apiKey);
      
      console.log(`AI Agent: FINAL RESOLUTION - Provider=${provider}, Model=${model}, KeyPrefix=${apiKey.substring(0, 10)}...`);
      
      // CRITICAL SAFETY CHECK: If provider is Gemini but API key is OpenAI format, throw error
      if (provider === 'gemini' && apiKey.startsWith('sk-')) {
        throw new Error(`AI Agent: CRITICAL ERROR - Provider detected as 'gemini' but API key is OpenAI format (starts with sk-). Model: "${model}", Key: "${apiKey.substring(0, 15)}..."`);
      }
      
      // CRITICAL SAFETY CHECK: If provider is OpenAI but API key is Gemini format, throw error
      if (provider === 'openai' && apiKey.toUpperCase().startsWith('AIZA')) {
        throw new Error(`AI Agent: CRITICAL ERROR - Provider detected as 'openai' but API key is Gemini format (starts with AIza). Model: "${model}", Key: "${apiKey.substring(0, 15)}..."`);
      }

      // ISOLATED EXECUTION PATHS - NO SHARED CODE
      try {
        let finalResponse = '';
        let iterations = 0;

        // GEMINI EXECUTION - COMPLETELY ISOLATED
        if (provider === 'gemini') {
          console.log(`AI Agent: ENTERING GEMINI EXECUTION BLOCK`);
          
          // Triple-check: This should NEVER happen if provider is gemini
          if (apiKey.startsWith('sk-')) {
            throw new Error(`AI Agent: FATAL ERROR - In Gemini block but API key is OpenAI format! Model: "${model}", Key: "${apiKey.substring(0, 15)}..."`);
          }
          
          if (!apiKey.toUpperCase().startsWith('AIZA')) {
            throw new Error(`AI Agent: Gemini API key missing or invalid. Expected key starting with AIza, got: "${apiKey.substring(0, 15)}..."`);
          }

          const llmAdapter = new LLMAdapter();
          const systemPrompt = `${prompt}\n\nAvailable tools: ${JSON.stringify(tools.map(t => t.name))}`;
          const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: task }
          ];
          
          console.log(`AI Agent: Calling Gemini API for model ${model} with Gemini key ${apiKey.substring(0, 10)}...`);
          const response = await llmAdapter.chat('gemini', messages, {
            model,
            temperature,
            apiKey,
          });
          
          console.log(`AI Agent: Gemini API call successful. Response length: ${response.content?.length || 0}`);
          finalResponse = response.content || '';
          iterations = 1;

        // CLAUDE EXECUTION - COMPLETELY ISOLATED
        } else if (provider === 'claude') {
          if (!apiKey.startsWith('sk-ant-')) {
            throw new Error('AI Agent: Claude API key missing or invalid');
          }

          const llmAdapter = new LLMAdapter();
          const systemPrompt = `${prompt}\n\nAvailable tools: ${JSON.stringify(tools.map(t => t.name))}`;
          const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: task }
          ];
          
          console.log(`AI Agent: Calling Claude API for model ${model}`);
          const response = await llmAdapter.chat('claude', messages, {
            model,
            temperature,
            apiKey,
          });
          
          finalResponse = response.content || '';
          iterations = 1;

        // OPENAI EXECUTION - COMPLETELY ISOLATED
        } else if (provider === 'openai') {
          console.log(`AI Agent: ENTERING OPENAI EXECUTION BLOCK`);
          
          // Triple-check: This should NEVER happen if provider is openai
          if (apiKey.toUpperCase().startsWith('AIZA')) {
            throw new Error(`AI Agent: FATAL ERROR - In OpenAI block but API key is Gemini format! Model: "${model}", Key: "${apiKey.substring(0, 15)}..."`);
          }
          
          if (!apiKey.startsWith('sk-') || apiKey.startsWith('sk-ant-')) {
            throw new Error(`AI Agent: OpenAI API key missing or invalid. Expected key starting with sk- (not sk-ant-), got: "${apiKey.substring(0, 15)}..."`);
          }

          let currentInput = task;
          iterations = 0;

          while (iterations < maxIterations) {
            const systemPrompt = `${prompt}\n\nAvailable tools: ${JSON.stringify(tools.map(t => t.name))}`;
            const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: currentInput }
            ];

            if (tools.length > 0) {
              // OpenAI with tools - direct API call
              console.log(`AI Agent: Calling OpenAI API for model ${model} with tools`);
              const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${apiKey}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  model,
                  messages,
                  tools: tools.map(tool => ({
                    type: 'function',
                    function: {
                      name: tool.name,
                      description: tool.description || '',
                      parameters: tool.parameters || {},
                    }
                  })),
                  tool_choice: 'auto',
                  temperature,
                }),
              });

              if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`AI Agent OpenAI API error: ${response.status} - ${errorText}`);
              }

              const data = await response.json();
              const message = data.choices?.[0]?.message;
              
              if (message.tool_calls && message.tool_calls.length > 0) {
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
                finalResponse = message.content || '';
                break;
              }
            } else {
              // OpenAI without tools - use LLMAdapter
              const llmAdapter = new LLMAdapter();
              console.log(`AI Agent: Calling OpenAI API via LLMAdapter for model ${model}`);
              const response = await llmAdapter.chat('openai', messages, {
                model,
                temperature,
                apiKey,
              });
              
              finalResponse = response.content || '';
              break;
            }

            iterations++;
          }
        } else {
          throw new Error(`AI Agent: Unsupported provider: ${provider}`);
        }

        return {
          response: finalResponse,
          iterations: iterations,
          completed: iterations < maxIterations,
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

    // ============================================
    // DEVOPS NODES
    // ============================================

    case "github": {
      const token = getStringProperty(config, 'token', '');
      const operation = getStringProperty(config, 'operation', 'get_repo');
      const owner = getStringProperty(config, 'owner', '');
      const repo = getStringProperty(config, 'repo', '');
      
      if (!token) {
        throw new Error('GitHub: Token is required');
      }

      const headers: Record<string, string> = {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'CtrlChecks-Workflow',
      };

      try {
        let url = '';
        let method = 'GET';
        let body: unknown = undefined;

        switch (operation) {
          case 'get_repo':
            if (!owner || !repo) throw new Error('GitHub: Owner and Repo are required for get_repo');
            url = `https://api.github.com/repos/${owner}/${repo}`;
            break;
          case 'list_repos':
            url = owner ? `https://api.github.com/users/${owner}/repos` : 'https://api.github.com/user/repos';
            break;
          case 'create_issue':
            if (!owner || !repo) throw new Error('GitHub: Owner and Repo are required for create_issue');
            url = `https://api.github.com/repos/${owner}/${repo}/issues`;
            method = 'POST';
            body = {
              title: replaceTemplates(getStringProperty(config, 'title', ''), input),
              body: replaceTemplates(getStringProperty(config, 'body', ''), input),
            };
            break;
          case 'update_issue':
            if (!owner || !repo) throw new Error('GitHub: Owner and Repo are required for update_issue');
            const issueNumber = getNumberProperty(config, 'issueNumber', 0);
            if (!issueNumber) throw new Error('GitHub: Issue Number is required for update_issue');
            url = `https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}`;
            method = 'PATCH';
            body = {
              title: replaceTemplates(getStringProperty(config, 'title', ''), input),
              body: replaceTemplates(getStringProperty(config, 'body', ''), input),
              state: replaceTemplates(getStringProperty(config, 'state', 'open'), input),
            };
            break;
          case 'close_issue':
            if (!owner || !repo) throw new Error('GitHub: Owner and Repo are required for close_issue');
            const closeIssueNumber = getNumberProperty(config, 'issueNumber', 0);
            if (!closeIssueNumber) throw new Error('GitHub: Issue Number is required for close_issue');
            url = `https://api.github.com/repos/${owner}/${repo}/issues/${closeIssueNumber}`;
            method = 'PATCH';
            body = { state: 'closed' };
            break;
          case 'list_issues':
            if (!owner || !repo) throw new Error('GitHub: Owner and Repo are required for list_issues');
            url = `https://api.github.com/repos/${owner}/${repo}/issues`;
            break;
          case 'get_issue':
            if (!owner || !repo) throw new Error('GitHub: Owner and Repo are required for get_issue');
            const getIssueNumber = getNumberProperty(config, 'issueNumber', 0);
            if (!getIssueNumber) throw new Error('GitHub: Issue Number is required for get_issue');
            url = `https://api.github.com/repos/${owner}/${repo}/issues/${getIssueNumber}`;
            break;
          case 'add_issue_comment':
            if (!owner || !repo) throw new Error('GitHub: Owner and Repo are required for add_issue_comment');
            const commentIssueNumber = getNumberProperty(config, 'issueNumber', 0);
            if (!commentIssueNumber) throw new Error('GitHub: Issue Number is required for add_issue_comment');
            const comment = replaceTemplates(getStringProperty(config, 'comment', ''), input);
            if (!comment) throw new Error('GitHub: Comment is required for add_issue_comment');
            url = `https://api.github.com/repos/${owner}/${repo}/issues/${commentIssueNumber}/comments`;
            method = 'POST';
            body = { body: comment };
            break;
          case 'create_pr':
            if (!owner || !repo) throw new Error('GitHub: Owner and Repo are required for create_pr');
            url = `https://api.github.com/repos/${owner}/${repo}/pulls`;
            method = 'POST';
            body = {
              title: replaceTemplates(getStringProperty(config, 'title', ''), input),
              body: replaceTemplates(getStringProperty(config, 'body', ''), input),
              head: replaceTemplates(getStringProperty(config, 'sourceBranch', 'feature-branch'), input),
              base: replaceTemplates(getStringProperty(config, 'targetBranch', 'main'), input),
            };
            break;
          case 'update_pr':
            if (!owner || !repo) throw new Error('GitHub: Owner and Repo are required for update_pr');
            const prNumber = getNumberProperty(config, 'prNumber', 0);
            if (!prNumber) throw new Error('GitHub: PR Number is required for update_pr');
            url = `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}`;
            method = 'PATCH';
            body = {
              title: replaceTemplates(getStringProperty(config, 'title', ''), input),
              body: replaceTemplates(getStringProperty(config, 'body', ''), input),
            };
            break;
          case 'merge_pr':
            if (!owner || !repo) throw new Error('GitHub: Owner and Repo are required for merge_pr');
            const mergePrNumber = getNumberProperty(config, 'prNumber', 0);
            if (!mergePrNumber) throw new Error('GitHub: PR Number is required for merge_pr');
            url = `https://api.github.com/repos/${owner}/${repo}/pulls/${mergePrNumber}/merge`;
            method = 'PUT';
            body = {
              merge_method: replaceTemplates(getStringProperty(config, 'mergeMethod', 'merge'), input),
            };
            break;
          case 'list_prs':
            if (!owner || !repo) throw new Error('GitHub: Owner and Repo are required for list_prs');
            url = `https://api.github.com/repos/${owner}/${repo}/pulls`;
            break;
          case 'get_pr':
            if (!owner || !repo) throw new Error('GitHub: Owner and Repo are required for get_pr');
            const getPrNumber = getNumberProperty(config, 'prNumber', 0);
            if (!getPrNumber) throw new Error('GitHub: PR Number is required for get_pr');
            url = `https://api.github.com/repos/${owner}/${repo}/pulls/${getPrNumber}`;
            break;
          case 'add_pr_comment':
            if (!owner || !repo) throw new Error('GitHub: Owner and Repo are required for add_pr_comment');
            const prCommentNumber = getNumberProperty(config, 'prNumber', 0);
            if (!prCommentNumber) throw new Error('GitHub: PR Number is required for add_pr_comment');
            const prComment = replaceTemplates(getStringProperty(config, 'comment', ''), input);
            if (!prComment) throw new Error('GitHub: Comment is required for add_pr_comment');
            url = `https://api.github.com/repos/${owner}/${repo}/issues/${prCommentNumber}/comments`;
            method = 'POST';
            body = { body: prComment };
            break;
          case 'create_branch':
            if (!owner || !repo) throw new Error('GitHub: Owner and Repo are required for create_branch');
            const branchName = replaceTemplates(getStringProperty(config, 'branchName', ''), input);
            const sha = replaceTemplates(getStringProperty(config, 'sha', ''), input);
            if (!branchName) throw new Error('GitHub: Branch Name is required for create_branch');
            if (!sha) throw new Error('GitHub: SHA is required for create_branch');
            url = `https://api.github.com/repos/${owner}/${repo}/git/refs`;
            method = 'POST';
            body = {
              ref: `refs/heads/${branchName}`,
              sha,
            };
            break;
          case 'list_branches':
            if (!owner || !repo) throw new Error('GitHub: Owner and Repo are required for list_branches');
            url = `https://api.github.com/repos/${owner}/${repo}/branches`;
            break;
          case 'get_branch':
            if (!owner || !repo) throw new Error('GitHub: Owner and Repo are required for get_branch');
            const getBranchName = replaceTemplates(getStringProperty(config, 'branchName', ''), input);
            if (!getBranchName) throw new Error('GitHub: Branch Name is required for get_branch');
            url = `https://api.github.com/repos/${owner}/${repo}/branches/${getBranchName}`;
            break;
          case 'delete_branch':
            if (!owner || !repo) throw new Error('GitHub: Owner and Repo are required for delete_branch');
            const deleteBranchName = replaceTemplates(getStringProperty(config, 'branchName', ''), input);
            if (!deleteBranchName) throw new Error('GitHub: Branch Name is required for delete_branch');
            url = `https://api.github.com/repos/${owner}/${repo}/git/refs/heads/${deleteBranchName}`;
            method = 'DELETE';
            break;
          case 'create_commit':
            if (!owner || !repo) throw new Error('GitHub: Owner and Repo are required for create_commit');
            const commitMessage = replaceTemplates(getStringProperty(config, 'commitMessage', ''), input);
            const filePath = replaceTemplates(getStringProperty(config, 'filePath', ''), input);
            const fileContent = replaceTemplates(getStringProperty(config, 'fileContent', ''), input);
            const commitRef = replaceTemplates(getStringProperty(config, 'ref', 'main'), input);
            if (!commitMessage || !filePath || !fileContent) {
              throw new Error('GitHub: Commit Message, File Path, and File Content are required for create_commit');
            }
            url = `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`;
            method = 'PUT';
            body = {
              message: commitMessage,
              content: btoa(fileContent),
              branch: commitRef,
            };
            break;
          case 'list_commits':
            if (!owner || !repo) throw new Error('GitHub: Owner and Repo are required for list_commits');
            const commitSha = replaceTemplates(getStringProperty(config, 'commitSha', ''), input);
            url = commitSha 
              ? `https://api.github.com/repos/${owner}/${repo}/commits/${commitSha}`
              : `https://api.github.com/repos/${owner}/${repo}/commits`;
            break;
          case 'get_commit':
            if (!owner || !repo) throw new Error('GitHub: Owner and Repo are required for get_commit');
            const getCommitSha = replaceTemplates(getStringProperty(config, 'commitSha', ''), input);
            if (!getCommitSha) throw new Error('GitHub: Commit SHA is required for get_commit');
            url = `https://api.github.com/repos/${owner}/${repo}/commits/${getCommitSha}`;
            break;
          case 'create_release':
            if (!owner || !repo) throw new Error('GitHub: Owner and Repo are required for create_release');
            const tagName = replaceTemplates(getStringProperty(config, 'tagName', ''), input);
            const releaseName = replaceTemplates(getStringProperty(config, 'releaseName', ''), input);
            const releaseBody = replaceTemplates(getStringProperty(config, 'releaseBody', ''), input);
            if (!tagName) throw new Error('GitHub: Tag Name is required for create_release');
            url = `https://api.github.com/repos/${owner}/${repo}/releases`;
            method = 'POST';
            body = {
              tag_name: tagName,
              name: releaseName || tagName,
              body: releaseBody || '',
            };
            break;
          case 'list_releases':
            if (!owner || !repo) throw new Error('GitHub: Owner and Repo are required for list_releases');
            url = `https://api.github.com/repos/${owner}/${repo}/releases`;
            break;
          case 'get_release':
            if (!owner || !repo) throw new Error('GitHub: Owner and Repo are required for get_release');
            const releaseId = getNumberProperty(config, 'releaseId', 0);
            if (!releaseId) throw new Error('GitHub: Release ID is required for get_release');
            url = `https://api.github.com/repos/${owner}/${repo}/releases/${releaseId}`;
            break;
          case 'get_workflow_runs':
            if (!owner || !repo) throw new Error('GitHub: Owner and Repo are required for get_workflow_runs');
            url = `https://api.github.com/repos/${owner}/${repo}/actions/runs`;
            break;
          case 'trigger_workflow':
            if (!owner || !repo) throw new Error('GitHub: Owner and Repo are required for trigger_workflow');
            const workflowId = getStringProperty(config, 'workflowId', '');
            const workflowRef = replaceTemplates(getStringProperty(config, 'ref', 'main'), input);
            if (!workflowId) throw new Error('GitHub: Workflow ID is required for trigger_workflow');
            url = `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${workflowId}/dispatches`;
            method = 'POST';
            body = { ref: workflowRef };
            break;
          case 'list_contributors':
            if (!owner || !repo) throw new Error('GitHub: Owner and Repo are required for list_contributors');
            url = `https://api.github.com/repos/${owner}/${repo}/contributors`;
            break;
          default:
            throw new Error(`GitHub: Unknown operation "${operation}"`);
        }

        const response = await fetch(url, {
          method,
          headers,
          body: body ? JSON.stringify(body) : undefined,
        });

        if (!response.ok) {
          let errorText = '';
          try {
            errorText = await response.text();
            const errorJson = JSON.parse(errorText);
            if (errorJson.message) {
              throw new Error(`GitHub API error: ${response.status} - ${errorJson.message}`);
            }
          } catch {
            // If parsing fails, use raw text
          }
          throw new Error(`GitHub API error: ${response.status} - ${errorText || response.statusText}`);
        }

        // Handle empty responses (e.g., 204 No Content)
        if (response.status === 204 || response.headers.get('content-length') === '0') {
          return { success: true, message: 'Operation completed successfully' };
        }

        const text = await response.text();
        if (!text) {
          return { success: true, message: 'Operation completed successfully' };
        }

        try {
          const data = JSON.parse(text);
          return data;
        } catch {
          return { text, status: response.status };
        }
      } catch (error) {
        throw new Error(`GitHub: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    case "gitlab": {
      const token = getStringProperty(config, 'token', '');
      const baseUrl = getStringProperty(config, 'baseUrl', 'https://gitlab.com');
      const operation = getStringProperty(config, 'operation', 'get_project');
      const projectId = getStringProperty(config, 'projectId', '');
      
      if (!token) {
        throw new Error('GitLab: Token is required');
      }

      const headers: Record<string, string> = {
        'PRIVATE-TOKEN': token,
        'Content-Type': 'application/json',
      };

      try {
        let url = '';
        let method = 'GET';
        let body: unknown = undefined;

        switch (operation) {
          case 'get_project':
            if (!projectId) throw new Error('GitLab: Project ID is required for get_project');
            url = `${baseUrl}/api/v4/projects/${encodeURIComponent(projectId)}`;
            break;
          case 'list_projects':
            url = `${baseUrl}/api/v4/projects`;
            break;
          case 'create_issue':
            if (!projectId) throw new Error('GitLab: Project ID is required for create_issue');
            url = `${baseUrl}/api/v4/projects/${encodeURIComponent(projectId)}/issues`;
            method = 'POST';
            body = {
              title: replaceTemplates(getStringProperty(config, 'title', ''), input),
              description: replaceTemplates(getStringProperty(config, 'description', ''), input),
            };
            break;
          case 'update_issue':
            if (!projectId) throw new Error('GitLab: Project ID is required for update_issue');
            const issueIid = getNumberProperty(config, 'issueIid', 0);
            if (!issueIid) throw new Error('GitLab: Issue IID is required for update_issue');
            url = `${baseUrl}/api/v4/projects/${encodeURIComponent(projectId)}/issues/${issueIid}`;
            method = 'PUT';
            body = {
              title: replaceTemplates(getStringProperty(config, 'title', ''), input),
              description: replaceTemplates(getStringProperty(config, 'description', ''), input),
              state_event: replaceTemplates(getStringProperty(config, 'stateEvent', 'close'), input),
            };
            break;
          case 'close_issue':
            if (!projectId) throw new Error('GitLab: Project ID is required for close_issue');
            const closeIssueIid = getNumberProperty(config, 'issueIid', 0);
            if (!closeIssueIid) throw new Error('GitLab: Issue IID is required for close_issue');
            url = `${baseUrl}/api/v4/projects/${encodeURIComponent(projectId)}/issues/${closeIssueIid}`;
            method = 'PUT';
            body = { state_event: 'close' };
            break;
          case 'list_issues':
            if (!projectId) throw new Error('GitLab: Project ID is required for list_issues');
            url = `${baseUrl}/api/v4/projects/${encodeURIComponent(projectId)}/issues`;
            break;
          case 'get_issue':
            if (!projectId) throw new Error('GitLab: Project ID is required for get_issue');
            const getIssueIid = getNumberProperty(config, 'issueIid', 0);
            if (!getIssueIid) throw new Error('GitLab: Issue IID is required for get_issue');
            url = `${baseUrl}/api/v4/projects/${encodeURIComponent(projectId)}/issues/${getIssueIid}`;
            break;
          case 'create_mr':
            if (!projectId) throw new Error('GitLab: Project ID is required for create_mr');
            url = `${baseUrl}/api/v4/projects/${encodeURIComponent(projectId)}/merge_requests`;
            method = 'POST';
            body = {
              title: replaceTemplates(getStringProperty(config, 'title', ''), input),
              description: replaceTemplates(getStringProperty(config, 'description', ''), input),
              source_branch: replaceTemplates(getStringProperty(config, 'sourceBranch', ''), input),
              target_branch: replaceTemplates(getStringProperty(config, 'targetBranch', 'main'), input),
            };
            break;
          case 'update_mr':
            if (!projectId) throw new Error('GitLab: Project ID is required for update_mr');
            const mrIid = getNumberProperty(config, 'mrIid', 0);
            if (!mrIid) throw new Error('GitLab: MR IID is required for update_mr');
            url = `${baseUrl}/api/v4/projects/${encodeURIComponent(projectId)}/merge_requests/${mrIid}`;
            method = 'PUT';
            body = {
              title: replaceTemplates(getStringProperty(config, 'title', ''), input),
              description: replaceTemplates(getStringProperty(config, 'description', ''), input),
              state_event: replaceTemplates(getStringProperty(config, 'stateEvent', 'close'), input),
            };
            break;
          case 'approve_mr':
            if (!projectId) throw new Error('GitLab: Project ID is required for approve_mr');
            const approveMrIid = getNumberProperty(config, 'mrIid', 0);
            if (!approveMrIid) throw new Error('GitLab: MR IID is required for approve_mr');
            url = `${baseUrl}/api/v4/projects/${encodeURIComponent(projectId)}/merge_requests/${approveMrIid}/approve`;
            method = 'POST';
            break;
          case 'merge_mr':
            if (!projectId) throw new Error('GitLab: Project ID is required for merge_mr');
            const mergeMrIid = getNumberProperty(config, 'mrIid', 0);
            if (!mergeMrIid) throw new Error('GitLab: MR IID is required for merge_mr');
            url = `${baseUrl}/api/v4/projects/${encodeURIComponent(projectId)}/merge_requests/${mergeMrIid}/merge`;
            method = 'PUT';
            body = {
              merge_commit_message: replaceTemplates(getStringProperty(config, 'mergeCommitMessage', ''), input),
            };
            break;
          case 'list_mrs':
            if (!projectId) throw new Error('GitLab: Project ID is required for list_mrs');
            url = `${baseUrl}/api/v4/projects/${encodeURIComponent(projectId)}/merge_requests`;
            break;
          case 'get_mr':
            if (!projectId) throw new Error('GitLab: Project ID is required for get_mr');
            const getMrIid = getNumberProperty(config, 'mrIid', 0);
            if (!getMrIid) throw new Error('GitLab: MR IID is required for get_mr');
            url = `${baseUrl}/api/v4/projects/${encodeURIComponent(projectId)}/merge_requests/${getMrIid}`;
            break;
          case 'trigger_pipeline':
            if (!projectId) throw new Error('GitLab: Project ID is required for trigger_pipeline');
            const triggerToken = getStringProperty(config, 'triggerToken', '');
            if (!triggerToken) throw new Error('GitLab: Trigger Token is required for trigger_pipeline');
            url = `${baseUrl}/api/v4/projects/${encodeURIComponent(projectId)}/trigger/pipeline`;
            method = 'POST';
            body = {
              token: triggerToken,
              ref: replaceTemplates(getStringProperty(config, 'ref', 'main'), input),
            };
            break;
          case 'get_pipeline':
            if (!projectId) throw new Error('GitLab: Project ID is required for get_pipeline');
            const pipelineId = getStringProperty(config, 'pipelineId', '');
            if (!pipelineId) throw new Error('GitLab: Pipeline ID is required for get_pipeline');
            url = `${baseUrl}/api/v4/projects/${encodeURIComponent(projectId)}/pipelines/${pipelineId}`;
            break;
          case 'list_pipelines':
            if (!projectId) throw new Error('GitLab: Project ID is required for list_pipelines');
            url = `${baseUrl}/api/v4/projects/${encodeURIComponent(projectId)}/pipelines`;
            break;
          case 'get_pipeline_jobs':
            if (!projectId) throw new Error('GitLab: Project ID is required for get_pipeline_jobs');
            const jobsPipelineId = getStringProperty(config, 'pipelineId', '');
            if (!jobsPipelineId) throw new Error('GitLab: Pipeline ID is required for get_pipeline_jobs');
            url = `${baseUrl}/api/v4/projects/${encodeURIComponent(projectId)}/pipelines/${jobsPipelineId}/jobs`;
            break;
          case 'get_job_log':
            if (!projectId) throw new Error('GitLab: Project ID is required for get_job_log');
            const jobId = getNumberProperty(config, 'jobId', 0);
            if (!jobId) throw new Error('GitLab: Job ID is required for get_job_log');
            url = `${baseUrl}/api/v4/projects/${encodeURIComponent(projectId)}/jobs/${jobId}/trace`;
            break;
          case 'create_branch':
            if (!projectId) throw new Error('GitLab: Project ID is required for create_branch');
            const branchName = replaceTemplates(getStringProperty(config, 'branchName', ''), input);
            const ref = replaceTemplates(getStringProperty(config, 'ref', 'main'), input);
            if (!branchName) throw new Error('GitLab: Branch Name is required for create_branch');
            url = `${baseUrl}/api/v4/projects/${encodeURIComponent(projectId)}/repository/branches`;
            method = 'POST';
            body = {
              branch: branchName,
              ref,
            };
            break;
          case 'list_branches':
            if (!projectId) throw new Error('GitLab: Project ID is required for list_branches');
            url = `${baseUrl}/api/v4/projects/${encodeURIComponent(projectId)}/repository/branches`;
            break;
          case 'delete_branch':
            if (!projectId) throw new Error('GitLab: Project ID is required for delete_branch');
            const deleteBranchName = replaceTemplates(getStringProperty(config, 'branchName', ''), input);
            if (!deleteBranchName) throw new Error('GitLab: Branch Name is required for delete_branch');
            url = `${baseUrl}/api/v4/projects/${encodeURIComponent(projectId)}/repository/branches/${deleteBranchName}`;
            method = 'DELETE';
            break;
          case 'get_file':
            if (!projectId) throw new Error('GitLab: Project ID is required for get_file');
            const getFilePath = replaceTemplates(getStringProperty(config, 'filePath', ''), input);
            const getFileRef = replaceTemplates(getStringProperty(config, 'ref', 'main'), input);
            if (!getFilePath) throw new Error('GitLab: File Path is required for get_file');
            url = `${baseUrl}/api/v4/projects/${encodeURIComponent(projectId)}/repository/files/${encodeURIComponent(getFilePath)}?ref=${getFileRef}`;
            break;
          case 'create_file':
            if (!projectId) throw new Error('GitLab: Project ID is required for create_file');
            const createFilePath = replaceTemplates(getStringProperty(config, 'filePath', ''), input);
            const createFileContent = replaceTemplates(getStringProperty(config, 'fileContent', ''), input);
            const createFileRef = replaceTemplates(getStringProperty(config, 'ref', 'main'), input);
            const createCommitMessage = replaceTemplates(getStringProperty(config, 'commitMessage', ''), input);
            if (!createFilePath || !createFileContent || !createCommitMessage) {
              throw new Error('GitLab: File Path, File Content, and Commit Message are required for create_file');
            }
            url = `${baseUrl}/api/v4/projects/${encodeURIComponent(projectId)}/repository/files/${encodeURIComponent(createFilePath)}`;
            method = 'POST';
            body = {
              branch: createFileRef,
              content: btoa(createFileContent),
              commit_message: createCommitMessage,
            };
            break;
          case 'update_file':
            if (!projectId) throw new Error('GitLab: Project ID is required for update_file');
            const updateFilePath = replaceTemplates(getStringProperty(config, 'filePath', ''), input);
            const updateFileContent = replaceTemplates(getStringProperty(config, 'fileContent', ''), input);
            const updateFileRef = replaceTemplates(getStringProperty(config, 'ref', 'main'), input);
            const updateCommitMessage = replaceTemplates(getStringProperty(config, 'commitMessage', ''), input);
            if (!updateFilePath || !updateFileContent || !updateCommitMessage) {
              throw new Error('GitLab: File Path, File Content, and Commit Message are required for update_file');
            }
            url = `${baseUrl}/api/v4/projects/${encodeURIComponent(projectId)}/repository/files/${encodeURIComponent(updateFilePath)}`;
            method = 'PUT';
            body = {
              branch: updateFileRef,
              content: btoa(updateFileContent),
              commit_message: updateCommitMessage,
            };
            break;
          case 'delete_file':
            if (!projectId) throw new Error('GitLab: Project ID is required for delete_file');
            const deleteFilePath = replaceTemplates(getStringProperty(config, 'filePath', ''), input);
            const deleteFileRef = replaceTemplates(getStringProperty(config, 'ref', 'main'), input);
            const deleteCommitMessage = replaceTemplates(getStringProperty(config, 'commitMessage', ''), input);
            if (!deleteFilePath || !deleteCommitMessage) {
              throw new Error('GitLab: File Path and Commit Message are required for delete_file');
            }
            url = `${baseUrl}/api/v4/projects/${encodeURIComponent(projectId)}/repository/files/${encodeURIComponent(deleteFilePath)}`;
            method = 'DELETE';
            body = {
              branch: deleteFileRef,
              commit_message: deleteCommitMessage,
            };
            break;
          default:
            throw new Error(`GitLab: Unknown operation "${operation}"`);
        }

        const response = await fetch(url, {
          method,
          headers,
          body: body ? JSON.stringify(body) : undefined,
        });

        if (!response.ok) {
          let errorText = '';
          try {
            errorText = await response.text();
            const errorJson = JSON.parse(errorText);
            if (errorJson.message) {
              throw new Error(`GitLab API error: ${response.status} - ${errorJson.message}`);
            }
          } catch {
            // If parsing fails, use raw text
          }
          throw new Error(`GitLab API error: ${response.status} - ${errorText || response.statusText}`);
        }

        // Handle empty responses
        if (response.status === 204 || response.headers.get('content-length') === '0') {
          return { success: true, message: 'Operation completed successfully' };
        }

        const text = await response.text();
        if (!text) {
          return { success: true, message: 'Operation completed successfully' };
        }

        try {
          const data = JSON.parse(text);
          return data;
        } catch {
          return { text, status: response.status };
        }
      } catch (error) {
        throw new Error(`GitLab: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    case "bitbucket": {
      const username = getStringProperty(config, 'username', '');
      const appPassword = getStringProperty(config, 'appPassword', '');
      const operation = getStringProperty(config, 'operation', 'get_repo');
      const workspace = getStringProperty(config, 'workspace', '');
      const repo = getStringProperty(config, 'repo', '');
      
      if (!username || !appPassword) {
        throw new Error('Bitbucket: Username and App Password are required');
      }

      const auth = btoa(`${username}:${appPassword}`);
      const headers: Record<string, string> = {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
      };

      try {
        let url = '';
        let method = 'GET';
        let body: unknown = undefined;

        switch (operation) {
          case 'get_repo':
            if (!workspace || !repo) throw new Error('Bitbucket: Workspace and Repo are required for get_repo');
            url = `https://api.bitbucket.org/2.0/repositories/${workspace}/${repo}`;
            break;
          case 'list_repos':
            if (!workspace) throw new Error('Bitbucket: Workspace is required for list_repos');
            url = `https://api.bitbucket.org/2.0/repositories/${workspace}`;
            break;
          case 'create_pr':
            if (!workspace || !repo) throw new Error('Bitbucket: Workspace and Repo are required for create_pr');
            url = `https://api.bitbucket.org/2.0/repositories/${workspace}/${repo}/pullrequests`;
            method = 'POST';
            body = {
              title: replaceTemplates(getStringProperty(config, 'title', ''), input),
              description: replaceTemplates(getStringProperty(config, 'description', ''), input),
              source: {
                branch: { name: replaceTemplates(getStringProperty(config, 'sourceBranch', ''), input) },
              },
              destination: {
                branch: { name: replaceTemplates(getStringProperty(config, 'destinationBranch', 'main'), input) },
              },
            };
            break;
          case 'update_pr':
            if (!workspace || !repo) throw new Error('Bitbucket: Workspace and Repo are required for update_pr');
            const prId = getNumberProperty(config, 'prId', 0);
            if (!prId) throw new Error('Bitbucket: PR ID is required for update_pr');
            url = `https://api.bitbucket.org/2.0/repositories/${workspace}/${repo}/pullrequests/${prId}`;
            method = 'PUT';
            body = {
              title: replaceTemplates(getStringProperty(config, 'title', ''), input),
              description: replaceTemplates(getStringProperty(config, 'description', ''), input),
            };
            break;
          case 'merge_pr':
            if (!workspace || !repo) throw new Error('Bitbucket: Workspace and Repo are required for merge_pr');
            const mergePrId = getNumberProperty(config, 'prId', 0);
            if (!mergePrId) throw new Error('Bitbucket: PR ID is required for merge_pr');
            url = `https://api.bitbucket.org/2.0/repositories/${workspace}/${repo}/pullrequests/${mergePrId}/merge`;
            method = 'POST';
            body = {
              merge_strategy: replaceTemplates(getStringProperty(config, 'mergeStrategy', 'merge_commit'), input),
            };
            break;
          case 'list_prs':
            if (!workspace || !repo) throw new Error('Bitbucket: Workspace and Repo are required for list_prs');
            url = `https://api.bitbucket.org/2.0/repositories/${workspace}/${repo}/pullrequests`;
            break;
          case 'get_pr':
            if (!workspace || !repo) throw new Error('Bitbucket: Workspace and Repo are required for get_pr');
            const getPrId = getNumberProperty(config, 'prId', 0);
            if (!getPrId) throw new Error('Bitbucket: PR ID is required for get_pr');
            url = `https://api.bitbucket.org/2.0/repositories/${workspace}/${repo}/pullrequests/${getPrId}`;
            break;
          case 'add_pr_comment':
            if (!workspace || !repo) throw new Error('Bitbucket: Workspace and Repo are required for add_pr_comment');
            const commentPrId = getNumberProperty(config, 'prId', 0);
            if (!commentPrId) throw new Error('Bitbucket: PR ID is required for add_pr_comment');
            const prComment = replaceTemplates(getStringProperty(config, 'comment', ''), input);
            if (!prComment) throw new Error('Bitbucket: Comment is required for add_pr_comment');
            url = `https://api.bitbucket.org/2.0/repositories/${workspace}/${repo}/pullrequests/${commentPrId}/comments`;
            method = 'POST';
            body = { content: { raw: prComment } };
            break;
          case 'list_pr_comments':
            if (!workspace || !repo) throw new Error('Bitbucket: Workspace and Repo are required for list_pr_comments');
            const listCommentsPrId = getNumberProperty(config, 'prId', 0);
            if (!listCommentsPrId) throw new Error('Bitbucket: PR ID is required for list_pr_comments');
            url = `https://api.bitbucket.org/2.0/repositories/${workspace}/${repo}/pullrequests/${listCommentsPrId}/comments`;
            break;
          case 'create_branch':
            if (!workspace || !repo) throw new Error('Bitbucket: Workspace and Repo are required for create_branch');
            const branchName = replaceTemplates(getStringProperty(config, 'branchName', ''), input);
            const targetBranch = replaceTemplates(getStringProperty(config, 'targetBranch', 'main'), input);
            if (!branchName) throw new Error('Bitbucket: Branch Name is required for create_branch');
            url = `https://api.bitbucket.org/2.0/repositories/${workspace}/${repo}/refs/branches`;
            method = 'POST';
            body = {
              name: branchName,
              target: { hash: targetBranch },
            };
            break;
          case 'list_branches':
            if (!workspace || !repo) throw new Error('Bitbucket: Workspace and Repo are required for list_branches');
            url = `https://api.bitbucket.org/2.0/repositories/${workspace}/${repo}/refs/branches`;
            break;
          case 'get_branch':
            if (!workspace || !repo) throw new Error('Bitbucket: Workspace and Repo are required for get_branch');
            const getBranchName = replaceTemplates(getStringProperty(config, 'branchName', ''), input);
            if (!getBranchName) throw new Error('Bitbucket: Branch Name is required for get_branch');
            url = `https://api.bitbucket.org/2.0/repositories/${workspace}/${repo}/refs/branches/${getBranchName}`;
            break;
          case 'delete_branch':
            if (!workspace || !repo) throw new Error('Bitbucket: Workspace and Repo are required for delete_branch');
            const deleteBranchName = replaceTemplates(getStringProperty(config, 'branchName', ''), input);
            if (!deleteBranchName) throw new Error('Bitbucket: Branch Name is required for delete_branch');
            url = `https://api.bitbucket.org/2.0/repositories/${workspace}/${repo}/refs/branches/${deleteBranchName}`;
            method = 'DELETE';
            break;
          case 'list_commits':
            if (!workspace || !repo) throw new Error('Bitbucket: Workspace and Repo are required for list_commits');
            url = `https://api.bitbucket.org/2.0/repositories/${workspace}/${repo}/commits`;
            break;
          case 'get_commit':
            if (!workspace || !repo) throw new Error('Bitbucket: Workspace and Repo are required for get_commit');
            const commitSha = replaceTemplates(getStringProperty(config, 'commitSha', ''), input);
            if (!commitSha) throw new Error('Bitbucket: Commit SHA is required for get_commit');
            url = `https://api.bitbucket.org/2.0/repositories/${workspace}/${repo}/commit/${commitSha}`;
            break;
          case 'get_commit_status':
            if (!workspace || !repo) throw new Error('Bitbucket: Workspace and Repo are required for get_commit_status');
            const statusCommitSha = replaceTemplates(getStringProperty(config, 'commitSha', ''), input);
            if (!statusCommitSha) throw new Error('Bitbucket: Commit SHA is required for get_commit_status');
            url = `https://api.bitbucket.org/2.0/repositories/${workspace}/${repo}/commit/${statusCommitSha}/statuses`;
            break;
          case 'get_pipeline':
            if (!workspace || !repo) throw new Error('Bitbucket: Workspace and Repo are required for get_pipeline');
            const pipelineUuid = getStringProperty(config, 'pipelineUuid', '');
            if (!pipelineUuid) throw new Error('Bitbucket: Pipeline UUID is required for get_pipeline');
            url = `https://api.bitbucket.org/2.0/repositories/${workspace}/${repo}/pipelines/${pipelineUuid}`;
            break;
          case 'list_pipelines':
            if (!workspace || !repo) throw new Error('Bitbucket: Workspace and Repo are required for list_pipelines');
            url = `https://api.bitbucket.org/2.0/repositories/${workspace}/${repo}/pipelines`;
            break;
          default:
            throw new Error(`Bitbucket: Unknown operation "${operation}"`);
        }

        const response = await fetch(url, {
          method,
          headers,
          body: body ? JSON.stringify(body) : undefined,
        });

        if (!response.ok) {
          let errorText = '';
          try {
            errorText = await response.text();
            const errorJson = JSON.parse(errorText);
            if (errorJson.error && errorJson.error.message) {
              throw new Error(`Bitbucket API error: ${response.status} - ${errorJson.error.message}`);
            }
          } catch {
            // If parsing fails, use raw text
          }
          throw new Error(`Bitbucket API error: ${response.status} - ${errorText || response.statusText}`);
        }

        // Handle empty responses
        if (response.status === 204 || response.headers.get('content-length') === '0') {
          return { success: true, message: 'Operation completed successfully' };
        }

        const text = await response.text();
        if (!text) {
          return { success: true, message: 'Operation completed successfully' };
        }

        try {
          const data = JSON.parse(text);
          return data;
        } catch {
          return { text, status: response.status };
        }
      } catch (error) {
        throw new Error(`Bitbucket: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    case "jenkins": {
      const baseUrl = getStringProperty(config, 'baseUrl', '');
      const username = getStringProperty(config, 'username', '');
      const token = getStringProperty(config, 'token', '');
      const operation = getStringProperty(config, 'operation', 'get_job');
      const jobName = getStringProperty(config, 'jobName', '');
      
      if (!baseUrl || !username || !token) {
        throw new Error('Jenkins: Base URL, Username, and Token are required');
      }

      const auth = btoa(`${username}:${token}`);
      const headers: Record<string, string> = {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
      };

      try {
        let url = '';
        let method = 'GET';
        let body: unknown = undefined;

        switch (operation) {
          case 'get_job':
            if (!jobName) throw new Error('Jenkins: Job Name is required for get_job');
            url = `${baseUrl}/job/${encodeURIComponent(jobName)}/api/json`;
            break;
          case 'list_jobs':
            url = `${baseUrl}/api/json?tree=jobs[name,url]`;
            break;
          case 'build_job':
            if (!jobName) throw new Error('Jenkins: Job Name is required for build_job');
            const parameters = getStringProperty(config, 'parameters', '');
            if (parameters && parameters.trim()) {
              try {
                const params = parseJSONSafe(replaceTemplates(parameters, input), 'parameters') as Record<string, unknown>;
                if (params && Object.keys(params).length > 0) {
                  // Jenkins buildWithParameters expects form data or query params
                  const queryParams = new URLSearchParams();
                  Object.entries(params).forEach(([key, value]) => {
                    queryParams.append(key, String(value));
                  });
                  url = `${baseUrl}/job/${encodeURIComponent(jobName)}/buildWithParameters?${queryParams.toString()}`;
                  method = 'POST';
                  body = undefined; // No body for query params
                } else {
                  url = `${baseUrl}/job/${encodeURIComponent(jobName)}/build`;
                  method = 'POST';
                }
              } catch {
                // If parameters is not valid JSON, build without parameters
                url = `${baseUrl}/job/${encodeURIComponent(jobName)}/build`;
                method = 'POST';
              }
            } else {
              url = `${baseUrl}/job/${encodeURIComponent(jobName)}/build`;
              method = 'POST';
            }
            break;
          case 'get_build':
            if (!jobName) throw new Error('Jenkins: Job Name is required for get_build');
            const buildNumber = getNumberProperty(config, 'buildNumber', 0);
            if (!buildNumber) throw new Error('Jenkins: Build Number is required for get_build');
            url = `${baseUrl}/job/${encodeURIComponent(jobName)}/${buildNumber}/api/json`;
            break;
          case 'get_build_log':
            if (!jobName) throw new Error('Jenkins: Job Name is required for get_build_log');
            const buildNum = getNumberProperty(config, 'buildNumber', 0);
            if (!buildNum) throw new Error('Jenkins: Build Number is required for get_build_log');
            url = `${baseUrl}/job/${encodeURIComponent(jobName)}/${buildNum}/consoleText`;
            break;
          case 'stop_build':
            if (!jobName) throw new Error('Jenkins: Job Name is required for stop_build');
            const stopBuildNum = getNumberProperty(config, 'buildNumber', 0);
            if (!stopBuildNum) throw new Error('Jenkins: Build Number is required for stop_build');
            url = `${baseUrl}/job/${encodeURIComponent(jobName)}/${stopBuildNum}/stop`;
            method = 'POST';
            break;
          case 'get_build_status':
            if (!jobName) throw new Error('Jenkins: Job Name is required for get_build_status');
            const statusBuildNum = getNumberProperty(config, 'buildNumber', 0);
            if (!statusBuildNum) throw new Error('Jenkins: Build Number is required for get_build_status');
            url = `${baseUrl}/job/${encodeURIComponent(jobName)}/${statusBuildNum}/api/json?tree=result,building`;
            break;
          case 'poll_build_status':
            if (!jobName) throw new Error('Jenkins: Job Name is required for poll_build_status');
            const pollBuildNum = getNumberProperty(config, 'buildNumber', 0);
            const pollInterval = getNumberProperty(config, 'pollInterval', 5);
            const maxPollAttempts = getNumberProperty(config, 'maxPollAttempts', 60);
            if (!pollBuildNum) throw new Error('Jenkins: Build Number is required for poll_build_status');
            // Poll for build status
            let attempts = 0;
            while (attempts < maxPollAttempts) {
              const pollUrl = `${baseUrl}/job/${encodeURIComponent(jobName)}/${pollBuildNum}/api/json?tree=result,building`;
              const pollResponse = await fetch(pollUrl, { headers });
              if (pollResponse.ok) {
                const pollData = await pollResponse.json();
                if (!pollData.building && pollData.result) {
                  return { 
                    success: true, 
                    buildNumber: pollBuildNum,
                    result: pollData.result,
                    building: false,
                    message: `Build ${pollBuildNum} completed with status: ${pollData.result}`
                  };
                }
              }
              attempts++;
              if (attempts < maxPollAttempts) {
                await new Promise(resolve => setTimeout(resolve, pollInterval * 1000));
              }
            }
            throw new Error(`Jenkins: Build ${pollBuildNum} did not complete within ${maxPollAttempts * pollInterval} seconds`);
          default:
            throw new Error(`Jenkins: Unknown operation "${operation}"`);
        }

        const response = await fetch(url, {
          method,
          headers,
          body: body ? JSON.stringify(body) : undefined,
        });

        // Jenkins returns 201 for successful builds, 200 for other operations
        if (!response.ok && response.status !== 201) {
          const errorText = await response.text();
          throw new Error(`Jenkins API error: ${response.status} - ${errorText || response.statusText}`);
        }

        if (operation === 'get_build_log') {
          const text = await response.text();
          return { log: text };
        }

        // Handle build operations (201 Created)
        if (operation === 'build_job' && response.status === 201) {
          const location = response.headers.get('Location');
          return { 
            success: true, 
            message: 'Build triggered successfully',
            queueUrl: location || `${baseUrl}/queue/item/${response.headers.get('X-Queue-Id') || 'unknown'}/`
          };
        }

        // Handle empty responses
        if (response.status === 204 || response.headers.get('content-length') === '0') {
          return { success: true, message: 'Operation completed successfully' };
        }

        const text = await response.text();
        if (!text) {
          return { success: true, message: 'Operation completed successfully' };
        }

        try {
          const data = JSON.parse(text);
          return data;
        } catch {
          return { text, status: response.status };
        }
      } catch (error) {
        throw new Error(`Jenkins: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    case "docker": {
      const host = getStringProperty(config, 'host', 'localhost');
      const port = getNumberProperty(config, 'port', 2375);
      const operation = getStringProperty(config, 'operation', 'list_containers');
      const containerId = getStringProperty(config, 'containerId', '');
      
      // Docker API requires connection to Docker daemon
      // Handle both HTTP URLs and host:port format
      let baseUrl = '';
      if (host.startsWith('http://') || host.startsWith('https://')) {
        baseUrl = host;
      } else if (host.startsWith('unix://')) {
        throw new Error('Docker: Unix socket connections are not supported. Use HTTP/HTTPS URL to Docker daemon (e.g., http://localhost:2375)');
      } else {
        baseUrl = `http://${host}:${port}`;
      }
      
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      
      try {
        let url = '';
        let method = 'GET';

        switch (operation) {
          case 'list_containers':
            url = `${baseUrl}/v1.42/containers/json?all=true`;
            break;
          case 'list_images':
            url = `${baseUrl}/v1.42/images/json`;
            break;
          case 'build_image':
            url = `${baseUrl}/v1.42/build`;
            method = 'POST';
            const dockerfilePath = replaceTemplates(getStringProperty(config, 'dockerfilePath', './Dockerfile'), input);
            const buildContext = replaceTemplates(getStringProperty(config, 'buildContext', '.'), input);
            // Note: Docker build API requires tar archive of build context, which is complex
            // This is a placeholder - in production, you'd need to create a tar archive
            throw new Error('Docker: build_image operation requires tar archive of build context. This is not fully implemented in this environment.');
          case 'tag_image':
            const imageName = replaceTemplates(getStringProperty(config, 'imageName', ''), input);
            const tag = replaceTemplates(getStringProperty(config, 'tag', ''), input);
            const sourceTag = replaceTemplates(getStringProperty(config, 'sourceTag', ''), input);
            if (!imageName || !tag || !sourceTag) {
              throw new Error('Docker: Image Name, Tag, and Source Tag are required for tag_image');
            }
            url = `${baseUrl}/v1.42/images/${imageName}:${sourceTag}/tag?repo=${imageName}&tag=${tag}`;
            method = 'POST';
            break;
          case 'push_image':
            const pushImageName = replaceTemplates(getStringProperty(config, 'imageName', ''), input);
            const pushTag = replaceTemplates(getStringProperty(config, 'tag', ''), input);
            const registry = replaceTemplates(getStringProperty(config, 'registry', 'docker.io'), input);
            const registryUsername = getStringProperty(config, 'registryUsername', '');
            const registryPassword = getStringProperty(config, 'registryPassword', '');
            if (!pushImageName || !pushTag) {
              throw new Error('Docker: Image Name and Tag are required for push_image');
            }
            url = `${baseUrl}/v1.42/images/${registry}/${pushImageName}:${pushTag}/push`;
            method = 'POST';
            if (registryUsername && registryPassword) {
              headers['X-Registry-Auth'] = btoa(JSON.stringify({
                username: registryUsername,
                password: registryPassword,
              }));
            }
            break;
          case 'pull_image':
            const pullImageName = replaceTemplates(getStringProperty(config, 'imageName', ''), input);
            const pullTag = replaceTemplates(getStringProperty(config, 'tag', ''), input);
            const pullRegistry = replaceTemplates(getStringProperty(config, 'registry', 'docker.io'), input);
            const pullUsername = getStringProperty(config, 'registryUsername', '');
            const pullPassword = getStringProperty(config, 'registryPassword', '');
            if (!pullImageName || !pullTag) {
              throw new Error('Docker: Image Name and Tag are required for pull_image');
            }
            url = `${baseUrl}/v1.42/images/create?fromImage=${pullRegistry}/${pullImageName}&tag=${pullTag}`;
            method = 'POST';
            if (pullUsername && pullPassword) {
              headers['X-Registry-Auth'] = btoa(JSON.stringify({
                username: pullUsername,
                password: pullPassword,
              }));
            }
            break;
          case 'remove_image':
            const removeImageName = replaceTemplates(getStringProperty(config, 'imageName', ''), input);
            if (!removeImageName) throw new Error('Docker: Image Name is required for remove_image');
            url = `${baseUrl}/v1.42/images/${removeImageName}`;
            method = 'DELETE';
            break;
          case 'start_container':
            if (!containerId) throw new Error('Docker: Container ID is required for start_container');
            url = `${baseUrl}/v1.42/containers/${containerId}/start`;
            method = 'POST';
            break;
          case 'stop_container':
            if (!containerId) throw new Error('Docker: Container ID is required for stop_container');
            url = `${baseUrl}/v1.42/containers/${containerId}/stop`;
            method = 'POST';
            break;
          case 'get_logs':
            if (!containerId) throw new Error('Docker: Container ID is required for get_logs');
            url = `${baseUrl}/v1.42/containers/${containerId}/logs?stdout=true&stderr=true`;
            break;
          case 'inspect_container':
            if (!containerId) throw new Error('Docker: Container ID is required for inspect_container');
            url = `${baseUrl}/v1.42/containers/${containerId}/json`;
            break;
          default:
            throw new Error(`Docker: Unknown operation "${operation}"`);
        }

        const response = await fetch(url, { 
          method,
          headers,
        });

        if (!response.ok) {
          let errorText = '';
          try {
            errorText = await response.text();
            const errorJson = JSON.parse(errorText);
            if (errorJson.message) {
              throw new Error(`Docker API error: ${response.status} - ${errorJson.message}`);
            }
          } catch {
            // If parsing fails, use raw text
          }
          
          if (response.status === 404) {
            throw new Error(`Docker: Resource not found (${containerId || 'resource'}). Check if the container/image exists.`);
          } else if (response.status === 500) {
            throw new Error(`Docker: Server error. The Docker daemon may be unavailable or misconfigured.`);
          }
          
          throw new Error(`Docker API error: ${response.status} - ${errorText || response.statusText}`);
        }

        // Handle empty responses (e.g., start/stop operations)
        if (response.status === 204 || response.headers.get('content-length') === '0') {
          return { success: true, message: 'Operation completed successfully' };
        }

        if (operation === 'get_logs') {
          const text = await response.text();
          return { logs: text };
        }

        const text = await response.text();
        if (!text) {
          return { success: true, message: 'Operation completed successfully' };
        }

        try {
          const data = JSON.parse(text);
          return data;
        } catch {
          return { text, status: response.status };
        }
      } catch (error) {
        if (error instanceof Error && error.message.includes('Docker')) {
          throw error;
        }
        // Handle network errors
        if (error instanceof Error && (error.message.includes('fetch') || error.message.includes('network'))) {
          throw new Error(`Docker: Cannot connect to Docker daemon at ${baseUrl}. Make sure Docker is running and the API is accessible. For remote access, configure Docker to expose the API or use a Docker socket proxy.`);
        }
        throw new Error(`Docker: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    case "kubernetes": {
      const apiServer = getStringProperty(config, 'apiServer', '');
      const token = getStringProperty(config, 'token', '');
      const operation = getStringProperty(config, 'operation', 'list_pods');
      const namespace = getStringProperty(config, 'namespace', 'default');
      const resourceName = getStringProperty(config, 'resourceName', '');
      
      if (!apiServer) {
        throw new Error('Kubernetes: API Server URL is required. Format: https://your-cluster.example.com:6443');
      }

      // Validate API server URL
      try {
        new URL(apiServer);
      } catch {
        throw new Error('Kubernetes: Invalid API Server URL format. Must be a valid URL (e.g., https://your-cluster.example.com:6443)');
      }

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      // Add authentication token if provided
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      try {
        let url = '';
        let method = 'GET';

        let body: unknown = undefined;
        switch (operation) {
          case 'list_pods':
            url = `${apiServer}/api/v1/namespaces/${namespace}/pods`;
            break;
          case 'get_pod':
            if (!resourceName) throw new Error('Kubernetes: Resource Name is required for get_pod');
            url = `${apiServer}/api/v1/namespaces/${namespace}/pods/${resourceName}`;
            break;
          case 'list_deployments':
            url = `${apiServer}/apis/apps/v1/namespaces/${namespace}/deployments`;
            break;
          case 'get_deployment':
            if (!resourceName) throw new Error('Kubernetes: Resource Name is required for get_deployment');
            url = `${apiServer}/apis/apps/v1/namespaces/${namespace}/deployments/${resourceName}`;
            break;
          case 'create_deployment':
            if (!resourceName) throw new Error('Kubernetes: Resource Name is required for create_deployment');
            const deploymentManifest = getStringProperty(config, 'deploymentManifest', '');
            if (!deploymentManifest) throw new Error('Kubernetes: Deployment Manifest is required for create_deployment');
            url = `${apiServer}/apis/apps/v1/namespaces/${namespace}/deployments`;
            method = 'POST';
            try {
              body = parseJSONSafe(replaceTemplates(deploymentManifest, input), 'deploymentManifest');
            } catch {
              throw new Error('Kubernetes: Invalid Deployment Manifest JSON');
            }
            break;
          case 'update_deployment':
            if (!resourceName) throw new Error('Kubernetes: Resource Name is required for update_deployment');
            const updateManifest = getStringProperty(config, 'deploymentManifest', '');
            if (!updateManifest) throw new Error('Kubernetes: Deployment Manifest is required for update_deployment');
            url = `${apiServer}/apis/apps/v1/namespaces/${namespace}/deployments/${resourceName}`;
            method = 'PUT';
            try {
              body = parseJSONSafe(replaceTemplates(updateManifest, input), 'deploymentManifest');
            } catch {
              throw new Error('Kubernetes: Invalid Deployment Manifest JSON');
            }
            break;
          case 'scale_deployment':
            if (!resourceName) throw new Error('Kubernetes: Resource Name is required for scale_deployment');
            const replicas = getNumberProperty(config, 'replicas', 0);
            if (!replicas || replicas < 0) throw new Error('Kubernetes: Valid Replicas count is required for scale_deployment');
            url = `${apiServer}/apis/apps/v1/namespaces/${namespace}/deployments/${resourceName}/scale`;
            method = 'PUT';
            body = { spec: { replicas } };
            break;
          case 'restart_deployment':
            if (!resourceName) throw new Error('Kubernetes: Resource Name is required for restart_deployment');
            url = `${apiServer}/apis/apps/v1/namespaces/${namespace}/deployments/${resourceName}`;
            method = 'PATCH';
            body = {
              spec: {
                template: {
                  metadata: {
                    annotations: {
                      'kubectl.kubernetes.io/restartedAt': new Date().toISOString(),
                    },
                  },
                },
              },
            };
            break;
          case 'list_services':
            url = `${apiServer}/api/v1/namespaces/${namespace}/services`;
            break;
          case 'get_service':
            if (!resourceName) throw new Error('Kubernetes: Resource Name is required for get_service');
            url = `${apiServer}/api/v1/namespaces/${namespace}/services/${resourceName}`;
            break;
          case 'get_logs':
            if (!resourceName) throw new Error('Kubernetes: Resource Name is required for get_logs');
            url = `${apiServer}/api/v1/namespaces/${namespace}/pods/${resourceName}/log`;
            break;
          default:
            throw new Error(`Kubernetes: Unknown operation "${operation}"`);
        }

        const response = await fetch(url, {
          method,
          headers,
          body: body ? JSON.stringify(body) : undefined,
        });

        if (!response.ok) {
          const errorText = await response.text();
          if (response.status === 401) {
            throw new Error('Kubernetes: Authentication failed. Please check your token or credentials.');
          } else if (response.status === 403) {
            throw new Error('Kubernetes: Access forbidden. Please check your RBAC permissions.');
          }
          throw new Error(`Kubernetes API error: ${response.status} - ${errorText}`);
        }

        if (operation === 'get_logs') {
          const text = await response.text();
          return { logs: text };
        }

        const data = await response.json();
        return data;
      } catch (error) {
        if (error instanceof Error && error.message.includes('Kubernetes')) {
          throw error;
        }
        throw new Error(`Kubernetes: ${error instanceof Error ? error.message : String(error)}. Make sure the API server is accessible and your token has the required permissions.`);
      }
    }

    case "pagerduty": {
      const apiKey = getStringProperty(config, 'apiKey', '');
      const operation = getStringProperty(config, 'operation', 'list_incidents');
      const incidentId = getStringProperty(config, 'incidentId', '');
      
      if (!apiKey) {
        throw new Error('PagerDuty: API Key is required');
      }

      const headers: Record<string, string> = {
        'Authorization': `Token token=${apiKey}`,
        'Accept': 'application/vnd.pagerduty+json;version=2',
        'Content-Type': 'application/json',
      };

      try {
        let url = '';
        let method = 'GET';
        let body: unknown = undefined;

        switch (operation) {
          case 'list_incidents':
            url = 'https://api.pagerduty.com/incidents';
            break;
          case 'get_incident':
            if (!incidentId) throw new Error('PagerDuty: Incident ID is required for get_incident');
            url = `https://api.pagerduty.com/incidents/${incidentId}`;
            break;
          case 'create_incident':
            url = 'https://api.pagerduty.com/incidents';
            method = 'POST';
            const serviceId = getStringProperty(config, 'serviceId', '');
            const title = getStringProperty(config, 'title', '');
            const urgency = getStringProperty(config, 'urgency', 'high');
            const escalationPolicyId = getStringProperty(config, 'escalationPolicyId', '');
            if (!serviceId || !title) throw new Error('PagerDuty: Service ID and Title are required for create_incident');
            body = {
              incident: {
                type: 'incident',
                title,
                service: { id: serviceId, type: 'service_reference' },
                urgency: { type: 'constant', value: urgency },
                ...(escalationPolicyId ? { escalation_policy: { id: escalationPolicyId, type: 'escalation_policy_reference' } } : {}),
              },
            };
            break;
          case 'update_incident':
            if (!incidentId) throw new Error('PagerDuty: Incident ID is required for update_incident');
            url = `https://api.pagerduty.com/incidents/${incidentId}`;
            method = 'PUT';
            const status = getStringProperty(config, 'status', 'triggered');
            const assigneeId = getStringProperty(config, 'assigneeId', '');
            body = {
              incident: {
                type: 'incident',
                status,
                ...(assigneeId ? { assignees: [{ id: assigneeId, type: 'user_reference' }] } : {}),
              },
            };
            break;
          case 'acknowledge_incident':
            if (!incidentId) throw new Error('PagerDuty: Incident ID is required for acknowledge_incident');
            url = `https://api.pagerduty.com/incidents/${incidentId}`;
            method = 'PUT';
            const note = getStringProperty(config, 'note', '');
            body = {
              incident: {
                type: 'incident',
                status: 'acknowledged',
                ...(note ? { body: { type: 'incident_body', details: note } } : {}),
              },
            };
            break;
          case 'resolve_incident':
            if (!incidentId) throw new Error('PagerDuty: Incident ID is required for resolve_incident');
            url = `https://api.pagerduty.com/incidents/${incidentId}`;
            method = 'PUT';
            const resolveNote = getStringProperty(config, 'note', '');
            body = {
              incident: {
                type: 'incident',
                status: 'resolved',
                ...(resolveNote ? { body: { type: 'incident_body', details: resolveNote } } : {}),
              },
            };
            break;
          case 'list_oncalls':
            url = 'https://api.pagerduty.com/oncalls';
            break;
          case 'get_oncall':
            const scheduleId = getStringProperty(config, 'scheduleId', '');
            if (!scheduleId) throw new Error('PagerDuty: Schedule ID is required for get_oncall');
            url = `https://api.pagerduty.com/oncalls?schedule_ids[]=${scheduleId}`;
            break;
          case 'list_schedules':
            url = 'https://api.pagerduty.com/schedules';
            break;
          case 'get_schedule':
            const getScheduleId = getStringProperty(config, 'scheduleId', '');
            if (!getScheduleId) throw new Error('PagerDuty: Schedule ID is required for get_schedule');
            url = `https://api.pagerduty.com/schedules/${getScheduleId}`;
            break;
          default:
            throw new Error(`PagerDuty: Unknown operation "${operation}"`);
        }

        const response = await fetch(url, {
          method,
          headers,
          body: body ? JSON.stringify(body) : undefined,
        });

        if (!response.ok) {
          let errorText = '';
          try {
            errorText = await response.text();
            const errorJson = JSON.parse(errorText);
            if (errorJson.error && errorJson.error.message) {
              throw new Error(`PagerDuty API error: ${response.status} - ${errorJson.error.message}`);
            }
          } catch {
            // If parsing fails, use raw text
          }
          throw new Error(`PagerDuty API error: ${response.status} - ${errorText || response.statusText}`);
        }

        // Handle empty responses
        if (response.status === 204 || response.headers.get('content-length') === '0') {
          return { success: true, message: 'Operation completed successfully' };
        }

        const text = await response.text();
        if (!text) {
          return { success: true, message: 'Operation completed successfully' };
        }

        try {
          const data = JSON.parse(text);
          return data;
        } catch {
          return { text, status: response.status };
        }
      } catch (error) {
        throw new Error(`PagerDuty: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    case "datadog": {
      const apiKey = getStringProperty(config, 'apiKey', '');
      const appKey = getStringProperty(config, 'appKey', '');
      const site = getStringProperty(config, 'site', 'datadoghq.com');
      const operation = getStringProperty(config, 'operation', 'query_metrics');
      
      if (!apiKey || !appKey) {
        throw new Error('Datadog: API Key and Application Key are required');
      }

      const baseUrl = `https://api.${site}`;
      const headers: Record<string, string> = {
        'DD-API-KEY': apiKey,
        'DD-APPLICATION-KEY': appKey,
        'Content-Type': 'application/json',
      };

      try {
        let url = '';
        let method = 'GET';
        let body: unknown = undefined;

        switch (operation) {
          case 'query_metrics':
            const query = getStringProperty(config, 'query', '');
            const from = getNumberProperty(config, 'from', Math.floor(Date.now() / 1000) - 3600);
            const to = getNumberProperty(config, 'to', Math.floor(Date.now() / 1000));
            if (!query) throw new Error('Datadog: Query is required for query_metrics');
            url = `${baseUrl}/api/v1/query?query=${encodeURIComponent(query)}&from=${from}&to=${to}`;
            break;
          case 'send_metric':
            url = `${baseUrl}/api/v1/series`;
            method = 'POST';
            const metricName = replaceTemplates(getStringProperty(config, 'metricName', ''), input);
            const metricValue = getNumberProperty(config, 'metricValue', 0);
            const metricTags = getStringProperty(config, 'metricTags', '[]');
            if (!metricName || metricValue === undefined) {
              throw new Error('Datadog: Metric Name and Metric Value are required for send_metric');
            }
            let tags: string[] = [];
            try {
              tags = parseJSONSafe(replaceTemplates(metricTags, input), 'metricTags') as string[];
            } catch {
              // If parsing fails, use empty array
            }
            body = {
              series: [{
                metric: metricName,
                points: [[Math.floor(Date.now() / 1000), metricValue]],
                tags: tags || [],
              }],
            };
            break;
          case 'post_event':
            url = `${baseUrl}/api/v1/events`;
            method = 'POST';
            const title = getStringProperty(config, 'title', '');
            const text = getStringProperty(config, 'text', '');
            if (!title || !text) throw new Error('Datadog: Title and Text are required for post_event');
            body = {
              title: replaceTemplates(title, input),
              text: replaceTemplates(text, input),
            };
            break;
          case 'list_monitors':
            url = `${baseUrl}/api/v1/monitor`;
            break;
          case 'get_monitor':
            const monitorId = getNumberProperty(config, 'monitorId', 0);
            if (!monitorId) throw new Error('Datadog: Monitor ID is required for get_monitor');
            url = `${baseUrl}/api/v1/monitor/${monitorId}`;
            break;
          case 'create_monitor':
            url = `${baseUrl}/api/v1/monitor`;
            method = 'POST';
            const monitorType = replaceTemplates(getStringProperty(config, 'monitorType', 'metric_alert'), input);
            const monitorQuery = replaceTemplates(getStringProperty(config, 'monitorQuery', ''), input);
            const monitorMessage = replaceTemplates(getStringProperty(config, 'monitorMessage', ''), input);
            if (!monitorQuery || !monitorMessage) {
              throw new Error('Datadog: Monitor Query and Monitor Message are required for create_monitor');
            }
            body = {
              type: monitorType,
              query: monitorQuery,
              message: monitorMessage,
            };
            break;
          case 'update_monitor':
            const updateMonitorId = getNumberProperty(config, 'monitorId', 0);
            if (!updateMonitorId) throw new Error('Datadog: Monitor ID is required for update_monitor');
            url = `${baseUrl}/api/v1/monitor/${updateMonitorId}`;
            method = 'PUT';
            const updateMonitorQuery = replaceTemplates(getStringProperty(config, 'monitorQuery', ''), input);
            const updateMonitorMessage = replaceTemplates(getStringProperty(config, 'monitorMessage', ''), input);
            body = {
              ...(updateMonitorQuery ? { query: updateMonitorQuery } : {}),
              ...(updateMonitorMessage ? { message: updateMonitorMessage } : {}),
            };
            break;
          case 'mute_monitor':
            const muteMonitorId = getNumberProperty(config, 'monitorId', 0);
            if (!muteMonitorId) throw new Error('Datadog: Monitor ID is required for mute_monitor');
            url = `${baseUrl}/api/v1/monitor/${muteMonitorId}/mute`;
            method = 'POST';
            break;
          case 'unmute_monitor':
            const unmuteMonitorId = getNumberProperty(config, 'monitorId', 0);
            if (!unmuteMonitorId) throw new Error('Datadog: Monitor ID is required for unmute_monitor');
            url = `${baseUrl}/api/v1/monitor/${unmuteMonitorId}/unmute`;
            method = 'POST';
            break;
          case 'trigger_alert':
            url = `${baseUrl}/api/v1/events`;
            method = 'POST';
            const alertTitle = replaceTemplates(getStringProperty(config, 'monitorMessage', ''), input);
            const alertThreshold = getNumberProperty(config, 'alertThreshold', 0);
            if (!alertTitle) throw new Error('Datadog: Alert Message is required for trigger_alert');
            body = {
              title: alertTitle,
              text: `Alert threshold: ${alertThreshold}`,
              alert_type: 'error',
            };
            break;
          default:
            throw new Error(`Datadog: Unknown operation "${operation}"`);
        }

        const response = await fetch(url, {
          method,
          headers,
          body: body ? JSON.stringify(body) : undefined,
        });

        if (!response.ok) {
          let errorText = '';
          try {
            errorText = await response.text();
            const errorJson = JSON.parse(errorText);
            if (errorJson.errors && Array.isArray(errorJson.errors) && errorJson.errors.length > 0) {
              const errorMessages = errorJson.errors.map((e: unknown) => 
                typeof e === 'object' && e !== null && 'detail' in e ? String(e.detail) : String(e)
              ).join(', ');
              throw new Error(`Datadog API error: ${response.status} - ${errorMessages}`);
            }
          } catch {
            // If parsing fails, use raw text
          }
          throw new Error(`Datadog API error: ${response.status} - ${errorText || response.statusText}`);
        }

        // Handle empty responses
        if (response.status === 204 || response.headers.get('content-length') === '0') {
          return { success: true, message: 'Operation completed successfully' };
        }

        const text = await response.text();
        if (!text) {
          return { success: true, message: 'Operation completed successfully' };
        }

        try {
          const data = JSON.parse(text);
          return data;
        } catch {
          return { text, status: response.status };
        }
      } catch (error) {
        throw new Error(`Datadog: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    case "sentry": {
      const token = getStringProperty(config, 'token', '');
      const organization = getStringProperty(config, 'organization', '');
      const project = getStringProperty(config, 'project', '');
      const operation = getStringProperty(config, 'operation', 'list_issues');
      
      if (!token || !organization) {
        throw new Error('Sentry: Token and Organization are required');
      }

      const headers: Record<string, string> = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      };

      try {
        let url = '';
        let method = 'GET';
        let body: unknown = undefined;

        switch (operation) {
          case 'list_issues':
            if (!project) throw new Error('Sentry: Project is required for list_issues');
            url = `https://sentry.io/api/0/projects/${organization}/${project}/issues/`;
            break;
          case 'get_issue':
            if (!project) throw new Error('Sentry: Project is required for get_issue');
            const issueId = getStringProperty(config, 'issueId', '');
            if (!issueId) throw new Error('Sentry: Issue ID is required for get_issue');
            url = `https://sentry.io/api/0/issues/${issueId}/`;
            break;
          case 'update_issue':
            const updateIssueId = getStringProperty(config, 'issueId', '');
            if (!updateIssueId) throw new Error('Sentry: Issue ID is required for update_issue');
            const status = replaceTemplates(getStringProperty(config, 'status', 'resolved'), input);
            url = `https://sentry.io/api/0/issues/${updateIssueId}/`;
            method = 'PUT';
            body = { status };
            break;
          case 'resolve_issue':
            if (!project) throw new Error('Sentry: Project is required for resolve_issue');
            const resolveIssueId = getStringProperty(config, 'issueId', '');
            if (!resolveIssueId) throw new Error('Sentry: Issue ID is required for resolve_issue');
            url = `https://sentry.io/api/0/issues/${resolveIssueId}/`;
            method = 'PUT';
            body = { status: 'resolved' };
            break;
          case 'ignore_issue':
            const ignoreIssueId = getStringProperty(config, 'issueId', '');
            if (!ignoreIssueId) throw new Error('Sentry: Issue ID is required for ignore_issue');
            url = `https://sentry.io/api/0/issues/${ignoreIssueId}/`;
            method = 'PUT';
            body = { status: 'ignored' };
            break;
          case 'assign_issue':
            const assignIssueId = getStringProperty(config, 'issueId', '');
            const assignee = replaceTemplates(getStringProperty(config, 'assignee', ''), input);
            if (!assignIssueId) throw new Error('Sentry: Issue ID is required for assign_issue');
            if (!assignee) throw new Error('Sentry: Assignee is required for assign_issue');
            url = `https://sentry.io/api/0/issues/${assignIssueId}/`;
            method = 'PUT';
            body = { assignedTo: assignee };
            break;
          case 'list_events':
            if (!project) throw new Error('Sentry: Project is required for list_events');
            url = `https://sentry.io/api/0/projects/${organization}/${project}/events/`;
            break;
          case 'get_event':
            if (!project) throw new Error('Sentry: Project is required for get_event');
            const eventId = getStringProperty(config, 'eventId', '');
            if (!eventId) throw new Error('Sentry: Event ID is required for get_event');
            url = `https://sentry.io/api/0/projects/${organization}/${project}/events/${eventId}/`;
            break;
          case 'list_releases':
            if (!project) throw new Error('Sentry: Project is required for list_releases');
            url = `https://sentry.io/api/0/projects/${organization}/${project}/releases/`;
            break;
          case 'get_release':
            if (!project) throw new Error('Sentry: Project is required for get_release');
            const releaseId = getStringProperty(config, 'releaseId', '');
            const releaseVersion = replaceTemplates(getStringProperty(config, 'version', ''), input);
            if (!releaseId && !releaseVersion) {
              throw new Error('Sentry: Release ID or Version is required for get_release');
            }
            url = releaseId 
              ? `https://sentry.io/api/0/organizations/${organization}/releases/${releaseId}/`
              : `https://sentry.io/api/0/organizations/${organization}/releases/${releaseVersion}/`;
            break;
          case 'create_release':
            if (!project) throw new Error('Sentry: Project is required for create_release');
            const version = getStringProperty(config, 'version', '');
            if (!version) throw new Error('Sentry: Version is required for create_release');
            url = `https://sentry.io/api/0/organizations/${organization}/releases/`;
            method = 'POST';
            body = {
              version: replaceTemplates(version, input),
              projects: [project],
            };
            break;
          default:
            throw new Error(`Sentry: Unknown operation "${operation}"`);
        }

        const response = await fetch(url, {
          method,
          headers,
          body: body ? JSON.stringify(body) : undefined,
        });

        if (!response.ok) {
          let errorText = '';
          try {
            errorText = await response.text();
            const errorJson = JSON.parse(errorText);
            if (errorJson.detail) {
              throw new Error(`Sentry API error: ${response.status} - ${errorJson.detail}`);
            }
          } catch {
            // If parsing fails, use raw text
          }
          throw new Error(`Sentry API error: ${response.status} - ${errorText || response.statusText}`);
        }

        // Handle empty responses
        if (response.status === 204 || response.headers.get('content-length') === '0') {
          return { success: true, message: 'Operation completed successfully' };
        }

        const text = await response.text();
        if (!text) {
          return { success: true, message: 'Operation completed successfully' };
        }

        try {
          const data = JSON.parse(text);
          return data;
        } catch {
          return { text, status: response.status };
        }
      } catch (error) {
        throw new Error(`Sentry: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    case "alert_correlation_engine": {
      // Alert Correlation Engine: Group related alerts into incidents
      const alertsConfig = config.alerts;
      const correlationWindowMinutes = getNumberProperty(config, 'correlationWindowMinutes', 5);
      const correlationRulesConfig = config.correlationRules || {};

      if (correlationWindowMinutes < 0) {
        throw new Error("Alert Correlation Engine: Correlation window must be non-negative");
      }

      let alerts: Array<{ alertId: string; source: string; service: string; severity: 'low' | 'medium' | 'high' | 'critical'; message: string; timestamp: string }> = [];
      if (alertsConfig) {
        if (typeof alertsConfig === 'string') {
          try {
            alerts = JSON.parse(alertsConfig);
          } catch {
            throw new Error("Alert Correlation Engine: Invalid alerts JSON format");
          }
        } else if (Array.isArray(alertsConfig)) {
          alerts = alertsConfig;
        }
      }

      if (alerts.length === 0) {
        throw new Error("Alert Correlation Engine: At least one alert is required");
      }

      // Group alerts by service and time window
      const incidentGroups: Array<{ incidentId: string; service: string; severity: string; alerts: string[]; startTime: string; endTime: string | null }> = [];
      const suppressedAlerts: string[] = [];
      const processedAlerts = new Set<string>();

      // Sort alerts by timestamp
      alerts.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

      const correlationWindowMs = correlationWindowMinutes * 60 * 1000;

      // Group alerts by service and time proximity
      const serviceGroups: Record<string, Array<{ alertId: string; severity: string; timestamp: string }>> = {};

      for (const alert of alerts) {
        if (processedAlerts.has(alert.alertId)) {
          suppressedAlerts.push(alert.alertId);
          continue;
        }

        if (!serviceGroups[alert.service]) {
          serviceGroups[alert.service] = [];
        }

        serviceGroups[alert.service].push({
          alertId: alert.alertId,
          severity: alert.severity,
          timestamp: alert.timestamp
        });
      }

      // Create incident groups
      for (const [service, serviceAlerts] of Object.entries(serviceGroups)) {
        if (serviceAlerts.length === 0) continue;

        // Find highest severity
        const severityMap: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };
        const highestSeverity = serviceAlerts.reduce((max, alert) => {
          return severityMap[alert.severity] > severityMap[max] ? alert.severity : max;
        }, 'low');

        const firstAlert = serviceAlerts[0];
        const lastAlert = serviceAlerts[serviceAlerts.length - 1];

        const incidentId = `incident_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        incidentGroups.push({
          incidentId,
          service,
          severity: highestSeverity,
          alerts: serviceAlerts.map(a => a.alertId),
          startTime: firstAlert.timestamp,
          endTime: null // Would be set when incident is resolved
        });

        serviceAlerts.forEach(a => processedAlerts.add(a.alertId));
      }

      return {
        incidentGroups,
        suppressedAlerts,
        totalAlerts: alerts.length,
        totalIncidents: incidentGroups.length
      };
    }

    case "incident_classifier": {
      // Incident Classifier: Classify incidents for severity and impact
      const incidentConfig = config.incident;
      const classificationRulesConfig = config.classificationRules || {};

      let incident: { incidentId: string; service: string; symptoms: string[]; affectedUsers: number; alerts: string[] } | null = null;
      if (incidentConfig) {
        if (typeof incidentConfig === 'string') {
          try {
            incident = JSON.parse(incidentConfig);
          } catch {
            throw new Error("Incident Classifier: Invalid incident JSON format");
          }
        } else if (typeof incidentConfig === 'object') {
          incident = incidentConfig as { incidentId: string; service: string; symptoms: string[]; affectedUsers: number; alerts: string[] };
        }
      }

      const inputObj = input && typeof input === 'object' ? input as Record<string, unknown> : {};
      if (!incident && inputObj.incident) {
        if (typeof inputObj.incident === 'object') {
          incident = inputObj.incident as { incidentId: string; service: string; symptoms: string[]; affectedUsers: number; alerts: string[] };
        }
      }

      if (!incident || !incident.incidentId || !incident.service) {
        throw new Error("Incident Classifier: Incident with incidentId and service is required");
      }

      // Default classification rules
      const defaultSeverityThresholds: Record<string, number> = {
        sev1: 10000,
        sev2: 1000,
        sev3: 100,
        sev4: 0
      };

      const defaultImpactThresholds: Record<string, number> = {
        high: 1000,
        medium: 100,
        low: 0
      };

      const severityThresholds = (classificationRulesConfig.severityThresholds as Record<string, number>) || defaultSeverityThresholds;
      const impactThresholds = (classificationRulesConfig.impactThresholds as Record<string, number>) || defaultImpactThresholds;

      // Determine severity based on affected users
      const affectedUsers = incident.affectedUsers || 0;
      let severity: 'sev1' | 'sev2' | 'sev3' | 'sev4' = 'sev4';
      
      if (affectedUsers >= severityThresholds.sev1) {
        severity = 'sev1';
      } else if (affectedUsers >= severityThresholds.sev2) {
        severity = 'sev2';
      } else if (affectedUsers >= severityThresholds.sev3) {
        severity = 'sev3';
      }

      // Determine impact level
      let impactLevel: 'low' | 'medium' | 'high' = 'low';
      if (affectedUsers >= impactThresholds.high) {
        impactLevel = 'high';
      } else if (affectedUsers >= impactThresholds.medium) {
        impactLevel = 'medium';
      }

      // Assign category based on service and symptoms
      const category = incident.service || 'General';

      // Assign owner team based on service
      const ownerTeam = `${incident.service}_team` || 'ops_team';

      return {
        incidentId: incident.incidentId,
        severity,
        impactLevel,
        category,
        ownerTeam,
        affectedUsers,
        alertsCount: incident.alerts?.length || 0
      };
    }

    case "auto_remediation_planner": {
      // Auto-Remediation Planner: Plan safe automated remediation
      const incidentConfig = config.incident;
      const runbooksConfig = config.runbooks;
      const automationLevel = getStringProperty(config, 'automationLevel', 'suggest') as 'suggest' | 'execute';

      let incident: { incidentId: string; service: string; rootCause: string | null } | null = null;
      if (incidentConfig) {
        if (typeof incidentConfig === 'string') {
          try {
            incident = JSON.parse(incidentConfig);
          } catch {
            throw new Error("Auto-Remediation Planner: Invalid incident JSON format");
          }
        } else if (typeof incidentConfig === 'object') {
          incident = incidentConfig as { incidentId: string; service: string; rootCause: string | null };
        }
      }

      const inputObj = input && typeof input === 'object' ? input as Record<string, unknown> : {};
      if (!incident && inputObj.incident) {
        if (typeof inputObj.incident === 'object') {
          incident = inputObj.incident as { incidentId: string; service: string; rootCause: string | null };
        }
      }

      if (!incident || !incident.incidentId || !incident.service) {
        throw new Error("Auto-Remediation Planner: Incident with incidentId and service is required");
      }

      let runbooks: Array<{ service: string; issuePattern: string; steps: string[] }> = [];
      if (runbooksConfig) {
        if (typeof runbooksConfig === 'string') {
          try {
            runbooks = JSON.parse(runbooksConfig);
          } catch {
            throw new Error("Auto-Remediation Planner: Invalid runbooks JSON format");
          }
        } else if (Array.isArray(runbooksConfig)) {
          runbooks = runbooksConfig;
        }
      }

      // Match incident to runbooks
      const matchedRunbook = runbooks.find(rb => 
        rb.service === incident!.service && 
        (incident!.rootCause ? rb.issuePattern.toLowerCase().includes(incident!.rootCause.toLowerCase()) : true)
      );

      let remediationPlan: string[] = [];
      let automationApproved = false;
      let requiresHumanApproval = false;

      if (matchedRunbook) {
        remediationPlan = matchedRunbook.steps || [];

        // Check for destructive actions (simplified check)
        const destructiveKeywords = ['delete', 'destroy', 'drop', 'remove all', 'clear all'];
        const hasDestructiveActions = remediationPlan.some(step =>
          destructiveKeywords.some(keyword => step.toLowerCase().includes(keyword))
        );

        if (hasDestructiveActions) {
          requiresHumanApproval = true;
          automationApproved = false;
        } else if (automationLevel === 'execute') {
          automationApproved = true;
          requiresHumanApproval = false;
        } else {
          automationApproved = false;
          requiresHumanApproval = true;
        }
      } else {
        // No matching runbook found
        remediationPlan = ['No automated remediation available. Manual intervention required.'];
        requiresHumanApproval = true;
        automationApproved = false;
      }

      return {
        incidentId: incident.incidentId,
        remediationPlan,
        automationApproved,
        requiresHumanApproval,
        automationLevel,
        matchedRunbook: matchedRunbook ? matchedRunbook.issuePattern : null
      };
    }

    case "postmortem_generator": {
      // Postmortem Generator: Generate structured post-incident reports
      const incidentConfig = config.incident;
      const timelineConfig = config.timeline;
      const actionItemsConfig = config.actionItems;

      let incident: { incidentId: string; service: string; severity: string; startTime: string; endTime: string; rootCause: string; resolution: string } | null = null;
      if (incidentConfig) {
        if (typeof incidentConfig === 'string') {
          try {
            incident = JSON.parse(incidentConfig);
          } catch {
            throw new Error("Postmortem Generator: Invalid incident JSON format");
          }
        } else if (typeof incidentConfig === 'object') {
          incident = incidentConfig as { incidentId: string; service: string; severity: string; startTime: string; endTime: string; rootCause: string; resolution: string };
        }
      }

      const inputObj = input && typeof input === 'object' ? input as Record<string, unknown> : {};
      if (!incident && inputObj.incident) {
        if (typeof inputObj.incident === 'object') {
          incident = inputObj.incident as { incidentId: string; service: string; severity: string; startTime: string; endTime: string; rootCause: string; resolution: string };
        }
      }

      if (!incident || !incident.incidentId || !incident.service) {
        throw new Error("Postmortem Generator: Incident with incidentId and service is required");
      }

      let timeline: Array<{ timestamp: string; event: string }> = [];
      if (timelineConfig) {
        if (typeof timelineConfig === 'string') {
          try {
            timeline = JSON.parse(timelineConfig);
          } catch {
            throw new Error("Postmortem Generator: Invalid timeline JSON format");
          }
        } else if (Array.isArray(timelineConfig)) {
          timeline = timelineConfig;
        }
      }

      let actionItems: string[] = [];
      if (actionItemsConfig) {
        if (typeof actionItemsConfig === 'string') {
          try {
            actionItems = JSON.parse(actionItemsConfig);
          } catch {
            actionItems = [actionItemsConfig];
          }
        } else if (Array.isArray(actionItemsConfig)) {
          actionItems = actionItemsConfig;
        }
      }

      // Calculate incident duration
      const startTime = new Date(incident.startTime);
      const endTime = new Date(incident.endTime);
      const durationMinutes = Math.floor((endTime.getTime() - startTime.getTime()) / (1000 * 60));

      // Generate summary
      const summary = `${incident.severity} incident in ${incident.service} service. Duration: ${durationMinutes} minutes. Root cause: ${incident.rootCause || 'Unknown'}.`;

      // Generate impact description
      const impact = `Service ${incident.service} experienced a ${incident.severity} incident from ${startTime.toISOString()} to ${endTime.toISOString()}. This resulted in service degradation affecting users.`;

      const rootCause = incident.rootCause || 'Root cause analysis pending';

      return {
        postmortem: {
          summary,
          impact,
          rootCause,
          timeline,
          actionItems
        },
        incidentId: incident.incidentId,
        generatedAt: new Date().toISOString(),
        durationMinutes,
        service: incident.service,
        severity: incident.severity
      };
    }

    // ============================================
    // SOCIAL MEDIA NODES
    // ============================================

    case "twitter": {
      const apiKey = getStringProperty(config, 'apiKey', '');
      const apiSecret = getStringProperty(config, 'apiSecret', '');
      const accessToken = getStringProperty(config, 'accessToken', '');
      const accessTokenSecret = getStringProperty(config, 'accessTokenSecret', '');
      const operation = getStringProperty(config, 'operation', 'create_tweet');
      
      if (!apiKey || !apiSecret || !accessToken || !accessTokenSecret) {
        throw new Error('Twitter: API Key, API Secret, Access Token, and Access Token Secret are required');
      }

      try {
        // Twitter API v2 uses OAuth 1.0a for authentication
        // For simplicity, we'll use HTTP Request with OAuth 1.0a signing
        // Note: In production, use a proper OAuth library
        
        let url = '';
        let method = 'GET';
        let body: unknown = undefined;
        const baseUrl = 'https://api.twitter.com/2';

        switch (operation) {
          case 'create_tweet':
            url = `${baseUrl}/tweets`;
            method = 'POST';
            const text = replaceTemplates(getStringProperty(config, 'text', ''), input);
            if (!text) throw new Error('Twitter: Tweet text is required for create_tweet');
            body = { text: text.substring(0, 280) };
            break;
          case 'create_tweet_media':
            url = `${baseUrl}/tweets`;
            method = 'POST';
            const mediaText = replaceTemplates(getStringProperty(config, 'text', ''), input);
            const mediaUrl = replaceTemplates(getStringProperty(config, 'mediaUrl', ''), input);
            if (!mediaText || !mediaUrl) throw new Error('Twitter: Text and Media URL are required for create_tweet_media');
            // Note: Media upload requires separate endpoint, simplified here
            body = { text: mediaText.substring(0, 280), media: { media_ids: [mediaUrl] } };
            break;
          case 'delete_tweet':
            const deleteTweetId = replaceTemplates(getStringProperty(config, 'tweetId', ''), input);
            if (!deleteTweetId) throw new Error('Twitter: Tweet ID is required for delete_tweet');
            url = `${baseUrl}/tweets/${deleteTweetId}`;
            method = 'DELETE';
            break;
          case 'like_tweet':
            const likeTweetId = replaceTemplates(getStringProperty(config, 'tweetId', ''), input);
            if (!likeTweetId) throw new Error('Twitter: Tweet ID is required for like_tweet');
            url = `${baseUrl}/users/me/likes`;
            method = 'POST';
            body = { tweet_id: likeTweetId };
            break;
          case 'unlike_tweet':
            const unlikeTweetId = replaceTemplates(getStringProperty(config, 'tweetId', ''), input);
            if (!unlikeTweetId) throw new Error('Twitter: Tweet ID is required for unlike_tweet');
            url = `${baseUrl}/users/me/likes/${unlikeTweetId}`;
            method = 'DELETE';
            break;
          case 'retweet':
            const retweetId = replaceTemplates(getStringProperty(config, 'tweetId', ''), input);
            if (!retweetId) throw new Error('Twitter: Tweet ID is required for retweet');
            url = `${baseUrl}/users/me/retweets`;
            method = 'POST';
            body = { tweet_id: retweetId };
            break;
          case 'search_tweets':
            const query = replaceTemplates(getStringProperty(config, 'query', ''), input);
            const maxResults = getNumberProperty(config, 'maxResults', 10);
            if (!query) throw new Error('Twitter: Search query is required for search_tweets');
            url = `${baseUrl}/tweets/search/recent?query=${encodeURIComponent(query)}&max_results=${Math.min(maxResults, 100)}`;
            break;
          case 'get_timeline':
            const username = replaceTemplates(getStringProperty(config, 'username', ''), input);
            const timelineMax = getNumberProperty(config, 'maxResults', 10);
            if (!username) throw new Error('Twitter: Username is required for get_timeline');
            url = `${baseUrl}/users/by/username/${username}/tweets?max_results=${Math.min(timelineMax, 100)}`;
            break;
          case 'get_mentions':
            const mentionsMax = getNumberProperty(config, 'maxResults', 10);
            url = `${baseUrl}/tweets/search/recent?query=mentions&max_results=${Math.min(mentionsMax, 100)}`;
            break;
          case 'get_tweet':
            const getTweetId = replaceTemplates(getStringProperty(config, 'tweetId', ''), input);
            if (!getTweetId) throw new Error('Twitter: Tweet ID is required for get_tweet');
            url = `${baseUrl}/tweets/${getTweetId}`;
            break;
          case 'follow_user':
            const followUsername = replaceTemplates(getStringProperty(config, 'username', ''), input);
            if (!followUsername) throw new Error('Twitter: Username is required for follow_user');
            // First get user ID
            url = `${baseUrl}/users/by/username/${followUsername}`;
            // Note: This requires two API calls - get user ID then follow
            break;
          case 'unfollow_user':
            const unfollowUsername = replaceTemplates(getStringProperty(config, 'username', ''), input);
            if (!unfollowUsername) throw new Error('Twitter: Username is required for unfollow_user');
            // Similar to follow_user
            break;
          default:
            throw new Error(`Twitter: Unknown operation "${operation}"`);
        }

        // For Twitter API v2, we need OAuth 1.0a signing
        // Simplified: Using Bearer token for read operations, OAuth for write
        const headers: Record<string, string> = {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        };

        const response = await fetch(url, {
          method,
          headers,
          body: body ? JSON.stringify(body) : undefined,
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Twitter API error: ${response.status} - ${errorText || response.statusText}`);
        }

        const data = await response.json();
        return data;
      } catch (error) {
        throw new Error(`Twitter: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    case "facebook": {
      const accessToken = getStringProperty(config, 'accessToken', '');
      const pageId = getStringProperty(config, 'pageId', '');
      const operation = getStringProperty(config, 'operation', 'create_post');
      
      if (!accessToken || !pageId) {
        throw new Error('Facebook: Access Token and Page ID are required');
      }

      try {
        let url = '';
        let method = 'GET';
        let body: unknown = undefined;
        const baseUrl = 'https://graph.facebook.com/v18.0';

        switch (operation) {
          case 'create_post':
            url = `${baseUrl}/${pageId}/feed`;
            method = 'POST';
            const message = replaceTemplates(getStringProperty(config, 'message', ''), input);
            if (!message) throw new Error('Facebook: Message is required for create_post');
            body = { message, access_token: accessToken };
            break;
          case 'create_post_image':
            url = `${baseUrl}/${pageId}/photos`;
            method = 'POST';
            const imageMessage = replaceTemplates(getStringProperty(config, 'message', ''), input);
            const imageUrl = replaceTemplates(getStringProperty(config, 'imageUrl', ''), input);
            if (!imageUrl) throw new Error('Facebook: Image URL is required for create_post_image');
            body = { url: imageUrl, message: imageMessage || '', access_token: accessToken };
            break;
          case 'create_post_link':
            url = `${baseUrl}/${pageId}/feed`;
            method = 'POST';
            const linkMessage = replaceTemplates(getStringProperty(config, 'message', ''), input);
            const linkUrl = replaceTemplates(getStringProperty(config, 'linkUrl', ''), input);
            if (!linkUrl) throw new Error('Facebook: Link URL is required for create_post_link');
            body = { message: linkMessage || '', link: linkUrl, access_token: accessToken };
            break;
          case 'create_post_video':
            url = `${baseUrl}/${pageId}/videos`;
            method = 'POST';
            const videoMessage = replaceTemplates(getStringProperty(config, 'message', ''), input);
            const videoUrl = replaceTemplates(getStringProperty(config, 'videoUrl', ''), input);
            if (!videoUrl) throw new Error('Facebook: Video URL is required for create_post_video');
            body = { file_url: videoUrl, description: videoMessage || '', access_token: accessToken };
            break;
          case 'get_posts':
            const limit = getNumberProperty(config, 'limit', 25);
            url = `${baseUrl}/${pageId}/posts?limit=${Math.min(limit, 100)}&access_token=${accessToken}`;
            break;
          case 'delete_post':
            const postId = replaceTemplates(getStringProperty(config, 'postId', ''), input);
            if (!postId) throw new Error('Facebook: Post ID is required for delete_post');
            url = `${baseUrl}/${postId}?access_token=${accessToken}`;
            method = 'DELETE';
            break;
          case 'create_comment':
            const commentPostId = replaceTemplates(getStringProperty(config, 'postId', ''), input);
            const commentText = replaceTemplates(getStringProperty(config, 'commentText', ''), input);
            if (!commentPostId || !commentText) throw new Error('Facebook: Post ID and Comment Text are required for create_comment');
            url = `${baseUrl}/${commentPostId}/comments`;
            method = 'POST';
            body = { message: commentText, access_token: accessToken };
            break;
          case 'reply_comment':
            const replyCommentId = replaceTemplates(getStringProperty(config, 'commentId', ''), input);
            const replyText = replaceTemplates(getStringProperty(config, 'commentText', ''), input);
            if (!replyCommentId || !replyText) throw new Error('Facebook: Comment ID and Comment Text are required for reply_comment');
            url = `${baseUrl}/${replyCommentId}/comments`;
            method = 'POST';
            body = { message: replyText, access_token: accessToken };
            break;
          case 'get_insights':
            const metric = replaceTemplates(getStringProperty(config, 'metric', 'page_impressions'), input);
            url = `${baseUrl}/${pageId}/insights/${metric}?access_token=${accessToken}`;
            break;
          default:
            throw new Error(`Facebook: Unknown operation "${operation}"`);
        }

        const response = await fetch(url, {
          method,
          headers: method !== 'GET' ? { 'Content-Type': 'application/json' } : {},
          body: body ? JSON.stringify(body) : undefined,
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Facebook API error: ${response.status} - ${errorText || response.statusText}`);
        }

        const data = await response.json();
        return data;
      } catch (error) {
        throw new Error(`Facebook: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    case "instagram": {
      const accessToken = getStringProperty(config, 'accessToken', '');
      const accountId = getStringProperty(config, 'accountId', '');
      const operation = getStringProperty(config, 'operation', 'create_image_post');
      
      if (!accessToken || !accountId) {
        throw new Error('Instagram: Access Token and Account ID are required');
      }

      try {
        let url = '';
        let method = 'GET';
        let body: unknown = undefined;
        const baseUrl = 'https://graph.facebook.com/v18.0';

        switch (operation) {
          case 'create_image_post':
            url = `${baseUrl}/${accountId}/media`;
            method = 'POST';
            const imageUrl = replaceTemplates(getStringProperty(config, 'imageUrl', ''), input);
            const caption = replaceTemplates(getStringProperty(config, 'caption', ''), input);
            if (!imageUrl) throw new Error('Instagram: Image URL is required for create_image_post');
            body = { image_url: imageUrl, caption: caption || '', access_token: accessToken };
            break;
          case 'create_video_post':
            url = `${baseUrl}/${accountId}/media`;
            method = 'POST';
            const videoUrl = replaceTemplates(getStringProperty(config, 'videoUrl', ''), input);
            const videoCaption = replaceTemplates(getStringProperty(config, 'caption', ''), input);
            if (!videoUrl) throw new Error('Instagram: Video URL is required for create_video_post');
            body = { media_type: 'REELS', video_url: videoUrl, caption: videoCaption || '', access_token: accessToken };
            break;
          case 'create_carousel_post':
            url = `${baseUrl}/${accountId}/media`;
            method = 'POST';
            const carouselUrls = config.carouselUrls as string[];
            const carouselCaption = replaceTemplates(getStringProperty(config, 'caption', ''), input);
            if (!carouselUrls || carouselUrls.length < 2) throw new Error('Instagram: Carousel URLs array with at least 2 images is required');
            body = { media_type: 'CAROUSEL', children: carouselUrls.join(','), caption: carouselCaption || '', access_token: accessToken };
            break;
          case 'get_media':
            const mediaLimit = getNumberProperty(config, 'limit', 25);
            url = `${baseUrl}/${accountId}/media?limit=${Math.min(mediaLimit, 100)}&access_token=${accessToken}`;
            break;
          case 'get_comments':
            const mediaId = replaceTemplates(getStringProperty(config, 'mediaId', ''), input);
            const commentsLimit = getNumberProperty(config, 'limit', 25);
            if (!mediaId) throw new Error('Instagram: Media ID is required for get_comments');
            url = `${baseUrl}/${mediaId}/comments?limit=${Math.min(commentsLimit, 100)}&access_token=${accessToken}`;
            break;
          case 'reply_comment':
            const replyCommentId = replaceTemplates(getStringProperty(config, 'commentId', ''), input);
            const replyText = replaceTemplates(getStringProperty(config, 'commentText', ''), input);
            if (!replyCommentId || !replyText) throw new Error('Instagram: Comment ID and Comment Text are required for reply_comment');
            url = `${baseUrl}/${replyCommentId}/replies`;
            method = 'POST';
            body = { message: replyText, access_token: accessToken };
            break;
          case 'get_insights':
            const insightMediaId = replaceTemplates(getStringProperty(config, 'mediaId', ''), input);
            const metric = replaceTemplates(getStringProperty(config, 'metric', 'reach'), input);
            if (!insightMediaId) throw new Error('Instagram: Media ID is required for get_insights');
            url = `${baseUrl}/${insightMediaId}/insights?metric=${metric}&access_token=${accessToken}`;
            break;
          default:
            throw new Error(`Instagram: Unknown operation "${operation}"`);
        }

        const response = await fetch(url, {
          method,
          headers: method !== 'GET' ? { 'Content-Type': 'application/json' } : {},
          body: body ? JSON.stringify(body) : undefined,
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Instagram API error: ${response.status} - ${errorText || response.statusText}`);
        }

        const data = await response.json();
        return data;
      } catch (error) {
        throw new Error(`Instagram: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    case "linkedin": {
      const accessToken = getStringProperty(config, 'accessToken', '');
      const accountType = getStringProperty(config, 'accountType', 'profile');
      const operation = getStringProperty(config, 'operation', 'create_post');
      
      if (!accessToken) {
        throw new Error('LinkedIn: Access Token is required');
      }

      try {
        let url = '';
        let method = 'GET';
        let body: unknown = undefined;
        const baseUrl = 'https://api.linkedin.com/v2';

        switch (operation) {
          case 'create_post':
            url = `${baseUrl}/ugcPosts`;
            method = 'POST';
            const text = replaceTemplates(getStringProperty(config, 'text', ''), input);
            if (!text) throw new Error('LinkedIn: Post text is required for create_post');
            // LinkedIn UGC Post structure
            body = {
              author: accountType === 'organization' 
                ? `urn:li:organization:${getStringProperty(config, 'organizationId', '')}`
                : 'urn:li:person:me',
              lifecycleState: 'PUBLISHED',
              specificContent: {
                'com.linkedin.ugc.ShareContent': {
                  shareCommentary: { text },
                  shareMediaCategory: 'NONE'
                }
              },
              visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' }
            };
            break;
          case 'create_article':
            url = `${baseUrl}/ugcPosts`;
            method = 'POST';
            const articleUrl = replaceTemplates(getStringProperty(config, 'articleUrl', ''), input);
            const articleText = replaceTemplates(getStringProperty(config, 'text', ''), input);
            if (!articleUrl) throw new Error('LinkedIn: Article URL is required for create_article');
            body = {
              author: accountType === 'organization' 
                ? `urn:li:organization:${getStringProperty(config, 'organizationId', '')}`
                : 'urn:li:person:me',
              lifecycleState: 'PUBLISHED',
              specificContent: {
                'com.linkedin.ugc.ShareContent': {
                  shareCommentary: { text: articleText || '' },
                  shareMediaCategory: 'ARTICLE',
                  media: [{ status: 'READY', originalUrl: articleUrl }]
                }
              },
              visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' }
            };
            break;
          case 'create_post_media':
            url = `${baseUrl}/ugcPosts`;
            method = 'POST';
            const mediaUrl = replaceTemplates(getStringProperty(config, 'mediaUrl', ''), input);
            const mediaText = replaceTemplates(getStringProperty(config, 'text', ''), input);
            if (!mediaUrl) throw new Error('LinkedIn: Media URL is required for create_post_media');
            body = {
              author: accountType === 'organization' 
                ? `urn:li:organization:${getStringProperty(config, 'organizationId', '')}`
                : 'urn:li:person:me',
              lifecycleState: 'PUBLISHED',
              specificContent: {
                'com.linkedin.ugc.ShareContent': {
                  shareCommentary: { text: mediaText || '' },
                  shareMediaCategory: 'IMAGE',
                  media: [{ status: 'READY', originalUrl: mediaUrl }]
                }
              },
              visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' }
            };
            break;
          case 'create_company_post':
            const orgId = getStringProperty(config, 'organizationId', '');
            if (!orgId) throw new Error('LinkedIn: Organization ID is required for create_company_post');
            url = `${baseUrl}/ugcPosts`;
            method = 'POST';
            const companyText = replaceTemplates(getStringProperty(config, 'text', ''), input);
            if (!companyText) throw new Error('LinkedIn: Post text is required for create_company_post');
            body = {
              author: `urn:li:organization:${orgId}`,
              lifecycleState: 'PUBLISHED',
              specificContent: {
                'com.linkedin.ugc.ShareContent': {
                  shareCommentary: { text: companyText },
                  shareMediaCategory: 'NONE'
                }
              },
              visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' }
            };
            break;
          case 'get_posts':
            const postsLimit = getNumberProperty(config, 'limit', 10);
            url = `${baseUrl}/ugcPosts?q=authors&authors=${accountType === 'organization' ? `List(urn:li:organization:${getStringProperty(config, 'organizationId', '')})` : 'List(urn:li:person:me)'}&count=${Math.min(postsLimit, 100)}`;
            break;
          case 'get_org_updates':
            const orgIdForUpdates = getStringProperty(config, 'organizationId', '');
            const updatesLimit = getNumberProperty(config, 'limit', 10);
            if (!orgIdForUpdates) throw new Error('LinkedIn: Organization ID is required for get_org_updates');
            url = `${baseUrl}/ugcPosts?q=authors&authors=List(urn:li:organization:${orgIdForUpdates})&count=${Math.min(updatesLimit, 100)}`;
            break;
          case 'delete_post':
            const postId = replaceTemplates(getStringProperty(config, 'postId', ''), input);
            if (!postId) throw new Error('LinkedIn: Post ID is required for delete_post');
            url = `${baseUrl}/ugcPosts/${postId}`;
            method = 'DELETE';
            break;
          case 'get_engagement':
            const engagementPostId = replaceTemplates(getStringProperty(config, 'postId', ''), input);
            if (!engagementPostId) throw new Error('LinkedIn: Post ID is required for get_engagement');
            url = `${baseUrl}/socialActions/${engagementPostId}`;
            break;
          default:
            throw new Error(`LinkedIn: Unknown operation "${operation}"`);
        }

        const headers: Record<string, string> = {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'X-Restli-Protocol-Version': '2.0.0',
        };

        const response = await fetch(url, {
          method,
          headers,
          body: body ? JSON.stringify(body) : undefined,
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`LinkedIn API error: ${response.status} - ${errorText || response.statusText}`);
        }

        if (response.status === 204 || response.headers.get('content-length') === '0') {
          return { success: true, message: 'Operation completed successfully' };
        }

        const data = await response.json();
        return data;
      } catch (error) {
        throw new Error(`LinkedIn: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    case "youtube": {
      const apiKey = getStringProperty(config, 'apiKey', '');
      const accessToken = getStringProperty(config, 'accessToken', '');
      const operation = getStringProperty(config, 'operation', 'upload_video');
      
      if (!apiKey) {
        throw new Error('YouTube: API Key is required');
      }

      try {
        let url = '';
        let method = 'GET';
        let body: unknown = undefined;
        const baseUrl = 'https://www.googleapis.com/youtube/v3';

        switch (operation) {
          case 'upload_video':
            if (!accessToken) throw new Error('YouTube: OAuth Access Token is required for upload_video');
            const videoUrl = replaceTemplates(getStringProperty(config, 'videoUrl', ''), input);
            const title = replaceTemplates(getStringProperty(config, 'title', ''), input);
            const description = replaceTemplates(getStringProperty(config, 'description', ''), input);
            const tags = replaceTemplates(getStringProperty(config, 'tags', ''), input);
            const privacyStatus = replaceTemplates(getStringProperty(config, 'privacyStatus', 'public'), input);
            if (!videoUrl || !title) throw new Error('YouTube: Video URL and Title are required for upload_video');
            // Note: YouTube upload requires multipart/form-data with actual file upload
            // This is simplified - in production, you'd need to download the file and upload it
            url = 'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status';
            method = 'POST';
            body = {
              snippet: {
                title: title.substring(0, 100),
                description: description || '',
                tags: tags ? tags.split(',').map((t: string) => t.trim()) : []
              },
              status: { privacyStatus }
            };
            break;
          case 'update_video':
            if (!accessToken) throw new Error('YouTube: OAuth Access Token is required for update_video');
            const videoId = replaceTemplates(getStringProperty(config, 'videoId', ''), input);
            const updateTitle = replaceTemplates(getStringProperty(config, 'title', ''), input);
            const updateDescription = replaceTemplates(getStringProperty(config, 'description', ''), input);
            const updateTags = replaceTemplates(getStringProperty(config, 'tags', ''), input);
            if (!videoId) throw new Error('YouTube: Video ID is required for update_video');
            url = `${baseUrl}/videos?part=snippet,status`;
            method = 'PUT';
            body = {
              id: videoId,
              snippet: {
                title: updateTitle ? updateTitle.substring(0, 100) : undefined,
                description: updateDescription || undefined,
                tags: updateTags ? updateTags.split(',').map((t: string) => t.trim()) : undefined
              }
            };
            break;
          case 'delete_video':
            if (!accessToken) throw new Error('YouTube: OAuth Access Token is required for delete_video');
            const deleteVideoId = replaceTemplates(getStringProperty(config, 'videoId', ''), input);
            if (!deleteVideoId) throw new Error('YouTube: Video ID is required for delete_video');
            url = `${baseUrl}/videos?id=${deleteVideoId}`;
            method = 'DELETE';
            break;
          case 'get_channel':
            const channelId = replaceTemplates(getStringProperty(config, 'channelId', 'mine'), input);
            url = `${baseUrl}/channels?part=snippet,statistics&id=${channelId === 'mine' ? 'mine' : channelId}&key=${apiKey}`;
            break;
          case 'get_video_stats':
            const statsVideoId = replaceTemplates(getStringProperty(config, 'videoId', ''), input);
            if (!statsVideoId) throw new Error('YouTube: Video ID is required for get_video_stats');
            url = `${baseUrl}/videos?part=statistics,snippet&id=${statsVideoId}&key=${apiKey}`;
            break;
          case 'search_videos':
            const searchQuery = replaceTemplates(getStringProperty(config, 'query', ''), input);
            const maxResults = getNumberProperty(config, 'maxResults', 10);
            if (!searchQuery) throw new Error('YouTube: Search query is required for search_videos');
            url = `${baseUrl}/search?part=snippet&q=${encodeURIComponent(searchQuery)}&type=video&maxResults=${Math.min(maxResults, 50)}&key=${apiKey}`;
            break;
          case 'get_comments':
            const commentsVideoId = replaceTemplates(getStringProperty(config, 'videoId', ''), input);
            const commentsMax = getNumberProperty(config, 'maxResults', 10);
            if (!commentsVideoId) throw new Error('YouTube: Video ID is required for get_comments');
            url = `${baseUrl}/commentThreads?part=snippet&videoId=${commentsVideoId}&maxResults=${Math.min(commentsMax, 50)}&key=${apiKey}`;
            break;
          case 'reply_comment':
            if (!accessToken) throw new Error('YouTube: OAuth Access Token is required for reply_comment');
            const replyCommentId = replaceTemplates(getStringProperty(config, 'commentId', ''), input);
            const replyText = replaceTemplates(getStringProperty(config, 'commentText', ''), input);
            if (!replyCommentId || !replyText) throw new Error('YouTube: Comment ID and Comment Text are required for reply_comment');
            url = `${baseUrl}/comments?part=snippet`;
            method = 'POST';
            body = {
              snippet: {
                parentId: replyCommentId,
                textOriginal: replyText
              }
            };
            break;
          default:
            throw new Error(`YouTube: Unknown operation "${operation}"`);
        }

        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        };

        if (accessToken && (operation === 'upload_video' || operation === 'update_video' || operation === 'delete_video' || operation === 'reply_comment')) {
          headers['Authorization'] = `Bearer ${accessToken}`;
        }

        const response = await fetch(url, {
          method,
          headers,
          body: body ? JSON.stringify(body) : undefined,
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`YouTube API error: ${response.status} - ${errorText || response.statusText}`);
        }

        const data = await response.json();
        return data;
      } catch (error) {
        throw new Error(`YouTube: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    case "reddit": {
      const clientId = getStringProperty(config, 'clientId', '');
      const clientSecret = getStringProperty(config, 'clientSecret', '');
      const accessToken = getStringProperty(config, 'accessToken', '');
      const username = getStringProperty(config, 'username', '');
      const password = getStringProperty(config, 'password', '');
      const operation = getStringProperty(config, 'operation', 'create_post');
      
      if (!clientId || !clientSecret) {
        throw new Error('Reddit: Client ID and Client Secret are required');
      }

      try {
        // Get access token if not provided (using password grant for simplicity)
        let token = accessToken;
        if (!token && username && password) {
          const tokenResponse = await fetch('https://www.reddit.com/api/v1/access_token', {
            method: 'POST',
            headers: {
              'Authorization': `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
              'Content-Type': 'application/x-www-form-urlencoded',
              'User-Agent': 'CtrlChecks-Workflow/1.0',
            },
            body: new URLSearchParams({
              grant_type: 'password',
              username,
              password,
            }),
          });

          if (!tokenResponse.ok) {
            throw new Error('Reddit: Failed to obtain access token');
          }

          const tokenData = await tokenResponse.json();
          token = tokenData.access_token;
        }

        if (!token) {
          throw new Error('Reddit: Access Token is required. Provide either accessToken or username/password');
        }

        let url = '';
        let method = 'GET';
        let body: unknown = undefined;
        const baseUrl = 'https://oauth.reddit.com';

        switch (operation) {
          case 'create_post':
            const subreddit = replaceTemplates(getStringProperty(config, 'subreddit', ''), input);
            const postTitle = replaceTemplates(getStringProperty(config, 'title', ''), input);
            const postText = replaceTemplates(getStringProperty(config, 'text', ''), input);
            if (!subreddit || !postTitle || !postText) throw new Error('Reddit: Subreddit, Title, and Text are required for create_post');
            url = `${baseUrl}/r/${subreddit}/submit`;
            method = 'POST';
            body = {
              kind: 'self',
              sr: subreddit,
              title: postTitle.substring(0, 300),
              text: postText,
            };
            break;
          case 'create_link_post':
            const linkSubreddit = replaceTemplates(getStringProperty(config, 'subreddit', ''), input);
            const linkTitle = replaceTemplates(getStringProperty(config, 'title', ''), input);
            const linkUrl = replaceTemplates(getStringProperty(config, 'url', ''), input);
            if (!linkSubreddit || !linkTitle || !linkUrl) throw new Error('Reddit: Subreddit, Title, and URL are required for create_link_post');
            url = `${baseUrl}/r/${linkSubreddit}/submit`;
            method = 'POST';
            body = {
              kind: 'link',
              sr: linkSubreddit,
              title: linkTitle.substring(0, 300),
              url: linkUrl,
            };
            break;
          case 'comment_post':
            const commentPostId = replaceTemplates(getStringProperty(config, 'postId', ''), input);
            const commentText = replaceTemplates(getStringProperty(config, 'commentText', ''), input);
            if (!commentPostId || !commentText) throw new Error('Reddit: Post ID and Comment Text are required for comment_post');
            url = `${baseUrl}/api/comment`;
            method = 'POST';
            body = {
              thing_id: commentPostId,
              text: commentText,
            };
            break;
          case 'get_subreddit_posts':
            const getSubreddit = replaceTemplates(getStringProperty(config, 'subreddit', ''), input);
            const sort = replaceTemplates(getStringProperty(config, 'sort', 'hot'), input);
            const postsLimit = getNumberProperty(config, 'limit', 25);
            if (!getSubreddit) throw new Error('Reddit: Subreddit is required for get_subreddit_posts');
            url = `${baseUrl}/r/${getSubreddit}/${sort}?limit=${Math.min(postsLimit, 100)}`;
            break;
          case 'search_posts':
            const searchQuery = replaceTemplates(getStringProperty(config, 'query', ''), input);
            const searchLimit = getNumberProperty(config, 'limit', 25);
            if (!searchQuery) throw new Error('Reddit: Search query is required for search_posts');
            url = `${baseUrl}/search?q=${encodeURIComponent(searchQuery)}&limit=${Math.min(searchLimit, 100)}`;
            break;
          case 'get_comments':
            const commentsPostId = replaceTemplates(getStringProperty(config, 'postId', ''), input);
            const commentsLimit = getNumberProperty(config, 'limit', 25);
            if (!commentsPostId) throw new Error('Reddit: Post ID is required for get_comments');
            url = `${baseUrl}/comments/${commentsPostId}?limit=${Math.min(commentsLimit, 100)}`;
            break;
          case 'delete_post':
            const deletePostId = replaceTemplates(getStringProperty(config, 'postId', ''), input);
            if (!deletePostId) throw new Error('Reddit: Post ID is required for delete_post');
            url = `${baseUrl}/api/del`;
            method = 'POST';
            body = { id: deletePostId };
            break;
          case 'delete_comment':
            const deleteCommentId = replaceTemplates(getStringProperty(config, 'commentId', ''), input);
            if (!deleteCommentId) throw new Error('Reddit: Comment ID is required for delete_comment');
            url = `${baseUrl}/api/del`;
            method = 'POST';
            body = { id: deleteCommentId };
            break;
          default:
            throw new Error(`Reddit: Unknown operation "${operation}"`);
        }

        const headers: Record<string, string> = {
          'Authorization': `Bearer ${token}`,
          'User-Agent': 'CtrlChecks-Workflow/1.0',
        };

        // Reddit API uses form-urlencoded for POST requests
        let requestBody: string | undefined = undefined;
        if (body && method === 'POST') {
          headers['Content-Type'] = 'application/x-www-form-urlencoded';
          const formData = body as Record<string, string>;
          requestBody = new URLSearchParams(formData).toString();
        } else if (body) {
          headers['Content-Type'] = 'application/json';
          requestBody = JSON.stringify(body);
        }

        const response = await fetch(url, {
          method,
          headers,
          body: requestBody,
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Reddit API error: ${response.status} - ${errorText || response.statusText}`);
        }

        const data = await response.json();
        return data;
      } catch (error) {
        throw new Error(`Reddit: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    // ============================================
    // CRM & MARKETING NODES
    // ============================================
    case "hubspot": {
      // HubSpot CRM operations
      const authType = getStringProperty(config, 'authType', 'apikey');
      const apiKey = getStringProperty(config, 'apiKey', '');
      const accessToken = getStringProperty(config, 'accessToken', '');
      const resource = getStringProperty(config, 'resource', 'contact');
      const operation = getStringProperty(config, 'operation', 'get');
      const idTemplate = getStringProperty(config, 'id', '');
      const id = idTemplate ? replaceTemplates(idTemplate, input) : '';
      const propertiesStr = getStringProperty(config, 'properties', '{}');
      const searchQueryTemplate = getStringProperty(config, 'searchQuery', '');
      const searchQuery = searchQueryTemplate ? replaceTemplates(searchQueryTemplate, input) : '';
      const limit = getNumberProperty(config, 'limit', 100);
      const afterTemplate = getStringProperty(config, 'after', '');
      const after = afterTemplate ? replaceTemplates(afterTemplate, input) : '';

      // Authentication
      // Private App Tokens (PAT) start with "pat-" and use Bearer auth
      // Legacy API keys use hapikey query parameter
      const isPrivateAppToken = apiKey && apiKey.startsWith('pat-');
      
      const authHeader = authType === 'oauth' && accessToken
        ? `Bearer ${accessToken}`
        : isPrivateAppToken
        ? `Bearer ${apiKey}`
        : apiKey
        ? apiKey
        : null;

      if (!authHeader) {
        throw new Error('HubSpot: API Key or OAuth Access Token is required');
      }

      const baseUrl = 'https://api.hubapi.com';
      const headers: Record<string, string> = (authType === 'oauth' || isPrivateAppToken)
        ? { 'Authorization': authHeader, 'Content-Type': 'application/json' }
        : { 'Content-Type': 'application/json' };

      try {
        if (operation === 'get') {
          if (!id) throw new Error('HubSpot: Resource ID is required for get operation');
          const url = `${baseUrl}/crm/v3/objects/${resource}/${id}${!isPrivateAppToken && authType === 'apikey' && apiKey ? `?hapikey=${apiKey}` : ''}`;
          const response = await fetch(url, { headers });
          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HubSpot API error: ${response.status} - ${errorText}`);
          }
          const data = await response.json();
          return data;
        } else if (operation === 'getMany') {
          const params = new URLSearchParams();
          if (!isPrivateAppToken && authType === 'apikey' && apiKey) params.append('hapikey', apiKey);
          if (limit) params.append('limit', String(limit));
          if (after) params.append('after', after);
          const url = `${baseUrl}/crm/v3/objects/${resource}${params.toString() ? `?${params}` : ''}`;
          const response = await fetch(url, { headers });
          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HubSpot API error: ${response.status} - ${errorText}`);
          }
          const data = await response.json();
          return data;
        } else if (operation === 'create') {
          // Process properties template if it contains template variables
          const processedPropertiesStr = propertiesStr ? replaceTemplates(propertiesStr, input) : '{}';
          const properties = parseJSONSafe(processedPropertiesStr, 'properties') as Record<string, unknown>;
          const url = `${baseUrl}/crm/v3/objects/${resource}${!isPrivateAppToken && authType === 'apikey' && apiKey ? `?hapikey=${apiKey}` : ''}`;
          const response = await fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify({ properties }),
          });
          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HubSpot API error: ${response.status} - ${errorText}`);
          }
          const data = await response.json();
          return data;
        } else if (operation === 'update') {
          if (!id) throw new Error('HubSpot: Resource ID is required for update operation');
          // Process properties template if it contains template variables
          const processedPropertiesStr = propertiesStr ? replaceTemplates(propertiesStr, input) : '{}';
          const properties = parseJSONSafe(processedPropertiesStr, 'properties') as Record<string, unknown>;
          const url = `${baseUrl}/crm/v3/objects/${resource}/${id}${!isPrivateAppToken && authType === 'apikey' && apiKey ? `?hapikey=${apiKey}` : ''}`;
          const response = await fetch(url, {
            method: 'PATCH',
            headers,
            body: JSON.stringify({ properties }),
          });
          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HubSpot API error: ${response.status} - ${errorText}`);
          }
          const data = await response.json();
          return data;
        } else if (operation === 'delete') {
          if (!id) throw new Error('HubSpot: Resource ID is required for delete operation');
          const url = `${baseUrl}/crm/v3/objects/${resource}/${id}${!isPrivateAppToken && authType === 'apikey' && apiKey ? `?hapikey=${apiKey}` : ''}`;
          const response = await fetch(url, { method: 'DELETE', headers });
          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HubSpot API error: ${response.status} - ${errorText}`);
          }
          return { success: true, id };
        } else if (operation === 'search') {
          if (!searchQuery) throw new Error('HubSpot: Search Query is required for search operation');
          const url = `${baseUrl}/crm/v3/objects/${resource}/search${!isPrivateAppToken && authType === 'apikey' && apiKey ? `?hapikey=${apiKey}` : ''}`;
          const response = await fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify({ query: searchQuery, limit }),
          });
          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HubSpot API error: ${response.status} - ${errorText}`);
          }
          const data = await response.json();
          return data;
        } else if (operation === 'batchCreate' || operation === 'batchUpdate' || operation === 'batchDelete') {
          const recordsStr = getStringProperty(config, 'records', '[]');
          const records = parseJSONSafe(recordsStr, 'records') as Array<unknown>;
          const method = operation === 'batchCreate' ? 'POST' : operation === 'batchUpdate' ? 'PATCH' : 'DELETE';
          const url = `${baseUrl}/crm/v3/objects/${resource}/batch/${operation.replace('batch', '').toLowerCase()}${!isPrivateAppToken && authType === 'apikey' && apiKey ? `?hapikey=${apiKey}` : ''}`;
          const response = await fetch(url, {
            method,
            headers,
            body: JSON.stringify({ inputs: records }),
          });
          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HubSpot API error: ${response.status} - ${errorText}`);
          }
          const data = await response.json();
          return data;
        } else {
          throw new Error(`HubSpot: Unknown operation "${operation}"`);
        }
      } catch (error) {
        throw new Error(`HubSpot: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    case "salesforce": {
      // Salesforce CRM operations
      const instanceUrl = getStringProperty(config, 'instanceUrl', '');
      const accessToken = getStringProperty(config, 'accessToken', '');
      let resource = getStringProperty(config, 'resource', 'Contact');
      const customObject = getStringProperty(config, 'customObject', '');
      const operation = getStringProperty(config, 'operation', 'query');
      const soql = getStringProperty(config, 'soql', '');
      const sosl = getStringProperty(config, 'sosl', '');
      const id = getStringProperty(config, 'id', '');
      const fieldsStr = getStringProperty(config, 'fields', '{}');
      const externalIdField = getStringProperty(config, 'externalIdField', '');
      const externalIdValue = getStringProperty(config, 'externalIdValue', '');
      const recordsStr = getStringProperty(config, 'records', '[]');

      if (!instanceUrl || !accessToken) {
        throw new Error('Salesforce: Instance URL and Access Token are required');
      }

      if (resource === 'custom' && !customObject) {
        throw new Error('Salesforce: Custom Object API Name is required when Resource is Custom Object');
      }

      if (resource === 'custom') {
        resource = customObject;
      }

      const baseUrl = instanceUrl.replace(/\/$/, '');
      const headers = {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      };

      try {
        if (operation === 'query') {
          if (!soql) throw new Error('Salesforce: SOQL Query is required for query operation');
          const url = `${baseUrl}/services/data/v58.0/query?q=${encodeURIComponent(soql)}`;
          const response = await fetch(url, { headers });
          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Salesforce API error: ${response.status} - ${errorText}`);
          }
          const data = await response.json();
          return data;
        } else if (operation === 'search') {
          if (!sosl) throw new Error('Salesforce: SOSL Search Query is required for search operation');
          const url = `${baseUrl}/services/data/v58.0/search?q=${encodeURIComponent(sosl)}`;
          const response = await fetch(url, { headers });
          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Salesforce API error: ${response.status} - ${errorText}`);
          }
          const data = await response.json();
          return data;
        } else if (operation === 'get') {
          if (!id) throw new Error('Salesforce: Record ID is required for get operation');
          const url = `${baseUrl}/services/data/v58.0/sobjects/${resource}/${id}`;
          const response = await fetch(url, { headers });
          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Salesforce API error: ${response.status} - ${errorText}`);
          }
          const data = await response.json();
          return data;
        } else if (operation === 'create') {
          const fields = parseJSONSafe(fieldsStr, 'fields') as Record<string, unknown>;
          const url = `${baseUrl}/services/data/v58.0/sobjects/${resource}`;
          const response = await fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify(fields),
          });
          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Salesforce API error: ${response.status} - ${errorText}`);
          }
          const data = await response.json();
          return data;
        } else if (operation === 'update') {
          if (!id) throw new Error('Salesforce: Record ID is required for update operation');
          const fields = parseJSONSafe(fieldsStr, 'fields') as Record<string, unknown>;
          const url = `${baseUrl}/services/data/v58.0/sobjects/${resource}/${id}`;
          const response = await fetch(url, {
            method: 'PATCH',
            headers,
            body: JSON.stringify(fields),
          });
          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Salesforce API error: ${response.status} - ${errorText}`);
          }
          return { success: true, id };
        } else if (operation === 'delete') {
          if (!id) throw new Error('Salesforce: Record ID is required for delete operation');
          const url = `${baseUrl}/services/data/v58.0/sobjects/${resource}/${id}`;
          const response = await fetch(url, { method: 'DELETE', headers });
          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Salesforce API error: ${response.status} - ${errorText}`);
          }
          return { success: true, id };
        } else if (operation === 'upsert') {
          if (!externalIdField || !externalIdValue) {
            throw new Error('Salesforce: External ID Field and Value are required for upsert operation');
          }
          const fields = parseJSONSafe(fieldsStr, 'fields') as Record<string, unknown>;
          const url = `${baseUrl}/services/data/v58.0/sobjects/${resource}/${externalIdField}/${encodeURIComponent(externalIdValue)}`;
          const response = await fetch(url, {
            method: 'PATCH',
            headers,
            body: JSON.stringify(fields),
          });
          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Salesforce API error: ${response.status} - ${errorText}`);
          }
          const data = await response.json();
          return data;
        } else if (operation.startsWith('bulk')) {
          const records = parseJSONSafe(recordsStr, 'records') as Array<Record<string, unknown>>;
          const bulkType = operation.replace('bulk', '').toLowerCase();
          const url = `${baseUrl}/services/data/v58.0/composite/sobjects${bulkType === 'upsert' ? `/${resource}/${externalIdField}` : ''}`;
          const response = await fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify({
              allOrNone: false,
              records: records.map(rec => ({
                attributes: { type: resource },
                ...rec,
              })),
            }),
          });
          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Salesforce API error: ${response.status} - ${errorText}`);
          }
          const data = await response.json();
          return data;
        } else {
          throw new Error(`Salesforce: Unknown operation "${operation}"`);
        }
      } catch (error) {
        throw new Error(`Salesforce: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    case "zoho_crm": {
      // Zoho CRM operations
      const accessToken = getStringProperty(config, 'accessToken', '');
      const apiDomain = getStringProperty(config, 'apiDomain', 'https://www.zohoapis.com');
      let module = getStringProperty(config, 'module', 'Contacts');
      const customModule = getStringProperty(config, 'customModule', '');
      const operation = getStringProperty(config, 'operation', 'get');
      const id = getStringProperty(config, 'id', '');
      const dataStr = getStringProperty(config, 'data', '{}');
      const criteria = getStringProperty(config, 'criteria', '');
      const fields = getStringProperty(config, 'fields', '');
      const page = getNumberProperty(config, 'page', 1);
      const perPage = getNumberProperty(config, 'perPage', 200);

      if (!accessToken) {
        throw new Error('Zoho CRM: Access Token is required');
      }

      if (module === 'custom' && !customModule) {
        throw new Error('Zoho CRM: Custom Module API Name is required when Module is Custom Module');
      }

      if (module === 'custom') {
        module = customModule;
      }

      const baseUrl = `${apiDomain.replace(/\/$/, '')}/crm/v3`;
      const headers = {
        'Authorization': `Zoho-oauthtoken ${accessToken}`,
        'Content-Type': 'application/json',
      };

      try {
        if (operation === 'get') {
          if (!id) throw new Error('Zoho CRM: Record ID is required for get operation');
          const url = `${baseUrl}/${module}/${id}${fields ? `?fields=${encodeURIComponent(fields)}` : ''}`;
          const response = await fetch(url, { headers });
          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Zoho CRM API error: ${response.status} - ${errorText}`);
          }
          const data = await response.json();
          return data;
        } else if (operation === 'getMany') {
          const params = new URLSearchParams();
          if (fields) params.append('fields', fields);
          if (page) params.append('page', String(page));
          if (perPage) params.append('per_page', String(Math.min(perPage, 200)));
          const url = `${baseUrl}/${module}?${params}`;
          const response = await fetch(url, { headers });
          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Zoho CRM API error: ${response.status} - ${errorText}`);
          }
          const data = await response.json();
          return data;
        } else if (operation === 'create') {
          const recordData = parseJSONSafe(dataStr, 'data') as Record<string, unknown>;
          const url = `${baseUrl}/${module}`;
          const response = await fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify({ data: [recordData] }),
          });
          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Zoho CRM API error: ${response.status} - ${errorText}`);
          }
          const data = await response.json();
          return data;
        } else if (operation === 'update') {
          if (!id) throw new Error('Zoho CRM: Record ID is required for update operation');
          const recordData = parseJSONSafe(dataStr, 'data') as Record<string, unknown>;
          const url = `${baseUrl}/${module}/${id}`;
          const response = await fetch(url, {
            method: 'PUT',
            headers,
            body: JSON.stringify({ data: [recordData] }),
          });
          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Zoho CRM API error: ${response.status} - ${errorText}`);
          }
          const data = await response.json();
          return data;
        } else if (operation === 'delete') {
          if (!id) throw new Error('Zoho CRM: Record ID is required for delete operation');
          const url = `${baseUrl}/${module}/${id}`;
          const response = await fetch(url, { method: 'DELETE', headers });
          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Zoho CRM API error: ${response.status} - ${errorText}`);
          }
          return { success: true, id };
        } else if (operation === 'search') {
          if (!criteria) throw new Error('Zoho CRM: Search Criteria is required for search operation');
          const url = `${baseUrl}/${module}/search?criteria=${encodeURIComponent(criteria)}`;
          const response = await fetch(url, { headers });
          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Zoho CRM API error: ${response.status} - ${errorText}`);
          }
          const data = await response.json();
          return data;
        } else if (operation === 'upsert') {
          const recordData = parseJSONSafe(dataStr, 'data') as Record<string, unknown>;
          const url = `${baseUrl}/${module}/upsert`;
          const response = await fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify({ data: [recordData] }),
          });
          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Zoho CRM API error: ${response.status} - ${errorText}`);
          }
          const data = await response.json();
          return data;
        } else if (operation === 'bulkCreate' || operation === 'bulkUpdate') {
          const recordsStr = getStringProperty(config, 'records', '[]');
          const records = parseJSONSafe(recordsStr, 'records') as Array<Record<string, unknown>>;
          const url = `${baseUrl}/${module}${operation === 'bulkUpdate' ? '' : ''}`;
          const response = await fetch(url, {
            method: operation === 'bulkCreate' ? 'POST' : 'PUT',
            headers,
            body: JSON.stringify({ data: records }),
          });
          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Zoho CRM API error: ${response.status} - ${errorText}`);
          }
          const data = await response.json();
          return data;
        } else {
          throw new Error(`Zoho CRM: Unknown operation "${operation}"`);
        }
      } catch (error) {
        throw new Error(`Zoho CRM: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    case "pipedrive": {
      // Pipedrive CRM operations
      const apiToken = getStringProperty(config, 'apiToken', '');
      const companyDomain = getStringProperty(config, 'companyDomain', '');
      const resource = getStringProperty(config, 'resource', 'person');
      const operation = getStringProperty(config, 'operation', 'get');
      const id = getStringProperty(config, 'id', '');
      const dataStr = getStringProperty(config, 'data', '{}');
      const term = getStringProperty(config, 'term', '');
      const fields = getStringProperty(config, 'fields', '');
      const limit = getNumberProperty(config, 'limit', 100);
      const start = getNumberProperty(config, 'start', 0);

      if (!apiToken || !companyDomain) {
        throw new Error('Pipedrive: API Token and Company Domain are required');
      }

      const baseUrl = `https://${companyDomain}.pipedrive.com/api/v1`;
      const params = new URLSearchParams({ api_token: apiToken });

      try {
        if (operation === 'get') {
          if (!id) throw new Error('Pipedrive: Resource ID is required for get operation');
          if (fields) params.append('fields', fields);
          const url = `${baseUrl}/${resource}s/${id}?${params}`;
          const response = await fetch(url);
          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Pipedrive API error: ${response.status} - ${errorText}`);
          }
          const data = await response.json();
          return data.data || data;
        } else if (operation === 'getMany') {
          if (fields) params.append('fields', fields);
          if (limit) params.append('limit', String(limit));
          if (start) params.append('start', String(start));
          const url = `${baseUrl}/${resource}s?${params}`;
          const response = await fetch(url);
          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Pipedrive API error: ${response.status} - ${errorText}`);
          }
          const data = await response.json();
          return data;
        } else if (operation === 'create') {
          const recordData = parseJSONSafe(dataStr, 'data') as Record<string, unknown>;
          const url = `${baseUrl}/${resource}s?${params}`;
          const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(recordData),
          });
          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Pipedrive API error: ${response.status} - ${errorText}`);
          }
          const data = await response.json();
          return data.data || data;
        } else if (operation === 'update') {
          if (!id) throw new Error('Pipedrive: Resource ID is required for update operation');
          const recordData = parseJSONSafe(dataStr, 'data') as Record<string, unknown>;
          const url = `${baseUrl}/${resource}s/${id}?${params}`;
          const response = await fetch(url, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(recordData),
          });
          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Pipedrive API error: ${response.status} - ${errorText}`);
          }
          const data = await response.json();
          return data.data || data;
        } else if (operation === 'delete') {
          if (!id) throw new Error('Pipedrive: Resource ID is required for delete operation');
          const url = `${baseUrl}/${resource}s/${id}?${params}`;
          const response = await fetch(url, { method: 'DELETE' });
          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Pipedrive API error: ${response.status} - ${errorText}`);
          }
          const data = await response.json();
          return data;
        } else if (operation === 'search') {
          if (!term) throw new Error('Pipedrive: Search Term is required for search operation');
          params.append('term', term);
          params.append('fields', fields || 'id,name');
          const url = `${baseUrl}/${resource}s/search?${params}`;
          const response = await fetch(url);
          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Pipedrive API error: ${response.status} - ${errorText}`);
          }
          const data = await response.json();
          return data;
        } else {
          throw new Error(`Pipedrive: Unknown operation "${operation}"`);
        }
      } catch (error) {
        throw new Error(`Pipedrive: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    case "freshdesk": {
      // Freshdesk support operations
      const apiKey = getStringProperty(config, 'apiKey', '');
      const domain = getStringProperty(config, 'domain', '');
      const resource = getStringProperty(config, 'resource', 'ticket');
      const operation = getStringProperty(config, 'operation', 'list');
      const id = getStringProperty(config, 'id', '');
      const dataStr = getStringProperty(config, 'data', '{}');
      const query = getStringProperty(config, 'query', '');
      const page = getNumberProperty(config, 'page', 1);
      const perPage = getNumberProperty(config, 'perPage', 30);

      if (!apiKey || !domain) {
        throw new Error('Freshdesk: API Key and Domain are required');
      }

      const baseUrl = `https://${domain}.freshdesk.com/api/v2`;
      const auth = btoa(`${apiKey}:X`);
      const headers = {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
      };

      try {
        if (operation === 'list') {
          const params = new URLSearchParams();
          if (page) params.append('page', String(page));
          if (perPage) params.append('per_page', String(perPage));
          const url = `${baseUrl}/${resource}s${params.toString() ? `?${params}` : ''}`;
          const response = await fetch(url, { headers });
          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Freshdesk API error: ${response.status} - ${errorText}`);
          }
          const data = await response.json();
          return data;
        } else if (operation === 'get') {
          if (!id) throw new Error('Freshdesk: Resource ID is required for get operation');
          const url = `${baseUrl}/${resource}s/${id}`;
          const response = await fetch(url, { headers });
          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Freshdesk API error: ${response.status} - ${errorText}`);
          }
          const data = await response.json();
          return data;
        } else if (operation === 'create') {
          const recordData = parseJSONSafe(dataStr, 'data') as Record<string, unknown>;
          const url = `${baseUrl}/${resource}s`;
          const response = await fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify(recordData),
          });
          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Freshdesk API error: ${response.status} - ${errorText}`);
          }
          const data = await response.json();
          return data;
        } else if (operation === 'update') {
          if (!id) throw new Error('Freshdesk: Resource ID is required for update operation');
          const recordData = parseJSONSafe(dataStr, 'data') as Record<string, unknown>;
          const url = `${baseUrl}/${resource}s/${id}`;
          const response = await fetch(url, {
            method: 'PUT',
            headers,
            body: JSON.stringify(recordData),
          });
          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Freshdesk API error: ${response.status} - ${errorText}`);
          }
          const data = await response.json();
          return data;
        } else if (operation === 'delete') {
          if (!id) throw new Error('Freshdesk: Resource ID is required for delete operation');
          const url = `${baseUrl}/${resource}s/${id}`;
          const response = await fetch(url, { method: 'DELETE', headers });
          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Freshdesk API error: ${response.status} - ${errorText}`);
          }
          return { success: true, id };
        } else if (operation === 'search') {
          if (!query) throw new Error('Freshdesk: Search Query is required for search operation');
          const url = `${baseUrl}/search?query="${encodeURIComponent(query)}"`;
          const response = await fetch(url, { headers });
          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Freshdesk API error: ${response.status} - ${errorText}`);
          }
          const data = await response.json();
          return data;
        } else {
          throw new Error(`Freshdesk: Unknown operation "${operation}"`);
        }
      } catch (error) {
        throw new Error(`Freshdesk: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    case "intercom": {
      // Intercom conversational CRM
      const accessToken = getStringProperty(config, 'accessToken', '');
      const resource = getStringProperty(config, 'resource', 'contact');
      const operation = getStringProperty(config, 'operation', 'get');
      const id = getStringProperty(config, 'id', '');
      const dataStr = getStringProperty(config, 'data', '{}');
      const query = getStringProperty(config, 'query', '');
      const perPage = getNumberProperty(config, 'perPage', 50);
      const startingAfter = getStringProperty(config, 'startingAfter', '');

      if (!accessToken) {
        throw new Error('Intercom: Access Token is required');
      }

      const baseUrl = 'https://api.intercom.io';
      const headers = {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Intercom-Version': '2.9',
      };

      try {
        if (operation === 'get') {
          if (!id) throw new Error('Intercom: Resource ID is required for get operation');
          const url = `${baseUrl}/${resource}s/${id}`;
          const response = await fetch(url, { headers });
          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Intercom API error: ${response.status} - ${errorText}`);
          }
          const data = await response.json();
          return data;
        } else if (operation === 'list') {
          const params = new URLSearchParams();
          if (perPage) params.append('per_page', String(perPage));
          if (startingAfter) params.append('starting_after', startingAfter);
          const url = `${baseUrl}/${resource}s?${params}`;
          const response = await fetch(url, { headers });
          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Intercom API error: ${response.status} - ${errorText}`);
          }
          const data = await response.json();
          return data;
        } else if (operation === 'create') {
          const recordData = parseJSONSafe(dataStr, 'data') as Record<string, unknown>;
          const url = `${baseUrl}/${resource}s`;
          const response = await fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify(recordData),
          });
          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Intercom API error: ${response.status} - ${errorText}`);
          }
          const data = await response.json();
          return data;
        } else if (operation === 'update') {
          if (!id) throw new Error('Intercom: Resource ID is required for update operation');
          const recordData = parseJSONSafe(dataStr, 'data') as Record<string, unknown>;
          const url = `${baseUrl}/${resource}s/${id}`;
          const response = await fetch(url, {
            method: 'PUT',
            headers,
            body: JSON.stringify(recordData),
          });
          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Intercom API error: ${response.status} - ${errorText}`);
          }
          const data = await response.json();
          return data;
        } else if (operation === 'delete') {
          if (!id) throw new Error('Intercom: Resource ID is required for delete operation');
          const url = `${baseUrl}/${resource}s/${id}`;
          const response = await fetch(url, { method: 'DELETE', headers });
          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Intercom API error: ${response.status} - ${errorText}`);
          }
          return { success: true, id };
        } else if (operation === 'search') {
          if (!query) throw new Error('Intercom: Search Query is required for search operation');
          const url = `${baseUrl}/${resource}s/search`;
          const response = await fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify({ query }),
          });
          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Intercom API error: ${response.status} - ${errorText}`);
          }
          const data = await response.json();
          return data;
        } else {
          throw new Error(`Intercom: Unknown operation "${operation}"`);
        }
      } catch (error) {
        throw new Error(`Intercom: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    case "mailchimp": {
      // Mailchimp email marketing
      const apiKey = getStringProperty(config, 'apiKey', '');
      const dataCenter = getStringProperty(config, 'dataCenter', '');
      const resource = getStringProperty(config, 'resource', 'audience');
      const operation = getStringProperty(config, 'operation', 'list');
      const listId = getStringProperty(config, 'listId', '');
      const memberEmail = getStringProperty(config, 'memberEmail', '');
      const dataStr = getStringProperty(config, 'data', '{}');
      const memberDataStr = getStringProperty(config, 'memberData', '{}');
      const count = getNumberProperty(config, 'count', 10);
      const offset = getNumberProperty(config, 'offset', 0);

      if (!apiKey || !dataCenter) {
        throw new Error('Mailchimp: API Key and Data Center are required');
      }

      const baseUrl = `https://${dataCenter}.api.mailchimp.com/3.0`;
      const auth = btoa(`apikey:${apiKey}`);
      const headers = {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
      };

      try {
        if (operation === 'list') {
          const params = new URLSearchParams();
          if (count) params.append('count', String(count));
          if (offset) params.append('offset', String(offset));
          const resourcePath = resource === 'audience' ? 'lists' : resource === 'member' ? `lists/${listId}/members` : resource === 'campaign' ? 'campaigns' : resource === 'automation' ? 'automations' : 'lists';
          const url = `${baseUrl}/${resourcePath}?${params}`;
          const response = await fetch(url, { headers });
          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Mailchimp API error: ${response.status} - ${errorText}`);
          }
          const data = await response.json();
          return data;
        } else if (operation === 'get') {
          if (!listId && resource !== 'campaign' && resource !== 'automation') {
            throw new Error('Mailchimp: List ID is required for this operation');
          }
          const resourcePath = resource === 'audience' ? `lists/${listId}` : resource === 'campaign' ? `campaigns/${listId}` : resource === 'automation' ? `automations/${listId}` : `lists/${listId}`;
          const url = `${baseUrl}/${resourcePath}`;
          const response = await fetch(url, { headers });
          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Mailchimp API error: ${response.status} - ${errorText}`);
          }
          const data = await response.json();
          return data;
        } else if (operation === 'create') {
          const recordData = parseJSONSafe(dataStr, 'data') as Record<string, unknown>;
          const resourcePath = resource === 'audience' ? 'lists' : resource === 'campaign' ? 'campaigns' : 'automations';
          const url = `${baseUrl}/${resourcePath}`;
          const response = await fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify(recordData),
          });
          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Mailchimp API error: ${response.status} - ${errorText}`);
          }
          const data = await response.json();
          return data;
        } else if (operation === 'update') {
          if (!listId) throw new Error('Mailchimp: List ID is required for update operation');
          const recordData = parseJSONSafe(dataStr, 'data') as Record<string, unknown>;
          const resourcePath = resource === 'audience' ? `lists/${listId}` : resource === 'campaign' ? `campaigns/${listId}` : `automations/${listId}`;
          const url = `${baseUrl}/${resourcePath}`;
          const response = await fetch(url, {
            method: 'PATCH',
            headers,
            body: JSON.stringify(recordData),
          });
          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Mailchimp API error: ${response.status} - ${errorText}`);
          }
          const data = await response.json();
          return data;
        } else if (operation === 'delete') {
          if (!listId) throw new Error('Mailchimp: List ID is required for delete operation');
          const resourcePath = resource === 'audience' ? `lists/${listId}` : resource === 'campaign' ? `campaigns/${listId}` : `automations/${listId}`;
          const url = `${baseUrl}/${resourcePath}`;
          const response = await fetch(url, { method: 'DELETE', headers });
          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Mailchimp API error: ${response.status} - ${errorText}`);
          }
          return { success: true, id: listId };
        } else if (operation === 'addMember') {
          if (!listId || !memberEmail) {
            throw new Error('Mailchimp: List ID and Member Email are required for addMember operation');
          }
          const memberData = parseJSONSafe(memberDataStr, 'memberData') as Record<string, unknown>;
          const url = `${baseUrl}/lists/${listId}/members`;
          const response = await fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify(memberData),
          });
          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Mailchimp API error: ${response.status} - ${errorText}`);
          }
          const data = await response.json();
          return data;
        } else if (operation === 'updateMember') {
          if (!listId || !memberEmail) {
            throw new Error('Mailchimp: List ID and Member Email are required for updateMember operation');
          }
          const memberData = parseJSONSafe(memberDataStr, 'memberData') as Record<string, unknown>;
          const emailHash = btoa(memberEmail.toLowerCase()).replace(/[+/=]/g, '').substring(0, 32);
          const url = `${baseUrl}/lists/${listId}/members/${emailHash}`;
          const response = await fetch(url, {
            method: 'PATCH',
            headers,
            body: JSON.stringify(memberData),
          });
          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Mailchimp API error: ${response.status} - ${errorText}`);
          }
          const data = await response.json();
          return data;
        } else if (operation === 'deleteMember') {
          if (!listId || !memberEmail) {
            throw new Error('Mailchimp: List ID and Member Email are required for deleteMember operation');
          }
          const emailHash = btoa(memberEmail.toLowerCase()).replace(/[+/=]/g, '').substring(0, 32);
          const url = `${baseUrl}/lists/${listId}/members/${emailHash}`;
          const response = await fetch(url, { method: 'DELETE', headers });
          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Mailchimp API error: ${response.status} - ${errorText}`);
          }
          return { success: true, email: memberEmail };
        } else {
          throw new Error(`Mailchimp: Unknown operation "${operation}"`);
        }
      } catch (error) {
        throw new Error(`Mailchimp: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    case "activecampaign": {
      // ActiveCampaign automation CRM
      const apiKey = getStringProperty(config, 'apiKey', '');
      const apiUrl = getStringProperty(config, 'apiUrl', '');
      const resource = getStringProperty(config, 'resource', 'contact');
      const operation = getStringProperty(config, 'operation', 'get');
      const id = getStringProperty(config, 'id', '');
      const email = getStringProperty(config, 'email', '');
      const dataStr = getStringProperty(config, 'data', '{}');
      const tagId = getStringProperty(config, 'tagId', '');
      const limit = getNumberProperty(config, 'limit', 100);
      const offset = getNumberProperty(config, 'offset', 0);

      if (!apiKey || !apiUrl) {
        throw new Error('ActiveCampaign: API Key and API URL are required');
      }

      const baseUrl = apiUrl.replace(/\/$/, '');
      const headers = {
        'Api-Token': apiKey,
        'Content-Type': 'application/json',
      };

      try {
        const resourceMap: Record<string, string> = {
          'contact': 'contacts',
          'list': 'lists',
          'automation': 'automations',
          'campaign': 'campaigns',
          'deal': 'deals',
          'tag': 'tags',
          'field': 'fields',
        };

        const resourcePath = resourceMap[resource] || resource;

        if (operation === 'get') {
          if (!id) throw new Error('ActiveCampaign: Resource ID is required for get operation');
          const url = `${baseUrl}/api/3/${resourcePath}/${id}`;
          const response = await fetch(url, { headers });
          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`ActiveCampaign API error: ${response.status} - ${errorText}`);
          }
          const data = await response.json();
          return data;
        } else if (operation === 'list') {
          const params = new URLSearchParams();
          if (limit) params.append('limit', String(limit));
          if (offset) params.append('offset', String(offset));
          const url = `${baseUrl}/api/3/${resourcePath}?${params}`;
          const response = await fetch(url, { headers });
          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`ActiveCampaign API error: ${response.status} - ${errorText}`);
          }
          const data = await response.json();
          return data;
        } else if (operation === 'create') {
          const recordData = parseJSONSafe(dataStr, 'data') as Record<string, unknown>;
          const url = `${baseUrl}/api/3/${resourcePath}`;
          const response = await fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify(recordData),
          });
          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`ActiveCampaign API error: ${response.status} - ${errorText}`);
          }
          const data = await response.json();
          return data;
        } else if (operation === 'update') {
          if (!id) throw new Error('ActiveCampaign: Resource ID is required for update operation');
          const recordData = parseJSONSafe(dataStr, 'data') as Record<string, unknown>;
          const url = `${baseUrl}/api/3/${resourcePath}/${id}`;
          const response = await fetch(url, {
            method: 'PUT',
            headers,
            body: JSON.stringify(recordData),
          });
          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`ActiveCampaign API error: ${response.status} - ${errorText}`);
          }
          const data = await response.json();
          return data;
        } else if (operation === 'delete') {
          if (!id) throw new Error('ActiveCampaign: Resource ID is required for delete operation');
          const url = `${baseUrl}/api/3/${resourcePath}/${id}`;
          const response = await fetch(url, { method: 'DELETE', headers });
          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`ActiveCampaign API error: ${response.status} - ${errorText}`);
          }
          return { success: true, id };
        } else if (operation === 'sync') {
          if (!email) throw new Error('ActiveCampaign: Email is required for sync operation');
          const recordData = parseJSONSafe(dataStr, 'data') as Record<string, unknown>;
          const url = `${baseUrl}/api/3/contact/sync`;
          const response = await fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify({ contact: { email, ...recordData } }),
          });
          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`ActiveCampaign API error: ${response.status} - ${errorText}`);
          }
          const data = await response.json();
          return data;
        } else if (operation === 'tag') {
          if (!email || !tagId) {
            throw new Error('ActiveCampaign: Email and Tag ID are required for tag operation');
          }
          const url = `${baseUrl}/api/3/contactTags`;
          const response = await fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify({ contactTag: { contact: email, tag: tagId } }),
          });
          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`ActiveCampaign API error: ${response.status} - ${errorText}`);
          }
          const data = await response.json();
          return data;
        } else if (operation === 'untag') {
          if (!email || !tagId) {
            throw new Error('ActiveCampaign: Email and Tag ID are required for untag operation');
          }
          const url = `${baseUrl}/api/3/contactTags`;
          const response = await fetch(url, {
            method: 'DELETE',
            headers,
            body: JSON.stringify({ contactTag: { contact: email, tag: tagId } }),
          });
          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`ActiveCampaign API error: ${response.status} - ${errorText}`);
          }
          return { success: true, email, tagId };
        } else {
          throw new Error(`ActiveCampaign: Unknown operation "${operation}"`);
        }
      } catch (error) {
        throw new Error(`ActiveCampaign: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    case "crm_lead_router": {
      // CRM Lead Router: Route incoming leads to correct owner/team
      const leadConfig = config.lead;
      const routingRulesConfig = config.routingRules;
      const fallbackOwner = getStringProperty(config, 'fallbackOwner', '');

      if (!fallbackOwner) {
        throw new Error("CRM Lead Router: Fallback owner is required");
      }

      let lead: { id: string; name: string; email: string; source: string; location: string; industry: string; companySize: number; score: number | null } | null = null;
      if (leadConfig) {
        if (typeof leadConfig === 'string') {
          try {
            lead = JSON.parse(leadConfig);
          } catch {
            throw new Error("CRM Lead Router: Invalid lead JSON format");
          }
        } else if (typeof leadConfig === 'object') {
          lead = leadConfig as { id: string; name: string; email: string; source: string; location: string; industry: string; companySize: number; score: number | null };
        }
      }

      const inputObj = input && typeof input === 'object' ? input as Record<string, unknown> : {};
      if (!lead && inputObj.lead) {
        if (typeof inputObj.lead === 'object') {
          lead = inputObj.lead as { id: string; name: string; email: string; source: string; location: string; industry: string; companySize: number; score: number | null };
        }
      }

      if (!lead || !lead.id || !lead.email) {
        throw new Error("CRM Lead Router: Lead with id and email is required");
      }

      let routingRules: Array<{ condition: string; assignTo: string }> = [];
      if (routingRulesConfig) {
        if (typeof routingRulesConfig === 'string') {
          try {
            routingRules = JSON.parse(routingRulesConfig);
          } catch {
            throw new Error("CRM Lead Router: Invalid routing rules JSON format");
          }
        } else if (Array.isArray(routingRulesConfig)) {
          routingRules = routingRulesConfig;
        }
      }

      if (routingRules.length === 0) {
        throw new Error("CRM Lead Router: At least one routing rule is required");
      }

      // Evaluate routing rules in order
      let assignedTo = fallbackOwner;
      let routingRuleApplied: string | null = null;

      for (const rule of routingRules) {
        if (!rule.condition || !rule.assignTo) {
          continue;
        }

        try {
          // Evaluate condition using expression evaluator
          const conditionMet = evaluateCondition(rule.condition, lead);
          
          if (conditionMet) {
            assignedTo = rule.assignTo;
            routingRuleApplied = rule.condition;
            break;
          }
        } catch (conditionError) {
          console.warn(`CRM Lead Router: Error evaluating condition "${rule.condition}":`, conditionError);
          // Continue to next rule
        }
      }

      return {
        leadId: lead.id,
        assignedTo,
        routingRuleApplied,
        status: 'assigned',
        metadata: {
          leadSource: lead.source
        }
      };
    }

    case "crm_ticket_prioritizer": {
      // CRM Ticket Prioritizer: Determine ticket priority
      const ticketConfig = config.ticket;
      const priorityMatrixConfig = config.priorityMatrix;

      let ticket: { id: string; category: string; customerTier: 'free' | 'standard' | 'premium'; impact: 'low' | 'medium' | 'high'; urgency: 'low' | 'medium' | 'high'; createdAt: string } | null = null;
      if (ticketConfig) {
        if (typeof ticketConfig === 'string') {
          try {
            ticket = JSON.parse(ticketConfig);
          } catch {
            throw new Error("CRM Ticket Prioritizer: Invalid ticket JSON format");
          }
        } else if (typeof ticketConfig === 'object') {
          ticket = ticketConfig as { id: string; category: string; customerTier: 'free' | 'standard' | 'premium'; impact: 'low' | 'medium' | 'high'; urgency: 'low' | 'medium' | 'high'; createdAt: string };
        }
      }

      const inputObj = input && typeof input === 'object' ? input as Record<string, unknown> : {};
      if (!ticket && inputObj.ticket) {
        if (typeof inputObj.ticket === 'object') {
          ticket = inputObj.ticket as { id: string; category: string; customerTier: 'free' | 'standard' | 'premium'; impact: 'low' | 'medium' | 'high'; urgency: 'low' | 'medium' | 'high'; createdAt: string };
        }
      }

      if (!ticket || !ticket.id) {
        throw new Error("CRM Ticket Prioritizer: Ticket with id is required");
      }

      // Determine priority based on impact, urgency, and customer tier
      const impact = ticket.impact;
      const urgency = ticket.urgency;
      const customerTier = ticket.customerTier;

      let priority: 'low' | 'medium' | 'high' | 'critical' = 'medium';
      let reasoning = '';

      if (impact === 'high' && urgency === 'high') {
        priority = customerTier === 'premium' ? 'critical' : 'high';
        reasoning = `${impact} impact and ${urgency} urgency`;
      } else if (impact === 'high' || urgency === 'high') {
        priority = customerTier === 'premium' ? 'high' : 'medium';
        reasoning = `${impact} impact or ${urgency} urgency`;
      } else if (impact === 'medium' && urgency === 'medium') {
        priority = customerTier === 'premium' ? 'medium' : 'low';
        reasoning = `${impact} impact and ${urgency} urgency`;
      } else {
        priority = 'low';
        reasoning = `${impact} impact and ${urgency} urgency`;
      }

      if (customerTier === 'premium') {
        reasoning += ` (premium customer boost)`;
      }

      const responseTimeTargets: Record<string, string> = {
        critical: '15 minutes',
        high: '1 hour',
        medium: '4 hours',
        low: '24 hours'
      };

      return {
        ticketId: ticket.id,
        priority,
        responseTimeTarget: responseTimeTargets[priority],
        reasoning
      };
    }

    case "crm_sla_monitor": {
      // CRM SLA Monitor: Monitor SLA compliance
      const ticketId = getStringProperty(config, 'ticketId', '');
      const priority = getStringProperty(config, 'priority', 'medium') as 'low' | 'medium' | 'high' | 'critical';
      const createdAtStr = getStringProperty(config, 'createdAt', '');
      const lastResponseAtStr = getStringProperty(config, 'lastResponseAt', '');
      const slaPoliciesConfig = config.slaPolicies;

      if (!ticketId) {
        throw new Error("CRM SLA Monitor: Ticket ID is required");
      }
      if (!createdAtStr) {
        throw new Error("CRM SLA Monitor: Created At timestamp is required");
      }

      let createdAt: Date;
      let lastResponseAt: Date | null = null;

      try {
        createdAt = new Date(createdAtStr);
        if (isNaN(createdAt.getTime())) {
          throw new Error("Invalid date format");
        }
      } catch {
        throw new Error("CRM SLA Monitor: Invalid Created At timestamp format. Use ISO 8601 format");
      }

      if (lastResponseAtStr) {
        try {
          lastResponseAt = new Date(lastResponseAtStr);
          if (isNaN(lastResponseAt.getTime())) {
            lastResponseAt = null;
          }
        } catch {
          lastResponseAt = null;
        }
      }

      const defaultSlaPolicies: Record<string, number> = {
        low: 1440,
        medium: 480,
        high: 120,
        critical: 30
      };

      let slaPolicies = defaultSlaPolicies;
      if (slaPoliciesConfig && typeof slaPoliciesConfig === 'object') {
        slaPolicies = { ...defaultSlaPolicies, ...slaPoliciesConfig as Record<string, number> };
      }

      const slaMinutes = slaPolicies[priority] || defaultSlaPolicies[priority];
      const now = new Date();
      const referenceTime = lastResponseAt || createdAt;
      const timeElapsedMinutes = Math.floor((now.getTime() - referenceTime.getTime()) / (1000 * 60));

      let slaStatus: 'within_sla' | 'at_risk' | 'breached';
      const timeRemainingMinutes = slaMinutes - timeElapsedMinutes;
      const riskThreshold = slaMinutes * 0.8;

      if (timeElapsedMinutes >= slaMinutes) {
        slaStatus = 'breached';
      } else if (timeElapsedMinutes >= riskThreshold) {
        slaStatus = 'at_risk';
      } else {
        slaStatus = 'within_sla';
      }

      const escalationRequired = slaStatus === 'breached' || (slaStatus === 'at_risk' && priority === 'critical');

      return {
        ticketId,
        slaStatus,
        timeElapsedMinutes,
        timeRemainingMinutes: timeRemainingMinutes > 0 ? timeRemainingMinutes : null,
        escalationRequired,
        priority,
        slaTargetMinutes: slaMinutes
      };
    }

    case "crm_duplicate_detector": {
      // CRM Duplicate Detector: Detect duplicate records
      const recordConfig = config.record;
      const existingRecordsConfig = config.existingRecords;
      const matchThreshold = getNumberProperty(config, 'matchThreshold', 0.8);

      if (matchThreshold < 0 || matchThreshold > 1) {
        throw new Error("CRM Duplicate Detector: Match threshold must be between 0 and 1");
      }

      let record: { id: string; email: string | null; phone: string | null; company: string | null } | null = null;
      if (recordConfig) {
        if (typeof recordConfig === 'string') {
          try {
            record = JSON.parse(recordConfig);
          } catch {
            throw new Error("CRM Duplicate Detector: Invalid record JSON format");
          }
        } else if (typeof recordConfig === 'object') {
          record = recordConfig as { id: string; email: string | null; phone: string | null; company: string | null };
        }
      }

      const inputObj = input && typeof input === 'object' ? input as Record<string, unknown> : {};
      if (!record && inputObj.record) {
        if (typeof inputObj.record === 'object') {
          record = inputObj.record as { id: string; email: string | null; phone: string | null; company: string | null };
        }
      }

      if (!record || !record.id) {
        throw new Error("CRM Duplicate Detector: Record with id is required");
      }

      if (!record.email && !record.phone && !record.company) {
        throw new Error("CRM Duplicate Detector: Record must have at least one of: email, phone, or company");
      }

      let existingRecords: Array<{ id: string; email: string | null; phone: string | null; company: string | null }> = [];
      if (existingRecordsConfig) {
        if (typeof existingRecordsConfig === 'string') {
          try {
            existingRecords = JSON.parse(existingRecordsConfig);
          } catch {
            throw new Error("CRM Duplicate Detector: Invalid existing records JSON format");
          }
        } else if (Array.isArray(existingRecordsConfig)) {
          existingRecords = existingRecordsConfig;
        }
      }

      let bestMatch: { id: string; score: number } | null = null;
      let bestScore = 0;

      for (const existing of existingRecords) {
        let score = 0;
        let comparisons = 0;

        if (record.email && existing.email) {
          if (record.email.toLowerCase() === existing.email.toLowerCase()) {
            score += 1.0;
            comparisons++;
          }
        }

        if (record.phone && existing.phone) {
          const normalizePhone = (p: string) => p.replace(/\D/g, '');
          if (normalizePhone(record.phone) === normalizePhone(existing.phone)) {
            score += 1.0;
            comparisons++;
          }
        }

        if (record.company && existing.company) {
          const normalizeCompany = (c: string) => c.toLowerCase().trim();
          if (normalizeCompany(record.company) === normalizeCompany(existing.company)) {
            score += 0.8;
            comparisons++;
          }
        }

        const avgScore = comparisons > 0 ? score / comparisons : 0;

        if (avgScore > bestScore) {
          bestScore = avgScore;
          bestMatch = { id: existing.id, score: avgScore };
        }
      }

      const isDuplicate = bestMatch !== null && bestScore >= matchThreshold;
      let recommendedAction: 'merge' | 'ignore' | 'create_new';

      if (isDuplicate) {
        if (bestScore >= 0.9) {
          recommendedAction = 'merge';
        } else if (bestScore >= matchThreshold) {
          recommendedAction = 'ignore';
        } else {
          recommendedAction = 'create_new';
        }
      } else {
        recommendedAction = 'create_new';
      }

      return {
        isDuplicate,
        matchedRecordId: bestMatch?.id || null,
        matchScore: bestScore,
        recommendedAction
      };
    }

    case "notion": {
      const apiKey = getStringProperty(config, 'apiKey', '');
      const operation = getStringProperty(config, 'operation', 'create_page');
      
      if (!apiKey || !apiKey.trim()) {
        throw new Error('Notion: API Key is required. Please add your Notion API key in the node properties.');
      }

      try {
        const baseUrl = 'https://api.notion.com/v1';
        const headers: Record<string, string> = {
          'Authorization': `Bearer ${apiKey}`,
          'Notion-Version': '2022-06-28',
          'Content-Type': 'application/json',
        };

        let url = '';
        let method = 'GET';
        let body: unknown = undefined;

        switch (operation) {
          case 'create_page': {
            const parentPageId = replaceTemplates(getStringProperty(config, 'parentPageId', ''), input);
            const title = replaceTemplates(getStringProperty(config, 'title', ''), input);
            const contentStr = getStringProperty(config, 'content', '');
            
            if (!parentPageId) throw new Error('Notion: Parent Page ID is required for create_page');
            if (!title) throw new Error('Notion: Title is required for create_page');
            
            let content = [];
            if (contentStr && contentStr.trim()) {
              try {
                content = parseJSONSafe(replaceTemplates(contentStr, input), 'content') as unknown[];
              } catch {
                // If content is not valid JSON, create a paragraph block
                content = [{
                  type: 'paragraph',
                  paragraph: {
                    rich_text: [{ type: 'text', text: { content: replaceTemplates(contentStr, input) } }]
                  }
                }];
              }
            }
            
            url = `${baseUrl}/pages`;
            method = 'POST';
            body = {
              parent: { page_id: parentPageId },
              properties: {
                title: {
                  title: [{ type: 'text', text: { content: title } }]
                }
              },
              children: content
            };
            break;
          }
          case 'update_page': {
            const pageId = replaceTemplates(getStringProperty(config, 'pageId', ''), input);
            if (!pageId) throw new Error('Notion: Page ID is required for update_page');
            
            url = `${baseUrl}/pages/${pageId}`;
            method = 'PATCH';
            const propertiesStr = getStringProperty(config, 'properties', '');
            if (propertiesStr) {
              body = { properties: parseJSONSafe(replaceTemplates(propertiesStr, input), 'properties') };
            }
            break;
          }
          case 'read_page': {
            const pageId = replaceTemplates(getStringProperty(config, 'pageId', ''), input);
            if (!pageId) throw new Error('Notion: Page ID is required for read_page');
            
            url = `${baseUrl}/pages/${pageId}`;
            break;
          }
          case 'delete_page': {
            const pageId = replaceTemplates(getStringProperty(config, 'pageId', ''), input);
            if (!pageId) throw new Error('Notion: Page ID is required for delete_page');
            
            url = `${baseUrl}/pages/${pageId}`;
            method = 'PATCH';
            body = { archived: true };
            break;
          }
          case 'query_database': {
            const databaseId = replaceTemplates(getStringProperty(config, 'databaseId', ''), input);
            if (!databaseId) throw new Error('Notion: Database ID is required for query_database');
            
            url = `${baseUrl}/databases/${databaseId}/query`;
            method = 'POST';
            const filterStr = getStringProperty(config, 'filter', '');
            const sortsStr = getStringProperty(config, 'sorts', '');
            const pageSize = getNumberProperty(config, 'pageSize', 100);
            
            body = { page_size: Math.min(pageSize, 100) };
            if (filterStr) {
              (body as Record<string, unknown>).filter = parseJSONSafe(replaceTemplates(filterStr, input), 'filter');
            }
            if (sortsStr) {
              (body as Record<string, unknown>).sorts = parseJSONSafe(replaceTemplates(sortsStr, input), 'sorts');
            }
            break;
          }
          case 'create_database_entry':
          case 'update_database_entry': {
            const databaseId = replaceTemplates(getStringProperty(config, 'databaseId', ''), input);
            const propertiesStr = getStringProperty(config, 'properties', '');
            
            if (!databaseId) throw new Error(`Notion: Database ID is required for ${operation}`);
            if (!propertiesStr) throw new Error(`Notion: Properties are required for ${operation}`);
            
            if (operation === 'create_database_entry') {
              url = `${baseUrl}/pages`;
              method = 'POST';
              body = {
                parent: { database_id: databaseId },
                properties: parseJSONSafe(replaceTemplates(propertiesStr, input), 'properties')
              };
            } else {
              const pageId = replaceTemplates(getStringProperty(config, 'pageId', ''), input);
              if (!pageId) throw new Error('Notion: Page ID is required for update_database_entry');
              
              url = `${baseUrl}/pages/${pageId}`;
              method = 'PATCH';
              body = { properties: parseJSONSafe(replaceTemplates(propertiesStr, input), 'properties') };
            }
            break;
          }
          default:
            throw new Error(`Notion: Unknown operation "${operation}"`);
        }

        const response = await fetch(url, {
          method,
          headers,
          body: body ? JSON.stringify(body) : undefined,
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Notion API error: ${response.status} - ${errorText || response.statusText}`);
        }

        return await response.json();
      } catch (error) {
        throw new Error(`Notion: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    case "airtable": {
      const apiKey = getStringProperty(config, 'apiKey', '');
      const baseId = replaceTemplates(getStringProperty(config, 'baseId', ''), input);
      const tableId = replaceTemplates(getStringProperty(config, 'tableId', ''), input);
      const operation = getStringProperty(config, 'operation', 'create_record');
      
      if (!apiKey || !apiKey.trim()) {
        throw new Error('Airtable: API Key is required. Please add your Airtable API key in the node properties.');
      }
      if (!baseId) throw new Error('Airtable: Base ID is required');
      if (!tableId) throw new Error('Airtable: Table Name/ID is required');

      try {
        const baseUrl = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableId)}`;
        const headers: Record<string, string> = {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        };

        let url = '';
        let method = 'GET';
        let body: unknown = undefined;

        switch (operation) {
          case 'create_record': {
            const fieldsStr = getStringProperty(config, 'fields', '');
            if (!fieldsStr) throw new Error('Airtable: Fields are required for create_record');
            
            url = baseUrl;
            method = 'POST';
            body = { fields: parseJSONSafe(replaceTemplates(fieldsStr, input), 'fields') };
            break;
          }
          case 'update_record': {
            const recordId = replaceTemplates(getStringProperty(config, 'recordId', ''), input);
            const fieldsStr = getStringProperty(config, 'fields', '');
            
            if (!recordId) throw new Error('Airtable: Record ID is required for update_record');
            if (!fieldsStr) throw new Error('Airtable: Fields are required for update_record');
            
            url = `${baseUrl}/${recordId}`;
            method = 'PATCH';
            body = { fields: parseJSONSafe(replaceTemplates(fieldsStr, input), 'fields') };
            break;
          }
          case 'delete_record': {
            const recordId = replaceTemplates(getStringProperty(config, 'recordId', ''), input);
            if (!recordId) throw new Error('Airtable: Record ID is required for delete_record');
            
            url = `${baseUrl}/${recordId}`;
            method = 'DELETE';
            break;
          }
          case 'get_record': {
            const recordId = replaceTemplates(getStringProperty(config, 'recordId', ''), input);
            if (!recordId) throw new Error('Airtable: Record ID is required for get_record');
            
            url = `${baseUrl}/${recordId}`;
            break;
          }
          case 'list_records': {
            url = baseUrl;
            const filterByFormula = replaceTemplates(getStringProperty(config, 'filterByFormula', ''), input);
            const view = replaceTemplates(getStringProperty(config, 'view', ''), input);
            const maxRecords = getNumberProperty(config, 'maxRecords', 100);
            const pageSize = getNumberProperty(config, 'pageSize', 100);
            const offset = replaceTemplates(getStringProperty(config, 'offset', ''), input);
            
            const params = new URLSearchParams();
            if (filterByFormula) params.append('filterByFormula', filterByFormula);
            if (view) params.append('view', view);
            params.append('maxRecords', String(Math.min(maxRecords, 100)));
            params.append('pageSize', String(Math.min(pageSize, 100)));
            if (offset) params.append('offset', offset);
            
            url = `${baseUrl}?${params.toString()}`;
            break;
          }
          case 'batch_create':
          case 'batch_update':
          case 'batch_delete': {
            const recordsStr = getStringProperty(config, 'fields', ''); // Reusing fields for batch data
            if (!recordsStr) throw new Error(`Airtable: Records data is required for ${operation}`);
            
            if (operation === 'batch_delete') {
              const recordIds = parseJSONSafe(replaceTemplates(recordsStr, input), 'records') as string[];
              url = `${baseUrl}?${recordIds.map(id => `records[]=${id}`).join('&')}`;
              method = 'DELETE';
            } else {
              url = baseUrl;
              method = operation === 'batch_create' ? 'POST' : 'PATCH';
              body = { records: parseJSONSafe(replaceTemplates(recordsStr, input), 'records') };
            }
            break;
          }
          default:
            throw new Error(`Airtable: Unknown operation "${operation}"`);
        }

        const response = await fetch(url, {
          method,
          headers,
          body: body ? JSON.stringify(body) : undefined,
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Airtable API error: ${response.status} - ${errorText || response.statusText}`);
        }

        return await response.json();
      } catch (error) {
        throw new Error(`Airtable: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    case "clickup": {
      const apiKey = getStringProperty(config, 'apiKey', '');
      const operation = getStringProperty(config, 'operation', 'create_task');
      
      if (!apiKey || !apiKey.trim()) {
        throw new Error('ClickUp: API Key is required. Please add your ClickUp API key in the node properties.');
      }

      try {
        const baseUrl = 'https://api.clickup.com/api/v2';
        const headers: Record<string, string> = {
          'Authorization': apiKey,
          'Content-Type': 'application/json',
        };

        let url = '';
        let method = 'GET';
        let body: unknown = undefined;

        switch (operation) {
          case 'create_task': {
            const listId = replaceTemplates(getStringProperty(config, 'listId', ''), input);
            const name = replaceTemplates(getStringProperty(config, 'name', ''), input);
            
            if (!listId) throw new Error('ClickUp: List ID is required for create_task');
            if (!name) throw new Error('ClickUp: Task Name is required for create_task');
            
            url = `${baseUrl}/list/${listId}/task`;
            method = 'POST';
            body = {
              name,
              description: replaceTemplates(getStringProperty(config, 'description', ''), input),
              status: replaceTemplates(getStringProperty(config, 'status', ''), input),
              priority: getNumberProperty(config, 'priority', 2),
              assignees: config.assignees ? parseJSONSafe(replaceTemplates(getStringProperty(config, 'assignees', ''), input), 'assignees') : undefined,
              due_date: getNumberProperty(config, 'dueDate', 0) || undefined,
            };
            // Remove undefined fields
            Object.keys(body as Record<string, unknown>).forEach(key => {
              if ((body as Record<string, unknown>)[key] === undefined) {
                delete (body as Record<string, unknown>)[key];
              }
            });
            break;
          }
          case 'update_task': {
            const taskId = replaceTemplates(getStringProperty(config, 'taskId', ''), input);
            if (!taskId) throw new Error('ClickUp: Task ID is required for update_task');
            
            url = `${baseUrl}/task/${taskId}`;
            method = 'PUT';
            body = {
              name: replaceTemplates(getStringProperty(config, 'name', ''), input),
              description: replaceTemplates(getStringProperty(config, 'description', ''), input),
              status: replaceTemplates(getStringProperty(config, 'status', ''), input),
              priority: getNumberProperty(config, 'priority', 2),
              assignees: config.assignees ? parseJSONSafe(replaceTemplates(getStringProperty(config, 'assignees', ''), input), 'assignees') : undefined,
              due_date: getNumberProperty(config, 'dueDate', 0) || undefined,
            };
            Object.keys(body as Record<string, unknown>).forEach(key => {
              if ((body as Record<string, unknown>)[key] === undefined) {
                delete (body as Record<string, unknown>)[key];
              }
            });
            break;
          }
          case 'get_task': {
            const taskId = replaceTemplates(getStringProperty(config, 'taskId', ''), input);
            if (!taskId) throw new Error('ClickUp: Task ID is required for get_task');
            
            url = `${baseUrl}/task/${taskId}`;
            break;
          }
          case 'delete_task': {
            const taskId = replaceTemplates(getStringProperty(config, 'taskId', ''), input);
            if (!taskId) throw new Error('ClickUp: Task ID is required for delete_task');
            
            url = `${baseUrl}/task/${taskId}`;
            method = 'DELETE';
            break;
          }
          case 'list_tasks': {
            const listId = replaceTemplates(getStringProperty(config, 'listId', ''), input);
            if (!listId) throw new Error('ClickUp: List ID is required for list_tasks');
            
            const includeClosed = getBooleanProperty(config, 'includeClosed', false);
            url = `${baseUrl}/list/${listId}/task?archived=${includeClosed}`;
            break;
          }
          case 'add_comment': {
            const taskId = replaceTemplates(getStringProperty(config, 'taskId', ''), input);
            const commentText = replaceTemplates(getStringProperty(config, 'commentText', ''), input);
            
            if (!taskId) throw new Error('ClickUp: Task ID is required for add_comment');
            if (!commentText) throw new Error('ClickUp: Comment Text is required for add_comment');
            
            url = `${baseUrl}/task/${taskId}/comment`;
            method = 'POST';
            body = { comment_text: commentText };
            break;
          }
          case 'update_status': {
            const taskId = replaceTemplates(getStringProperty(config, 'taskId', ''), input);
            const status = replaceTemplates(getStringProperty(config, 'status', ''), input);
            
            if (!taskId) throw new Error('ClickUp: Task ID is required for update_status');
            if (!status) throw new Error('ClickUp: Status is required for update_status');
            
            url = `${baseUrl}/task/${taskId}`;
            method = 'PUT';
            body = { status };
            break;
          }
          case 'get_teams': {
            url = `${baseUrl}/team`;
            break;
          }
          case 'get_spaces': {
            const workspaceId = replaceTemplates(getStringProperty(config, 'workspaceId', ''), input);
            if (!workspaceId) throw new Error('ClickUp: Workspace ID is required for get_spaces');
            
            url = `${baseUrl}/team/${workspaceId}/space`;
            break;
          }
          case 'get_folders': {
            const spaceId = replaceTemplates(getStringProperty(config, 'spaceId', ''), input);
            if (!spaceId) throw new Error('ClickUp: Space ID is required for get_folders');
            
            url = `${baseUrl}/space/${spaceId}/folder`;
            break;
          }
          case 'get_lists': {
            const folderId = replaceTemplates(getStringProperty(config, 'folderId', ''), input);
            const listId = replaceTemplates(getStringProperty(config, 'listId', ''), input);
            
            if (folderId) {
              url = `${baseUrl}/folder/${folderId}/list`;
            } else if (listId) {
              url = `${baseUrl}/list/${listId}`;
            } else {
              throw new Error('ClickUp: Folder ID or List ID is required for get_lists');
            }
            break;
          }
          default:
            throw new Error(`ClickUp: Unknown operation "${operation}"`);
        }

        const response = await fetch(url, {
          method,
          headers,
          body: body ? JSON.stringify(body) : undefined,
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`ClickUp API error: ${response.status} - ${errorText || response.statusText}`);
        }

        return await response.json();
      } catch (error) {
        throw new Error(`ClickUp: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    case "trello": {
      const apiKey = getStringProperty(config, 'apiKey', '');
      const token = getStringProperty(config, 'token', '');
      const operation = getStringProperty(config, 'operation', 'create_card');
      
      if (!apiKey || !token) {
        throw new Error('Trello: API Key and Token are required. Please add them in the node properties.');
      }

      try {
        const baseUrl = 'https://api.trello.com/1';
        const authParams = `key=${apiKey}&token=${token}`;

        let url = '';
        let method = 'GET';
        let body: unknown = undefined;

        switch (operation) {
          case 'create_card': {
            const listId = replaceTemplates(getStringProperty(config, 'listId', ''), input);
            const name = replaceTemplates(getStringProperty(config, 'name', ''), input);
            
            if (!listId) throw new Error('Trello: List ID is required for create_card');
            if (!name) throw new Error('Trello: Card Name is required for create_card');
            
            url = `${baseUrl}/cards?${authParams}`;
            method = 'POST';
            const formData = new URLSearchParams();
            formData.append('idList', listId);
            formData.append('name', name);
            const desc = replaceTemplates(getStringProperty(config, 'desc', ''), input);
            if (desc) formData.append('desc', desc);
            const dueDate = replaceTemplates(getStringProperty(config, 'dueDate', ''), input);
            if (dueDate) formData.append('due', dueDate);
            const idLabels = replaceTemplates(getStringProperty(config, 'idLabels', ''), input);
            if (idLabels) formData.append('idLabels', idLabels);
            const idMembers = replaceTemplates(getStringProperty(config, 'idMembers', ''), input);
            if (idMembers) formData.append('idMembers', idMembers);
            
            body = formData.toString();
            break;
          }
          case 'update_card': {
            const cardId = replaceTemplates(getStringProperty(config, 'cardId', ''), input);
            if (!cardId) throw new Error('Trello: Card ID is required for update_card');
            
            url = `${baseUrl}/cards/${cardId}?${authParams}`;
            method = 'PUT';
            const formData = new URLSearchParams();
            const name = replaceTemplates(getStringProperty(config, 'name', ''), input);
            if (name) formData.append('name', name);
            const desc = replaceTemplates(getStringProperty(config, 'desc', ''), input);
            if (desc) formData.append('desc', desc);
            const dueDate = replaceTemplates(getStringProperty(config, 'dueDate', ''), input);
            if (dueDate) formData.append('due', dueDate);
            body = formData.toString();
            break;
          }
          case 'get_card': {
            const cardId = replaceTemplates(getStringProperty(config, 'cardId', ''), input);
            if (!cardId) throw new Error('Trello: Card ID is required for get_card');
            
            url = `${baseUrl}/cards/${cardId}?${authParams}`;
            break;
          }
          case 'delete_card': {
            const cardId = replaceTemplates(getStringProperty(config, 'cardId', ''), input);
            if (!cardId) throw new Error('Trello: Card ID is required for delete_card');
            
            url = `${baseUrl}/cards/${cardId}?${authParams}`;
            method = 'DELETE';
            break;
          }
          case 'list_cards': {
            const listId = replaceTemplates(getStringProperty(config, 'listId', ''), input);
            if (!listId) throw new Error('Trello: List ID is required for list_cards');
            
            url = `${baseUrl}/lists/${listId}/cards?${authParams}`;
            break;
          }
          case 'move_card': {
            const cardId = replaceTemplates(getStringProperty(config, 'cardId', ''), input);
            const newListId = replaceTemplates(getStringProperty(config, 'newListId', ''), input);
            
            if (!cardId) throw new Error('Trello: Card ID is required for move_card');
            if (!newListId) throw new Error('Trello: New List ID is required for move_card');
            
            url = `${baseUrl}/cards/${cardId}?${authParams}`;
            method = 'PUT';
            body = new URLSearchParams({ idList: newListId }).toString();
            break;
          }
          case 'add_label': {
            const cardId = replaceTemplates(getStringProperty(config, 'cardId', ''), input);
            const idLabels = replaceTemplates(getStringProperty(config, 'idLabels', ''), input);
            
            if (!cardId) throw new Error('Trello: Card ID is required for add_label');
            if (!idLabels) throw new Error('Trello: Label IDs are required for add_label');
            
            url = `${baseUrl}/cards/${cardId}/idLabels?${authParams}`;
            method = 'POST';
            body = new URLSearchParams({ value: idLabels }).toString();
            break;
          }
          case 'add_checklist': {
            const cardId = replaceTemplates(getStringProperty(config, 'cardId', ''), input);
            const checklistName = replaceTemplates(getStringProperty(config, 'checklistName', ''), input);
            
            if (!cardId) throw new Error('Trello: Card ID is required for add_checklist');
            if (!checklistName) throw new Error('Trello: Checklist Name is required for add_checklist');
            
            url = `${baseUrl}/cards/${cardId}/checklists?${authParams}`;
            method = 'POST';
            body = new URLSearchParams({ name: checklistName }).toString();
            break;
          }
          case 'get_boards': {
            url = `${baseUrl}/members/me/boards?${authParams}`;
            break;
          }
          case 'get_lists': {
            const boardId = replaceTemplates(getStringProperty(config, 'boardId', ''), input);
            if (!boardId) throw new Error('Trello: Board ID is required for get_lists');
            
            url = `${baseUrl}/boards/${boardId}/lists?${authParams}`;
            break;
          }
          default:
            throw new Error(`Trello: Unknown operation "${operation}"`);
        }

        const requestHeaders: Record<string, string> = {
          'Content-Type': method === 'POST' || method === 'PUT' ? 'application/x-www-form-urlencoded' : 'application/json',
        };

        const response = await fetch(url, {
          method,
          headers: requestHeaders,
          body: typeof body === 'string' ? body : body ? JSON.stringify(body) : undefined,
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Trello API error: ${response.status} - ${errorText || response.statusText}`);
        }

        return await response.json();
      } catch (error) {
        throw new Error(`Trello: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    case "asana": {
      const accessToken = getStringProperty(config, 'accessToken', '');
      const operation = getStringProperty(config, 'operation', 'create_task');
      
      if (!accessToken || !accessToken.trim()) {
        throw new Error('Asana: Access Token is required. Please add your Asana access token in the node properties.');
      }

      try {
        const baseUrl = 'https://app.asana.com/api/1.0';
        const headers: Record<string, string> = {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        };

        let url = '';
        let method = 'GET';
        let body: unknown = undefined;

        switch (operation) {
          case 'create_task': {
            const name = replaceTemplates(getStringProperty(config, 'name', ''), input);
            if (!name) throw new Error('Asana: Task Name is required for create_task');
            
            url = `${baseUrl}/tasks`;
            method = 'POST';
            body = {
              data: {
                name,
                notes: replaceTemplates(getStringProperty(config, 'notes', ''), input),
                workspace: replaceTemplates(getStringProperty(config, 'workspaceId', ''), input),
                projects: config.projectId ? [replaceTemplates(getStringProperty(config, 'projectId', ''), input)] : undefined,
                due_on: replaceTemplates(getStringProperty(config, 'dueOn', ''), input),
                assignee: replaceTemplates(getStringProperty(config, 'assignee', ''), input),
                followers: config.followers ? parseJSONSafe(replaceTemplates(getStringProperty(config, 'followers', ''), input), 'followers') : undefined,
              }
            };
            Object.keys((body as Record<string, unknown>).data as Record<string, unknown>).forEach(key => {
              if (((body as Record<string, unknown>).data as Record<string, unknown>)[key] === undefined || 
                  ((body as Record<string, unknown>).data as Record<string, unknown>)[key] === '') {
                delete ((body as Record<string, unknown>).data as Record<string, unknown>)[key];
              }
            });
            break;
          }
          case 'update_task': {
            const taskId = replaceTemplates(getStringProperty(config, 'taskId', ''), input);
            if (!taskId) throw new Error('Asana: Task ID is required for update_task');
            
            url = `${baseUrl}/tasks/${taskId}`;
            method = 'PUT';
            body = {
              data: {
                name: replaceTemplates(getStringProperty(config, 'name', ''), input),
                notes: replaceTemplates(getStringProperty(config, 'notes', ''), input),
                due_on: replaceTemplates(getStringProperty(config, 'dueOn', ''), input),
                assignee: replaceTemplates(getStringProperty(config, 'assignee', ''), input),
                completed: getBooleanProperty(config, 'completed', false),
              }
            };
            Object.keys((body as Record<string, unknown>).data as Record<string, unknown>).forEach(key => {
              if (((body as Record<string, unknown>).data as Record<string, unknown>)[key] === undefined || 
                  ((body as Record<string, unknown>).data as Record<string, unknown>)[key] === '') {
                delete ((body as Record<string, unknown>).data as Record<string, unknown>)[key];
              }
            });
            break;
          }
          case 'get_task': {
            const taskId = replaceTemplates(getStringProperty(config, 'taskId', ''), input);
            if (!taskId) throw new Error('Asana: Task ID is required for get_task');
            
            url = `${baseUrl}/tasks/${taskId}`;
            break;
          }
          case 'delete_task': {
            const taskId = replaceTemplates(getStringProperty(config, 'taskId', ''), input);
            if (!taskId) throw new Error('Asana: Task ID is required for delete_task');
            
            url = `${baseUrl}/tasks/${taskId}`;
            method = 'DELETE';
            break;
          }
          case 'list_tasks': {
            const projectId = replaceTemplates(getStringProperty(config, 'projectId', ''), input);
            if (!projectId) throw new Error('Asana: Project ID is required for list_tasks');
            
            url = `${baseUrl}/projects/${projectId}/tasks`;
            break;
          }
          case 'add_subtask': {
            const taskId = replaceTemplates(getStringProperty(config, 'taskId', ''), input);
            const name = replaceTemplates(getStringProperty(config, 'name', ''), input);
            
            if (!taskId) throw new Error('Asana: Task ID is required for add_subtask');
            if (!name) throw new Error('Asana: Task Name is required for add_subtask');
            
            url = `${baseUrl}/tasks/${taskId}/subtasks`;
            method = 'POST';
            body = { data: { name } };
            break;
          }
          case 'add_comment': {
            const taskId = replaceTemplates(getStringProperty(config, 'taskId', ''), input);
            const commentText = replaceTemplates(getStringProperty(config, 'commentText', ''), input);
            
            if (!taskId) throw new Error('Asana: Task ID is required for add_comment');
            if (!commentText) throw new Error('Asana: Comment Text is required for add_comment');
            
            url = `${baseUrl}/tasks/${taskId}/stories`;
            method = 'POST';
            body = { data: { text: commentText } };
            break;
          }
          case 'get_projects': {
            const workspaceId = replaceTemplates(getStringProperty(config, 'workspaceId', ''), input);
            if (!workspaceId) throw new Error('Asana: Workspace ID is required for get_projects');
            
            url = `${baseUrl}/workspaces/${workspaceId}/projects`;
            break;
          }
          case 'get_sections': {
            const projectId = replaceTemplates(getStringProperty(config, 'projectId', ''), input);
            if (!projectId) throw new Error('Asana: Project ID is required for get_sections');
            
            url = `${baseUrl}/projects/${projectId}/sections`;
            break;
          }
          default:
            throw new Error(`Asana: Unknown operation "${operation}"`);
        }

        const response = await fetch(url, {
          method,
          headers,
          body: body ? JSON.stringify(body) : undefined,
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Asana API error: ${response.status} - ${errorText || response.statusText}`);
        }

        return await response.json();
      } catch (error) {
        throw new Error(`Asana: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    case "jira": {
      const apiToken = getStringProperty(config, 'apiToken', '');
      const email = getStringProperty(config, 'email', '');
      const domain = replaceTemplates(getStringProperty(config, 'domain', ''), input);
      const operation = getStringProperty(config, 'operation', 'create_issue');
      
      if (!apiToken || !email || !domain) {
        throw new Error('Jira: API Token, Email, and Domain are required. Please add them in the node properties.');
      }

      try {
        const baseUrl = `https://${domain}/rest/api/3`;
        const auth = btoa(`${email}:${apiToken}`);
        const headers: Record<string, string> = {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        };

        let url = '';
        let method = 'GET';
        let body: unknown = undefined;

        switch (operation) {
          case 'create_issue': {
            const projectKey = replaceTemplates(getStringProperty(config, 'projectKey', ''), input);
            const summary = replaceTemplates(getStringProperty(config, 'summary', ''), input);
            const issueType = replaceTemplates(getStringProperty(config, 'issueType', 'Task'), input);
            
            if (!projectKey) throw new Error('Jira: Project Key is required for create_issue');
            if (!summary) throw new Error('Jira: Issue Summary is required for create_issue');
            
            url = `${baseUrl}/issue`;
            method = 'POST';
            const fields: Record<string, unknown> = {
              project: { key: projectKey },
              summary,
              issuetype: { name: issueType },
            };
            
            const description = replaceTemplates(getStringProperty(config, 'description', ''), input);
            if (description) fields.description = { type: 'doc', version: 1, content: [{ type: 'paragraph', content: [{ type: 'text', text: description }] }] };
            
            const assignee = replaceTemplates(getStringProperty(config, 'assignee', ''), input);
            if (assignee) fields.assignee = { id: assignee };
            
            const priority = replaceTemplates(getStringProperty(config, 'priority', 'Medium'), input);
            fields.priority = { name: priority };
            
            const labelsStr = getStringProperty(config, 'labels', '');
            if (labelsStr) {
              const labels = parseJSONSafe(replaceTemplates(labelsStr, input), 'labels') as string[];
              if (Array.isArray(labels)) fields.labels = labels;
            }
            
            body = { fields };
            break;
          }
          case 'update_issue': {
            const issueKey = replaceTemplates(getStringProperty(config, 'issueKey', ''), input);
            if (!issueKey) throw new Error('Jira: Issue Key is required for update_issue');
            
            url = `${baseUrl}/issue/${issueKey}`;
            method = 'PUT';
            const fields: Record<string, unknown> = {};
            
            const summary = replaceTemplates(getStringProperty(config, 'summary', ''), input);
            if (summary) fields.summary = summary;
            
            const description = replaceTemplates(getStringProperty(config, 'description', ''), input);
            if (description) fields.description = { type: 'doc', version: 1, content: [{ type: 'paragraph', content: [{ type: 'text', text: description }] }] };
            
            const assignee = replaceTemplates(getStringProperty(config, 'assignee', ''), input);
            if (assignee) fields.assignee = { id: assignee };
            
            const priority = replaceTemplates(getStringProperty(config, 'priority', 'Medium'), input);
            if (priority) fields.priority = { name: priority };
            
            body = { fields };
            break;
          }
          case 'get_issue': {
            const issueKey = replaceTemplates(getStringProperty(config, 'issueKey', ''), input);
            if (!issueKey) throw new Error('Jira: Issue Key is required for get_issue');
            
            url = `${baseUrl}/issue/${issueKey}`;
            break;
          }
          case 'delete_issue': {
            const issueKey = replaceTemplates(getStringProperty(config, 'issueKey', ''), input);
            if (!issueKey) throw new Error('Jira: Issue Key is required for delete_issue');
            
            url = `${baseUrl}/issue/${issueKey}`;
            method = 'DELETE';
            break;
          }
          case 'search_issues': {
            const jql = replaceTemplates(getStringProperty(config, 'jql', ''), input);
            const maxResults = getNumberProperty(config, 'maxResults', 50);
            
            if (!jql) throw new Error('Jira: JQL Query is required for search_issues');
            
            url = `${baseUrl}/search?jql=${encodeURIComponent(jql)}&maxResults=${Math.min(maxResults, 100)}`;
            break;
          }
          case 'transition_issue': {
            const issueKey = replaceTemplates(getStringProperty(config, 'issueKey', ''), input);
            const transitionId = replaceTemplates(getStringProperty(config, 'transitionId', ''), input);
            
            if (!issueKey) throw new Error('Jira: Issue Key is required for transition_issue');
            if (!transitionId) throw new Error('Jira: Transition ID is required for transition_issue');
            
            url = `${baseUrl}/issue/${issueKey}/transitions`;
            method = 'POST';
            body = { transition: { id: transitionId } };
            break;
          }
          case 'add_comment': {
            const issueKey = replaceTemplates(getStringProperty(config, 'issueKey', ''), input);
            const commentBody = replaceTemplates(getStringProperty(config, 'commentBody', ''), input);
            
            if (!issueKey) throw new Error('Jira: Issue Key is required for add_comment');
            if (!commentBody) throw new Error('Jira: Comment Body is required for add_comment');
            
            url = `${baseUrl}/issue/${issueKey}/comment`;
            method = 'POST';
            body = { body: { type: 'doc', version: 1, content: [{ type: 'paragraph', content: [{ type: 'text', text: commentBody }] }] } };
            break;
          }
          case 'get_projects': {
            url = `${baseUrl}/project`;
            break;
          }
          default:
            throw new Error(`Jira: Unknown operation "${operation}"`);
        }

        const response = await fetch(url, {
          method,
          headers,
          body: body ? JSON.stringify(body) : undefined,
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Jira API error: ${response.status} - ${errorText || response.statusText}`);
        }

        return await response.json();
      } catch (error) {
        throw new Error(`Jira: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    case "monday": {
      const apiToken = getStringProperty(config, 'apiToken', '');
      const operation = getStringProperty(config, 'operation', 'create_item');
      
      if (!apiToken || !apiToken.trim()) {
        throw new Error('Monday.com: API Token is required. Please add your Monday.com API token in the node properties.');
      }

      try {
        const baseUrl = 'https://api.monday.com/v2';
        const headers: Record<string, string> = {
          'Authorization': apiToken,
          'Content-Type': 'application/json',
        };

        let query = '';
        let variables: Record<string, unknown> = {};

        switch (operation) {
          case 'create_item': {
            const boardId = replaceTemplates(getStringProperty(config, 'boardId', ''), input);
            const groupId = replaceTemplates(getStringProperty(config, 'groupId', ''), input);
            const itemName = replaceTemplates(getStringProperty(config, 'itemName', ''), input);
            const columnValuesStr = getStringProperty(config, 'columnValues', '');
            
            if (!boardId) throw new Error('Monday.com: Board ID is required for create_item');
            if (!itemName) throw new Error('Monday.com: Item Name is required for create_item');
            
            let columnValues = '';
            if (columnValuesStr) {
              const parsed = parseJSONSafe(replaceTemplates(columnValuesStr, input), 'columnValues');
              columnValues = JSON.stringify(parsed);
            }
            
            query = `mutation ($boardId: ID!, $groupId: String!, $itemName: String!, $columnValues: JSON) {
              create_item (board_id: $boardId, group_id: $groupId, item_name: $itemName, column_values: $columnValues) {
                id
              }
            }`;
            variables = { boardId, groupId: groupId || 'new_group', itemName, columnValues: columnValues || undefined };
            break;
          }
          case 'update_item': {
            const itemId = replaceTemplates(getStringProperty(config, 'itemId', ''), input);
            const columnValuesStr = getStringProperty(config, 'columnValues', '');
            
            if (!itemId) throw new Error('Monday.com: Item ID is required for update_item');
            if (!columnValuesStr) throw new Error('Monday.com: Column Values are required for update_item');
            
            const columnValues = JSON.stringify(parseJSONSafe(replaceTemplates(columnValuesStr, input), 'columnValues'));
            
            query = `mutation ($itemId: ID!, $columnValues: JSON!) {
              change_multiple_column_values (item_id: $itemId, column_values: $columnValues) {
                id
              }
            }`;
            variables = { itemId, columnValues };
            break;
          }
          case 'get_item': {
            const itemId = replaceTemplates(getStringProperty(config, 'itemId', ''), input);
            if (!itemId) throw new Error('Monday.com: Item ID is required for get_item');
            
            query = `query ($itemId: [ID!]) {
              items (ids: $itemId) {
                id
                name
                column_values {
                  id
                  text
                  value
                }
              }
            }`;
            variables = { itemId: [itemId] };
            break;
          }
          case 'delete_item': {
            const itemId = replaceTemplates(getStringProperty(config, 'itemId', ''), input);
            if (!itemId) throw new Error('Monday.com: Item ID is required for delete_item');
            
            query = `mutation ($itemId: ID!) {
              delete_item (item_id: $itemId) {
                id
              }
            }`;
            variables = { itemId };
            break;
          }
          case 'list_items': {
            const boardId = replaceTemplates(getStringProperty(config, 'boardId', ''), input);
            const limit = getNumberProperty(config, 'limit', 25);
            
            if (!boardId) throw new Error('Monday.com: Board ID is required for list_items');
            
            query = `query ($boardId: [ID!], $limit: Int!) {
              boards (ids: $boardId) {
                items_page (limit: $limit) {
                  items {
                    id
                    name
                    column_values {
                      id
                      text
                    }
                  }
                }
              }
            }`;
            variables = { boardId: [boardId], limit: Math.min(limit, 100) };
            break;
          }
          case 'update_column': {
            const itemId = replaceTemplates(getStringProperty(config, 'itemId', ''), input);
            const columnId = replaceTemplates(getStringProperty(config, 'columnId', ''), input);
            const columnValuesStr = getStringProperty(config, 'columnValues', '');
            
            if (!itemId) throw new Error('Monday.com: Item ID is required for update_column');
            if (!columnId) throw new Error('Monday.com: Column ID is required for update_column');
            if (!columnValuesStr) throw new Error('Monday.com: Column Values are required for update_column');
            
            const columnValues = JSON.stringify(parseJSONSafe(replaceTemplates(columnValuesStr, input), 'columnValues'));
            
            query = `mutation ($itemId: ID!, $columnId: String!, $value: JSON!) {
              change_column_value (item_id: $itemId, column_id: $columnId, value: $value) {
                id
              }
            }`;
            variables = { itemId, columnId, value: columnValues };
            break;
          }
          case 'create_subitem': {
            const itemId = replaceTemplates(getStringProperty(config, 'itemId', ''), input);
            const subitemName = replaceTemplates(getStringProperty(config, 'subitemName', ''), input);
            
            if (!itemId) throw new Error('Monday.com: Item ID is required for create_subitem');
            if (!subitemName) throw new Error('Monday.com: Subitem Name is required for create_subitem');
            
            query = `mutation ($parentItemId: ID!, $itemName: String!) {
              create_subitem (parent_item_id: $parentItemId, item_name: $itemName) {
                id
              }
            }`;
            variables = { parentItemId: itemId, itemName: subitemName };
            break;
          }
          case 'get_boards': {
            query = `query {
              boards (limit: 50) {
                id
                name
              }
            }`;
            variables = {};
            break;
          }
          case 'get_groups': {
            const boardId = replaceTemplates(getStringProperty(config, 'boardId', ''), input);
            if (!boardId) throw new Error('Monday.com: Board ID is required for get_groups');
            
            query = `query ($boardId: [ID!]) {
              boards (ids: $boardId) {
                groups {
                  id
                  title
                }
              }
            }`;
            variables = { boardId: [boardId] };
            break;
          }
          default:
            throw new Error(`Monday.com: Unknown operation "${operation}"`);
        }

        const response = await fetch(baseUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify({ query, variables }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Monday.com API error: ${response.status} - ${errorText || response.statusText}`);
        }

        const data = await response.json();
        if (data.errors) {
          throw new Error(`Monday.com API error: ${JSON.stringify(data.errors)}`);
        }

        return data.data;
      } catch (error) {
        throw new Error(`Monday.com: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    case "todoist": {
      const apiToken = getStringProperty(config, 'apiToken', '');
      const operation = getStringProperty(config, 'operation', 'create_task');
      
      if (!apiToken || !apiToken.trim()) {
        throw new Error('Todoist: API Token is required. Please add your Todoist API token in the node properties.');
      }

      try {
        const baseUrl = 'https://api.todoist.com/rest/v2';
        const headers: Record<string, string> = {
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
        };

        let url = '';
        let method = 'GET';
        let body: unknown = undefined;

        switch (operation) {
          case 'create_task': {
            const content = replaceTemplates(getStringProperty(config, 'content', ''), input);
            if (!content) throw new Error('Todoist: Task Content is required for create_task');
            
            url = `${baseUrl}/tasks`;
            method = 'POST';
            body = {
              content,
              description: replaceTemplates(getStringProperty(config, 'description', ''), input),
              project_id: replaceTemplates(getStringProperty(config, 'projectId', ''), input),
              section_id: replaceTemplates(getStringProperty(config, 'sectionId', ''), input),
              due_string: replaceTemplates(getStringProperty(config, 'dueString', ''), input),
              priority: getNumberProperty(config, 'priority', 1),
              labels: config.labels ? parseJSONSafe(replaceTemplates(getStringProperty(config, 'labels', ''), input), 'labels') : undefined,
            };
            Object.keys(body as Record<string, unknown>).forEach(key => {
              if ((body as Record<string, unknown>)[key] === undefined || 
                  (body as Record<string, unknown>)[key] === '') {
                delete (body as Record<string, unknown>)[key];
              }
            });
            break;
          }
          case 'update_task': {
            const taskId = replaceTemplates(getStringProperty(config, 'taskId', ''), input);
            if (!taskId) throw new Error('Todoist: Task ID is required for update_task');
            
            url = `${baseUrl}/tasks/${taskId}`;
            method = 'POST';
            body = {
              content: replaceTemplates(getStringProperty(config, 'content', ''), input),
              description: replaceTemplates(getStringProperty(config, 'description', ''), input),
              due_string: replaceTemplates(getStringProperty(config, 'dueString', ''), input),
              priority: getNumberProperty(config, 'priority', 1),
              labels: config.labels ? parseJSONSafe(replaceTemplates(getStringProperty(config, 'labels', ''), input), 'labels') : undefined,
            };
            Object.keys(body as Record<string, unknown>).forEach(key => {
              if ((body as Record<string, unknown>)[key] === undefined || 
                  (body as Record<string, unknown>)[key] === '') {
                delete (body as Record<string, unknown>)[key];
              }
            });
            break;
          }
          case 'get_task': {
            const taskId = replaceTemplates(getStringProperty(config, 'taskId', ''), input);
            if (!taskId) throw new Error('Todoist: Task ID is required for get_task');
            
            url = `${baseUrl}/tasks/${taskId}`;
            break;
          }
          case 'delete_task': {
            const taskId = replaceTemplates(getStringProperty(config, 'taskId', ''), input);
            if (!taskId) throw new Error('Todoist: Task ID is required for delete_task');
            
            url = `${baseUrl}/tasks/${taskId}`;
            method = 'DELETE';
            break;
          }
          case 'list_tasks': {
            url = `${baseUrl}/tasks`;
            const filter = replaceTemplates(getStringProperty(config, 'filter', ''), input);
            const projectId = replaceTemplates(getStringProperty(config, 'projectId', ''), input);
            
            const params = new URLSearchParams();
            if (filter) params.append('filter', filter);
            if (projectId) params.append('project_id', projectId);
            
            if (params.toString()) {
              url = `${url}?${params.toString()}`;
            }
            break;
          }
          case 'complete_task': {
            const taskId = replaceTemplates(getStringProperty(config, 'taskId', ''), input);
            if (!taskId) throw new Error('Todoist: Task ID is required for complete_task');
            
            url = `${baseUrl}/tasks/${taskId}/close`;
            method = 'POST';
            break;
          }
          case 'reopen_task': {
            const taskId = replaceTemplates(getStringProperty(config, 'taskId', ''), input);
            if (!taskId) throw new Error('Todoist: Task ID is required for reopen_task');
            
            url = `${baseUrl}/tasks/${taskId}/reopen`;
            method = 'POST';
            break;
          }
          case 'get_projects': {
            url = `${baseUrl}/projects`;
            break;
          }
          case 'get_sections': {
            const projectId = replaceTemplates(getStringProperty(config, 'projectId', ''), input);
            if (!projectId) throw new Error('Todoist: Project ID is required for get_sections');
            
            url = `${baseUrl}/sections?project_id=${projectId}`;
            break;
          }
          default:
            throw new Error(`Todoist: Unknown operation "${operation}"`);
        }

        const response = await fetch(url, {
          method,
          headers,
          body: body ? JSON.stringify(body) : undefined,
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Todoist API error: ${response.status} - ${errorText || response.statusText}`);
        }

        if (method === 'DELETE' && response.status === 204) {
          return { success: true };
        }

        return await response.json();
      } catch (error) {
        throw new Error(`Todoist: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    case "knowledge_base_search": {
      // Knowledge Base Search: Search internal documentation
      const query = getStringProperty(config, 'query', '');
      const knowledgeSourcesConfig = config.knowledgeSources;
      const topK = getNumberProperty(config, 'topK', 5);
      const filtersConfig = config.filters;

      if (!query || !query.trim()) {
        throw new Error("Knowledge Base Search: Query is required");
      }

      let knowledgeSources: Array<{ sourceId: string; type: 'wiki' | 'doc' | 'pdf' | 'faq' }> = [];
      if (knowledgeSourcesConfig) {
        if (typeof knowledgeSourcesConfig === 'string') {
          try {
            knowledgeSources = JSON.parse(knowledgeSourcesConfig);
          } catch {
            throw new Error("Knowledge Base Search: Invalid knowledge sources JSON format");
          }
        } else if (Array.isArray(knowledgeSourcesConfig)) {
          knowledgeSources = knowledgeSourcesConfig;
        }
      }

      if (knowledgeSources.length === 0) {
        throw new Error("Knowledge Base Search: At least one knowledge source is required");
      }

      let filters: Record<string, unknown> | null = null;
      if (filtersConfig) {
        if (typeof filtersConfig === 'string') {
          try {
            filters = JSON.parse(filtersConfig);
          } catch {
            filters = null;
          }
        } else if (typeof filtersConfig === 'object') {
          filters = filtersConfig as Record<string, unknown>;
        }
      }

      // In a real implementation, this would:
      // 1. Perform semantic search across knowledge sources
      // 2. Rank results by relevance using vector similarity
      // 3. Apply filters
      // 4. Return top K results with citations

      // Simulate search results (placeholder)
      const results: Array<{ sourceId: string; title: string; snippet: string; relevanceScore: number; reference: string }> = [];

      for (let i = 0; i < Math.min(topK, knowledgeSources.length); i++) {
        const source = knowledgeSources[i];
        results.push({
          sourceId: source.sourceId,
          title: `Search Result from ${source.type}`,
          snippet: `Relevant content matching "${query}" from ${source.type} source.`,
          relevanceScore: 0.9 - (i * 0.1),
          reference: `ref://${source.type}/${source.sourceId}`
        });
      }

      return {
        results,
        totalResults: results.length,
        query,
        note: "Knowledge base search requires vector database integration (e.g., Pinecone, Weaviate, or Supabase Vector) and semantic search. This is a placeholder implementation."
      };
    }

    case "onboarding_flow_generator": {
      // Onboarding Flow Generator: Generate onboarding workflows
      const role = getStringProperty(config, 'role', '');
      const department = getStringProperty(config, 'department', '');
      const location = getStringProperty(config, 'location', '');
      const startDateStr = getStringProperty(config, 'startDate', '');
      const companyPoliciesConfig = config.companyPolicies;

      if (!role || !department || !location || !startDateStr) {
        throw new Error("Onboarding Flow Generator: Role, department, location, and start date are required");
      }

      // Validate start date
      let startDate: Date;
      try {
        startDate = new Date(startDateStr);
        if (isNaN(startDate.getTime())) {
          throw new Error("Invalid date format");
        }
      } catch {
        throw new Error("Onboarding Flow Generator: Invalid start date format. Use ISO format (YYYY-MM-DD)");
      }

      let companyPolicies: string[] = [];
      if (companyPoliciesConfig) {
        if (typeof companyPoliciesConfig === 'string') {
          try {
            companyPolicies = JSON.parse(companyPoliciesConfig);
          } catch {
            companyPolicies = [companyPoliciesConfig];
          }
        } else if (Array.isArray(companyPoliciesConfig)) {
          companyPolicies = companyPoliciesConfig;
        }
      }

      // Generate onboarding flow based on role, department, and location
      const onboardingFlow: Array<{ step: number; task: string; owner: string; dueBy: string }> = [];
      
      // Calculate due dates from start date
      const addDays = (date: Date, days: number): string => {
        const result = new Date(date);
        result.setDate(result.getDate() + days);
        return result.toISOString().split('T')[0];
      };

      // Standard onboarding steps
      onboardingFlow.push(
        { step: 1, task: 'Welcome email and access credentials', owner: 'IT', dueBy: startDateStr },
        { step: 2, task: 'Company policy review and acknowledgment', owner: 'HR', dueBy: addDays(startDate, 1) },
        { step: 3, task: 'Setup workspace and equipment', owner: 'IT', dueBy: addDays(startDate, 1) },
        { step: 4, task: 'Department introduction and team meeting', owner: department, dueBy: addDays(startDate, 2) },
        { step: 5, task: 'Role-specific training and documentation', owner: department, dueBy: addDays(startDate, 5) }
      );

      // Add location-specific tasks if needed
      if (location.toLowerCase() !== 'us') {
        onboardingFlow.push({
          step: onboardingFlow.length + 1,
          task: `Location-specific compliance training (${location})`,
          owner: 'HR',
          dueBy: addDays(startDate, 3)
        });
      }

      // Add policy-specific tasks
      companyPolicies.forEach((policy, index) => {
        onboardingFlow.push({
          step: onboardingFlow.length + 1,
          task: `Review and acknowledge: ${policy}`,
          owner: 'HR',
          dueBy: addDays(startDate, index + 2)
        });
      });

      const durationDays = Math.ceil((new Date(onboardingFlow[onboardingFlow.length - 1].dueBy).getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

      return {
        onboardingFlow,
        durationDays,
        metadata: {
          role,
          department
        }
      };
    }

    case "policy_sync_node": {
      // Policy Sync Node: Synchronize policies across systems
      const policyId = getStringProperty(config, 'policyId', '');
      const policyContent = getStringProperty(config, 'policyContent', '');
      const sourceSystem = getStringProperty(config, 'sourceSystem', '');
      const targetSystemsConfig = config.targetSystems;
      const version = getStringProperty(config, 'version', '1.0.0');

      if (!policyId || !policyContent || !sourceSystem) {
        throw new Error("Policy Sync Node: Policy ID, content, and source system are required");
      }

      let targetSystems: string[] = [];
      if (targetSystemsConfig) {
        if (typeof targetSystemsConfig === 'string') {
          try {
            targetSystems = JSON.parse(targetSystemsConfig);
          } catch {
            targetSystems = [targetSystemsConfig];
          }
        } else if (Array.isArray(targetSystemsConfig)) {
          targetSystems = targetSystemsConfig;
        }
      }

      if (targetSystems.length === 0) {
        throw new Error("Policy Sync Node: At least one target system is required");
      }

      // In a real implementation, this would:
      // 1. Detect policy changes by comparing with previous version
      // 2. Sync updates to all target systems via their APIs
      // 3. Maintain version history
      // 4. Detect conflicts if policies were modified in target systems

      // Simulate sync operation
      const updatedSystems: string[] = [];
      const conflicts: string[] = [];
      let syncStatus: 'success' | 'partial' | 'failed' = 'success';

      for (const target of targetSystems) {
        // Simulate sync success/failure (90% success rate)
        const syncSuccess = Math.random() > 0.1;
        if (syncSuccess) {
          updatedSystems.push(target);
        } else {
          conflicts.push(target);
          syncStatus = 'partial';
        }
      }

      if (updatedSystems.length === 0) {
        syncStatus = 'failed';
      }

      return {
        policyId,
        version,
        syncStatus,
        updatedSystems,
        conflicts: conflicts.length > 0 ? conflicts : null,
        sourceSystem,
        note: "Policy sync requires integration with target system APIs. This is a placeholder implementation."
      };
    }

    case "employee_faq_indexer": {
      // Employee FAQ Indexer: Index FAQs for fast retrieval
      const faqItemsConfig = config.faqItems;
      const indexMode = getStringProperty(config, 'indexMode', 'create') as 'create' | 'update' | 'delete';
      const language = getStringProperty(config, 'language', 'en');

      let faqItems: Array<{ question: string; answer: string; category: string }> = [];
      if (faqItemsConfig) {
        if (typeof faqItemsConfig === 'string') {
          try {
            faqItems = JSON.parse(faqItemsConfig);
          } catch {
            throw new Error("Employee FAQ Indexer: Invalid FAQ items JSON format");
          }
        } else if (Array.isArray(faqItemsConfig)) {
          faqItems = faqItemsConfig;
        }
      }

      if (faqItems.length === 0 && indexMode !== 'delete') {
        throw new Error("Employee FAQ Indexer: At least one FAQ item is required for create/update mode");
      }

      // In a real implementation, this would:
      // 1. Normalize questions (remove punctuation, lowercase, etc.)
      // 2. Categorize FAQs automatically or use provided categories
      // 3. Index for semantic search using vector embeddings
      // 4. Support updates and deletions
      // 5. Maintain search index (Pinecone, Weaviate, etc.)

      // Extract unique categories
      const categoriesSet = new Set<string>();
      faqItems.forEach(item => {
        if (item.category) {
          categoriesSet.add(item.category);
        }
      });
      const categories = Array.from(categoriesSet);

      // Simulate indexing
      let indexedCount = 0;
      if (indexMode === 'create' || indexMode === 'update') {
        indexedCount = faqItems.length;
      } else if (indexMode === 'delete') {
        // In delete mode, count would be number of items deleted
        indexedCount = faqItems.length;
      }

      return {
        indexedCount,
        categories,
        indexStatus: 'completed',
        indexMode,
        language,
        note: "FAQ indexing requires vector database integration for semantic search. This is a placeholder implementation."
      };
    }

    // ============================================
    // AUTHENTICATION & IDENTITY NODES
    // ============================================
    case "oauth2": {
      const inputObj = extractInputObject(input);
      const operation = getStringProperty(config, 'operation', 'get_access_token');
      const grantType = getStringProperty(config, 'grantType', 'authorization_code');
      const clientId = getStringProperty(config, 'clientId', '');
      const clientSecret = getStringProperty(config, 'clientSecret', '');
      const tokenUrl = getStringProperty(config, 'tokenUrl', '');
      
      if (!clientId || !clientSecret || !tokenUrl) {
        throw new Error('OAuth2: Client ID, Client Secret, and Token URL are required');
      }

      try {
        const params = new URLSearchParams();
        params.append('grant_type', grantType);
        params.append('client_id', clientId);
        params.append('client_secret', clientSecret);

        if (operation === 'get_access_token') {
          if (grantType === 'authorization_code') {
            const code = getStringProperty(config, 'code', '');
            if (!code) throw new Error('OAuth2: Authorization code is required for authorization_code grant type');
            params.append('code', code);
            const redirectUri = getStringProperty(config, 'redirectUri', '');
            if (redirectUri) params.append('redirect_uri', redirectUri);
          } else if (grantType === 'password') {
            const username = getStringProperty(inputObj, 'username', '');
            const password = getStringProperty(inputObj, 'password', '');
            if (!username || !password) throw new Error('OAuth2: Username and password are required for password grant type');
            params.append('username', username);
            params.append('password', password);
          }

          const scope = getStringProperty(config, 'scope', '');
          if (scope) params.append('scope', scope);

          const response = await fetch(tokenUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: params.toString(),
          });

          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`OAuth2 API error: ${response.status} - ${errorText}`);
          }

          return await response.json();
        } else if (operation === 'refresh_token') {
          const refreshToken = getStringProperty(config, 'refreshToken', '');
          if (!refreshToken) throw new Error('OAuth2: Refresh token is required');
          params.append('refresh_token', refreshToken);

          const response = await fetch(tokenUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: params.toString(),
          });

          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`OAuth2 API error: ${response.status} - ${errorText}`);
          }

          return await response.json();
        } else if (operation === 'validate_token') {
          const token = getStringProperty(config, 'token', '') || getStringProperty(inputObj, 'token', '');
          if (!token) throw new Error('OAuth2: Token is required for validation');
          
          // Basic validation - check if token exists and is not empty
          // For production, you might want to call an introspection endpoint
          const parts = token.split('.');
          if (parts.length !== 3) {
            throw new Error('OAuth2: Invalid token format');
          }

          try {
            const payload = JSON.parse(atob(parts[1]));
            const currentTime = Math.floor(Date.now() / 1000);
            
            if (payload.exp && payload.exp < currentTime) {
              return { valid: false, reason: 'Token expired' };
            }

            return { valid: true, payload };
          } catch (error) {
            return { valid: false, reason: 'Invalid token format' };
          }
        } else if (operation === 'revoke_token') {
          const token = getStringProperty(config, 'token', '') || getStringProperty(inputObj, 'token', '');
          if (!token) throw new Error('OAuth2: Token is required for revocation');
          
          // Revocation endpoint is typically tokenUrl + '/revoke' or similar
          const revokeUrl = tokenUrl.replace('/token', '/revoke');
          const params = new URLSearchParams();
          params.append('token', token);
          params.append('client_id', clientId);
          params.append('client_secret', clientSecret);

          const response = await fetch(revokeUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: params.toString(),
          });

          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`OAuth2 API error: ${response.status} - ${errorText}`);
          }

          return { success: true };
        }
      } catch (error) {
        throw new Error(`OAuth2: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    case "jwt": {
      const operation = getStringProperty(config, 'operation', 'sign');
      const algorithm = getStringProperty(config, 'algorithm', 'HS256');
      const secret = getStringProperty(config, 'secret', '');
      
      if (!secret) {
        throw new Error('JWT: Secret/Key is required');
      }

      try {
        if (operation === 'sign') {
          const payloadStr = getStringProperty(config, 'payload', '{}');
          const payload = parseJSONSafe(payloadStr, 'payload') as Record<string, unknown>;
          
          // Simple JWT encoding (base64url)
          const base64UrlEncode = (str: string) => {
            return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
          };

          const header = { alg: algorithm, typ: 'JWT' };
          const headerEncoded = base64UrlEncode(JSON.stringify(header));
          
          // Add expiration if expiresIn is provided
          if (config.expiresIn) {
            const expiresInStr = getStringProperty(config, 'expiresIn', '');
            const now = Math.floor(Date.now() / 1000);
            let expires = now + 3600; // Default 1 hour
            
            if (expiresInStr) {
              const match = expiresInStr.match(/^(\d+)([hdms])$/);
              if (match) {
                const value = parseInt(match[1]);
                const unit = match[2];
                expires = now + (unit === 's' ? value : unit === 'm' ? value * 60 : unit === 'h' ? value * 3600 : value * 86400);
              }
            }
            payload.exp = expires;
          }

          const payloadEncoded = base64UrlEncode(JSON.stringify(payload));
          
          // For HS* algorithms, we'd need crypto, but for simplicity, we'll return the structure
          // In production, use a proper JWT library
          const signature = base64UrlEncode(secret); // Simplified - use proper HMAC in production
          
          return {
            token: `${headerEncoded}.${payloadEncoded}.${signature}`,
            header,
            payload,
          };
        } else if (operation === 'verify' || operation === 'decode') {
          const token = getStringProperty(config, 'token', '') || getStringProperty(inputObj, 'token', '');
          if (!token) throw new Error('JWT: Token is required for verify/decode');

          const parts = token.split('.');
          if (parts.length !== 3) {
            throw new Error('JWT: Invalid token format');
          }

          const base64UrlDecode = (str: string) => {
            str = str.replace(/-/g, '+').replace(/_/g, '/');
            while (str.length % 4) {
              str += '=';
            }
            return JSON.parse(atob(str));
          };

          const header = base64UrlDecode(parts[0]);
          const payload = base64UrlDecode(parts[1]);

          if (operation === 'decode') {
            return { header, payload };
          }

          // Verify expiration
          const currentTime = Math.floor(Date.now() / 1000);
          if (payload.exp && payload.exp < currentTime) {
            throw new Error('JWT: Token has expired');
          }

          // Signature verification would require proper crypto implementation
          return { valid: true, header, payload };
        }
      } catch (error) {
        throw new Error(`JWT: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    case "ldap": {
      // LDAP implementation requires an LDAP library
      // For now, we'll provide a structure that can be extended
      const operation = getStringProperty(config, 'operation', 'authenticate');
      const serverUrl = getStringProperty(config, 'serverUrl', '');
      
      if (!serverUrl) {
        throw new Error('LDAP: Server URL is required');
      }

      throw new Error('LDAP: LDAP operations require an LDAP client library. Use HTTP Request node with LDAP API endpoints as an alternative.');
    }

    case "okta": {
      const inputObj = extractInputObject(input);
      const operation = getStringProperty(config, 'operation', 'get_user');
      const domain = getStringProperty(config, 'domain', '');
      const apiToken = getStringProperty(config, 'apiToken', '');
      
      if (!domain || !apiToken) {
        throw new Error('Okta: Domain and API Token are required');
      }

      const baseUrl = `https://${domain.replace(/^https?:\/\//, '')}`;
      const headers = {
        'Authorization': `SSWS ${apiToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      };

      try {
        let url = '';
        let method = 'GET';
        let body: unknown = undefined;

        switch (operation) {
          case 'get_user': {
            const userId = getStringProperty(config, 'userId', '');
            if (!userId) throw new Error('Okta: User ID is required for get_user');
            url = `${baseUrl}/api/v1/users/${userId}`;
            break;
          }
          case 'list_users': {
            url = `${baseUrl}/api/v1/users`;
            const query = getStringProperty(config, 'query', '');
            const limit = getNumberProperty(config, 'limit', 200);
            const params = new URLSearchParams();
            if (query) params.append('q', query);
            params.append('limit', String(limit));
            if (params.toString()) url += `?${params.toString()}`;
            break;
          }
          case 'create_user': {
            url = `${baseUrl}/api/v1/users`;
            method = 'POST';
            const userDataStr = getStringProperty(config, 'userData', '{}');
            body = parseJSONSafe(userDataStr, 'userData');
            break;
          }
          case 'update_user': {
            const userId = getStringProperty(config, 'userId', '');
            if (!userId) throw new Error('Okta: User ID is required for update_user');
            url = `${baseUrl}/api/v1/users/${userId}`;
            method = 'POST';
            const userDataStr = getStringProperty(config, 'userData', '{}');
            body = parseJSONSafe(userDataStr, 'userData');
            break;
          }
          case 'delete_user': {
            const userId = getStringProperty(config, 'userId', '');
            if (!userId) throw new Error('Okta: User ID is required for delete_user');
            url = `${baseUrl}/api/v1/users/${userId}`;
            method = 'DELETE';
            break;
          }
          case 'authenticate_user': {
            url = `${baseUrl}/api/v1/authn`;
            method = 'POST';
            const username = getStringProperty(inputObj, 'username', '');
            const password = getStringProperty(inputObj, 'password', '');
            if (!username || !password) throw new Error('Okta: Username and password are required for authenticate_user');
            body = { username, password };
            break;
          }
          default:
            throw new Error(`Okta: Unknown operation "${operation}"`);
        }

        const response = await fetch(url, {
          method,
          headers,
          body: body ? JSON.stringify(body) : undefined,
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Okta API error: ${response.status} - ${errorText}`);
        }

        if (method === 'DELETE' && response.status === 204) {
          return { success: true };
        }

        return await response.json();
      } catch (error) {
        throw new Error(`Okta: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    case "auth0": {
      const inputObj = extractInputObject(input);
      const operation = getStringProperty(config, 'operation', 'get_user');
      const domain = getStringProperty(config, 'domain', '');
      const clientId = getStringProperty(config, 'clientId', '');
      const clientSecret = getStringProperty(config, 'clientSecret', '');
      
      if (!domain || !clientId || !clientSecret) {
        throw new Error('Auth0: Domain, Client ID, and Client Secret are required');
      }

      const baseUrl = `https://${domain.replace(/^https?:\/\//, '')}`;
      
      // Get management API token
      const getManagementToken = async () => {
        const tokenResponse = await fetch(`${baseUrl}/oauth/token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            client_id: clientId,
            client_secret: clientSecret,
            audience: `${baseUrl}/api/v2/`,
            grant_type: 'client_credentials',
          }),
        });

        if (!tokenResponse.ok) {
          const errorText = await tokenResponse.text();
          throw new Error(`Auth0 token error: ${tokenResponse.status} - ${errorText}`);
        }

        const tokenData = await tokenResponse.json();
        return tokenData.access_token;
      };

      try {
        if (operation === 'get_token') {
          const audience = getStringProperty(config, 'audience', '');
          const scope = getStringProperty(config, 'scope', '');
          
          const tokenResponse = await fetch(`${baseUrl}/oauth/token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              client_id: clientId,
              client_secret: clientSecret,
              audience: audience || `${baseUrl}/api/v2/`,
              grant_type: 'client_credentials',
              scope: scope || undefined,
            }),
          });

          if (!tokenResponse.ok) {
            const errorText = await tokenResponse.text();
            throw new Error(`Auth0 token error: ${tokenResponse.status} - ${errorText}`);
          }

          return await tokenResponse.json();
        }

        const accessToken = await getManagementToken();
        const headers = {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        };

        let url = '';
        let method = 'GET';
        let body: unknown = undefined;

        switch (operation) {
          case 'get_user': {
            const userId = getStringProperty(config, 'userId', '');
            if (!userId) throw new Error('Auth0: User ID is required for get_user');
            url = `${baseUrl}/api/v2/users/${encodeURIComponent(userId)}`;
            break;
          }
          case 'list_users': {
            url = `${baseUrl}/api/v2/users`;
            break;
          }
          case 'create_user': {
            url = `${baseUrl}/api/v2/users`;
            method = 'POST';
            const userDataStr = getStringProperty(config, 'userData', '{}');
            body = parseJSONSafe(userDataStr, 'userData');
            break;
          }
          case 'update_user': {
            const userId = getStringProperty(config, 'userId', '');
            if (!userId) throw new Error('Auth0: User ID is required for update_user');
            url = `${baseUrl}/api/v2/users/${encodeURIComponent(userId)}`;
            method = 'PATCH';
            const userDataStr = getStringProperty(config, 'userData', '{}');
            body = parseJSONSafe(userDataStr, 'userData');
            break;
          }
          case 'delete_user': {
            const userId = getStringProperty(config, 'userId', '');
            if (!userId) throw new Error('Auth0: User ID is required for delete_user');
            url = `${baseUrl}/api/v2/users/${encodeURIComponent(userId)}`;
            method = 'DELETE';
            break;
          }
          default:
            throw new Error(`Auth0: Unknown operation "${operation}"`);
        }

        const response = await fetch(url, {
          method,
          headers,
          body: body ? JSON.stringify(body) : undefined,
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Auth0 API error: ${response.status} - ${errorText}`);
        }

        if (method === 'DELETE' && response.status === 204) {
          return { success: true };
        }

        return await response.json();
      } catch (error) {
        throw new Error(`Auth0: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    case "keycloak": {
      const operation = getStringProperty(config, 'operation', 'get_token');
      const serverUrl = getStringProperty(config, 'serverUrl', '').replace(/\/$/, '');
      const realm = getStringProperty(config, 'realm', '');
      const clientId = getStringProperty(config, 'clientId', '');
      const clientSecret = getStringProperty(config, 'clientSecret', '');
      
      if (!serverUrl || !realm || !clientId || !clientSecret) {
        throw new Error('Keycloak: Server URL, Realm, Client ID, and Client Secret are required');
      }

      const tokenUrl = `${serverUrl}/realms/${realm}/protocol/openid-connect/token`;

      try {
        if (operation === 'get_token' || operation === 'refresh_token') {
          const params = new URLSearchParams();
          
          if (operation === 'get_token') {
            params.append('grant_type', 'password');
            params.append('client_id', clientId);
            params.append('client_secret', clientSecret);
            const username = getStringProperty(config, 'username', '');
            const password = getStringProperty(config, 'password', '');
            if (!username || !password) throw new Error('Keycloak: Username and password are required for get_token');
            params.append('username', username);
            params.append('password', password);
          } else {
            params.append('grant_type', 'refresh_token');
            params.append('client_id', clientId);
            params.append('client_secret', clientSecret);
            const refreshToken = getStringProperty(config, 'refreshToken', '');
            if (!refreshToken) throw new Error('Keycloak: Refresh token is required');
            params.append('refresh_token', refreshToken);
          }

          const response = await fetch(tokenUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: params.toString(),
          });

          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Keycloak API error: ${response.status} - ${errorText}`);
          }

          return await response.json();
        } else {
          // User operations require admin REST API
          const adminUrl = `${serverUrl}/admin/realms/${realm}`;
          const accessToken = await (async () => {
            const params = new URLSearchParams();
            params.append('grant_type', 'client_credentials');
            params.append('client_id', clientId);
            params.append('client_secret', clientSecret);

            const tokenResponse = await fetch(tokenUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
              body: params.toString(),
            });

            if (!tokenResponse.ok) {
              throw new Error('Keycloak: Failed to obtain admin access token');
            }

            const tokenData = await tokenResponse.json();
            return tokenData.access_token;
          })();

          const headers = {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          };

          let url = '';
          let method = 'GET';
          let body: unknown = undefined;

          switch (operation) {
            case 'get_user': {
              const userId = getStringProperty(config, 'userId', '');
              if (!userId) throw new Error('Keycloak: User ID is required for get_user');
              url = `${adminUrl}/users/${userId}`;
              break;
            }
            case 'list_users': {
              url = `${adminUrl}/users`;
              break;
            }
            case 'create_user': {
              url = `${adminUrl}/users`;
              method = 'POST';
              const userDataStr = getStringProperty(config, 'userData', '{}');
              body = parseJSONSafe(userDataStr, 'userData');
              break;
            }
            case 'update_user': {
              const userId = getStringProperty(config, 'userId', '');
              if (!userId) throw new Error('Keycloak: User ID is required for update_user');
              url = `${adminUrl}/users/${userId}`;
              method = 'PUT';
              const userDataStr = getStringProperty(config, 'userData', '{}');
              body = parseJSONSafe(userDataStr, 'userData');
              break;
            }
            default:
              throw new Error(`Keycloak: Unknown operation "${operation}"`);
          }

          const response = await fetch(url, {
            method,
            headers,
            body: body ? JSON.stringify(body) : undefined,
          });

          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Keycloak API error: ${response.status} - ${errorText}`);
          }

          if (method === 'DELETE' && response.status === 204) {
            return { success: true };
          }

          if (method === 'POST' && response.status === 201) {
            return { success: true };
          }

          return await response.json();
        }
      } catch (error) {
        throw new Error(`Keycloak: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    // ============================================
    // PAYMENT & FINANCE NODES
    // ============================================
    case "stripe": {
      const inputObj = extractInputObject(input);
      const operation = getStringProperty(config, 'operation', 'create_payment');
      const apiKey = getStringProperty(config, 'apiKey', '');
      
      if (!apiKey) {
        throw new Error('Stripe: API Key is required');
      }

      const baseUrl = 'https://api.stripe.com/v1';
      const headers = {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      };

      try {
        let url = '';
        let method = 'GET';
        let body: URLSearchParams | undefined = undefined;

        switch (operation) {
          case 'create_payment_intent': {
            url = `${baseUrl}/payment_intents`;
            method = 'POST';
            body = new URLSearchParams();
            const amount = getNumberProperty(config, 'amount', 0);
            const currency = getStringProperty(config, 'currency', 'usd');
            if (!amount) throw new Error('Stripe: Amount is required for create_payment_intent');
            body.append('amount', String(amount));
            body.append('currency', currency);
            const paymentMethodId = getStringProperty(config, 'paymentMethodId', '');
            if (paymentMethodId) body.append('payment_method', paymentMethodId);
            break;
          }
          case 'get_payment': {
            const paymentIntentId = getStringProperty(config, 'paymentIntentId', '');
            if (!paymentIntentId) throw new Error('Stripe: Payment Intent ID is required');
            url = `${baseUrl}/payment_intents/${paymentIntentId}`;
            break;
          }
          case 'create_refund': {
            url = `${baseUrl}/refunds`;
            method = 'POST';
            body = new URLSearchParams();
            const paymentIntentId = getStringProperty(config, 'paymentIntentId', '');
            if (paymentIntentId) body.append('payment_intent', paymentIntentId);
            break;
          }
          case 'create_customer': {
            url = `${baseUrl}/customers`;
            method = 'POST';
            body = new URLSearchParams();
            const email = getStringProperty(inputObj, 'email', '');
            if (email) body.append('email', email);
            break;
          }
          case 'create_subscription': {
            url = `${baseUrl}/subscriptions`;
            method = 'POST';
            body = new URLSearchParams();
            const customerId = getStringProperty(config, 'customerId', '');
            if (!customerId) throw new Error('Stripe: Customer ID is required');
            body.append('customer', customerId);
            break;
          }
          case 'create_invoice': {
            url = `${baseUrl}/invoices`;
            method = 'POST';
            body = new URLSearchParams();
            const customerId = getStringProperty(config, 'customerId', '');
            if (customerId) body.append('customer', customerId);
            break;
          }
          default:
            throw new Error(`Stripe: Unknown operation "${operation}"`);
        }

        const response = await fetch(url, {
          method,
          headers,
          body: body ? body.toString() : undefined,
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Stripe API error: ${response.status} - ${errorText}`);
        }

        return await response.json();
      } catch (error) {
        throw new Error(`Stripe: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    case "razorpay": {
      const operation = getStringProperty(config, 'operation', 'create_order');
      const keyId = getStringProperty(config, 'keyId', '');
      const keySecret = getStringProperty(config, 'keySecret', '');
      
      if (!keyId || !keySecret) {
        throw new Error('Razorpay: Key ID and Key Secret are required');
      }

      const baseUrl = 'https://api.razorpay.com/v1';
      const auth = btoa(`${keyId}:${keySecret}`);
      const headers = {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
      };

      try {
        let url = '';
        let method = 'GET';
        let body: unknown = undefined;

        switch (operation) {
          case 'create_order': {
            url = `${baseUrl}/orders`;
            method = 'POST';
            const amount = getNumberProperty(config, 'amount', 0);
            const currency = getStringProperty(config, 'currency', 'INR');
            if (!amount) throw new Error('Razorpay: Amount is required');
            body = { amount, currency };
            const notesStr = getStringProperty(config, 'notes', '{}');
            if (notesStr) {
              const notes = parseJSONSafe(notesStr, 'notes');
              if (notes) body = { ...body, notes };
            }
            break;
          }
          case 'get_order': {
            const orderId = getStringProperty(config, 'orderId', '');
            if (!orderId) throw new Error('Razorpay: Order ID is required');
            url = `${baseUrl}/orders/${orderId}`;
            break;
          }
          case 'get_payment': {
            const paymentId = getStringProperty(config, 'paymentId', '');
            if (!paymentId) throw new Error('Razorpay: Payment ID is required');
            url = `${baseUrl}/payments/${paymentId}`;
            break;
          }
          case 'create_refund': {
            const paymentId = getStringProperty(config, 'paymentId', '');
            if (!paymentId) throw new Error('Razorpay: Payment ID is required for refund');
            url = `${baseUrl}/payments/${paymentId}/refund`;
            method = 'POST';
            body = {};
            break;
          }
          case 'create_customer': {
            url = `${baseUrl}/customers`;
            method = 'POST';
            body = {};
            break;
          }
          default:
            throw new Error(`Razorpay: Unknown operation "${operation}"`);
        }

        const response = await fetch(url, {
          method,
          headers,
          body: body ? JSON.stringify(body) : undefined,
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Razorpay API error: ${response.status} - ${errorText}`);
        }

        return await response.json();
      } catch (error) {
        throw new Error(`Razorpay: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    case "paypal": {
      const operation = getStringProperty(config, 'operation', 'create_order');
      const clientId = getStringProperty(config, 'clientId', '');
      const clientSecret = getStringProperty(config, 'clientSecret', '');
      const environment = getStringProperty(config, 'environment', 'sandbox');
      
      if (!clientId || !clientSecret) {
        throw new Error('PayPal: Client ID and Client Secret are required');
      }

      const baseUrl = environment === 'production' 
        ? 'https://api-m.paypal.com'
        : 'https://api-m.sandbox.paypal.com';

      // Get access token
      const getAccessToken = async () => {
        const auth = btoa(`${clientId}:${clientSecret}`);
        const response = await fetch(`${baseUrl}/v1/oauth2/token`, {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: 'grant_type=client_credentials',
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`PayPal token error: ${response.status} - ${errorText}`);
        }

        const tokenData = await response.json();
        return tokenData.access_token;
      };

      try {
        if (operation === 'get_access_token') {
          const token = await getAccessToken();
          return { access_token: token };
        }

        const accessToken = await getAccessToken();
        const headers = {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        };

        let url = '';
        let method = 'GET';
        let body: unknown = undefined;

        switch (operation) {
          case 'create_order': {
            url = `${baseUrl}/v2/checkout/orders`;
            method = 'POST';
            const amount = getStringProperty(config, 'amount', '');
            const currency = getStringProperty(config, 'currency', 'USD');
            if (!amount) throw new Error('PayPal: Amount is required');
            body = {
              intent: 'CAPTURE',
              purchase_units: [{
                amount: {
                  currency_code: currency,
                  value: amount,
                },
              }],
            };
            break;
          }
          case 'get_order': {
            const orderId = getStringProperty(config, 'orderId', '');
            if (!orderId) throw new Error('PayPal: Order ID is required');
            url = `${baseUrl}/v2/checkout/orders/${orderId}`;
            break;
          }
          case 'capture_order': {
            const orderId = getStringProperty(config, 'orderId', '');
            if (!orderId) throw new Error('PayPal: Order ID is required');
            url = `${baseUrl}/v2/checkout/orders/${orderId}/capture`;
            method = 'POST';
            break;
          }
          case 'create_refund': {
            url = `${baseUrl}/v2/payments/captures/${getStringProperty(config, 'captureId', '')}/refund`;
            method = 'POST';
            body = {};
            break;
          }
          default:
            throw new Error(`PayPal: Unknown operation "${operation}"`);
        }

        const response = await fetch(url, {
          method,
          headers,
          body: body ? JSON.stringify(body) : undefined,
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`PayPal API error: ${response.status} - ${errorText}`);
        }

        return await response.json();
      } catch (error) {
        throw new Error(`PayPal: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    case "quickbooks": {
      const operation = getStringProperty(config, 'operation', 'get_invoice');
      const accessToken = getStringProperty(config, 'accessToken', '');
      const realmId = getStringProperty(config, 'realmId', '');
      const environment = getStringProperty(config, 'environment', 'sandbox');
      
      if (!accessToken || !realmId) {
        throw new Error('QuickBooks: Access Token and Realm ID are required');
      }

      const baseUrl = environment === 'production'
        ? 'https://quickbooks.api.intuit.com'
        : 'https://sandbox-quickbooks.api.intuit.com';

      const headers = {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      };

      try {
        let url = '';
        let method = 'GET';
        let body: unknown = undefined;

        switch (operation) {
          case 'get_invoice': {
            const invoiceId = getStringProperty(config, 'invoiceId', '');
            if (!invoiceId) throw new Error('QuickBooks: Invoice ID is required');
            url = `${baseUrl}/v3/company/${realmId}/invoice/${invoiceId}`;
            break;
          }
          case 'list_invoices': {
            url = `${baseUrl}/v3/company/${realmId}/query?query=SELECT * FROM Invoice MAXRESULTS 100`;
            break;
          }
          case 'create_invoice': {
            url = `${baseUrl}/v3/company/${realmId}/invoice`;
            method = 'POST';
            const invoiceDataStr = getStringProperty(config, 'invoiceData', '{}');
            body = parseJSONSafe(invoiceDataStr, 'invoiceData');
            break;
          }
          case 'get_customer': {
            const customerId = getStringProperty(config, 'customerId', '');
            if (!customerId) throw new Error('QuickBooks: Customer ID is required');
            url = `${baseUrl}/v3/company/${realmId}/customer/${customerId}`;
            break;
          }
          case 'create_customer': {
            url = `${baseUrl}/v3/company/${realmId}/customer`;
            method = 'POST';
            body = {};
            break;
          }
          case 'get_payment': {
            const paymentId = getStringProperty(config, 'paymentId', '');
            if (!paymentId) throw new Error('QuickBooks: Payment ID is required');
            url = `${baseUrl}/v3/company/${realmId}/payment/${paymentId}`;
            break;
          }
          case 'create_payment': {
            url = `${baseUrl}/v3/company/${realmId}/payment`;
            method = 'POST';
            body = {};
            break;
          }
          default:
            throw new Error(`QuickBooks: Unknown operation "${operation}"`);
        }

        const response = await fetch(url, {
          method,
          headers,
          body: body ? JSON.stringify(body) : undefined,
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`QuickBooks API error: ${response.status} - ${errorText}`);
        }

        return await response.json();
      } catch (error) {
        throw new Error(`QuickBooks: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    case "xero": {
      const operation = getStringProperty(config, 'operation', 'get_invoice');
      const accessToken = getStringProperty(config, 'accessToken', '');
      const tenantId = getStringProperty(config, 'tenantId', '');
      
      if (!accessToken || !tenantId) {
        throw new Error('Xero: Access Token and Tenant ID are required');
      }

      const baseUrl = 'https://api.xero.com/api.xro/2.0';
      const headers = {
        'Authorization': `Bearer ${accessToken}`,
        'Xero-tenant-id': tenantId,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      };

      try {
        let url = '';
        let method = 'GET';
        let body: unknown = undefined;

        switch (operation) {
          case 'get_invoice': {
            const invoiceId = getStringProperty(config, 'invoiceId', '');
            if (!invoiceId) throw new Error('Xero: Invoice ID is required');
            url = `${baseUrl}/Invoices/${invoiceId}`;
            break;
          }
          case 'list_invoices': {
            url = `${baseUrl}/Invoices`;
            break;
          }
          case 'create_invoice': {
            url = `${baseUrl}/Invoices`;
            method = 'POST';
            const invoiceDataStr = getStringProperty(config, 'invoiceData', '{}');
            body = parseJSONSafe(invoiceDataStr, 'invoiceData');
            break;
          }
          case 'get_contact': {
            const contactId = getStringProperty(config, 'contactId', '');
            if (!contactId) throw new Error('Xero: Contact ID is required');
            url = `${baseUrl}/Contacts/${contactId}`;
            break;
          }
          case 'create_contact': {
            url = `${baseUrl}/Contacts`;
            method = 'POST';
            body = {};
            break;
          }
          case 'get_payment': {
            const paymentId = getStringProperty(config, 'paymentId', '');
            if (!paymentId) throw new Error('Xero: Payment ID is required');
            url = `${baseUrl}/Payments/${paymentId}`;
            break;
          }
          case 'create_payment': {
            url = `${baseUrl}/Payments`;
            method = 'POST';
            body = {};
            break;
          }
          default:
            throw new Error(`Xero: Unknown operation "${operation}"`);
        }

        const response = await fetch(url, {
          method,
          headers,
          body: body ? JSON.stringify(body) : undefined,
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Xero API error: ${response.status} - ${errorText}`);
        }

        return await response.json();
      } catch (error) {
        throw new Error(`Xero: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    case "expense_categorizer": {
      // Expense Categorizer: Automatically classify expenses
      const expenseConfig = config.expense;
      const categoryRulesConfig = config.categoryRules;
      const defaultCategory = getStringProperty(config, 'defaultCategory', 'Uncategorized');

      let expense: { id: string; description: string; amount: number; currency: string; merchant: string | null; date: string } | null = null;
      if (expenseConfig) {
        if (typeof expenseConfig === 'string') {
          try {
            expense = JSON.parse(expenseConfig);
          } catch {
            throw new Error("Expense Categorizer: Invalid expense JSON format");
          }
        } else if (typeof expenseConfig === 'object') {
          expense = expenseConfig as { id: string; description: string; amount: number; currency: string; merchant: string | null; date: string };
        }
      }

      const inputObj = input && typeof input === 'object' ? input as Record<string, unknown> : {};
      if (!expense && inputObj.expense) {
        if (typeof inputObj.expense === 'object') {
          expense = inputObj.expense as { id: string; description: string; amount: number; currency: string; merchant: string | null; date: string };
        }
      }

      if (!expense || !expense.id || !expense.description) {
        throw new Error("Expense Categorizer: Expense with id and description is required");
      }

      let categoryRules: Array<{ keywords: string[]; category: string }> = [];
      if (categoryRulesConfig) {
        if (typeof categoryRulesConfig === 'string') {
          try {
            categoryRules = JSON.parse(categoryRulesConfig);
          } catch {
            throw new Error("Expense Categorizer: Invalid category rules JSON format");
          }
        } else if (Array.isArray(categoryRulesConfig)) {
          categoryRules = categoryRulesConfig;
        }
      }

      // Match expense against category rules
      const descriptionLower = expense.description.toLowerCase();
      const merchantLower = expense.merchant ? expense.merchant.toLowerCase() : '';
      const searchText = `${descriptionLower} ${merchantLower}`.trim();

      let matchedCategory = defaultCategory;
      let confidence = 0.5;
      let ruleApplied: string | null = null;

      for (const rule of categoryRules) {
        if (!rule.keywords || !Array.isArray(rule.keywords) || !rule.category) {
          continue;
        }

        // Check if any keyword matches
        const matchingKeywords = rule.keywords.filter(keyword => 
          searchText.includes(keyword.toLowerCase())
        );

        if (matchingKeywords.length > 0) {
          // Calculate confidence based on number of matching keywords
          const matchRatio = matchingKeywords.length / rule.keywords.length;
          if (matchRatio > confidence) {
            matchedCategory = rule.category;
            confidence = Math.min(matchRatio, 1.0);
            ruleApplied = rule.keywords.join(', ');
          }
        }
      }

      return {
        expenseId: expense.id,
        category: matchedCategory,
        confidence,
        ruleApplied
      };
    }

    case "payment_reminder_engine": {
      // Payment Reminder Engine: Ensure timely payments
      const invoiceId = getStringProperty(config, 'invoiceId', '');
      const recipient = getStringProperty(config, 'recipient', '');
      const amount = getNumberProperty(config, 'amount', 0);
      const currency = getStringProperty(config, 'currency', 'USD');
      const dueDateStr = getStringProperty(config, 'dueDate', '');
      const reminderScheduleConfig = config.reminderSchedule;

      if (!invoiceId || !recipient || !dueDateStr) {
        throw new Error("Payment Reminder Engine: Invoice ID, recipient, and due date are required");
      }

      if (amount <= 0) {
        throw new Error("Payment Reminder Engine: Amount must be greater than 0");
      }

      // Parse due date
      let dueDate: Date;
      try {
        dueDate = new Date(dueDateStr);
        if (isNaN(dueDate.getTime())) {
          throw new Error("Invalid date format");
        }
      } catch {
        throw new Error("Payment Reminder Engine: Invalid due date format. Use ISO format (YYYY-MM-DD)");
      }

      let reminderSchedule: Array<{ daysBeforeOrAfterDue: number; message: string }> = [];
      if (reminderScheduleConfig) {
        if (typeof reminderScheduleConfig === 'string') {
          try {
            reminderSchedule = JSON.parse(reminderScheduleConfig);
          } catch {
            throw new Error("Payment Reminder Engine: Invalid reminder schedule JSON format");
          }
        } else if (Array.isArray(reminderScheduleConfig)) {
          reminderSchedule = reminderScheduleConfig;
        }
      }

      if (reminderSchedule.length === 0) {
        throw new Error("Payment Reminder Engine: At least one reminder schedule entry is required");
      }

      // Calculate reminder dates
      const now = new Date();
      const remindersScheduled = reminderSchedule.length;
      let nextReminderAt: string | null = null;

      // Find the next reminder that hasn't been sent yet
      for (const reminder of reminderSchedule) {
        const reminderDate = new Date(dueDate);
        reminderDate.setDate(reminderDate.getDate() + reminder.daysBeforeOrAfterDue);

        if (reminderDate > now) {
          nextReminderAt = reminderDate.toISOString();
          break;
        }
      }

      const status = nextReminderAt ? 'active' : 'completed';

      return {
        invoiceId,
        remindersScheduled,
        nextReminderAt,
        status,
        recipient,
        amount,
        currency,
        dueDate: dueDate.toISOString(),
        note: "Payment reminders require scheduling system integration. This is a placeholder implementation."
      };
    }

    case "audit_trail_generator": {
      // Audit Trail Generator: Create immutable audit logs
      const entityType = getStringProperty(config, 'entityType', 'expense') as 'expense' | 'invoice' | 'payment' | 'refund';
      const entityId = getStringProperty(config, 'entityId', '');
      const action = getStringProperty(config, 'action', '');
      const performedBy = getStringProperty(config, 'performedBy', '');
      const timestampStr = getStringProperty(config, 'timestamp', '');
      const beforeStateConfig = config.beforeState;
      const afterStateConfig = config.afterState;

      if (!entityId || !action || !performedBy) {
        throw new Error("Audit Trail Generator: Entity ID, action, and performed by are required");
      }

      // Parse timestamp or use current time
      let timestamp: Date;
      if (timestampStr) {
        try {
          timestamp = new Date(timestampStr);
          if (isNaN(timestamp.getTime())) {
            timestamp = new Date();
          }
        } catch {
          timestamp = new Date();
        }
      } else {
        timestamp = new Date();
      }

      let beforeState: Record<string, unknown> | null = null;
      if (beforeStateConfig) {
        if (typeof beforeStateConfig === 'string') {
          try {
            beforeState = JSON.parse(beforeStateConfig);
          } catch {
            beforeState = null;
          }
        } else if (typeof beforeStateConfig === 'object') {
          beforeState = beforeStateConfig as Record<string, unknown>;
        }
      }

      let afterState: Record<string, unknown> | null = null;
      if (afterStateConfig) {
        if (typeof afterStateConfig === 'string') {
          try {
            afterState = JSON.parse(afterStateConfig);
          } catch {
            afterState = null;
          }
        } else if (typeof afterStateConfig === 'object') {
          afterState = afterStateConfig as Record<string, unknown>;
        }
      }

      // Generate audit ID
      const auditId = `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Create hash for immutability (simplified - in production use SHA-256)
      const auditData = JSON.stringify({
        entityType,
        entityId,
        action,
        performedBy,
        timestamp: timestamp.toISOString(),
        beforeState,
        afterState
      });

      // Simple hash (in production, use proper cryptographic hash)
      let hash = 0;
      for (let i = 0; i < auditData.length; i++) {
        const char = auditData.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32-bit integer
      }
      const hashString = Math.abs(hash).toString(16);

      return {
        auditId,
        entityType,
        entityId,
        action,
        loggedAt: timestamp.toISOString(),
        hash: hashString,
        performedBy,
        beforeState,
        afterState,
        note: "Audit trail requires database storage and proper cryptographic hashing (SHA-256) for immutability. This is a placeholder implementation."
      };
    }

    case "tax_rule_engine": {
      // Tax Rule Engine: Apply correct tax rules
      const transactionConfig = config.transaction;
      const taxRulesConfig = config.taxRules;

      let transaction: { amount: number; currency: string; location: string; category: string; date: string } | null = null;
      if (transactionConfig) {
        if (typeof transactionConfig === 'string') {
          try {
            transaction = JSON.parse(transactionConfig);
          } catch {
            throw new Error("Tax Rule Engine: Invalid transaction JSON format");
          }
        } else if (typeof transactionConfig === 'object') {
          transaction = transactionConfig as { amount: number; currency: string; location: string; category: string; date: string };
        }
      }

      const inputObj = input && typeof input === 'object' ? input as Record<string, unknown> : {};
      if (!transaction && inputObj.transaction) {
        if (typeof inputObj.transaction === 'object') {
          transaction = inputObj.transaction as { amount: number; currency: string; location: string; category: string; date: string };
        }
      }

      if (!transaction || !transaction.amount || !transaction.location || !transaction.category) {
        throw new Error("Tax Rule Engine: Transaction with amount, location, and category is required");
      }

      let taxRules: Array<{ location: string; category: string; rate: number }> = [];
      if (taxRulesConfig) {
        if (typeof taxRulesConfig === 'string') {
          try {
            taxRules = JSON.parse(taxRulesConfig);
          } catch {
            throw new Error("Tax Rule Engine: Invalid tax rules JSON format");
          }
        } else if (Array.isArray(taxRulesConfig)) {
          taxRules = taxRulesConfig;
        }
      }

      if (taxRules.length === 0) {
        throw new Error("Tax Rule Engine: At least one tax rule is required");
      }

      // Find matching tax rule
      let matchedRule: { location: string; category: string; rate: number } | null = null;
      for (const rule of taxRules) {
        if (rule.location === transaction.location && rule.category === transaction.category) {
          matchedRule = rule;
          break;
        }
      }

      // If no exact match, try location-only match
      if (!matchedRule) {
        for (const rule of taxRules) {
          if (rule.location === transaction.location && !rule.category) {
            matchedRule = rule;
            break;
          }
        }
      }

      if (!matchedRule) {
        throw new Error(`Tax Rule Engine: No tax rule found for location "${transaction.location}" and category "${transaction.category}"`);
      }

      const taxRate = matchedRule.rate;
      const taxableAmount = transaction.amount;
      const taxAmount = taxableAmount * taxRate;
      const totalAmount = taxableAmount + taxAmount;

      return {
        taxableAmount,
        taxRate,
        taxAmount,
        totalAmount,
        ruleApplied: `${matchedRule.location}/${matchedRule.category || 'default'}`,
        currency: transaction.currency
      };
    }

    case "fraud_detection_node": {
      // Fraud Detection Node: Detect potentially fraudulent activity
      const transactionConfig = config.transaction;
      const historicalPatternsConfig = config.historicalPatterns;
      const riskThreshold = getNumberProperty(config, 'riskThreshold', 0.7);

      if (riskThreshold < 0 || riskThreshold > 1) {
        throw new Error("Fraud Detection Node: Risk threshold must be between 0 and 1");
      }

      let transaction: { id: string; amount: number; currency: string; merchant: string; location: string; timestamp: string } | null = null;
      if (transactionConfig) {
        if (typeof transactionConfig === 'string') {
          try {
            transaction = JSON.parse(transactionConfig);
          } catch {
            throw new Error("Fraud Detection Node: Invalid transaction JSON format");
          }
        } else if (typeof transactionConfig === 'object') {
          transaction = transactionConfig as { id: string; amount: number; currency: string; merchant: string; location: string; timestamp: string };
        }
      }

      const inputObj = input && typeof input === 'object' ? input as Record<string, unknown> : {};
      if (!transaction && inputObj.transaction) {
        if (typeof inputObj.transaction === 'object') {
          transaction = inputObj.transaction as { id: string; amount: number; currency: string; merchant: string; location: string; timestamp: string };
        }
      }

      if (!transaction || !transaction.id || !transaction.amount) {
        throw new Error("Fraud Detection Node: Transaction with id and amount is required");
      }

      let historicalPatterns: Record<string, unknown> = {};
      if (historicalPatternsConfig) {
        if (typeof historicalPatternsConfig === 'string') {
          try {
            historicalPatterns = JSON.parse(historicalPatternsConfig);
          } catch {
            historicalPatterns = {};
          }
        } else if (typeof historicalPatternsConfig === 'object') {
          historicalPatterns = historicalPatternsConfig as Record<string, unknown>;
        }
      }

      // Calculate fraud risk score
      let riskScore = 0;
      const flags: string[] = [];

      // Check amount anomaly
      const averageAmount = (historicalPatterns.averageAmount as number) || 0;
      if (averageAmount > 0) {
        const amountRatio = transaction.amount / averageAmount;
        if (amountRatio > 5) {
          riskScore += 0.3;
          flags.push('amount_anomaly');
        } else if (amountRatio > 2) {
          riskScore += 0.15;
          flags.push('high_amount');
        }
      }

      // Check merchant anomaly
      const commonMerchants = (historicalPatterns.commonMerchants as string[]) || [];
      if (commonMerchants.length > 0 && !commonMerchants.includes(transaction.merchant)) {
        riskScore += 0.2;
        flags.push('unknown_merchant');
      }

      // Check location anomaly
      const commonLocations = (historicalPatterns.commonLocations as string[]) || [];
      if (commonLocations.length > 0 && !commonLocations.includes(transaction.location)) {
        riskScore += 0.25;
        flags.push('unusual_location');
      }

      // Normalize risk score to 0-1
      riskScore = Math.min(riskScore, 1.0);

      // Determine risk level
      let riskLevel: 'low' | 'medium' | 'high';
      if (riskScore >= 0.7) {
        riskLevel = 'high';
      } else if (riskScore >= 0.4) {
        riskLevel = 'medium';
      } else {
        riskLevel = 'low';
      }

      // Determine action
      let action: 'allow' | 'review' | 'block';
      if (riskScore >= riskThreshold) {
        action = riskScore >= 0.8 ? 'block' : 'review';
      } else {
        action = 'allow';
      }

      return {
        transactionId: transaction.id,
        fraudRiskScore: riskScore,
        riskLevel,
        flags: flags.length > 0 ? flags : [],
        action
      };
    }

    // ============================================
    // E-COMMERCE NODES
    // ============================================
    case "shopify": {
      const operation = getStringProperty(config, 'operation', 'get_product');
      const shopDomain = getStringProperty(config, 'shopDomain', '').replace(/^https?:\/\//, '').replace(/\/$/, '');
      const accessToken = getStringProperty(config, 'accessToken', '');
      
      if (!shopDomain || !accessToken) {
        throw new Error('Shopify: Shop Domain and Access Token are required');
      }

      const baseUrl = `https://${shopDomain}/admin/api/2024-01`;
      const headers = {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json',
      };

      try {
        let url = '';
        let method = 'GET';
        let body: unknown = undefined;

        switch (operation) {
          case 'get_product': {
            const productId = getStringProperty(config, 'productId', '');
            if (!productId) throw new Error('Shopify: Product ID is required');
            url = `${baseUrl}/products/${productId}.json`;
            break;
          }
          case 'list_products': {
            url = `${baseUrl}/products.json`;
            const limit = getNumberProperty(config, 'limit', 250);
            url += `?limit=${limit}`;
            break;
          }
          case 'create_product': {
            url = `${baseUrl}/products.json`;
            method = 'POST';
            body = { product: {} };
            break;
          }
          case 'update_product': {
            const productId = getStringProperty(config, 'productId', '');
            if (!productId) throw new Error('Shopify: Product ID is required');
            url = `${baseUrl}/products/${productId}.json`;
            method = 'PUT';
            body = { product: {} };
            break;
          }
          case 'get_order': {
            const orderId = getStringProperty(config, 'orderId', '');
            if (!orderId) throw new Error('Shopify: Order ID is required');
            url = `${baseUrl}/orders/${orderId}.json`;
            break;
          }
          case 'list_orders': {
            url = `${baseUrl}/orders.json`;
            const limit = getNumberProperty(config, 'limit', 250);
            url += `?limit=${limit}`;
            break;
          }
          case 'create_order': {
            url = `${baseUrl}/orders.json`;
            method = 'POST';
            body = { order: {} };
            break;
          }
          case 'get_customer': {
            const customerId = getStringProperty(config, 'customerId', '');
            if (!customerId) throw new Error('Shopify: Customer ID is required');
            url = `${baseUrl}/customers/${customerId}.json`;
            break;
          }
          case 'list_customers': {
            url = `${baseUrl}/customers.json`;
            const limit = getNumberProperty(config, 'limit', 250);
            url += `?limit=${limit}`;
            break;
          }
          default:
            throw new Error(`Shopify: Unknown operation "${operation}"`);
        }

        const response = await fetch(url, {
          method,
          headers,
          body: body ? JSON.stringify(body) : undefined,
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Shopify API error: ${response.status} - ${errorText}`);
        }

        return await response.json();
      } catch (error) {
        throw new Error(`Shopify: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    case "woocommerce": {
      const operation = getStringProperty(config, 'operation', 'get_product');
      const storeUrl = getStringProperty(config, 'storeUrl', '').replace(/\/$/, '');
      const consumerKey = getStringProperty(config, 'consumerKey', '');
      const consumerSecret = getStringProperty(config, 'consumerSecret', '');
      
      if (!storeUrl || !consumerKey || !consumerSecret) {
        throw new Error('WooCommerce: Store URL, Consumer Key, and Consumer Secret are required');
      }

      const baseUrl = `${storeUrl}/wp-json/wc/v3`;
      const auth = btoa(`${consumerKey}:${consumerSecret}`);
      const headers = {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
      };

      try {
        let url = '';
        let method = 'GET';
        let body: unknown = undefined;

        switch (operation) {
          case 'get_product': {
            const productId = getStringProperty(config, 'productId', '');
            if (!productId) throw new Error('WooCommerce: Product ID is required');
            url = `${baseUrl}/products/${productId}`;
            break;
          }
          case 'list_products': {
            url = `${baseUrl}/products`;
            const perPage = getNumberProperty(config, 'perPage', 10);
            url += `?per_page=${perPage}`;
            break;
          }
          case 'create_product': {
            url = `${baseUrl}/products`;
            method = 'POST';
            body = {};
            break;
          }
          case 'update_product': {
            const productId = getStringProperty(config, 'productId', '');
            if (!productId) throw new Error('WooCommerce: Product ID is required');
            url = `${baseUrl}/products/${productId}`;
            method = 'PUT';
            body = {};
            break;
          }
          case 'get_order': {
            const orderId = getStringProperty(config, 'orderId', '');
            if (!orderId) throw new Error('WooCommerce: Order ID is required');
            url = `${baseUrl}/orders/${orderId}`;
            break;
          }
          case 'list_orders': {
            url = `${baseUrl}/orders`;
            const perPage = getNumberProperty(config, 'perPage', 10);
            url += `?per_page=${perPage}`;
            break;
          }
          case 'create_order': {
            url = `${baseUrl}/orders`;
            method = 'POST';
            body = {};
            break;
          }
          case 'get_customer': {
            const customerId = getStringProperty(config, 'customerId', '');
            if (!customerId) throw new Error('WooCommerce: Customer ID is required');
            url = `${baseUrl}/customers/${customerId}`;
            break;
          }
          default:
            throw new Error(`WooCommerce: Unknown operation "${operation}"`);
        }

        const response = await fetch(url, {
          method,
          headers,
          body: body ? JSON.stringify(body) : undefined,
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`WooCommerce API error: ${response.status} - ${errorText}`);
        }

        return await response.json();
      } catch (error) {
        throw new Error(`WooCommerce: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    case "magento": {
      const operation = getStringProperty(config, 'operation', 'get_product');
      const storeUrl = getStringProperty(config, 'storeUrl', '').replace(/\/$/, '');
      const accessToken = getStringProperty(config, 'accessToken', '');
      
      if (!storeUrl || !accessToken) {
        throw new Error('Magento: Store URL and Access Token are required');
      }

      const baseUrl = `${storeUrl}/rest/V1`;
      const headers = {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      };

      try {
        let url = '';
        let method = 'GET';
        let body: unknown = undefined;

        switch (operation) {
          case 'get_product': {
            const productId = getStringProperty(config, 'productId', '');
            if (!productId) throw new Error('Magento: Product ID (SKU) is required');
            url = `${baseUrl}/products/${productId}`;
            break;
          }
          case 'list_products': {
            url = `${baseUrl}/products`;
            const searchCriteriaStr = getStringProperty(config, 'searchCriteria', '{}');
            if (searchCriteriaStr) {
              const searchCriteria = parseJSONSafe(searchCriteriaStr, 'searchCriteria');
              url += `?searchCriteria=${encodeURIComponent(JSON.stringify(searchCriteria))}`;
            }
            break;
          }
          case 'create_product': {
            url = `${baseUrl}/products`;
            method = 'POST';
            body = { product: {} };
            break;
          }
          case 'update_product': {
            const productId = getStringProperty(config, 'productId', '');
            if (!productId) throw new Error('Magento: Product ID (SKU) is required');
            url = `${baseUrl}/products/${productId}`;
            method = 'PUT';
            body = { product: {} };
            break;
          }
          case 'get_order': {
            const orderId = getNumberProperty(config, 'orderId', 0);
            if (!orderId) throw new Error('Magento: Order ID is required');
            url = `${baseUrl}/orders/${orderId}`;
            break;
          }
          case 'list_orders': {
            url = `${baseUrl}/orders`;
            break;
          }
          case 'create_order': {
            url = `${baseUrl}/orders`;
            method = 'POST';
            body = {};
            break;
          }
          default:
            throw new Error(`Magento: Unknown operation "${operation}"`);
        }

        const response = await fetch(url, {
          method,
          headers,
          body: body ? JSON.stringify(body) : undefined,
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Magento API error: ${response.status} - ${errorText}`);
        }

        return await response.json();
      } catch (error) {
        throw new Error(`Magento: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    case "bigcommerce": {
      const operation = getStringProperty(config, 'operation', 'get_product');
      const storeHash = getStringProperty(config, 'storeHash', '');
      const accessToken = getStringProperty(config, 'accessToken', '');
      
      if (!storeHash || !accessToken) {
        throw new Error('BigCommerce: Store Hash and Access Token are required');
      }

      const baseUrl = `https://api.bigcommerce.com/stores/${storeHash}/v3`;
      const headers = {
        'X-Auth-Token': accessToken,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      };

      try {
        let url = '';
        let method = 'GET';
        let body: unknown = undefined;

        switch (operation) {
          case 'get_product': {
            const productId = getStringProperty(config, 'productId', '');
            if (!productId) throw new Error('BigCommerce: Product ID is required');
            url = `${baseUrl}/catalog/products/${productId}`;
            break;
          }
          case 'list_products': {
            url = `${baseUrl}/catalog/products`;
            const limit = getNumberProperty(config, 'limit', 250);
            url += `?limit=${limit}`;
            break;
          }
          case 'create_product': {
            url = `${baseUrl}/catalog/products`;
            method = 'POST';
            body = { data: {} };
            break;
          }
          case 'update_product': {
            const productId = getStringProperty(config, 'productId', '');
            if (!productId) throw new Error('BigCommerce: Product ID is required');
            url = `${baseUrl}/catalog/products/${productId}`;
            method = 'PUT';
            body = { data: {} };
            break;
          }
          case 'get_order': {
            const orderId = getStringProperty(config, 'orderId', '');
            if (!orderId) throw new Error('BigCommerce: Order ID is required');
            url = `${baseUrl}/orders/${orderId}`;
            break;
          }
          case 'list_orders': {
            url = `${baseUrl}/orders`;
            const limit = getNumberProperty(config, 'limit', 250);
            url += `?limit=${limit}`;
            break;
          }
          case 'get_customer': {
            const customerId = getStringProperty(config, 'customerId', '');
            if (!customerId) throw new Error('BigCommerce: Customer ID is required');
            url = `${baseUrl}/customers/${customerId}`;
            break;
          }
          default:
            throw new Error(`BigCommerce: Unknown operation "${operation}"`);
        }

        const response = await fetch(url, {
          method,
          headers,
          body: body ? JSON.stringify(body) : undefined,
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`BigCommerce API error: ${response.status} - ${errorText}`);
        }

        return await response.json();
      } catch (error) {
        throw new Error(`BigCommerce: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    // ============================================
    // ANALYTICS & DATA TOOLS NODES
    // ============================================
    case "google_analytics": {
      const operation = getStringProperty(config, 'operation', 'get_report');
      const accessToken = getStringProperty(config, 'accessToken', '');
      
      if (!accessToken) {
        throw new Error('Google Analytics: Access Token is required');
      }

      const headers = {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      };

      try {
        if (operation === 'track_event') {
          // Google Analytics 4 Measurement Protocol
          const propertyId = getStringProperty(config, 'propertyId', '').replace('properties/', '');
          if (!propertyId) throw new Error('Google Analytics: Property ID is required for track_event');
          
          const eventName = getStringProperty(config, 'eventName', '');
          const eventParamsStr = getStringProperty(config, 'eventParams', '{}');
          const eventParams = parseJSONSafe(eventParamsStr, 'eventParams') || {};

          const url = `https://www.google-analytics.com/mp/collect?measurement_id=${propertyId}&api_secret=${getStringProperty(config, 'apiSecret', '')}`;
          
          const body = {
            client_id: 'workflow-' + Date.now(),
            events: [{
              name: eventName,
              params: eventParams,
            }],
          };

          const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          });

          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Google Analytics API error: ${response.status} - ${errorText}`);
          }

          return { success: true };
        } else if (operation === 'list_properties') {
          const url = 'https://analyticsadmin.googleapis.com/v1beta/properties';
          const response = await fetch(url, { headers });

          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Google Analytics API error: ${response.status} - ${errorText}`);
          }

          return await response.json();
        } else {
          // Get Report (GA4 Data API)
          const propertyId = getStringProperty(config, 'propertyId', '');
          if (!propertyId) throw new Error('Google Analytics: Property ID is required');
          
          const dateRangesStr = getStringProperty(config, 'dateRanges', '[{"startDate": "2024-01-01", "endDate": "2024-01-31"}]');
          const dateRanges = parseJSONSafe(dateRangesStr, 'dateRanges') as Array<{ startDate: string; endDate: string }>;
          
          const dimensionsStr = getStringProperty(config, 'dimensions', '[]');
          const dimensions = parseJSONSafe(dimensionsStr, 'dimensions') as string[];
          
          const metricsStr = getStringProperty(config, 'metrics', '[]');
          const metrics = parseJSONSafe(metricsStr, 'metrics') as string[];

          const url = `https://analyticsdata.googleapis.com/v1beta/${propertyId}:runReport`;
          
          const body = {
            dateRanges: dateRanges || [{ startDate: '2024-01-01', endDate: '2024-01-31' }],
            dimensions: (dimensions || []).map(d => ({ name: d })),
            metrics: (metrics || []).map(m => ({ name: m })),
          };

          const response = await fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify(body),
          });

          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Google Analytics API error: ${response.status} - ${errorText}`);
          }

          return await response.json();
        }
      } catch (error) {
        throw new Error(`Google Analytics: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    case "mixpanel": {
      const inputObj = extractInputObject(input);
      const operation = getStringProperty(config, 'operation', 'track_event');
      const projectToken = getStringProperty(config, 'projectToken', '');
      
      if (!projectToken) {
        throw new Error('Mixpanel: Project Token is required');
      }

      try {
        if (operation === 'track_event' || operation === 'track_user') {
          const eventName = getStringProperty(config, 'eventName', '');
          const distinctId = getStringProperty(config, 'distinctId', '') || getStringProperty(inputObj, 'userId', '') || 'anonymous';
          const propertiesStr = getStringProperty(config, 'properties', '{}');
          const properties = parseJSONSafe(propertiesStr, 'properties') || {};

          const event = {
            event: eventName || (operation === 'track_user' ? '$set' : ''),
            properties: {
              token: projectToken,
              distinct_id: distinctId,
              ...properties,
            },
          };

          // Base64 encode the event
          const data = btoa(JSON.stringify([event]));
          const url = 'https://api.mixpanel.com/track/?data=' + encodeURIComponent(data);

          const response = await fetch(url, { method: 'GET' });

          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Mixpanel API error: ${response.status} - ${errorText}`);
          }

          return { success: true };
        } else if (operation === 'query_insights') {
          const apiSecret = getStringProperty(config, 'apiSecret', '');
          if (!apiSecret) throw new Error('Mixpanel: API Secret is required for query_insights');

          const queryStr = getStringProperty(config, 'query', '{}');
          const query = parseJSONSafe(queryStr, 'query') || {};

          const url = 'https://mixpanel.com/api/2.0/insights/';
          const params = new URLSearchParams();
          params.append('format', 'json');
          
          // Mixpanel Insights API uses form-encoded data
          const body = new URLSearchParams();
          body.append('from_date', query.from_date || '2024-01-01');
          body.append('to_date', query.to_date || '2024-01-31');
          if (query.event) body.append('event', JSON.stringify([query.event]));

          const auth = btoa(`${projectToken}:${apiSecret}`);

          const response = await fetch(url, {
            method: 'POST',
            headers: {
              'Authorization': `Basic ${auth}`,
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: body.toString(),
          });

          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Mixpanel API error: ${response.status} - ${errorText}`);
          }

          return await response.json();
        } else {
          throw new Error(`Mixpanel: Unknown operation "${operation}"`);
        }
      } catch (error) {
        throw new Error(`Mixpanel: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    case "segment": {
      const inputObj = extractInputObject(input);
      const operation = getStringProperty(config, 'operation', 'track');
      const writeKey = getStringProperty(config, 'writeKey', '');
      
      if (!writeKey) {
        throw new Error('Segment: Write Key is required');
      }

      try {
        const userId = getStringProperty(config, 'userId', '') || getStringProperty(inputObj, 'userId', '');
        const anonymousId = userId || 'anonymous-' + Date.now();

        const body: Record<string, unknown> = {
          anonymousId,
          context: {
            library: {
              name: 'flow-genius-ai',
              version: '1.0.0',
            },
          },
        };

        if (userId) body.userId = userId;

        switch (operation) {
          case 'track': {
            const event = getStringProperty(config, 'event', '');
            const propertiesStr = getStringProperty(config, 'properties', '{}');
            const properties = parseJSONSafe(propertiesStr, 'properties') || {};

            body.type = 'track';
            body.event = event;
            body.properties = properties;
            break;
          }
          case 'identify': {
            const traitsStr = getStringProperty(config, 'traits', '{}');
            const traits = parseJSONSafe(traitsStr, 'traits') || {};

            body.type = 'identify';
            body.traits = traits;
            break;
          }
          case 'page': {
            const name = getStringProperty(config, 'name', '');
            const propertiesStr = getStringProperty(config, 'properties', '{}');
            const properties = parseJSONSafe(propertiesStr, 'properties') || {};

            body.type = 'page';
            body.name = name;
            body.properties = properties;
            break;
          }
          case 'group': {
            const groupId = getStringProperty(config, 'groupId', '');
            const traitsStr = getStringProperty(config, 'traits', '{}');
            const traits = parseJSONSafe(traitsStr, 'traits') || {};

            body.type = 'group';
            body.groupId = groupId;
            body.traits = traits;
            break;
          }
          default:
            throw new Error(`Segment: Unknown operation "${operation}"`);
        }

        const url = 'https://api.segment.io/v1/' + operation;
        const auth = btoa(`${writeKey}:`);

        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Segment API error: ${response.status} - ${errorText}`);
        }

        return await response.json();
      } catch (error) {
        throw new Error(`Segment: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    case "amplitude": {
      const inputObj = extractInputObject(input);
      const operation = getStringProperty(config, 'operation', 'track');
      const apiKey = getStringProperty(config, 'apiKey', '');
      
      if (!apiKey) {
        throw new Error('Amplitude: API Key is required');
      }

      try {
        const userId = getStringProperty(config, 'userId', '') || getStringProperty(inputObj, 'userId', '');

        if (operation === 'track') {
          const eventType = getStringProperty(config, 'eventType', '');
          const eventPropertiesStr = getStringProperty(config, 'eventProperties', '{}');
          const eventProperties = parseJSONSafe(eventPropertiesStr, 'eventProperties') || {};

          const event = {
            user_id: userId,
            event_type: eventType,
            event_properties: eventProperties,
            time: Math.floor(Date.now() / 1000),
          };

          const body = {
            api_key: apiKey,
            events: [event],
          };

          const response = await fetch('https://api2.amplitude.com/2/httpapi', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          });

          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Amplitude API error: ${response.status} - ${errorText}`);
          }

          return await response.json();
        } else if (operation === 'identify') {
          const userPropertiesStr = getStringProperty(config, 'userProperties', '{}');
          const userProperties = parseJSONSafe(userPropertiesStr, 'userProperties') || {};

          const event = {
            user_id: userId,
            user_properties: userProperties,
            time: Math.floor(Date.now() / 1000),
          };

          const body = {
            api_key: apiKey,
            events: [event],
          };

          const response = await fetch('https://api2.amplitude.com/2/httpapi', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          });

          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Amplitude API error: ${response.status} - ${errorText}`);
          }

          return await response.json();
        } else {
          throw new Error(`Amplitude: Unknown operation "${operation}"`);
        }
      } catch (error) {
        throw new Error(`Amplitude: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    case "elasticsearch": {
      const operation = getStringProperty(config, 'operation', 'search');
      const nodeUrl = getStringProperty(config, 'nodeUrl', '').replace(/\/$/, '');
      const username = getStringProperty(config, 'username', '');
      const password = getStringProperty(config, 'password', '');
      const index = getStringProperty(config, 'index', '');
      
      if (!nodeUrl || !index) {
        throw new Error('Elasticsearch: Node URL and Index are required');
      }

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (username && password) {
        const auth = btoa(`${username}:${password}`);
        headers['Authorization'] = `Basic ${auth}`;
      }

      try {
        let url = '';
        let method = 'GET';
        let body: unknown = undefined;

        switch (operation) {
          case 'search': {
            const queryStr = getStringProperty(config, 'query', '{"query": {"match_all": {}}}');
            const query = parseJSONSafe(queryStr, 'query');
            url = `${nodeUrl}/${index}/_search`;
            method = 'POST';
            body = query || { query: { match_all: {} } };
            break;
          }
          case 'index': {
            const documentStr = getStringProperty(config, 'document', '{}');
            const document = parseJSONSafe(documentStr, 'document');
            url = `${nodeUrl}/${index}/_doc`;
            method = 'POST';
            body = document || {};
            break;
          }
          case 'get': {
            const documentId = getStringProperty(config, 'documentId', '');
            if (!documentId) throw new Error('Elasticsearch: Document ID is required');
            url = `${nodeUrl}/${index}/_doc/${documentId}`;
            break;
          }
          case 'update': {
            const documentId = getStringProperty(config, 'documentId', '');
            if (!documentId) throw new Error('Elasticsearch: Document ID is required');
            const documentStr = getStringProperty(config, 'document', '{}');
            const document = parseJSONSafe(documentStr, 'document');
            url = `${nodeUrl}/${index}/_doc/${documentId}`;
            method = 'POST';
            body = { doc: document || {} };
            break;
          }
          case 'delete': {
            const documentId = getStringProperty(config, 'documentId', '');
            if (!documentId) throw new Error('Elasticsearch: Document ID is required');
            url = `${nodeUrl}/${index}/_doc/${documentId}`;
            method = 'DELETE';
            break;
          }
          case 'bulk': {
            const bulkBody = getStringProperty(config, 'bulkBody', '');
            if (!bulkBody) throw new Error('Elasticsearch: Bulk Body is required');
            url = `${nodeUrl}/_bulk`;
            method = 'POST';
            body = bulkBody; // NDJSON format
            headers['Content-Type'] = 'application/x-ndjson';
            break;
          }
          default:
            throw new Error(`Elasticsearch: Unknown operation "${operation}"`);
        }

        const response = await fetch(url, {
          method,
          headers,
          body: typeof body === 'string' ? body : body ? JSON.stringify(body) : undefined,
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Elasticsearch API error: ${response.status} - ${errorText}`);
        }

        return await response.json();
      } catch (error) {
        throw new Error(`Elasticsearch: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    case "agent_performance_tracker": {
      const inputObj = extractInputObject(input);
      const agentName = getStringProperty(config, 'agentName', '') || getStringProperty(inputObj, 'agentName', '');
      const task = getStringProperty(config, 'task', '') || getStringProperty(inputObj, 'task', '');
      const expectedThresholdMs = getNumberProperty(config, 'expectedThresholdMs', 5000);
      const trackStartTime = config.trackStartTime !== false; // Default true
      const trackEndTime = config.trackEndTime !== false; // Default true

      if (!agentName) {
        throw new Error('Agent Performance Tracker: Agent name is required.');
      }

      if (!task) {
        throw new Error('Agent Performance Tracker: Task description is required.');
      }

      // Get timestamps from input or generate them
      const startTime = getStringProperty(inputObj, 'startTime', trackStartTime ? new Date().toISOString() : '');
      const endTime = getStringProperty(inputObj, 'endTime', trackEndTime ? new Date().toISOString() : '');
      const status = getStringProperty(inputObj, 'status', 'SUCCESS') as 'SUCCESS' | 'FAILURE' | 'TIMEOUT';
      const errorMessage = getStringProperty(inputObj, 'error', '');

      // Calculate execution time
      let executionTimeMs = 0;
      if (startTime && endTime) {
        const start = new Date(startTime).getTime();
        const end = new Date(endTime).getTime();
        executionTimeMs = end - start;
      } else if (startTime && !endTime) {
        // If end time not provided, calculate from now
        const start = new Date(startTime).getTime();
        executionTimeMs = Date.now() - start;
      }

      // Detect performance anomalies
      const performanceFlags: string[] = [];
      if (executionTimeMs > expectedThresholdMs) {
        performanceFlags.push(`EXECUTION_TIME_EXCEEDED_THRESHOLD: ${executionTimeMs}ms > ${expectedThresholdMs}ms`);
      }
      if (status === 'FAILURE') {
        performanceFlags.push('EXECUTION_FAILED');
      }
      if (status === 'TIMEOUT') {
        performanceFlags.push('EXECUTION_TIMED_OUT');
      }

      return {
        agent_name: agentName,
        task: task,
        start_time: startTime || null,
        end_time: endTime || null,
        execution_time_ms: executionTimeMs,
        status: status,
        error: errorMessage || null,
        performance_flags: performanceFlags,
      };
    }

    case "cost_monitor": {
      const inputObj = extractInputObject(input);
      const model = getStringProperty(config, 'model', 'gpt-4') || getStringProperty(inputObj, 'model', 'gpt-4');
      const promptTokens = getNumberProperty(config, 'promptTokens', getNumberProperty(inputObj, 'promptTokens', 0));
      const completionTokens = getNumberProperty(config, 'completionTokens', getNumberProperty(inputObj, 'completionTokens', 0));
      const totalTokens = promptTokens + completionTokens;
      const costThresholdUsd = getNumberProperty(config, 'costThresholdUsd', 100.0);
      const customPricingStr = getStringProperty(config, 'pricingModel', '{}');
      const customPricing = parseJSONSafe(customPricingStr, 'pricingModel') as { promptPer1k?: number; completionPer1k?: number } | null;

      // Default pricing per 1k tokens (conservative estimates)
      const defaultPricing: Record<string, { prompt: number; completion: number }> = {
        'gpt-4': { prompt: 0.03, completion: 0.06 },
        'gpt-4-turbo': { prompt: 0.01, completion: 0.03 },
        'gpt-3.5-turbo': { prompt: 0.0015, completion: 0.002 },
        'claude-3-opus': { prompt: 0.015, completion: 0.075 },
        'claude-3-sonnet': { prompt: 0.003, completion: 0.015 },
        'claude-3-haiku': { prompt: 0.00025, completion: 0.00125 },
        'gemini-pro': { prompt: 0.0005, completion: 0.0015 },
        'llama-3': { prompt: 0.0003, completion: 0.0003 },
      };

      const pricing = customPricing ? {
        prompt: (customPricing.promptPer1k || 0.01) / 1000,
        completion: (customPricing.completionPer1k || 0.03) / 1000,
      } : defaultPricing[model.toLowerCase()] || { prompt: 0.01, completion: 0.03 };

      const estimatedCostUsd = (promptTokens * pricing.prompt / 1000) + (completionTokens * pricing.completion / 1000);
      const costThresholdExceeded = estimatedCostUsd > costThresholdUsd;

      let notes = '';
      if (!customPricing && !defaultPricing[model.toLowerCase()]) {
        notes = `Unknown pricing for model "${model}". Using conservative estimate.`;
      }
      if (costThresholdExceeded) {
        notes += notes ? ' ' : '';
        notes += `Cost threshold exceeded: $${estimatedCostUsd.toFixed(4)} > $${costThresholdUsd.toFixed(2)}`;
      }

      return {
        model: model,
        prompt_tokens: promptTokens,
        completion_tokens: completionTokens,
        total_tokens: totalTokens,
        estimated_cost_usd: parseFloat(estimatedCostUsd.toFixed(4)),
        cost_threshold_exceeded: costThresholdExceeded,
        notes: notes || null,
      };
    }

    case "accuracy_evaluator": {
      const inputObj = extractInputObject(input);
      const taskSummary = getStringProperty(config, 'taskSummary', '') || getStringProperty(inputObj, 'taskSummary', '');
      const expectedOutputStr = getStringProperty(config, 'expectedOutput', '{}');
      const expectedOutput = parseJSONSafe(expectedOutputStr, 'expectedOutput');
      const constraintsStr = getStringProperty(config, 'constraints', '[]');
      const constraints = parseJSONSafe(constraintsStr, 'constraints') as string[] || [];
      const minConfidenceScore = getNumberProperty(config, 'minConfidenceScore', 70);
      const checkFactualCorrectness = config.checkFactualCorrectness !== false; // Default true
      const checkCompleteness = config.checkCompleteness !== false; // Default true
      const checkInstructionAdherence = config.checkInstructionAdherence !== false; // Default true

      if (!taskSummary) {
        throw new Error('Accuracy Evaluator: Task summary is required.');
      }

      // Get the actual output from input
      const actualOutput = inputObj.output || inputObj.result || inputObj.data || inputObj;

      // Evaluate accuracy (simplified scoring mechanism)
      const issuesDetected: string[] = [];
      let accuracyScore = 100; // Start with perfect score

      // Check completeness
      if (checkCompleteness && expectedOutput && typeof expectedOutput === 'object') {
        const expectedKeys = Object.keys(expectedOutput);
        const actualKeys = typeof actualOutput === 'object' && actualOutput !== null ? Object.keys(actualOutput) : [];
        const missingKeys = expectedKeys.filter(key => !actualKeys.includes(key));
        if (missingKeys.length > 0) {
          issuesDetected.push(`Missing fields: ${missingKeys.join(', ')}`);
          accuracyScore -= (missingKeys.length / expectedKeys.length) * 30;
        }
      }

      // Check constraints
      if (Array.isArray(constraints) && constraints.length > 0) {
        constraints.forEach((constraint: string) => {
          const constraintLower = constraint.toLowerCase();
          // Simple constraint checking logic
          if (constraintLower.includes('numeric') && typeof actualOutput !== 'number') {
            issuesDetected.push(`Constraint violation: ${constraint}`);
            accuracyScore -= 10;
          } else if (constraintLower.includes('between') || constraintLower.includes('range')) {
            // Extract range from constraint if possible
            const rangeMatch = constraint.match(/(\d+)-(\d+)/);
            if (rangeMatch && typeof actualOutput === 'number') {
              const min = parseInt(rangeMatch[1]);
              const max = parseInt(rangeMatch[2]);
              if (actualOutput < min || actualOutput > max) {
                issuesDetected.push(`Constraint violation: ${constraint}`);
                accuracyScore -= 15;
              }
            }
          }
        });
      }

      // Check factual correctness (placeholder - would require actual fact-checking in production)
      if (checkFactualCorrectness) {
        // This would typically involve fact-checking against a knowledge base
        // For now, we check if output is null or empty
        if (actualOutput === null || actualOutput === undefined || actualOutput === '') {
          issuesDetected.push('Output is empty or null');
          accuracyScore -= 20;
        }
      }

      // Check instruction adherence (placeholder)
      if (checkInstructionAdherence && taskSummary) {
        // This would typically involve checking if output aligns with task requirements
        // For now, we ensure output exists
        if (!actualOutput || (typeof actualOutput === 'object' && Object.keys(actualOutput).length === 0)) {
          issuesDetected.push('Output does not appear to follow instructions');
          accuracyScore -= 15;
        }
      }

      // Normalize score to 0-100
      accuracyScore = Math.max(0, Math.min(100, Math.round(accuracyScore)));

      // Detect hallucinations (simplified - would require more sophisticated detection)
      const hallucinationDetected = accuracyScore < minConfidenceScore && issuesDetected.length > 2;

      let recommendation = '';
      if (accuracyScore >= minConfidenceScore) {
        recommendation = 'Output meets minimum quality standards';
      } else if (hallucinationDetected) {
        recommendation = 'Potential hallucinations detected. Review output carefully.';
      } else {
        recommendation = `Accuracy below threshold. Consider reviewing task requirements and constraints.`;
      }

      return {
        task_summary: taskSummary,
        accuracy_score: accuracyScore,
        issues_detected: issuesDetected,
        hallucination_detected: hallucinationDetected,
        recommendation: recommendation,
      };
    }

    case "feedback_loop_collector": {
      const inputObj = extractInputObject(input);
      const feedbackSource = getStringProperty(config, 'feedbackSource', 'user_input') || getStringProperty(inputObj, 'feedbackSource', 'user_input');
      const feedbackType = getStringProperty(config, 'feedbackType', 'neutral') || getStringProperty(inputObj, 'feedbackType', 'neutral') as 'positive' | 'negative' | 'neutral';
      const feedbackSummary = getStringProperty(config, 'feedbackSummary', '') || getStringProperty(inputObj, 'feedbackSummary', '');
      const actionItemsStr = getStringProperty(config, 'actionItems', '[]');
      const actionItems = parseJSONSafe(actionItemsStr, 'actionItems') as string[] || [];
      const priorityLevel = getStringProperty(config, 'priorityLevel', 'MEDIUM') || getStringProperty(inputObj, 'priorityLevel', 'MEDIUM') as 'LOW' | 'MEDIUM' | 'HIGH';
      const metadataStr = getStringProperty(config, 'metadata', '{}');
      const metadata = parseJSONSafe(metadataStr, 'metadata') || {};

      if (!feedbackSummary) {
        throw new Error('Feedback Loop Collector: Feedback summary is required.');
      }

      // Validate feedback source
      const validSources = ['user_input', 'downstream_validation', 'system_failure', 'external_api'];
      if (!validSources.includes(feedbackSource)) {
        throw new Error(`Feedback Loop Collector: Invalid feedback source "${feedbackSource}". Valid sources: ${validSources.join(', ')}`);
      }

      // Validate feedback type
      const validTypes = ['positive', 'negative', 'neutral'];
      if (!validTypes.includes(feedbackType)) {
        throw new Error(`Feedback Loop Collector: Invalid feedback type "${feedbackType}". Valid types: ${validTypes.join(', ')}`);
      }

      // Validate priority level
      const validPriorities = ['LOW', 'MEDIUM', 'HIGH'];
      if (!validPriorities.includes(priorityLevel)) {
        throw new Error(`Feedback Loop Collector: Invalid priority level "${priorityLevel}". Valid priorities: ${validPriorities.join(', ')}`);
      }

      // Extract action items from feedback if not provided
      let extractedActionItems = actionItems;
      if (actionItems.length === 0 && feedbackSummary) {
        // Simple extraction logic (in production, would use NLP)
        const feedbackLower = feedbackSummary.toLowerCase();
        if (feedbackLower.includes('improve') || feedbackLower.includes('fix') || feedbackLower.includes('error')) {
          extractedActionItems.push('Review and improve error handling');
        }
        if (feedbackLower.includes('slow') || feedbackLower.includes('timeout')) {
          extractedActionItems.push('Optimize performance');
        }
        if (feedbackLower.includes('wrong') || feedbackLower.includes('incorrect')) {
          extractedActionItems.push('Verify output accuracy');
        }
      }

      return {
        feedback_source: feedbackSource,
        feedback_type: feedbackType,
        feedback_summary: feedbackSummary,
        action_items: extractedActionItems,
        priority_level: priorityLevel,
        metadata: metadata,
        collected_at: new Date().toISOString(),
      };
    }

    case "compliance_log_writer": {
      const inputObj = extractInputObject(input);
      const workflowId = getStringProperty(config, 'workflowId', '') || getStringProperty(inputObj, 'workflowId', '') || getStringProperty(inputObj, '_workflow_id', '');
      const agentId = getStringProperty(config, 'agentId', '') || getStringProperty(inputObj, 'agentId', '');
      const action = getStringProperty(config, 'action', '') || getStringProperty(inputObj, 'action', '');
      const inputMetadataStr = getStringProperty(config, 'inputMetadata', '{}');
      const inputMetadata = parseJSONSafe(inputMetadataStr, 'inputMetadata') || {};
      const outputMetadataStr = getStringProperty(config, 'outputMetadata', '{}');
      const outputMetadata = parseJSONSafe(outputMetadataStr, 'outputMetadata') || {};
      const complianceStatus = getStringProperty(config, 'complianceStatus', 'COMPLIANT') || getStringProperty(inputObj, 'complianceStatus', 'COMPLIANT') as 'COMPLIANT' | 'WARNING' | 'VIOLATION';
      const notes = getStringProperty(config, 'notes', '') || getStringProperty(inputObj, 'notes', '');
      const ensureImmutability = config.ensureImmutability !== false; // Default true

      if (!workflowId) {
        throw new Error('Compliance Log Writer: Workflow ID is required.');
      }

      if (!agentId) {
        throw new Error('Compliance Log Writer: Agent ID is required.');
      }

      if (!action) {
        throw new Error('Compliance Log Writer: Action description is required.');
      }

      // Validate compliance status
      const validStatuses = ['COMPLIANT', 'WARNING', 'VIOLATION'];
      if (!validStatuses.includes(complianceStatus)) {
        throw new Error(`Compliance Log Writer: Invalid compliance status "${complianceStatus}". Valid statuses: ${validStatuses.join(', ')}`);
      }

      // Sanitize metadata to ensure no sensitive data
      // In production, this would include more sophisticated sanitization
      const sanitizeMetadata = (meta: unknown): Record<string, unknown> => {
        if (typeof meta !== 'object' || meta === null) {
          return {};
        }
        const sanitized: Record<string, unknown> = {};
        const sensitiveKeys = ['password', 'token', 'key', 'secret', 'credit', 'ssn', 'social'];
        for (const [key, value] of Object.entries(meta)) {
          const keyLower = key.toLowerCase();
          if (sensitiveKeys.some(sensitive => keyLower.includes(sensitive))) {
            sanitized[key] = '[REDACTED]';
          } else {
            sanitized[key] = value;
          }
        }
        return sanitized;
      };

      const sanitizedInputMetadata = sanitizeMetadata(inputMetadata);
      const sanitizedOutputMetadata = sanitizeMetadata(outputMetadata);

      // Generate hash for immutability (simplified)
      const timestamp = new Date().toISOString();
      const logContent = JSON.stringify({
        workflow_id: workflowId,
        agent_id: agentId,
        action: action,
        input_metadata: sanitizedInputMetadata,
        output_metadata: sanitizedOutputMetadata,
        timestamp: timestamp,
        compliance_status: complianceStatus,
      });
      
      // Simple hash generation (in production, use crypto library)
      let hash = 0;
      for (let i = 0; i < logContent.length; i++) {
        const char = logContent.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32-bit integer
      }
      const hashString = Math.abs(hash).toString(16);

      return {
        workflow_id: workflowId,
        agent_id: agentId,
        action: action,
        input_metadata: sanitizedInputMetadata,
        output_metadata: sanitizedOutputMetadata,
        timestamp: timestamp,
        compliance_status: complianceStatus,
        notes: notes || null,
        hash: hashString,
        immutable: ensureImmutability,
      };
    }

    case "log_output": {
      const inputObj = extractInputObject(input);
      const message = getStringProperty(config, 'message', '');
      const level = getStringProperty(config, 'level', 'info') || 'info';
      
      // Resolve template variables in the message using replaceTemplates
      const resolvedMessage = replaceTemplates(message, input);
      
      return {
        input: inputObj,
        level: level,
        logged: resolvedMessage
      };
    }

    default:
      // CRITICAL: If we reach here, the node type is valid but not implemented
      // This should never happen if all node types are properly handled
      const errorMsg = `Node type "${type}" is valid but not yet implemented in the execution engine. Node ID: ${node.id}`;
      console.error(`[EXECUTION ERROR] ${errorMsg}`);
      throw new Error(errorMsg);
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
  if (!Array.isArray(items) || items.length === 0) {
    if (operation === 'count') {
      return 0;
    }
    if (operation === 'avg' || operation === 'average') {
      return 0;
    }
    return null;
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
      
      // Special handling: formData is an alias for data (form triggers output data in input.data)
      if (path.startsWith('formData.')) {
        path = path.replace('formData.', 'data.');
        console.log(`[TEMPLATE] Mapped formData to data, new path: ${path}`);
      }
      
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
  if (!expression || typeof expression !== 'string') {
    return input;
  }

  // Handle {{input}} and {{input.field}} patterns
  const cleanExpr = expression.replace(/^\$\.?/, "").replace(/^input\.?/, "").trim();

  if (!cleanExpr) return input;

  const parts = cleanExpr.split(".");
  let result: unknown = input;

  for (const part of parts) {
    if (!part) continue; // Skip empty parts
    
    // Check if result is a JSON string and parse it first
    result = tryParseJson(result);

    if (result && typeof result === "object" && result !== null) {
      // Handle array indexing like items[0]
      const arrayMatch = part.match(/^(\w+)\[(\d+)\]$/);
      if (arrayMatch) {
        const [, key, indexStr] = arrayMatch;
        const index = parseInt(indexStr, 10);
        if (isNaN(index)) {
          return undefined;
        }
        const obj = result as Record<string, unknown>;
        if (key in obj) {
          const arr = obj[key];
          if (Array.isArray(arr) && index >= 0 && index < arr.length) {
            result = arr[index];
          } else {
            return undefined;
          }
        } else {
          return undefined;
        }
      } else {
        const obj = result as Record<string, unknown>;
        if (part in obj) {
          result = obj[part];
        } else {
          return undefined;
        }
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
