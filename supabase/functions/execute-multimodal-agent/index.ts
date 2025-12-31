import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { HuggingFaceClient } from "../_shared/huggingface-client.ts";

// Default models if registry not available
const DEFAULT_MODEL = {
  name: "mistralai/Mistral-7B-Instruct-v0.2",
  provider: "huggingface"
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { input, pipeline, models } = await req.json();

    if (!input || !pipeline) {
      return new Response(
        JSON.stringify({ success: false, error: "Input and pipeline are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Process through the pipeline
    let result = input;
    const steps = pipeline.steps || [];
    const processingSteps = steps.filter((s: any) => s.type === "transformation");

    for (const step of processingSteps) {
      const description = (step.description || "").toLowerCase();
      const model = step.model;

      if (description.includes("summarize") || description.includes("summary")) {
        result = await processWithHuggingFace(model, `Please provide a concise summary of the following text:\n\n${result}`);
      } else if (description.includes("extract")) {
        result = await processWithHuggingFace(model, `Extract the key information from the following text:\n\n${result}`);
      } else if (description.includes("translate")) {
        result = await processWithHuggingFace(model, `Translate the following text to English:\n\n${result}`);
      } else if (description.includes("analyze")) {
        result = await processWithHuggingFace(model, `Analyze the following text and provide insights:\n\n${result}`);
      } else {
        // Default processing - just process the text
        result = await processWithHuggingFace(model, result);
      }
    }

    // Check if we got actual AI output or just fallback
    const isFallback = result.startsWith("Processed:") || result.startsWith("[AI Processing]");
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        output: result,
        isFallback: isFallback,
        diagnostic: isFallback ? "Using fallback - check Supabase function logs for HuggingFace API errors" : "AI model processed successfully"
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Execution error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error occurred"
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function processWithHuggingFace(model: any, prompt: string): Promise<string> {
  const huggingfaceApiKey = Deno.env.get("HUGGINGFACE_API_KEY");
  
  if (!huggingfaceApiKey) {
    console.error("❌ No HuggingFace API key found in environment");
    console.error("   Please set HUGGINGFACE_API_KEY in Supabase secrets");
    return `Processed: ${prompt.substring(0, 200)}...`;
  }

  // Validate API key format
  if (!huggingfaceApiKey.startsWith("hf_")) {
    console.warn("⚠️ API key doesn't start with 'hf_' - may be invalid");
  }

  try {
    // Use centralized HuggingFace client with router endpoint
    const client = new HuggingFaceClient(huggingfaceApiKey);
    const modelName = model?.name || DEFAULT_MODEL.name;
    
    console.log(`🤖 Processing with model: ${modelName}`);
    console.log(`📝 Prompt length: ${prompt.length} characters`);
    
    // Format prompt based on model type
    let formattedPrompt = prompt;
    
    // Mistral models use specific format
    if (modelName.includes("Mistral") || modelName.includes("Instruct")) {
      formattedPrompt = `<s>[INST] ${prompt} [/INST]`;
    }
    // CodeLlama models use different format
    else if (modelName.includes("CodeLlama") || modelName.includes("codellama")) {
      formattedPrompt = `[INST] ${prompt} [/INST]`;
    }
    // Zephyr models
    else if (modelName.includes("zephyr")) {
      formattedPrompt = `<|user|>\n${prompt}\n<|assistant|>\n`;
    }

    // Adjust parameters based on task type
    const isCodeGeneration = modelName.includes("code") || modelName.includes("CodeLlama");
    const maxTokens = isCodeGeneration ? 300 : 200;
    const temperature = isCodeGeneration ? 0.2 : 0.7;

    const result = await client.generateText(modelName, formattedPrompt, {
      max_new_tokens: maxTokens,
      return_full_text: false,
      temperature: temperature,
      top_p: 0.9,
    });

    if (result && result.length > 0) {
      console.log(`✅ Model response received (${result.length} chars)`);
      return result.trim();
    }

    console.warn("⚠️ Empty result from HuggingFace API, using fallback");
    console.warn("   This may indicate:");
    console.warn("   1. Model is still loading (503 error)");
    console.warn("   2. API rate limit exceeded (429 error)");
    console.warn("   3. Invalid API key or insufficient credits");
    return `[AI Processing] ${prompt.substring(0, 150)}...`;
  } catch (error) {
    console.error("❌ HuggingFace processing error:", error);
    
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error details:", {
      message: errorMessage,
      model: model?.name || DEFAULT_MODEL.name,
      stack: error instanceof Error ? error.stack : undefined
    });

    // Provide more specific error messages
    if (errorMessage.includes("401") || errorMessage.includes("Unauthorized")) {
      console.error("   → API key is invalid or expired");
    } else if (errorMessage.includes("429") || errorMessage.includes("Rate limit")) {
      console.error("   → Rate limit exceeded - wait before retrying");
    } else if (errorMessage.includes("503") || errorMessage.includes("loading")) {
      console.error("   → Model is loading - try again in a few seconds");
    } else if (errorMessage.includes("timeout")) {
      console.error("   → Request timed out - model may be slow or unavailable");
    }

    return `Processed: ${prompt.substring(0, 200)}...`;
  }
}

