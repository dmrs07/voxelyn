import type { BiomeType } from '../types';
import type { ScenarioIntentDirective, ScenarioIntentV2 } from './types';

const WORLD_SCALE_TO_RESOLUTION: Record<ScenarioIntentV2['scaleIntent']['worldScale'], number> = {
  small: 0.8,
  medium: 1,
  large: 1.4,
  epic: 1.9,
};

const DETAIL_TO_SCALE: Record<ScenarioIntentV2['scaleIntent']['detailLevel'], number> = {
  low: 0.8,
  medium: 1,
  high: 1.25,
};

const RELIEF_TO_RIDGE: Record<ScenarioIntentV2['topology']['reliefEnergy'], number> = {
  low: 0.2,
  medium: 0.45,
  high: 0.8,
};

const RELIEF_TO_WATER_BIAS: Record<ScenarioIntentV2['topology']['reliefEnergy'], number> = {
  low: 0.1,
  medium: 0,
  high: -0.08,
};

const ensureBiomeSet = (biomes: BiomeType[], fallback: BiomeType): BiomeType[] =>
  biomes.length > 0 ? biomes : [fallback];

export function compileIntentToDirectives(intent: ScenarioIntentV2): ScenarioIntentDirective {
  const biomeWeights = intent.biomeStrategy.reduce<Partial<Record<BiomeType, number>>>((acc, item) => {
    acc[item.biome] = item.weight;
    return acc;
  }, {});

  const requiredBiomes = ensureBiomeSet(
    intent.biomeStrategy
      .filter((item) => item.weight >= 0.2 || item.minCoverage >= 0.2)
      .map((item) => item.biome),
    intent.categoryIntent === 'interior' ? 'interior' : 'plains'
  );

  const ring = intent.topology.macroForm === 'ring';
  const crater = intent.topology.macroForm === 'volcanic' || intent.topology.macroForm === 'canyon';
  const spiral = intent.topology.macroForm === 'archipelago' && intent.topology.waterSystem !== 'none';

  const baseResolution = WORLD_SCALE_TO_RESOLUTION[intent.scaleIntent.worldScale];
  const detailScale = DETAIL_TO_SCALE[intent.scaleIntent.detailLevel];

  return {
    targetCategory: intent.categoryIntent,
    requiredBiomes,
    biomeWeights,
    topology: {
      macroForm: intent.topology.macroForm,
      waterSystem: intent.topology.waterSystem,
      reliefEnergy: intent.topology.reliefEnergy,
    },
    terrain: {
      ring,
      crater,
      spiral,
      ridgeBias: RELIEF_TO_RIDGE[intent.topology.reliefEnergy],
      waterLevelBias: RELIEF_TO_WATER_BIAS[intent.topology.reliefEnergy],
      resolutionScale: baseResolution,
      detailScale,
    },
    composition: {
      enforceSettlements: intent.composition.settlementPattern !== 'none',
      settlementPattern: intent.composition.settlementPattern,
      poiArchetypes: intent.composition.poiArchetypes,
      traversalFlow: intent.composition.traversalFlow,
    },
    dynamics: {
      difficultyCurve: intent.dynamics.difficultyCurve,
      resourceDensity: intent.dynamics.resourceDensity,
      landmarkDensity: intent.dynamics.landmarkDensity,
    },
    constraints: {
      hard: [...intent.hardConstraints],
      soft: [...intent.softConstraints],
    },
  };
}
