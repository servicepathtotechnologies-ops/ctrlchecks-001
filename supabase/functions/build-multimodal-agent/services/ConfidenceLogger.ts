export class ConfidenceLogger {
  private logTemplates: any;

  constructor() {
    this.logTemplates = {
      analyzing: [
        "✨ Deciphering your vision...",
        "🧠 Understanding your intent...",
        "🔍 Analyzing your requirements...",
      ],
      detecting: (modality: string) => [
        `🔍 Detected ${modality} transformation`,
        `📊 Identified: ${modality} processing needed`,
        `✨ Found ${modality} requirement`,
      ],
      selecting: (model: any) => [
        `⚙️ Selected: ${this.getFriendlyModelName(model)}`,
        `🎯 Chose ${this.getModelSpecialty(model)} model`,
        `✨ Picked optimal model for your task`,
      ],
      building: [
        "🏗️ Constructing your AI agent...",
        "🔧 Assembling components...",
        "⚙️ Building your pipeline...",
      ],
      generating: [
        "🎨 Crafting your interface...",
        "✨ Generating user experience...",
        "🎭 Creating your UI...",
      ],
      ready: [
        "✅ Your model is ready!",
        "🎉 AI agent activated successfully!",
        "✨ Your AI is ready to use!",
      ],
    };
  }

  generateLogSequence(pipeline: any): string[] {
    const logs: string[] = [];

    // Start with random analyzing message
    logs.push(this.randomChoice(this.logTemplates.analyzing));

    // Detect modalities
    pipeline.steps.forEach((step: any) => {
      if (step.type === "input") {
        const detectingMessages = this.logTemplates.detecting(step.modality);
        logs.push(this.randomChoice(detectingMessages));
      }
    });

    // Model selection
    pipeline.steps.forEach((step: any) => {
      if (step.model) {
        const selectingMessages = this.logTemplates.selecting(step.model);
        logs.push(this.randomChoice(selectingMessages));
      }
    });

    // Building phase
    logs.push(this.randomChoice(this.logTemplates.building));
    logs.push(this.randomChoice(this.logTemplates.generating));

    // Final ready message
    logs.push(this.randomChoice(this.logTemplates.ready));

    return logs;
  }

  private randomChoice(array: any[]): string {
    if (!Array.isArray(array)) {
      return String(array);
    }
    return array[Math.floor(Math.random() * array.length)];
  }

  getFriendlyModelName(model: any): string {
    const names: Record<string, string> = {
      "mistralai/Mistral-7B-Instruct-v0.2": "Advanced Reasoning Model",
      "HuggingFaceH4/zephyr-7b-beta": "Smart Instruction Model",
      "llama-3-70b-8192": "Ultra-Fast Reasoning Engine",
      "stability-ai/sdxl": "Professional Image Generator",
      "runwayml/stable-diffusion-v1-5": "Creative Image Generator",
      "Salesforce/blip-image-captioning-large": "Vision Understanding Model",
      "Salesforce/blip-vqa-base": "Visual Question Answering",
      "openai/whisper-large-v3": "Professional Transcription",
      "openai/whisper-tiny": "Fast Transcription",
      "codellama/CodeLlama-7b-hf": "Code Generation Engine",
      "deepseek-ai/deepseek-coder-6.7b-instruct": "Advanced Code Generator",
      "suno/bark-small": "Voice Synthesis",
    };

    return names[model.name] || "Specialized AI Model";
  }

  private getModelSpecialty(model: any): string {
    if (model.name?.includes("mistral") || model.name?.includes("zephyr")) {
      return "reasoning";
    } else if (model.name?.includes("stable") || model.name?.includes("sdxl")) {
      return "image generation";
    } else if (model.name?.includes("blip")) {
      return "vision";
    } else if (model.name?.includes("whisper")) {
      return "speech recognition";
    } else if (model.name?.includes("code") || model.name?.includes("coder")) {
      return "code generation";
    } else if (model.name?.includes("bark")) {
      return "speech synthesis";
    }
    return "AI";
  }
}

