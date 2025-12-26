// Chat API for CtrlChecks AI Chatbots
// Handles chat messages and routes to workflows

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { HybridMemoryService } from "../_shared/memory.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ChatRequest {
  workflowId: string;
  message: string;
  sessionId?: string;
  apiKey?: string; // For public API access
  metadata?: Record<string, any>;
}

interface ChatResponse {
  response: string;
  sessionId: string;
  metadata?: Record<string, any>;
  suggestions?: string[];
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
    const { workflowId, message, sessionId, apiKey, metadata }: ChatRequest = await req.json();

    if (!workflowId) {
      return new Response(
        JSON.stringify({ error: "workflowId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!message || typeof message !== 'string' || !message.trim()) {
      return new Response(
        JSON.stringify({ error: "message is required" }),
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

    // Check if workflow is chatbot or agent type
    if (workflow.workflow_type !== 'chatbot' && workflow.workflow_type !== 'agent') {
      return new Response(
        JSON.stringify({ error: "Workflow is not a chatbot or agent type" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate or use provided session ID
    const chatSessionId = sessionId || `chat-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Initialize memory service
    const memoryService = new HybridMemoryService(supabaseUrl, supabaseServiceKey);
    await memoryService.initialize();
    await memoryService.getOrCreateSession(workflowId, chatSessionId);

    // Store user message in memory
    await memoryService.store(chatSessionId, 'user', message, metadata);

    // Prepare input for workflow execution
    const workflowInput = {
      message,
      session_id: chatSessionId,
      _session_id: chatSessionId,
      _workflow_id: workflowId,
      metadata: metadata || {},
    };

    // Execute workflow
    let workflowResponse: any;
    
    if (workflow.workflow_type === 'agent') {
      // Execute agent workflow
      const { data, error } = await supabase.functions.invoke('execute-agent', {
        body: {
          workflowId,
          input: workflowInput,
          config: workflow.agent_config || {},
        },
      });

      if (error) throw error;
      workflowResponse = data;
    } else {
      // Execute regular workflow (chatbot)
      const { data, error } = await supabase.functions.invoke('execute-workflow', {
        body: {
          workflowId,
          input: workflowInput,
        },
      });

      if (error) throw error;
      workflowResponse = data;
    }

    // Extract response from workflow output
    let responseText = '';
    if (typeof workflowResponse.output === 'string') {
      responseText = workflowResponse.output;
    } else if (typeof workflowResponse.output === 'object' && workflowResponse.output !== null) {
      responseText = (workflowResponse.output as any).message ||
                    (workflowResponse.output as any).text ||
                    (workflowResponse.output as any).content ||
                    JSON.stringify(workflowResponse.output);
    } else if (workflowResponse.result) {
      // Agent result
      responseText = typeof workflowResponse.result === 'string' 
        ? workflowResponse.result
        : JSON.stringify(workflowResponse.result);
    }

    // Store assistant response in memory
    if (responseText) {
      await memoryService.store(chatSessionId, 'assistant', responseText);
    }

    // Build response
    const chatResponse: ChatResponse = {
      response: responseText || "I'm sorry, I couldn't generate a response.",
      sessionId: chatSessionId,
      metadata: {
        workflowId,
        executionId: workflowResponse.executionId,
        ...metadata,
      },
    };

    return new Response(
      JSON.stringify(chatResponse),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Chat API error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
        response: "I'm sorry, something went wrong. Please try again.",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

