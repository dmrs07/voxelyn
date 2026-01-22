/**
 * @voxelyn/ai - Gemini API Client
 *
 * Wrapper for Google Generative AI SDK with structured output parsing.
 * Handles retries, validation, and error handling for AI generation.
 */

import { GoogleGenerativeAI, type GenerativeModel } from '@google/generative-ai';
import type { Material } from '@voxelyn/core';

import type {
  AIClientConfig,
  AIGenerationResult,
  TextureParams,
  ObjectBlueprint,
  ScenarioLayout,
} from './types';

import {
  DEFAULT_TEXTURE_PARAMS,
  DEFAULT_OBJECT_BLUEPRINT,
  DEFAULT_SCENARIO_LAYOUT,
} from './types';

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
} from './prompts/templates';

// ============================================================================
// TYPES
// ============================================================================

export type TextureGenerationOptions = {
  targetSize?: number;
  style?: 'pixel' | 'realistic' | 'painterly';
  tileable?: boolean;
};

export type ObjectGenerationOptions = {
  maxSize?: [number, number, number];
  detailLevel?: 'low' | 'medium' | 'high';
};

export type ScenarioGenerationOptions = {
  targetSize?: [number, number];
  depth?: number;
  theme?: string;
};

export type GeminiClient = {
  /** Predict texture parameters from natural language. */
  predictTextureParams: (
    prompt: string,
    palette?: Material[],
    options?: TextureGenerationOptions
  ) => Promise<AIGenerationResult<TextureParams>>;

  /** Predict object blueprint from natural language. */
  predictObjectBlueprint: (
    prompt: string,
    palette?: Material[],
    options?: ObjectGenerationOptions
  ) => Promise<AIGenerationResult<ObjectBlueprint>>;

  /** Predict scenario layout from natural language. */
  predictScenarioLayout: (
    prompt: string,
    palette?: Material[],
    options?: ScenarioGenerationOptions
  ) => Promise<AIGenerationResult<ScenarioLayout>>;

  /** Test API connection. */
  testConnection: () => Promise<boolean>;

  /** Get current configuration. */
  getConfig: () => Readonly<AIClientConfig>;
};

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Extracts JSON from a response that might contain markdown code blocks.
 */
function extractJSON(text: string): string {
  // Try to extract from markdown code block first
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    return codeBlockMatch[1].trim();
  }

  // Try to find JSON object/array directly
  const jsonMatch = text.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
  if (jsonMatch) {
    return jsonMatch[1].trim();
  }

  // Return as-is and let JSON.parse fail
  return text.trim();
}

/**
 * Sleep helper for retry backoff.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry with exponential backoff.
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number,
  debug: boolean
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
          console.warn(`[voxelyn-ai] Attempt ${attempt + 1} failed, retrying in ${backoffMs}ms...`);
        }
        await sleep(backoffMs);
      }
    }
  }

  throw lastError ?? new Error('Unknown error after retries');
}

// ============================================================================
// CLIENT FACTORY
// ============================================================================

/**
 * Creates a Gemini API client for AI-powered generation.
 *
 * @param config - Client configuration including API key
 * @returns GeminiClient instance
 *
 * @example
 * ```ts
 * const client = createGeminiClient({ apiKey: 'your-key' });
 * const result = await client.predictTextureParams('rusty metal plate');
 * if (result.success) {
 *   const texture = generateTextureFromParams(result.data, 32, 32);
 * }
 * ```
 */
export function createGeminiClient(config: AIClientConfig): GeminiClient {
  const {
    apiKey,
    model = 'gemini-2.0-flash',
    maxRetries = 2,
    timeoutMs = 30000,
    debug = false,
  } = config;

  if (!apiKey || apiKey.trim() === '') {
    throw new Error('[voxelyn-ai] API key is required');
  }

  const genAI = new GoogleGenerativeAI(apiKey);

  // Model instances with system prompts
  const textureModel = genAI.getGenerativeModel({
    model,
    systemInstruction: TEXTURE_SYSTEM_PROMPT,
    generationConfig: {
      temperature: 0.7,
      topP: 0.9,
      maxOutputTokens: 2048,
    },
  });

  const objectModel = genAI.getGenerativeModel({
    model,
    systemInstruction: OBJECT_SYSTEM_PROMPT,
    generationConfig: {
      temperature: 0.8,
      topP: 0.9,
      maxOutputTokens: 4096,
    },
  });

  const scenarioModel = genAI.getGenerativeModel({
    model,
    systemInstruction: SCENARIO_SYSTEM_PROMPT,
    generationConfig: {
      temperature: 0.8,
      topP: 0.9,
      maxOutputTokens: 8192,
    },
  });

  /**
   * Generic generation function with validation.
   */
  async function generate<T>(
    genModel: GenerativeModel,
    userPrompt: string,
    validator: (obj: unknown) => obj is T,
    defaultValue: T,
    typeName: string
  ): Promise<AIGenerationResult<T>> {
    const startTime = Date.now();

    try {
      const result = await withRetry(
        async () => {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

          try {
            const response = await genModel.generateContent(userPrompt);
            clearTimeout(timeoutId);
            return response;
          } catch (error) {
            clearTimeout(timeoutId);
            throw error;
          }
        },
        maxRetries,
        debug
      );

      const responseText = result.response.text();

      if (debug) {
        console.log(`[voxelyn-ai] Raw ${typeName} response:`, responseText.slice(0, 500));
      }

      const jsonStr = extractJSON(responseText);
      let parsed: unknown;

      try {
        parsed = JSON.parse(jsonStr);
      } catch (parseError) {
        if (debug) {
          console.error(`[voxelyn-ai] JSON parse error for ${typeName}:`, parseError);
        }
        return {
          success: false,
          error: `Failed to parse AI response as JSON: ${parseError}`,
          data: defaultValue,
          generationTimeMs: Date.now() - startTime,
        };
      }

      if (!validator(parsed)) {
        if (debug) {
          console.warn(`[voxelyn-ai] Validation failed for ${typeName}, using defaults`);
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

      if (debug) {
        console.error(`[voxelyn-ai] Generation error for ${typeName}:`, error);
      }

      return {
        success: false,
        error: errorMessage,
        data: defaultValue,
        generationTimeMs: Date.now() - startTime,
      };
    }
  }

  return {
    async predictTextureParams(
      prompt: string,
      palette?: Material[],
      options?: TextureGenerationOptions
    ): Promise<AIGenerationResult<TextureParams>> {
      const userPrompt = buildTexturePrompt(prompt, palette, options);

      const result = await generate<TextureParams>(
        textureModel,
        userPrompt,
        validateTextureParams,
        { ...DEFAULT_TEXTURE_PARAMS, originalPrompt: prompt },
        'TextureParams'
      );

      // Attach original prompt to result
      if (result.success && result.data) {
        result.data.originalPrompt = prompt;
      }

      return result;
    },

    async predictObjectBlueprint(
      prompt: string,
      palette?: Material[],
      options?: ObjectGenerationOptions
    ): Promise<AIGenerationResult<ObjectBlueprint>> {
      const userPrompt = buildObjectPrompt(prompt, palette, options);

      const result = await generate<ObjectBlueprint>(
        objectModel,
        userPrompt,
        validateObjectBlueprint,
        { ...DEFAULT_OBJECT_BLUEPRINT, originalPrompt: prompt },
        'ObjectBlueprint'
      );

      if (result.success && result.data) {
        result.data.originalPrompt = prompt;
      }

      return result;
    },

    async predictScenarioLayout(
      prompt: string,
      palette?: Material[],
      options?: ScenarioGenerationOptions
    ): Promise<AIGenerationResult<ScenarioLayout>> {
      const userPrompt = buildScenarioPrompt(prompt, palette, options);

      const result = await generate<ScenarioLayout>(
        scenarioModel,
        userPrompt,
        validateScenarioLayout,
        { ...DEFAULT_SCENARIO_LAYOUT, originalPrompt: prompt },
        'ScenarioLayout'
      );

      if (result.success && result.data) {
        result.data.originalPrompt = prompt;
      }

      return result;
    },

    async testConnection(): Promise<boolean> {
      try {
        if (debug) console.log('[Gemini] Testing connection...');
        const testModel = genAI.getGenerativeModel({ model });
        const result = await testModel.generateContent('Say "ok" if you can read this.');
        const text = result.response.text().toLowerCase();
        if (debug) console.log('[Gemini] Test response:', text);
        return text.includes('ok');
      } catch (e) {
        if (debug) console.error('[Gemini] Test connection failed:', e);
        return false;
      }
    },

    getConfig(): Readonly<AIClientConfig> {
      return { apiKey: '***', model, maxRetries, timeoutMs, debug };
    },
  };
}

// Re-export defaults for fallback usage
export { DEFAULT_TEXTURE_PARAMS, DEFAULT_OBJECT_BLUEPRINT, DEFAULT_SCENARIO_LAYOUT } from './types';
