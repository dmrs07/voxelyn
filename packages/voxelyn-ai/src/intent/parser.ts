import type {
  MacroForm,
  ReliefEnergy,
  ScenarioIntentBiomeTarget,
  ScenarioIntentV2,
  WaterSystem,
} from './types';
import type { BiomeType, ScenarioCategory } from '../types';

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

const normalizePrompt = (prompt: string): string =>
  prompt
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const escapeRegExp = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const containsTerm = (text: string, term: string): boolean => {
  if (!term) return false;
  if (term.includes(' ')) {
    return text.includes(term);
  }
  const pattern = new RegExp(`(?:^|\\s)${escapeRegExp(term)}(?:\\s|$)`);
  return pattern.test(text);
};

const hasAny = (text: string, words: readonly string[]): boolean =>
  words.some((word) => containsTerm(text, word));

const countMatches = (text: string, words: readonly string[]): number =>
  words.reduce((acc, word) => acc + (containsTerm(text, word) ? 1 : 0), 0);

const CATEGORY_HINTS: Record<ScenarioCategory, readonly string[]> = {
  outdoor: [
    'forest',
    'valley',
    'mountain',
    'island',
    'plains',
    'nature',
    'floresta',
    'vale',
    'montanha',
    'ilha',
    'natureza',
  ],
  building: [
    'house',
    'castle',
    'tower',
    'temple',
    'mansion',
    'cabin',
    'fortress',
    'casa',
    'castelo',
    'torre',
    'templo',
    'fortaleza',
  ],
  interior: [
    'interior',
    'room',
    'hall',
    'dungeon',
    'chamber',
    'inside',
    'interno',
    'sala',
    'masmorra',
    'camara',
  ],
  mixed: [
    'village',
    'town',
    'settlement',
    'outpost',
    'city',
    'vilarejo',
    'aldeia',
    'cidade',
    'povoado',
    'acampamento',
  ],
};

const TOPOLOGY_HINTS: Array<{ macro: MacroForm; words: readonly string[] }> = [
  { macro: 'ring', words: ['ring', 'atoll', 'donut', 'torus', 'anel'] },
  { macro: 'island', words: ['island', 'ilha', 'archipelago', 'archipelago'] },
  { macro: 'archipelago', words: ['archipelago', 'isles', 'ilhas'] },
  { macro: 'valley', words: ['valley', 'canyon valley', 'vale'] },
  { macro: 'canyon', words: ['canyon', 'gorge', 'ravine', 'canion'] },
  { macro: 'plateau', words: ['plateau', 'mesa', 'tableland', 'planalto'] },
  { macro: 'volcanic', words: ['volcano', 'volcanic', 'lava', 'magma', 'vulcao'] },
  { macro: 'plain', words: ['plain', 'plains', 'flat', 'planicie'] },
];

const WATER_HINTS: Array<{ water: WaterSystem; words: readonly string[] }> = [
  { water: 'delta', words: ['delta'] },
  { water: 'river', words: ['river', 'stream', 'creek', 'rio', 'riacho'] },
  { water: 'lake', words: ['lake', 'lagoon', 'lago', 'lagoa'] },
  { water: 'coast', words: ['coast', 'shore', 'beach', 'costa', 'praia', 'litoral'] },
  { water: 'oceanic', words: ['ocean', 'sea', 'mar', 'oceano'] },
];

const RELIEF_HINTS: Array<{ relief: ReliefEnergy; words: readonly string[] }> = [
  {
    relief: 'high',
    words: [
      'rugged',
      'steep',
      'dramatic',
      'mountainous',
      'rough',
      'acidentado',
      'ingreme',
      'dramatico',
      'montanhoso',
    ],
  },
  {
    relief: 'low',
    words: ['flat', 'gentle', 'rolling', 'calm', 'plano', 'suave', 'calmo'],
  },
];

const BIOME_HINTS: Array<{ biome: BiomeType; words: readonly string[] }> = [
  { biome: 'forest', words: ['forest', 'jungle', 'woodland', 'floresta', 'selva'] },
  { biome: 'desert', words: ['desert', 'dunes', 'arid', 'deserto', 'duna'] },
  { biome: 'mountains', words: ['mountain', 'peaks', 'ridge', 'montanha', 'pico'] },
  { biome: 'ocean', words: ['ocean', 'sea', 'mar', 'oceano'] },
  { biome: 'river', words: ['river', 'stream', 'rio'] },
  { biome: 'lake', words: ['lake', 'lagoon', 'lago'] },
  { biome: 'swamp', words: ['swamp', 'marsh', 'bog', 'pantano'] },
  { biome: 'tundra', words: ['tundra', 'glacier', 'ice', 'frozen', 'geleira', 'gelo'] },
  { biome: 'volcanic', words: ['volcano', 'lava', 'magma', 'vulcao'] },
  { biome: 'ruins', words: ['ruins', 'ruined', 'ruina', 'ruinas'] },
  { biome: 'urban', words: ['urban', 'city', 'town', 'cidade', 'urbano'] },
  { biome: 'dungeon', words: ['dungeon', 'catacomb', 'masmorra'] },
  { biome: 'plains', words: ['plains', 'grassland', 'field', 'planicie', 'campo'] },
  { biome: 'cave', words: ['cave', 'cavern', 'caverna'] },
  { biome: 'interior', words: ['interior', 'inside', 'interno'] },
];

const LANGUAGE_PT_HINTS = ['com', 'uma', 'para', 'cena', 'mundo', 'floresta', 'ilha', 'rio', 'detalhado'];
const LANGUAGE_EN_HINTS = ['with', 'world', 'scene', 'forest', 'island', 'detailed', 'river'];

const COMPLEXITY_HINTS = ['with', 'and', 'plus', 'including', 'except', 'mas', 'com', 'incluindo'];

const HARD_CONSTRAINT_HINTS = [
  'no water',
  'without water',
  'sem agua',
  'no mountains',
  'sem montanhas',
  'only desert',
  'apenas deserto',
];

const SOFT_CONSTRAINT_HINTS = [
  'prefer',
  'focus on',
  'ideally',
  'preferencia',
  'foco em',
  'idealmente',
];

const MOOD_HINTS = [
  'mystic',
  'dark',
  'bright',
  'cozy',
  'grim',
  'peaceful',
  'mystico',
  'sombrio',
  'aconchegante',
  'pacifico',
  'hostil',
];

const DETAIL_HINTS = {
  high: ['detailed', 'high detail', 'intricate', 'detalhado', 'minucioso'],
  low: ['minimal', 'simple', 'blocky', 'simples'],
};

const SCALE_HINTS = {
  epic: ['epic', 'massive', 'gigantic', 'vast', 'enorme', 'gigante', 'vasto'],
  large: ['large', 'big', 'broad', 'grande', 'amplo'],
  small: ['small', 'tiny', 'compact', 'pequeno', 'compacto'],
};

const WATER_NEGATIONS = ['no water', 'without water', 'dry', 'arid only', 'sem agua', 'seco'];

const detectLanguage = (text: string): 'pt' | 'en' | 'mixed' => {
  const ptScore = countMatches(text, LANGUAGE_PT_HINTS);
  const enScore = countMatches(text, LANGUAGE_EN_HINTS);

  if (ptScore > 0 && enScore > 0) {
    return 'mixed';
  }
  if (ptScore > enScore) {
    return 'pt';
  }
  return 'en';
};

const detectCategory = (text: string): ScenarioCategory => {
  const scores = (Object.keys(CATEGORY_HINTS) as ScenarioCategory[]).map((category) => ({
    category,
    score: countMatches(text, CATEGORY_HINTS[category]),
  }));

  scores.sort((a, b) => b.score - a.score);
  return scores[0]?.score ? scores[0].category : 'outdoor';
};

const detectMacroForm = (text: string): MacroForm => {
  const hit = TOPOLOGY_HINTS.find((entry) => hasAny(text, entry.words));
  return hit?.macro ?? 'plain';
};

const detectWaterSystem = (text: string, macroForm: MacroForm): WaterSystem => {
  if (hasAny(text, WATER_NEGATIONS)) {
    return 'none';
  }

  const hit = WATER_HINTS.find((entry) => hasAny(text, entry.words));
  if (hit) return hit.water;

  if (macroForm === 'island' || macroForm === 'archipelago' || macroForm === 'ring') {
    return 'oceanic';
  }

  return 'none';
};

const detectRelief = (text: string, macroForm: MacroForm): ReliefEnergy => {
  const hit = RELIEF_HINTS.find((entry) => hasAny(text, entry.words));
  if (hit) return hit.relief;
  if (macroForm === 'canyon' || macroForm === 'volcanic' || macroForm === 'valley') return 'high';
  return 'medium';
};

const detectBiomeStrategy = (text: string): ScenarioIntentBiomeTarget[] => {
  const detected = BIOME_HINTS.filter((entry) => hasAny(text, entry.words));

  if (detected.length === 0) {
    return [{ biome: 'plains', weight: 1, minCoverage: 0.5, maxCoverage: 1 }];
  }

  const weight = 1 / detected.length;
  return detected.map((entry) => ({
    biome: entry.biome,
    weight,
    minCoverage: detected.length === 1 ? 0.45 : 0.1,
    maxCoverage: detected.length === 1 ? 1 : 0.6,
  }));
};

const detectSettlementPattern = (
  text: string
): 'none' | 'clustered' | 'linear' | 'radial' => {
  if (hasAny(text, ['line', 'river town', 'linear', 'ao longo', 'linear'])) return 'linear';
  if (hasAny(text, ['radial', 'hub', 'circular city', 'radial'])) return 'radial';
  if (hasAny(text, ['village', 'town', 'settlement', 'aldeia', 'cidade', 'povoado'])) return 'clustered';
  return 'none';
};

const detectTraversal = (text: string): 'open' | 'guided' | 'labyrinth' => {
  if (hasAny(text, ['maze', 'labyrinth', 'masmorra', 'labirinto'])) return 'labyrinth';
  if (hasAny(text, ['path', 'guided', 'route', 'trilha', 'guia'])) return 'guided';
  return 'open';
};

const detectDifficulty = (text: string): 'flat' | 'ramp' | 'spiky' => {
  if (hasAny(text, ['spiky', 'sudden', 'ambush', 'picos', 'emboscada'])) return 'spiky';
  if (hasAny(text, ['progressive', 'ramp', 'escalating', 'progressivo', 'escalando'])) return 'ramp';
  return 'flat';
};

const detectResourceDensity = (text: string): 'scarce' | 'balanced' | 'rich' => {
  if (hasAny(text, ['scarce', 'survival', 'limited resources', 'escasso', 'poucos recursos'])) return 'scarce';
  if (hasAny(text, ['rich resources', 'abundant', 'loot heavy', 'abundante', 'rico'])) return 'rich';
  return 'balanced';
};

const detectLandmarkDensity = (text: string): 'sparse' | 'normal' | 'dense' => {
  if (hasAny(text, ['dense landmarks', 'many landmarks', 'muitos marcos', 'dense'])) return 'dense';
  if (hasAny(text, ['empty', 'sparse', 'minimal landmarks', 'vazio', 'esparso'])) return 'sparse';
  return 'normal';
};

const detectScaleIntent = (text: string): ScenarioIntentV2['scaleIntent'] => {
  if (hasAny(text, SCALE_HINTS.epic)) {
    return { worldScale: 'epic', detailLevel: hasAny(text, DETAIL_HINTS.low) ? 'medium' : 'high' };
  }
  if (hasAny(text, SCALE_HINTS.large)) {
    return { worldScale: 'large', detailLevel: hasAny(text, DETAIL_HINTS.high) ? 'high' : 'medium' };
  }
  if (hasAny(text, SCALE_HINTS.small)) {
    return { worldScale: 'small', detailLevel: hasAny(text, DETAIL_HINTS.high) ? 'high' : 'medium' };
  }

  if (hasAny(text, DETAIL_HINTS.high)) {
    return { worldScale: 'medium', detailLevel: 'high' };
  }
  if (hasAny(text, DETAIL_HINTS.low)) {
    return { worldScale: 'medium', detailLevel: 'low' };
  }

  return { worldScale: 'medium', detailLevel: 'medium' };
};

const extractConstraints = (text: string): { hard: string[]; soft: string[] } => {
  const hard = HARD_CONSTRAINT_HINTS.filter((hint) => text.includes(hint));
  const soft = SOFT_CONSTRAINT_HINTS.filter((hint) => text.includes(hint));
  return { hard, soft };
};

const detectPOIs = (text: string): string[] => {
  const pois: string[] = [];

  if (hasAny(text, ['ruin', 'ruins', 'ruina', 'ruinas'])) pois.push('ruins');
  if (hasAny(text, ['temple', 'templo', 'shrine'])) pois.push('temple');
  if (hasAny(text, ['tower', 'watchtower', 'torre'])) pois.push('tower');
  if (hasAny(text, ['village', 'town', 'aldeia', 'cidade'])) pois.push('settlement');
  if (hasAny(text, ['camp', 'acampamento'])) pois.push('camp');
  if (hasAny(text, ['dungeon', 'masmorra', 'catacomb'])) pois.push('dungeon');

  return pois;
};

const scoreConfidence = (text: string, biomeCount: number, hardCount: number, softCount: number): number => {
  const signalCount =
    countMatches(text, COMPLEXITY_HINTS) +
    biomeCount +
    hardCount +
    softCount +
    countMatches(text, MOOD_HINTS);

  const ambiguityPenalty = hasAny(text, ['maybe', 'perhaps', 'talvez']) ? 0.08 : 0;

  return clamp01(0.35 + signalCount * 0.06 - ambiguityPenalty);
};

const scoreComplexity = (text: string, biomeCount: number): number => {
  const relationCount = countMatches(text, COMPLEXITY_HINTS);
  const sizeFactor = Math.min(1, text.length / 220);
  return clamp01(0.2 + relationCount * 0.08 + biomeCount * 0.04 + sizeFactor * 0.25);
};

export function parseScenarioIntent(
  prompt: string,
  locale: 'auto' | 'pt' | 'en' = 'auto'
): ScenarioIntentV2 {
  const normalized = normalizePrompt(prompt);
  const language = locale === 'auto' ? detectLanguage(normalized) : locale;

  const categoryIntent = detectCategory(normalized);
  const macroForm = detectMacroForm(normalized);
  const waterSystem = detectWaterSystem(normalized, macroForm);
  const reliefEnergy = detectRelief(normalized, macroForm);

  const biomeStrategy = detectBiomeStrategy(normalized);
  const composition = {
    poiArchetypes: detectPOIs(normalized),
    settlementPattern: detectSettlementPattern(normalized),
    traversalFlow: detectTraversal(normalized),
  };

  const dynamics = {
    difficultyCurve: detectDifficulty(normalized),
    resourceDensity: detectResourceDensity(normalized),
    landmarkDensity: detectLandmarkDensity(normalized),
  };

  const scaleIntent = detectScaleIntent(normalized);
  const constraints = extractConstraints(normalized);

  const confidence = scoreConfidence(
    normalized,
    biomeStrategy.length,
    constraints.hard.length,
    constraints.soft.length
  );

  const complexity = scoreComplexity(normalized, biomeStrategy.length);

  const conflicts: string[] = [];
  if (constraints.hard.some((h) => h.includes('no water') || h.includes('sem agua')) && waterSystem !== 'none') {
    conflicts.push('Hard constraint requests no water but prompt also implies a water system.');
  }

  return {
    version: 2,
    prompt,
    language,
    confidence,
    complexity,
    categoryIntent,
    topology: {
      macroForm,
      waterSystem,
      reliefEnergy,
    },
    biomeStrategy,
    composition,
    dynamics,
    scaleIntent,
    styleIntent: {
      mood: MOOD_HINTS.filter((m) => normalized.includes(m)),
      era: hasAny(normalized, ['medieval', 'medievale', 'medieval'])
        ? 'medieval'
        : hasAny(normalized, ['futuristic', 'sci fi', 'futurista'])
          ? 'futuristic'
          : undefined,
      paletteBias: hasAny(normalized, ['cold', 'frozen', 'frio'])
        ? ['cool']
        : hasAny(normalized, ['warm', 'desert', 'quente'])
          ? ['warm']
          : undefined,
    },
    hardConstraints: constraints.hard,
    softConstraints: constraints.soft,
    conflicts,
  };
}
