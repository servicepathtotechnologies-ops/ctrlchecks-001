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
      }

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `Gemini API error: ${response.status}`;

        try {
          const errorJson = JSON.parse(errorText);
          const apiError = errorJson.error || errorJson;
          errorMessage = apiError.message || apiError.error?.message || errorMessage;

          if (response.status === 404) {
            errorMessage = `Model "${attemptModel}" not found in ${apiVersion} API. ${errorMessage}. Please verify your API key has access to Gemini models and check available models.`;
          }
        } catch {
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
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(`Gemini API request failed: ${String(error)}`);
    }
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

