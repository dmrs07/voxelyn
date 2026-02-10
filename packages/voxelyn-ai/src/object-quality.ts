import { DEFAULT_MATERIALS, computeVoxelConnectivity, computeVoxelFillMetrics } from '@voxelyn/core';
import { buildVoxelsFromBlueprint, type VoxelBuildResult } from './generators/object-interpreter';
import type { ObjectBlueprint } from './types';
import type { LLMProvider } from './llm/types';

export const QUALITY_PROFILES = {
  fast: { attempts: 1, targetScore: 0.5 },
  balanced: { attempts: 2, targetScore: 0.58 },
  high: { attempts: 4, targetScore: 0.64 },
  ultra: { attempts: 6, targetScore: 0.7 },
} as const;

export type QualityProfile = keyof typeof QUALITY_PROFILES;

const MODEL_LADDERS: Record<LLMProvider, string[]> = {
  gemini: [
    'gemini-2.5-flash',
    'gemini-2.0-flash',
    'gemini-2.5-flash-lite',
    'gemini-2.0-flash-lite',
    'gemini-1.5-flash',
    'gemini-pro',
  ],
  openai: ['gpt-4o-mini', 'gpt-4o', 'gpt-4-turbo', 'gpt-3.5-turbo', 'o1-mini'],
  anthropic: [
    'claude-sonnet-4-20250514',
    'claude-3-5-sonnet-20241022',
    'claude-3-5-haiku-20241022',
    'claude-3-opus-20240229',
  ],
  groq: ['llama-3.3-70b-versatile', 'mixtral-8x7b-32768', 'llama-3.1-8b-instant', 'gemma2-9b-it'],
  ollama: ['llama3.2', 'llama3.1', 'mistral', 'deepseek-coder', 'codellama'],
  copilot: ['gpt-4o', 'claude-sonnet-4', 'claude-3.5-sonnet', 'o3-mini'],
};

const MODEL_UNAVAILABLE_PATTERNS = [
  'model not found',
  'unknown model',
  'unsupported model',
  'invalid model',
  'model does not exist',
  'not available for this model',
  'model is not available',
  'no such model',
  'unrecognized model',
  'is not found for api version',
  '404 not found',
  'models/',
];

const RETRYABLE_GENERATION_PATTERNS = [
  'failed to parse ai response as json',
  'syntaxerror',
  'rate limit',
  '429',
  'timeout',
  'timed out',
  'deadline exceeded',
  'service unavailable',
  'temporarily unavailable',
  'internal error',
  'overloaded',
];

type PrimitiveMetricSummary = {
  primitiveCount: number;
  typeCount: number;
  materialCount: number;
  largestVolume: number;
  boxCount: number;
  primitives: ObjectBlueprint['primitives'];
  activePrimitives: ObjectBlueprint['primitives'];
};

export type PenaltyEntry = {
  code: string;
  message: string;
  amount: number;
};

export type QualityBreakdown = {
  primitives: number;
  typeDiversity: number;
  materialDiversity: number;
  fillRatio: number;
  largestPrimitive: number;
  componentCohesion: number;
  penaltyTotal: number;
  rawScore: number;
  finalScore: number;
};

export type ObjectCandidateMetrics = {
  componentCount: number;
  largestComponentRatio: number;
  filledExtent: {
    width: number;
    height: number;
    depth: number;
  };
  horizontalToVerticalRatio: number;
  semanticIntent: 'generic' | 'animal' | 'rodent';
  tailLikePrimitive: boolean;
  basePlateDetected: boolean;
};

export type ObjectCandidateAnalysis = {
  score: number;
  primitiveCount: number;
  typeCount: number;
  materialCount: number;
  largestPrimitiveRatio: number;
  dominantMaterialRatio: number;
  fillRatio: number;
  filledVoxels: number;
  totalVoxels: number;
  penalties: string[];
  penaltyEntries: PenaltyEntry[];
  feedback: string[];
  breakdown: QualityBreakdown;
  metrics: ObjectCandidateMetrics;
};

export type AttemptPlanEntry = {
  attempt: number;
  model: string;
  modelCandidates: string[];
  temperature: number;
};

export type AttemptPlan = {
  attempts: AttemptPlanEntry[];
  escalationUsed: boolean;
};

export type AttemptRecord = {
  attempt: number;
  modelPlanned: string;
  modelUsed?: string;
  triedModels: string[];
  temperature: number;
  prompt: string;
  success: boolean;
  score?: number;
  breakdown?: QualityBreakdown;
  penalties?: PenaltyEntry[];
  metrics?: {
    primitiveCount: number;
    typeCount: number;
    materialCount: number;
    fillRatio: number;
    dominantMaterialRatio: number;
    largestPrimitiveRatio: number;
    componentCount: number;
    largestComponentRatio: number;
    horizontalToVerticalRatio: number;
    semanticIntent: 'generic' | 'animal' | 'rodent';
    tailLikePrimitive: boolean;
    basePlateDetected: boolean;
    filledExtent: {
      width: number;
      height: number;
      depth: number;
    };
  };
  error?: string;
};

export type ObjectQualityReport = {
  mode: 'ai';
  prompt: string;
  providerInput: string;
  provider: LLMProvider;
  qualityProfile: QualityProfile;
  qualityTarget: number;
  attemptsPlanned: number;
  attemptsUsed: number;
  escalationUsed: boolean;
  requestedMaxSize: [number, number, number];
  effectiveMaxSize: [number, number, number];
  clampFactor: number;
  expectedFillRange: {
    min: number;
    max: number;
  };
  attempts: AttemptRecord[];
  selectedAttempt: number;
  selectedModel: string;
  selectedTemperature: number;
};

export type GenerateObjectWithQualityResult = {
  blueprint: ObjectBlueprint;
  voxels: VoxelBuildResult;
  analysis: ObjectCandidateAnalysis;
  report: ObjectQualityReport;
  selectedAttempt: number;
  selectedModel: string;
  selectedTemperature: number;
  promptForAttempt: string;
};

export type RunPredictionInput = {
  prompt: string;
  model: string;
  temperature: number;
  attempt: number;
};

export type RunPredictionOutput = {
  success: boolean;
  data?: ObjectBlueprint;
  error?: string;
  modelUsed?: string;
};

export type GenerateObjectWithQualityOptions = {
  prompt: string;
  provider: LLMProvider;
  providerInput?: string;
  baseModel: string;
  modelExplicitlySet?: boolean;
  detailLevel: 'low' | 'medium' | 'high';
  requestedMaxSize?: [number, number, number];
  maxSize: [number, number, number];
  maxVoxels?: number;
  scale?: number;
  qualityProfile?: QualityProfile;
  attempts?: number;
  minScore?: number;
  modelEscalation?: boolean;
  allowBase?: boolean;
  strictQuality?: boolean;
  materialMapping?: Record<string, number>;
  onLog?: (message: string) => void;
  runPrediction: (input: RunPredictionInput) => Promise<RunPredictionOutput>;
};

type AttemptCandidate = {
  attempt: number;
  modelUsed: string;
  temperature: number;
  promptForAttempt: string;
  prediction: RunPredictionOutput;
  voxels: VoxelBuildResult;
  analysis: ObjectCandidateAnalysis;
};

type PromptIntent = {
  isRodentPrompt: boolean;
  isAnimalPrompt: boolean;
};

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

const sizeVolume = (size: [number, number, number]): number => size[0] * size[1] * size[2];

const uniqueNonEmpty = (values: Array<string | null | undefined>): string[] => {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const normalized = String(value ?? '').trim();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(normalized);
  }
  return out;
};

const normalizePrompt = (prompt: string): string =>
  prompt
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

const getPromptIntent = (prompt: string): PromptIntent => {
  const normalized = normalizePrompt(prompt);
  const isRodentPrompt =
    /\b(rat|mouse|mice|rodent|rato|ratazana|camundongo|roedor)\b/.test(normalized);
  const isAnimalPrompt =
    isRodentPrompt ||
    /\b(animal|creature|beast|pet|dog|cat|wolf|bear|lion|tiger|deer|horse|cow|pig|fox|bird|snake|dragon|lagarto|cachorro|gato|lobo|urso|leao|tigre|veado|cavalo|boi|porco|raposa|passaro|cobra)\b/.test(
      normalized,
    );
  return { isRodentPrompt, isAnimalPrompt };
};

const promptExplicitlyAllowsBackdrop = (prompt: string): boolean => {
  const normalized = normalizePrompt(prompt);
  return /(diorama|scene|cenario|display|stand|pedestal|platform|plataforma|base|wall|parede|floor|chao|board|background|fundo|frame|moldura)/.test(
    normalized,
  );
};

const getExpectedFillRange = (detailLevel: 'low' | 'medium' | 'high'): [number, number] => {
  if (detailLevel === 'low') return [0.04, 0.22];
  if (detailLevel === 'medium') return [0.06, 0.3];
  return [0.08, 0.38];
};

const getMinPrimitiveTarget = (detailLevel: 'low' | 'medium' | 'high'): number => {
  if (detailLevel === 'low') return 5;
  if (detailLevel === 'medium') return 8;
  return 12;
};

const scoreFillRatio = (fillRatio: number, expectedFillRange: [number, number]): number => {
  const [minFill, maxFill] = expectedFillRange;
  if (fillRatio >= minFill && fillRatio <= maxFill) return 1;
  if (fillRatio < minFill) {
    return 1 - clamp01((minFill - fillRatio) / Math.max(0.0001, minFill));
  }
  return 1 - clamp01((fillRatio - maxFill) / Math.max(0.0001, 1 - maxFill));
};

const scoreCohesion = (largestComponentRatio: number, componentCount: number): number => {
  const componentPenalty = clamp01((componentCount - 1) / 8);
  return clamp01(largestComponentRatio - componentPenalty * 0.55);
};

const dominantMaterialRatio = (materialUsageMap: Map<number, number>): number => {
  const values = [...materialUsageMap.values()];
  if (values.length === 0) return 0;
  let total = 0;
  let largest = 0;
  for (const count of values) {
    total += count;
    if (count > largest) largest = count;
  }
  return total > 0 ? largest / total : 0;
};

const getPrimitiveMetrics = (blueprint: ObjectBlueprint): PrimitiveMetricSummary => {
  const primitives = Array.isArray(blueprint.primitives) ? blueprint.primitives : [];
  const safePrimitives = primitives.filter((primitive) => {
    return (
      primitive &&
      Array.isArray(primitive.size) &&
      primitive.size.length >= 3 &&
      Array.isArray(primitive.position) &&
      primitive.position.length >= 3
    );
  });

  const activePrimitives = safePrimitives.filter((primitive) => !primitive.subtract);
  const typeSet = new Set<string>();
  const materialSet = new Set<string>();
  let largestVolume = 0;
  let boxCount = 0;

  for (const primitive of activePrimitives) {
    const type = String(primitive.type ?? 'unknown');
    typeSet.add(type);
    materialSet.add(String(primitive.material ?? 'unknown'));

    if (type === 'box') {
      boxCount += 1;
    }

    const sx = Math.max(0, Number(primitive.size[0]) || 0);
    const sy = Math.max(0, Number(primitive.size[1]) || 0);
    const sz = Math.max(0, Number(primitive.size[2]) || 0);
    const volume = sx * sy * sz;
    if (volume > largestVolume) largestVolume = volume;
  }

  return {
    primitives: safePrimitives,
    activePrimitives,
    primitiveCount: activePrimitives.length,
    typeCount: typeSet.size,
    materialCount: materialSet.size,
    boxCount,
    largestVolume,
  };
};

const detectLayeredSlabPattern = (primitives: ObjectBlueprint['primitives']): boolean => {
  const boxes = primitives.filter(
    (primitive) => String(primitive.type ?? '') === 'box' && !primitive.subtract,
  );
  if (boxes.length < 6) return false;

  const thinBoxes = boxes.filter((primitive) => {
    const sy = Math.max(0, Number(primitive.size[1]) || 0);
    return sy <= 1;
  });
  if (thinBoxes.length < Math.ceil(boxes.length * 0.55)) return false;

  const sorted = [...thinBoxes].sort(
    (a, b) => (Number(a.position[1]) || 0) - (Number(b.position[1]) || 0),
  );

  let monotonic = 0;
  for (let i = 1; i < sorted.length; i += 1) {
    const prev = sorted[i - 1]!;
    const curr = sorted[i]!;
    const yPrev = Number(prev.position[1]) || 0;
    const yCurr = Number(curr.position[1]) || 0;
    const sxPrev = Number(prev.size[0]) || 0;
    const sxCurr = Number(curr.size[0]) || 0;
    const szPrev = Number(prev.size[2]) || 0;
    const szCurr = Number(curr.size[2]) || 0;

    if (yCurr > yPrev && sxCurr >= sxPrev && szCurr >= szPrev) {
      monotonic += 1;
    }
  }

  return monotonic >= Math.max(4, sorted.length - 2);
};

const detectEnclosingBox = (
  primitives: ObjectBlueprint['primitives'],
  bounds: [number, number, number],
): boolean => {
  const boxes = primitives.filter(
    (primitive) => String(primitive.type ?? '') === 'box' && !primitive.subtract,
  );
  return boxes.some((box) => {
    const sx = Number(box.size[0]) || 0;
    const sy = Number(box.size[1]) || 0;
    const sz = Number(box.size[2]) || 0;
    return sx >= bounds[0] * 0.78 && sy >= bounds[1] * 0.78 && sz >= bounds[2] * 0.78;
  });
};

const detectGiantPlanePrimitive = (
  primitives: ObjectBlueprint['primitives'],
  bounds: [number, number, number],
): boolean => {
  return primitives.some((primitive) => {
    if (primitive.subtract) return false;
    if (String(primitive.type ?? '') !== 'box') return false;

    const sx = Math.max(0, Number(primitive.size[0]) || 0);
    const sy = Math.max(0, Number(primitive.size[1]) || 0);
    const sz = Math.max(0, Number(primitive.size[2]) || 0);
    const dims = [sx, sy, sz].sort((a, b) => a - b);

    const thin = (dims[0] ?? 0) <= 2;
    const wideA = (dims[1] ?? 0) >= Math.min(bounds[0], bounds[1], bounds[2]) * 0.72;
    const wideB = (dims[2] ?? 0) >= Math.max(bounds[0], bounds[1], bounds[2]) * 0.72;
    return thin && wideA && wideB;
  });
};

const detectBasePlatePrimitive = (
  primitives: ObjectBlueprint['primitives'],
  bounds: [number, number, number],
): boolean => {
  const footprintArea = Math.max(1, bounds[0] * bounds[2]);
  return primitives.some((primitive) => {
    if (primitive.subtract) return false;
    const size = Array.isArray(primitive.size) ? primitive.size : [0, 0, 0];
    const pos = Array.isArray(primitive.position) ? primitive.position : [0, 0, 0];

    const sx = Math.max(0, Number(size[0]) || 0);
    const sy = Math.max(0, Number(size[1]) || 0);
    const sz = Math.max(0, Number(size[2]) || 0);
    const y = Math.max(0, Number(pos[1]) || 0);
    const footprintRatio = (sx * sz) / footprintArea;
    const nearBottom = y <= Math.max(3, bounds[1] * 0.24);
    const thin = sy <= 2;

    return nearBottom && thin && footprintRatio >= 0.18;
  });
};

const detectHorizontalTailLikePrimitive = (primitives: ObjectBlueprint['primitives']): boolean => {
  return primitives.some((primitive) => {
    if (primitive.subtract) return false;
    const size = Array.isArray(primitive.size) ? primitive.size : [0, 0, 0];
    const sx = Math.max(0, Number(size[0]) || 0);
    const sy = Math.max(0, Number(size[1]) || 0);
    const sz = Math.max(0, Number(size[2]) || 0);

    const xTailLike = sx >= 5 && sx >= sy * 2.2 && sx >= sz * 2.2 && sy <= 3 && sz <= 3;
    const zTailLike = sz >= 5 && sz >= sy * 2.2 && sz >= sx * 2.2 && sy <= 3 && sx <= 3;
    return xTailLike || zTailLike;
  });
};

const failureHintForPrompt = (message: string): string => {
  const normalized = String(message).toLowerCase();
  if (!normalized) return '';
  if (normalized.includes('failed to parse ai response as json') || normalized.includes('syntaxerror')) {
    return 'Previous output had invalid JSON syntax. Return only valid JSON with no trailing commas.';
  }
  if (isModelUnavailableError(normalized)) {
    return 'Previous attempt failed due to model availability. Keep output concise and standard.';
  }
  if (normalized.includes('rate limit') || normalized.includes('429')) {
    return 'Previous attempt hit rate limits. Keep response compact and deterministic.';
  }
  return '';
};

const resolveTemperature = (
  detailLevel: 'low' | 'medium' | 'high',
  attempt: number,
  attemptsPlanned: number,
  provider: LLMProvider,
  modelEscalation: boolean,
): number => {
  const baseByDetail = {
    low: 0.34,
    medium: 0.3,
    high: 0.26,
  };

  const base = baseByDetail[detailLevel] ?? 0.3;
  const progress = attemptsPlanned > 1 ? (attempt - 1) / (attemptsPlanned - 1) : 0;
  const span = modelEscalation ? 0.1 : 0.06;
  let value = base + span * progress;

  if (provider === 'openai' || provider === 'anthropic') {
    value += 0.04;
  }

  const cap = provider === 'gemini' ? 0.5 : 0.62;
  return Number(clamp01(Math.max(0.2, Math.min(cap, value))).toFixed(3));
};

const formatSafeScore = (value: number): number => Number(value.toFixed(4));

export function isModelUnavailableError(message: string): boolean {
  const normalized = String(message ?? '').toLowerCase();
  return MODEL_UNAVAILABLE_PATTERNS.some((pattern) => normalized.includes(pattern));
}

export function isRetryableGenerationError(message: string): boolean {
  const normalized = String(message ?? '').toLowerCase();
  if (isModelUnavailableError(normalized)) return true;
  return RETRYABLE_GENERATION_PATTERNS.some((pattern) => normalized.includes(pattern));
}

export function getQualityTarget(profile: QualityProfile, minScore?: number): number {
  return minScore ?? QUALITY_PROFILES[profile].targetScore;
}

export function buildDefaultMaterialMapping(): Record<string, number> {
  const mapping: Record<string, number> = {};
  for (const material of DEFAULT_MATERIALS) {
    if (!material || material.id === 0) continue;
    mapping[material.name.toLowerCase()] = material.id;
  }

  mapping.fruit = 12;
  mapping.fruta = 12;
  mapping.banana = 13;
  mapping.apple = 12;
  mapping['maça'] = 12;
  mapping.maca = 12;
  mapping.pumpkin = 5;
  mapping.abobora = 5;
  mapping['abóbora'] = 5;
  mapping.basket = 6;
  mapping.cesto = 6;
  mapping.horn = 6;
  mapping.cornucopia = 6;

  return mapping;
}

export function clampSizeToMaxVoxels(
  size: [number, number, number],
  maxVoxels: number,
): [number, number, number] {
  const currentVolume = sizeVolume(size);
  if (currentVolume <= maxVoxels) return size;
  const factor = Math.cbrt(maxVoxels / currentVolume);
  return [
    Math.max(1, Math.floor(size[0] * factor)),
    Math.max(1, Math.floor(size[1] * factor)),
    Math.max(1, Math.floor(size[2] * factor)),
  ];
}

export function deriveSizeFromMaxVoxels(maxVoxels: number): [number, number, number] {
  const edge = Math.max(1, Math.floor(Math.cbrt(maxVoxels)));
  return [edge, edge, edge];
}

export function resolveAttemptPlan(config: {
  provider: LLMProvider;
  baseModel: string;
  attemptsPlanned: number;
  detailLevel: 'low' | 'medium' | 'high';
  modelEscalation: boolean;
  modelExplicitlySet?: boolean;
  requestedModel?: string;
}): AttemptPlan {
  const ladder = MODEL_LADDERS[config.provider] ?? [];
  const switchAt = Math.max(2, Math.ceil(config.attemptsPlanned * 0.66));
  const attempts: AttemptPlanEntry[] = [];

  for (let attempt = 1; attempt <= config.attemptsPlanned; attempt += 1) {
    let primaryModel = config.baseModel;

    if (!config.modelExplicitlySet && config.modelEscalation) {
      if (config.provider === 'gemini') {
        primaryModel = attempt >= switchAt ? 'gemini-2.0-flash' : 'gemini-2.5-flash';
      } else if (config.provider === 'openai') {
        primaryModel = attempt >= switchAt ? 'gpt-4o' : 'gpt-4o-mini';
      }
    }

    const modelCandidates = uniqueNonEmpty(
      config.modelExplicitlySet
        ? [config.requestedModel, primaryModel, config.modelEscalation ? config.baseModel : null, ...ladder]
        : [primaryModel, config.modelEscalation ? config.baseModel : null, config.requestedModel, ...ladder],
    );

    attempts.push({
      attempt,
      model: primaryModel,
      modelCandidates,
      temperature: resolveTemperature(
        config.detailLevel,
        attempt,
        config.attemptsPlanned,
        config.provider,
        config.modelEscalation,
      ),
    });
  }

  const uniquePrimaryModels = new Set(attempts.map((item) => item.model));
  const uniqueTemperatures = new Set(attempts.map((item) => item.temperature));

  return {
    attempts,
    escalationUsed:
      config.modelEscalation && (uniquePrimaryModels.size > 1 || uniqueTemperatures.size > 1),
  };
}

export function buildObjectPromptV2(input: {
  originalPrompt: string;
  detailLevel: 'low' | 'medium' | 'high';
  maxSize: [number, number, number];
  allowBase: boolean;
  attempt: number;
  attemptsPlanned: number;
  previousAnalysis?: ObjectCandidateAnalysis | null;
  previousFailureMessage?: string;
}): string {
  const minPrimitives = getMinPrimitiveTarget(input.detailLevel);
  const [minFill, maxFill] = getExpectedFillRange(input.detailLevel);
  const promptIntent = getPromptIntent(input.originalPrompt);

  const constraints = [
    'Generation constraints:',
    '- Generate one standalone object that directly matches the prompt.',
    '- Output strict JSON only (single JSON object). No markdown, comments, or code fences.',
    '- JSON must be valid for JSON.parse (double quotes, no trailing commas).',
    '- Keep a readable silhouette and avoid giant filler boxes.',
    `- Keep occupancy around ${(minFill * 100).toFixed(0)}% to ${(maxFill * 100).toFixed(0)}% of volume.`,
    `- Stay inside ${input.maxSize.join('x')} voxel bounds.`,
    `- Use at least ${minPrimitives} primitives when possible.`,
    '- Mix primitive types and materials to improve visual readability.',
    '- Avoid repetitive stair-slab layers and thin planar noise.',
    '- Prefer cohesive geometry with fewer disconnected floating islands.',
  ];

  if (!input.allowBase) {
    constraints.push('- Do NOT add backdrop, wall, floor, baseplate, frame, or enclosing box.');
  }
  if (promptIntent.isAnimalPrompt) {
    constraints.push('- For animal prompts, prioritize organic silhouette and avoid architectural planes.');
  }
  if (promptIntent.isRodentPrompt) {
    constraints.push(
      '- Rodent anatomy cues: elongated horizontal body, distinct head, 4 legs, ears, and one long thin horizontal tail.',
    );
  }

  if (input.attempt > 1) {
    constraints.push(`- Retry ${input.attempt}/${input.attemptsPlanned}: improve quality over the previous attempt.`);
    constraints.push('- Prioritize: reduce largest primitive, increase type diversity, improve cohesion.');
    const failureHint = failureHintForPrompt(input.previousFailureMessage ?? '');
    if (failureHint) constraints.push(`- ${failureHint}`);
    if (input.previousAnalysis?.feedback?.length) {
      constraints.push(`- Fix previous issues: ${input.previousAnalysis.feedback.join('; ')}.`);
    }
    constraints.push(`- Variation key: v${input.attempt}-${input.detailLevel}.`);
  }

  return `${input.originalPrompt}\n\n${constraints.join('\n')}`;
}

export function evaluateObjectCandidate(
  blueprint: ObjectBlueprint,
  voxels: VoxelBuildResult,
  context: {
    detailLevel: 'low' | 'medium' | 'high';
    prompt: string;
    allowBase?: boolean;
  },
): ObjectCandidateAnalysis {
  const boundsRaw = Array.isArray(blueprint.bounds)
    ? blueprint.bounds
    : [voxels.width, voxels.height, voxels.depth];
  const bounds: [number, number, number] = [
    Math.max(1, Number(boundsRaw[0]) || voxels.width),
    Math.max(1, Number(boundsRaw[1]) || voxels.height),
    Math.max(1, Number(boundsRaw[2]) || voxels.depth),
  ];
  const boundsVolume = Math.max(1, sizeVolume(bounds));
  const expectedFillRange = getExpectedFillRange(context.detailLevel);

  const primitiveMetrics = getPrimitiveMetrics(blueprint);
  const layeredSlabs = detectLayeredSlabPattern(primitiveMetrics.primitives);
  const enclosingBox = detectEnclosingBox(primitiveMetrics.activePrimitives, bounds);
  const giantPlane = detectGiantPlanePrimitive(primitiveMetrics.activePrimitives, bounds);
  const basePlate = detectBasePlatePrimitive(primitiveMetrics.activePrimitives, bounds);
  const tailLike = detectHorizontalTailLikePrimitive(primitiveMetrics.activePrimitives);

  const fillMetrics = computeVoxelFillMetrics(voxels.data, voxels.width, voxels.height, voxels.depth);
  const connectivity = computeVoxelConnectivity(voxels.data, voxels.width, voxels.height, voxels.depth);
  const fillRatio = fillMetrics.fillRatio;
  const dominantRatio = dominantMaterialRatio(voxels.materialUsage);
  const largestPrimitiveRatio = primitiveMetrics.largestVolume / boundsVolume;

  const boxOnly =
    primitiveMetrics.typeCount === 1 &&
    primitiveMetrics.boxCount === primitiveMetrics.primitiveCount &&
    primitiveMetrics.primitiveCount > 0;

  const componentCohesion = scoreCohesion(connectivity.largestComponentRatio, connectivity.componentCount);
  const primitiveTarget = getMinPrimitiveTarget(context.detailLevel);
  const promptIntent = getPromptIntent(context.prompt);
  const allowBackdrop = Boolean(context.allowBase) || promptExplicitlyAllowsBackdrop(context.prompt);

  const primitivesComponent = clamp01(
    primitiveMetrics.primitiveCount / Math.max(8, primitiveTarget + 2),
  );
  const typeDiversityComponent = clamp01((primitiveMetrics.typeCount - 1) / 4);
  const materialDiversityComponent = clamp01((primitiveMetrics.materialCount - 1) / 6);
  const fillComponent = scoreFillRatio(fillRatio, expectedFillRange);
  const largestPrimitiveComponent = 1 - clamp01((largestPrimitiveRatio - 0.16) / 0.34);

  const penalties: string[] = [];
  const penaltyEntries: PenaltyEntry[] = [];
  const addPenalty = (code: string, message: string, amount: number): void => {
    penaltyEntries.push({ code, message, amount: formatSafeScore(amount) });
    penalties.push(message);
  };

  if (layeredSlabs) addPenalty('layered_slabs', 'repetitive layered slab pattern', 0.2);
  if (enclosingBox) addPenalty('enclosing_box', 'giant enclosing box/backdrop', 0.34);
  if (giantPlane) addPenalty('giant_plane', 'large thin wall/base primitive detected', 0.24);
  if (!allowBackdrop && basePlate) addPenalty('baseplate', 'large support/baseplate detected', 0.22);
  if (boxOnly) addPenalty('box_only', 'box-only primitive set', 0.12);
  if (dominantRatio > 0.82) {
    const amount = clamp01((dominantRatio - 0.82) / 0.18) * 0.2;
    addPenalty('material_dominance', 'single material dominates shape', Math.max(0.04, amount));
  }

  const [minFill, maxFill] = expectedFillRange;
  if (fillRatio < minFill) {
    const amount = Math.max(0.05, clamp01((minFill - fillRatio) / Math.max(0.0001, minFill)) * 0.18);
    addPenalty('fill_below_range', 'fill ratio below expected range', amount);
  }
  if (fillRatio > maxFill) {
    const amount = Math.max(0.05, clamp01((fillRatio - maxFill) / Math.max(0.0001, 1 - maxFill)) * 0.16);
    addPenalty('fill_above_range', 'fill ratio above expected range', amount);
  }
  if (fillRatio < minFill * 0.45) addPenalty('sparse_extreme', 'object too sparse', 0.1);
  if (fillRatio > maxFill * 1.55) addPenalty('dense_extreme', 'object too dense/blocky', 0.1);
  if (largestPrimitiveRatio > 0.52) {
    addPenalty('largest_primitive', 'largest primitive dominates composition', 0.17);
  }
  if (componentCohesion < 0.22 && connectivity.componentCount > 3) {
    addPenalty('fragmented_shape', 'disconnected fragmented components', 0.12);
  }
  if (promptIntent.isAnimalPrompt && !allowBackdrop && basePlate) {
    addPenalty('animal_baseplate', 'animal prompt should not include support slab', 0.08);
  }
  if (promptIntent.isRodentPrompt) {
    if (!tailLike) {
      addPenalty('rodent_tail_missing', 'rodent prompt missing long horizontal tail-like appendage', 0.14);
    }
    if (fillMetrics.horizontalToVerticalRatio < 1.2) {
      addPenalty('rodent_silhouette', 'rodent silhouette is not horizontally elongated', 0.1);
    }
    if (primitiveMetrics.materialCount < 3) {
      addPenalty('rodent_features', 'rodent prompt needs better feature separation', 0.06);
    }
  }

  const penaltyTotal = penaltyEntries.reduce((sum, item) => sum + item.amount, 0);
  const rawScore =
    0.22 * primitivesComponent +
    0.18 * typeDiversityComponent +
    0.14 * materialDiversityComponent +
    0.2 * fillComponent +
    0.16 * largestPrimitiveComponent +
    0.1 * componentCohesion;
  const score = clamp01(rawScore - penaltyTotal);

  const feedback = new Set<string>();
  if (layeredSlabs) feedback.add('reduzir padrao de camadas finas repetitivas');
  if (enclosingBox || giantPlane) feedback.add('remover backdrop/baseplate/parede gigante');
  if (basePlate) feedback.add('remover base de suporte e deixar objeto standalone');
  if (largestPrimitiveRatio > 0.32) feedback.add('reduzir maior primitive e dividir forma em subpartes');
  if (primitiveMetrics.typeCount < 3) feedback.add('aumentar diversidade de tipos de primitive');
  if (componentCohesion < 0.55) feedback.add('aumentar coesao conectando partes fragmentadas');
  if (dominantRatio > 0.78) feedback.add('aumentar diversidade de materiais');
  if (fillRatio < minFill) feedback.add('aumentar ocupacao para evitar objeto esparso');
  if (fillRatio > maxFill) feedback.add('reduzir massa para evitar objeto blocado');
  if (promptIntent.isRodentPrompt && !tailLike) feedback.add('incluir cauda fina e horizontal tipica de roedor');
  if (promptIntent.isRodentPrompt && fillMetrics.horizontalToVerticalRatio < 1.2) {
    feedback.add('alongar corpo horizontalmente para lembrar um rato');
  }

  return {
    score,
    primitiveCount: primitiveMetrics.primitiveCount,
    typeCount: primitiveMetrics.typeCount,
    materialCount: primitiveMetrics.materialCount,
    largestPrimitiveRatio,
    dominantMaterialRatio: dominantRatio,
    fillRatio,
    filledVoxels: fillMetrics.filledVoxels,
    totalVoxels: fillMetrics.totalVoxels,
    penalties,
    penaltyEntries,
    feedback: [...feedback],
    breakdown: {
      primitives: formatSafeScore(primitivesComponent),
      typeDiversity: formatSafeScore(typeDiversityComponent),
      materialDiversity: formatSafeScore(materialDiversityComponent),
      fillRatio: formatSafeScore(fillComponent),
      largestPrimitive: formatSafeScore(largestPrimitiveComponent),
      componentCohesion: formatSafeScore(componentCohesion),
      penaltyTotal: formatSafeScore(penaltyTotal),
      rawScore: formatSafeScore(rawScore),
      finalScore: formatSafeScore(score),
    },
    metrics: {
      componentCount: connectivity.componentCount,
      largestComponentRatio: formatSafeScore(connectivity.largestComponentRatio),
      filledExtent: fillMetrics.extents,
      horizontalToVerticalRatio: formatSafeScore(fillMetrics.horizontalToVerticalRatio),
      semanticIntent: promptIntent.isRodentPrompt
        ? 'rodent'
        : promptIntent.isAnimalPrompt
          ? 'animal'
          : 'generic',
      tailLikePrimitive: tailLike,
      basePlateDetected: basePlate,
    },
  };
}

export async function generateObjectWithQuality(
  options: GenerateObjectWithQualityOptions,
): Promise<GenerateObjectWithQualityResult> {
  const qualityProfile = options.qualityProfile ?? 'ultra';
  const qualitySpec = QUALITY_PROFILES[qualityProfile];
  if (!qualitySpec) {
    throw new Error(`Invalid quality profile: ${String(options.qualityProfile)}`);
  }

  const prompt = options.prompt.trim();
  if (!prompt) {
    throw new Error('Missing prompt');
  }

  const attemptsPlanned =
    typeof options.attempts === 'number' && options.attempts > 0
      ? Math.floor(options.attempts)
      : qualitySpec.attempts;
  const qualityTarget = getQualityTarget(qualityProfile, options.minScore);
  const effectiveMaxSize = options.maxSize;
  const requestedMaxSize = options.requestedMaxSize ?? options.maxSize;
  const expectedFillRange = getExpectedFillRange(options.detailLevel);
  const clampFactor = sizeVolume(effectiveMaxSize) / Math.max(1, sizeVolume(requestedMaxSize));
  const scale = options.scale ?? 1;
  const modelEscalation = options.modelEscalation ?? true;
  const materialMapping = { ...buildDefaultMaterialMapping(), ...(options.materialMapping ?? {}) };

  const attemptPlan = resolveAttemptPlan({
    provider: options.provider,
    baseModel: options.baseModel,
    attemptsPlanned,
    detailLevel: options.detailLevel,
    modelEscalation,
    modelExplicitlySet: Boolean(options.modelExplicitlySet),
    requestedModel: options.modelExplicitlySet ? options.baseModel : undefined,
  });

  let bestCandidate: AttemptCandidate | null = null;
  let previousAnalysis: ObjectCandidateAnalysis | null = null;
  let previousFailureMessage = '';
  const attemptErrors: string[] = [];
  const attemptHistory: AttemptRecord[] = [];

  for (const attemptConfig of attemptPlan.attempts) {
    const promptForAttempt = buildObjectPromptV2({
      originalPrompt: prompt,
      detailLevel: options.detailLevel,
      maxSize: effectiveMaxSize,
      allowBase: Boolean(options.allowBase),
      attempt: attemptConfig.attempt,
      attemptsPlanned,
      previousAnalysis,
      previousFailureMessage,
    });

    let attemptSucceeded = false;
    let attemptFailure = '';
    const triedModels: string[] = [];

    for (const candidateModel of attemptConfig.modelCandidates) {
      triedModels.push(candidateModel);

      let prediction: RunPredictionOutput;
      try {
        prediction = await options.runPrediction({
          prompt: promptForAttempt,
          model: candidateModel,
          temperature: attemptConfig.temperature,
          attempt: attemptConfig.attempt,
        });
      } catch (error) {
        prediction = {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }

      if (!prediction.success || !prediction.data) {
        const reason = prediction.error ?? 'generation failed';
        if (
          isRetryableGenerationError(reason) &&
          triedModels.length < attemptConfig.modelCandidates.length
        ) {
          options.onLog?.(
            `attempt ${attemptConfig.attempt}/${attemptsPlanned} model=${candidateModel} retryable failure (${reason}); trying fallback model.`,
          );
          continue;
        }
        attemptFailure = reason;
        break;
      }

      const modelUsed = prediction.modelUsed || candidateModel;
      const voxels = buildVoxelsFromBlueprint(prediction.data, {
        materialMapping,
        scale,
        maxDimension: Math.max(...effectiveMaxSize),
      });
      const analysis = evaluateObjectCandidate(prediction.data, voxels, {
        detailLevel: options.detailLevel,
        prompt,
        allowBase: options.allowBase,
      });
      const penaltyText = analysis.penalties.length ? ` penalties=${analysis.penalties.join('|')}` : '';

      options.onLog?.(
        `attempt ${attemptConfig.attempt}/${attemptsPlanned} model=${modelUsed} temp=${attemptConfig.temperature.toFixed(2)} score=${analysis.score.toFixed(3)}${penaltyText}`,
      );

      attemptHistory.push({
        attempt: attemptConfig.attempt,
        modelPlanned: attemptConfig.model,
        modelUsed,
        triedModels,
        temperature: attemptConfig.temperature,
        prompt: promptForAttempt,
        success: true,
        score: formatSafeScore(analysis.score),
        breakdown: analysis.breakdown,
        penalties: analysis.penaltyEntries,
        metrics: {
          primitiveCount: analysis.primitiveCount,
          typeCount: analysis.typeCount,
          materialCount: analysis.materialCount,
          fillRatio: formatSafeScore(analysis.fillRatio),
          dominantMaterialRatio: formatSafeScore(analysis.dominantMaterialRatio),
          largestPrimitiveRatio: formatSafeScore(analysis.largestPrimitiveRatio),
          componentCount: analysis.metrics.componentCount,
          largestComponentRatio: analysis.metrics.largestComponentRatio,
          horizontalToVerticalRatio: analysis.metrics.horizontalToVerticalRatio,
          semanticIntent: analysis.metrics.semanticIntent,
          tailLikePrimitive: analysis.metrics.tailLikePrimitive,
          basePlateDetected: analysis.metrics.basePlateDetected,
          filledExtent: analysis.metrics.filledExtent,
        },
      });

      if (!bestCandidate || analysis.score > bestCandidate.analysis.score) {
        bestCandidate = {
          attempt: attemptConfig.attempt,
          modelUsed,
          temperature: attemptConfig.temperature,
          promptForAttempt,
          prediction,
          voxels,
          analysis,
        };
      }

      previousAnalysis = analysis;
      previousFailureMessage = '';
      attemptSucceeded = true;
      break;
    }

    if (!attemptSucceeded) {
      const failureMessage = attemptFailure || 'generation failed';
      previousFailureMessage = failureMessage;
      attemptErrors.push(`attempt ${attemptConfig.attempt}: ${failureMessage}`);
      attemptHistory.push({
        attempt: attemptConfig.attempt,
        modelPlanned: attemptConfig.model,
        triedModels,
        temperature: attemptConfig.temperature,
        prompt: promptForAttempt,
        success: false,
        error: failureMessage,
      });
      options.onLog?.(`attempt ${attemptConfig.attempt}/${attemptsPlanned} failed: ${failureMessage}`);
    }

    if (bestCandidate && bestCandidate.analysis.score >= qualityTarget) {
      break;
    }
  }

  if (!bestCandidate) {
    const summary = attemptErrors.length > 0 ? attemptErrors.join(' | ') : 'no valid attempts';
    throw new Error(`AI generation failed across ${attemptsPlanned} attempt(s): ${summary}`);
  }

  const attemptsUsed = attemptHistory.length;
  if (bestCandidate.analysis.score < qualityTarget && options.strictQuality) {
    throw new Error(
      `quality target not reached. best=${bestCandidate.analysis.score.toFixed(3)} < target=${qualityTarget.toFixed(3)}`,
    );
  }

  return {
    blueprint: bestCandidate.prediction.data!,
    voxels: bestCandidate.voxels,
    analysis: bestCandidate.analysis,
    selectedAttempt: bestCandidate.attempt,
    selectedModel: bestCandidate.modelUsed,
    selectedTemperature: bestCandidate.temperature,
    promptForAttempt: bestCandidate.promptForAttempt,
    report: {
      mode: 'ai',
      prompt,
      providerInput: options.providerInput ?? options.provider,
      provider: options.provider,
      qualityProfile,
      qualityTarget: formatSafeScore(qualityTarget),
      attemptsPlanned,
      attemptsUsed,
      escalationUsed: attemptPlan.escalationUsed,
      requestedMaxSize,
      effectiveMaxSize,
      clampFactor: formatSafeScore(clampFactor),
      expectedFillRange: {
        min: expectedFillRange[0],
        max: expectedFillRange[1],
      },
      attempts: attemptHistory,
      selectedAttempt: bestCandidate.attempt,
      selectedModel: bestCandidate.modelUsed,
      selectedTemperature: bestCandidate.temperature,
    },
  };
}
