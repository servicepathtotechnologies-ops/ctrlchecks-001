import { FREE_MODELS } from "./FreeModelRegistry.ts";
import { HuggingFaceClient } from "../../_shared/huggingface-client.ts";

export class IntentAnalyzer {
  private huggingfaceApiKey: string;
  private hfClient: HuggingFaceClient | null;

  constructor() {
    this.huggingfaceApiKey = Deno.env.get("HUGGINGFACE_API_KEY") || "";
    this.hfClient = this.huggingfaceApiKey 
      ? new HuggingFaceClient(this.huggingfaceApiKey)
      : null;
  }

  async analyze(userPrompt: string, uploadedFiles: any[] = []): Promise<any> {
    // For now, use intelligent fallback that doesn't require API calls
    // This is more reliable and faster
    console.log("Analyzing intent for prompt:", userPrompt.substring(0, 50));
    
    try {
      // Try to use HuggingFace API if available, but don't fail if it doesn't work
      if (this.huggingfaceApiKey) {
        try {
          const analysisPrompt = `Analyze this user request and extract structured information.

USER REQUEST: "${userPrompt}"

OUTPUT AS JSON with these exact keys:
{
  "goal": "concise_description_under_10_words",
  "input_modality": ["text" or "image" or "audio" or "file" or "code"],
  "output_modality": ["text" or "image" or "audio" or "file" or "code"],
  "processing_steps": ["step1", "step2", "step3"],
  "complexity": "low" or "medium" or "high",
  "ui_requirements": ["upload_area", "preview", "download_button", "settings"],
  "estimated_tokens": number,
  "privacy_level": "low" or "medium" or "high"
}

Rules:
- Be specific about modalities
- Include file processing if upload mentioned
- Estimate tokens based on length
- Assess complexity based on steps needed
- Return ONLY valid JSON, no markdown or extra text`;

          const response = await this.callHuggingFaceAPI(
            FREE_MODELS.text_models.mistral_7b.name,
            analysisPrompt,
            { max_new_tokens: 300 }
          );

          // Parse and validate
          const intent = this.parseLLMResponse(response);

          // Enhance with file detection
          if (uploadedFiles.length > 0) {
            if (!intent.input_modality.includes("file")) {
              intent.input_modality.push("file");
            }
            intent.file_types = uploadedFiles.map((f: any) => f.type || "unknown");
          }

          // Ensure arrays
          if (!Array.isArray(intent.input_modality)) {
            intent.input_modality = [intent.input_modality];
          }
          if (!Array.isArray(intent.output_modality)) {
            intent.output_modality = [intent.output_modality];
          }

          console.log("Intent analysis successful via API");
          return intent;
        } catch (apiError) {
          console.warn("API-based intent analysis failed, using fallback:", apiError);
          // Continue to fallback below
        }
      }
    } catch (error) {
      console.warn("Intent analysis error, using fallback:", error);
    }

    // Use intelligent fallback (works without API)
    console.log("Using intelligent fallback for intent analysis");
    return this.createFallbackIntent(userPrompt, uploadedFiles);
  }

  private async callHuggingFaceAPI(
    model: string,
    prompt: string,
    options: any = {}
  ): Promise<string> {
    if (!this.hfClient) {
      throw new Error("HuggingFace API key not configured");
    }

    try {
      // Use centralized HuggingFace client with router endpoint
      return await this.hfClient.generateText(model, prompt, {
        max_new_tokens: options.max_new_tokens || 300,
        return_full_text: false,
        ...options,
      });
    } catch (error) {
      console.error("HuggingFace API call failed:", error);
      throw error;
    }
  }

  private parseLLMResponse(response: string): any {
    // Try to extract JSON from response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]);
      } catch (e) {
        console.error("Failed to parse JSON:", e);
      }
    }

    throw new Error("Could not parse JSON from LLM response");
  }

  private createFallbackIntent(userPrompt: string, uploadedFiles: any[]): any {
    const lowerPrompt = userPrompt.toLowerCase();
    
    // Create a more intelligent goal
    let goal = userPrompt.substring(0, 50).trim();
    if (goal.length > 50) {
      goal = goal.substring(0, 47) + "...";
    }
    
    const intent: any = {
      goal: goal,
      input_modality: [] as string[],
      output_modality: [] as string[],
      processing_steps: [] as string[],
      complexity: "medium",
      ui_requirements: ["upload_area", "preview"],
      estimated_tokens: Math.max(userPrompt.length, 100),
      privacy_level: "medium"
    };

    // Detect input modality with better patterns
    if (uploadedFiles.length > 0) {
      intent.input_modality.push("file");
      intent.file_types = uploadedFiles.map((f: any) => f.type || "unknown");
    }
    
    if (lowerPrompt.includes("upload") || lowerPrompt.includes("file") || lowerPrompt.includes("pdf") || lowerPrompt.includes("docx")) {
      if (!intent.input_modality.includes("file")) {
        intent.input_modality.push("file");
      }
    }
    
    if (lowerPrompt.includes("image") || lowerPrompt.includes("picture") || lowerPrompt.includes("photo") || lowerPrompt.includes("jpg") || lowerPrompt.includes("png")) {
      if (!intent.input_modality.includes("image")) {
        intent.input_modality.push("image");
      }
    }
    
    if (lowerPrompt.includes("audio") || lowerPrompt.includes("voice") || lowerPrompt.includes("speech") || lowerPrompt.includes("mp3") || lowerPrompt.includes("wav")) {
      if (!intent.input_modality.includes("audio")) {
        intent.input_modality.push("audio");
      }
    }
    
    if (lowerPrompt.includes("code") || lowerPrompt.includes("script") || lowerPrompt.includes("python") || lowerPrompt.includes("javascript")) {
      if (!intent.input_modality.includes("code")) {
        intent.input_modality.push("code");
      }
    }
    
    if (intent.input_modality.length === 0) {
      intent.input_modality.push("text");
    }

    // Detect output modality with better patterns
    if ((lowerPrompt.includes("generate") || lowerPrompt.includes("create")) && (lowerPrompt.includes("image") || lowerPrompt.includes("picture"))) {
      intent.output_modality.push("image");
    } else if (lowerPrompt.includes("code") || lowerPrompt.includes("script") || lowerPrompt.includes("function") || lowerPrompt.includes("program")) {
      intent.output_modality.push("code");
    } else if ((lowerPrompt.includes("generate") || lowerPrompt.includes("create")) && (lowerPrompt.includes("audio") || lowerPrompt.includes("audio"))) {
      intent.output_modality.push("audio");
    } else if (lowerPrompt.includes("download") || lowerPrompt.includes("save") || lowerPrompt.includes("export")) {
      intent.output_modality.push("file");
    } else {
      intent.output_modality.push("text");
    }

    // Extract processing steps with better detection
    if (lowerPrompt.includes("summarize") || lowerPrompt.includes("summary")) {
      intent.processing_steps.push("summarize");
    }
    if (lowerPrompt.includes("extract") || lowerPrompt.includes("pull out")) {
      intent.processing_steps.push("extract");
    }
    if (lowerPrompt.includes("translate") || lowerPrompt.includes("translation")) {
      intent.processing_steps.push("translate");
    }
    if (lowerPrompt.includes("generate") || lowerPrompt.includes("create") || lowerPrompt.includes("make")) {
      intent.processing_steps.push("generate");
    }
    if (lowerPrompt.includes("analyze") || lowerPrompt.includes("analysis")) {
      intent.processing_steps.push("analyze");
    }
    if (lowerPrompt.includes("convert") || lowerPrompt.includes("transform")) {
      intent.processing_steps.push("convert");
    }

    // Determine complexity
    const stepCount = intent.processing_steps.length;
    if (stepCount > 3 || lowerPrompt.split(" ").length > 30) {
      intent.complexity = "high";
    } else if (stepCount === 1 && lowerPrompt.split(" ").length < 10) {
      intent.complexity = "low";
    } else {
      intent.complexity = "medium";
    }

    if (intent.processing_steps.length === 0) {
      intent.processing_steps.push("process");
    }

    return intent;
  }
}

