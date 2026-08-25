import {
  RIVAL_BASE,
  RIVAL_JITTER,
  RIVAL_MIN_SCORE,
  RIVAL_PER_SKILL,
  TASK_CORE_COST,
  TASK_POLISH_COST,
} from './constants.js';
import { SLOTS, TASKS } from './data.js';
import {
  AUDIENCES_TEXT,
  CHOICE_TEXT,
  CLASSIC_BIO,
  CONSTRAINTS_TEXT,
  CURRENCY_TEXT,
  CVS_TEXT,
  DOMAINS_TEXT,
  NOTES_TEXT,
  RETURNING_TEXT,
  TASK_TEXT,
  type Locale,
} from './text.js';
import type {
  CoatPattern,
  GearId,
  Personality,
  Quirk,
  SlotId,
  Spec,
  SpecialCategoryId,
  SponsorContract,
  Task,
  Tier,
  Track,
} from './types.js';

/**
 * O GERADOR: cada run sorteia uma equipe possivel, um projeto problematico e
 * um espaco imperfeito. Tudo aqui e FUNCAO PURA sobre a semente — a mesma
 * disciplina do resto da sim: `(semente, equipe contratada, comandos)`
 * reproduz a run inteira, recrutamento incluido.
 *
 * Regra de design (a do proprio jogo): raca muda COMPORTAMENTO, nunca
 * profissao; tier muda a FORMA de jogar, nunca so a velocidade; trait cria
 * SITUACAO, nunca so +10%.
 */

// ------------------------------------------------------------------- rng

const nextU32 = (s: number): number => {
  let x = s >>> 0 || 0x6d2b79f5;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  return x >>> 0;
};

/** Um dado proprio por sorteio (equipe/projeto/layout nao disputam draws). */
class Dice {
  private s: number;
  constructor(seed: number, salt: number) {
    this.s = nextU32(nextU32((seed ^ salt) >>> 0));
  }
  roll(): number {
    this.s = nextU32(this.s);
    return this.s / 0x100000000;
  }
  pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(this.roll() * arr.length)]!;
  }
  int(n: number): number {
    return Math.floor(this.roll() * n);
  }
}

// ---------------------------------------------------------------- moedas

/** Tres moedas fisicas; internamente tudo e tampinha. */
export const BOLINHA = 10;
export const PEIXINHO = 100;
/** O orcamento de uma run: da para 3 ou 4 gatos, dependendo do tier. */
export const RUN_BUDGET = 420;

export const fmtCost = (c: number, locale: Locale = 'en'): string => {
  const cur = CURRENCY_TEXT[locale];
  const fish = Math.floor(c / PEIXINHO);
  const ball = Math.floor((c % PEIXINHO) / BOLINHA);
  const cap = c % BOLINHA;
  const parts: string[] = [];
  if (fish) parts.push(`${fish} ${cur.fish[fish > 1 ? 1 : 0]}`);
  if (ball) parts.push(`${ball} ${cur.ball[ball > 1 ? 1 : 0]}`);
  if (cap) parts.push(`${cap} ${cur.cap[cap > 1 ? 1 : 0]}`);
  return parts.join(' + ') || cur.free;
};

// ------------------------------------------------------------------ tipos


/**
 * TRAITS: seis que ajudam, seis que atrapalham, todos mecanicos. Dois vem
 * visiveis no curriculo; um fica OCULTO e se revela no meio da run — a
 * incerteza saudavel do recrutamento.
 */
export type TraitId =
  | 'cacador-de-bugs' // conserta bugs 1.5x
  | 'dorme-rapido' // soneca rende 1.5x
  | 'polidactila' // +10% de velocidade (mais dedos, mais teclas)
  | 'pitchador-nato' // habilidade de palco 1.5x
  | 'gambiarra-elegante' // 10% de atalho genial ao shipar
  | 'zen' // estresse de trabalho 0.85x
  | 'dorme-no-teclado' // apagar NA MESA pode criar bug (40%)
  | 'zoomies-noturnos' // depois de 60% da run, proc de caos 1.6x
  | 'producao-em-main' // +12% de bug ao shipar
  | 'detesta-legado' // conserta bugs 0.6x
  | 'medo-de-palco' // habilidade de palco 0.5x
  | 'guloso' // fome drena 1.4x
  | 'recusa-css'; // em frontend rende quase nada, sob protesto

export const POSITIVE_TRAITS: readonly TraitId[] = [
  'cacador-de-bugs',
  'dorme-rapido',
  'polidactila',
  'pitchador-nato',
  'gambiarra-elegante',
  'zen',
];
export const NEGATIVE_TRAITS: readonly TraitId[] = [
  'dorme-no-teclado',
  'zoomies-noturnos',
  'producao-em-main',
  'detesta-legado',
  'medo-de-palco',
  'guloso',
];


export type BreedMod = { nap: number; stress: number; hunger: number; social: number };

export type Candidate = {
  id: string;
  name: string;
  breed: string;
  /** O toque mecanico da raca (1 = neutro). */
  breedMod: BreedMod;
  pattern: CoatPattern;
  /** Cores 0xRRGGBB — dados puros; o cliente converte. */
  coat: { body: number; mark: number; belly: number };
  big: boolean;
  specialty: Spec;
  tier: Tier;
  personality: Personality;
  quirk: Quirk;
  /** Os dois traits do curriculo. */
  traits: readonly TraitId[];
  /** O que o curriculo NAO conta. Revela-se no meio da run. */
  hiddenTrait: TraitId;
  cost: number;
  note: string;
  cv: string;
};

// ------------------------------------------------------------------ racas

/**
 * 30 racas. A raca muda COMPORTAMENTO e aparencia — nunca determina
 * profissao. `nudge` e o toque mecanico leve de algumas racas notaveis.
 * DIRECAO dos campos: todos multiplicam TAXAS — nap > 1 recupera mais
 * rapido (soneca mais curta: o Bengal "dorme menos" porque LEVANTA antes,
 * nao porque a cama rende menos — achado de revisao do Slice D).
 */
type Breed = {
  name: string;
  pattern: CoatPattern;
  body: number;
  mark: number;
  belly: number;
  big?: boolean;
  nudge?: Partial<{ nap: number; stress: number; hunger: number; social: number }>;
};

export const BREEDS: readonly Breed[] = [
  { name: 'SRD', pattern: 'tabby', body: 0xb98a54, mark: 0x8a6238, belly: 0xe8d4b0 },
  { name: 'Siames', pattern: 'siames', body: 0xe6dac4, mark: 0x5e4a3e, belly: 0xf0e8d6 },
  { name: 'Maine Coon', pattern: 'tabby', body: 0x8e8e98, mark: 0x6e6e7a, belly: 0xc4c4cc, big: true, nudge: { social: 1.2 } },
  { name: 'Persa', pattern: 'solid', body: 0xd8cfc0, mark: 0xb8ab96, belly: 0xefe9dc, nudge: { stress: 0.9 } },
  { name: 'Bengal', pattern: 'tabby', body: 0xd8a050, mark: 0x7a5222, belly: 0xecd0a0, nudge: { nap: 1.18 } },
  { name: 'Sphynx', pattern: 'sphynx', body: 0xd8b0a0, mark: 0xb08878, belly: 0xecd0c4 },
  { name: 'Ragdoll', pattern: 'siames', body: 0xe8e0d4, mark: 0x8a7a6e, belly: 0xf4efe6, big: true, nudge: { social: 1.15 } },
  { name: 'British Shorthair', pattern: 'solid', body: 0x9098a8, mark: 0x707888, belly: 0xbcc2ce },
  { name: 'Scottish Fold', pattern: 'solid', body: 0xb0a89c, mark: 0x8a8478, belly: 0xd6d0c4 },
  { name: 'Angora', pattern: 'solid', body: 0xf0ece2, mark: 0xccc6b8, belly: 0xfaf8f0 },
  { name: 'Siberiano', pattern: 'tabby', body: 0xa88c68, mark: 0x7a6248, belly: 0xd8c4a4, big: true },
  { name: 'Noruegues da Floresta', pattern: 'tabby', body: 0x988670, mark: 0x6e5e4c, belly: 0xccc0aa, big: true },
  { name: 'Abissinio', pattern: 'solid', body: 0xc09058, mark: 0x94682e, belly: 0xe0c49c, nudge: { nap: 1.1 } },
  { name: 'Birmanes', pattern: 'siames', body: 0xdccbb4, mark: 0x6e5648, belly: 0xefe4d2 },
  { name: 'Burmese', pattern: 'solid', body: 0x6e5240, mark: 0x503a2c, belly: 0x9a7c64 },
  { name: 'Bombay', pattern: 'solid', body: 0x2c2a32, mark: 0x1c1a22, belly: 0x44424c },
  { name: 'Chartreux', pattern: 'solid', body: 0x8a92a2, mark: 0x687080, belly: 0xb2b8c4 },
  { name: 'Devon Rex', pattern: 'sphynx', body: 0xb09a88, mark: 0x8a7462, belly: 0xd6c4b2 },
  { name: 'Cornish Rex', pattern: 'sphynx', body: 0xcab6a0, mark: 0xa08a72, belly: 0xe6d8c4 },
  { name: 'Russian Blue', pattern: 'solid', body: 0x7e8898, mark: 0x5e6878, belly: 0xa8b0be },
  { name: 'Manx', pattern: 'tabby', body: 0xa89078, mark: 0x7c664e, belly: 0xd4c2a8 },
  { name: 'American Shorthair', pattern: 'tabby', body: 0xb0b0b8, mark: 0x82828c, belly: 0xd8d8de },
  { name: 'American Curl', pattern: 'solid', body: 0xd0b088, mark: 0xa8885e, belly: 0xe8d6b6 },
  { name: 'Oriental Shorthair', pattern: 'solid', body: 0x555058, mark: 0x3a363e, belly: 0x807a84 },
  { name: 'Tonquines', pattern: 'siames', body: 0xcfc0a8, mark: 0x74604c, belly: 0xe6dcc8 },
  { name: 'Somali', pattern: 'tabby', body: 0xc89860, mark: 0x966c36, belly: 0xe4ccA4 },
  { name: 'Turkish Van', pattern: 'tuxedo', body: 0xf0ece4, mark: 0xd08a4a, belly: 0xfaf8f2 },
  { name: 'Egyptian Mau', pattern: 'tabby', body: 0xb8bcac, mark: 0x76806a, belly: 0xdadec8 },
  { name: 'Savannah', pattern: 'tabby', body: 0xccae72, mark: 0x8c703e, belly: 0xe8d8ae, nudge: { nap: 1.18 } },
  { name: 'Munchkin', pattern: 'tuxedo', body: 0x8c8494, mark: 0x37343c, belly: 0xece8f0 },
];

const NAMES = [
  'Kernel', 'Mochi', 'Farofa', 'Pacoca', 'Pudim', 'Sushi', 'Pixel', 'Sudo',
  'Lambda', 'Nevoa', 'Brigadeiro', 'Tapioca', 'Virgula', 'Cedilha', 'Grep',
  'Panqueca', 'Chumbinho', 'Polenta', 'Jabuticaba', 'Miso',
] as const;

const TIER_META: Record<Tier, { label: string; base: number }> = {
  junior: { label: 'junior', base: 12 },
  pleno: { label: 'pleno', base: 64 },
  senior: { label: 'senior', base: 230 },
  especialista: { label: 'especialista', base: 400 },
};




const PERSONALITIES: readonly Personality[] = ['perfeccionista', 'cowboy', 'calmo', 'julga-em-silencio'];
const QUIRKS: readonly Quirk[] = ['territorial', 'morde-cabo', 'dorme-no-rack', 'caixa'];

// ----------------------------------------------------------- candidatos

const rollTrait = (d: Dice, pool: readonly TraitId[], not: TraitId[]): TraitId => {
  for (let i = 0; i < 20; i++) {
    const t = d.pick(pool);
    if (!not.includes(t)) return t;
  }
  return pool[0]!;
};

const rollCandidate = (d: Dice, spec: Spec, usedNames: string[], locale: Locale): Candidate => {
  const breed = d.pick(BREEDS);
  let name = d.pick(NAMES) as string;
  while (usedNames.includes(name)) name = d.pick(NAMES) as string;
  usedNames.push(name);
  // Tier: junior e pleno comuns; senior as vezes; especialista raro.
  const r = d.roll();
  const tier: Tier = r < 0.34 ? 'junior' : r < 0.72 ? 'pleno' : r < 0.92 ? 'senior' : 'especialista';
  const t1 = rollTrait(d, d.roll() < 0.6 ? POSITIVE_TRAITS : NEGATIVE_TRAITS, []);
  const t2 = rollTrait(d, d.roll() < 0.5 ? POSITIVE_TRAITS : NEGATIVE_TRAITS, [t1]);
  const hidden = rollTrait(d, d.roll() < 0.45 ? POSITIVE_TRAITS : NEGATIVE_TRAITS, [t1, t2]);
  const visiblePos = [t1, t2].filter((t) => (POSITIVE_TRAITS as readonly string[]).includes(t)).length;
  const visibleNeg = 2 - visiblePos;
  const cost = Math.max(6, TIER_META[tier].base + visiblePos * 8 - visibleNeg * 4);
  return {
    id: `${name.toLowerCase()}-${d.int(1000)}`,
    name,
    breed: breed.name,
    breedMod: { nap: 1, stress: 1, hunger: 1, social: 1, ...breed.nudge },
    pattern: breed.pattern,
    coat: { body: breed.body, mark: breed.mark, belly: breed.belly },
    big: breed.big ?? false,
    specialty: spec,
    tier,
    personality: d.pick(PERSONALITIES),
    quirk: d.pick(QUIRKS),
    traits: [t1, t2],
    hiddenTrait: hidden,
    cost,
    note: d.pick(NOTES_TEXT[locale]),
    cv: d.pick(CVS_TEXT[locale]),
  };
};

/**
 * SEIS candidatos: os quatro primeiros cobrem as quatro trilhas (uma run sem
 * backend possivel nao e roguelite, e loteria); os dois ultimos sao curinga —
 * qualquer disciplina, incluindo freestyler.
 */
const TIER_DOWN: Record<Tier, Tier> = {
  especialista: 'senior',
  senior: 'pleno',
  pleno: 'junior',
  junior: 'junior',
};

export const rollCandidates = (seed: number, locale: Locale = 'en'): Candidate[] => {
  const d = new Dice(seed, 0xca7a11);
  const used: string[] = [];
  const tracks: Spec[] = ['backend', 'frontend', 'design', 'devops'];
  const out = tracks.map((t) => rollCandidate(d, t, used, locale));
  // O quarteto de COBERTURA tem de caber no orcamento: quatro tiers caros
  // juntos fariam a unica equipe completa custar mais que a run permite.
  // Rebaixa o mais caro (deterministicamente) ate caber — a variedade fica,
  // a run impossivel nao nasce.
  const total = (): number => out.reduce((s, c) => s + c.cost, 0);
  let guard = 0;
  while (total() > RUN_BUDGET && guard++ < 16) {
    const rich = out.reduce((a, b) => (b.cost > a.cost ? b : a));
    const downTier = TIER_DOWN[rich.tier];
    if (downTier === rich.tier) break;
    const delta = TIER_META[rich.tier].base - TIER_META[downTier].base;
    rich.tier = downTier;
    rich.cost = Math.max(6, rich.cost - delta);
  }
  const wild: Spec[] = ['backend', 'frontend', 'design', 'devops', 'freestyler', 'freestyler'];
  out.push(rollCandidate(d, d.pick(wild), used, locale));
  out.push(rollCandidate(d, d.pick(wild), used, locale));
  return out;
};

// -------------------------------------------------------------- projeto

export type ProjectRisk = 'integracao-instavel' | 'hype' | 'dados-sensiveis';
export type ProjectEmphasis = 'tecnica' | 'estabilidade' | 'experiencia' | 'inovacao';

export type ProjectSpec = {
  name: string;
  brief: string;
  tasks: Omit<Task, 'progress' | 'done' | 'cut' | 'awaitingShip' | 'chosen'>[];
  /** A lente que a banca deste evento valoriza 1.25x. Anunciada no convite. */
  emphasis: ProjectEmphasis;
  /** O risco oculto do projeto. NAO anunciado. */
  risk: ProjectRisk;
};

const NAME_A = ['Ronro', 'Fish', 'Box', 'Miau', 'Purr', 'Nap', 'Lamb', 'Cat'] as const;
const NAME_B = ['med', 'Flow', 'Box', 'Hub', 'Ship', 'Deck', 'Lab', 'Go'] as const;

/** Tres FORMAS de grafo curadas — validadas aciclicas e completaveis. */
const GRAPH_SHAPES: readonly Record<string, readonly string[]>[] = [
  // A: a original — dashboard espera API que espera schema.
  { b1: [], b2: ['b1'], b3: ['b2'], d1: [], d2: ['d1'], d3: ['d1'], f1: ['d1'], f2: ['b2', 'd1'], f3: ['f2'], o1: ['b1'], o2: ['o1'], o3: ['o2'] },
  // B: infra espera a API; o design itera sobre o onboarding.
  { b1: [], b2: ['b1'], b3: ['b2'], d1: [], d2: ['d1', 'f1'], d3: ['d1'], f1: ['d1'], f2: ['b2', 'd1'], f3: ['f2'], o1: ['b1'], o2: ['o1', 'b2'], o3: ['o2'] },
  // C: a API espera o pipeline (deploy-first) e o polish de design espera o fluxo.
  { b1: [], b2: ['b1', 'o1'], b3: ['b2'], d1: [], d2: ['d1'], d3: ['d2'], f1: ['d1'], f2: ['b2', 'd1'], f3: ['f2'], o1: ['b1'], o2: ['o1'], o3: ['o2'] },
];

export const rollProject = (seed: number, locale: Locale = 'en'): ProjectSpec => {
  const d = new Dice(seed, 0x9e0057);
  const name = `${d.pick(NAME_A)}${d.pick(NAME_B)}`;
  const brief =
    locale === 'pt'
      ? `plataforma de ${d.pick(DOMAINS_TEXT.pt)} para ${d.pick(AUDIENCES_TEXT.pt)}, ${d.pick(CONSTRAINTS_TEXT.pt)}`
      : `a ${d.pick(DOMAINS_TEXT.en)} platform for ${d.pick(AUDIENCES_TEXT.en)}, ${d.pick(CONSTRAINTS_TEXT.en)}`;
  const shape = d.pick(GRAPH_SHAPES);
  const tasks = TASKS.map((t) => ({
    ...t,
    label: d.pick(TASK_TEXT[locale][t.id] ?? [t.label]),
    choice: CHOICE_TEXT[locale][t.id] ?? undefined,
    deps: shape[t.id] ?? t.deps,
    // Jitter de custo: mesma forma, pesos diferentes por edicao.
    cost: Math.round((t.polish ? TASK_POLISH_COST : TASK_CORE_COST) * (0.85 + d.roll() * 0.3)),
  }));
  const emphasis = d.pick(['tecnica', 'estabilidade', 'experiencia', 'inovacao'] as const);
  const risk = d.pick(['integracao-instavel', 'hype', 'dados-sensiveis'] as const);
  return { name, brief, tasks, emphasis, risk };
};

// --------------------------------------------------------------- layouts

export type LayoutMods = {
  stressWork: number;
  stressIdle: number;
  fixSpeed: number;
  napRate: number;
  moralShip: number;
  eatScale: number;
};

export type LayoutSpec = {
  id: string;
  name: string;
  blurb: string;
  slots: { id: SlotId; x: number; y: number; track: Track | null }[];
  mods: LayoutMods;
};

const MODS = (over: Partial<LayoutMods>): LayoutMods => ({
  stressWork: 1,
  stressIdle: 1,
  fixSpeed: 1,
  napRate: 1,
  moralShip: 1,
  eatScale: 1,
  ...over,
});

const S = (
  bk: [number, number],
  fe: [number, number],
  de: [number, number],
  op: [number, number],
  puff: [number, number],
  rack: [number, number],
  cafe: [number, number]
): LayoutSpec['slots'] => [
  { id: 'desk-backend', x: bk[0], y: bk[1], track: 'backend' },
  { id: 'desk-frontend', x: fe[0], y: fe[1], track: 'frontend' },
  { id: 'desk-design', x: de[0], y: de[1], track: 'design' },
  { id: 'desk-devops', x: op[0], y: op[1], track: 'devops' },
  { id: 'puff', x: puff[0], y: puff[1], track: null },
  { id: 'rack', x: rack[0], y: rack[1], track: null },
  { id: 'cafe', x: cafe[0], y: cafe[1], track: null },
];

/** Seis layouts CURADOS — worldgen livre vira sopa; layout com opiniao vira jogo. */
export const LAYOUTS: readonly LayoutSpec[] = [
  {
    id: 'open-booth',
    name: 'Open Booth',
    blurb: 'colaboracao facil, distracao tambem',
    slots: S([86, 126], [394, 126], [86, 190], [394, 190], [56, 240], [432, 208], [240, 210]),
    mods: MODS({ moralShip: 1.5, stressIdle: 1.15 }),
  },
  {
    id: 'cubiculos',
    name: 'Cubiculos',
    blurb: 'foco individual, comunicacao lenta',
    slots: S([70, 118], [412, 118], [70, 214], [412, 196], [190, 240], [240, 148], [310, 238]),
    mods: MODS({ stressWork: 0.85, moralShip: 0.8 }),
  },
  {
    id: 'ilha-central',
    name: 'Ilha Central',
    blurb: 'pair programming, gargalo no meio',
    slots: S([172, 148], [308, 148], [172, 208], [308, 208], [56, 238], [432, 208], [56, 140]),
    mods: MODS({ moralShip: 1.3, stressWork: 1.05 }),
  },
  {
    id: 'server-corner',
    name: 'Server Corner',
    blurb: 'deploy eficiente, calor e cochilos no rack',
    slots: S([100, 130], [340, 122], [100, 196], [340, 196], [56, 240], [240, 156], [410, 240]),
    mods: MODS({ fixSpeed: 1.3, napRate: 0.9 }),
  },
  {
    id: 'quiet-zone',
    name: 'Quiet Zone',
    blurb: 'foco elevado, moral social menor',
    slots: S([90, 120], [396, 120], [160, 210], [330, 210], [56, 240], [432, 160], [240, 244]),
    mods: MODS({ stressWork: 0.8, stressIdle: 0.9, moralShip: 0.7 }),
  },
  {
    id: 'cafeteria',
    name: 'Perto da Cafeteria',
    blurb: 'fome controlada, movimento constante',
    slots: S([86, 132], [394, 132], [120, 208], [360, 208], [56, 244], [432, 176], [240, 160]),
    mods: MODS({ eatScale: 0.6, stressIdle: 1.1 }),
  },
];

export const rollLayout = (seed: number): LayoutSpec => {
  const d = new Dice(seed, 0x1a70c7);
  return d.pick(LAYOUTS);
};

// ------------------------------------------------------- time classico

/**
 * O TIME CLASSICO — Bigode, Cheeto, Almofada e Smoking — preservado como
 * candidatos plenos sem traits extras (menos o protesto anti-CSS do
 * Bigode). E o time dos testes de arquetipo e o rosto do jogo.
 */
export const classicTeam = (locale: Locale = 'en'): readonly Candidate[] =>
  CLASSIC_BASE.map((c) => ({ ...c, note: CLASSIC_BIO[locale][c.id]!.note, cv: CLASSIC_BIO[locale][c.id]!.cv }));

const CLASSIC_BASE: readonly Candidate[] = [
  {
    id: 'bigode',
    name: 'Bigode',
    breed: 'Siames',
    breedMod: { nap: 1, stress: 1, hunger: 1, social: 1 },
    pattern: 'siames',
    coat: { body: 0xe6dac4, mark: 0x5e4a3e, belly: 0xf0e8d6 },
    big: false,
    specialty: 'backend',
    tier: 'pleno',
    personality: 'perfeccionista',
    quirk: 'territorial',
    traits: ['recusa-css'],
    hiddenTrait: 'zen',
    cost: 64,
    note: 'arquitetura impecavel, recusa CSS.',
    cv: 'nao deixa mergear sem um "shipa" teu.',
  },
  {
    id: 'cheeto',
    name: 'Cheeto',
    breed: 'SRD',
    breedMod: { nap: 1, stress: 1, hunger: 1, social: 1 },
    pattern: 'tabby',
    coat: { body: 0xe8943e, mark: 0xc47028, belly: 0xf4d2a0 },
    big: false,
    specialty: 'frontend',
    tier: 'pleno',
    personality: 'cowboy',
    quirk: 'morde-cabo',
    traits: [],
    hiddenTrait: 'gambiarra-elegante',
    cost: 60,
    note: 'um neuronio, confianca infinita.',
    cv: 'shipa sem testar.',
  },
  {
    id: 'almofada',
    name: 'Almofada',
    breed: 'Maine Coon',
    breedMod: { nap: 1, stress: 1, hunger: 1, social: 1 },
    pattern: 'solid',
    coat: { body: 0x8e8e98, mark: 0x6e6e7a, belly: 0xc4c4cc },
    big: true,
    specialty: 'devops',
    tier: 'pleno',
    personality: 'calmo',
    quirk: 'dorme-no-rack',
    traits: [],
    hiddenTrait: 'dorme-rapido',
    cost: 64,
    note: 'ocupa tres cadeiras, calmo ate no incendio.',
    cv: 'cochila no servidor.',
  },
  {
    id: 'smoking',
    name: 'Smoking',
    breed: 'Bombay',
    breedMod: { nap: 1, stress: 1, hunger: 1, social: 1 },
    pattern: 'tuxedo',
    coat: { body: 0x2c2a32, mark: 0x1c1a22, belly: 0xeeeef0 },
    big: false,
    specialty: 'design',
    tier: 'pleno',
    personality: 'julga-em-silencio',
    quirk: 'caixa',
    traits: [],
    hiddenTrait: 'pitchador-nato',
    cost: 64,
    note: 'interfaces lindas; sofre em silencio a cada bug vivo.',
    cv: 'ele SABE.',
  },
];

/** O layout classico (o mesmo do slice anterior), para testes e fallback. */
export const CLASSIC_LAYOUT: LayoutSpec = {
  id: 'classic',
  name: 'Open Booth',
  blurb: 'o booth original',
  slots: SLOTS.map((s) => ({ ...s })),
  mods: MODS({}),
};

export const CLASSIC_TEAM: readonly Candidate[] = classicTeam('en');

// ------------------------------------------------------------- apetrechos

/** O catalogo da lojinha; a edicao oferece TRES por vez (sorteio da semente). */
export const GEAR: readonly { id: GearId; cost: number }[] = [
  { id: 'teclado-mecanico', cost: 45 },
  { id: 'almofada-termica', cost: 30 },
  { id: 'rubber-duck', cost: 25 },
  { id: 'cafeteira-pro', cost: 35 },
  { id: 'catnip', cost: 20 },
  { id: 'laser-pointer', cost: 15 },
];

export const rollGearOffers = (seed: number): { id: GearId; cost: number }[] => {
  const d = new Dice(seed, 0x6ea60ff);
  const pool = [...GEAR];
  const out: { id: GearId; cost: number }[] = [];
  for (let i = 0; i < 3; i++) out.push(pool.splice(d.int(pool.length), 1)[0]!);
  return out;
};

// --------------------------------------------------------------- sponsors

/**
 * O CATALOGO de sponsors. Cada contrato paga orcamento adiantado, cobra um
 * objetivo checavel na demo e AMARRA algo em troca: a API deles no caminho
 * da demo, a auditoria que encarece bugs, ou o terno de mascote no palco.
 * Patrocinio de graca nao existe — e a reputacao abre as portas: os grandes
 * so patrocinam quem ja apareceu no telao.
 */
export const SPONSORS: readonly SponsorContract[] = [
  { id: 'tunacloud', budget: 60, objective: 'ship-8', payout: 60, strings: 'demo-api' },
  { id: 'litterbox-vc', budget: 50, objective: 'crowd', payout: 70, strings: 'branding' },
  { id: 'purrdata', budget: 80, objective: 'zero-bugs', payout: 80, strings: 'audit' },
  { id: 'meowware', budget: 100, objective: 'innovation', payout: 90, strings: 'demo-api' },
];

/** Reputacao minima para cada sponsor sequer te procurar. */
export const SPONSOR_REP_GATE: Record<string, number> = {
  tunacloud: 1,
  'litterbox-vc': 2,
  purrdata: 3,
  meowware: 5,
};

/**
 * A OFERTA da edicao: no maximo UM sponsor procura o booth, sorteado da
 * semente entre os que a reputacao ja desbloqueou. Rep 0 = ninguem liga.
 */
export const rollSponsorOffer = (seed: number, rep: number): SponsorContract | null => {
  const unlocked = SPONSORS.filter((s) => rep >= (SPONSOR_REP_GATE[s.id] ?? 99));
  if (unlocked.length === 0) return null;
  const d = new Dice(seed, 0x5b0050);
  return d.pick(unlocked);
};

// ------------------------------------------------------ categoria especial

const SPECIAL_CATEGORIES: readonly SpecialCategoryId[] = [
  'golden-whisker',
  'smooth-paws',
  'iron-litter',
  'crowd-purr',
  'clean-scratch',
];

/** A categoria especial da edicao — anunciada no convite, como a enfase. */
export const rollSpecialCategory = (seed: number): SpecialCategoryId => {
  const d = new Dice(seed, 0x57ec1a1);
  return d.pick(SPECIAL_CATEGORIES);
};

// -------------------------------------------------------------- rivalidade

/** O booth ao lado e de CACHORROS. Nomes proprios: iguais nos dois idiomas. */
export const RIVAL_NAMES = [
  'The Golden Retrievers',
  'Team Fetch',
  'The Debug Doghouse',
  'Woofstack',
] as const;

export const rollRivalName = (seed: number): string => {
  const d = new Dice(seed, 0xd06e5);
  return d.pick(RIVAL_NAMES);
};

/**
 * A nota do rival nesta edicao: funcao pura de (semente, skill da carreira).
 * Skill 0 fica em 38..78 — acima do bot parado, abaixo do jogador decente.
 * Cada derrota tua sobe o skill deles na carreira; o daily usa skill 0.
 */
export const rivalScoreFor = (seed: number, skill: number): number => {
  const h = nextU32(nextU32((seed ^ 0x51de11a7) >>> 0));
  const jitter = (h % (RIVAL_JITTER * 2 + 1)) - RIVAL_JITTER;
  return Math.max(RIVAL_MIN_SCORE, Math.round(RIVAL_BASE + skill * RIVAL_PER_SKILL + jitter));
};

// ----------------------------------------------------------------- alumni

/**
 * EVOLUCAO DO JUNIOR entre runs: quem cresceu (learned >= JUNIOR_GROWN_AT)
 * volta numa edicao futura como PLENO, com desconto de lealdade — mesmo
 * nome, mesma pelagem, mesmos traits (os que voce ja conhece: e o valor).
 */
export const ALUMNI_DISCOUNT = 0.8;

export const returningCandidate = (alum: Candidate, locale: Locale = 'en'): Candidate => ({
  ...alum,
  tier: 'pleno',
  cost: Math.max(6, Math.round(TIER_META.pleno.base * ALUMNI_DISCOUNT)),
  note: RETURNING_TEXT[locale].note,
  cv: RETURNING_TEXT[locale].cv,
});

// ------------------------------------------------------------- daily seed

/**
 * O DAILY: a mesma semente para todo mundo no mesmo dia (UTC) — mesmos
 * candidatos, mesmo projeto, mesmo booth. Comparar pontuacao vira conversa.
 */
export const dailySeed = (isoDate: string): number => {
  let h = 0x811c9dc5;
  for (let i = 0; i < isoDate.length; i++) {
    h ^= isoDate.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return nextU32(nextU32(h ^ 0xda17ca7));
};
