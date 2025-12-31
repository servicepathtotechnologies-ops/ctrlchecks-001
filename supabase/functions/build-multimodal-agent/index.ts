import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

// Import services
import { IntentAnalyzer } from "./services/IntentAnalyzer.ts";
import { ModelSelector } from "./services/ModelSelector.ts";
import { PipelineBuilder } from "./services/PipelineBuilder.ts";
import { UITemplateGenerator } from "./services/UITemplateGenerator.ts";
import { ConfidenceLogger } from "./services/ConfidenceLogger.ts";
import { MultimodalOrchestrator } from "./services/MultimodalOrchestrator.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { prompt, files = [] } = await req.json();

    if (!prompt || !prompt.trim()) {
      return new Response(
        JSON.stringify({ success: false, error: "Prompt is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Initialize orchestrator
    const orchestrator = new MultimodalOrchestrator();

    // Build the agent
    const result = await orchestrator.buildAgent(prompt, files);

    return new Response(
      JSON.stringify(result),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error building multimodal agent:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error occurred"
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

