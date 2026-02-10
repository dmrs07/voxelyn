import type { BiomeType, ScenarioCategory, ScenarioLayout } from '../types';

export type IntentMode = 'fast' | 'balanced' | 'deep';

export type MacroForm =
  | 'island'
  | 'ring'
  | 'valley'
  | 'archipelago'
  | 'plateau'
  | 'canyon'
  | 'volcanic'
  | 'plain';

export type WaterSystem = 'none' | 'river' | 'delta' | 'coast' | 'lake' | 'oceanic';
export type ReliefEnergy = 'low' | 'medium' | 'high';

export type ScenarioIntentBiomeTarget = {
  biome: BiomeType;
  weight: number;
  minCoverage: number;
  maxCoverage: number;
};

export type ScenarioIntentV2 = {
  version: 2;
  prompt: string;
  language: 'pt' | 'en' | 'mixed';
  confidence: number;
  complexity: number;
  categoryIntent: ScenarioCategory;
  topology: {
    macroForm: MacroForm;
    waterSystem: WaterSystem;
    reliefEnergy: ReliefEnergy;
  };
  biomeStrategy: ScenarioIntentBiomeTarget[];
  composition: {
    poiArchetypes: string[];
    settlementPattern: 'none' | 'clustered' | 'linear' | 'radial';
    traversalFlow: 'open' | 'guided' | 'labyrinth';
  };
  dynamics: {
    difficultyCurve: 'flat' | 'ramp' | 'spiky';
    resourceDensity: 'scarce' | 'balanced' | 'rich';
    landmarkDensity: 'sparse' | 'normal' | 'dense';
  };
  scaleIntent: {
    worldScale: 'small' | 'medium' | 'large' | 'epic';
    detailLevel: 'low' | 'medium' | 'high';
  };
  styleIntent: {
    mood: string[];
    era?: string;
    paletteBias?: string[];
  };
  hardConstraints: string[];
  softConstraints: string[];
  conflicts: string[];
};

export type ScenarioIntentDirective = {
  targetCategory: ScenarioCategory;
  requiredBiomes: BiomeType[];
  biomeWeights: Partial<Record<BiomeType, number>>;
  topology: {
    macroForm: MacroForm;
    waterSystem: WaterSystem;
    reliefEnergy: ReliefEnergy;
  };
  terrain: {
    ring: boolean;
    crater: boolean;
    spiral: boolean;
    ridgeBias: number;
    waterLevelBias: number;
    resolutionScale: number;
    detailScale: number;
  };
  composition: {
    enforceSettlements: boolean;
    settlementPattern: 'none' | 'clustered' | 'linear' | 'radial';
    poiArchetypes: string[];
    traversalFlow: 'open' | 'guided' | 'labyrinth';
  };
  dynamics: {
    difficultyCurve: 'flat' | 'ramp' | 'spiky';
    resourceDensity: 'scarce' | 'balanced' | 'rich';
    landmarkDensity: 'sparse' | 'normal' | 'dense';
  };
  constraints: {
    hard: string[];
    soft: string[];
  };
};

export type ScenarioIntentResolverOptions = {
  mode?: IntentMode;
  strict?: boolean;
  cacheKey?: string;
  normalizeWithLLM?: (intent: ScenarioIntentV2) => Promise<Partial<ScenarioIntentV2>>;
};

export type IntentEnrichmentContext = {
  directive: ScenarioIntentDirective;
  resolutionScale?: number;
};

export type ScenarioLayoutEnricher = (
  layout: ScenarioLayout,
  context: IntentEnrichmentContext
) => ScenarioLayout;
