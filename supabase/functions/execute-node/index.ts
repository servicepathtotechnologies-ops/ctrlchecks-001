import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

/**
 * Execute a single node for debugging purposes
 * 
 * IMPORTANT: This executes ONLY the single node, not the entire workflow
 * Debug executions are in-memory only - NO database writes
 */

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

interface ExecuteNodeRequest {
  runId?: string; // UUID v4 - optional, will be generated if not provided
  nodeId: string; // Node ID (can be any string, will be used as-is)
  nodeType: string;
  config: Record<string, unknown>;
  input: unknown; // Input data for the node
  workflowId?: string; // Optional workflow ID for context
}

interface ExecuteNodeResponse {
  success: boolean;
  output?: unknown;
  logs?: string[];
  executionTime: number;
  error?: string;
}

/**
 * Validate UUID format
 */
function isValidUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

/**
 * Generate UUID v4
 */
function generateUUID(): string {
  return crypto.randomUUID();
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const request: ExecuteNodeRequest = await req.json();
    const { nodeId, nodeType, config, input, workflowId, runId } = request;

    // Validate required fields
    if (!nodeId || !nodeType || !config) {
      return new Response(
        JSON.stringify({ error: "nodeId, nodeType, and config are required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Validate/generate runId (must be valid UUID)
    let validatedRunId = runId;
    if (!validatedRunId || !isValidUUID(validatedRunId)) {
      validatedRunId = generateUUID();
      console.log(`[execute-node] Generated runId: ${validatedRunId}`);
    }

    console.log(`[execute-node] Executing node: ${nodeId} (${nodeType})`);
    console.log(`[execute-node] RunId: ${validatedRunId}`);
    console.log(`[execute-node] Input:`, JSON.stringify(input));

    const startTime = Date.now();

    // Construct WorkflowNode object for execution
    const node: WorkflowNode = {
      id: nodeId,
      type: nodeType,
      data: {
        label: (config.label as string) || nodeType,
        type: nodeType,
        category: (config.category as string) || 'data',
        config: config,
      },
    };

    // IMPORTANT: We need to execute the node directly, but executeNode is in execute-workflow
    // Since we cannot easily extract executeNode (17k+ lines), we'll use execute-workflow
    // BUT we'll create a temporary workflow with ONLY this node and proper UUID
    
    // Generate proper UUID for temporary workflow (NOT "debug-xxx")
    const tempWorkflowId = generateUUID();
    
    // Get user ID from workflow if provided, or from auth header
    let userId: string | undefined;
    
    if (workflowId) {
      // Get user_id from the existing workflow
      const { data: existingWorkflow } = await supabase
        .from("workflows")
        .select("user_id")
        .eq("id", workflowId)
        .single();
      
      if (existingWorkflow?.user_id) {
        userId = existingWorkflow.user_id;
      }
    }
    
    // If still no user_id, try to get from auth header
    if (!userId) {
      const authHeader = req.headers.get("authorization");
      if (authHeader) {
        try {
          // Extract token from "Bearer <token>"
          const token = authHeader.replace("Bearer ", "");
          const { data: { user } } = await supabase.auth.getUser(token);
          if (user?.id) {
            userId = user.id;
          }
        } catch (authError) {
          console.warn("[execute-node] Could not get user from auth header:", authError);
        }
      }
    }
    
    // If we still don't have a user_id, we cannot create a workflow
    // This should not happen in normal operation, but fail gracefully
    if (!userId) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Cannot determine user_id for debug execution. Please ensure you are authenticated or provide a valid workflowId.",
          executionTime: Date.now() - startTime,
        }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Create a minimal workflow record with proper UUID
    const { error: createError } = await supabase
      .from("workflows")
      .insert({
        id: tempWorkflowId, // Proper UUID, not "debug-xxx"
        name: `Debug: ${nodeType}`,
        nodes: [node],
        edges: [], // Empty edges = only this node will execute
        user_id: userId,
        status: "draft",
      });

    if (createError) {
      console.error("[execute-node] Error creating temp workflow:", createError);
      // If workflow creation fails due to UUID issues, it's likely a validation error
      // Return error instead of continuing
      return new Response(
        JSON.stringify({
          success: false,
          error: `Failed to create temporary workflow: ${createError.message}`,
          executionTime: Date.now() - startTime,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    try {
      // Call execute-workflow with the minimal workflow (only one node, no edges = only that node runs)
      const { data: execData, error: execError } = await supabase.functions.invoke(
        "execute-workflow",
        {
          body: {
            workflowId: tempWorkflowId,
            input: input || {},
          },
        }
      );

      if (execError) {
        console.error(`[execute-node] Execution error:`, execError);
        return new Response(
          JSON.stringify({
            success: false,
            error: execError.message || "Execution failed",
            executionTime: Date.now() - startTime,
          }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Extract output from the execution result
      let output = null;
      if (execData) {
        if (execData.logs && Array.isArray(execData.logs)) {
          // Find the log entry for our node
          const nodeLog = execData.logs.find((log: any) => log.nodeId === nodeId);
          if (nodeLog && nodeLog.output !== undefined) {
            output = nodeLog.output;
          }
        }
        
        // If no output in logs, check the main output field
        if (!output && execData.output !== undefined) {
          output = execData.output;
        }
      }

      const executionTime = Date.now() - startTime;

      console.log(`[execute-node] Node ${nodeId} executed successfully in ${executionTime}ms`);

      return new Response(
        JSON.stringify({
          success: true,
          output: output,
          logs: execData?.logs || [],
          executionTime,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    } finally {
      // Clean up temporary workflow (always, even on error)
      try {
        await supabase.from("workflows").delete().eq("id", tempWorkflowId);
        console.log(`[execute-node] Cleaned up temp workflow: ${tempWorkflowId}`);
      } catch (cleanupError) {
        console.error("[execute-node] Error cleaning up temp workflow:", cleanupError);
        // Don't fail the request if cleanup fails
      }
    }
  } catch (error: any) {
    console.error("[execute-node] Error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || "Internal server error",
        executionTime: 0,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
