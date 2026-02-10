import type { BundleViewSettings, ScenarioReliefMetrics } from '@voxelyn/core';
import type { ScenarioIntentV2 } from './intent/types';

export type ScenarioViewClass = 'flatlands' | 'elevated' | 'irregular';
export type ObjectViewClass = 'creature-horizontal' | 'tall-structure' | 'compact-prop';
export type TextureViewClass = '2d-inspect';

export type ScenarioViewIntent = {
  semanticClass: ScenarioViewClass;
  confidence: number;
  macroForm?: string;
  waterSystem?: string;
  reliefEnergy?: string;
};

export type ObjectViewIntent = {
  semanticClass: ObjectViewClass;
  confidence: number;
};

export type TextureViewIntent = {
  semanticClass: TextureViewClass;
  confidence: number;
};

export type ObjectViewMetrics = {
  horizontalToVerticalRatio: number;
  componentCohesion?: number;
  extents: {
    width: number;
    height: number;
    depth: number;
  };
};

export type TextureViewMeta = {
  width: number;
  height: number;
  detailHint?: number;
};

export type DeriveArtifactViewInput =
  | {
      artifactType: 'scenario';
      prompt?: string;
      intent?: ScenarioIntentV2 | null;
      metrics: ScenarioReliefMetrics;
      extents: { width: number; height: number; depth: number };
      generatedFrom?: string;
    }
  | {
      artifactType: 'object';
      prompt: string;
      metrics: ObjectViewMetrics;
      generatedFrom?: string;
    }
  | {
      artifactType: 'texture';
      prompt?: string;
      meta: TextureViewMeta;
      generatedFrom?: string;
    };

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

const normalizePrompt = (prompt: string): string =>
  prompt
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

const round2 = (value: number): number => Number(value.toFixed(2));
const round3 = (value: number): number => Number(value.toFixed(3));

const hasAny = (text: string, words: readonly string[]): boolean =>
  words.some((word) => text.includes(word));

const toSpanNorm = (heightSpan: number): number => {
  if (heightSpan <= 1) return clamp01(heightSpan);
  return clamp01(heightSpan / 32);
};

const toSlopeNorm = (slopeMean: number): number => clamp01(slopeMean / 0.25);

export function deriveScenarioViewIntent(
  intent: ScenarioIntentV2 | null | undefined,
  layoutMetrics: ScenarioReliefMetrics,
): ScenarioViewIntent {
  const macro = intent?.topology?.macroForm;
  const water = intent?.topology?.waterSystem;
  const relief = intent?.topology?.reliefEnergy;

  const spanNorm = toSpanNorm(layoutMetrics.heightSpan);
  const slopeNorm = toSlopeNorm(layoutMetrics.slopeMean);
  const irregularTopology = (layoutMetrics.landComponents >= 3 && layoutMetrics.waterCoverage >= 0.14) ||
    layoutMetrics.waterCoverage >= 0.48;

  let semanticClass: ScenarioViewClass = 'flatlands';
  let confidence = 0.62;

  if (
    relief === 'high' ||
    macro === 'volcanic' ||
    macro === 'canyon' ||
    spanNorm > 0.58 ||
    slopeNorm > 0.62
  ) {
    semanticClass = 'elevated';
    confidence = 0.86;
  } else if (
    macro === 'valley' ||
    macro === 'archipelago' ||
    water === 'delta' ||
    irregularTopology
  ) {
    semanticClass = 'irregular';
    confidence = 0.83;
  } else if (
    relief === 'low' ||
    macro === 'plain' ||
    macro === 'plateau' ||
    (spanNorm < 0.36 && slopeNorm < 0.34)
  ) {
    semanticClass = 'flatlands';
    confidence = 0.84;
  } else {
    semanticClass = 'irregular';
    confidence = 0.7;
  }

  return {
    semanticClass,
    confidence: round3(clamp01(confidence)),
    macroForm: macro,
    waterSystem: water,
    reliefEnergy: relief,
  };
}

export function deriveObjectViewIntent(
  prompt: string,
  objectMetrics: ObjectViewMetrics,
): ObjectViewIntent {
  const normalized = normalizePrompt(prompt);
  const ratio = objectMetrics.horizontalToVerticalRatio;
  const maxHorizontal = Math.max(objectMetrics.extents.width, objectMetrics.extents.depth);
  const vertical = Math.max(1, objectMetrics.extents.height);
  const shapeRatio = maxHorizontal / vertical;
  const cohesion = objectMetrics.componentCohesion ?? 0.75;

  const rodentHint = hasAny(normalized, ['rat', 'mouse', 'rodent', 'rato', 'camundongo']);
  const creatureHint = rodentHint || hasAny(normalized, [
    'animal',
    'creature',
    'wolf',
    'fox',
    'bear',
    'cat',
    'dog',
    'dragon',
    'beast',
    'bicho',
    'criatura',
  ]);
  const tallHint = hasAny(normalized, [
    'tower',
    'totem',
    'pillar',
    'column',
    'statue',
    'tree',
    'spike',
    'torre',
    'coluna',
  ]);

  let semanticClass: ObjectViewClass = 'compact-prop';
  let confidence = 0.64;

  if ((creatureHint && ratio >= 1.15) || shapeRatio >= 1.35) {
    semanticClass = 'creature-horizontal';
    confidence = rodentHint ? 0.9 : 0.81;
  } else if (tallHint || ratio <= 0.82 || vertical > maxHorizontal * 1.15) {
    semanticClass = 'tall-structure';
    confidence = 0.82;
  } else {
    semanticClass = 'compact-prop';
    confidence = cohesion > 0.78 ? 0.8 : 0.68;
  }

  return {
    semanticClass,
    confidence: round3(clamp01(confidence)),
  };
}

export function deriveTextureViewIntent(
  prompt: string | undefined,
  textureMeta: TextureViewMeta,
): TextureViewIntent {
  void prompt;
  void textureMeta;
  return {
    semanticClass: '2d-inspect',
    confidence: 0.95,
  };
}

const scenarioIsoDefaults = {
  tileW: 32,
  tileH: 16,
  baselineZ: 0,
};

const applyScenarioFineTuning = (
  settings: BundleViewSettings,
  metrics: ScenarioReliefMetrics,
): BundleViewSettings => {
  const spanNorm = toSpanNorm(metrics.heightSpan);
  const slopeNorm = toSlopeNorm(metrics.slopeMean);
  const reliefBoost = clamp01(spanNorm * 0.6 + slopeNorm * 0.4);

  const iso = { ...settings.iso };
  const relief = settings.relief ? { ...settings.relief } : undefined;
  const camera = { ...settings.camera };

  iso.zStep = round2(iso.zStep * (0.9 + reliefBoost * 0.36));
  iso.defaultHeight = round2(iso.defaultHeight * (0.92 + reliefBoost * 0.24));
  iso.axisScale = {
    x: round3(iso.axisScale.x),
    y: round3(iso.axisScale.y),
    z: round3(iso.axisScale.z * (0.9 + reliefBoost * 0.28)),
  };

  if (relief) {
    relief.strength = round3(relief.strength * (0.88 + reliefBoost * 0.44));
    relief.exponent = round3(relief.exponent * (0.95 + reliefBoost * 0.14));
  }

  camera.zoom = round3(camera.zoom * (1.04 - reliefBoost * 0.26));
  camera.y = round2(camera.y + (0.45 - reliefBoost) * 24);

  return {
    ...settings,
    iso,
    relief,
    camera,
  };
};

const buildScenarioSettings = (
  intent: ScenarioViewIntent,
  metrics: ScenarioReliefMetrics,
  extents: { width: number; height: number; depth: number },
  generatedFrom: string | undefined,
): BundleViewSettings => {
  const base: BundleViewSettings = {
    version: 1,
    artifactType: 'scenario',
    presetId: `scenario-${intent.semanticClass}-v1`,
    intent: {
      semanticClass: intent.semanticClass,
      confidence: intent.confidence,
      macroForm: intent.macroForm,
      waterSystem: intent.waterSystem,
      reliefEnergy: intent.reliefEnergy,
    },
    iso: {
      ...scenarioIsoDefaults,
      zStep: 20,
      defaultHeight: 18,
      axisScale: { x: 1, y: 1, z: 1 },
      centerBiasY: 0.56,
    },
    relief: {
      strength: 3.0,
      exponent: 1.32,
      terrainBlend: 0.55,
      verticalOffset: 0,
    },
    camera: {
      x: 0,
      y: 10,
      zoom: 1,
      rotation: 0,
    },
    diagnostics: {
      heightSpan: round3(metrics.heightSpan),
      slopeMean: round3(metrics.slopeMean),
      waterCoverage: round3(metrics.waterCoverage),
      landComponents: metrics.landComponents,
      extents,
      generatedFrom,
    },
  };

  if (intent.semanticClass === 'flatlands') {
    base.iso.zStep = 15;
    base.iso.defaultHeight = 14;
    base.iso.axisScale = { x: 1, y: 1, z: 0.92 };
    base.iso.centerBiasY = 0.59;
    if (base.relief) {
      base.relief.strength = 2.05;
      base.relief.exponent = 1.18;
      base.relief.terrainBlend = 0.46;
      base.relief.verticalOffset = -1.2;
    }
    base.camera = { x: 0, y: 28, zoom: 1.09, rotation: 0 };
  } else if (intent.semanticClass === 'elevated') {
    base.iso.zStep = 25;
    base.iso.defaultHeight = 24;
    base.iso.axisScale = { x: 1, y: 1, z: 1.2 };
    base.iso.centerBiasY = 0.52;
    if (base.relief) {
      base.relief.strength = 3.75;
      base.relief.exponent = 1.45;
      base.relief.terrainBlend = 0.64;
      base.relief.verticalOffset = 3.2;
    }
    base.camera = { x: 0, y: -8, zoom: 0.9, rotation: 0 };
  } else {
    base.iso.zStep = 22;
    base.iso.defaultHeight = 20;
    base.iso.axisScale = { x: 1.08, y: 0.94, z: 1.12 };
    base.iso.centerBiasY = 0.56;
    if (base.relief) {
      base.relief.strength = 3.1;
      base.relief.exponent = 1.35;
      base.relief.terrainBlend = 0.58;
      base.relief.verticalOffset = 1.1;
    }
    base.camera = { x: 0, y: 8, zoom: 0.98, rotation: 0 };
  }

  return applyScenarioFineTuning(base, metrics);
};

const buildObjectSettings = (
  intent: ObjectViewIntent,
  metrics: ObjectViewMetrics,
  generatedFrom: string | undefined,
): BundleViewSettings => {
  const base: BundleViewSettings = {
    version: 1,
    artifactType: 'object',
    presetId: `object-${intent.semanticClass}-v1`,
    intent: {
      semanticClass: intent.semanticClass,
      confidence: intent.confidence,
    },
    iso: {
      tileW: 32,
      tileH: 16,
      zStep: 20,
      defaultHeight: 14,
      baselineZ: 0,
      axisScale: { x: 1, y: 1, z: 1 },
      centerBiasY: 0.58,
    },
    camera: {
      x: 0,
      y: 12,
      zoom: 1.05,
      rotation: 0,
    },
    diagnostics: {
      extents: metrics.extents,
      generatedFrom,
    },
  };

  if (intent.semanticClass === 'creature-horizontal') {
    base.iso.zStep = 18;
    base.iso.axisScale = { x: 1.1, y: 0.95, z: 0.96 };
    base.iso.centerBiasY = 0.61;
    base.camera = { x: 0, y: 24, zoom: 1.19, rotation: 0 };
  } else if (intent.semanticClass === 'tall-structure') {
    base.iso.zStep = 23;
    base.iso.axisScale = { x: 0.95, y: 1, z: 1.2 };
    base.iso.centerBiasY = 0.53;
    base.camera = { x: 0, y: -6, zoom: 0.9, rotation: 0 };
  } else {
    base.iso.zStep = 20;
    base.iso.axisScale = { x: 1, y: 1, z: 1 };
    base.iso.centerBiasY = 0.58;
    base.camera = { x: 0, y: 10, zoom: 1.04, rotation: 0 };
  }

  return base;
};

const buildTextureSettings = (
  intent: TextureViewIntent,
  meta: TextureViewMeta,
  generatedFrom: string | undefined,
): BundleViewSettings => {
  const maxDim = Math.max(1, meta.width, meta.height);
  const inspectZoom =
    maxDim <= 32 ? 6 : maxDim <= 64 ? 4 : maxDim <= 128 ? 2.5 : maxDim <= 256 ? 1.8 : 1.25;
  return {
    version: 1,
    artifactType: 'texture',
    presetId: 'texture-2d-inspect-v1',
    intent: {
      semanticClass: intent.semanticClass,
      confidence: intent.confidence,
    },
    iso: {
      tileW: 1,
      tileH: 1,
      zStep: 1,
      defaultHeight: 0,
      baselineZ: 0,
      axisScale: { x: 1, y: 1, z: 1 },
      centerBiasY: 0.5,
    },
    camera: {
      x: 0,
      y: 0,
      zoom: round3(inspectZoom),
      rotation: 0,
    },
    diagnostics: {
      extents: { width: meta.width, height: meta.height, depth: 1 },
      generatedFrom,
    },
  };
};

export function deriveArtifactViewSettings(input: DeriveArtifactViewInput): BundleViewSettings {
  if (input.artifactType === 'scenario') {
    const scenarioIntent = deriveScenarioViewIntent(input.intent, input.metrics);
    return buildScenarioSettings(scenarioIntent, input.metrics, input.extents, input.generatedFrom);
  }
  if (input.artifactType === 'object') {
    const objectIntent = deriveObjectViewIntent(input.prompt, input.metrics);
    return buildObjectSettings(objectIntent, input.metrics, input.generatedFrom);
  }
  const textureIntent = deriveTextureViewIntent(input.prompt, input.meta);
  return buildTextureSettings(textureIntent, input.meta, input.generatedFrom);
}
