/**
 * @voxelyn/ai - LLM Provider Types
 *
 * Unified interface for multiple LLM providers.
 */

import type { Material } from '@voxelyn/core';
import type {
  TextureParams,
  ObjectBlueprint,
  ScenarioLayout,
  AIGenerationResult,
} from '../types';

// ============================================================================
// PROVIDER TYPES
// ============================================================================

/**
 * Supported LLM providers
 */
export type LLMProvider =
  | 'gemini'
  | 'openai'
  | 'anthropic'
  | 'copilot'
  | 'ollama'
  | 'groq';

/**
 * Model identifiers for each provider
 */
export type ModelId = {
  gemini: 'gemini-2.5-flash-lite' | 'gemini-2.0-flash' | 'gemini-1.5-pro' | 'gemini-1.5-flash';
  openai: 'gpt-4o' | 'gpt-4o-mini' | 'gpt-4-turbo' | 'gpt-3.5-turbo' | 'o1' | 'o1-mini';
  anthropic: 'claude-sonnet-4-20250514' | 'claude-3-5-sonnet-20241022' | 'claude-3-5-haiku-20241022' | 'claude-3-opus-20240229';
  copilot: 'gpt-4o' | 'claude-sonnet-4' | 'claude-3.5-sonnet' | 'o1' | 'o3-mini';
  ollama: 'llama3.2' | 'llama3.1' | 'mistral' | 'codellama' | 'deepseek-coder' | string;
  groq: 'llama-3.3-70b-versatile' | 'llama-3.1-8b-instant' | 'mixtral-8x7b-32768' | 'gemma2-9b-it';
};

/**
 * Provider-specific configuration
 */
export type ProviderConfig = {
  gemini: {
    apiKey: string;
  };
  openai: {
    apiKey: string;
    organization?: string;
    baseURL?: string;
  };
  anthropic: {
    apiKey: string;
  };
  copilot: {
    /** GitHub token with Copilot access */
    token: string;
  };
  ollama: {
    /** Ollama server URL. Default: http://localhost:11434 */
    baseURL?: string;
  };
  groq: {
    apiKey: string;
  };
};

// ============================================================================
// CLIENT INTERFACE
// ============================================================================

/**
 * Generation options common to all providers
 */
export type GenerationOptions = {
  /** Temperature (0-1). Higher = more creative */
  temperature?: number;
  /** Top-p sampling */
  topP?: number;
  /** Maximum output tokens */
  maxTokens?: number;
  /** Request timeout in ms */
  timeoutMs?: number;
};

/**
 * Texture generation options
 */
export type TextureGenerationOptions = GenerationOptions & {
  targetSize?: number;
  style?: 'pixel' | 'realistic' | 'painterly';
  tileable?: boolean;
};

/**
 * Object generation options
 */
export type ObjectGenerationOptions = GenerationOptions & {
  maxSize?: [number, number, number];
  detailLevel?: 'low' | 'medium' | 'high';
};

/**
 * Scenario generation options
 */
export type ScenarioGenerationOptions = GenerationOptions & {
  targetSize?: [number, number];
  depth?: number;
  theme?: string;
  /** Use enhanced terrain from @voxelyn/core */
  useEnhancedTerrain?: boolean;
};

/**
 * Unified LLM client interface
 * All providers implement this interface
 */
export interface LLMClient {
  /** Provider identifier */
  readonly provider: LLMProvider;
  
  /** Model being used */
  readonly model: string;

  /** Predict texture parameters from natural language */
  predictTextureParams(
    prompt: string,
    palette?: Material[],
    options?: TextureGenerationOptions
  ): Promise<AIGenerationResult<TextureParams>>;

  /** Predict object blueprint from natural language */
  predictObjectBlueprint(
    prompt: string,
    palette?: Material[],
    options?: ObjectGenerationOptions
  ): Promise<AIGenerationResult<ObjectBlueprint>>;

  /** Predict scenario layout from natural language */
  predictScenarioLayout(
    prompt: string,
    palette?: Material[],
    options?: ScenarioGenerationOptions
  ): Promise<AIGenerationResult<ScenarioLayout>>;

  /** Test API connection */
  testConnection(): Promise<boolean>;

  /** Get provider info */
  getInfo(): ProviderInfo;
}

/**
 * Provider information
 */
export type ProviderInfo = {
  provider: LLMProvider;
  model: string;
  connected: boolean;
  rateLimits?: {
    requestsPerMinute?: number;
    tokensPerMinute?: number;
  };
};

// ============================================================================
// FACTORY CONFIG
// ============================================================================

/**
 * Configuration for creating an LLM client
 */
export type LLMClientConfig<P extends LLMProvider = LLMProvider> = {
  /** LLM provider to use */
  provider: P;
  /** Model to use (provider-specific) */
  model?: ModelId[P];
  /** Provider-specific configuration */
  config: ProviderConfig[P];
  /** Maximum retries on failure */
  maxRetries?: number;
  /** Request timeout in ms */
  timeoutMs?: number;
  /** Enable debug logging */
  debug?: boolean;
};

/**
 * Simple config for quick setup
 */
export type QuickConfig = 
  | { provider: 'gemini'; apiKey: string; model?: ModelId['gemini'] }
  | { provider: 'openai'; apiKey: string; model?: ModelId['openai'] }
  | { provider: 'anthropic'; apiKey: string; model?: ModelId['anthropic'] }
  | { provider: 'copilot'; token: string; model?: ModelId['copilot'] }
  | { provider: 'ollama'; baseURL?: string; model?: ModelId['ollama'] }
  | { provider: 'groq'; apiKey: string; model?: ModelId['groq'] };
