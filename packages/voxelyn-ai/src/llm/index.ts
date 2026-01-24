/**
 * @voxelyn/ai - LLM Module
 *
 * Multi-provider LLM support for voxel generation.
 */

// Types
export type {
  LLMProvider,
  ModelId,
  ProviderConfig,
  GenerationOptions,
  TextureGenerationOptions,
  ObjectGenerationOptions,
  ScenarioGenerationOptions,
  LLMClient,
  ProviderInfo,
  LLMClientConfig,
  QuickConfig,
} from './types';

// Base class and utilities
export {
  BaseLLMClient,
  extractJSON,
  sleep,
  withRetry,
  type BaseClientConfig,
} from './base-client';

// Individual providers
export {
  GeminiClient,
  createGeminiClient,
  type GeminiConfig,
  OpenAIClient,
  createOpenAIClient,
  type OpenAIConfig,
  AnthropicClient,
  createAnthropicClient,
  type AnthropicConfig,
  CopilotLLMClient,
  createCopilotClient,
  type CopilotConfig,
  OllamaClient,
  createOllamaClient,
  type OllamaConfig,
  GroqClient,
  createGroqClient,
  type GroqConfig,
} from './providers';

// Factory
export {
  createLLMClient,
  createClient,
  createAutoClient,
  getAvailableProviders,
} from './factory';
