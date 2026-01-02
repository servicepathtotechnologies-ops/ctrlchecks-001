/**
 * EXECUTE MULTIMODAL AGENT - Edge Function (Proxy Only)
 * 
 * CRITICAL RULES:
 * - NO AI/ML processing here
 * - NO HuggingFace API calls
 * - NO model selection
 * - ONLY validation, auth, and proxying to Python backend
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";

// Python backend URL - should be set as environment variable
const PYTHON_BACKEND_URL = Deno.env.get("PYTHON_BACKEND_URL") || "http://localhost:8501";

// Maximum payload size (10MB for images)
const MAX_PAYLOAD_SIZE = 10 * 1024 * 1024; // 10MB

/**
 * Validate request payload
 */
function validateRequest(body: any): { valid: boolean; error?: string } {
  // Check if task is provided
  if (!body.task) {
    return { valid: false, error: "Task is required. Valid tasks: image_caption, story, image_prompt, text_to_image, summarize, translate, extract, sentiment, generate, qa" };
  }

  // Validate task type
  const validTasks = [
    "image_caption",
    "story",
    "image_prompt",
    "text_to_image",
    "summarize",
    "translate",
    "extract",
    "sentiment",
    "generate",
    "qa"
  ];

  if (!validTasks.includes(body.task)) {
    return { valid: false, error: `Invalid task. Must be one of: ${validTasks.join(", ")}` };
  }

  // For image tasks, require image
  if (["image_caption", "story", "image_prompt"].includes(body.task)) {
    if (!body.image || typeof body.image !== "string") {
      return { valid: false, error: "Image (base64) is required for image tasks" };
    }
    
    // Accept both data URL format and plain base64
    const isDataUrl = body.image.match(/^data:image\/(jpeg|jpg|png|gif|webp);base64,/);
    const isBase64 = /^[A-Za-z0-9+/=]+$/.test(body.image.replace(/\s/g, ''));
    
    if (!isDataUrl && !isBase64) {
      return { valid: false, error: "Image must be base64 encoded" };
    }
    
    // Check image size
    const base64Length = isDataUrl ? body.image.split(',')[1]?.length || body.image.length : body.image.length;
    const estimatedSize = (base64Length * 3) / 4;
    if (estimatedSize > MAX_PAYLOAD_SIZE) {
      return { valid: false, error: `Image size exceeds maximum of ${MAX_PAYLOAD_SIZE / 1024 / 1024}MB` };
    }
  }

  // For text tasks, require input text
  if (["text_to_image", "summarize", "translate", "extract", "sentiment", "generate", "qa"].includes(body.task)) {
    if (!body.input || typeof body.input !== "string" || body.input.trim().length === 0) {
      return { valid: false, error: "Input text is required for text tasks" };
    }
    
    if (body.input.length > 50000) {
      return { valid: false, error: "Input text exceeds maximum length of 50,000 characters" };
    }
  }
  
  // Validate text_to_image parameters
  if (body.task === "text_to_image") {
    if (body.steps && (typeof body.steps !== "number" || body.steps < 1 || body.steps > 4)) {
      return { valid: false, error: "steps must be a number between 1 and 4" };
    }
    if (body.guidance_scale && (typeof body.guidance_scale !== "number" || body.guidance_scale < 0 || body.guidance_scale > 1.5)) {
      return { valid: false, error: "guidance_scale must be a number between 0.0 and 1.5" };
    }
  }

  // Validate optional parameters
  if (body.sentence_count && (typeof body.sentence_count !== "number" || body.sentence_count < 2 || body.sentence_count > 10)) {
    return { valid: false, error: "sentence_count must be a number between 2 and 10" };
  }

  if (body.target_language && typeof body.target_language !== "string") {
    return { valid: false, error: "target_language must be a string" };
  }

  if (body.question && typeof body.question !== "string") {
    return { valid: false, error: "question must be a string" };
  }

  if (body.context && typeof body.context !== "string") {
    return { valid: false, error: "context must be a string" };
  }

  return { valid: true };
}

/**
 * Proxy request to Python backend
 */
async function proxyToPythonBackend(payload: any): Promise<Response> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 180000); // 3 minute timeout (AI processing can be slow)

    console.log(`📤 Proxying ${payload.task} task to Python backend at ${PYTHON_BACKEND_URL}...`);

    const response = await fetch(`${PYTHON_BACKEND_URL}/process`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    // Get response body
    const responseText = await response.text();
    
    // Return response with same status
    return new Response(responseText, {
      status: response.status,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Request timeout. Python backend may be slow or unavailable.",
          details: "AI processing can take 10-30 seconds. Please try again."
        }),
        { status: 504, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    console.error("Error proxying to Python backend:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: `Failed to connect to Python backend: ${error instanceof Error ? error.message : String(error)}`,
        details: `Ensure Python backend is running at ${PYTHON_BACKEND_URL} and PYTHON_BACKEND_URL is configured correctly in Supabase secrets.`
      }),
      { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}

/**
 * Main handler
 */
serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Only allow POST
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ success: false, error: "Method not allowed. Use POST." }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    // Parse request body
    let body: any;
    try {
      const requestText = await req.text();
      
      // Check payload size
      if (requestText.length > MAX_PAYLOAD_SIZE) {
        return new Response(
          JSON.stringify({
            success: false,
            error: `Payload size exceeds maximum of ${MAX_PAYLOAD_SIZE / 1024 / 1024}MB`,
          }),
          { status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      body = JSON.parse(requestText);
    } catch (error) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Invalid JSON in request body",
          details: error instanceof Error ? error.message : String(error),
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate request
    const validation = validateRequest(body);
    if (!validation.valid) {
      return new Response(
        JSON.stringify({
          success: false,
          error: validation.error || "Validation failed",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Prepare payload for Python backend
    const pythonPayload = {
      task: body.task,
      image: body.image || null,
      input: body.input || null,
      sentence_count: body.sentence_count || 5,
      target_language: body.target_language || null,
      question: body.question || null,
      context: body.context || null,
      steps: body.steps || null,
      guidance_scale: body.guidance_scale || null,
      options: body.options || {},
    };

    // Proxy to Python backend
    return await proxyToPythonBackend(pythonPayload);

  } catch (error) {
    // Catch-all error handler
    console.error("Unexpected error in Edge Function:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: "Internal server error",
        details: error instanceof Error ? error.message : String(error),
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
