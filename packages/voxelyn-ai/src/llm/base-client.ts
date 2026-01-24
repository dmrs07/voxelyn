/**
 * @voxelyn/ai - Base LLM Client
 *
 * Abstract base class with shared functionality for all LLM providers.
 */

import type { Material } from '@voxelyn/core';
import type {
  TextureParams,
  ObjectBlueprint,
  ScenarioLayout,
  AIGenerationResult,
} from '../types';

import {
  DEFAULT_TEXTURE_PARAMS,
  DEFAULT_OBJECT_BLUEPRINT,
  DEFAULT_SCENARIO_LAYOUT,
} from '../types';

import {
  TEXTURE_SYSTEM_PROMPT,
  OBJECT_SYSTEM_PROMPT,
  SCENARIO_SYSTEM_PROMPT,
  buildTexturePrompt,
  buildObjectPrompt,
  buildScenarioPrompt,
  validateTextureParams,
  validateObjectBlueprint,
  validateScenarioLayout,
} from '../prompts/templates';

import type {
  LLMClient,
  LLMProvider,
  ProviderInfo,
  TextureGenerationOptions,
  ObjectGenerationOptions,
  ScenarioGenerationOptions,
} from './types';

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Extracts JSON from a response that might contain markdown code blocks.
 */
export function extractJSON(text: string): string {
  // Try to extract from markdown code block first
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    return codeBlockMatch[1]!.trim();
  }

  // Try to find JSON object/array directly
  const jsonMatch = text.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
  if (jsonMatch) {
    return jsonMatch[1]!.trim();
  }

  // Return as-is and let JSON.parse fail
  return text.trim();
}

/**
 * Sleep helper for retry backoff.
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry with exponential backoff.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number,
  debug: boolean,
  providerName: string
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt < maxRetries) {
        const backoffMs = Math.min(1000 * Math.pow(2, attempt), 10000);
        if (debug) {
          console.warn(`[voxelyn-ai:${providerName}] Attempt ${attempt + 1} failed, retrying in ${backoffMs}ms...`);
        }
        await sleep(backoffMs);
      }
    }
  }

  throw lastError ?? new Error('Unknown error after retries');
}

// ============================================================================
// BASE CLIENT
// ============================================================================

export type BaseClientConfig = {
  maxRetries: number;
  timeoutMs: number;
  debug: boolean;
};

/**
 * Abstract base class for LLM clients.
 * Handles common logic for generation, validation, and error handling.
 */
export abstract class BaseLLMClient implements LLMClient {
  abstract readonly provider: LLMProvider;
  abstract readonly model: string;
  
  protected config: BaseClientConfig;

  constructor(config: Partial<BaseClientConfig> = {}) {
    this.config = {
      maxRetries: config.maxRetries ?? 2,
      timeoutMs: config.timeoutMs ?? 30000,
      debug: config.debug ?? false,
    };
  }

  /**
   * Generate content with the underlying LLM.
   * Must be implemented by each provider.
   */
  protected abstract generateContent(
    systemPrompt: string,
    userPrompt: string,
    options?: { temperature?: number; maxTokens?: number }
  ): Promise<string>;

  /**
   * Test API connection.
   * Can be overridden for provider-specific tests.
   */
  async testConnection(): Promise<boolean> {
    try {
      if (this.config.debug) {
        console.log(`[voxelyn-ai:${this.provider}] Testing connection...`);
      }
      const response = await this.generateContent(
        'You are a helpful assistant.',
        'Say "ok" if you can read this.',
        { maxTokens: 10 }
      );
      const text = response.toLowerCase();
      if (this.config.debug) {
        console.log(`[voxelyn-ai:${this.provider}] Test response:`, text);
      }
      return text.includes('ok');
    } catch (e) {
      if (this.config.debug) {
        console.error(`[voxelyn-ai:${this.provider}] Test connection failed:`, e);
      }
      return false;
    }
  }

  /**
   * Get provider information.
   */
  getInfo(): ProviderInfo {
    return {
      provider: this.provider,
      model: this.model,
      connected: false, // Will be updated after testConnection
    };
  }

  /**
   * Generic generation with validation.
   */
  protected async generate<T>(
    systemPrompt: string,
    userPrompt: string,
    validator: (obj: unknown) => obj is T,
    defaultValue: T,
    typeName: string,
    options?: { temperature?: number; maxTokens?: number }
  ): Promise<AIGenerationResult<T>> {
    const startTime = Date.now();

    try {
      const responseText = await withRetry(
        () => this.generateContent(systemPrompt, userPrompt, options),
        this.config.maxRetries,
        this.config.debug,
        this.provider
      );

      if (this.config.debug) {
        console.log(`[voxelyn-ai:${this.provider}] Raw ${typeName} response:`, responseText.slice(0, 500));
      }

      const jsonStr = extractJSON(responseText);
      let parsed: unknown;

      try {
        parsed = JSON.parse(jsonStr);
      } catch (parseError) {
        if (this.config.debug) {
          console.error(`[voxelyn-ai:${this.provider}] JSON parse error for ${typeName}:`, parseError);
        }
        return {
          success: false,
          error: `Failed to parse AI response as JSON: ${parseError}`,
          data: defaultValue,
          generationTimeMs: Date.now() - startTime,
        };
      }

      if (!validator(parsed)) {
        if (this.config.debug) {
          console.warn(`[voxelyn-ai:${this.provider}] Validation failed for ${typeName}, using defaults`);
        }
        // Merge with defaults for partial responses
        return {
          success: true,
          data: { ...defaultValue, ...(parsed as Partial<T>) } as T,
          generationTimeMs: Date.now() - startTime,
        };
      }

      return {
        success: true,
        data: parsed,
        generationTimeMs: Date.now() - startTime,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      if (this.config.debug) {
        console.error(`[voxelyn-ai:${this.provider}] Generation error for ${typeName}:`, error);
      }

      return {
        success: false,
        error: errorMessage,
        data: defaultValue,
        generationTimeMs: Date.now() - startTime,
      };
    }
  }

  // ============================================================================
  // PUBLIC METHODS (LLMClient interface)
  // ============================================================================

  async predictTextureParams(
    prompt: string,
    palette?: Material[],
    options?: TextureGenerationOptions
  ): Promise<AIGenerationResult<TextureParams>> {
    const userPrompt = buildTexturePrompt(prompt, palette, options);

    const result = await this.generate<TextureParams>(
      TEXTURE_SYSTEM_PROMPT,
      userPrompt,
      validateTextureParams,
      { ...DEFAULT_TEXTURE_PARAMS, originalPrompt: prompt },
      'TextureParams',
      { temperature: options?.temperature ?? 0.7, maxTokens: 2048 }
    );

    if (result.success && result.data) {
      result.data.originalPrompt = prompt;
    }

    return result;
  }

  async predictObjectBlueprint(
    prompt: string,
    palette?: Material[],
    options?: ObjectGenerationOptions
  ): Promise<AIGenerationResult<ObjectBlueprint>> {
    const userPrompt = buildObjectPrompt(prompt, palette, options);

    const result = await this.generate<ObjectBlueprint>(
      OBJECT_SYSTEM_PROMPT,
      userPrompt,
      validateObjectBlueprint,
      { ...DEFAULT_OBJECT_BLUEPRINT, originalPrompt: prompt },
      'ObjectBlueprint',
      { temperature: options?.temperature ?? 0.8, maxTokens: 4096 }
    );

    if (result.success && result.data) {
      result.data.originalPrompt = prompt;
    }

    return result;
  }

  async predictScenarioLayout(
    prompt: string,
    palette?: Material[],
    options?: ScenarioGenerationOptions
  ): Promise<AIGenerationResult<ScenarioLayout>> {
    const userPrompt = buildScenarioPrompt(prompt, palette, options);

    const result = await this.generate<ScenarioLayout>(
      SCENARIO_SYSTEM_PROMPT,
      userPrompt,
      validateScenarioLayout,
      { ...DEFAULT_SCENARIO_LAYOUT, originalPrompt: prompt },
      'ScenarioLayout',
      { temperature: options?.temperature ?? 0.8, maxTokens: 8192 }
    );

    if (result.success && result.data) {
      result.data.originalPrompt = prompt;
    }

    return result;
  }
}
