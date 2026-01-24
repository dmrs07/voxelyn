/**
 * @voxelyn/ai - OpenAI Provider
 *
 * LLM client implementation for OpenAI models.
 */

import { BaseLLMClient, type BaseClientConfig } from '../base-client';
import type { LLMProvider, ModelId } from '../types';

// ============================================================================
// TYPES
// ============================================================================

export type OpenAIConfig = {
  apiKey: string;
  model?: ModelId['openai'];
  organization?: string;
  baseURL?: string;
} & Partial<BaseClientConfig>;

type ChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

type ChatCompletionResponse = {
  choices: Array<{
    message: {
      content: string | null;
    };
  }>;
};

// ============================================================================
// OPENAI CLIENT
// ============================================================================

/**
 * OpenAI LLM client implementation.
 * Uses fetch directly to avoid adding heavy SDK dependency.
 */
export class OpenAIClient extends BaseLLMClient {
  readonly provider: LLMProvider = 'openai';
  readonly model: string;

  private apiKey: string;
  private baseURL: string;
  private organization?: string;

  constructor(config: OpenAIConfig) {
    super(config);

    this.model = config.model ?? 'gpt-4o-mini';
    this.apiKey = config.apiKey;
    this.baseURL = config.baseURL ?? 'https://api.openai.com/v1';
    this.organization = config.organization;
  }

  protected async generateContent(
    systemPrompt: string,
    userPrompt: string,
    options?: { temperature?: number; maxTokens?: number }
  ): Promise<string> {
    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ];

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.apiKey}`,
    };

    if (this.organization) {
      headers['OpenAI-Organization'] = this.organization;
    }

    const response = await fetch(`${this.baseURL}/chat/completions`, {
      method: 'POST',
      headers,
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
      throw new Error(`OpenAI API error (${response.status}): ${errorText}`);
    }

    const data = (await response.json()) as ChatCompletionResponse;
    const content = data.choices[0]?.message?.content;

    if (!content) {
      throw new Error('Empty response from OpenAI');
    }

    return content;
  }
}

/**
 * Create an OpenAI client.
 */
export function createOpenAIClient(config: OpenAIConfig): OpenAIClient {
  return new OpenAIClient(config);
}
