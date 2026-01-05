/**
 * LLM Adapter for Workflow Generation
 * Supports multiple LLM providers: Gemini, Hugging Face (Router API + Inference API fallback)
 */

import { HuggingFaceRouterClient } from "../_shared/huggingface-client.ts";

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMOptions {
  model: string;
  temperature?: number;
  maxTokens?: number;
  apiKey?: string;
  stream?: boolean;
}

export interface LLMResponse {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  model?: string;
  finishReason?: string;
}

// Hugging Face model configuration
export const HUGGINGFACE_MODELS = {
  primary: "Qwen/Qwen2.5-7B-Instruct",
  fallback: "mistralai/Mistral-7B-Instruct-v0.2",
  lightweight: "google/flan-t5-large",
  planning: "meta-llama/Llama-3-8B-Instruct",
};

// Model mapping for different workflow generation tasks
export const HF_MODEL_MAP: Record<string, string> = {
  'qwen-7b': HUGGINGFACE_MODELS.primary,
  'qwen2.5-7b': HUGGINGFACE_MODELS.primary,
  'mistral-7b': HUGGINGFACE_MODELS.fallback,
  'mistral-7b-instruct': HUGGINGFACE_MODELS.fallback,
  'flan-t5-large': HUGGINGFACE_MODELS.lightweight,
  'llama-3-8b': HUGGINGFACE_MODELS.planning,
  // Default mapping
  'default': HUGGINGFACE_MODELS.primary,
};

export class LLMAdapter {
  async chatGemini(
    messages: LLMMessage[],
    options: LLMOptions
  ): Promise<LLMResponse> {
    const apiKey = options.apiKey || Deno.env.get('GEMINI_API_KEY');
    if (!apiKey) {
      throw new Error('Gemini API key required. Provide apiKey in options or set GEMINI_API_KEY environment variable.');
    }

    const modelMap: Record<string, string> = {
      'gemini-2.5-flash': 'gemini-2.5-flash',
      'gemini-2.5-pro': 'gemini-2.5-pro',
      'gemini-2.5-flash-lite': 'gemini-2.5-flash-lite',
      'gemini-1.5-flash': 'gemini-1.5-flash',
      'gemini-1.5-pro': 'gemini-1.5-pro',
      'gemini-pro': 'gemini-1.5-flash',
    };

    const model = modelMap[options.model] || 'gemini-2.5-flash';

    const systemInstruction = messages.find(m => m.role === 'system')?.content;
    const conversationParts = messages
      .filter(m => m.role !== 'system')
      .map(msg => ({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }],
      }));

    let apiVersion = 'v1beta';
    let attemptModel = model;
    let retries = 0;
    const MAX_RETRIES = 3;

    while (retries <= MAX_RETRIES) {
      try {
        let url = `https://generativelanguage.googleapis.com/${apiVersion}/models/${attemptModel}:generateContent?key=${apiKey}`;

        let response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: conversationParts,
            systemInstruction: systemInstruction ? {
              parts: [{ text: systemInstruction }],
            } : undefined,
            generationConfig: {
              temperature: options.temperature ?? 0.7,
              maxOutputTokens: options.maxTokens,
            },
          }),
        });

        // Handle 429 / 503 errors specifically for retry
        if (response.status === 429 || response.status === 503) {
          throw { isRateLimit: true, status: response.status, headers: response.headers };
        }

        if (response.status === 404) {
          const fallbackModels = [
            'gemini-2.5-flash',
            'gemini-2.0-flash-exp',
            'gemini-1.5-flash',
            'gemini-1.5-pro',
          ];

          for (const fallbackModel of fallbackModels) {
            if (attemptModel === fallbackModel) continue;

            console.warn(`Model ${attemptModel} not found, trying fallback: ${fallbackModel}`);
            attemptModel = fallbackModel;
            url = `https://generativelanguage.googleapis.com/${apiVersion}/models/${fallbackModel}:generateContent?key=${apiKey}`;

            response = await fetch(url, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                contents: conversationParts,
                systemInstruction: systemInstruction ? {
                  parts: [{ text: systemInstruction }],
                } : undefined,
                generationConfig: {
                  temperature: options.temperature ?? 0.7,
                  maxOutputTokens: options.maxTokens,
                },
              }),
            });

            if (response.status === 429 || response.status === 503) {
              throw { isRateLimit: true, status: response.status, headers: response.headers };
            }

            if (response.ok) {
              console.log(`Successfully using fallback model: ${fallbackModel}`);
              break;
            }
          }
        }

        if (response.status === 404 && apiVersion === 'v1beta') {
          console.warn('v1beta API failed, trying v1 API');
          apiVersion = 'v1';
          url = `https://generativelanguage.googleapis.com/v1/models/${attemptModel}:generateContent?key=${apiKey}`;

          response = await fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              contents: conversationParts,
              systemInstruction: systemInstruction ? {
                parts: [{ text: systemInstruction }],
              } : undefined,
              generationConfig: {
                temperature: options.temperature ?? 0.7,
                maxOutputTokens: options.maxTokens,
              },
            }),
          });

          if (response.status === 429 || response.status === 503) {
            throw { isRateLimit: true, status: response.status, headers: response.headers };
          }
        }

        if (!response.ok) {
          const errorText = await response.text();
          let errorMessage = `Gemini API error: ${response.status}`;

          try {
            const errorJson = JSON.parse(errorText);
            const apiError = errorJson.error || errorJson;
            const apiErrorMessage = apiError.message || apiError.error?.message || errorText;
            errorMessage = apiErrorMessage;

            // 🚨 CRITICAL: Check for quota/rate limit errors (429) in body even if status wasn't 429
            if (apiErrorMessage.toLowerCase().includes('quota') ||
              apiErrorMessage.toLowerCase().includes('rate limit') ||
              apiErrorMessage.toLowerCase().includes('resource exhausted') ||
              apiErrorMessage.toLowerCase().includes('quota exceeded')) {
              throw { isRateLimit: true, status: 429, headers: response.headers, message: apiErrorMessage };
            }

            if (response.status === 404) {
              errorMessage = `Model "${attemptModel}" not found in ${apiVersion} API. ${errorMessage}. Please verify your API key has access to Gemini models and check available models.`;
            }
          } catch (parseError) {
            if ((parseError as any).isRateLimit) throw parseError;
            errorMessage += ` - ${errorText}`;
          }

          throw new Error(errorMessage);
        }

        const data = await response.json();

        const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        const usageInfo = data.usageMetadata;

        if (attemptModel !== model) {
          console.log(`Successfully used fallback model: ${attemptModel} (requested: ${model})`);
        }

        return {
          content,
          usage: usageInfo ? {
            promptTokens: usageInfo.promptTokenCount || 0,
            completionTokens: usageInfo.candidatesTokenCount || 0,
            totalTokens: usageInfo.totalTokenCount || 0,
          } : undefined,
          model: data.model || attemptModel,
          finishReason: data.candidates?.[0]?.finishReason,
        };

      } catch (error: any) {
        // Handle Rate Limit / Quota Errors with Backoff
        if (error.isRateLimit || (error.message && (
          error.message.includes('429') ||
          error.message.toLowerCase().includes('quota') ||
          error.message.toLowerCase().includes('rate limit')
        ))) {
          if (retries < MAX_RETRIES) {
            const retryStatus = error.status || 429;
            // Calculate delay: 3s, 6s, 12s... + jitter
            const backoffDelays = [3000, 6000, 12000]; // 3s, 6s, 12s backoff
            const baseDelay = backoffDelays[retries];
            const jitter = Math.random() * 1000;
            const delay = baseDelay + jitter;

            console.warn(`[GEMINI] Rate limit hit (${retryStatus}). Retrying in ${Math.round(delay)}ms... (Attempt ${retries + 1}/${MAX_RETRIES})`);
            await new Promise(resolve => setTimeout(resolve, delay));
            retries++;
            continue; // Retry loop
          } else {
            // Retries exhausted
            console.error('[GEMINI] Max retries exhausted for rate limit.');
            // Convert to friendly error
            const quotaError = `QUOTA_EXCEEDED: Gemini API quota exceeded after ${MAX_RETRIES} retries. Please wait a minute before trying again.`;
            const quotaErr = new Error(quotaError);
            (quotaErr as any).isQuotaError = true;
            (quotaErr as any).statusCode = 429;
            throw quotaErr;
          }
        }

        // Non-retriable error
        if (error instanceof Error) {
          throw error;
        }
        throw new Error(`Gemini API request failed: ${String(error)}`);
      }
    }

    throw new Error('Unexpected end of retry loop'); // Should be unreachable

  }

  /**
   * Chat with Hugging Face models (Router API with Inference API fallback)
   */
  async chatHuggingFace(
    messages: LLMMessage[],
    options: LLMOptions
  ): Promise<LLMResponse> {
    const apiKey = options.apiKey || Deno.env.get('HUGGINGFACE_API_KEY');
    if (!apiKey) {
      throw new Error('HuggingFace API key required. Provide apiKey in options or set HUGGINGFACE_API_KEY environment variable.');
    }

    // Map model name to actual HuggingFace model
    const modelName = HF_MODEL_MAP[options.model.toLowerCase()] || options.model || HUGGINGFACE_MODELS.primary;
    
    // Fallback model sequence: primary → fallback → lightweight
    const fallbackModels = [
      modelName,
      HUGGINGFACE_MODELS.fallback,
      HUGGINGFACE_MODELS.lightweight,
    ].filter((m, i, arr) => arr.indexOf(m) === i); // Remove duplicates

    let lastError: Error | null = null;

    // Try Router API first (OpenAI-compatible, better performance)
    for (const attemptModel of fallbackModels) {
      try {
        const hfClient = new HuggingFaceRouterClient(apiKey);
        
        // Convert messages format (system message handling)
        const systemMessage = messages.find(m => m.role === 'system');
        const conversationMessages = messages.filter(m => m.role !== 'system');
        
        // If system message exists, prepend it as first user message with instruction
        const formattedMessages = systemMessage 
          ? [
              { role: 'user' as const, content: `System: ${systemMessage.content}\n\nUser:` },
              ...conversationMessages.map(msg => ({
                role: msg.role === 'assistant' ? 'assistant' as const : 'user' as const,
                content: msg.content
              }))
            ]
          : conversationMessages.map(msg => ({
              role: msg.role === 'assistant' ? 'assistant' as const : 'user' as const,
              content: msg.content
            }));

        console.log(`[HF] Attempting model: ${attemptModel} (Router API)`);
        
        const response = await hfClient.generateText(attemptModel, formattedMessages, {
          temperature: options.temperature ?? 0.3,
          max_tokens: options.maxTokens ?? 2048,
        });

        console.log(`[HF] Success with model: ${attemptModel}`);
        
        return {
          content: response,
          model: attemptModel,
          finishReason: 'stop',
        };

      } catch (error: any) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.warn(`[HF] Router API failed for ${attemptModel}: ${errorMsg}`);
        lastError = error instanceof Error ? error : new Error(String(error));
        
        // If model not supported or 404, try next model
        if (errorMsg.includes('not supported') || errorMsg.includes('404') || errorMsg.includes('not found')) {
          continue; // Try next fallback model
        }
        
        // For other errors (rate limits, timeouts), try next model once
        if (attemptModel !== fallbackModels[fallbackModels.length - 1]) {
          continue; // Try next model
        }
        
        // Last model failed, will try Inference API fallback
        break;
      }
    }

    // Fallback to Inference API (legacy API)
    console.log('[HF] Router API failed, trying Inference API fallback...');
    for (const attemptModel of fallbackModels) {
      try {
        const response = await this.callHuggingFaceInferenceAPI(
          attemptModel,
          messages,
          {
            apiKey,
            temperature: options.temperature ?? 0.3,
            maxTokens: options.maxTokens ?? 2048,
          }
        );

        console.log(`[HF] Success with Inference API: ${attemptModel}`);
        
        return {
          content: response,
          model: attemptModel,
          finishReason: 'stop',
        };

      } catch (error: any) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.warn(`[HF] Inference API failed for ${attemptModel}: ${errorMsg}`);
        lastError = error instanceof Error ? error : new Error(String(error));
        
        // Try next model
        if (attemptModel !== fallbackModels[fallbackModels.length - 1]) {
          continue;
        }
      }
    }

    // All models failed
    throw lastError || new Error('All HuggingFace models failed');
  }

  /**
   * Call HuggingFace Inference API (legacy API, used as fallback)
   */
  private async callHuggingFaceInferenceAPI(
    modelName: string,
    messages: LLMMessage[],
    options: { apiKey: string; temperature?: number; maxTokens?: number }
  ): Promise<string> {
    // Combine messages into a single prompt
    const systemMessage = messages.find(m => m.role === 'system');
    const conversationMessages = messages.filter(m => m.role !== 'system');
    
    let prompt = '';
    if (systemMessage) {
      prompt += `System: ${systemMessage.content}\n\n`;
    }
    
    for (const msg of conversationMessages) {
      prompt += `${msg.role === 'assistant' ? 'Assistant' : 'User'}: ${msg.content}\n\n`;
    }
    prompt += 'Assistant:';

    const url = `https://api-inference.huggingface.co/models/${modelName}`;
    const headers = {
      'Authorization': `Bearer ${options.apiKey}`,
      'Content-Type': 'application/json',
    };

    const payload: any = {
      inputs: prompt,
      parameters: {
        temperature: options.temperature ?? 0.3,
        max_new_tokens: options.maxTokens ?? 2048,
        return_full_text: false,
      },
      options: {
        wait_for_model: true,
      },
    };

    let retries = 0;
    const MAX_RETRIES = 3;

    while (retries <= MAX_RETRIES) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s timeout

        const response = await fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (response.status === 503) {
          // Model is loading
          const errorData = await response.json().catch(() => ({}));
          const estimatedTime = (errorData as any).estimated_time || 10;
          
          if (retries < MAX_RETRIES) {
            const waitTime = Math.min(estimatedTime * 1000, 20000);
            console.log(`[HF Inference] Model loading, waiting ${waitTime}ms...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
            retries++;
            continue;
          }
          throw new Error(`Model is loading. Estimated time: ${estimatedTime}s`);
        }

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`HuggingFace Inference API error (${response.status}): ${errorText.substring(0, 200)}`);
        }

        const data = await response.json();
        
        // Handle different response formats
        if (Array.isArray(data) && data[0]?.generated_text) {
          return data[0].generated_text.trim();
        }
        if (data.generated_text) {
          return data.generated_text.trim();
        }
        if (typeof data === 'string') {
          return data.trim();
        }

        throw new Error('Invalid response format from HuggingFace Inference API');

      } catch (error: any) {
        if (error.name === 'AbortError') {
          throw new Error('Request timeout');
        }
        
        if (retries < MAX_RETRIES && (error.message?.includes('503') || error.message?.includes('loading'))) {
          retries++;
          continue;
        }
        
        throw error;
      }
    }

    throw new Error('Failed to call HuggingFace Inference API after retries');
  }

  async chat(
    provider: 'openai' | 'gemini' | 'huggingface',
    messages: LLMMessage[],
    options: LLMOptions
  ): Promise<LLMResponse> {
    if (provider === 'gemini') {
      return this.chatGemini(messages, options);
    }
    if (provider === 'huggingface') {
      return this.chatHuggingFace(messages, options);
    }
    throw new Error(`Unsupported provider: ${provider}`);
  }
}

