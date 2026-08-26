import {
  ABILITY_COOLDOWN,
  ABILITY_COWBOY_MISHAP,
  ABILITY_COWBOY_MISHAP_P,
  ABILITY_EFFECT,
  ABILITY_REPEAT_SCALE,
  BIGODE_CSS_SPEED,
  BUG_COST,
  BUILD_REPAIR_COST,
  CABLE_BITE_P,
  CABLE_FIX_COST,
  CALM_SCALE,
  CATNIP_MORAL,
  CATNIP_STRESS_DROP,
  CATNIP_USES,
  CATNIP_ZOOMIES_P,
  CHOICE_EFFECTS,
  COWBOY_BUG_P,
  COWBOY_SHORTCUT_P,
  COWBOY_SPEED,
  CRASH_CABLE_OUT,
  CRASH_PER_BUG,
  CRISIS_DRAIN,
  CRISIS_WINDOW,
  CUT_GRAND,
  CUT_MENTION,
  CUT_PODIUM,
  EAT_TICKS,
  ENERGY_IDLE_DRAIN,
  ENERGY_NAP_AT,
  ENERGY_NAP_RATE,
  ENERGY_NAP_TO,
  ENERGY_WORK_DRAIN,
  GEAR_COFFEE_EAT,
  GEAR_CUSHION_NAP,
  GEAR_DUCK_STRESS,
  GEAR_KEYBOARD_SPEED,
  GRABBED_FROM_NAP,
  INFLUENCER_HYPE,
  INFLUENCER_STRESS,
  LASER_STRESS_DROP,
  LASER_USES,
  LASER_ZOOMIES_TICKS,
  EMPHASIS_SCALE,
  FREESTYLER_SPEED,
  FIGHT_P,
  FIGHT_STRESS_RATE,
  IMPROVISO_BONUS,
  JUNIOR_BUG_EXTRA,
  JUNIOR_ENERGY_SCALE,
  JUNIOR_GROWN_AT,
  JUNIOR_LEARN,
  JUNIOR_LEARN_RATE,
  JUNIOR_SPEED,
  MENTOR_LEARN_SCALE,
  MORAL_DISPLACED,
  MORAL_OVERWORK_AT,
  MORAL_OVERWORK_RATE,
  MORAL_PET_RATE,
  MORAL_SHIP_OWN,
  MORAL_SHIP_TEAM,
  MORAL_SPEED_MAX,
  MORAL_SPEED_MIN,
  MORAL_TREAT,
  OVERPET_STRESS_RATE,
  PM_PEP_MORAL,
  PM_PEP_PERIOD,
  PM_PEP_RADIUS,
  PM_PEP_CLEAR,
  PM_PEP_SIDE,
  PM_PEP_STRESS,
  PM_WALK_SPEED,
  PM_WORRY_PERIOD,
  PET_DECAY_SCALE,
  PET_MEMORY_TICKS,
  PET_PROFILE,
  PITCH_GAUGE_DECAY,
  PITCH_GAUGE_START,
  PITCH_SCORE_SCALE,
  PITCH_TICKS,
  POACH_BONUS,
  POACH_SHIELD_MORAL,
  POACH_STAR_MORAL,
  POACH_STAR_STRESS,
  PRIZE_BY_OUTCOME,
  PRIZE_DEBT_MALUS,
  PRIZE_JUNIOR_GROWTH,
  PRIZE_SPECIAL,
  PRIZE_ZERO_BUGS,
  REVEAL_AT,
  RISK_BUGCOST,
  RISK_HYPE_DECAY,
  RISK_OUTAGE_AT,
  SENIOR_CLEAN,
  SENIOR_FIX,
  SENIOR_SPEED,
  SPECIALIST_MATCH,
  HACK_TICKS,
  HAIRBALL_AT,
  HAIRBALL_COST,
  HAIRBALL_JITTER_TICKS,
  HAIRBALL_WINDOW,
  HUNGER_DRAIN,
  HUNGER_EAT_AT,
  JUDGE_BUG_SCALE,
  KEYBOARD_TICKS,
  OFFSPEC_SPEED,
  QUIRK_BOX_NAP_SCALE,
  SCORE_BUG_PENALTY,
  SCORE_CORE,
  SCORE_DESIGN_DONE_BONUS,
  SCORE_DEBT_PENALTY,
  SCORE_INNOVATION,
  SCORE_LOOSE_END,
  SCORE_POLISH,
  SCORE_STABILITY_BASE,
  SCORE_STABILITY_CHOICE,
  SCORE_UX_CARE,
  SCORE_ZERO_BUG_BONUS,
  SHORTCUT_HEADSTART,
  SOCIAL_AT,
  SOCIAL_JITTER_TICKS,
  SOCIAL_WINDOW,
  EARLY_SCORE_MAX,
  FREEZE_STABILITY,
  STRETCH_COST,
  STRETCH_COST_STEP,
  STRETCH_EGG_GOOD_P,
  STRETCH_HYPE_EGG,
  STRETCH_HYPE_POLISH,
  STRETCH_HYPE_VIRAL,
  STRETCH_MULT_STEP,
  STRETCH_POLISH_STRESS,
  STRETCH_REFACTOR_BUG_P,
  STRETCH_SCALE_CABLE_P,
  STRETCH_SPONSOR_PRIZE,
  STRETCH_VIRAL_ENERGY,
  STRETCH_VIRAL_STRESS,
  SPECIAL_CROWD_AT,
  SPECIAL_INNOVATION_AT,
  SPECIAL_STABILITY_AT,
  SPECIAL_UX_AT,
  SPONSOR_AUDIT_BUGCOST,
  SPONSOR_BRANDING_GAUGE,
  SPONSOR_CROWD_TARGET,
  SPONSOR_INNOVATION_TARGET,
  SPONSOR_RISK_CRASH,
  SPONSOR_SHIP_TARGET,
  STABILITY_CRASH_RELIEF,
  TRAIT_FIX_HUNTER,
  TRAIT_FIX_LEGACY,
  TRAIT_HUNGRY,
  TRAIT_MAIN_BUG,
  TRAIT_NAP_FAST,
  TRAIT_PITCH_DOWN,
  TRAIT_PITCH_UP,
  TRAIT_SHORTCUT_P,
  TRAIT_SLEEPY_KB_P,
  TRAIT_SPEED_POLY,
  TRAIT_ZEN,
  TRAIT_ZOOMIES_AFTER,
  TRAIT_ZOOMIES_SCALE,
  WORKSHOP_AWAY_TICKS,
  WORKSHOP_BOOST,
  STRESS_AFTER_PROC,
  STRESS_DANGER,
  STRESS_IDLE_RATE,
  STRESS_PET_RATE,
  STRESS_PROC_P,
  STRESS_TREAT_DROP,
  STRESS_WORK_RATE,
  TERRITORIAL_DISPLACED,
  TREATS_START,
  VIBE_MORAL_DRIFT,
  VIBE_RADIUS,
  VIBE_STRESS_BAD,
  VIBE_STRESS_GOOD,
  WALK_SPEED,
  ZOOMIES_SPEED,
  ZOOMIES_TICKS,
} from './constants.js';
import { SLOTS, TASKS } from './data.js';
import { CLASSIC_LAYOUT, STRETCH_TRACK, rollLayout, rollProject, rollSpecialCategory, rollStretchOffers, type Candidate, type CircuitEventSpec } from './gen.js';
import { CHOICE_TEXT, STRETCH_TEXT, TASK_TEXT, type Locale } from './text.js';
import type {
  Cat,
  CatId,
  Command,
  DemoResult,
  GearId,
  HackState,
  Outcome,
  Personality,
  SimEvent,
  SlotId,
  SocialEvent,
  SocialKind,
  Spec,
  SponsorContract,
  StretchOffer,
  Task,
  Track,
} from './types.js';

/**
 * xorshift32 como FUNCAO PURA sobre estado serializado.
 *
 * Mesmo algoritmo da classe RNG do @voxelyn/core; forma diferente porque a
 * classe guarda o estado em campo privado, e um hash autoritativo precisa
 * mistura-lo e um save precisa restaura-lo (mesma razao do `Stream` da Iliada).
 */
const nextU32 = (s: number): number => {
  let x = s >>> 0 || 0x6d2b79f5;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  return x >>> 0;
};

const draw01 = (state: HackState): number => {
  state.rngState = nextU32(state.rngState);
  return state.rngState / 0x100000000;
};

/**
 * Jitter das bolas de pelo derivado da SEMENTE, nao sorteado no caminho:
 * sortear no meio da partida faria o numero de draws depender do que o jogador
 * fez, e dois replays da mesma semente divergiriam no rng.
 */
const hairballFireTick = (seed: number, index: number): number => {
  let h = (seed ^ (0x9e3779b9 + index * 0x85ebca6b)) >>> 0;
  h = nextU32(nextU32(h));
  const jitter = (h % (HAIRBALL_JITTER_TICKS * 2)) - HAIRBALL_JITTER_TICKS;
  return Math.round(HACK_TICKS * HAIRBALL_AT[index] + jitter);
};

/**
 * Agenda dos eventos SOCIAIS, derivada da semente como as bolas de pelo:
 * dois por run, tipo e instante puros — replays nao divergem.
 */
const socialScheduleFor = (seed: number): SocialEvent[] => {
  const kinds: SocialKind[] = ['influencer', 'poach', 'workshop'];
  return SOCIAL_AT.map((frac, i) => {
    let h = (seed ^ (0x51ca7e11 + i * 0x9e3779b9)) >>> 0;
    h = nextU32(nextU32(h));
    const jitter = (h % (SOCIAL_JITTER_TICKS * 2)) - SOCIAL_JITTER_TICKS;
    const kind = kinds[nextU32(h) % kinds.length]!;
    return { kind, at: Math.round(HACK_TICKS * frac + jitter), until: 0, resolved: false, taken: null };
  });
};

/** Um trait age desde o inicio — visivel ou nao. A revelacao so INFORMA. */
const hasTrait = (cat: Cat, trait: string): boolean =>
  cat.traits.includes(trait) || cat.hiddenTrait === trait;

// -------------------------------------------------------------- convivencia

/** O que o vibe precisa ler — Cat e Candidate servem. */
export type VibeSide = { personality: Personality; traits: readonly string[]; hiddenTrait: string };

const sideHas = (s: VibeSide, trait: string): boolean =>
  s.traits.includes(trait) || s.hiddenTrait === trait;

/** A quimica de personalidades (simetrica; ausente = neutro). */
const VIBE_PAIR: Partial<Record<Personality, Partial<Record<Personality, number>>>> = {
  // Dois laranjas ressoam (um neuronio, compartilhado). O cowboy shipando
  // sem testar enlouquece o perfeccionista — e o julgador VE cada ship sujo.
  cowboy: { cowboy: 1, perfeccionista: -1, 'julga-em-silencio': -1 },
  perfeccionista: { cowboy: -1, 'julga-em-silencio': 1 },
  'julga-em-silencio': { cowboy: -1, perfeccionista: 1, calmo: 1 },
  calmo: { 'julga-em-silencio': 1 },
};

/**
 * COMPATIBILIDADE de um par: -1 (atrito), 0 (neutro) ou +1 (harmonia), de
 * personalidade + traits. O trait OCULTO conta desde o inicio — o atrito na
 * mesa aparece ANTES de o curriculo explicar o porque, e essa e a
 * profundidade dele: voce ve o comportamento antes de saber o nome.
 */
export const vibeOf = (a: VibeSide, b: VibeSide): number => {
  let v = VIBE_PAIR[a.personality]?.[b.personality] ?? 0;
  if (sideHas(a, 'zen') && sideHas(b, 'zen')) v += 1;
  if (sideHas(a, 'gambiarra-elegante') && sideHas(b, 'gambiarra-elegante')) v += 1;
  // O cacador de bugs sabe EXATAMENTE quem comita direto na main.
  if (
    (sideHas(a, 'producao-em-main') && sideHas(b, 'cacador-de-bugs')) ||
    (sideHas(b, 'producao-em-main') && sideHas(a, 'cacador-de-bugs'))
  )
    v -= 1;
  // Zoomies as 3h da manha na mesa ao lado do zen: nao.
  if (
    (sideHas(a, 'zoomies-noturnos') && sideHas(b, 'zen')) ||
    (sideHas(b, 'zoomies-noturnos') && sideHas(a, 'zen'))
  )
    v -= 1;
  return Math.max(-1, Math.min(1, v));
};

const catsFromTeam = (team: readonly Candidate[]): Cat[] =>
  team.map((c, i) => ({
    id: c.id,
    name: c.name,
    specialty: c.specialty,
    personality: c.personality,
    quirk: c.quirk,
    tier: c.tier,
    traits: c.traits,
    hiddenTrait: c.hiddenTrait,
    revealed: false,
    coat: { ...c.coat },
    pattern: c.pattern,
    big: c.big,
    bio: `${c.note} ${c.cv}`,
    x: 150 + i * 46,
    y: 190,
    targetX: 150 + i * 46,
    targetY: 190,
    mode: 'idle' as const,
    modeUntil: 0,
    slot: null,
    // Escalonadas de proposito: quatro relogios iguais apagam juntos, e uma
    // "onda de soneca" com uma mao so e injusta. Escalonar vira rodizio.
    energy: 1 - i * 0.07,
    hunger: 1 - i * 0.05,
    stress: 0.12 + i * 0.03,
    moral: 0.62 + i * 0.04,
    petStreak: 0,
    petLastTick: -1,
    speedBoost: 0,
    breedMod: { ...c.breedMod },
    learned: 0,
    shipped: 0,
  }));

/**
 * Uma run nasce de (semente, EQUIPE CONTRATADA). Projeto e layout saem da
 * mesma semente; a equipe e a decisao do jogador no recrutamento — e por
 * isso entra como argumento, nao como sorteio: replay = (semente, equipe,
 * comandos). `classic: true` fixa projeto e booth originais (testes, demo).
 */
export const createHackathon = (
  seed: number,
  team: readonly Candidate[],
  opts: {
    classic?: boolean;
    locale?: Locale;
    gear?: readonly GearId[];
    /** O contrato de sponsor fechado no recrutamento (carreira). */
    sponsor?: SponsorContract | null;
    /** O evento do CIRCUITO desta run (carreira): a identidade declarada. */
    circuit?: CircuitEventSpec | null;
  } = {}
): HackState => {
  const gear = [...(opts.gear ?? [])];
  const sponsor = opts.sponsor ?? null;
  const circuit = opts.circuit ?? null;
  const locale: Locale = opts.locale ?? 'en';
  const project = opts.classic ? null : rollProject(seed >>> 0, locale);
  const layout = opts.classic ? CLASSIC_LAYOUT : rollLayout(seed >>> 0);
  // O projeto classico tambem fala o idioma da run: rotulos e decisoes vem
  // das tabelas de texto — estado se GERA no idioma, nao se traduz depois.
  const taskDefs = project
    ? project.tasks
    : TASKS.map((t) => ({
        ...t,
        label: TASK_TEXT[locale][t.id]?.[0] ?? t.label,
        choice: CHOICE_TEXT[locale][t.id] ?? undefined,
      }));
  // O prestigio do palco encarece o escopo — parte da identidade DECLARADA
  // do evento, aplicada na criacao (o custo entra no hash, como as escolhas).
  const costScale = circuit?.taskCostScale ?? 1;
  // As TRES oportunidades do Stretch Sprint, sorteadas da semente em ordem
  // crescente de risco. Os rotulos nascem no idioma da run, como tudo.
  const sprintOffers: StretchOffer[] = rollStretchOffers(seed >>> 0).map((kind, i) => ({
    kind,
    taskId: `s${i + 1}`,
    label: STRETCH_TEXT[locale][kind]!.task,
    status: 'locked',
  }));
  return {
  tick: 0,
  phase: 'hack',
  seed: seed >>> 0,
  rngState: nextU32(seed >>> 0),
  cats: catsFromTeam(team),
  tasks: taskDefs.map((t) => ({
    ...t,
    cost: Math.round(t.cost * costScale),
    progress: 0,
    done: false,
    cut: false,
    awaitingShip: false,
    chosen: null,
  })),
  bugs: [],
  hairball: {
    active: false,
    at: hairballFireTick(seed >>> 0, 0),
    deadline: 0,
    cost: HAIRBALL_COST,
    progress: 0,
    fired: 0,
  },
  cableOut: false,
  cableProgress: 0,
  treats: TREATS_START,
  buildBroken: false,
  buildProgress: 0,
  held: null,
  fight: null,
  // O PM nasce diante do quadro de planejamento — o posto natural dele.
  pm: { x: 262, y: 168, targetX: 262, targetY: 168, nextPepAt: PM_PEP_PERIOD, pepCat: null, lastWorryAt: 0 },
  handX: 240,
  handY: 135,
  debt: 0,
  innovation: 0,
  uxCare: 0,
  stability: 0,
  // O contrato 'demo-api' amarra a demo na API do sponsor DESDE o inicio —
  // o mesmo risco da escolha serverless, so que assinado antes da run.
  sponsorRisk: sponsor?.strings === 'demo-api',
  project: project
    ? { name: project.name, brief: project.brief, emphasis: project.emphasis, risk: project.risk }
    : {
        name: 'MiauDota',
        brief:
          locale === 'pt'
            ? 'plataforma de adocao de gatos com IA, acessivel, mas sustentavel'
            : 'an AI-assisted cat adoption platform, accessible yet sustainable',
        emphasis: 'tecnica',
        risk: 'hype',
      },
  layoutId: layout.id,
  layoutName: layout.name,
  // Os passivos dos apetrechos entram DIRETO nos modificadores do booth: a
  // sim nunca pergunta "tenho a almofada?" no meio do tick.
  layoutMods: {
    ...layout.mods,
    napRate: layout.mods.napRate * (gear.includes('almofada-termica') ? GEAR_CUSHION_NAP : 1),
    stressWork: layout.mods.stressWork * (gear.includes('rubber-duck') ? GEAR_DUCK_STRESS : 1),
    eatScale: layout.mods.eatScale * (gear.includes('cafeteira-pro') ? GEAR_COFFEE_EAT : 1),
  },
  slots: layout.slots.map((s) => ({ ...s })),
  pitch: null,
  gear,
  catnipLeft: gear.includes('catnip') ? CATNIP_USES : 0,
  laserLeft: gear.includes('laser-pointer') ? LASER_USES : 0,
  hype: 0,
  prizeBonus: 0,
  petSessions: 0,
  sponsor,
  specialCategory: rollSpecialCategory(seed >>> 0),
  sprint: { mvpAt: -1, frozenAt: -1, offers: sprintOffers, done: 0 },
  circuit: circuit
    ? { id: circuit.id, prizeScale: circuit.prizeScale, taskCostScale: circuit.taskCostScale }
    : null,
  vibesSeen: [],
  social: socialScheduleFor(seed >>> 0),
  events: [],
  result: null,
  };
};

export const emptyCommand = (): Command => ({});

export const catOf = (state: HackState, id: string): Cat | undefined =>
  state.cats.find((c) => c.id === id);

export const liveBug = (state: HackState, track: Track) =>
  state.bugs.find((b) => b.track === track && !b.fixed);

/** Dependencias prontas? So entao a tarefa pode ser trabalhada. */
export const workable = (state: HackState, task: Task): boolean =>
  !task.done && !task.cut && task.deps.every((d) => state.tasks.find((t) => t.id === d)?.done === true);

/** A proxima tarefa que uma mesa consegue puxar, na ordem do quadro. */
export const nextTask = (state: HackState, track: Track): Task | undefined =>
  state.tasks.find((t) => t.track === track && workable(state, t) && !t.awaitingShip);

/** O slot no BOOTH DESTA RUN — as coordenadas moram no estado (layout). */
const slotIn = (state: HackState, id: SlotId) => state.slots.find((s) => s.id === id)!;

/**
 * Postos sociais aceitam mais de um gato, mas cada corpo recebe uma vaga
 * visual/tocavel propria. A escolha da primeira vaga livre e deterministica.
 */
const VENUE_OFFSETS: Partial<Record<SlotId, readonly [number, number][]>> = {
  cafe: [[-26, 3], [26, 3], [-12, 10], [12, 10]],
  puff: [[-14, 1], [14, 1], [-23, 8], [23, 8]],
  rack: [[-18, 4], [18, 4], [-18, -9], [18, -9]],
};

/**
 * A CENA DE DECISAO acontece na frente do quadro de planejamento do centro
 * (o quadro fisico de render.ts vive em 208..274 x 108..138): vagas com a
 * mesma disciplina dos venues — nenhum corpo em cima de outro.
 */
const DECIDE_X = 240;
const DECIDE_Y = 156;
const DECIDE_SPOTS: readonly [number, number][] = [[-16, 2], [16, 2], [-4, 11], [28, 11]];

const sendTo = (state: HackState, cat: Cat, slot: SlotId): void => {
  const s = slotIn(state, slot);
  const offsets = VENUE_OFFSETS[slot] ?? [[0, 0] as [number, number]];
  const occupied = state.cats.filter((c) => c.id !== cat.id && c.slot === slot);
  const offset =
    offsets.find(([ox, oy]) =>
      occupied.every((c) => Math.hypot(c.targetX - (s.x + ox), c.targetY - (s.y + oy)) > 4)
    ) ?? offsets[offsets.length - 1]!;
  cat.slot = slot;
  cat.targetX = s.x + offset[0];
  cat.targetY = s.y + offset[1];
  cat.mode = 'walk';
};

/**
 * Todo bug nasce aqui: o risco 'dados-sensiveis' encarece cada um — e a
 * AUDITORIA do sponsor 'audit' tambem (os dois compoem: assinou, paga).
 */
const pushBug = (state: HackState, track: Track, by: CatId, cause: 'teclado' | 'sem-teste', events: SimEvent[]): void => {
  const cost = Math.round(
    BUG_COST *
      (state.project.risk === 'dados-sensiveis' ? RISK_BUGCOST : 1) *
      (state.sponsor?.strings === 'audit' ? SPONSOR_AUDIT_BUGCOST : 1)
  );
  state.bugs.push({ id: state.bugs.length, track, by, cost, progress: 0, fixed: false });
  events.push({ kind: 'bug', tick: state.tick, by, track, cause });
};

const shipTask = (state: HackState, task: Task, by: Cat, events: SimEvent[]): void => {
  task.done = true;
  task.awaitingShip = false;
  by.shipped++;
  events.push({ kind: 'ship', tick: state.tick, task: task.label, track: task.track, by: by.id });

  // Shippar levanta a MORAL: mais a de quem shipou, um pouco a de todos.
  // Sucesso e contagioso num booth de quatro gatos.
  for (const c of state.cats) {
    // O toque social da raca entra na parte de EQUIPE: um Maine Coon no
    // booth faz o sucesso dos outros valer mais para ele (e vice-versa).
    const gain =
      c.id === by.id ? MORAL_SHIP_OWN : MORAL_SHIP_TEAM * state.layoutMods.moralShip * c.breedMod.social;
    c.moral = Math.min(1, c.moral + gain);
  }

  // A SUJEIRA do ship compoe: cowboy shipa sem testar, junior ainda aprende,
  // producao-em-main e o que o nome diz — e o senior limpa metade de tudo.
  let bugP = 0;
  if (by.personality === 'cowboy') bugP += COWBOY_BUG_P;
  if (by.tier === 'junior') bugP += JUNIOR_BUG_EXTRA;
  if (hasTrait(by, 'producao-em-main')) bugP += TRAIT_MAIN_BUG;
  if (by.tier === 'senior') bugP *= SENIOR_CLEAN;
  if (bugP > 0 && draw01(state) < bugP) pushBug(state, task.track, by.id, 'sem-teste', events);

  // O atalho genial: dom do cowboy, oficio da gambiarra-elegante.
  let shortcutP = 0;
  if (by.personality === 'cowboy') shortcutP += COWBOY_SHORTCUT_P;
  if (hasTrait(by, 'gambiarra-elegante')) shortcutP += TRAIT_SHORTCUT_P;
  if (shortcutP > 0 && draw01(state) < shortcutP) {
    const next = state.tasks.find((t) => t.track === task.track && !t.done && !t.cut);
    if (next) {
      next.progress = Math.min(next.cost, next.progress + next.cost * SHORTCUT_HEADSTART);
      events.push({ kind: 'shortcut', tick: state.tick, task: next.label, by: by.id });
    }
  }

  // Shipou uma oportunidade de STRETCH: o beneficio paga, o risco rola, o
  // multiplicador sobe — e a proxima porta (mais arriscada) se abre.
  const offer = state.sprint.offers.find((o) => o.taskId === task.id && o.status === 'taken');
  if (offer) {
    offer.status = 'done';
    state.sprint.done++;
    if (offer.kind === 'polimento-obsessivo') {
      state.uxCare += 1;
      state.hype += STRETCH_HYPE_POLISH;
    } else if (offer.kind === 'demo-viral') {
      state.hype += STRETCH_HYPE_VIRAL;
    } else if (offer.kind === 'feature-patrocinada') {
      state.prizeBonus += STRETCH_SPONSOR_PRIZE;
    } else if (offer.kind === 'refactor-heroico') {
      state.stability += 1;
      state.debt = Math.max(0, state.debt - 1);
      // "Pode reabrir dependencias": o legado morde de volta.
      if (draw01(state) < STRETCH_REFACTOR_BUG_P) pushBug(state, 'backend', by.id, 'sem-teste', events);
    } else if (offer.kind === 'escala-absurda') {
      state.innovation += 1;
      // Um milhao de gatos simultaneos: o build PODE nao aguentar.
      if (draw01(state) < STRETCH_SCALE_CABLE_P && !state.cableOut && !state.buildBroken) {
        state.cableOut = true;
        state.cableProgress = 0;
        events.push({ kind: 'cable', tick: state.tick, by: by.id });
      }
    } else if (offer.kind === 'easter-egg-felino') {
      // Imprevisivel por definicao: ou a plateia ama, ou nasceu um bug.
      if (draw01(state) < STRETCH_EGG_GOOD_P) {
        state.hype += STRETCH_HYPE_EGG;
        state.innovation += 1;
      } else {
        pushBug(state, 'frontend', by.id, 'sem-teste', events);
      }
    }
    events.push({ kind: 'stretch-done', tick: state.tick, offer: offer.kind });
    const next = state.sprint.offers.find((o) => o.status === 'locked');
    if (next) {
      next.status = 'open';
      events.push({ kind: 'stretch-open', tick: state.tick, offer: next.kind });
    }
  }
};

const applyCommand = (state: HackState, cmd: Command, events: SimEvent[]): void => {
  if (cmd.handX !== undefined) state.handX = cmd.handX;
  if (cmd.handY !== undefined) state.handY = cmd.handY;

  if (cmd.grab && !state.held) {
    const cat = catOf(state, cmd.grab);
    if (cat && cat.mode !== 'held') {
      // Pegar qualquer participante separa a briga imediatamente.
      if (state.fight && (state.fight.a === cat.id || state.fight.b === cat.id)) {
        const fight = state.fight;
        const other = catOf(state, fight.a === cat.id ? fight.b : fight.a);
        if (other) {
          other.mode = 'walk';
          other.slot = null;
          other.targetX = Math.max(30, Math.min(450, other.x + (other.x >= cat.x ? 28 : -28)));
          other.targetY = other.y;
        }
        state.fight = null;
        events.push({ kind: 'fight-separated', tick: state.tick, a: fight.a, b: fight.b });
      }
      // Pegar um gato dormindo PODE: acorda rabugento. Uma troca, nao proibicao.
      if (cat.mode === 'nap') cat.stress = Math.min(1, cat.stress + GRABBED_FROM_NAP);
      cat.mode = 'held';
      cat.slot = null;
      state.held = cat.id;
    }
  }

  if (cmd.drop && state.held) {
    const cat = catOf(state, state.held)!;
    const occupant = state.cats.find((c) => c.slot === cmd.drop && c.id !== cat.id);
    // Postos sociais (VENUE_OFFSETS) tem vagas para varios corpos: chegar
    // nao desaloja ninguem. Mesa e territorio de um gato so.
    if (occupant && !(cmd.drop in VENUE_OFFSETS)) {
      occupant.slot = null;
      // 'walk' e o unico modo que anda ate o alvo; em 'idle' o desalojado
      // ficava parado embaixo do recem-chegado, disputando o toque.
      occupant.mode = 'walk';
      occupant.targetX = Math.min(450, occupant.x + 20);
      occupant.targetY = occupant.y;
      // O territorial nao esquece de quem era a mesa.
      if (occupant.quirk === 'territorial') occupant.stress = Math.min(1, occupant.stress + TERRITORIAL_DISPLACED);
      // Ser despejado desanima qualquer um.
      occupant.moral = Math.max(0, occupant.moral - MORAL_DISPLACED);
    }
    sendTo(state, cat, cmd.drop);
    state.held = null;
  }

  if (cmd.release && state.held) {
    const cat = catOf(state, state.held)!;
    cat.mode = 'idle';
    cat.slot = null;
    cat.targetX = cat.x;
    cat.targetY = cat.y;
    state.held = null;
  }

  if (cmd.treat && state.treats > 0) {
    const cat = catOf(state, cmd.treat);
    if (cat) {
      cat.energy = 1;
      cat.hunger = 1;
      cat.stress = Math.max(0, cat.stress - STRESS_TREAT_DROP);
      cat.moral = Math.min(1, cat.moral + MORAL_TREAT);
      if (cat.mode === 'nap' || cat.mode === 'eat') cat.mode = 'idle';
      state.treats--;
      events.push({ kind: 'treat', tick: state.tick, cat: cat.id });
    }
  }

  if (cmd.cut) {
    const task = state.tasks.find((t) => t.id === cmd.cut);
    // Cortar so o que ainda nao shipou. Cortar o que o perfeccionista segura
    // tambem vale — e exatamente a briga de escopo que o jogo quer encenar.
    if (task && !task.done && !task.cut) {
      task.cut = true;
      task.awaitingShip = false;
      events.push({ kind: 'cut', tick: state.tick, task: task.label });
    }
  }

  if (cmd.catnip && state.catnipLeft > 0) {
    const cat = catOf(state, cmd.catnip);
    if (cat && cat.mode !== 'held') {
      state.catnipLeft--;
      cat.moral = Math.min(1, cat.moral + CATNIP_MORAL);
      cat.stress = Math.max(0, cat.stress - CATNIP_STRESS_DROP);
      // O risco do catnip: as vezes a moral vem com ZOOMIES juntos.
      const zoom = draw01(state) < CATNIP_ZOOMIES_P;
      if (zoom && cat.mode !== 'nap') {
        cat.mode = 'zoomies';
        cat.modeUntil = state.tick + LASER_ZOOMIES_TICKS * 2;
        cat.targetX = 30 + draw01(state) * 420;
        cat.targetY = 60 + draw01(state) * 180;
      }
      events.push({ kind: 'catnip', tick: state.tick, cat: cat.id, zoomies: zoom });
    }
  }

  if (cmd.laser && state.laserLeft > 0) {
    state.laserLeft--;
    // O laser acalma a equipe INTEIRA — e interrompe a equipe inteira,
    // porque e um laser e eles sao gatos. Trade-off no proprio objeto.
    for (const cat of state.cats) {
      cat.stress = Math.max(0, cat.stress - LASER_STRESS_DROP);
      if (cat.mode === 'work' || cat.mode === 'idle' || cat.mode === 'walk' || cat.mode === 'keyboard') {
        cat.mode = 'zoomies';
        cat.modeUntil = state.tick + LASER_ZOOMIES_TICKS;
        cat.targetX = 30 + draw01(state) * 420;
        cat.targetY = 60 + draw01(state) * 180;
      }
    }
    events.push({ kind: 'laser', tick: state.tick });
  }

  if (cmd.social) {
    const open = state.social.find((s) => !s.resolved && s.until > 0 && state.tick < s.until);
    if (open) resolveSocial(state, open, cmd.social, events);
  }

  if (cmd.choose) {
    const task = state.tasks.find((t) => t.id === cmd.choose!.task);
    if (task?.choice && task.chosen === null && !task.done && !task.cut) {
      const opt = task.choice.options.find((o) => o.id === cmd.choose!.option);
      if (opt) {
        task.chosen = opt.id;
        applyChoice(state, task, opt.id);
        events.push({ kind: 'decision', tick: state.tick, task: task.label, option: opt.label });
      }
    }
  }

  // ACEITAR a oportunidade de Stretch Sprint aberta: a tarefa entra no
  // quadro (sem dependencias — o nucleo ja fechou) e o risco de ACEITE
  // cobra na hora. O beneficio so paga quem shipa.
  if (cmd.stretch && state.sprint.mvpAt >= 0) {
    const offer = state.sprint.offers.find((o) => o.status === 'open');
    if (offer) {
      offer.status = 'taken';
      const index = state.sprint.offers.indexOf(offer);
      state.tasks.push({
        id: offer.taskId,
        track: STRETCH_TRACK[offer.kind],
        label: offer.label,
        polish: true,
        // O palco encarece o escopo ATE no fim de run: a tarefa de stretch
        // nasce com a mesma escala declarada das outras (achado de review —
        // o Global cobrava stretch a preco de Bairro).
        cost: Math.round(
          STRETCH_COST * (1 + STRETCH_COST_STEP * index) * (state.circuit?.taskCostScale ?? 1)
        ),
        deps: [],
        chosen: null,
        progress: 0,
        done: false,
        cut: false,
        awaitingShip: false,
      });
      if (offer.kind === 'polimento-obsessivo') {
        // Polir o polido estressa quem vive disso: design e frontend pagam.
        for (const c of state.cats) {
          if (c.specialty === 'design' || c.specialty === 'frontend') {
            c.stress = Math.min(1, c.stress + STRETCH_POLISH_STRESS);
          }
        }
      } else if (offer.kind === 'demo-viral') {
        // A demo viral exige gatos DESCANSADOS: os cansados pagam em estresse.
        for (const c of state.cats) {
          if (c.energy < STRETCH_VIRAL_ENERGY) c.stress = Math.min(1, c.stress + STRETCH_VIRAL_STRESS);
        }
      } else if (offer.kind === 'feature-patrocinada') {
        // O SDK deles entra no caminho da demo: o contrato pode ser
        // descumprido — a mesma amarra do 'demo-api', aceita no fim da run.
        state.sponsorRisk = true;
      }
      events.push({ kind: 'stretch-taken', tick: state.tick, offer: offer.kind });
    }
  }

  // CONGELAR a submissao: so com o MVP pronto. As oportunidades aceitas e
  // NAO comecadas saem do quadro sem custo (parar e decisao respeitada);
  // as comecadas viram ponta solta — o preco de ter apostado. Estabilidade
  // e os pontos de entrega antecipada pagam quem para cedo.
  if (cmd.freeze && state.sprint.mvpAt >= 0 && state.phase === 'hack' && state.sprint.frozenAt < 0) {
    state.sprint.frozenAt = state.tick;
    state.stability += FREEZE_STABILITY;
    for (const offer of state.sprint.offers) {
      if (offer.status !== 'taken') continue;
      const task = state.tasks.find((t) => t.id === offer.taskId);
      if (task && !task.done && !task.cut && task.progress === 0 && !task.awaitingShip) {
        task.cut = true;
        events.push({ kind: 'cut', tick: state.tick, task: task.label });
      }
    }
    events.push({ kind: 'freeze', tick: state.tick });
    startPitch(state, events);
  }
};

/**
 * O EFEITO de cada decisao — custo agora, custo depois, e tags que a banca
 * cobra. Nada aqui e "+10%": cada opcao muda o formato da run. O switch
 * virou TABELA (CHOICE_EFFECTS) quando as variacoes multiplicaram o
 * vocabulario: uma linha por opcao, e o teste vigia que nenhum card
 * ofereca opcao sem efeito.
 */
const applyChoice = (state: HackState, task: Task, option: string): void => {
  const fx = CHOICE_EFFECTS[option];
  if (!fx) return;
  const scale = (id: string, k: number): void => {
    const t = state.tasks.find((x) => x.id === id);
    if (t && !t.done) t.cost = Math.round(t.cost * k);
  };
  if (fx.self !== undefined) scale(task.id, fx.self);
  for (const [id, k] of fx.downstream ?? []) scale(id, k);
  state.debt += fx.debt ?? 0;
  state.innovation += fx.innovation ?? 0;
  state.uxCare += fx.uxCare ?? 0;
  state.stability += fx.stability ?? 0;
  if (fx.sponsorRisk) state.sponsorRisk = true;
};

/**
 * O EFEITO de cada evento social. A opcao B e sempre a segura (e o default
 * quando a janela expira); a A paga mais e cobra algo — prestar atencao ao
 * pavilhao e uma habilidade.
 */
const resolveSocial = (state: HackState, ev: SocialEvent, option: 'a' | 'b', events: SimEvent[]): void => {
  ev.resolved = true;
  ev.taken = option;
  ev.until = 0;
  let poachedStar: CatId | undefined;
  if (ev.kind === 'influencer') {
    if (option === 'a') {
      // Posar com os gatos: hype para o palco, estresse para todos.
      state.hype += INFLUENCER_HYPE;
      for (const c of state.cats) c.stress = Math.min(1, c.stress + INFLUENCER_STRESS);
    }
  } else if (ev.kind === 'poach') {
    if (option === 'a') {
      // Ouvir a proposta do recrutador rival: dinheiro no fim, e a estrela
      // do time fica com a cabeca virada.
      state.prizeBonus += POACH_BONUS;
      const star = [...state.cats].sort((x, y) => y.moral - x.moral)[0];
      if (star) {
        star.stress = Math.min(1, star.stress + POACH_STAR_STRESS);
        star.moral = Math.max(0, star.moral - POACH_STAR_MORAL);
        // O evento registra QUEM foi abordado: a carreira lembra — e o
        // rival tambem (consequencia entre hackathons).
        poachedStar = star.id;
      }
    } else {
      // Blindar a equipe: todo mundo se sente escolhido.
      for (const c of state.cats) c.moral = Math.min(1, c.moral + POACH_SHIELD_MORAL);
    }
  } else if (ev.kind === 'workshop') {
    if (option === 'a') {
      // Mandar o mais descansado ao workshop: volta melhor — mas passa um
      // tempo fora da mesa (zoomies de ida e volta).
      const rested = [...state.cats].sort((x, y) => y.energy - x.energy)[0];
      if (rested) {
        rested.speedBoost += WORKSHOP_BOOST;
        if (rested.mode !== 'nap' && rested.mode !== 'held') {
          rested.mode = 'zoomies';
          rested.modeUntil = state.tick + WORKSHOP_AWAY_TICKS;
          rested.targetX = 30 + draw01(state) * 420;
          rested.targetY = 60 + draw01(state) * 180;
        }
      }
    }
  }
  events.push({ kind: 'social-taken', tick: state.tick, social: ev.kind, option, star: poachedStar });
};

const stepHairball = (state: HackState, events: SimEvent[]): void => {
  const hb = state.hairball;
  if (!hb.active) {
    if (hb.fired < HAIRBALL_AT.length && state.tick >= hb.at) {
      hb.active = true;
      hb.progress = 0;
      hb.deadline = state.tick + HAIRBALL_WINDOW;
      events.push({ kind: 'hairball', tick: state.tick });
    }
    return;
  }
  if (hb.progress >= hb.cost) {
    hb.active = false;
    hb.fired++;
    hb.at = hb.fired < HAIRBALL_AT.length ? hairballFireTick(state.seed, hb.fired) : HACK_TICKS * 10;
    events.push({ kind: 'hairball-fixed', tick: state.tick });
    return;
  }
  if (state.tick >= hb.deadline && !state.buildBroken) {
    // A falha e grave e para todas as trilhas, mas pode ser recuperada no
    // rack: uma crise deve cobrar replanejamento, nao encerrar a interacao.
    state.buildBroken = true;
    state.buildProgress = 0;
    hb.active = false;
    hb.fired++;
    hb.at = hb.fired < HAIRBALL_AT.length ? hairballFireTick(state.seed, hb.fired) : HACK_TICKS * 10;
    events.push({ kind: 'build-broken', tick: state.tick });
  }
};

/** A velocidade de um gato numa trilha: especializacao, tier, traits e moral. */
const speedOf = (state: HackState, cat: Cat, track: Track): number => {
  let s: number;
  if (cat.specialty === 'freestyler') s = FREESTYLER_SPEED;
  else if (cat.specialty === track) s = cat.tier === 'especialista' ? SPECIALIST_MATCH : 1;
  else s = OFFSPEC_SPEED;
  // O trait anti-CSS (o protesto classico do Bigode) vale para qualquer um.
  if (hasTrait(cat, 'recusa-css') && track === 'frontend') s = BIGODE_CSS_SPEED;
  if (cat.personality === 'cowboy') s *= COWBOY_SPEED;
  if (cat.tier === 'junior') {
    // O junior APRENDE — desde o Slice D, aprendendo FAZENDO (learned sobe
    // trabalhando, mais rapido com mentor ao lado), nao por relogio.
    s *= JUNIOR_SPEED + JUNIOR_LEARN * cat.learned;
  } else if (cat.tier === 'senior') s *= SENIOR_SPEED;
  if (hasTrait(cat, 'polidactila')) s *= TRAIT_SPEED_POLY;
  if (state.gear.includes('teclado-mecanico')) s *= GEAR_KEYBOARD_SPEED;
  s *= 1 + cat.speedBoost;
  // Gato desanimado rende menos; radiante, mais. A moral NAO e enfeite.
  s *= MORAL_SPEED_MIN + cat.moral * (MORAL_SPEED_MAX - MORAL_SPEED_MIN);
  return s;
};

/**
 * A DECISAO aberta que trava a trilha DESTE gato — nula quando bug ou
 * feature pronta passam na frente (a mesma ordem de prioridade do workAt).
 * Compartilhada entre o workAt (montar a cena) e o passo de caminhada
 * (desmontar a cena NA HORA em que alguem decide, sem terminar a viagem
 * ate um quadro obsoleto).
 */
const openDecisionFor = (state: HackState, cat: Cat): Task | null => {
  if (!cat.slot?.startsWith('desk-')) return null;
  const track = slotIn(state, cat.slot).track;
  if (!track) return null;
  if (liveBug(state, track)) return null;
  const awaiting = state.tasks.find((t) => t.track === track && t.awaitingShip && !t.cut);
  if (awaiting && cat.personality !== 'perfeccionista') return null;
  const pending = nextTask(state, track);
  return pending?.choice && pending.chosen === null ? pending : null;
};

const workAt = (state: HackState, cat: Cat, events: SimEvent[]): void => {
  if (cat.slot === 'rack') {
    // O rack atende emergencias na ordem de prazo: bola de pelo, build perdido,
    // cabo mordido. O layout Server Corner conserta mais rapido.
    const fix = state.layoutMods.fixSpeed;
    if (state.hairball.active) state.hairball.progress += fix;
    else if (state.buildBroken) {
      state.buildProgress += fix;
      if (state.buildProgress >= BUILD_REPAIR_COST) {
        state.buildBroken = false;
        state.buildProgress = 0;
        events.push({ kind: 'build-fixed', tick: state.tick });
      }
    } else if (state.cableOut) {
      state.cableProgress += fix;
      if (state.cableProgress >= CABLE_FIX_COST) {
        state.cableOut = false;
        state.cableProgress = 0;
        events.push({ kind: 'cable-fixed', tick: state.tick });
      }
    }
    return;
  }
  if (cat.slot === 'puff' || cat.slot === 'cafe') return;

  const track = slotIn(state, cat.slot!).track!;
  // Repositorio travado ou build fora do ar: ninguem testa, ninguem mergeia.
  if (state.hairball.active || state.buildBroken || state.cableOut) return;

  const speed = speedOf(state, cat, track);

  const bug = liveBug(state, track);
  const awaitingTask = state.tasks.find((t) => t.track === track && t.awaitingShip && !t.cut);
  const canShipAwaiting = !!awaitingTask && cat.personality !== 'perfeccionista';
  const pending = nextTask(state, track);
  const decisionTask = openDecisionFor(state, cat);

  // Tarefa com DECISAO aberta nao anda — e isso vira CENA: os devs da trilha
  // largam o teclado e se juntam na frente do quadro de planejamento, cada
  // um numa vaga propria (a licao dos venues), ate alguem decidir por eles.
  if (decisionTask) {
    const spot = DECIDE_SPOTS[state.cats.indexOf(cat) % DECIDE_SPOTS.length]!;
    const gx = DECIDE_X + spot[0];
    const gy = DECIDE_Y + spot[1];
    if (Math.hypot(cat.x - gx, cat.y - gy) > 2) {
      cat.targetX = gx;
      cat.targetY = gy;
      cat.mode = 'walk';
    }
    if (state.tick % 300 === 0) events.push({ kind: 'decision-needed', tick: state.tick, task: decisionTask.label });
    return;
  }
  // Fora da cena de decisao, o posto de trabalho e a MESA: quem estava no
  // quadro caminha de volta ao teclado antes de produzir qualquer coisa.
  const seat = slotIn(state, cat.slot!);
  if (Math.hypot(cat.x - seat.x, cat.y - seat.y) > 2) {
    sendTo(state, cat, cat.slot!);
    return;
  }

  if (bug) {
    // Consertar bug tem oficio proprio: cacador acha, senior poda, e quem
    // detesta legado enrola.
    let fixRate = speed;
    if (hasTrait(cat, 'cacador-de-bugs')) fixRate *= TRAIT_FIX_HUNTER;
    if (cat.tier === 'senior') fixRate *= SENIOR_FIX;
    if (hasTrait(cat, 'detesta-legado')) fixRate *= TRAIT_FIX_LEGACY;
    bug.progress += fixRate;
    if (bug.progress >= bug.cost) {
      bug.fixed = true;
      events.push({ kind: 'bugfix', tick: state.tick, track });
    }
    return;
  }

  // O perfeccionista segurando uma feature pronta: qualquer OUTRO gato na mesa
  // simplesmente mergeia ("clicou no botao que o Bigode nao clica").
  if (canShipAwaiting) {
    shipTask(state, awaitingTask!, cat, events);
    return;
  }

  const task = pending;
  if (!task) return;
  task.progress += speed;
  if (task.progress >= task.cost) {
    task.progress = task.cost;
    if (cat.personality === 'perfeccionista') {
      // Pronto, impecavel, e ELE NAO DEIXA MERGEAR. Um carinho e o "shipa".
      if (!task.awaitingShip) {
        task.awaitingShip = true;
        events.push({ kind: 'await-ship', tick: state.tick, task: task.label, by: cat.id });
      }
    } else {
      shipTask(state, task, cat, events);
    }
  }
};

const stepCat = (state: HackState, cat: Cat, cmd: Command, events: SimEvent[]): void => {
  if (cat.mode === 'held') {
    cat.x = state.handX;
    cat.y = state.handY;
    return;
  }

  if (cat.mode === 'fight') {
    cat.stress = Math.min(1, cat.stress + FIGHT_STRESS_RATE);
    cat.energy = Math.max(0, cat.energy - ENERGY_WORK_DRAIN);
    return;
  }

  const petted = cmd.pet === cat.id && !state.held;
  if (petted && cat.mode !== 'nap' && cat.mode !== 'zoomies') {
    // O carinho tambem e o "SHIPA" do perfeccionista: a feature que ele
    // segurava mergeia na hora, com a bencao. Comunicacao, nao cuidado —
    // funciona em qualquer streak.
    if (cat.personality === 'perfeccionista') {
      const awaiting = state.tasks.find((t) => t.awaitingShip && !t.cut);
      if (awaiting) shipTask(state, awaiting, cat, events);
    }
    if (cat.mode !== 'petted') {
      // COMECO de sessao: a memoria decide quanto este carinho vale.
      state.petSessions++;
      if (cat.petLastTick >= 0 && state.tick - cat.petLastTick > PET_MEMORY_TICKS) cat.petStreak = 0;
      if (cat.petStreak >= 2) events.push({ kind: 'overpet', tick: state.tick, cat: cat.id });
    }
    cat.mode = 'petted';
    const profile = PET_PROFILE[cat.personality] ?? { stress: 1, moral: 1 };
    if (cat.petStreak >= 2) {
      // SUPERESTIMULADO: a terceira sessao seguida irrita. E gato.
      cat.stress = Math.min(1, cat.stress + OVERPET_STRESS_RATE);
    } else {
      const decay = cat.petStreak === 0 ? 1 : PET_DECAY_SCALE;
      cat.stress = Math.max(0, cat.stress - STRESS_PET_RATE * decay * profile.stress);
      cat.moral = Math.min(1, cat.moral + MORAL_PET_RATE * decay * profile.moral);
    }
    // Carinho NAO recupera energia: comida e sono existem por um motivo.
    return;
  }
  if (cat.mode === 'petted') {
    // FIM de sessao: a memoria registra.
    cat.petStreak++;
    cat.petLastTick = state.tick;
    cat.mode = cat.slot ? 'walk' : 'idle';
  }

  if (cat.mode === 'zoomies') {
    if (state.tick >= cat.modeUntil) {
      if (cat.slot) sendTo(state, cat, cat.slot);
      else cat.mode = 'idle';
    } else {
      const dx = cat.targetX - cat.x;
      const dy = cat.targetY - cat.y;
      if (Math.hypot(dx, dy) < 6) {
        cat.targetX = 30 + draw01(state) * 420;
        cat.targetY = 60 + draw01(state) * 180;
      }
      const len = Math.max(1e-6, Math.hypot(dx, dy));
      cat.x += (dx / len) * ZOOMIES_SPEED;
      cat.y += (dy / len) * ZOOMIES_SPEED;
    }
    return;
  }
  if (cat.mode === 'keyboard') {
    if (state.tick >= cat.modeUntil) cat.mode = cat.slot ? 'work' : 'idle';
    return;
  }
  if (cat.mode === 'nap') {
    let rate = cat.quirk === 'caixa' ? ENERGY_NAP_RATE * QUIRK_BOX_NAP_SCALE : ENERGY_NAP_RATE;
    if (hasTrait(cat, 'dorme-rapido')) rate *= TRAIT_NAP_FAST;
    rate *= state.layoutMods.napRate * cat.breedMod.nap;
    cat.energy = Math.min(ENERGY_NAP_TO, cat.energy + rate);
    cat.stress = Math.max(0, cat.stress - STRESS_IDLE_RATE * 2);
    if (cat.energy >= ENERGY_NAP_TO) {
      cat.mode = 'idle';
      // Acordou DESEMPREGADO: o puff nao e posto de trabalho, e notar quem
      // acordou e carrega-lo de volta e o laco de atencao do jogo.
      cat.slot = null;
    }
    return;
  }
  if (cat.mode === 'eat') {
    if (state.tick >= cat.modeUntil) {
      cat.hunger = 1;
      cat.stress = Math.max(0, cat.stress - 0.08);
      cat.mode = 'idle';
      cat.slot = null;
    }
    return;
  }

  if (cat.mode === 'walk') {
    // Decisao resolvida NO MEIO do caminho ao quadro: o dev vira para a
    // mesa na hora, em vez de completar a viagem ate um destino obsoleto
    // (achado de revisao — a reacao rapida do jogador merece resposta).
    if (cat.slot?.startsWith('desk-') && !openDecisionFor(state, cat)) {
      const seat = slotIn(state, cat.slot);
      if (Math.hypot(cat.targetX - seat.x, cat.targetY - seat.y) > 2) sendTo(state, cat, cat.slot);
    }
    const dx = cat.targetX - cat.x;
    const dy = cat.targetY - cat.y;
    const len = Math.hypot(dx, dy);
    if (len < 2) {
      cat.x = cat.targetX;
      cat.y = cat.targetY;
      if (cat.slot === 'puff') {
        cat.mode = 'nap';
        events.push({ kind: 'nap', tick: state.tick, cat: cat.id });
      } else if (cat.slot === 'cafe') {
        cat.mode = 'eat';
        cat.modeUntil = state.tick + Math.round(EAT_TICKS * state.layoutMods.eatScale);
        events.push({ kind: 'eat', tick: state.tick, cat: cat.id });
      } else {
        cat.mode = cat.slot ? 'work' : 'idle';
      }
    } else {
      cat.x += (dx / len) * WALK_SPEED;
      cat.y += (dy / len) * WALK_SPEED;
    }
  }

  // Medidores.
  const working = cat.mode === 'work';
  const energyDrain = (working ? ENERGY_WORK_DRAIN : ENERGY_IDLE_DRAIN) * (cat.tier === 'junior' ? JUNIOR_ENERGY_SCALE : 1);
  cat.energy = Math.max(0, cat.energy - energyDrain);
  cat.hunger = Math.max(0, cat.hunger - HUNGER_DRAIN * (hasTrait(cat, 'guloso') ? TRAIT_HUNGRY : 1) * cat.breedMod.hunger);
  // Trabalhar exausto corroi a moral: virar a noite tem preco alem do sono.
  if (working && cat.energy < MORAL_OVERWORK_AT) {
    cat.moral = Math.max(0, cat.moral - MORAL_OVERWORK_RATE);
  }

  let stressRate = working
    ? STRESS_WORK_RATE * state.layoutMods.stressWork
    : STRESS_IDLE_RATE * state.layoutMods.stressIdle;
  if (cat.personality === 'calmo') stressRate *= CALM_SCALE;
  if (hasTrait(cat, 'zen')) stressRate *= TRAIT_ZEN;
  stressRate *= cat.breedMod.stress;

  // CONVIVENCIA: quem trabalha numa mesa VIZINHA me afeta. O raio faz o
  // layout importar (a Ilha Central conversa; os cubiculos isolam) — e o
  // trait oculto conta desde ja: o atrito aparece antes do curriculo
  // explicar. O feed anuncia cada dupla UMA vez, na descoberta.
  let vibeSum = 0;
  let mentorNear = false;
  if (working) {
    for (const other of state.cats) {
      if (other.id === cat.id || other.mode !== 'work') continue;
      if (Math.hypot(other.x - cat.x, other.y - cat.y) > VIBE_RADIUS) continue;
      const v = vibeOf(cat, other);
      vibeSum += v;
      if (other.tier === 'senior' || other.tier === 'especialista') mentorNear = true;
      if (
        v < 0 &&
        !state.fight &&
        cat.id < other.id &&
        cat.stress > 0.55 &&
        other.stress > 0.55 &&
        draw01(state) < FIGHT_P
      ) {
        const mx = (cat.x + other.x) / 2;
        const my = (cat.y + other.y) / 2;
        cat.mode = 'fight';
        other.mode = 'fight';
        cat.slot = null;
        other.slot = null;
        cat.x = mx - 7;
        other.x = mx + 7;
        cat.y = other.y = my;
        state.fight = { a: cat.id, b: other.id };
        events.push({ kind: 'fight', tick: state.tick, a: cat.id, b: other.id });
      }
      if (v !== 0 && cat.id < other.id) {
        const key = `${cat.id}|${other.id}`;
        if (!state.vibesSeen.includes(key)) {
          state.vibesSeen.push(key);
          events.push({ kind: v > 0 ? 'harmony' : 'friction', tick: state.tick, a: cat.id, b: other.id });
        }
      }
      if (cat.tier === 'junior' && (other.tier === 'senior' || other.tier === 'especialista')) {
        const mkey = `m:${other.id}|${cat.id}`;
        if (!state.vibesSeen.includes(mkey)) {
          state.vibesSeen.push(mkey);
          events.push({ kind: 'mentor', tick: state.tick, mentor: other.id, junior: cat.id });
        }
      }
    }
    if (vibeSum > 0) stressRate *= VIBE_STRESS_GOOD;
    else if (vibeSum < 0) stressRate *= VIBE_STRESS_BAD;
    if (vibeSum !== 0) {
      cat.moral = Math.max(0, Math.min(1, cat.moral + VIBE_MORAL_DRIFT * Math.sign(vibeSum)));
    }
  }

  // Uma briga interrompe toda produtividade ate a mao separar a dupla.
  if (cat.mode === 'fight') return;

  // A EVOLUCAO do junior: aprende TRABALHANDO, 1.6x com mentor na vizinha.
  if (working && cat.tier === 'junior' && cat.learned < 1) {
    const before = cat.learned;
    cat.learned = Math.min(1, cat.learned + JUNIOR_LEARN_RATE * (mentorNear ? MENTOR_LEARN_SCALE : 1));
    if (before < JUNIOR_GROWN_AT && cat.learned >= JUNIOR_GROWN_AT) {
      events.push({ kind: 'grown', tick: state.tick, cat: cat.id });
    }
  }
  // O tuxedo sofre com bug vivo em QUALQUER trilha. Ele sabe. Ele sempre sabe.
  if (cat.personality === 'julga-em-silencio' && state.bugs.some((b) => !b.fixed)) {
    stressRate *= JUDGE_BUG_SCALE;
  }
  cat.stress = Math.min(1, cat.stress + stressRate);

  // Necessidades tomam o corpo: fome primeiro, depois sono. EXCECAO: quem
  // esta consertando uma emergencia no rack termina o conserto — largar no
  // meio deixava o build quebrado sem ninguem voltar (comer zera o slot), e
  // o preco de virar a noite ja e cobrado em moral e energia.
  const onRackDuty = working && cat.slot === 'rack' && (state.hairball.active || state.buildBroken || state.cableOut);
  if (cat.hunger <= HUNGER_EAT_AT && (working || cat.mode === 'idle') && !onRackDuty) {
    sendTo(state, cat, 'cafe');
    return;
  }
  if (cat.energy <= ENERGY_NAP_AT && (working || cat.mode === 'idle') && !onRackDuty) {
    // Quem DORME NO TECLADO pode apagar em cima da propria trilha: bug.
    if (working && hasTrait(cat, 'dorme-no-teclado') && cat.slot && slotIn(state, cat.slot).track) {
      if (draw01(state) < TRAIT_SLEEPY_KB_P) {
        pushBug(state, slotIn(state, cat.slot).track!, cat.id, 'teclado', events);
      }
    }
    // Quem tem a mania cochila NO RACK. Os outros vao ao puff — o gato de
    // caixa dorme na caixa ao lado, mesma coordenada e o dobro do charme.
    sendTo(state, cat, cat.quirk === 'dorme-no-rack' ? 'rack' : 'puff');
    if (cat.quirk === 'dorme-no-rack') {
      // No rack ele dorme de verdade (nao trabalha): modo nap ao chegar.
      cat.slot = 'puff';
      const rack = slotIn(state, 'rack');
      cat.targetX = rack.x - 10;
      cat.targetY = rack.y - 6;
    }
    return;
  }

  // O DADO DO DESASTRE. Na mesa: senta no teclado (bug na trilha). Fora dela:
  // o Cheeto pode MORDER O CABO (build fora do ar); os demais, zoomies.
  const procP =
    STRESS_PROC_P *
    (hasTrait(cat, 'zoomies-noturnos') && state.tick > HACK_TICKS * TRAIT_ZOOMIES_AFTER ? TRAIT_ZOOMIES_SCALE : 1);
  if (cat.stress >= STRESS_DANGER && draw01(state) < procP) {
    cat.stress = STRESS_AFTER_PROC;
    const atDesk = working && cat.slot && slotIn(state, cat.slot).track;
    if (atDesk) {
      const track = slotIn(state, cat.slot!).track!;
      cat.mode = 'keyboard';
      cat.modeUntil = state.tick + KEYBOARD_TICKS;
      pushBug(state, track, cat.id, 'teclado', events);
    } else if (cat.quirk === 'morde-cabo' && !state.cableOut && draw01(state) < CABLE_BITE_P) {
      state.cableOut = true;
      state.cableProgress = 0;
      events.push({ kind: 'cable', tick: state.tick, by: cat.id });
    } else {
      cat.mode = 'zoomies';
      cat.modeUntil = state.tick + ZOOMIES_TICKS;
      cat.targetX = 30 + draw01(state) * 420;
      cat.targetY = 60 + draw01(state) * 180;
      events.push({ kind: 'zoomies', tick: state.tick, cat: cat.id });
    }
    return;
  }

  if (cat.mode === 'work') workAt(state, cat, events);
};

/**
 * O PITCH COMECA: as 48h acabaram, a equipe sobe ao palco. A chance de crash
 * e sorteada AQUI (uma vez, com o rng da partida) e vira uma CRISE jogavel no
 * meio do pitch — respondida a tempo, e improviso heroico; ignorada, a demo
 * crasha de verdade. Build quebrado nao tem crise: nao ha o que improvisar.
 */
const startPitch = (state: HackState, events: SimEvent[]): void => {
  const bugs = state.bugs.filter((b) => !b.fixed).length;
  const crashP = state.buildBroken
    ? 1
    : Math.min(
        0.95,
        Math.max(
          0,
          bugs * CRASH_PER_BUG +
            (state.cableOut ? CRASH_CABLE_OUT : 0) +
            (state.sponsorRisk ? SPONSOR_RISK_CRASH : 0) -
            state.stability * STABILITY_CRASH_RELIEF
        )
      );
  const willCrash = !state.buildBroken && draw01(state) < crashP;
  const crisisAt = willCrash ? Math.round(PITCH_TICKS * (0.35 + draw01(state) * 0.3)) : -1;
  const readyAt: Record<string, number> = {};
  for (const c of state.cats) readyAt[c.id] = 0;
  state.pitch = {
    ticksLeft: PITCH_TICKS,
    // O hype do influencer chega junto com a equipe ao palco — e o terno de
    // mascote do sponsor 'branding' esfria a largada: a plateia viu o
    // anuncio antes de ver a demo.
    gauge: Math.max(
      0,
      Math.min(
        1,
        PITCH_GAUGE_START + state.hype - (state.sponsor?.strings === 'branding' ? SPONSOR_BRANDING_GAUGE : 0)
      )
    ),
    lastAbility: null,
    readyAt,
    crisisAt,
    crisisUntil: 0,
    crisisResolved: !willCrash,
  };
  state.phase = 'pitch';
  events.push({ kind: 'pitch-start', tick: state.tick });
};

const stepPitch = (state: HackState, cmd: Command, events: SimEvent[]): void => {
  const p = state.pitch!;
  const elapsed = PITCH_TICKS - p.ticksLeft;

  // A crise estoura no meio do palco.
  if (p.crisisAt >= 0 && elapsed === p.crisisAt) {
    p.crisisUntil = state.tick + CRISIS_WINDOW;
    events.push({ kind: 'demo-glitch', tick: state.tick });
  }
  const crisisOpen = p.crisisUntil > 0 && state.tick < p.crisisUntil && !p.crisisResolved;

  if (cmd.ability) {
    const cat = catOf(state, cmd.ability);
    const ready = (p.readyAt[cmd.ability] ?? 0) <= state.tick;
    if (cat && ready) {
      p.readyAt[cmd.ability] = state.tick + ABILITY_COOLDOWN;
      if (crisisOpen) {
        // QUALQUER habilidade dentro da janela vira improviso heroico: o bug
        // ao vivo vira demo improvisada, e a plateia ama uma recuperacao.
        p.crisisResolved = true;
        p.crisisUntil = 0;
        p.gauge = Math.min(1, p.gauge + IMPROVISO_BONUS);
        events.push({ kind: 'improviso', tick: state.tick, cat: cat.id });
      } else {
        // O estilo de palco vem da personalidade; os traits temperam.
        let effect = ABILITY_EFFECT[cat.personality] ?? 0.08;
        if (hasTrait(cat, 'pitchador-nato')) effect *= TRAIT_PITCH_UP;
        if (hasTrait(cat, 'medo-de-palco')) effect *= TRAIT_PITCH_DOWN;
        // Repetir a mesma gracinha rende metade: plateia tem memoria.
        if (p.lastAbility === cat.id) effect *= ABILITY_REPEAT_SCALE;
        // O risco do cowboy: cacar o cursor PODE mudar o slide.
        if (cat.personality === 'cowboy' && draw01(state) < ABILITY_COWBOY_MISHAP_P) {
          effect = ABILITY_COWBOY_MISHAP;
        }
        p.gauge = Math.max(0, Math.min(1, p.gauge + effect));
        p.lastAbility = cat.id;
        events.push({ kind: 'ability', tick: state.tick, cat: cat.id, effect });
      }
    }
  }

  // A plateia esfria sozinha; com HYPE demais, mais rapido; em crise, MUITO.
  const decay = PITCH_GAUGE_DECAY * (state.project.risk === 'hype' ? RISK_HYPE_DECAY : 1);
  p.gauge = Math.max(0, p.gauge - decay - (crisisOpen ? CRISIS_DRAIN : 0));
  p.ticksLeft--;
  state.tick++;
  if (p.ticksLeft <= 0) runDemo(state, events);
};

const runDemo = (state: HackState, events: SimEvent[]): void => {
  const p = state.pitch!;
  const core = state.tasks.filter((t) => !t.polish && t.done).length;
  const polish = state.tasks.filter((t) => t.polish && t.done).length;
  const bugs = state.bugs.filter((b) => !b.fixed).length;
  // Ponta solta: comecada, nao terminada, nao cortada — inclui a feature que o
  // perfeccionista segurou ate o fim. Cortar a tempo teria custado zero.
  const looseEnds = state.tasks.filter((t) => !t.done && !t.cut && (t.progress > 0 || t.awaitingShip)).length;

  // Crise nao resolvida (ou build quebrado) = a demo crashou de verdade.
  const crashed = state.buildBroken || (p.crisisAt >= 0 && !p.crisisResolved);
  const improvised = p.crisisAt >= 0 && p.crisisResolved && !state.buildBroken;

  // As CINCO dimensoes. O projeto com mais features nem sempre vence.
  const tecnica = core * SCORE_CORE + looseEnds * SCORE_LOOSE_END;
  const estabilidade =
    SCORE_STABILITY_BASE +
    bugs * SCORE_BUG_PENALTY +
    (bugs === 0 ? SCORE_ZERO_BUG_BONUS : 0) +
    state.debt * SCORE_DEBT_PENALTY +
    state.stability * SCORE_STABILITY_CHOICE;
  const designDone = state.tasks.filter((t) => t.track === 'design' && !t.polish).every((t) => t.done);
  const experiencia = polish * SCORE_POLISH + (designDone ? SCORE_DESIGN_DONE_BONUS : 0) + state.uxCare * SCORE_UX_CARE;
  let inovacao = state.innovation * SCORE_INNOVATION;
  const pitchScore = Math.round(p.gauge * PITCH_SCORE_SCALE);

  // A LENTE anunciada no convite: a banca desta edicao valoriza uma dimensao.
  let tecnicaW = tecnica;
  let estabilidadeW = estabilidade;
  let experienciaW = experiencia;
  const emph = state.project.emphasis;
  if (emph === 'tecnica') tecnicaW = Math.round(tecnica * EMPHASIS_SCALE);
  else if (emph === 'estabilidade') estabilidadeW = Math.round(estabilidade * EMPHASIS_SCALE);
  else if (emph === 'experiencia') experienciaW = Math.round(experiencia * EMPHASIS_SCALE);
  else if (emph === 'inovacao') inovacao = Math.round(inovacao * EMPHASIS_SCALE);

  // Os tres juizes leem as dimensoes pelas proprias lentes; o pitch e a
  // plateia entram por fora, como voto popular.
  const vonWhiskers = tecnicaW + inovacao;
  const meowper = estabilidadeW;
  const cocada = experienciaW;
  // O STRETCH multiplica a nota inteira (a ambicao paga em cima de tudo); a
  // ENTREGA ANTECIPADA soma por fora, linear na folga do congelamento — o
  // premio de quem parou nao deve inflar com o risco que ele recusou.
  const mult = 1 + state.sprint.done * STRETCH_MULT_STEP;
  const early =
    state.sprint.frozenAt >= 0
      ? Math.round((EARLY_SCORE_MAX * (HACK_TICKS - state.sprint.frozenAt)) / HACK_TICKS)
      : 0;
  const score = Math.round((vonWhiskers + meowper + cocada + pitchScore) * mult) + early;

  let outcome: Outcome;
  if (crashed) outcome = 'crashed';
  else if (score >= CUT_GRAND) outcome = 'grand-prize';
  else if (score >= CUT_PODIUM) outcome = 'podio';
  else if (score >= CUT_MENTION) outcome = 'mencao';
  else outcome = 'participacao';

  // O OBJETIVO do sponsor, checado mecanicamente. Demo crashada nao paga
  // sponsor nenhum: nenhum contrato sobrevive ao logo deles numa tela azul.
  const sp = state.sponsor;
  let sponsorMet: boolean | null = null;
  if (sp) {
    if (crashed) sponsorMet = false;
    else if (sp.objective === 'zero-bugs') sponsorMet = bugs === 0;
    else if (sp.objective === 'ship-8') sponsorMet = core + polish >= SPONSOR_SHIP_TARGET;
    else if (sp.objective === 'crowd') sponsorMet = p.gauge >= SPONSOR_CROWD_TARGET;
    else sponsorMet = state.innovation >= SPONSOR_INNOVATION_TARGET;
  }

  // A CATEGORIA ESPECIAL da edicao — o trofeu ortogonal, sobre as
  // dimensoes FINAIS (a lente da banca ja aplicada).
  const special = state.specialCategory;
  const specialWon =
    !crashed &&
    (special === 'golden-whisker'
      ? inovacao >= SPECIAL_INNOVATION_AT
      : special === 'smooth-paws'
        ? experienciaW >= SPECIAL_UX_AT
        : special === 'iron-litter'
          ? estabilidadeW >= SPECIAL_STABILITY_AT
          : special === 'crowd-purr'
            ? p.gauge >= SPECIAL_CROWD_AT
            : bugs === 0 && looseEnds === 0);

  const juniorsGrown = state.cats.filter((c) => c.tier === 'junior' && c.learned >= JUNIOR_GROWN_AT).length;

  // O PREMIO em tampinhas, agora um EXTRATO (§7 do brief): colocacao, zero
  // bugs, acordos, sponsor cumprido, categoria especial, juniores crescidos
  // — e a divida tecnica restante MORDE o cheque. O palco do CIRCUITO
  // multiplica CADA parcela (achado de review: escalar so o total quebrava
  // o invariante do extrato — a tela mostraria um cheque que as parcelas
  // nao somam). A divida tambem escala: palco grande, vergonha grande.
  // Nunca negativo: o piso da vergonha e zero.
  const prizeScale = state.circuit?.prizeScale ?? 1;
  const scaledPart = (v: number): number => Math.round(v * prizeScale);
  const prizeParts = {
    placement: scaledPart(PRIZE_BY_OUTCOME[outcome] ?? 0),
    zeroBugs: scaledPart(bugs === 0 && !crashed ? PRIZE_ZERO_BUGS : 0),
    deals: scaledPart(state.prizeBonus),
    sponsor: scaledPart(sponsorMet ? (sp?.payout ?? 0) : 0),
    special: scaledPart(specialWon ? PRIZE_SPECIAL : 0),
    juniors: scaledPart(juniorsGrown * PRIZE_JUNIOR_GROWTH),
    debt: scaledPart(-state.debt * PRIZE_DEBT_MALUS),
  };
  const prize = Math.max(
    0,
    prizeParts.placement +
      prizeParts.zeroBugs +
      prizeParts.deals +
      prizeParts.sponsor +
      prizeParts.special +
      prizeParts.juniors +
      prizeParts.debt
  );

  const result: DemoResult = {
    core,
    polish,
    bugs,
    looseEnds,
    prize,
    prizeParts,
    sponsorMet,
    specialWon,
    juniorsGrown,
    early,
    stretched: state.sprint.done,
    perJudge: [vonWhiskers, meowper, cocada],
    dimensions: { tecnica: tecnicaW, estabilidade: estabilidadeW, experiencia: experienciaW, inovacao, pitch: pitchScore },
    plateia: p.gauge,
    score,
    crashed,
    improvised,
    outcome,
  };
  state.result = result;
  state.phase = 'done';
  events.push({ kind: 'demo', tick: state.tick, result });
};

/**
 * O PM em acao: anda ate o dev de menor moral numa mesa e entrega o pep
 * talk NA CHEGADA (+moral, -estresse); sem alvo, volta ao posto diante do
 * quadro. Atras da curva de entregas, resmunga o prazo no feed — com teto
 * de frequencia. Tudo deterministico: nenhum draw01, nenhum relogio.
 */
const stepPm = (state: HackState, events: SimEvent[]): void => {
  const pm = state.pm;
  // A visita ACOMPANHA o gato: se o jogador o moveu de mesa no meio do
  // caminho, o PM vira junto; se ele saiu do teclado, a visita e desfeita
  // e o PM volta ao posto. Pep talk se entrega PESSOALMENTE — nunca a uma
  // mesa vazia (achado de revisao).
  if (pm.pepCat) {
    const cat = catOf(state, pm.pepCat);
    if (cat && cat.mode === 'work' && cat.slot?.startsWith('desk-')) {
      // Aborda pelo lado LIVRE. O lado do centro e o preferido (o espaco
      // classico ao lado de toda mesa), mas em bancadas continuas o vizinho
      // senta a 46px e o PM a PM_PEP_SIDE do alvo invadiria a silhueta
      // dele (achado de review). Os candidatos sao testados em ordem FIXA
      // e vence o primeiro com folga >= PM_PEP_CLEAR dos outros gatos de
      // mesa; a diagonal frontal cobre o meio da bancada, onde nenhum lado
      // puro e livre. Deterministico: ordem fixa, nenhum draw01.
      const side = cat.x < 240 ? 1 : -1;
      const others = state.cats.filter((c) => c.id !== cat.id && c.slot?.startsWith('desk-'));
      const clearance = (x: number, y: number): number =>
        others.reduce((m, o) => Math.min(m, Math.hypot(o.x - x, o.y - y)), Infinity);
      const spots: readonly (readonly [number, number])[] = [
        [cat.x + side * PM_PEP_SIDE, cat.y + 6],
        [cat.x - side * PM_PEP_SIDE, cat.y + 6],
        [cat.x + side * 18, cat.y + 18],
        [cat.x - side * 18, cat.y + 18],
      ];
      const spot = spots.find(([x, y]) => clearance(x, y) >= PM_PEP_CLEAR) ?? spots[2]!;
      pm.targetX = spot[0];
      pm.targetY = spot[1];
    } else {
      pm.pepCat = null;
      pm.targetX = 262;
      pm.targetY = 168;
    }
  }
  const dx = pm.targetX - pm.x;
  const dy = pm.targetY - pm.y;
  const len = Math.hypot(dx, dy);
  if (len > 2) {
    pm.x += (dx / len) * PM_WALK_SPEED;
    pm.y += (dy / len) * PM_WALK_SPEED;
  } else if (pm.pepCat) {
    const cat = catOf(state, pm.pepCat)!;
    pm.pepCat = null;
    if (Math.hypot(cat.x - pm.x, cat.y - pm.y) <= PM_PEP_RADIUS) {
      cat.moral = Math.min(1, cat.moral + PM_PEP_MORAL);
      cat.stress = Math.max(0, cat.stress - PM_PEP_STRESS);
      events.push({ kind: 'pep', tick: state.tick, cat: cat.id });
    }
  }
  if (state.tick >= pm.nextPepAt) {
    pm.nextPepAt = state.tick + PM_PEP_PERIOD;
    let target: Cat | null = null;
    for (const c of state.cats) {
      if (c.slot?.startsWith('desk-') && c.mode === 'work' && (!target || c.moral < target.moral)) target = c;
    }
    if (target) {
      pm.pepCat = target.id;
      pm.targetX = target.x - 16;
      pm.targetY = target.y + 8;
    } else {
      pm.targetX = 262;
      pm.targetY = 168;
    }
  }
  // A CURVA: entregas esperadas pela fracao do tempo vs entregues de fato.
  const alive = state.tasks.filter((t) => !t.cut);
  const done = alive.filter((t) => t.done).length;
  const expected = Math.floor((state.tick / HACK_TICKS) * alive.length);
  if (expected > done && state.tick >= pm.lastWorryAt + PM_WORRY_PERIOD) {
    pm.lastWorryAt = state.tick;
    events.push({ kind: 'pm-worry', tick: state.tick, behind: expected - done });
  }
};

export const step = (state: HackState, cmd: Command): SimEvent[] => {
  if (state.phase === 'done') return [];
  const events: SimEvent[] = [];

  if (state.phase === 'pitch') {
    stepPitch(state, cmd, events);
    state.events.push(...events);
    return events;
  }

  applyCommand(state, cmd, events);
  // CONGELOU a submissao: a run pulou direto ao palco neste comando — o
  // resto do tick de booth nao existe mais.
  if (state.phase !== 'hack') {
    state.events.push(...events);
    return events;
  }
  stepHairball(state, events);
  for (const cat of state.cats) stepCat(state, cat, cmd, events);
  stepPm(state, events);

  // Eventos SOCIAIS: abrem a janela no instante agendado; ignorados, fecham
  // sozinhos na opcao segura.
  for (const ev of state.social) {
    if (!ev.resolved && ev.until === 0 && state.tick === ev.at) {
      ev.until = state.tick + SOCIAL_WINDOW;
      events.push({ kind: 'social-open', tick: state.tick, social: ev.kind });
    } else if (!ev.resolved && ev.until > 0 && state.tick >= ev.until) {
      resolveSocial(state, ev, 'b', events);
    }
  }

  // O NUCLEO fechou antes do prazo? O Stretch Sprint abre: dali em diante o
  // fim da run e decisao (congelar ou esticar), nunca tempo morto. Escopo
  // todo cortado nao e MVP: e preciso ter shipado ALGO.
  if (state.sprint.mvpAt < 0) {
    const core = state.tasks.filter((t) => !t.polish);
    if (core.some((t) => t.done) && core.every((t) => t.done || t.cut)) {
      state.sprint.mvpAt = state.tick;
      events.push({ kind: 'mvp-ready', tick: state.tick });
      const first = state.sprint.offers[0];
      if (first && first.status === 'locked') {
        first.status = 'open';
        events.push({ kind: 'stretch-open', tick: state.tick, offer: first.kind });
      }
    }
  }

  // O curriculo nao contava tudo: no meio da run, o trait oculto aparece.
  if (state.tick === Math.round(HACK_TICKS * REVEAL_AT)) {
    for (const cat of state.cats) {
      if (!cat.revealed) {
        cat.revealed = true;
        events.push({ kind: 'trait-revealed', tick: state.tick, cat: cat.id, trait: cat.hiddenTrait });
      }
    }
  }
  // O risco oculto do projeto: a integracao do sponsor CAI no meio da run.
  if (
    state.project.risk === 'integracao-instavel' &&
    state.tick === Math.round(HACK_TICKS * RISK_OUTAGE_AT) &&
    !state.cableOut &&
    !state.buildBroken
  ) {
    state.cableOut = true;
    state.cableProgress = 0;
    events.push({ kind: 'sponsor-outage', tick: state.tick });
  }

  state.tick++;
  if (state.tick >= HACK_TICKS) startPitch(state, events);

  state.events.push(...events);
  return events;
};

export { SLOTS };
