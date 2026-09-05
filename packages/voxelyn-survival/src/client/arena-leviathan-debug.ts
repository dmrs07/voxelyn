// O PAINEL DO LEVIATA na arena de teste: cenarios que POEM o encontro em cada
// postura do ciclo e a leitura exata do que a simulacao decide — a postura,
// a janela de dano, as celulas tampadas, a Sondagem marcada, o destino da
// viagem e o predicado da bolha.
//
// Nada disto e importado por `main.ts`: a arena e a porta, e a unica. Os
// cenarios escrevem no estado AUTORITATIVO pelo mesmo caminho que um teste de
// chefe escreve (humor, acao, relogios do `bossRuntime`), e a simulacao segue
// dali — o que se ve depois e o que o jogo faria.
import {
  BOSS_PHASE_DELUGE,
  DELUGE_HP_FRACTION,
  LEVIATHAN_ANCHORED,
  LEVIATHAN_DIVE_TELEGRAPH_TICKS,
  LEVIATHAN_DIVE_TICKS,
  LEVIATHAN_EMERGE_HALO_TICKS,
  LEVIATHAN_EMERGE_TICKS,
  LEVIATHAN_EMERGING,
  LEVIATHAN_HIDDEN,
  LEVIATHAN_HUNTING,
  LEVIATHAN_DIVING,
  PLAYER_RADIUS,
  SOLID_NONE,
  SURF_DEEP_WATER,
  SURF_NONE,
  SURF_WATER,
  insideAnyBubble,
  leviathanExposure,
  leviathanLidCells,
  leviathanPosture,
  nearestPoolCore,
  playerProtectedByBubble,
} from '@voxelyn/survival-sim';
import type { Entity, SurvivalState } from '@voxelyn/survival-sim';

export type LeviathanScenario =
  | 'anchor'
  | 'faceN'
  | 'faceE'
  | 'faceS'
  | 'faceW'
  | 'probeDry'
  | 'probeDeepen'
  | 'standOnLid'
  | 'dive'
  | 'hidden'
  | 'emerge'
  | 'deluge'
  | 'hunting'
  | 'charge'
  | 'bubbleIn'
  | 'bubbleEdge'
  | 'bubbleOut';

/** Os cenarios, na ordem do painel. Os rotulos vivem em `arena-main.ts`. */
export const LEVIATHAN_SCENARIOS: readonly LeviathanScenario[] = [
  'anchor',
  'faceN',
  'faceE',
  'faceS',
  'faceW',
  'probeDry',
  'probeDeepen',
  'standOnLid',
  'dive',
  'hidden',
  'emerge',
  'deluge',
  'hunting',
  'charge',
  'bubbleIn',
  'bubbleEdge',
  'bubbleOut',
];

const bossOf = (state: SurvivalState): Entity | null =>
  state.enemies.find((e) => e.alive && e.archetype === 'sheet_leviathan') ?? null;

/** Limpa acao e relogios da primeira fase: o proximo tick parte do zero. */
const settle = (state: SurvivalState, boss: Entity): void => {
  boss.action = undefined;
  boss.vx = 0;
  boss.vy = 0;
  boss.nextActionAt = 0;
  state.bossRuntime.leviathanProbeCell = -1;
  state.bossRuntime.leviathanProbeDeepen = false;
  state.bossRuntime.leviathanDest = -1;
  state.bossRuntime.leviathanSurfaceAt = -1;
  state.bossRuntime.awake = true;
};

/** Poe o chefe sobre o nucleo ocupavel mais proximo, ancorado. */
const anchor = (state: SurvivalState, boss: Entity): void => {
  const w = state.config.width;
  const core = nearestPoolCore(state, Math.floor(boss.x), Math.floor(boss.y), 12);
  if (core >= 0) {
    boss.x = (core % w) + 0.5;
    boss.y = Math.floor(core / w) + 0.5;
  }
  boss.mood = LEVIATHAN_ANCHORED;
  state.bossRuntime.leviathanAnchorProbes = 0;
  settle(state, boss);
};

/** Pinta uma poca rasa em volta do jogador: o proximo golpe sera um aprofundamento. */
const puddleUnderPlayer = (state: SurvivalState): void => {
  const w = state.config.width;
  const px = Math.floor(state.player.x);
  const py = Math.floor(state.player.y);
  for (let y = py - 2; y <= py + 2; y++) {
    for (let x = px - 2; x <= px + 2; x++) {
      const i = y * w + x;
      if (i < 0 || i >= state.surface.length || state.solid[i] !== SOLID_NONE) continue;
      if (state.surface[i] === SURF_NONE) state.surface[i] = SURF_WATER;
    }
  }
};

/** Alaga a sala INTEIRA no passado: a segunda fase, pronta. */
const flood = (state: SurvivalState, boss: Entity): void => {
  state.bossRuntime.phasesFired |= BOSS_PHASE_DELUGE;
  state.bossRuntime.delugeAt = Math.max(0, state.tick - 400);
  state.bossRuntime.delugeX = boss.x;
  state.bossRuntime.delugeY = boss.y;
  state.delugeFieldBucket = -1;
};

/** Aplica um cenario ao estado autoritativo. */
export const applyLeviathanScenario = (state: SurvivalState, scenario: LeviathanScenario): void => {
  const boss = bossOf(state);
  if (!boss) return;
  const face = (x: number, y: number): void => {
    boss.facing = { x, y };
  };
  switch (scenario) {
    case 'anchor':
      anchor(state, boss);
      break;
    case 'faceN':
      face(0, -1);
      break;
    case 'faceE':
      face(1, 0);
      break;
    case 'faceS':
      face(0, 1);
      break;
    case 'faceW':
      face(-1, 0);
      break;
    case 'probeDry':
      // Ancorado, sem golpes gastos neste ancoradouro e com o relogio zerado:
      // o proximo tick sonda a celula prevista do Prospector.
      anchor(state, boss);
      state.bossRuntime.leviathanAnchorProbes = 0;
      break;
    case 'probeDeepen':
      anchor(state, boss);
      puddleUnderPlayer(state);
      state.bossRuntime.leviathanAnchorProbes = 0;
      break;
    case 'standOnLid':
      // O Prospector de pe SOBRE o corpo, na celula profunda tampada: nao cai.
      anchor(state, boss);
      state.player.x = boss.x;
      state.player.y = boss.y;
      break;
    case 'dive': {
      // O mergulho com um destino valido: o proximo tick telegrafa e afunda.
      anchor(state, boss);
      state.bossRuntime.leviathanAnchorProbes = 99;
      break;
    }
    case 'hidden': {
      // Viajando: a posicao ja e a do destino, nada dele se ve.
      const w = state.config.width;
      settle(state, boss);
      boss.mood = LEVIATHAN_HIDDEN;
      const here = Math.floor(boss.y) * w + Math.floor(boss.x);
      let dest = -1;
      for (let r = 5; r <= 14 && dest < 0; r++) {
        for (let dy = -r; dy <= r && dest < 0; dy++) {
          for (let dx = -r; dx <= r; dx++) {
            if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
            const x = Math.floor(boss.x) + dx;
            const y = Math.floor(boss.y) + dy;
            const i = y * w + x;
            if (i < 0 || i >= state.surface.length || i === here) continue;
            if (state.surface[i] !== SURF_DEEP_WATER) continue;
            const core = nearestPoolCore(state, x, y, 0);
            if (core >= 0) {
              dest = core;
              break;
            }
          }
        }
      }
      if (dest < 0) dest = here;
      state.bossRuntime.leviathanDest = dest;
      boss.x = (dest % w) + 0.5;
      boss.y = Math.floor(dest / w) + 0.5;
      state.bossRuntime.leviathanSurfaceAt = state.tick + 60;
      break;
    }
    case 'emerge':
      settle(state, boss);
      boss.mood = LEVIATHAN_EMERGING;
      boss.action = {
        kind: 'emerge',
        phase: 'windup',
        startedAt: state.tick,
        releaseAt: state.tick + LEVIATHAN_EMERGE_HALO_TICKS,
        endsAt: state.tick + LEVIATHAN_EMERGE_HALO_TICKS + LEVIATHAN_EMERGE_TICKS,
        direction: { ...boss.facing },
      };
      break;
    case 'deluge':
      // Cruza o limiar: a simulacao cancela a Sondagem, mergulha, sobe o
      // lencol e emerge inteira — o ciclo todo, de verdade.
      anchor(state, boss);
      boss.hp = Math.floor(boss.maxHp * (DELUGE_HP_FRACTION - 0.05));
      break;
    case 'hunting':
      settle(state, boss);
      flood(state, boss);
      boss.mood = LEVIATHAN_HUNTING;
      state.bossRuntime.leviathanShockRecoverAt = state.tick + 10_000;
      break;
    case 'charge':
      // Cacando, sala cheia e recarga pronta: o proximo tick carrega a
      // descarga e as duas bolhas nascem.
      settle(state, boss);
      flood(state, boss);
      boss.mood = LEVIATHAN_HUNTING;
      state.bossRuntime.leviathanShockAt = -1;
      state.bossRuntime.leviathanShockRecoverAt = 0;
      state.bossRuntime.protectiveBubbles = [];
      break;
    case 'bubbleIn':
    case 'bubbleEdge':
    case 'bubbleOut': {
      const bubble = state.bossRuntime.protectiveBubbles[0];
      if (!bubble) break;
      const offset =
        scenario === 'bubbleIn'
          ? 0
          : scenario === 'bubbleEdge'
            ? bubble.radius
            : bubble.radius + 0.35;
      state.player.x = bubble.x + offset;
      state.player.y = bubble.y;
      state.player.vx = 0;
      state.player.vy = 0;
      break;
    }
    default:
      break;
  }
};

export type LeviathanReadout = {
  posture: string;
  exposure: number;
  targetable: boolean;
  lidCells: number;
  probeCell: number;
  probeDeepen: boolean;
  probeSeq: number;
  anchorProbes: number;
  pools: number;
  dest: number;
  surfaceIn: number | null;
  shockIn: number | null;
  bubbles: number;
  insideBubble: boolean;
  /** Distancia do CENTRO do Prospector a bolha mais proxima, menos o raio seguro. */
  bubbleMargin: number | null;
  deluged: boolean;
};

export const leviathanReadout = (state: SurvivalState): LeviathanReadout | null => {
  const boss = bossOf(state);
  if (!boss) return null;
  const runtime = state.bossRuntime;
  const exposure = leviathanExposure(boss, state.tick);
  let margin: number | null = null;
  for (const bubble of runtime.protectiveBubbles) {
    const m = Math.hypot(state.player.x - bubble.x, state.player.y - bubble.y) - bubble.radius;
    if (margin === null || m < margin) margin = m;
  }
  return {
    posture: leviathanPosture(boss),
    exposure,
    targetable: exposure >= 0.5,
    lidCells:
      boss.mood === LEVIATHAN_ANCHORED || boss.mood === LEVIATHAN_DIVING
        ? leviathanLidCells(state, boss).length
        : 0,
    probeCell: runtime.leviathanProbeCell,
    probeDeepen: runtime.leviathanProbeDeepen,
    probeSeq: runtime.leviathanProbeSeq,
    anchorProbes: runtime.leviathanAnchorProbes,
    pools: runtime.leviathanPools.length,
    dest: runtime.leviathanDest,
    surfaceIn: runtime.leviathanSurfaceAt >= 0 ? runtime.leviathanSurfaceAt - state.tick : null,
    shockIn: runtime.leviathanShockAt >= 0 ? runtime.leviathanShockAt - state.tick : null,
    bubbles: runtime.protectiveBubbles.length,
    insideBubble: insideAnyBubble(state.player.x, state.player.y, runtime.protectiveBubbles),
    bubbleMargin: margin,
    deluged: (runtime.phasesFired & BOSS_PHASE_DELUGE) !== 0,
  };
};

/** Reexportado para o painel dizer, ao lado do numero, qual predicado decide. */
export const bubblePredicate = playerProtectedByBubble;
export const PROSPECTOR_BODY_RADIUS = PLAYER_RADIUS;
export { LEVIATHAN_DIVE_TELEGRAPH_TICKS, LEVIATHAN_DIVE_TICKS };
