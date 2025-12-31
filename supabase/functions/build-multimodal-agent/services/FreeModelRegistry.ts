// Free Model Registry - Complete database of free AI models
// Note: All HuggingFace endpoints use the router endpoint: https://router.huggingface.co
export const FREE_MODELS = {
  // TEXT PROCESSING
  text_models: {
    mistral_7b: {
      name: "mistralai/Mistral-7B-Instruct-v0.2",
      provider: "huggingface",
      endpoint: "https://router.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.2",
      free_limit: "30,000 tokens/month",
      capabilities: ["summarization", "analysis", "translation", "qna"],
      latency: "medium"
    },
    zephyr_7b: {
      name: "HuggingFaceH4/zephyr-7b-beta",
      provider: "huggingface",
      endpoint: "https://router.huggingface.co/models/HuggingFaceH4/zephyr-7b-beta",
      capabilities: ["instruction_following", "reasoning"],
      best_for: "complex reasoning tasks"
    },
    llama_70b_groq: {
      name: "llama-3-70b-8192",
      provider: "groq",
      endpoint: "https://api.groq.com/openai/v1/chat/completions",
      free_limit: "limited requests",
      speed: "EXTREME (300+ tokens/sec)",
      best_for: "fast responses"
    }
  },
  
  // TEXT-TO-IMAGE
  image_generation: {
    stable_diffusion_xl: {
      name: "stability-ai/sdxl",
      provider: "replicate",
      endpoint: "https://api.replicate.com/v1/predictions",
      free_limit: "500 images/month",
      quality: "excellent",
      dimensions: "1024x1024"
    },
    stable_diffusion_v1_5: {
      name: "runwayml/stable-diffusion-v1-5",
      provider: "huggingface",
      endpoint: "https://router.huggingface.co/models/runwayml/stable-diffusion-v1-5",
      free_limit: "unlimited (slow)",
      best_for: "basic image generation"
    }
  },
  
  // IMAGE-TO-TEXT
  image_understanding: {
    blip_captioning: {
      name: "Salesforce/blip-image-captioning-large",
      provider: "huggingface",
      endpoint: "https://router.huggingface.co/models/Salesforce/blip-image-captioning-large",
      capabilities: ["image_description", "visual_qa"],
      free_limit: "unlimited"
    },
    blip_vqa: {
      name: "Salesforce/blip-vqa-base",
      provider: "huggingface",
      endpoint: "https://router.huggingface.co/models/Salesforce/blip-vqa-base",
      capabilities: ["visual_question_answering"],
      best_for: "image analysis questions"
    }
  },
  
  // TEXT-TO-CODE
  code_generation: {
    codellama_7b: {
      name: "codellama/CodeLlama-7b-hf",
      provider: "huggingface",
      endpoint: "https://router.huggingface.co/models/codellama/CodeLlama-7b-hf",
      languages: ["python", "javascript", "java", "cpp", "go"],
      capabilities: ["code_generation", "code_explanation", "debugging"]
    },
    deepseek_coder: {
      name: "deepseek-ai/deepseek-coder-6.7b-instruct",
      provider: "huggingface",
      endpoint: "https://router.huggingface.co/models/deepseek-ai/deepseek-coder-6.7b-instruct",
      best_for: "complex programming tasks"
    }
  },
  
  // TEXT-TO-AUDIO
  speech_synthesis: {
    bark_small: {
      name: "suno/bark-small",
      provider: "huggingface",
      endpoint: "https://router.huggingface.co/models/suno/bark-small",
      voices: ["en_male", "en_female", "multilingual"],
      quality: "good",
      speed: "slow"
    }
  },
  
  // AUDIO-TO-TEXT
  speech_recognition: {
    whisper_large: {
      name: "openai/whisper-large-v3",
      provider: "huggingface",
      endpoint: "https://router.huggingface.co/models/openai/whisper-large-v3",
      languages: ["99 languages"],
      accuracy: "excellent",
      free_limit: "unlimited"
    },
    whisper_tiny: {
      name: "openai/whisper-tiny",
      provider: "huggingface",
      endpoint: "https://router.huggingface.co/models/openai/whisper-tiny",
      best_for: "fast transcription",
      accuracy: "good"
    }
  },
  
  // FILE PROCESSING
  file_conversion: {
    pdfjs: {
      name: "pdf-js",
      provider: "client-side",
      capabilities: ["pdf_text_extraction", "rendering"],
      no_server_needed: true
    },
    mammoth: {
      name: "mammoth.js",
      provider: "client-side",
      capabilities: ["docx_to_html", "docx_to_markdown"]
    }
  }
};

