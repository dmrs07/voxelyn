/**
 * @voxelyn/ai - Gemini API Client
 *
 * Compatibility wrapper around the unified LLM provider stack.
 * Keeps the historical public API while delegating to BaseLLMClient logic.
 */

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
  GeminiClient as GeminiLLMClient,
  type GeminiConfig,
} from './llm/providers/gemini';

import type {
  TextureGenerationOptions as LLMTextureGenerationOptions,
  ObjectGenerationOptions as LLMObjectGenerationOptions,
  ScenarioGenerationOptions as LLMScenarioGenerationOptions,
} from './llm/types';

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
  useEnhancedTerrain?: boolean;
};

export type GeminiClient = {
  predictTextureParams: (
    prompt: string,
    palette?: Material[],
    options?: TextureGenerationOptions
  ) => Promise<AIGenerationResult<TextureParams>>;

  predictObjectBlueprint: (
    prompt: string,
    palette?: Material[],
    options?: ObjectGenerationOptions
  ) => Promise<AIGenerationResult<ObjectBlueprint>>;

  predictScenarioLayout: (
    prompt: string,
    palette?: Material[],
    options?: ScenarioGenerationOptions
  ) => Promise<AIGenerationResult<ScenarioLayout>>;

  testConnection: () => Promise<boolean>;
  getConfig: () => Readonly<AIClientConfig>;
};

const normalizeTextureResult = (
  result: AIGenerationResult<TextureParams>,
  prompt: string
): AIGenerationResult<TextureParams> => ({
  ...result,
  data: result.data ? { ...DEFAULT_TEXTURE_PARAMS, ...result.data, originalPrompt: prompt } : { ...DEFAULT_TEXTURE_PARAMS, originalPrompt: prompt },
});

const normalizeObjectResult = (
  result: AIGenerationResult<ObjectBlueprint>,
  prompt: string
): AIGenerationResult<ObjectBlueprint> => ({
  ...result,
  data: result.data
    ? { ...DEFAULT_OBJECT_BLUEPRINT, ...result.data, originalPrompt: prompt }
    : { ...DEFAULT_OBJECT_BLUEPRINT, originalPrompt: prompt },
});

const normalizeScenarioResult = (
  result: AIGenerationResult<ScenarioLayout>,
  prompt: string
): AIGenerationResult<ScenarioLayout> => ({
  ...result,
  data: result.data
    ? { ...DEFAULT_SCENARIO_LAYOUT, ...result.data, originalPrompt: prompt }
    : { ...DEFAULT_SCENARIO_LAYOUT, originalPrompt: prompt },
});

export function createGeminiClient(config: AIClientConfig): GeminiClient {
  const {
    apiKey,
    model = 'gemini-2.5-flash-lite',
    maxRetries = 2,
    timeoutMs = 30000,
    debug = false,
  } = config;

  if (!apiKey || apiKey.trim() === '') {
    throw new Error('[voxelyn-ai] API key is required');
  }

  const llm = new GeminiLLMClient({
    apiKey,
    model: model as GeminiConfig['model'],
    maxRetries,
    timeoutMs,
    debug,
  });

  const publicConfig: Readonly<AIClientConfig> = {
    apiKey: '***',
    model,
    maxRetries,
    timeoutMs,
    debug,
  };

  return {
    async predictTextureParams(
      prompt: string,
      palette?: Material[],
      options?: TextureGenerationOptions
    ): Promise<AIGenerationResult<TextureParams>> {
      const llmOptions: LLMTextureGenerationOptions | undefined = options
        ? {
            targetSize: options.targetSize,
            style: options.style,
            tileable: options.tileable,
          }
        : undefined;

      const result = await llm.predictTextureParams(prompt, palette, llmOptions);
      return normalizeTextureResult(result, prompt);
    },

    async predictObjectBlueprint(
      prompt: string,
      palette?: Material[],
      options?: ObjectGenerationOptions
    ): Promise<AIGenerationResult<ObjectBlueprint>> {
      const llmOptions: LLMObjectGenerationOptions | undefined = options
        ? {
            maxSize: options.maxSize,
            detailLevel: options.detailLevel,
          }
        : undefined;

      const result = await llm.predictObjectBlueprint(prompt, palette, llmOptions);
      return normalizeObjectResult(result, prompt);
    },

    async predictScenarioLayout(
      prompt: string,
      palette?: Material[],
      options?: ScenarioGenerationOptions
    ): Promise<AIGenerationResult<ScenarioLayout>> {
      const llmOptions: LLMScenarioGenerationOptions | undefined = options
        ? {
            targetSize: options.targetSize,
            depth: options.depth,
            theme: options.theme,
            useEnhancedTerrain: options.useEnhancedTerrain,
          }
        : undefined;

      const result = await llm.predictScenarioLayout(prompt, palette, llmOptions);
      return normalizeScenarioResult(result, prompt);
    },

    async testConnection(): Promise<boolean> {
      return llm.testConnection();
    },

    getConfig(): Readonly<AIClientConfig> {
      return publicConfig;
    },
  };
}

// Re-export defaults for fallback usage
export { DEFAULT_TEXTURE_PARAMS, DEFAULT_OBJECT_BLUEPRINT, DEFAULT_SCENARIO_LAYOUT } from './types';
