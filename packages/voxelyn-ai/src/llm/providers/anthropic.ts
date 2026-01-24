/**
 * @voxelyn/ai - Anthropic Provider
 *
 * LLM client implementation for Anthropic Claude models.
 */

import { BaseLLMClient, type BaseClientConfig } from '../base-client';
import type { LLMProvider, ModelId } from '../types';

// ============================================================================
// TYPES
// ============================================================================

export type AnthropicConfig = {
  apiKey: string;
  model?: ModelId['anthropic'];
} & Partial<BaseClientConfig>;

type AnthropicMessage = {
  role: 'user' | 'assistant';
  content: string;
};

type AnthropicResponse = {
  content: Array<{
    type: 'text';
    text: string;
  }>;
};

// ============================================================================
// ANTHROPIC CLIENT
// ============================================================================

/**
 * Anthropic Claude LLM client implementation.
 * Uses fetch directly to avoid adding heavy SDK dependency.
 */
export class AnthropicClient extends BaseLLMClient {
  readonly provider: LLMProvider = 'anthropic';
  readonly model: string;

  private apiKey: string;
  private baseURL: string;

  constructor(config: AnthropicConfig) {
    super(config);

    this.model = config.model ?? 'claude-sonnet-4-20250514';
    this.apiKey = config.apiKey;
    this.baseURL = 'https://api.anthropic.com/v1';
  }

  protected async generateContent(
    systemPrompt: string,
    userPrompt: string,
    options?: { temperature?: number; maxTokens?: number }
  ): Promise<string> {
    const messages: AnthropicMessage[] = [{ role: 'user', content: userPrompt }];

    const response = await fetch(`${this.baseURL}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: options?.maxTokens ?? 4096,
        system: systemPrompt,
        messages,
        temperature: options?.temperature ?? 0.7,
      }),
      signal: AbortSignal.timeout(this.config.timeoutMs),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Anthropic API error (${response.status}): ${errorText}`);
    }

    const data = (await response.json()) as AnthropicResponse;
    const textContent = data.content.find((c) => c.type === 'text');

    if (!textContent?.text) {
      throw new Error('Empty response from Anthropic');
    }

    return textContent.text;
  }
}

/**
 * Create an Anthropic Claude client.
 */
export function createAnthropicClient(config: AnthropicConfig): AnthropicClient {
  return new AnthropicClient(config);
}
