/**
 * @voxelyn/ai - Premium AI Module
 *
 * Generate textures, objects, and scenarios using Google Gemini.
 * Hybrid AI + Procedural approach: AI predicts parameters, procedural generators build content.
 *
 * @example
 * ```ts
 * import { createGeminiClient, generateTextureFromParams } from '@voxelyn/ai';
 *
 * // Initialize client with your API key
 * const client = createGeminiClient({ apiKey: 'your-gemini-api-key' });
 *
 * // Generate texture for a material
 * const result = await client.predictTextureParams('rusty metal with scratches');
 * if (result.success) {
 *   const texture = generateTextureFromParams(result.data, 32, 32);
 *   // texture is Uint32Array of RGBA8888 pixels
 * }
 *
 * // Generate an object
 * const objResult = await client.predictObjectBlueprint('small wooden barrel');
 * if (objResult.success) {
 *   const voxels = buildVoxelsFromBlueprint(objResult.data);
 *   // voxels.data is Uint16Array of material IDs
 * }
 *
 * // Generate a scenario
 * const sceneResult = await client.predictScenarioLayout('forest with river and village');
 * if (sceneResult.success) {
 *   const scene = buildScenarioFromLayout(sceneResult.data);
 *   // scene.terrain, scene.objects, scene.heightmap
 * }
 * ```
 *
 * @packageDocumentation
 */

// ============================================================================
// TYPES
// ============================================================================

export type {
  // Core types
  TextureParams,
  TextureBaseType,
  NoiseConfig,
  TextureEffects,
  ColorVariation,
  ObjectBlueprint,
  Primitive,
  PrimitiveType,
  ScenarioLayout,
  BiomeRegion,
  BiomeType,
  ObjectPlacement,
  HeightmapParams,
  // API types
  GenerationType,
  AIGenerationResult,
  AIClientConfig,
  AIGeneratedParams,
} from './types';

export {
  DEFAULT_TEXTURE_PARAMS,
  DEFAULT_OBJECT_BLUEPRINT,
  DEFAULT_SCENARIO_LAYOUT,
} from './types';

// ============================================================================
// CLIENT
// ============================================================================

export {
  createGeminiClient,
  type GeminiClient,
  type TextureGenerationOptions,
  type ObjectGenerationOptions,
  type ScenarioGenerationOptions,
} from './gemini-client';

// ============================================================================
// GENERATORS
// ============================================================================

export {
  generateTextureFromParams,
  generateTexturePreview,
  makeTileable,
} from './generators/texture-gen';

export {
  buildVoxelsFromBlueprint,
  estimateVoxelCount,
  getVoxelSlice,
  type VoxelBuildResult,
  type BuildOptions,
} from './generators/object-interpreter';

export {
  buildScenarioFromLayout,
  enrichScenarioLayoutWithIntent,
  getScenarioPreview,
  getScenarioStats,
  type ScenarioBuildResult,
  type PlacedObject,
  type ScenarioBuildOptions,
} from './generators/scenario-gen';

// ============================================================================
// SCENARIO INTENT V2
// ============================================================================

export {
  parseScenarioIntent,
  resolveScenarioIntent,
  clearScenarioIntentCache,
  compileIntentToDirectives,
  enrichScenarioLayoutWithIntent as enrichScenarioLayoutWithResolvedIntent,
  type IntentMode,
  type MacroForm,
  type WaterSystem,
  type ReliefEnergy,
  type ScenarioIntentBiomeTarget,
  type ScenarioIntentV2,
  type ScenarioIntentDirective,
  type ScenarioIntentResolverOptions,
  type IntentEnrichmentContext,
} from './intent';

// ============================================================================
// ENHANCED TERRAIN (integrates with @voxelyn/core)
// ============================================================================

export {
  buildEnhancedTerrain,
  generateEnhancedHeightmap,
  getTerrainLayerForHeight,
  biomeRegionsToTerrainLayers,
  DEFAULT_TERRAIN_LAYERS,
  type EnhancedHeightmapParams,
  type TerrainLayer,
  type TerrainLightingParams,
  type TerrainIntentOptions,
  type EnhancedTerrainResult,
} from './generators/scenario-terrain';

// ============================================================================
// PROMPTS (for advanced users who want to customize)
// ============================================================================

export {
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
// MULTI-PROVIDER LLM SUPPORT
// ============================================================================

export {
  // Factory functions
  createLLMClient,
  createClient,
  createAutoClient,
  getAvailableProviders,
  // Provider clients
  GeminiClient as GeminiLLMClient,
  OpenAIClient,
  AnthropicClient,
  CopilotLLMClient,
  OllamaClient,
  GroqClient,
  // Provider-specific factories
  createGeminiClient as createGeminiLLMClient,
  createOpenAIClient,
  createAnthropicClient,
  createCopilotClient,
  createOllamaClient,
  createGroqClient,
  // Base class for custom providers
  BaseLLMClient,
  extractJSON,
  // Types
  type LLMProvider,
  type ModelId,
  type LLMClient,
  type LLMClientConfig,
  type QuickConfig,
  type ProviderInfo,
  type GeminiConfig,
  type OpenAIConfig,
  type AnthropicConfig,
  type CopilotConfig,
  type OllamaConfig,
  type GroqConfig,
} from './llm';
