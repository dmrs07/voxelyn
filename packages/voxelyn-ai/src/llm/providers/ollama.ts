/**
 * @voxelyn/ai - Ollama Provider
 *
 * LLM client implementation for local Ollama models.
 */

import { BaseLLMClient, type BaseClientConfig } from '../base-client';
import type { LLMProvider, ModelId } from '../types';

// ============================================================================
// TYPES
// ============================================================================

export type OllamaConfig = {
  /**
   * Ollama server URL.
   * Default: http://localhost:11434
   */
  baseURL?: string;
  /**
   * Model to use.
   * Default: llama3.2
   */
  model?: ModelId['ollama'];
} & Partial<BaseClientConfig>;

type OllamaGenerateResponse = {
  model: string;
  response: string;
  done: boolean;
};

type OllamaChatResponse = {
  message: {
    role: string;
    content: string;
  };
  done: boolean;
};

// ============================================================================
// OLLAMA CLIENT
// ============================================================================

/**
 * Ollama LLM client implementation.
 * Connects to a local Ollama server.
 */
export class OllamaClient extends BaseLLMClient {
  readonly provider: LLMProvider = 'ollama';
  readonly model: string;

  private baseURL: string;

  constructor(config: OllamaConfig = {}) {
    super(config);

    this.model = config.model ?? 'llama3.2';
    this.baseURL = config.baseURL ?? 'http://localhost:11434';
  }

  protected async generateContent(
    systemPrompt: string,
    userPrompt: string,
    options?: { temperature?: number; maxTokens?: number }
  ): Promise<string> {
    // Use chat endpoint for better system prompt support
    const response = await fetch(`${this.baseURL}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        stream: false,
        options: {
          temperature: options?.temperature ?? 0.7,
          num_predict: options?.maxTokens ?? 4096,
        },
      }),
      signal: AbortSignal.timeout(this.config.timeoutMs),
    });

    if (!response.ok) {
      // Fall back to generate endpoint for models that don't support chat
      if (response.status === 400) {
        return this.generateWithGenerateAPI(systemPrompt, userPrompt, options);
      }

      const errorText = await response.text();
      throw new Error(`Ollama API error (${response.status}): ${errorText}`);
    }

    const data = (await response.json()) as OllamaChatResponse;

    if (!data.message?.content) {
      throw new Error('Empty response from Ollama');
    }

    return data.message.content;
  }

  /**
   * Fallback to /api/generate for models without chat support.
   */
  private async generateWithGenerateAPI(
    systemPrompt: string,
    userPrompt: string,
    options?: { temperature?: number; maxTokens?: number }
  ): Promise<string> {
    const response = await fetch(`${this.baseURL}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        prompt: `${systemPrompt}\n\n${userPrompt}`,
        stream: false,
        options: {
          temperature: options?.temperature ?? 0.7,
          num_predict: options?.maxTokens ?? 4096,
        },
      }),
      signal: AbortSignal.timeout(this.config.timeoutMs),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Ollama API error (${response.status}): ${errorText}`);
    }

    const data = (await response.json()) as OllamaGenerateResponse;

    if (!data.response) {
      throw new Error('Empty response from Ollama');
    }

    return data.response;
  }

  /**
   * Test connection to Ollama server.
   */
  async testConnection(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseURL}/api/tags`, {
        signal: AbortSignal.timeout(5000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * List available models on the Ollama server.
   */
  async listModels(): Promise<string[]> {
    try {
      const response = await fetch(`${this.baseURL}/api/tags`, {
        signal: AbortSignal.timeout(5000),
      });

      if (!response.ok) {
        return [];
      }

      const data = (await response.json()) as { models: Array<{ name: string }> };
      return data.models.map((m) => m.name);
    } catch {
      return [];
    }
  }
}

/**
 * Create an Ollama client.
 */
export function createOllamaClient(config: OllamaConfig = {}): OllamaClient {
  return new OllamaClient(config);
}
