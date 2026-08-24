import {
  ABILITY_CHEETO_MISHAP,
  ABILITY_CHEETO_MISHAP_P,
  ABILITY_COOLDOWN,
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
  IMPROVISO_BONUS,
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
import type { Cat, CatId, Command, DemoResult, HackState, Outcome, SimEvent, SlotId, Task, Track } from './types.js';

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
  tasks: TASKS.map((t) => ({ ...t, progress: 0, done: false, cut: false, awaitingShip: false, chosen: null })),
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
  pitch: null,
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

  // Shippar levanta a MORAL: mais a de quem shipou, um pouco a de todos.
  // Sucesso e contagioso num booth de quatro gatos.
  for (const c of state.cats) {
    c.moral = Math.min(1, c.moral + (c.id === by.id ? MORAL_SHIP_OWN : MORAL_SHIP_TEAM));
  }

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
      // Ser despejado desanima qualquer um.
      occupant.moral = Math.max(0, occupant.moral - MORAL_DISPLACED);
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

/** A velocidade de um gato numa trilha. Personalidades E moral moram aqui. */
const speedOf = (cat: Cat, track: Track): number => {
  let s = cat.specialty === track ? 1 : OFFSPEC_SPEED;
  // O siames RECUSA CSS: em frontend ele rende quase nada, sob protesto.
  if (cat.id === 'bigode' && track === 'frontend') s = BIGODE_CSS_SPEED;
  if (cat.personality === 'cowboy') s *= COWBOY_SPEED;
  // Gato desanimado rende menos; radiante, mais. A moral NAO e enfeite.
  s *= MORAL_SPEED_MIN + cat.moral * (MORAL_SPEED_MAX - MORAL_SPEED_MIN);
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
  // Trabalhar exausto corroi a moral: virar a noite tem preco alem do sono.
  if (working && cat.energy < MORAL_OVERWORK_AT) {
    cat.moral = Math.max(0, cat.moral - MORAL_OVERWORK_RATE);
  }

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
  state.pitch = {
    ticksLeft: PITCH_TICKS,
    gauge: PITCH_GAUGE_START,
    lastAbility: null,
    readyAt: { bigode: 0, cheeto: 0, almofada: 0, smoking: 0 },
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
        let effect = ABILITY_EFFECT[cat.id] ?? 0.08;
        // Repetir a mesma gracinha rende metade: plateia tem memoria.
        if (p.lastAbility === cat.id) effect *= ABILITY_REPEAT_SCALE;
        // O risco do Cheeto: cacar o cursor PODE mudar o slide.
        if (cat.id === 'cheeto' && draw01(state) < ABILITY_CHEETO_MISHAP_P) {
          effect = ABILITY_CHEETO_MISHAP;
        }
        p.gauge = Math.max(0, Math.min(1, p.gauge + effect));
        p.lastAbility = cat.id;
        events.push({ kind: 'ability', tick: state.tick, cat: cat.id, effect });
      }
    }
  }

  // A plateia esfria sozinha; numa crise aberta, esfria MUITO.
  p.gauge = Math.max(0, p.gauge - PITCH_GAUGE_DECAY - (crisisOpen ? CRISIS_DRAIN : 0));
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
  const inovacao = state.innovation * SCORE_INNOVATION;
  const pitchScore = Math.round(p.gauge * PITCH_SCORE_SCALE);

  // Os tres juizes leem as dimensoes pelas proprias lentes; o pitch e a
  // plateia entram por fora, como voto popular.
  const vonWhiskers = tecnica + inovacao;
  const meowper = estabilidade;
  const cocada = experiencia;
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
    dimensions: { tecnica, estabilidade, experiencia, inovacao, pitch: pitchScore },
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

  state.tick++;
  if (state.tick >= HACK_TICKS) startPitch(state, events);

  state.events.push(...events);
  return events;
};

export { SLOTS };
