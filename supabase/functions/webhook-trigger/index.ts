// Deno global type declaration for TypeScript
declare const Deno: {
  readTextFile(path: string | URL): Promise<string>;
  env: {
    get(key: string): string | undefined;
  };
  cwd(): string;
};

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const pathParts = url.pathname.split("/");
    const workflowId = pathParts[pathParts.length - 1];

    if (!workflowId) {
      console.error("No workflow ID provided");
      return new Response(
        JSON.stringify({ error: "Workflow ID is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Webhook triggered for workflow: ${workflowId}`);

    // Get request body if present
    let input = {};
    if (req.method === "POST") {
      try {
        const body = await req.text();
        if (body) {
          input = JSON.parse(body);
        }
      } catch (e) {
        console.log("No JSON body or invalid JSON, using empty input");
      }
    }

    // Query params as additional input
    const queryParams: Record<string, string> = {};
    url.searchParams.forEach((value, key) => {
      queryParams[key] = value;
    });

    // Extract session_id for conversation memory (from query param, body, or generate new)
    const sessionId = (queryParams.session_id || (input as any).session_id) || 
                      `session_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    const fullInput = { ...queryParams, ...input, _webhook: true, _method: req.method, session_id: sessionId };

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify workflow exists and has webhook enabled
    const { data: workflow, error: workflowError } = await supabase
      .from("workflows")
      .select("*")
      .eq("id", workflowId)
      .single();

    if (workflowError || !workflow) {
      console.error("Workflow not found:", workflowError);
      return new Response(
        JSON.stringify({ error: "Workflow not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!workflow.webhook_url) {
      console.error("Webhook not enabled for workflow:", workflowId);
      return new Response(
        JSON.stringify({ error: "Webhook not enabled for this workflow" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (workflow.status !== "active") {
      console.error("Workflow is not active:", workflow.status);
      return new Response(
        JSON.stringify({ error: "Workflow is not active" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create execution record
    const startedAt = new Date().toISOString();
    const { data: execution, error: execError } = await supabase
      .from("executions")
      .insert({
        workflow_id: workflowId,
        user_id: workflow.user_id,
        status: "pending",
        trigger: "webhook",
        input: fullInput,
        logs: [],
        started_at: startedAt,
      })
      .select()
      .single();

    if (execError) {
      console.error("Failed to create execution:", execError);
      return new Response(
        JSON.stringify({ error: "Failed to create execution" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Created execution ${execution.id} for webhook trigger with session_id: ${sessionId}`);

    // Note: Conversation history is now retrieved per AI node in execute-workflow
    // based on each node's memory limit configuration. This allows different AI nodes
    // in the same workflow to have different memory limits.

    // Call the execute-workflow function and wait for completion
    const executeUrl = `${supabaseUrl}/functions/v1/execute-workflow`;
    
    let executeResponse: Response;
    try {
      executeResponse = await fetch(executeUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${supabaseServiceKey}`,
          "apikey": supabaseServiceKey,
      },
      body: JSON.stringify({
        workflowId,
        executionId: execution.id,
          input: fullInput, // session_id is already included in fullInput
      }),
    });
    } catch (fetchError) {
      console.error("Failed to call execute-workflow:", fetchError);
      // Update execution status to failed
      await supabase
        .from("executions")
        .update({
          status: "failed",
          error: `Failed to invoke execute-workflow: ${fetchError instanceof Error ? fetchError.message : "Unknown error"}`,
          finished_at: new Date().toISOString(),
        })
        .eq("id", execution.id);
      
      return new Response(
        JSON.stringify({
          error: "Workflow execution failed",
          reply: "Sorry, I encountered an error processing your request. Please try again.",
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!executeResponse.ok) {
      const errorText = await executeResponse.text();
      console.error("Execute workflow failed:", errorText);
      
      // Update execution status to failed
      await supabase
        .from("executions")
        .update({
          status: "failed",
          error: `Execute-workflow returned error: ${errorText}`,
          finished_at: new Date().toISOString(),
        })
        .eq("id", execution.id);
      
      return new Response(
        JSON.stringify({
          error: "Workflow execution failed",
          reply: "Sorry, I encountered an error processing your request. Please try again.",
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get execution result
    const executionResult = await executeResponse.json();
    console.log("Execution result from execute-workflow:", JSON.stringify(executionResult, null, 2));
    
    // Also fetch the execution from database to get the actual stored output
    const { data: dbExecution, error: dbError } = await supabase
      .from("executions")
      .select("output, logs, status, error")
      .eq("id", execution.id)
      .single();
    
    console.log("Execution from database:", JSON.stringify(dbExecution, null, 2));
    
    // Use database output if available, otherwise use response output
    const actualOutput = dbExecution?.output !== null && dbExecution?.output !== undefined 
      ? dbExecution.output 
      : executionResult.output;
    
    console.log("Actual output to use:", JSON.stringify(actualOutput));
    
    // Extract AI response from execution output
    let reply = "";
    let responseStatusCode = 200;
    let responseHeaders: Record<string, string> = {};
    
    if (executionResult.status === "success" || dbExecution?.status === "success") {
      // Check if there's a respond_to_webhook node response
      if (actualOutput && typeof actualOutput === "object" && (actualOutput as any)._webhook_response) {
        const webhookResponse = actualOutput as any;
        responseStatusCode = webhookResponse.statusCode || 200;
        responseHeaders = webhookResponse.headers || {};
        reply = webhookResponse.message || 
                webhookResponse.text || 
                webhookResponse.content ||
                (typeof webhookResponse.body === 'string' ? webhookResponse.body : JSON.stringify(webhookResponse.body));
      } else {
        // Try to extract response from different possible locations
        if (actualOutput) {
          // If output is a string, use it directly
          if (typeof actualOutput === "string") {
            reply = actualOutput;
          }
          // If output is an object, look for common fields
          else if (typeof actualOutput === "object") {
            reply = actualOutput.text || 
                    actualOutput.content || 
                    actualOutput.message ||
                    actualOutput.response ||
                    JSON.stringify(actualOutput);
          }
        }
      }
      
      // If no output, check logs for respond_to_webhook or AI node output
      const logsToCheck = dbExecution?.logs || executionResult.logs || [];
      if (!reply && logsToCheck.length > 0) {
        console.log("Checking logs for respond_to_webhook or AI output, total logs:", logsToCheck.length);
        
        // First, check for respond_to_webhook node
        const respondLog = logsToCheck.find((log: any) => 
          log.nodeName && log.nodeName.toLowerCase().includes("respond to webhook")
        );
        
        if (respondLog && respondLog.output) {
          if (typeof respondLog.output === "object" && (respondLog.output as any)._webhook_response) {
            const webhookResponse = respondLog.output as any;
            responseStatusCode = webhookResponse.statusCode || 200;
            responseHeaders = webhookResponse.headers || {};
            reply = webhookResponse.message || 
                    webhookResponse.text || 
                    webhookResponse.content ||
                    (typeof webhookResponse.body === 'string' ? webhookResponse.body : JSON.stringify(webhookResponse.body));
          }
        }
        
        // If still no reply, check for AI node output
        if (!reply) {
          const aiLog = logsToCheck.find((log: any) => 
            log.nodeName && (
              log.nodeName.toLowerCase().includes("gpt") ||
              log.nodeName.toLowerCase().includes("gemini") ||
              log.nodeName.toLowerCase().includes("claude") ||
              log.nodeName.toLowerCase().includes("ai")
            )
          );
          
          if (aiLog && aiLog.output) {
            if (typeof aiLog.output === "string") {
              reply = aiLog.output;
            } else if (typeof aiLog.output === "object") {
              reply = aiLog.output.text || 
                      aiLog.output.content || 
                      aiLog.output.message ||
                      JSON.stringify(aiLog.output);
            }
          }
        }
        
        // If still no reply, try to get the last node's output
        if (!reply) {
          const lastLog = logsToCheck.filter((l: any) => l.status === "success" && l.output).pop();
          if (lastLog && lastLog.output) {
            console.log("Using last successful node output:", JSON.stringify(lastLog.output));
            if (typeof lastLog.output === "string") {
              reply = lastLog.output;
            } else if (typeof lastLog.output === "object") {
              reply = lastLog.output.text || 
                      lastLog.output.content || 
                      lastLog.output.message ||
                      JSON.stringify(lastLog.output);
            }
          }
        }
      }
      
      // Fallback message if no reply found
      if (!reply) {
        console.warn("No reply found in output or logs");
        reply = "I received your message, but couldn't generate a response. Please check your workflow configuration.";
      }
    } else {
      // Execution failed
      reply = executionResult.error || dbExecution?.error || "Sorry, I encountered an error. Please try again.";
    }
    
    console.log("Final reply:", reply);

    // Return response with proper status code and headers
    return new Response(
      JSON.stringify({
        success: true,
        reply: reply,
        executionId: execution.id,
      }),
      { 
        status: responseStatusCode, 
        headers: { 
          ...corsHeaders, 
          "Content-Type": "application/json",
          ...responseHeaders 
        } 
      }
    );
  } catch (error) {
    console.error("Webhook handler error:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
