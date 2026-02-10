import type { BiomeType, ScenarioLayout } from '../types';
import type { IntentEnrichmentContext } from './types';

const clampInt = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, Math.round(value)));

const DEFAULT_BIOME_MATERIALS: Record<BiomeType, { surfaceMaterial: string; undergroundMaterial: string }> = {
  plains: { surfaceMaterial: 'grass', undergroundMaterial: 'dirt' },
  forest: { surfaceMaterial: 'grass', undergroundMaterial: 'dirt' },
  desert: { surfaceMaterial: 'sand', undergroundMaterial: 'sand' },
  mountains: { surfaceMaterial: 'stone', undergroundMaterial: 'stone' },
  ocean: { surfaceMaterial: 'water', undergroundMaterial: 'sand' },
  river: { surfaceMaterial: 'water', undergroundMaterial: 'sand' },
  lake: { surfaceMaterial: 'water', undergroundMaterial: 'sand' },
  swamp: { surfaceMaterial: 'dirt', undergroundMaterial: 'dirt' },
  tundra: { surfaceMaterial: 'snow', undergroundMaterial: 'stone' },
  volcanic: { surfaceMaterial: 'lava', undergroundMaterial: 'stone' },
  cave: { surfaceMaterial: 'stone', undergroundMaterial: 'stone' },
  urban: { surfaceMaterial: 'stone', undergroundMaterial: 'dirt' },
  ruins: { surfaceMaterial: 'stone', undergroundMaterial: 'dirt' },
  dungeon: { surfaceMaterial: 'stone', undergroundMaterial: 'stone' },
  interior: { surfaceMaterial: 'stone', undergroundMaterial: 'stone' },
};

const makeBiomeRegion = (
  biome: BiomeType,
  bounds: [number, number, number, number]
): ScenarioLayout['biomes'][number] => {
  const mats = DEFAULT_BIOME_MATERIALS[biome] ?? DEFAULT_BIOME_MATERIALS.plains;
  const elevation = biome === 'mountains' || biome === 'volcanic' ? 0.72 : biome === 'ocean' ? 0.15 : 0.35;
  const elevationVariation = biome === 'mountains' || biome === 'volcanic' ? 0.28 : biome === 'river' ? 0.04 : 0.12;
  const moisture = biome === 'desert' ? 0.1 : biome === 'swamp' || biome === 'river' || biome === 'lake' ? 0.9 : 0.5;

  return {
    type: biome,
    bounds,
    elevation,
    elevationVariation,
    moisture,
    surfaceMaterial: mats.surfaceMaterial,
    undergroundMaterial: mats.undergroundMaterial,
  };
};

const maybeScaleSize = (
  size: [number, number],
  resolutionScale: number
): [number, number] => {
  if (!Number.isFinite(resolutionScale) || resolutionScale <= 0) {
    return size;
  }

  const [w, h] = size;
  const nextW = clampInt(w * resolutionScale, 32, 1024);
  const nextH = clampInt(h * resolutionScale, 32, 1024);
  return [nextW, nextH];
};

const ensureRequiredBiomes = (
  layout: ScenarioLayout,
  required: BiomeType[]
): ScenarioLayout['biomes'] => {
  const biomes = [...layout.biomes];
  const [width, height] = layout.size;
  const existing = new Set(biomes.map((entry) => entry.type));

  const missing = required.filter((biome) => !existing.has(biome));
  if (missing.length === 0) return biomes;

  const stripeWidth = Math.max(8, Math.floor(width / Math.max(1, missing.length)));
  missing.forEach((biome, index) => {
    const x = Math.min(width - stripeWidth, index * stripeWidth);
    const region = makeBiomeRegion(biome, [x, 0, stripeWidth, height]);
    biomes.push(region);
  });

  return biomes;
};

const ensureCompositionObjects = (layout: ScenarioLayout, enforceSettlements: boolean): ScenarioLayout['objects'] => {
  if (!enforceSettlements) {
    return [...layout.objects];
  }

  if (layout.objects.length > 0) {
    return [...layout.objects];
  }

  return [
    {
      objectType: 'house',
      biomes: ['plains', 'forest', 'urban'],
      density: 0.25,
      minSpacing: 8,
      scaleRange: [0.9, 1.2],
      preferNear: 'center',
    },
    {
      objectType: 'road_marker',
      biomes: ['plains', 'urban'],
      density: 0.15,
      minSpacing: 6,
      scaleRange: [0.8, 1.1],
      preferNear: 'edge',
    },
  ];
};

export function enrichScenarioLayoutWithIntent(
  layout: ScenarioLayout,
  context: IntentEnrichmentContext
): ScenarioLayout {
  const scale = context.resolutionScale ?? context.directive.terrain.resolutionScale;
  const scaledSize = maybeScaleSize(layout.size, scale);

  const nextLayout: ScenarioLayout = {
    ...layout,
    category: context.directive.targetCategory,
    size: scaledSize,
    depth: clampInt(
      layout.depth * (context.directive.terrain.detailScale >= 1.2 ? 1.2 : 1),
      16,
      128
    ),
    heightmap: {
      ...layout.heightmap,
      amplitude: Math.max(0.08, Math.min(0.95, layout.heightmap.amplitude + context.directive.terrain.ridgeBias * 0.1)),
      baseElevation: Math.max(
        0.05,
        Math.min(0.9, layout.heightmap.baseElevation + context.directive.terrain.waterLevelBias)
      ),
    },
    biomes: ensureRequiredBiomes(layout, context.directive.requiredBiomes),
    objects: ensureCompositionObjects(layout, context.directive.composition.enforceSettlements),
  };

  return nextLayout;
}
