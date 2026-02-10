import { parseScenarioIntent } from './parser';
import type { IntentMode, ScenarioIntentResolverOptions, ScenarioIntentV2 } from './types';

const INTENT_CACHE = new Map<string, ScenarioIntentV2>();

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

const shouldNormalizeWithLLM = (intent: ScenarioIntentV2, mode: IntentMode): boolean => {
  if (mode === 'fast') return false;
  if (mode === 'deep') return true;
  return intent.confidence < 0.72 || intent.complexity >= 0.6;
};

const mergeIntent = (base: ScenarioIntentV2, patch: Partial<ScenarioIntentV2>): ScenarioIntentV2 => {
  return {
    ...base,
    ...patch,
    topology: {
      ...base.topology,
      ...(patch.topology ?? {}),
    },
    composition: {
      ...base.composition,
      ...(patch.composition ?? {}),
    },
    dynamics: {
      ...base.dynamics,
      ...(patch.dynamics ?? {}),
    },
    scaleIntent: {
      ...base.scaleIntent,
      ...(patch.scaleIntent ?? {}),
    },
    styleIntent: {
      ...base.styleIntent,
      ...(patch.styleIntent ?? {}),
    },
    biomeStrategy: patch.biomeStrategy ?? base.biomeStrategy,
    hardConstraints: patch.hardConstraints ?? base.hardConstraints,
    softConstraints: patch.softConstraints ?? base.softConstraints,
    conflicts: patch.conflicts ?? base.conflicts,
  };
};

const normalizeBiomeWeights = (intent: ScenarioIntentV2): void => {
  if (intent.biomeStrategy.length === 0) return;

  const total = intent.biomeStrategy.reduce((acc, item) => acc + item.weight, 0);
  if (total <= 0) {
    const uniform = 1 / intent.biomeStrategy.length;
    for (const item of intent.biomeStrategy) {
      item.weight = uniform;
    }
    return;
  }

  for (const item of intent.biomeStrategy) {
    item.weight = clamp01(item.weight / total);
    item.minCoverage = clamp01(item.minCoverage);
    item.maxCoverage = clamp01(Math.max(item.maxCoverage, item.minCoverage));
  }
};

const applyConsistencyRules = (intent: ScenarioIntentV2, strict: boolean): ScenarioIntentV2 => {
  const next = { ...intent, conflicts: [...intent.conflicts] };

  const noWater = next.hardConstraints.some((value) =>
    value.includes('no water') || value.includes('without water') || value.includes('sem agua')
  );

  if (noWater) {
    if (next.topology.waterSystem !== 'none') {
      next.conflicts.push('Hard constraint "no water" overrode detected water system.');
    }
    next.topology.waterSystem = 'none';
    next.biomeStrategy = next.biomeStrategy.filter(
      (item) => item.biome !== 'ocean' && item.biome !== 'river' && item.biome !== 'lake'
    );
  }

  if (next.categoryIntent === 'interior') {
    if (!next.biomeStrategy.some((item) => item.biome === 'interior' || item.biome === 'dungeon')) {
      next.biomeStrategy.push({
        biome: 'interior',
        weight: 0.6,
        minCoverage: 0.5,
        maxCoverage: 1,
      });
    }
  }

  if (next.categoryIntent === 'building' && next.composition.settlementPattern === 'none') {
    next.composition.settlementPattern = 'clustered';
  }

  if (strict && next.conflicts.length > 0) {
    next.softConstraints = [];
  }

  normalizeBiomeWeights(next);

  const signalCount =
    next.biomeStrategy.length +
    next.composition.poiArchetypes.length +
    next.hardConstraints.length +
    next.softConstraints.length;
  next.confidence = clamp01(Math.max(next.confidence, 0.35 + signalCount * 0.05));

  return next;
};

export function clearScenarioIntentCache(): void {
  INTENT_CACHE.clear();
}

export async function resolveScenarioIntent(
  prompt: string,
  options: ScenarioIntentResolverOptions = {}
): Promise<ScenarioIntentV2> {
  const mode = options.mode ?? 'balanced';
  const strict = options.strict ?? false;
  const cacheKey = options.cacheKey ?? `${mode}:${strict}:${prompt}`;

  const cached = INTENT_CACHE.get(cacheKey);
  if (cached) {
    return {
      ...cached,
      conflicts: [...cached.conflicts],
      biomeStrategy: cached.biomeStrategy.map((item) => ({ ...item })),
      hardConstraints: [...cached.hardConstraints],
      softConstraints: [...cached.softConstraints],
      composition: {
        ...cached.composition,
        poiArchetypes: [...cached.composition.poiArchetypes],
      },
      styleIntent: {
        ...cached.styleIntent,
        mood: [...cached.styleIntent.mood],
        paletteBias: cached.styleIntent.paletteBias ? [...cached.styleIntent.paletteBias] : undefined,
      },
    };
  }

  let intent = parseScenarioIntent(prompt);

  if (options.normalizeWithLLM && shouldNormalizeWithLLM(intent, mode)) {
    try {
      const patch = await options.normalizeWithLLM(intent);
      intent = mergeIntent(intent, patch);
    } catch {
      // Keep deterministic result on normalization failures.
    }
  }

  const resolved = applyConsistencyRules(intent, strict);
  INTENT_CACHE.set(cacheKey, resolved);

  return {
    ...resolved,
    conflicts: [...resolved.conflicts],
    biomeStrategy: resolved.biomeStrategy.map((item) => ({ ...item })),
    hardConstraints: [...resolved.hardConstraints],
    softConstraints: [...resolved.softConstraints],
    composition: {
      ...resolved.composition,
      poiArchetypes: [...resolved.composition.poiArchetypes],
    },
    styleIntent: {
      ...resolved.styleIntent,
      mood: [...resolved.styleIntent.mood],
      paletteBias: resolved.styleIntent.paletteBias ? [...resolved.styleIntent.paletteBias] : undefined,
    },
  };
}
