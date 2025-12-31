import { FREE_MODELS } from "./FreeModelRegistry.ts";

export class ModelSelector {
  selectModels(intent: any): any[] {
    const selectedModels: any[] = [];

    // Text processing needed?
    if (
      intent.input_modality?.includes("text") ||
      intent.output_modality?.includes("text")
    ) {
      selectedModels.push(this.selectTextModel(intent));
    }

    // Image generation needed?
    if (intent.output_modality?.includes("image")) {
      selectedModels.push(this.selectImageModel(intent));
    }

    // Image understanding needed?
    if (intent.input_modality?.includes("image")) {
      selectedModels.push(this.selectVisionModel(intent));
    }

    // Audio processing needed?
    if (
      intent.input_modality?.includes("audio") ||
      intent.output_modality?.includes("audio")
    ) {
      selectedModels.push(this.selectAudioModel(intent));
    }

    // Code generation needed?
    if (intent.output_modality?.includes("code")) {
      selectedModels.push(this.selectCodeModel(intent));
    }

    // File conversion needed?
    if (
      intent.input_modality?.includes("file") ||
      intent.output_modality?.includes("file")
    ) {
      selectedModels.push(this.selectFileModel(intent));
    }

    return selectedModels.filter(Boolean);
  }

  selectTextModel(intent: any): any {
    if (intent.complexity === "high") {
      return FREE_MODELS.text_models.llama_70b_groq;
    } else if ((intent.estimated_tokens || 0) > 2000) {
      return FREE_MODELS.text_models.mistral_7b;
    } else {
      return FREE_MODELS.text_models.zephyr_7b;
    }
  }

  selectImageModel(intent: any): any {
    // Check if we have Replicate credits left (simplified - always use HuggingFace for now)
    return FREE_MODELS.image_generation.stable_diffusion_v1_5;
  }

  selectVisionModel(intent: any): any {
    if (
      intent.goal?.toLowerCase().includes("text") ||
      intent.goal?.toLowerCase().includes("ocr") ||
      intent.goal?.toLowerCase().includes("extract")
    ) {
      return FREE_MODELS.image_understanding.blip_vqa;
    } else {
      return FREE_MODELS.image_understanding.blip_captioning;
    }
  }

  selectAudioModel(intent: any): any {
    if (intent.input_modality?.includes("audio")) {
      return FREE_MODELS.speech_recognition.whisper_large;
    } else {
      return FREE_MODELS.speech_synthesis.bark_small;
    }
  }

  selectCodeModel(intent: any): any {
    return FREE_MODELS.code_generation.codellama_7b;
  }

  selectFileModel(intent: any): any {
    return FREE_MODELS.file_conversion.pdfjs;
  }

  hasReplicateCredits(): boolean {
    // Simplified - in production, check actual credits
    return false; // Default to HuggingFace
  }
}

