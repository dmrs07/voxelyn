import {
  BIGODE_CSS_SPEED,
  BUG_COST,
  CABLE_BITE_P,
  CABLE_FIX_COST,
  CALM_SCALE,
  COWBOY_BUG_P,
  COWBOY_SHORTCUT_P,
  COWBOY_SPEED,
  CRASH_CABLE_OUT,
  CRASH_PER_BUG,
  CUT_GRAND,
  CUT_MENTION,
  CUT_PODIUM,
  EAT_TICKS,
  ENERGY_IDLE_DRAIN,
  ENERGY_NAP_AT,
  ENERGY_NAP_RATE,
  ENERGY_NAP_TO,
  ENERGY_PET_RATE,
  ENERGY_WORK_DRAIN,
  GRABBED_FROM_NAP,
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
  SCORE_LOOSE_END,
  SCORE_POLISH,
  SCORE_STABILITY_BASE,
  SCORE_ZERO_BUG_BONUS,
  SHORTCUT_HEADSTART,
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
import { SLOTS, TASKS, slotOf, startCats } from './data.js';
import type { Cat, Command, DemoResult, HackState, Outcome, SimEvent, SlotId, Task, Track } from './types.js';

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

export const createHackathon = (seed: number): HackState => ({
  tick: 0,
  phase: 'hack',
  seed: seed >>> 0,
  rngState: nextU32(seed >>> 0),
  cats: startCats(),
  tasks: TASKS.map((t) => ({ ...t, progress: 0, done: false, cut: false, awaitingShip: false })),
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
  events: [],
  result: null,
});

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

const sendTo = (cat: Cat, slot: SlotId): void => {
  const s = slotOf(slot);
  cat.slot = slot;
  cat.targetX = s.x;
  cat.targetY = s.y;
  cat.mode = 'walk';
};

const shipTask = (state: HackState, task: Task, by: Cat, events: SimEvent[]): void => {
  task.done = true;
  task.awaitingShip = false;
  events.push({ kind: 'ship', tick: state.tick, task: task.label, track: task.track, by: by.id });

  if (by.personality === 'cowboy') {
    // Shipou sem testar: as vezes vem bug junto; as vezes, sem querer, ele
    // reescreve algo muito melhor — o atalho genial do junior laranja.
    if (draw01(state) < COWBOY_BUG_P) {
      state.bugs.push({ id: state.bugs.length, track: task.track, by: by.id, cost: BUG_COST, progress: 0, fixed: false });
      events.push({ kind: 'bug', tick: state.tick, by: by.id, track: task.track, cause: 'sem-teste' });
    }
    if (draw01(state) < COWBOY_SHORTCUT_P) {
      const next = state.tasks.find((t) => t.track === task.track && !t.done && !t.cut);
      if (next) {
        next.progress = Math.min(next.cost, next.progress + next.cost * SHORTCUT_HEADSTART);
        events.push({ kind: 'shortcut', tick: state.tick, task: next.label, by: by.id });
      }
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
    }
    sendTo(cat, cmd.drop);
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

/** A velocidade de um gato numa trilha. As personalidades moram aqui. */
const speedOf = (cat: Cat, track: Track): number => {
  let s = cat.specialty === track ? 1 : OFFSPEC_SPEED;
  // O siames RECUSA CSS: em frontend ele rende quase nada, sob protesto.
  if (cat.id === 'bigode' && track === 'frontend') s = BIGODE_CSS_SPEED;
  if (cat.personality === 'cowboy') s *= COWBOY_SPEED;
  return s;
};

const workAt = (state: HackState, cat: Cat, events: SimEvent[]): void => {
  if (cat.slot === 'rack') {
    // O rack atende DUAS emergencias, na ordem: bola de pelo, cabo mordido.
    if (state.hairball.active) state.hairball.progress += 1;
    else if (state.cableOut) {
      state.cableProgress += 1;
      if (state.cableProgress >= CABLE_FIX_COST) {
        state.cableOut = false;
        state.cableProgress = 0;
        events.push({ kind: 'cable-fixed', tick: state.tick });
      }
    }
    return;
  }
  if (cat.slot === 'puff' || cat.slot === 'cafe') return;

  const track = slotOf(cat.slot!).track!;
  // Repositorio travado ou build fora do ar: ninguem testa, ninguem mergeia.
  if (state.hairball.active || state.buildBroken || state.cableOut) return;

  const speed = speedOf(cat, track);

  const bug = liveBug(state, track);
  if (bug) {
    bug.progress += speed;
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
    // segurava mergeia na hora, com a bencao.
    if (cat.personality === 'perfeccionista') {
      const awaiting = state.tasks.find((t) => t.awaitingShip && !t.cut);
      if (awaiting) shipTask(state, awaiting, cat, events);
    }
    cat.mode = 'petted';
    cat.stress = Math.max(0, cat.stress - STRESS_PET_RATE);
    cat.energy = Math.min(1, cat.energy + ENERGY_PET_RATE);
    return;
  }
  if (cat.mode === 'petted') cat.mode = cat.slot ? 'walk' : 'idle';

  if (cat.mode === 'zoomies') {
    if (state.tick >= cat.modeUntil) {
      if (cat.slot) sendTo(cat, cat.slot);
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
    const rate = cat.quirk === 'caixa' ? ENERGY_NAP_RATE * QUIRK_BOX_NAP_SCALE : ENERGY_NAP_RATE;
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
        cat.modeUntil = state.tick + EAT_TICKS;
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
  cat.energy = Math.max(0, cat.energy - (working ? ENERGY_WORK_DRAIN : ENERGY_IDLE_DRAIN));
  cat.hunger = Math.max(0, cat.hunger - HUNGER_DRAIN);

  let stressRate = working ? STRESS_WORK_RATE : STRESS_IDLE_RATE;
  if (cat.personality === 'calmo') stressRate *= CALM_SCALE;
  // O tuxedo sofre com bug vivo em QUALQUER trilha. Ele sabe. Ele sempre sabe.
  if (cat.personality === 'julga-em-silencio' && state.bugs.some((b) => !b.fixed)) {
    stressRate *= JUDGE_BUG_SCALE;
  }
  cat.stress = Math.min(1, cat.stress + stressRate);

  // Necessidades tomam o corpo: fome primeiro, depois sono.
  if (cat.hunger <= HUNGER_EAT_AT && (working || cat.mode === 'idle')) {
    sendTo(cat, 'cafe');
    return;
  }
  if (cat.energy <= ENERGY_NAP_AT && (working || cat.mode === 'idle')) {
    // O Almofada cochila NO RACK (mania). Os outros vao ao puff — o Smoking
    // dorme na caixa ao lado, que e a mesma coordenada e o dobro do charme.
    sendTo(cat, cat.quirk === 'dorme-no-rack' ? 'rack' : 'puff');
    if (cat.quirk === 'dorme-no-rack') {
      // No rack ele dorme de verdade (nao trabalha): modo nap ao chegar.
      cat.slot = 'puff';
      const rack = slotOf('rack');
      cat.targetX = rack.x - 10;
      cat.targetY = rack.y - 6;
    }
    return;
  }

  // O DADO DO DESASTRE. Na mesa: senta no teclado (bug na trilha). Fora dela:
  // o Cheeto pode MORDER O CABO (build fora do ar); os demais, zoomies.
  if (cat.stress >= STRESS_DANGER && draw01(state) < STRESS_PROC_P) {
    cat.stress = STRESS_AFTER_PROC;
    const atDesk = working && cat.slot && slotOf(cat.slot).track;
    if (atDesk) {
      const track = slotOf(cat.slot!).track!;
      cat.mode = 'keyboard';
      cat.modeUntil = state.tick + KEYBOARD_TICKS;
      state.bugs.push({ id: state.bugs.length, track, by: cat.id, cost: BUG_COST, progress: 0, fixed: false });
      events.push({ kind: 'bug', tick: state.tick, by: cat.id, track, cause: 'teclado' });
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

const runDemo = (state: HackState, events: SimEvent[]): void => {
  const core = state.tasks.filter((t) => !t.polish && t.done).length;
  const polish = state.tasks.filter((t) => t.polish && t.done).length;
  const bugs = state.bugs.filter((b) => !b.fixed).length;
  // Ponta solta: comecada, nao terminada, nao cortada — inclui a feature que o
  // perfeccionista segurou ate o fim. Cortar a tempo teria custado zero.
  const looseEnds = state.tasks.filter((t) => !t.done && !t.cut && (t.progress > 0 || t.awaitingShip)).length;

  const vonWhiskers = core * SCORE_CORE + looseEnds * SCORE_LOOSE_END;
  const meowper = SCORE_STABILITY_BASE + bugs * SCORE_BUG_PENALTY + (bugs === 0 ? SCORE_ZERO_BUG_BONUS : 0);
  const designDone = state.tasks.filter((t) => t.track === 'design' && !t.polish).every((t) => t.done);
  const cocada = polish * SCORE_POLISH + (designDone ? SCORE_DESIGN_DONE_BONUS : 0);
  const score = vonWhiskers + meowper + cocada;

  const crashP = state.buildBroken ? 1 : Math.min(0.95, bugs * CRASH_PER_BUG + (state.cableOut ? CRASH_CABLE_OUT : 0));
  const crashed = draw01(state) < crashP;

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
    score,
    crashed,
    outcome,
  };
  state.result = result;
  state.phase = 'done';
  events.push({ kind: 'demo', tick: state.tick, result });
};

export const step = (state: HackState, cmd: Command): SimEvent[] => {
  if (state.phase !== 'hack') return [];
  const events: SimEvent[] = [];

  applyCommand(state, cmd, events);
  stepHairball(state, events);
  for (const cat of state.cats) stepCat(state, cat, cmd, events);

  state.tick++;
  if (state.tick >= HACK_TICKS) runDemo(state, events);

  state.events.push(...events);
  return events;
};

export { SLOTS };
