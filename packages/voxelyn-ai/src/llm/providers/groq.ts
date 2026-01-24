/**
 * @voxelyn/ai - Groq Provider
 *
 * LLM client implementation for Groq's fast inference API.
 */

import { BaseLLMClient, type BaseClientConfig } from '../base-client';
import type { LLMProvider, ModelId } from '../types';

// ============================================================================
// TYPES
// ============================================================================

export type GroqConfig = {
  apiKey: string;
  model?: ModelId['groq'];
} & Partial<BaseClientConfig>;

type GroqMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

type GroqResponse = {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
};

// ============================================================================
// GROQ CLIENT
// ============================================================================

/**
 * Groq LLM client implementation.
 * Uses the Groq Cloud API for fast inference.
 */
export class GroqClient extends BaseLLMClient {
  readonly provider: LLMProvider = 'groq';
  readonly model: string;

  private apiKey: string;
  private baseURL: string;

  constructor(config: GroqConfig) {
    super(config);

    this.model = config.model ?? 'llama-3.3-70b-versatile';
    this.apiKey = config.apiKey;
    this.baseURL = 'https://api.groq.com/openai/v1';
  }

  protected async generateContent(
    systemPrompt: string,
    userPrompt: string,
    options?: { temperature?: number; maxTokens?: number }
  ): Promise<string> {
    const messages: GroqMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ];

    const response = await fetch(`${this.baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages,
        temperature: options?.temperature ?? 0.7,
        max_tokens: options?.maxTokens ?? 4096,
      }),
      signal: AbortSignal.timeout(this.config.timeoutMs),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Groq API error (${response.status}): ${errorText}`);
    }

    const data = (await response.json()) as GroqResponse;
    const content = data.choices[0]?.message?.content;

    if (!content) {
      throw new Error('Empty response from Groq');
    }

    return content;
  }
}

/**
 * Create a Groq client.
 */
export function createGroqClient(config: GroqConfig): GroqClient {
  return new GroqClient(config);
}
