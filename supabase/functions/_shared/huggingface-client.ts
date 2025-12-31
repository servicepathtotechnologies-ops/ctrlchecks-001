/**
 * Centralized HuggingFace API Client
 * 
 * This module provides a unified interface for all HuggingFace API calls.
 * Uses the new router endpoint: https://router.huggingface.co
 * 
 * Migration Notes:
 * - Old endpoint: https://api-inference.huggingface.co (deprecated, returns 410)
 * - New endpoint: https://router.huggingface.co (current standard)
 * - The router endpoint provides optimized routing and better reliability
 */

export interface HuggingFaceRequestOptions {
  max_new_tokens?: number;
  temperature?: number;
  top_p?: number;
  return_full_text?: boolean;
  [key: string]: unknown;
}

export interface HuggingFaceResponse {
  generated_text?: string;
  summary_text?: string;
  text?: string;
  error?: string;
  estimated_time?: number;
  [key: string]: unknown;
}

export class HuggingFaceClient {
  private apiKey: string;
  private baseUrl: string;
  private defaultTimeout: number;
  private maxRetries: number;

  /**
   * Initialize the HuggingFace client
   * @param apiKey - HuggingFace API key (from environment variable)
   * @param baseUrl - Base URL for HuggingFace API (defaults to router endpoint)
   * @param defaultTimeout - Default timeout in milliseconds (default: 60000)
   * @param maxRetries - Maximum number of retries (default: 3)
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
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
    this.defaultTimeout = defaultTimeout;
    this.maxRetries = maxRetries;
  }

  /**
   * Generate text using a HuggingFace model
   * @param modelName - Model identifier (e.g., "mistralai/Mistral-7B-Instruct-v0.2")
   * @param prompt - Input prompt text
   * @param options - Additional generation parameters
   * @returns Generated text string
   */
  async generateText(
    modelName: string,
    prompt: string,
    options: HuggingFaceRequestOptions = {}
  ): Promise<string> {
    console.log(`✅ Switching to optimized Hugging Face router`);
    console.log(`🤖 Model: ${modelName}`);
    console.log(`📝 Prompt length: ${prompt.length} chars`);

    const url = `${this.baseUrl}/models/${modelName}`;
    const payload = {
      inputs: prompt,
      parameters: {
        max_new_tokens: options.max_new_tokens || 300,
        temperature: options.temperature || 0.7,
        top_p: options.top_p || 0.9,
        return_full_text: options.return_full_text || false,
        ...options,
      },
    };

    let lastError: Error | null = null;
    let lastResponse: Response | null = null;

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
          lastResponse = response;

          console.log(`📥 Response status: ${response.status} ${response.statusText}`);

          // Handle specific error codes
          if (response.status === 410) {
            // This should not happen with router endpoint, but handle gracefully
            throw new Error(
              "HuggingFace endpoint migration detected. Please ensure you're using the router endpoint."
            );
          }

          if (response.status === 503) {
            // Model is loading
            const errorData = await response.json().catch(() => ({}));
            const estimatedTime = (errorData as any).estimated_time || 10;
            
            if (attempt < this.maxRetries) {
              const waitTime = Math.min(estimatedTime * 1000, 15000);
              console.log(`⏳ Model loading, estimated time: ${estimatedTime}s, waiting...`);
              await new Promise(resolve => setTimeout(resolve, waitTime));
              continue;
            }
            throw new Error(`Model is loading. Please try again in ${estimatedTime} seconds.`);
          }

          if (response.status === 429) {
            // Rate limit
            if (attempt < this.maxRetries) {
              const waitTime = Math.min(5000 * (attempt + 1), 30000);
              console.log(`⏸ Rate limit hit, waiting ${waitTime}ms before retry`);
              await new Promise(resolve => setTimeout(resolve, waitTime));
              continue;
            }
            throw new Error("Rate limit exceeded. Please try again later.");
          }

          if (!response.ok) {
            const errorText = await response.text().catch(() => response.statusText);
            console.error(`❌ API Error (${response.status}):`, errorText.substring(0, 200));
            throw new Error(`HuggingFace API error (${response.status}): ${errorText.substring(0, 200)}`);
          }

          const data = await response.json() as HuggingFaceResponse | HuggingFaceResponse[];

          // Handle model loading response in body
          if (Array.isArray(data) && data[0] && 'error' in data[0]) {
            const errorData = data[0] as HuggingFaceResponse;
            if (errorData.estimated_time) {
              if (attempt < this.maxRetries) {
                const waitTime = Math.min(errorData.estimated_time * 1000, 15000);
                console.log(`⏳ Model loading (in response), estimated time: ${errorData.estimated_time}s`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
                continue;
              }
              throw new Error(`Model is loading. Estimated time: ${errorData.estimated_time}s`);
            }
          } else if (!Array.isArray(data) && data.error) {
            if (data.estimated_time && attempt < this.maxRetries) {
              const waitTime = Math.min(data.estimated_time * 1000, 15000);
              console.log(`⏳ Model loading (in response), estimated time: ${data.estimated_time}s`);
              await new Promise(resolve => setTimeout(resolve, waitTime));
              continue;
            }
            throw new Error(data.error || "Unknown error from HuggingFace API");
          }

          // Extract generated text
          const result = this.extractGeneratedText(data);
          if (result) {
            console.log(`✅ Model request routed successfully`);
            console.log(`📤 Generated text length: ${result.length} chars`);
            return result;
          }

          throw new Error("Could not extract generated text from response");

        } catch (fetchError) {
          clearTimeout(timeoutId);
          
          if (fetchError instanceof Error && fetchError.name === 'AbortError') {
            throw new Error("Request timeout. The model may be slow or unavailable.");
          }
          throw fetchError;
        }

      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        const shouldRetry = attempt < this.maxRetries && 
          lastResponse && 
          (lastResponse.status === 503 || lastResponse.status === 429);
        
        if (!shouldRetry) {
          throw lastError;
        }
      }
    }

    throw lastError || new Error("Failed to call HuggingFace API after retries");
  }

  /**
   * Generate image using a HuggingFace image generation model
   * @param modelName - Model identifier (e.g., "runwayml/stable-diffusion-v1-5")
   * @param prompt - Text prompt for image generation
   * @param options - Additional generation parameters
   * @returns Base64 encoded image string
   */
  async generateImage(
    modelName: string,
    prompt: string,
    options: HuggingFaceRequestOptions = {}
  ): Promise<string> {
    console.log(`✅ Switching to optimized Hugging Face router for image generation`);
    console.log(`🎨 Model: ${modelName}`);
    console.log(`📝 Prompt: ${prompt.substring(0, 100)}...`);

    const url = `${this.baseUrl}/models/${modelName}`;
    const payload = {
      inputs: prompt,
      parameters: {
        ...options,
      },
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
          console.log(`📥 Image generation response status: ${response.status}`);

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

          if (!response.ok) {
            const errorText = await response.text().catch(() => response.statusText);
            throw new Error(`HuggingFace image API error (${response.status}): ${errorText.substring(0, 200)}`);
          }

          // For images, response is typically base64 string or blob
          const contentType = response.headers.get("content-type");
          
          if (contentType?.includes("image")) {
            const blob = await response.blob();
            const arrayBuffer = await blob.arrayBuffer();
            const bytes = new Uint8Array(arrayBuffer);
            // Convert to base64 using btoa (available in Deno)
            let binary = '';
            for (let i = 0; i < bytes.length; i++) {
              binary += String.fromCharCode(bytes[i]);
            }
            const base64 = btoa(binary);
            console.log(`✅ Image generated successfully`);
            return base64;
          } else {
            // Some models return JSON with base64 image
            const data = await response.json() as any;
            if (data.generated_image || data.image) {
              console.log(`✅ Image generated successfully (from JSON)`);
              return data.generated_image || data.image;
            }
            // Try to extract from array format
            if (Array.isArray(data) && data[0]) {
              return data[0].generated_image || data[0].image || data[0];
            }
            throw new Error("Unexpected response format for image generation");
          }

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
   * Extract generated text from HuggingFace API response
   * Handles various response formats
   */
  private extractGeneratedText(data: HuggingFaceResponse | HuggingFaceResponse[]): string | null {
    // Handle array responses
    if (Array.isArray(data)) {
      if (data[0]?.generated_text) {
        return data[0].generated_text.trim();
      }
      if (data[0]?.summary_text) {
        return data[0].summary_text.trim();
      }
      if (typeof data[0] === "string") {
        return data[0].trim();
      }
      // Check nested structure
      if (data[0] && typeof data[0] === "object") {
        const firstItem = data[0] as HuggingFaceResponse;
        if (firstItem.generated_text) {
          return firstItem.generated_text.trim();
        }
      }
    }

    // Handle object responses
    if (data && typeof data === "object" && !Array.isArray(data)) {
      const response = data as HuggingFaceResponse;
      if (response.generated_text) {
        return response.generated_text.trim();
      }
      if (response.summary_text) {
        return response.summary_text.trim();
      }
      if (response.text) {
        return response.text.trim();
      }
      
      // Check common text fields
      const textFields = ['output', 'result', 'content', 'response'];
      for (const field of textFields) {
        const value = (response as any)[field];
        if (typeof value === 'string') {
          return value.trim();
        }
      }
    }

    // Handle string responses
    if (typeof data === "string") {
      return data.trim();
    }

    return null;
  }

  /**
   * Create a client instance from environment variable
   * @param baseUrl - Optional base URL override
   */
  static fromEnvironment(baseUrl?: string): HuggingFaceClient {
    const apiKey = Deno.env.get("HUGGINGFACE_API_KEY");
    if (!apiKey) {
      throw new Error("HUGGINGFACE_API_KEY environment variable is not set");
    }
    return new HuggingFaceClient(apiKey, baseUrl);
  }
}

