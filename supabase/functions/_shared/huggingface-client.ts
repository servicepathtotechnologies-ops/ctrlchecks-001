/**
 * HuggingFace Router Client - OpenAI-Compatible API
 * 
 * CRITICAL: router.huggingface.co is OpenAI-compatible, NOT legacy inference compatible.
 * ALL requests must follow OpenAI API schemas.
 * 
 * Endpoints:
 * - Text/Code: POST /v1/chat/completions
 * - Image: POST /v1/images/generations
 * - Audio: POST /v1/audio/speech
 * - Embeddings: POST /v1/embeddings
 */

export type Modality = 'text' | 'code' | 'image' | 'audio' | 'embedding';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatCompletionOptions {
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  [key: string]: unknown;
}

export interface ImageGenerationOptions {
  size?: '256x256' | '512x512' | '1024x1024';
  n?: number;
  [key: string]: unknown;
}

export interface OpenAICompatibleResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
    text?: string;
  }>;
  data?: Array<{
    url?: string;
    b64_json?: string;
  }>;
  error?: {
    message?: string;
    type?: string;
  };
}

export class HuggingFaceRouterClient {
  private apiKey: string;
  private baseUrl: string;
  private defaultTimeout: number;
  private maxRetries: number;

  /**
   * Initialize the HuggingFace Router client
   * @param apiKey - HuggingFace API key (required)
   * @param baseUrl - Base URL (defaults to router endpoint)
   * @param defaultTimeout - Request timeout in ms (default: 60000)
   * @param maxRetries - Maximum retries (default: 3)
   */
  constructor(
    apiKey: string | undefined,
    baseUrl: string = "https://router.huggingface.co",
    defaultTimeout: number = 60000,
    maxRetries: number = 3
  ) {
    if (!apiKey) {
      throw new Error("HuggingFace API key is required");
    }
    if (!apiKey.startsWith("hf_")) {
      throw new Error("Invalid HuggingFace API key format. Must start with 'hf_'");
    }
    
    this.apiKey = apiKey;
    this.baseUrl = baseUrl.replace(/\/$/, ''); // Remove trailing slash
    this.defaultTimeout = defaultTimeout;
    this.maxRetries = maxRetries;
  }

  /**
   * Determine modality from model name
   */
  private detectModality(modelName: string): Modality {
    const lower = modelName.toLowerCase();
    
    // Image models
    if (lower.includes('stable-diffusion') || 
        lower.includes('sd-') || 
        lower.includes('image') ||
        lower.includes('pixart') ||
        lower.includes('flux')) {
      return 'image';
    }
    
    // Audio models
    if (lower.includes('whisper') || 
        lower.includes('bark') ||
        lower.includes('tts') ||
        lower.includes('audio')) {
      return 'audio';
    }
    
    // Embedding models
    if (lower.includes('embedding') || 
        lower.includes('sentence-transformers')) {
      return 'embedding';
    }
    
    // Code models
    if (lower.includes('code') || 
        lower.includes('codellama') ||
        lower.includes('deepseek-coder') ||
        lower.includes('starcoder')) {
      return 'code';
    }
    
    // Default to text
    return 'text';
  }

  /**
   * Validate model name and modality
   */
  private validateRequest(modelName: string, modality: Modality): void {
    if (!modelName || typeof modelName !== 'string' || modelName.trim().length === 0) {
      throw new Error("Model name is required and must be a non-empty string");
    }
    
    const detectedModality = this.detectModality(modelName);
    if (detectedModality !== modality) {
      console.warn(`⚠️ Modality mismatch: detected '${detectedModality}' but requested '${modality}'. Using detected modality.`);
    }
  }

  /**
   * Generate text or code using chat completions endpoint
   * @param modelName - Model identifier (e.g., "codellama/CodeLlama-7b-hf")
   * @param prompt - Input prompt or messages array
   * @param options - Generation options
   * @returns Generated text
   */
  async generateText(
    modelName: string,
    prompt: string | ChatMessage[],
    options: ChatCompletionOptions = {}
  ): Promise<string> {
    const modality: Modality = this.detectModality(modelName);
    this.validateRequest(modelName, modality);
    
    console.log(`✔ Using Hugging Face Router`);
    console.log(`✔ Endpoint: /v1/chat/completions`);
    console.log(`✔ Model: ${modelName}`);
    console.log(`✔ Modality: ${modality}`);

    // Convert prompt to messages format
    let messages: ChatMessage[];
    if (typeof prompt === 'string') {
      messages = [{ role: 'user', content: prompt }];
    } else {
      messages = prompt;
    }

    const url = `${this.baseUrl}/v1/chat/completions`;
    const payload = {
      model: modelName,
      messages: messages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.max_tokens ?? 300,
      top_p: options.top_p ?? 0.9,
      ...options,
    };

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          const waitTime = Math.min(3000 * attempt, 10000);
          console.log(`🔄 Retry attempt ${attempt}/${this.maxRetries} after ${waitTime}ms`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.defaultTimeout);

        try {
          const response = await fetch(url, {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${this.apiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          console.log(`✔ Response received (${response.status})`);

          if (!response.ok) {
            const errorText = await response.text().catch(() => response.statusText);
            let errorData: any = {};
            try {
              errorData = JSON.parse(errorText);
            } catch {
              // Not JSON, use text as is
            }
            
            // Handle specific status codes
            if (response.status === 404 || response.status === 400) {
              const errorMsg = errorData?.error?.message || errorText;
              if (errorMsg.includes('not supported') || errorMsg.includes('model_not_suppo')) {
                throw new Error(`Model '${modelName}' not supported on router API. Will fallback to inference API.`);
              }
              throw new Error(`Model '${modelName}' not found or endpoint incorrect. Verify model name and ensure you're using /v1/chat/completions endpoint.`);
            }
            if (response.status === 401) {
              throw new Error("Invalid HuggingFace API key. Please check your HUGGINGFACE_API_KEY.");
            }
            if (response.status === 429) {
              if (attempt < this.maxRetries) {
                const waitTime = Math.min(5000 * (attempt + 1), 30000);
                console.log(`⏸ Rate limit hit, waiting ${waitTime}ms before retry`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
                continue;
              }
              throw new Error("Rate limit exceeded. Please try again later.");
            }
            if (response.status === 503) {
              const estimatedTime = errorData?.estimated_time || 10;
              if (attempt < this.maxRetries) {
                const waitTime = Math.min(estimatedTime * 1000, 15000);
                console.log(`⏳ Model loading, estimated time: ${estimatedTime}s, waiting...`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
                continue;
              }
              throw new Error(`Model is loading. Please try again in ${estimatedTime} seconds.`);
            }
            
            throw new Error(`HuggingFace API error (${response.status}): ${errorText.substring(0, 200)}`);
          }

          const data = await response.json() as OpenAICompatibleResponse;

          // Parse OpenAI-compatible response
          if (data.error) {
            throw new Error(data.error.message || "Unknown error from HuggingFace API");
          }

          if (data.choices && data.choices.length > 0) {
            const content = data.choices[0].message?.content || data.choices[0].text;
            if (content) {
              console.log(`✔ Model executed successfully`);
              console.log(`✔ Generated text length: ${content.length} chars`);
              return content.trim();
            }
          }

          throw new Error("Invalid response format: missing choices[0].message.content");

        } catch (fetchError) {
          clearTimeout(timeoutId);
          
          if (fetchError instanceof Error && fetchError.name === 'AbortError') {
            throw new Error("Request timeout. The model may be slow or unavailable.");
          }
          throw fetchError;
        }

      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        // Only retry on specific errors
        const shouldRetry = attempt < this.maxRetries && 
          (lastError.message.includes('503') || 
           lastError.message.includes('429') ||
           lastError.message.includes('timeout'));
        
        if (!shouldRetry) {
          throw lastError;
        }
      }
    }

    throw lastError || new Error("Failed to call HuggingFace API after retries");
  }

  /**
   * Generate image using images/generations endpoint
   * @param modelName - Model identifier (e.g., "runwayml/stable-diffusion-v1-5")
   * @param prompt - Text prompt for image generation
   * @param options - Generation options
   * @returns Image URL or base64 string
   */
  async generateImage(
    modelName: string,
    prompt: string,
    options: ImageGenerationOptions = {}
  ): Promise<string> {
    const modality: Modality = 'image';
    this.validateRequest(modelName, modality);
    
    console.log(`✔ Using Hugging Face Router`);
    console.log(`✔ Endpoint: /v1/images/generations`);
    console.log(`✔ Model: ${modelName}`);

    const url = `${this.baseUrl}/v1/images/generations`;
    const payload = {
      model: modelName,
      prompt: prompt,
      size: options.size || '512x512',
      n: options.n || 1,
      ...options,
    };

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          const waitTime = Math.min(5000 * attempt, 20000);
          console.log(`🔄 Retry attempt ${attempt}/${this.maxRetries} for image generation`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 120000); // Longer timeout for images

        try {
          const response = await fetch(url, {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${this.apiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
            signal: controller.signal,
          });

          clearTimeout(timeoutId);
          console.log(`✔ Response received (${response.status})`);

          if (!response.ok) {
            const errorText = await response.text().catch(() => response.statusText);
            
            if (response.status === 404) {
              throw new Error(`Model '${modelName}' not found or endpoint incorrect. Verify model name and ensure you're using /v1/images/generations endpoint.`);
            }
            if (response.status === 503) {
              const errorData = await response.json().catch(() => ({}));
              const estimatedTime = (errorData as any).estimated_time || 15;
              if (attempt < this.maxRetries) {
                const waitTime = Math.min(estimatedTime * 1000, 20000);
                console.log(`⏳ Image model loading, estimated time: ${estimatedTime}s`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
                continue;
              }
              throw new Error(`Image model is loading. Please try again in ${estimatedTime} seconds.`);
            }
            
            throw new Error(`HuggingFace image API error (${response.status}): ${errorText.substring(0, 200)}`);
          }

          const data = await response.json() as OpenAICompatibleResponse;

          if (data.error) {
            throw new Error(data.error.message || "Unknown error from HuggingFace API");
          }

          // Parse OpenAI-compatible response
          if (data.data && data.data.length > 0) {
            const imageUrl = data.data[0].url || data.data[0].b64_json;
            if (imageUrl) {
              console.log(`✔ Image generated successfully`);
              return imageUrl;
            }
          }

          throw new Error("Invalid response format: missing data[0].url");

        } catch (fetchError) {
          clearTimeout(timeoutId);
          
          if (fetchError instanceof Error && fetchError.name === 'AbortError') {
            throw new Error("Image generation timeout. The model may be slow.");
          }
          throw fetchError;
        }

      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        if (attempt >= this.maxRetries) {
          throw lastError;
        }
      }
    }

    throw lastError || new Error("Failed to generate image after retries");
  }

  /**
   * Generate audio using audio/speech endpoint
   * @param modelName - Model identifier (e.g., "suno/bark-small")
   * @param prompt - Text prompt for audio generation
   * @param options - Generation options
   * @returns Audio data (base64 or URL)
   */
  async generateAudio(
    modelName: string,
    prompt: string,
    options: Record<string, unknown> = {}
  ): Promise<string> {
    const modality: Modality = 'audio';
    this.validateRequest(modelName, modality);
    
    console.log(`✔ Using Hugging Face Router`);
    console.log(`✔ Endpoint: /v1/audio/speech`);
    console.log(`✔ Model: ${modelName}`);

    const url = `${this.baseUrl}/v1/audio/speech`;
    const payload = {
      model: modelName,
      input: prompt,
      ...options,
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000);

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      console.log(`✔ Response received (${response.status})`);

      if (!response.ok) {
        const errorText = await response.text().catch(() => response.statusText);
        throw new Error(`HuggingFace audio API error (${response.status}): ${errorText.substring(0, 200)}`);
      }

      // Audio is typically returned as binary
      const contentType = response.headers.get("content-type");
      if (contentType?.includes("audio")) {
        const blob = await response.blob();
        const arrayBuffer = await blob.arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);
        let binary = '';
        for (let i = 0; i < bytes.length; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        const base64 = btoa(binary);
        console.log(`✔ Audio generated successfully`);
        return base64;
      }

      // Some models return JSON with audio data
      const data = await response.json() as any;
      if (data.audio || data.data) {
        console.log(`✔ Audio generated successfully`);
        return data.audio || data.data;
      }

      throw new Error("Invalid response format for audio generation");

    } catch (fetchError) {
      clearTimeout(timeoutId);
      
      if (fetchError instanceof Error && fetchError.name === 'AbortError') {
        throw new Error("Audio generation timeout. The model may be slow.");
      }
      throw fetchError;
    }
  }

  /**
   * Create embeddings using embeddings endpoint
   * @param modelName - Model identifier
   * @param input - Text or array of texts
   * @param options - Generation options
   * @returns Embedding vector(s)
   */
  async createEmbedding(
    modelName: string,
    input: string | string[],
    options: Record<string, unknown> = {}
  ): Promise<number[][]> {
    const modality: Modality = 'embedding';
    this.validateRequest(modelName, modality);
    
    console.log(`✔ Using Hugging Face Router`);
    console.log(`✔ Endpoint: /v1/embeddings`);
    console.log(`✔ Model: ${modelName}`);

    const url = `${this.baseUrl}/v1/embeddings`;
    const payload = {
      model: modelName,
      input: input,
      ...options,
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.defaultTimeout);

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      console.log(`✔ Response received (${response.status})`);

      if (!response.ok) {
        const errorText = await response.text().catch(() => response.statusText);
        throw new Error(`HuggingFace embeddings API error (${response.status}): ${errorText.substring(0, 200)}`);
      }

      const data = await response.json() as any;
      
      if (data.data && Array.isArray(data.data)) {
        const embeddings = data.data.map((item: any) => item.embedding || item);
        console.log(`✔ Embeddings generated successfully`);
        return embeddings;
      }

      throw new Error("Invalid response format for embeddings");

    } catch (fetchError) {
      clearTimeout(timeoutId);
      
      if (fetchError instanceof Error && fetchError.name === 'AbortError') {
        throw new Error("Embeddings generation timeout.");
      }
      throw fetchError;
    }
  }

  /**
   * Create a client instance from environment variable
   */
  static fromEnvironment(baseUrl?: string): HuggingFaceRouterClient {
    const apiKey = Deno.env.get("HUGGINGFACE_API_KEY");
    if (!apiKey) {
      throw new Error("HUGGINGFACE_API_KEY environment variable is not set");
    }
    return new HuggingFaceRouterClient(apiKey, baseUrl);
  }
}

// Backward compatibility alias
export const HuggingFaceClient = HuggingFaceRouterClient;
