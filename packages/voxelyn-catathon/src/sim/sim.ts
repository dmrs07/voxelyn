import {
  ABILITY_COOLDOWN,
  ABILITY_COWBOY_MISHAP,
  ABILITY_COWBOY_MISHAP_P,
  ABILITY_EFFECT,
  ABILITY_REPEAT_SCALE,
  BIGODE_CSS_SPEED,
  BUG_COST,
  CABLE_BITE_P,
  CABLE_FIX_COST,
  CALM_SCALE,
  CHOICE_COST,
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
  GRABBED_FROM_NAP,
  EMPHASIS_SCALE,
  FREESTYLER_SPEED,
  IMPROVISO_BONUS,
  JUNIOR_BUG_EXTRA,
  JUNIOR_ENERGY_SCALE,
  JUNIOR_LEARN,
  JUNIOR_SPEED,
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
  PET_DECAY_SCALE,
  PET_MEMORY_TICKS,
  PET_PROFILE,
  PITCH_GAUGE_DECAY,
  PITCH_GAUGE_START,
  PITCH_SCORE_SCALE,
  PITCH_TICKS,
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
  SPONSOR_RISK_CRASH,
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
  STRESS_AFTER_PROC,
  STRESS_DANGER,
  STRESS_IDLE_RATE,
  STRESS_PET_RATE,
  STRESS_PROC_P,
  STRESS_TREAT_DROP,
  STRESS_WORK_RATE,
  TERRITORIAL_DISPLACED,
  TREATS_START,
  WALK_SPEED,
  ZOOMIES_SPEED,
  ZOOMIES_TICKS,
} from './constants.js';
import { SLOTS, TASKS } from './data.js';
import { CLASSIC_LAYOUT, rollLayout, rollProject, type Candidate } from './gen.js';
import { CHOICE_TEXT, TASK_TEXT, type Locale } from './text.js';
import type { Cat, CatId, Command, DemoResult, HackState, Outcome, SimEvent, SlotId, Spec, Task, Track } from './types.js';

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

/** Um trait age desde o inicio — visivel ou nao. A revelacao so INFORMA. */
const hasTrait = (cat: Cat, trait: string): boolean =>
  cat.traits.includes(trait) || cat.hiddenTrait === trait;

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
  opts: { classic?: boolean; locale?: Locale } = {}
): HackState => {
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
  return {
  tick: 0,
  phase: 'hack',
  seed: seed >>> 0,
  rngState: nextU32(seed >>> 0),
  cats: catsFromTeam(team),
  tasks: taskDefs.map((t) => ({ ...t, progress: 0, done: false, cut: false, awaitingShip: false, chosen: null })),
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
  held: null,
  handX: 240,
  handY: 135,
  debt: 0,
  innovation: 0,
  uxCare: 0,
  stability: 0,
  sponsorRisk: false,
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
  layoutMods: { ...layout.mods },
  slots: layout.slots.map((s) => ({ ...s })),
  pitch: null,
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

const sendTo = (state: HackState, cat: Cat, slot: SlotId): void => {
  const s = slotIn(state, slot);
  cat.slot = slot;
  cat.targetX = s.x;
  cat.targetY = s.y;
  cat.mode = 'walk';
};

/** Todo bug nasce aqui: o risco 'dados-sensiveis' encarece cada um. */
const pushBug = (state: HackState, track: Track, by: CatId, cause: 'teclado' | 'sem-teste', events: SimEvent[]): void => {
  const cost = Math.round(BUG_COST * (state.project.risk === 'dados-sensiveis' ? RISK_BUGCOST : 1));
  state.bugs.push({ id: state.bugs.length, track, by, cost, progress: 0, fixed: false });
  events.push({ kind: 'bug', tick: state.tick, by, track, cause });
};

const shipTask = (state: HackState, task: Task, by: Cat, events: SimEvent[]): void => {
  task.done = true;
  task.awaitingShip = false;
  events.push({ kind: 'ship', tick: state.tick, task: task.label, track: task.track, by: by.id });

  // Shippar levanta a MORAL: mais a de quem shipou, um pouco a de todos.
  // Sucesso e contagioso num booth de quatro gatos.
  for (const c of state.cats) {
    const gain = c.id === by.id ? MORAL_SHIP_OWN : MORAL_SHIP_TEAM * state.layoutMods.moralShip;
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
};

const applyCommand = (state: HackState, cmd: Command, events: SimEvent[]): void => {
  if (cmd.handX !== undefined) state.handX = cmd.handX;
  if (cmd.handY !== undefined) state.handY = cmd.handY;

  if (cmd.grab && !state.held) {
    const cat = catOf(state, cmd.grab);
    if (cat && cat.mode !== 'held') {
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
    if (occupant && cmd.drop !== 'puff' && cmd.drop !== 'cafe') {
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
};

/**
 * O EFEITO de cada decisao — custo agora, custo depois, e tags que a banca
 * cobra. Nada aqui e "+10%": cada opcao muda o formato da run.
 */
const applyChoice = (state: HackState, task: Task, option: string): void => {
  const scale = (id: string, k: number): void => {
    const t = state.tasks.find((x) => x.id === id);
    if (t && !t.done) t.cost = Math.round(t.cost * k);
  };
  switch (option) {
    case 'monolito':
      scale(task.id, CHOICE_COST.monolito);
      state.debt += 1;
      break;
    case 'micro':
      scale(task.id, CHOICE_COST.micro);
      scale('b2', CHOICE_COST.microDownstream);
      scale('b3', CHOICE_COST.microDownstream);
      state.innovation += 1;
      break;
    case 'serverless':
      scale(task.id, CHOICE_COST.serverless);
      state.sponsorRisk = true;
      state.innovation += 1;
      break;
    case 'sistemaPrimeiro':
      scale(task.id, CHOICE_COST.sistemaPrimeiro);
      scale('d2', CHOICE_COST.sistemaDownstream);
      scale('d3', CHOICE_COST.sistemaDownstream);
      state.uxCare += 1;
      break;
    case 'componentesLocais':
      scale(task.id, CHOICE_COST.componentesLocais);
      state.debt += 1;
      break;
    case 'templateSponsor':
      scale(task.id, CHOICE_COST.templateSponsor);
      state.innovation -= 1;
      break;
    case 'pipelineCompleto':
      scale(task.id, CHOICE_COST.pipelineCompleto);
      state.stability += 1;
      break;
    case 'deployNaMao':
      scale(task.id, CHOICE_COST.deployNaMao);
      state.debt += 1;
      break;
    case 'presetSponsor':
      scale(task.id, CHOICE_COST.presetSponsor);
      state.sponsorRisk = true;
      break;
  }
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
    // Quebra e FICA quebrado. E a unica punicao irreversivel, e chega com 50
    // segundos de sirene.
    state.buildBroken = true;
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
    // O junior APRENDE: comeca devagar e cresce com a run.
    s *= JUNIOR_SPEED + JUNIOR_LEARN * Math.min(1, state.tick / HACK_TICKS);
  } else if (cat.tier === 'senior') s *= SENIOR_SPEED;
  if (hasTrait(cat, 'polidactila')) s *= TRAIT_SPEED_POLY;
  // Gato desanimado rende menos; radiante, mais. A moral NAO e enfeite.
  s *= MORAL_SPEED_MIN + cat.moral * (MORAL_SPEED_MAX - MORAL_SPEED_MIN);
  return s;
};

const workAt = (state: HackState, cat: Cat, events: SimEvent[]): void => {
  if (cat.slot === 'rack') {
    // O rack atende DUAS emergencias, na ordem: bola de pelo, cabo mordido.
    // O layout Server Corner conserta mais rapido — proximidade e mecanica.
    const fix = state.layoutMods.fixSpeed;
    if (state.hairball.active) state.hairball.progress += fix;
    else if (state.cableOut) {
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
  const awaiting = state.tasks.find((t) => t.track === track && t.awaitingShip && !t.cut);
  if (awaiting && cat.personality !== 'perfeccionista') {
    shipTask(state, awaiting, cat, events);
    return;
  }

  const task = nextTask(state, track);
  if (!task) return;
  // Tarefa com DECISAO aberta nao anda: o gato senta, olha para o quadro e o
  // jogo cobra a escolha. Colocar gato e esperar barra encher nao e jogo.
  if (task.choice && task.chosen === null) {
    if (state.tick % 300 === 0) events.push({ kind: 'decision-needed', tick: state.tick, task: task.label });
    return;
  }
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
    rate *= state.layoutMods.napRate;
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
  cat.hunger = Math.max(0, cat.hunger - HUNGER_DRAIN * (hasTrait(cat, 'guloso') ? TRAIT_HUNGRY : 1));
  // Trabalhar exausto corroi a moral: virar a noite tem preco alem do sono.
  if (working && cat.energy < MORAL_OVERWORK_AT) {
    cat.moral = Math.max(0, cat.moral - MORAL_OVERWORK_RATE);
  }

  let stressRate = working
    ? STRESS_WORK_RATE * state.layoutMods.stressWork
    : STRESS_IDLE_RATE * state.layoutMods.stressIdle;
  if (cat.personality === 'calmo') stressRate *= CALM_SCALE;
  if (hasTrait(cat, 'zen')) stressRate *= TRAIT_ZEN;
  // O tuxedo sofre com bug vivo em QUALQUER trilha. Ele sabe. Ele sempre sabe.
  if (cat.personality === 'julga-em-silencio' && state.bugs.some((b) => !b.fixed)) {
    stressRate *= JUDGE_BUG_SCALE;
  }
  cat.stress = Math.min(1, cat.stress + stressRate);

  // Necessidades tomam o corpo: fome primeiro, depois sono.
  if (cat.hunger <= HUNGER_EAT_AT && (working || cat.mode === 'idle')) {
    sendTo(state, cat, 'cafe');
    return;
  }
  if (cat.energy <= ENERGY_NAP_AT && (working || cat.mode === 'idle')) {
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
    gauge: PITCH_GAUGE_START,
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
  const score = vonWhiskers + meowper + cocada + pitchScore;

  let outcome: Outcome;
  if (crashed) outcome = 'crashed';
  else if (score >= CUT_GRAND) outcome = 'grand-prize';
  else if (score >= CUT_PODIUM) outcome = 'podio';
  else if (score >= CUT_MENTION) outcome = 'mencao';
  else outcome = 'participacao';

  const result: DemoResult = {
    core,
    polish,
    bugs,
    looseEnds,
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

export const step = (state: HackState, cmd: Command): SimEvent[] => {
  if (state.phase === 'done') return [];
  const events: SimEvent[] = [];

  if (state.phase === 'pitch') {
    stepPitch(state, cmd, events);
    state.events.push(...events);
    return events;
  }

  applyCommand(state, cmd, events);
  stepHairball(state, events);
  for (const cat of state.cats) stepCat(state, cat, cmd, events);

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
