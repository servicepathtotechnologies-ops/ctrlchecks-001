/**
 * LLM Adapter for Workflow Generation
 * Supports multiple LLM providers (currently Gemini)
 */

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
            // Calculate delay: 2s, 4s, 8s... + jitter
            const baseDelay = 2000 * Math.pow(2, retries);
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

  async chat(
    provider: 'openai' | 'gemini',
    messages: LLMMessage[],
    options: LLMOptions
  ): Promise<LLMResponse> {
    if (provider === 'gemini') {
      return this.chatGemini(messages, options);
    }
    throw new Error(`Unsupported provider: ${provider}`);
  }
}

