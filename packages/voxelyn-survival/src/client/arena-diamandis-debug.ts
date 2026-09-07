// O PAINEL DO DIAMANDIS na arena de teste: os oito rumos do chassi, cada
// estado de cada peca (presa, solta, arrancada e carregada, caida), o frenesi
// e a leitura exata do que a simulacao decide sobre tudo isso.
//
// Nada disto e importado por `main.ts`: a arena e a porta, e a unica. Os
// cenarios escrevem no estado AUTORITATIVO pelo mesmo caminho que a simulacao
// e os testes usam — `damageEntity` para expor (a simulacao solta o modulo e
// chama os Coveiros sozinha, no proximo tick), `ripDiamandisModule` para
// arrancar, `spawnEnemy` para o carregador — e a simulacao segue dali. O que
// se ve depois e o que o jogo faria.
import {
  BOSS_PHASE_REACTOR,
  DIAMANDIS_FRENZY_CAP,
  DIAMANDIS_MODULE_COUNT,
  DIAMANDIS_MODULE_EXPOSE_AT,
  DIAMANDIS_RIP_STAGGER_TICKS,
  SOLID_NONE,
  damageEntity,
  diamandisFrenzyMultiplier,
  diamandisFrenzyStacks,
  DIAMANDIS_BEAM_LENGTH,
  DIAMANDIS_BEAM_WINDUP_TICKS,
  DIAMANDIS_BEAM_COOLDOWN_TICKS,
  DIAMANDIS_DEMOLISH_COOLDOWN_TICKS,
  DIAMANDIS_DEMOLISH_WINDUP_TICKS,
  DIAMANDIS_DRILL_COOLDOWN_TICKS,
  DIAMANDIS_DRILL_RUN_TILES,
  DIAMANDIS_DRILL_TICKS,
  DIAMANDIS_DRILL_WINDUP_TICKS,
  SOLID_FRAGILE,
  SOLID_ORE,
  SOLID_ROCK,
  drillSpeedFractionAt,
  drillSpinAt,
  drillStageAt,
  markDemolition,
  ripDiamandisModule,
  spawnEnemy,
  startAction,
} from '@voxelyn/survival-sim';
import type { Entity, SemanticEvent, SurvivalState } from '@voxelyn/survival-sim';
import { dirFromFacing8 } from '@voxelyn/survival-content';
import { DIAMANDIS_PART_NAMES, diamandisPartState } from './diamandis-body';
import { beamPhaseAt, beamReach } from './diamandis-beam';

export type DiamandisScenario =
  | 'reset'
  | 'wake'
  | 'beside'
  | 'center'
  | 'faceR'
  | 'faceDR'
  | 'faceD'
  | 'faceDL'
  | 'faceL'
  | 'faceUL'
  | 'faceU'
  | 'faceUR'
  | 'exposeNext'
  | 'ripNext'
  | 'killCarrier'
  | 'frenzyMax'
  | 'reactor'
  | 'beam'
  | 'demolish'
  | 'drill'
  | 'drillWall'
  | 'drillMiss';

/** Os cenarios, na ordem do painel. Os rotulos vivem em `arena-main.ts`. */
export const DIAMANDIS_SCENARIOS: readonly DiamandisScenario[] = [
  'reset',
  'wake',
  'beside',
  'center',
  'faceR',
  'faceDR',
  'faceD',
  'faceDL',
  'faceL',
  'faceUL',
  'faceU',
  'faceUR',
  'exposeNext',
  'ripNext',
  'killCarrier',
  'frenzyMax',
  'reactor',
  'beam',
  'demolish',
  'drill',
  'drillWall',
  'drillMiss',
];

/**
 * Um vetor de MUNDO no centro de cada rumo de tela, na ordem de
 * `DIRS8_BY_ANGLE`. E o que o cenario escreve em `facing` para o chassi
 * mostrar aquele quadro.
 */
export const FACING_BY_DIR: Record<string, { x: number; y: number }> = {
  r: { x: 1, y: -1 },
  dr: { x: 1, y: 0 },
  d: { x: 1, y: 1 },
  dl: { x: 0, y: 1 },
  l: { x: -1, y: 1 },
  ul: { x: -1, y: 0 },
  u: { x: -1, y: -1 },
  ur: { x: 0, y: -1 },
};

const FACE_SCENARIO_DIR: Partial<Record<DiamandisScenario, string>> = {
  faceR: 'r',
  faceDR: 'dr',
  faceD: 'd',
  faceDL: 'dl',
  faceL: 'l',
  faceUL: 'ul',
  faceU: 'u',
  faceUR: 'ur',
};

export const bossOf = (state: SurvivalState): Entity | null =>
  state.enemies.find((e) => e.alive && e.archetype === 'diamandis') ?? null;

/** Coveiro que esta CARREGANDO uma peca (o bit dela ja esta em `modulesLost`). */
export const carrierOf = (state: SurvivalState): Entity | null =>
  state.enemies.find(
    (e) =>
      e.alive &&
      e.archetype === 'undertaker' &&
      (e.mood ?? 0) > 0 &&
      (state.bossRuntime.modulesLost & (1 << (e.mood! - 1))) !== 0,
  ) ?? null;

/** O proximo modulo na ordem fixa que ainda NAO soltou, ou -1. */
export const nextToExpose = (state: SurvivalState): number => {
  for (let m = 0; m < DIAMANDIS_MODULE_COUNT; m++) {
    if ((state.bossRuntime.modulesExposed & (1 << m)) === 0) return m;
  }
  return -1;
};

/** O proximo modulo solto que ainda nao foi arrancado, ou -1. */
export const nextToRip = (state: SurvivalState): number => {
  for (let m = 0; m < DIAMANDIS_MODULE_COUNT; m++) {
    const bit = 1 << m;
    if ((state.bossRuntime.modulesExposed & bit) === 0) continue;
    if ((state.bossRuntime.modulesLost & bit) !== 0) continue;
    return m;
  }
  return -1;
};

/** Por quanto tempo um cenario de rumo segura o chefe parado, em ticks (30 s). */
export const HOLD_TICKS = 600;

/**
 * Para o chefe no lugar por um tempo, de frente para `dir`, pelo MESMO knob do
 * tropeco do arranque (`bossRuntime.staggerUntil`): acao nenhuma, velocidade
 * zero, sem andar nem decidir. E o que deixa os oito quadros serem olhados um a
 * um — e e a prova de que o tropeco de verdade para o chefe.
 */
const hold = (state: SurvivalState, boss: Entity, dir: { x: number; y: number }): void => {
  boss.action = undefined;
  boss.vx = 0;
  boss.vy = 0;
  boss.facing = { ...dir };
  boss.nextActionAt = state.tick + HOLD_TICKS;
  state.bossRuntime.staggerUntil = state.tick + HOLD_TICKS;
  state.bossRuntime.awake = true;
};

/** Uma celula andavel perto de `(x, y)`, a `dist` tiles, em qualquer rumo. */
const openCellNear = (
  state: SurvivalState,
  x: number,
  y: number,
  dist: number,
): { x: number; y: number } | null => {
  const w = state.config.width;
  const h = state.config.height;
  for (const [ux, uy] of [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
    [0.7, 0.7],
    [-0.7, -0.7],
    [0.7, -0.7],
    [-0.7, 0.7],
  ]) {
    const cx = Math.floor(x + ux * dist);
    const cy = Math.floor(y + uy * dist);
    if (cx < 1 || cy < 1 || cx >= w - 1 || cy >= h - 1) continue;
    if (state.solid[cy * w + cx] !== SOLID_NONE) continue;
    return { x: cx, y: cy };
  }
  return null;
};

/** O chassi (raio 0,9) cabe nesta celula? As oito vizinhas tambem abertas. */
const bossFits = (state: SurvivalState, cx: number, cy: number): boolean => {
  const w = state.config.width;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const x = cx + dx;
      const y = cy + dy;
      if (x < 1 || y < 1 || x >= w - 1 || y >= state.config.height - 1) return false;
      if (state.solid[y * w + x] !== SOLID_NONE) return false;
    }
  }
  return true;
};

/** Uma celula a `dist` de `(x, y)` em que o chassi cabe, em qualquer rumo. */
const bossSpotNear = (
  state: SurvivalState,
  x: number,
  y: number,
  dist: number,
): { x: number; y: number } | null => {
  for (const f of Object.values(FACING_BY_DIR)) {
    const len = Math.hypot(f.x, f.y) || 1;
    const cx = Math.floor(x + (f.x / len) * dist);
    const cy = Math.floor(y + (f.y / len) * dist);
    if (bossFits(state, cx, cy)) return { x: cx, y: cy };
  }
  return null;
};

/**
 * O MEIO da arena: o centroide do chao alcancavel a partir do Prospector, e a
 * celula aberta (com folga para o chassi) mais perto dele.
 */
export const arenaCenter = (state: SurvivalState): { x: number; y: number } | null => {
  const w = state.config.width;
  const h = state.config.height;
  const start = Math.floor(state.player.y) * w + Math.floor(state.player.x);
  if (state.solid[start] !== SOLID_NONE) return null;
  const seen = new Uint8Array(w * h);
  const queue = [start];
  seen[start] = 1;
  let sx = 0;
  let sy = 0;
  for (let head = 0; head < queue.length && head < 40000; head++) {
    const cell = queue[head];
    const cx = cell % w;
    const cy = (cell - cx) / w;
    sx += cx;
    sy += cy;
    for (const n of [cell - 1, cell + 1, cell - w, cell + w]) {
      if (n < 0 || n >= w * h || seen[n] || state.solid[n] !== SOLID_NONE) continue;
      const nx = n % w;
      const ny = (n - nx) / w;
      if (nx < 1 || ny < 1 || nx >= w - 1 || ny >= h - 1) continue;
      seen[n] = 1;
      queue.push(n);
    }
  }
  const n = Math.min(queue.length, 40000);
  const mx = sx / n;
  const my = sy / n;
  let best: { x: number; y: number } | null = null;
  let bestD = Infinity;
  for (let i = 0; i < n; i++) {
    const cell = queue[i];
    const cx = cell % w;
    const cy = (cell - cx) / w;
    const d = (cx - mx) ** 2 + (cy - my) ** 2;
    if (d < bestD && bossFits(state, cx, cy)) {
      bestD = d;
      best = { x: cx, y: cy };
    }
  }
  return best;
};

/** Tres tiles para o lado de um rumo: onde o Prospector fica para a broca errar. */
const side3 = (dir: { x: number; y: number }): { x: number; y: number } => ({
  x: -dir.y * 3,
  y: dir.x * 3,
});

/** Quantos tiles de piso andavel ha a partir do chefe no rumo `dir`. */
const freeRun = (state: SurvivalState, boss: Entity, dir: { x: number; y: number }): number => {
  const w = state.config.width;
  for (let d = 1; d <= DIAMANDIS_DRILL_RUN_TILES + 4; d += 0.5) {
    const cx = Math.floor(boss.x + dir.x * d);
    const cy = Math.floor(boss.y + dir.y * d);
    if (cx < 1 || cy < 1 || cx >= w - 1 || cy >= state.config.height - 1) return d - 0.5;
    // Rocha e fragil nao contam: a broca as come. So o que ela nao come
    // (minerio, cristal) e a moldura encurtam a corrida.
    const solid = state.solid[cy * w + cx];
    if (solid !== SOLID_NONE && solid !== SOLID_ROCK && solid !== SOLID_FRAGILE) return d - 0.5;
  }
  return DIAMANDIS_DRILL_RUN_TILES + 4;
};

/**
 * O rumo da broca na arena: o rumo ATUAL do chefe se ele tem sala para a
 * corrida inteira, senao o dos oito com mais sala. Assim os cenarios de
 * rumo (`faceL`...) escolhem a direcao da corrida, e a arena curta nao
 * transforma toda corrida num impacto na moldura.
 */
export const bestDrillDir = (state: SurvivalState, boss: Entity): { x: number; y: number } => {
  const norm = Math.hypot(boss.facing.x, boss.facing.y) || 1;
  const facing = { x: (boss.facing.x || 1) / norm, y: boss.facing.y / norm };
  // Seis tiles bastam para ler o arranque e a aceleracao (e a moldura no fim e um
  // impacto de verdade, que tambem vale ver): so sem isso o rumo troca.
  if (freeRun(state, boss, facing) >= 6) return facing;
  let best = facing;
  let bestRun = -1;
  for (const f of Object.values(FACING_BY_DIR)) {
    const len = Math.hypot(f.x, f.y) || 1;
    const dir = { x: f.x / len, y: f.y / len };
    const run = freeRun(state, boss, dir);
    if (run > bestRun) {
      bestRun = run;
      best = dir;
    }
  }
  return best;
};

/**
 * Poe o Prospector a `dist` tiles no rumo `dir` (ou o mais perto disso em
 * piso andavel) e devolve o rumo unitario chefe -> Prospector.
 */
const placePlayerAlong = (
  state: SurvivalState,
  boss: Entity,
  dir: { x: number; y: number },
  dist: number,
): { x: number; y: number } => {
  const w = state.config.width;
  for (let d = dist; d >= 2; d -= 1) {
    const cx = Math.floor(boss.x + dir.x * d);
    const cy = Math.floor(boss.y + dir.y * d);
    if (cx < 1 || cy < 1 || cx >= w - 1 || cy >= state.config.height - 1) continue;
    if (state.solid[cy * w + cx] !== SOLID_NONE) continue;
    state.player.x = cx + 0.5;
    state.player.y = cy + 0.5;
    break;
  }
  const toward = { x: state.player.x - boss.x, y: state.player.y - boss.y };
  const len = Math.hypot(toward.x, toward.y) || 1;
  return { x: toward.x / len, y: toward.y / len };
};

/**
 * Poe o Prospector a `dist` tiles no rumo atual do chefe (ou o mais perto
 * disso em piso andavel) e devolve o rumo unitario chefe -> Prospector.
 */
const placePlayerAhead = (
  state: SurvivalState,
  boss: Entity,
  dist: number,
): { x: number; y: number } => {
  const fx = boss.facing.x || 1;
  const fy = boss.facing.y || 0;
  const norm = Math.hypot(fx, fy) || 1;
  return placePlayerAlong(state, boss, { x: fx / norm, y: fy / norm }, dist);
};

/**
 * Aplica um cenario a run ativa e devolve os eventos que a simulacao teria
 * emitido — passam pelo mesmo funil dos de verdade (renderer e audio).
 */
export const applyDiamandisScenario = (
  state: SurvivalState,
  scenario: DiamandisScenario,
): SemanticEvent[] => {
  const events: SemanticEvent[] = [];
  const boss = bossOf(state);
  if (!boss) return events;
  const faceDir = FACE_SCENARIO_DIR[scenario];
  if (faceDir) {
    hold(state, boss, FACING_BY_DIR[faceDir]);
    return events;
  }
  switch (scenario) {
    case 'reset': {
      // Tudo de volta ao chassi: os bits, o latch do frenesi, a vida cheia e
      // os Coveiros fora de campo (sem abate: ninguem os matou).
      state.bossRuntime.modulesExposed = 0;
      state.bossRuntime.modulesLost = 0;
      state.bossRuntime.frenzyRipTick = -1;
      state.bossRuntime.frenzyRipCount = 0;
      state.bossRuntime.staggerUntil = 0;
      boss.hp = boss.maxHp;
      for (const e of state.enemies) {
        if (e.alive && e.archetype === 'undertaker') e.alive = false;
      }
      hold(state, boss, FACING_BY_DIR.dr);
      break;
    }
    case 'wake':
      state.bossRuntime.awake = true;
      break;
    case 'beside': {
      // O Prospector ao lado, em piso andavel: o chefe so e desenhado onde ha
      // luz, e o painel nao demonstra nada num chefe no escuro.
      const cell = openCellNear(state, boss.x, boss.y, 3);
      if (cell) {
        state.player.x = cell.x + 0.5;
        state.player.y = cell.y + 0.5;
      }
      break;
    }
    case 'center': {
      // Os dois no MEIO da sala: e de onde a broca tem sala nos oito rumos, e
      // e o que deixa cada diagonal ser conferida de verdade (a entrada fica
      // encostada na moldura, e dali tres rumos nao tem corrida nenhuma). O
      // meio e o centroide do chao alcancavel, e nao o centro do mapa: a
      // arena e um recorte da caverna, onde a caverna estiver.
      const spot = arenaCenter(state);
      if (spot) {
        state.player.x = spot.x + 0.5;
        state.player.y = spot.y + 0.5;
        const near = bossSpotNear(state, spot.x, spot.y, 3);
        if (near) {
          boss.x = near.x + 0.5;
          boss.y = near.y + 0.5;
        }
      }
      boss.vx = 0;
      boss.vy = 0;
      state.bossRuntime.awake = true;
      break;
    }
    case 'exposeNext': {
      // Desce a vida ate logo abaixo do limiar do proximo modulo. A simulacao
      // solta a peca e chama a equipe de resgate no proximo tick — pelo
      // caminho de verdade, com o evento de verdade.
      const m = nextToExpose(state);
      if (m < 0) break;
      const target = DIAMANDIS_MODULE_EXPOSE_AT[m] * boss.maxHp - 1;
      if (boss.hp > target) damageEntity(state, boss, boss.hp - target, events);
      state.bossRuntime.awake = true;
      break;
    }
    case 'ripNext': {
      // Um Coveiro CARREGADOR: nasce ao lado, reivindica o modulo e arranca
      // agora. A partir daqui a simulacao o leva para a borda — e o painel
      // mostra a peca pendurada no eletroima dele.
      let m = nextToRip(state);
      if (m < 0) {
        // Nada solto: solta o proximo primeiro, sem esperar o tick.
        m = nextToExpose(state);
        if (m < 0) break;
        state.bossRuntime.modulesExposed |= 1 << m;
        events.push({ t: 'boss_module', x: boss.x, y: boss.y, module: m, state: 'exposed' });
      }
      const cell = openCellNear(state, boss.x, boss.y, 1.5) ?? {
        x: Math.floor(boss.x),
        y: Math.floor(boss.y),
      };
      const carrier = spawnEnemy(state, 'undertaker', cell.x, cell.y, false);
      carrier.mood = m + 1;
      ripDiamandisModule(state, m, carrier, events);
      break;
    }
    case 'killCarrier': {
      const carrier = carrierOf(state);
      if (!carrier) break;
      damageEntity(state, carrier, carrier.hp + 1, events);
      break;
    }
    case 'frenzyMax': {
      // Arranca tudo o que falta, sem carregador: e o frenesi no teto, para
      // ver o reator, os espasmos, a fumaca e o maquinario que sobrou (nenhum).
      for (let m = 0; m < DIAMANDIS_MODULE_COUNT; m++) {
        const bit = 1 << m;
        if ((state.bossRuntime.modulesLost & bit) !== 0) continue;
        if ((state.bossRuntime.modulesExposed & bit) === 0) {
          state.bossRuntime.modulesExposed |= bit;
          events.push({ t: 'boss_module', x: boss.x, y: boss.y, module: m, state: 'exposed' });
        }
        ripDiamandisModule(state, m, boss, events);
      }
      break;
    }
    case 'reactor':
      state.bossRuntime.phasesFired |= BOSS_PHASE_REACTOR;
      break;
    case 'beam': {
      // O FEIXE DE PROSPECCAO pelo caminho de verdade (`startAction`): o
      // Prospector vai para a linha, a seis tiles no rumo atual do chefe (ou
      // o mais perto disso em piso andavel), e o chefe comeca o levantamento
      // apontando para ele. Os eventos (`action_start`, `boss_windup`) saem
      // daqui como sairiam da simulacao; o resto — as varreduras, o release,
      // a cicatriz — a simulacao faz sozinha nos ticks seguintes.
      const aim = placePlayerAhead(state, boss, 6);
      state.bossRuntime.staggerUntil = 0;
      state.bossRuntime.awake = true;
      boss.beamReadyAt = state.tick + DIAMANDIS_BEAM_COOLDOWN_TICKS;
      startAction(
        state,
        boss,
        'beam',
        aim,
        DIAMANDIS_BEAM_WINDUP_TICKS,
        10,
        events,
        state.player.id,
      );
      break;
    }
    case 'demolish': {
      // A SALVA DE DEMOLICAO pelo caminho de verdade: o Prospector a sete
      // tiles (dentro da faixa 4..13), o chefe arma e as tres marcas nascem
      // agora (`markDemolition`), com a antecipacao de um alvo parado — o
      // proprio lugar dele. As cargas voam, pousam e detonam nos ticks
      // seguintes, pela simulacao.
      const aim = placePlayerAhead(state, boss, 7);
      state.bossRuntime.staggerUntil = 0;
      state.bossRuntime.awake = true;
      boss.rangedReadyAt = state.tick + DIAMANDIS_DEMOLISH_COOLDOWN_TICKS;
      startAction(
        state,
        boss,
        'demolish',
        aim,
        DIAMANDIS_DEMOLISH_WINDUP_TICKS,
        8,
        events,
        state.player.id,
      );
      markDemolition(
        state,
        boss,
        state.player,
        state.tick + DIAMANDIS_DEMOLISH_WINDUP_TICKS,
        events,
      );
      break;
    }
    case 'drill':
    case 'drillWall':
    case 'drillMiss': {
      // A BROCA pelo caminho de verdade: o Prospector a doze tiles (dentro da
      // faixa 9..20) no rumo com mais sala (o rumo atual, se ele couber), o
      // chefi alinha e gira 1,8 s parado e depois atravessa a arena — tudo
      // pela simulacao, nos ticks seguintes. `drillWall` poe um veio de
      // MINERIO no meio do caminho (o que a broca nao come: impacto);
      // `drillMiss` tira o Prospector da linha depois de mirar (a corrida
      // passa reto e derrapa).
      const dir = bestDrillDir(state, boss);
      const aim = placePlayerAlong(state, boss, dir, 12);
      state.bossRuntime.staggerUntil = 0;
      state.bossRuntime.awake = true;
      boss.nextActionAt = state.tick + DIAMANDIS_DRILL_COOLDOWN_TICKS;
      startAction(
        state,
        boss,
        'drill',
        aim,
        DIAMANDIS_DRILL_WINDUP_TICKS,
        DIAMANDIS_DRILL_TICKS,
        events,
        state.player.id,
      );
      if (scenario === 'drillWall') {
        const w = state.config.width;
        const side = { x: -aim.y, y: aim.x };
        for (let lane = -3; lane <= 3; lane++) {
          const cx = Math.floor(boss.x + aim.x * 7 + side.x * lane);
          const cy = Math.floor(boss.y + aim.y * 7 + side.y * lane);
          if (cx < 1 || cy < 1 || cx >= w - 1 || cy >= state.config.height - 1) continue;
          state.solid[cy * w + cx] = SOLID_ORE;
        }
        // O Prospector fica do lado de la do veio, fora do caminho da broca.
        state.player.x += side.x * 3;
        state.player.y += side.y * 3;
      } else if (scenario === 'drillMiss') {
        state.player.x += side3(aim).x;
        state.player.y += side3(aim).y;
      }
      break;
    }
    default:
      break;
  }
  return events;
};

const beamReadout = (state: SurvivalState, boss: Entity): DiamandisReadout['beam'] => {
  const phase = beamPhaseAt(boss.action, state.tick);
  if (!phase || !boss.action) return null;
  const reach = beamReach(state, boss.x, boss.y, boss.action.direction.x, boss.action.direction.y);
  return {
    phase: phase.kind,
    progress: phase.progress,
    reach: Math.min(reach, DIAMANDIS_BEAM_LENGTH),
  };
};

export type DiamandisPartReadout = {
  name: string;
  state: 'mounted' | 'loose' | 'gone';
  /** Id do Coveiro que esta carregando esta peca, se houver. */
  carrier: number | null;
};

export type DiamandisReadout = {
  hpFraction: number;
  facing: string;
  parts: DiamandisPartReadout[];
  nextExposeAt: number | null;
  stacks: number;
  multiplier: number;
  cap: number;
  /** Ticks que faltam do tropeco (`staggerUntil`), ou 0. */
  staggerLeft: number;
  staggerTicks: number;
  undertakers: number;
  carriers: number;
  reactor: boolean;
  awake: boolean;
  /** O feixe em curso: ato e fracao, ou nulo. */
  beam: { phase: 'survey' | 'fire'; progress: number; reach: number } | null;
  /** Cargas de demolicao marcadas (em voo ou no chao). */
  charges: number;
  /** A broca em curso: estagio, giro (0..1) e velocidade (0..1), ou nulo. */
  drill: { stage: string; spin: number; speed: number; impacted: boolean } | null;
};

const drillReadout = (state: SurvivalState, boss: Entity): DiamandisReadout['drill'] => {
  const action = boss.action;
  if (!action || action.kind !== 'drill') return null;
  const impactAt = state.bossRuntime.drillImpactAt;
  const impacted = impactAt >= action.releaseAt && state.tick >= impactAt;
  return {
    stage: impacted ? 'impact' : (drillStageAt(action, state.tick) ?? 'align'),
    spin: drillSpinAt(action, state.tick, impacted ? impactAt : -1),
    speed:
      state.tick >= action.releaseAt && !impacted
        ? drillSpeedFractionAt(state.tick - action.releaseAt)
        : 0,
    impacted,
  };
};

export const diamandisReadout = (state: SurvivalState): DiamandisReadout | null => {
  const boss = bossOf(state);
  if (!boss) return null;
  const runtime = state.bossRuntime;
  const parts: DiamandisPartReadout[] = [];
  for (let m = 0; m < DIAMANDIS_MODULE_COUNT; m++) {
    const carrier = state.enemies.find(
      (e) => e.alive && e.archetype === 'undertaker' && e.mood === m + 1,
    );
    parts.push({
      name: DIAMANDIS_PART_NAMES[m] ?? String(m),
      state: diamandisPartState(m, runtime.modulesExposed, runtime.modulesLost),
      carrier: carrier && (runtime.modulesLost & (1 << m)) !== 0 ? carrier.id : null,
    });
  }
  const next = nextToExpose(state);
  let undertakers = 0;
  let carriers = 0;
  for (const e of state.enemies) {
    if (!e.alive || e.archetype !== 'undertaker') continue;
    undertakers++;
    if ((e.mood ?? 0) > 0 && (runtime.modulesLost & (1 << (e.mood! - 1))) !== 0) carriers++;
  }
  // O tropeco de verdade dura 10 ticks; um cenario de rumo segura por 600 — a
  // leitura mostra os dois pelo mesmo numero, porque e o mesmo knob.
  const staggerLeft = Math.max(0, runtime.staggerUntil - state.tick);
  return {
    hpFraction: boss.hp / boss.maxHp,
    facing: dirFromFacing8(boss.facing.x, boss.facing.y),
    parts,
    nextExposeAt: next >= 0 ? DIAMANDIS_MODULE_EXPOSE_AT[next] : null,
    stacks: diamandisFrenzyStacks(state),
    multiplier: diamandisFrenzyMultiplier(state),
    cap: DIAMANDIS_FRENZY_CAP,
    staggerLeft,
    staggerTicks: DIAMANDIS_RIP_STAGGER_TICKS,
    undertakers,
    carriers,
    reactor: (runtime.phasesFired & BOSS_PHASE_REACTOR) !== 0,
    awake: runtime.awake,
    beam: beamReadout(state, boss),
    charges: runtime.blastCells.length,
    drill: drillReadout(state, boss),
  };
};
