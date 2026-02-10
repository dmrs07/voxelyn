/**
 * @voxelyn/ai - Gemini Provider
 *
 * LLM client implementation for Google's Gemini models.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { BaseLLMClient, type BaseClientConfig } from '../base-client';
import type { LLMProvider, ModelId } from '../types';

// ============================================================================
// TYPES
// ============================================================================

export type GeminiConfig = {
  apiKey: string;
  model?: ModelId['gemini'];
} & Partial<BaseClientConfig>;

// ============================================================================
// GEMINI CLIENT
// ============================================================================

/**
 * Gemini LLM client implementation.
 */
export class GeminiClient extends BaseLLMClient {
  readonly provider: LLMProvider = 'gemini';
  readonly model: string;

  private genAI: GoogleGenerativeAI;
  private generativeModel: ReturnType<GoogleGenerativeAI['getGenerativeModel']>;

  constructor(config: GeminiConfig) {
    super(config);

    this.model = config.model ?? 'gemini-2.5-flash-lite';
    this.genAI = new GoogleGenerativeAI(config.apiKey);
    this.generativeModel = this.genAI.getGenerativeModel({
      model: this.model,
    });
  }

  protected async generateContent(
    systemPrompt: string,
    userPrompt: string,
    options?: { temperature?: number; maxTokens?: number }
  ): Promise<string> {
    try {
      const result = await this.generativeModel.generateContent({
        contents: [
          {
            role: 'user',
            parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }],
          },
        ],
        generationConfig: {
          temperature: options?.temperature ?? 0.7,
          maxOutputTokens: options?.maxTokens ?? 4096,
          responseMimeType: 'application/json',
        },
      });

      const response = result.response;
      const text = response.text();

      if (!text) {
        throw new Error('GEMINI_EMPTY_RESPONSE');
      }

      return text;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.toLowerCase().includes('429') || message.toLowerCase().includes('quota')) {
        throw new Error(`GEMINI_RATE_LIMIT: ${message}`);
      }
      if (message.toLowerCase().includes('timeout') || message.toLowerCase().includes('abort')) {
        throw new Error(`GEMINI_TIMEOUT: ${message}`);
      }
      throw new Error(`GEMINI_ERROR: ${message}`);
    }
  }
}

/**
 * Create a Gemini client.
 */
export function createGeminiClient(config: GeminiConfig): GeminiClient {
  return new GeminiClient(config);
}
