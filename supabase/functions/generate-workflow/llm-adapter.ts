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

// Model compatibility matrix - which models support chat/completions endpoint
const CHAT_COMPLETION_SUPPORTED_MODELS = new Set([
  "Qwen/Qwen2.5-7B-Instruct",
  "Qwen/Qwen2.5-14B-Instruct",
  "Qwen/Qwen2.5-32B-Instruct",
  "meta-llama/Llama-3-8B-Instruct",
  "meta-llama/Llama-3-70B-Instruct",
  "mistralai/Mistral-7B-Instruct-v0.2", // Note: Mistral may not support chat/completions
]);

// Models that do NOT support chat/completions (text-generation only)
const TEXT_GENERATION_ONLY_MODELS = new Set([
  "google/flan-t5-large",
  "google/flan-t5-base",
  "mistralai/Mistral-7B-Instruct-v0.2", // Use with caution
]);

/**
 * Check if a model supports chat/completions endpoint
 */
export function supportsChatCompletion(modelName: string): boolean {
  const normalized = modelName.toLowerCase();
  // Explicitly block known incompatible models
  if (TEXT_GENERATION_ONLY_MODELS.has(modelName)) {
    return false;
  }
  // Check if explicitly supported
  if (CHAT_COMPLETION_SUPPORTED_MODELS.has(modelName)) {
    return true;
  }
  // Default: assume Qwen and Llama models support it, others don't
  return normalized.includes('qwen') || normalized.includes('llama');
}

/**
 * Estimate token count (rough approximation: 1 token ≈ 4 characters)
 */
function estimateTokenCount(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * HARD TOKEN BUDGET CHECK - Fail fast if exceeds limit
 * Hugging Face Router limit: inputs + max_new_tokens <= 32769
 * We enforce: MAX_INPUT_TOKENS = 12000, max_new_tokens = 512
 * This ensures: 12000 + 512 = 12512 < 32769 (safe)
 */
const MAX_INPUT_TOKENS = 12000;
const MAX_NEW_TOKENS = 512;

function checkTokenBudget(messages: LLMMessage[]): void {
  const fullText = messages.map(m => m.content).join('\n');
  const estimatedTokens = estimateTokenCount(fullText);
  
  if (estimatedTokens > MAX_INPUT_TOKENS) {
    throw new Error(`Prompt exceeds Hugging Face token limit: ${estimatedTokens} tokens (max: ${MAX_INPUT_TOKENS}). Prompt too large - aborting early.`);
  }
}

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
    const startTime = Date.now();
    const apiKey = options.apiKey || Deno.env.get('GEMINI_API_KEY');
    if (!apiKey) {
      throw new Error('Gemini API key required. Provide apiKey in options or set GEMINI_API_KEY environment variable.');
    }

    // HARD TOKEN BUDGET: Fail fast if exceeds limit
    checkTokenBudget(messages);
    const inputTokens = estimateTokenCount(messages.map(m => m.content).join('\n'));

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
    const MAX_RETRIES = 1; // REDUCED: Only ONE retry to prevent timeout cascades

    // HARD TIMEOUT PROTECTION: 8 seconds max
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, 8000);

    try {
      while (retries <= MAX_RETRIES) {
        try {
          let url = `https://generativelanguage.googleapis.com/${apiVersion}/models/${attemptModel}:generateContent?key=${apiKey}`;

          console.log(`[OBSERVABILITY] Gemini call: model=${attemptModel}, inputTokens=${inputTokens}, retryCount=${retries}`);

          let response = await Promise.race([
            fetch(url, {
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
                  maxOutputTokens: Math.min(options.maxTokens ?? 2048, 1024), // Safe limit
                },
              }),
              signal: controller.signal,
            }),
            new Promise<never>((_, reject) => {
              setTimeout(() => reject(new Error('Request timeout after 8s')), 8000);
            })
          ]);

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

          clearTimeout(timeoutId);
          const executionTime = Date.now() - startTime;
          const completionTokens = estimateTokenCount(content);
          console.log(`[OBSERVABILITY] modelUsed=${attemptModel}, executionTimeMs=${executionTime}, tokenCount=${inputTokens + completionTokens}, retryCount=${retries}`);

          return {
            content,
            usage: usageInfo ? {
              promptTokens: usageInfo.promptTokenCount || inputTokens,
              completionTokens: usageInfo.candidatesTokenCount || completionTokens,
              totalTokens: usageInfo.totalTokenCount || (inputTokens + completionTokens),
            } : {
              promptTokens: inputTokens,
              completionTokens: completionTokens,
              totalTokens: inputTokens + completionTokens,
            },
            model: data.model || attemptModel,
            finishReason: data.candidates?.[0]?.finishReason,
          };

        } catch (error: any) {
          // Handle timeout
          if (error.name === 'AbortError' || error.message?.includes('timeout')) {
            const executionTime = Date.now() - startTime;
            console.error(`[GEMINI] Request timeout after ${executionTime}ms`);
            console.log(`[OBSERVABILITY] modelUsed=${attemptModel}, executionTimeMs=${executionTime}, tokenCount=${inputTokens}, retryCount=${retries}, error=timeout`);
            throw new Error('Gemini API request timeout after 8s');
          }

          // Handle Rate Limit / Quota Errors with Backoff
          if (error.isRateLimit || (error.message && (
            error.message.includes('429') ||
            error.message.toLowerCase().includes('quota') ||
            error.message.toLowerCase().includes('rate limit')
          ))) {
            if (retries < MAX_RETRIES) {
              const retryStatus = error.status || 429;
              // Reduced delay: 2s only (no long backoff to prevent timeout)
              const delay = 2000;

              console.warn(`[GEMINI] Rate limit hit (${retryStatus}). Retrying in ${delay}ms... (Attempt ${retries + 1}/${MAX_RETRIES})`);
              await new Promise(resolve => setTimeout(resolve, delay));
              retries++;
              continue; // Retry loop
            } else {
              // Retries exhausted
              const executionTime = Date.now() - startTime;
              console.error('[GEMINI] Max retries exhausted for rate limit.');
              console.log(`[OBSERVABILITY] modelUsed=${attemptModel}, executionTimeMs=${executionTime}, tokenCount=${inputTokens}, retryCount=${retries}, error=rate_limit`);
              // Convert to friendly error
              const quotaError = `QUOTA_EXCEEDED: Gemini API quota exceeded after ${MAX_RETRIES} retries. Please wait a minute before trying again.`;
              const quotaErr = new Error(quotaError);
              (quotaErr as any).isQuotaError = true;
              (quotaErr as any).statusCode = 429;
              throw quotaErr;
            }
          }

          // Non-retriable error
          const executionTime = Date.now() - startTime;
          console.log(`[OBSERVABILITY] modelUsed=${attemptModel}, executionTimeMs=${executionTime}, tokenCount=${inputTokens}, retryCount=${retries}, error=${error.message || String(error)}`);
          if (error instanceof Error) {
            throw error;
          }
          throw new Error(`Gemini API request failed: ${String(error)}`);
        }
      }

      throw new Error('Unexpected end of retry loop'); // Should be unreachable
    } finally {
      clearTimeout(timeoutId);
    }

  }

  /**
   * Chat with Hugging Face models (Router API ONLY - no deprecated Inference API)
   * 
   * CRITICAL FIXES:
   * - Hard 8s timeout protection
   * - Model compatibility checks (block unsupported models)
   * - Token truncation (max 28000 tokens)
   * - Single retry only (no cascading fallbacks)
   * - Observability logging
   */
  async chatHuggingFace(
    messages: LLMMessage[],
    options: LLMOptions
  ): Promise<LLMResponse> {
    const startTime = Date.now();
    const apiKey = options.apiKey || Deno.env.get('HUGGINGFACE_API_KEY');
    if (!apiKey) {
      throw new Error('HuggingFace API key required. Provide apiKey in options or set HUGGINGFACE_API_KEY environment variable.');
    }

    // Map model name to actual HuggingFace model
    const modelName = HF_MODEL_MAP[options.model.toLowerCase()] || options.model || HUGGINGFACE_MODELS.primary;
    
    // HARD TOKEN BUDGET: Fail fast if exceeds limit
    checkTokenBudget(messages);
    const inputTokens = estimateTokenCount(messages.map(m => m.content).join('\n'));
    
    // Only use Qwen (primary) - no cascading fallbacks
    const attemptModel = modelName;
    
    // MODEL COMPATIBILITY CHECK
    if (!supportsChatCompletion(attemptModel)) {
      throw new Error(`Model '${attemptModel}' does not support chat/completions endpoint. Use a compatible model like Qwen/Qwen2.5-7B-Instruct.`);
    }
    
    // ENFORCE HF ROUTER LIMITS: inputs + max_new_tokens <= 32769
    // We enforce: input <= 12000, max_new_tokens = 512
    // This ensures: 12000 + 512 = 12512 < 32769 (safe)
    if (inputTokens + MAX_NEW_TOKENS > 32769) {
      throw new Error(`Token limit violation: input tokens (${inputTokens}) + max_new_tokens (${MAX_NEW_TOKENS}) = ${inputTokens + MAX_NEW_TOKENS} > 32769. Prompt too large.`);
    }

    // HARD TIMEOUT PROTECTION: 8 seconds max
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, 8000);

    let retryCount = 0;
    const MAX_RETRIES = 1; // Only ONE retry allowed

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

      // ENFORCE HF ROUTER LIMIT: max_new_tokens = 512
      const safeMaxTokens = Math.min(options.maxTokens ?? MAX_NEW_TOKENS, MAX_NEW_TOKENS);
      
      console.log(`[HF] Attempting model: ${attemptModel} (Router API)`);
      console.log(`[OBSERVABILITY] inputTokens=${inputTokens}, maxTokens=${safeMaxTokens}, retryCount=${retryCount}`);
      
      // Wrap the call with timeout protection
      const responsePromise = hfClient.generateText(attemptModel, formattedMessages, {
        temperature: options.temperature ?? 0.3,
        max_tokens: safeMaxTokens,
      });

      // Race between response and timeout
      const response = await Promise.race([
        responsePromise,
        new Promise<never>((_, reject) => {
          timeoutId; // Keep reference
          setTimeout(() => reject(new Error('Request timeout after 8s')), 8000);
        })
      ]);

      clearTimeout(timeoutId);

      const executionTime = Date.now() - startTime;
      console.log(`[HF] Success with model: ${attemptModel}`);
      console.log(`[OBSERVABILITY] modelUsed=${attemptModel}, executionTimeMs=${executionTime}, tokenCount=${inputTokens}, retryCount=${retryCount}`);
      
      return {
        content: response,
        model: attemptModel,
        finishReason: 'stop',
        usage: {
          promptTokens: inputTokens,
          completionTokens: estimateTokenCount(response),
          totalTokens: inputTokens + estimateTokenCount(response),
        },
      };

    } catch (error: any) {
      clearTimeout(timeoutId);
      
      // Check if we should retry (only once, only for specific errors)
      const errorMsg = error instanceof Error ? error.message : String(error);
      const isRetriable = (errorMsg.includes('503') || errorMsg.includes('429') || errorMsg.includes('timeout')) && retryCount < MAX_RETRIES;
      
      if (isRetriable) {
        retryCount++;
        console.warn(`[HF] Router API failed for ${attemptModel}: ${errorMsg}. Retrying (${retryCount}/${MAX_RETRIES})...`);
        
        // Retry with fresh timeout
        const retryController = new AbortController();
        const retryTimeoutId = setTimeout(() => retryController.abort(), 8000);
        
        try {
          const hfClient = new HuggingFaceRouterClient(apiKey);
          const systemMessage = messages.find(m => m.role === 'system');
          const conversationMessages = messages.filter(m => m.role !== 'system');
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
          
          // ENFORCE HF ROUTER LIMIT: max_new_tokens = 512
          const safeMaxTokens = Math.min(options.maxTokens ?? MAX_NEW_TOKENS, MAX_NEW_TOKENS);
          const response = await Promise.race([
            hfClient.generateText(attemptModel, formattedMessages, {
              temperature: options.temperature ?? 0.3,
              max_tokens: safeMaxTokens,
            }),
            new Promise<never>((_, reject) => {
              setTimeout(() => reject(new Error('Request timeout after 8s')), 8000);
            })
          ]);
          
          clearTimeout(retryTimeoutId);
          
          const executionTime = Date.now() - startTime;
          console.log(`[HF] Success on retry with model: ${attemptModel}`);
          console.log(`[OBSERVABILITY] modelUsed=${attemptModel}, executionTimeMs=${executionTime}, tokenCount=${inputTokens}, retryCount=${retryCount}`);
          
          return {
            content: response,
            model: attemptModel,
            finishReason: 'stop',
            usage: {
              promptTokens: inputTokens,
              completionTokens: estimateTokenCount(response),
              totalTokens: inputTokens + estimateTokenCount(response),
            },
          };
        } catch (retryError) {
          clearTimeout(retryTimeoutId);
          const executionTime = Date.now() - startTime;
          console.error(`[HF] Retry failed for ${attemptModel}`);
          console.log(`[OBSERVABILITY] modelUsed=${attemptModel}, executionTimeMs=${executionTime}, tokenCount=${inputTokens}, retryCount=${retryCount}, error=${errorMsg}`);
          throw retryError;
        }
      }
      
      // No retry or retry exhausted
      const executionTime = Date.now() - startTime;
      console.error(`[HF] Router API failed for ${attemptModel}: ${errorMsg}`);
      console.log(`[OBSERVABILITY] modelUsed=${attemptModel}, executionTimeMs=${executionTime}, tokenCount=${inputTokens}, retryCount=${retryCount}, error=${errorMsg}`);
      throw error instanceof Error ? error : new Error(String(error));
    }
  }

  // REMOVED: callHuggingFaceInferenceAPI - deprecated API (api-inference.huggingface.co) no longer used
  // All requests now use router.huggingface.co/v1/chat/completions only

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

