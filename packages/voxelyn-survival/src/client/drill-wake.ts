// O RASGO DE AR da broca do Diamandis: o avanco visto como avanco.
//
// A simulacao para o chefe por 1,8 s girando a broca e depois o atravessa a
// arena a 7,5 tiles/s por 2,3 s, comendo parede. O cliente mostrava a broca
// girando e o corpo deslizando: nada dizia que aquilo era uma INVESTIDA. O que
// falta e o ar — a coisa que uma ponta de aco a essa velocidade empurra.
//
// Dois atos:
//
//   PREPARO   uma FAIXA no chao, da largura da broca, do chefe ate onde o
//             avanco chega, com setas apontando o rumo: e o corredor que vai
//             ser aberto. Nasce apagada e fecha ate travar em fogo — a mesma
//             linguagem da linha de medicao do feixe, para a mesma pergunta
//             ("quanto falta").
//   AVANCO    na ponta da broca, o ar e RASGADO: uma onda CONICA nasce no
//             vertice e abre para tras ao longo do corpo, chevron atras de
//             chevron, cada um mais largo e mais apagado que o anterior — o
//             ar jogado para os lados e para tras. Riscos de velocidade
//             correm pelas laterais, a ponta incandesce, e a poeira (nas
//             particulas) e cuspida no mesmo cone. Tudo se move PARA TRAS em
//             relacao ao chefe: e isso que le como "ele vem".
//
// Tudo e derivado da acao autoritativa (`enemy.action`) e do relogio de
// parede: nada guarda estado, e quem reconecta no meio do avanco ve o mesmo
// cone. Com movimento reduzido os chevrons nao correm (ficam na posicao
// media) e os riscos somem; a faixa e a ponta acesa continuam.
import type { EntityAction } from '@voxelyn/survival-sim';
import {
  DIAMANDIS_DRILL_SPEED,
  DIAMANDIS_DRILL_TICKS,
  DIAMANDIS_DRILL_WIDTH,
  TICK_HZ,
} from '@voxelyn/survival-sim';
import { drawEmissiveHalo } from './emissive-halo';
import { PAL } from './palette';

export type Vec = { x: number; y: number };
export type ToScreen = (x: number, y: number) => [number, number];

export type DrillPhase = { kind: 'windup' | 'advance'; progress: number } | null;

/** Em que ato a broca esta neste tick, e quanto dele ja passou (0..1). */
export const drillPhaseAt = (action: EntityAction | undefined, tick: number): DrillPhase => {
  if (!action || action.kind !== 'drill') return null;
  if (tick < action.releaseAt) {
    const span = Math.max(1, action.releaseAt - action.startedAt);
    return { kind: 'windup', progress: Math.max(0, Math.min(1, (tick - action.startedAt) / span)) };
  }
  const span = Math.max(1, action.endsAt - action.releaseAt);
  return { kind: 'advance', progress: Math.max(0, Math.min(1, (tick - action.releaseAt) / span)) };
};

/** Quanto o avanco percorre, em tiles: velocidade x duracao da acao. */
export const DRILL_RUN_TILES = (DIAMANDIS_DRILL_SPEED * DIAMANDIS_DRILL_TICKS) / TICK_HZ;
/** Meia largura do corredor aberto, em tiles (a broca abre `2w + 1` celulas). */
export const DRILL_LANE_HALF = DIAMANDIS_DRILL_WIDTH + 0.5;
/** Onde a PONTA da broca fica a frente do centro do chefe, em tiles. */
export const DRILL_TIP_AHEAD = 1.6;
/** Altura da ponta acima do chao, em tiles: o eixo da broca. */
export const DRILL_TIP_HEIGHT = 0.45;

/**
 * Ate onde a faixa VAI, em tiles: o avanco inteiro, parando na borda do mapa.
 * Parede nao para (a broca a come); a borda, sim — e uma faixa desenhada para
 * fora da sala prometeria um corredor que nao existe.
 */
export const drillLaneReach = (
  state: { config: { width: number; height: number } },
  origin: Vec,
  dir: Vec,
): number => {
  const w = state.config.width;
  const h = state.config.height;
  for (let d = 0.5; d <= DRILL_RUN_TILES; d += 0.5) {
    const cx = Math.floor(origin.x + dir.x * d);
    const cy = Math.floor(origin.y + dir.y * d);
    if (cx < 1 || cy < 1 || cx >= w - 1 || cy >= h - 1) return Math.max(0, d - 0.5);
  }
  return DRILL_RUN_TILES;
};

/** A partir de que fracao do preparo a faixa "trava" (fogo, tracejado fechado). */
export const LANE_LOCK_AT = 0.7;

export type LaneStyle = { color: string; alpha: number; dash: [number, number]; locked: boolean };

/** Como a faixa se veste conforme o preparo avanca — monotona, como a do feixe. */
export const laneStyle = (progress: number): LaneStyle => {
  const p = Math.max(0, Math.min(1, progress));
  const locked = p >= LANE_LOCK_AT;
  return {
    color: locked ? PAL.fire : PAL.loot,
    alpha: 0.28 + 0.5 * p,
    dash: [5 + 7 * p, Math.max(1.5, 7 - 6 * p)],
    locked,
  };
};

// ---------------------------------------------------------------------------
// A onda conica
// ---------------------------------------------------------------------------

/** Intervalo entre um chevron e o seguinte, em ms. */
export const CHEVRON_EVERY_MS = 70;
/** Quanto cada chevron vive, viajando para tras. */
export const CHEVRON_LIFE_MS = 380;
/** Quantos chevrons existem ao mesmo tempo. */
export const CHEVRON_COUNT = Math.ceil(CHEVRON_LIFE_MS / CHEVRON_EVERY_MS);
/** Ate onde a onda vai para tras, em tiles, e quanto abre no fim. */
export const CHEVRON_REACH_TILES = 3.2;
export const CHEVRON_SPREAD_TILES = 2.0;

export type Chevron = {
  /** 0 = acabou de nascer na ponta, 1 = dissolvendo atras do corpo. */
  age: number;
  /** Distancia atras da ponta, em tiles (o vertice do chevron). */
  back: number;
  /** Meia abertura das asas, em tiles. */
  halfWidth: number;
  alpha: number;
};

/**
 * Os chevrons vivos neste instante. Determinista pelo relogio: um chevron
 * nasce a cada `CHEVRON_EVERY_MS` e viaja para tras enquanto abre — o cone.
 * Com movimento reduzido todos ficam na posicao media, parados: o cone existe,
 * mas nao corre.
 */
export const chevronsAt = (nowMs: number, reducedMotion: boolean): Chevron[] => {
  const out: Chevron[] = [];
  const slot = Math.floor(nowMs / CHEVRON_EVERY_MS);
  for (let k = 0; k < CHEVRON_COUNT; k++) {
    const born = (slot - k) * CHEVRON_EVERY_MS;
    const age = reducedMotion
      ? (k + 0.5) / CHEVRON_COUNT
      : Math.max(0, Math.min(1, (nowMs - born) / CHEVRON_LIFE_MS));
    if (age >= 1) continue;
    const ease = 1 - (1 - age) * (1 - age);
    out.push({
      age,
      back: ease * CHEVRON_REACH_TILES,
      halfWidth: 0.22 + ease * CHEVRON_SPREAD_TILES,
      alpha: (1 - age) * (0.35 + 0.65 * (1 - age)),
    });
  }
  return out;
};

/** Quantos riscos de velocidade correm pelas laterais. */
export const STREAK_COUNT = 6;

export type Streak = {
  /** Lado: -1 ou +1. */
  side: number;
  /** Distancia lateral da ponta, em tiles. */
  offset: number;
  /** Onde comeca atras da ponta e quanto mede, em tiles. */
  back: number;
  length: number;
  alpha: number;
};

/**
 * Os riscos de velocidade: linhas finas que correm para tras pelas laterais
 * do cone, cada uma com a propria fase. Nenhum com movimento reduzido.
 */
export const streaksAt = (nowMs: number, reducedMotion: boolean): Streak[] => {
  if (reducedMotion) return [];
  const out: Streak[] = [];
  for (let i = 0; i < STREAK_COUNT; i++) {
    const period = 210 + (i % 3) * 40;
    const phase = ((nowMs + i * 97) % period) / period;
    const side = i % 2 === 0 ? -1 : 1;
    const lane = 0.35 + ((i * 7) % 5) * 0.16;
    out.push({
      side,
      offset: lane + phase * 0.5,
      back: 0.2 + phase * 1.8,
      length: 0.5 + 0.4 * (1 - phase),
      alpha: (1 - phase) * 0.7,
    });
  }
  return out;
};

// ---------------------------------------------------------------------------
// Desenho
// ---------------------------------------------------------------------------

/**
 * A FAIXA do preparo no chao: as duas bordas tracejadas do corredor, setas no
 * rumo a cada tres tiles e a ponta acesa. `length` e ate onde o avanco vai.
 */
export const drawDrillLane = (
  ctx: CanvasRenderingContext2D,
  toScreen: ToScreen,
  origin: Vec,
  dir: Vec,
  length: number,
  progress: number,
  z: number,
  nowMs: number,
  reducedMotion: boolean,
): void => {
  const style = laneStyle(progress);
  const side = { x: -dir.y, y: dir.x };
  const edge = (s: number): [[number, number], [number, number]] => [
    toScreen(origin.x + side.x * s * DRILL_LANE_HALF, origin.y + side.y * s * DRILL_LANE_HALF),
    toScreen(
      origin.x + dir.x * length + side.x * s * DRILL_LANE_HALF,
      origin.y + dir.y * length + side.y * s * DRILL_LANE_HALF,
    ),
  ];
  ctx.save();
  ctx.strokeStyle = style.color;
  ctx.globalAlpha = style.alpha;
  ctx.lineWidth = Math.max(1, (style.locked ? 1.5 : 1) * z);
  ctx.setLineDash([style.dash[0] * z, style.dash[1] * z]);
  // O tracejado CORRE no rumo do avanco: a faixa diz para onde, nao so onde.
  ctx.lineDashOffset = reducedMotion ? 0 : -((nowMs / 30) % 400) * z;
  for (const s of [-1, 1]) {
    const [a, b] = edge(s);
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(b[0], b[1]);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  // As SETAS: um chevron aberto para a frente a cada tres tiles.
  ctx.globalAlpha = style.alpha * 0.9;
  ctx.lineWidth = Math.max(1, 1.2 * z);
  for (let d = 2.5; d < length - 0.5; d += 3) {
    const tip = toScreen(origin.x + dir.x * d, origin.y + dir.y * d);
    const l = toScreen(
      origin.x + dir.x * (d - 0.7) + side.x * 0.55,
      origin.y + dir.y * (d - 0.7) + side.y * 0.55,
    );
    const r = toScreen(
      origin.x + dir.x * (d - 0.7) - side.x * 0.55,
      origin.y + dir.y * (d - 0.7) - side.y * 0.55,
    );
    ctx.beginPath();
    ctx.moveTo(l[0], l[1]);
    ctx.lineTo(tip[0], tip[1]);
    ctx.lineTo(r[0], r[1]);
    ctx.stroke();
  }
  ctx.restore();
};

/**
 * O RASGO na ponta: os chevrons abrindo para tras, os riscos nas laterais e a
 * ponta incandescente. `tip` e a ponta da broca no mundo; `liftPx` a altura
 * dela na tela; `intensity` 0..1 (o avanco esfria no ultimo trecho).
 */
export const drawDrillWake = (
  ctx: CanvasRenderingContext2D,
  toScreen: ToScreen,
  tip: Vec,
  dir: Vec,
  liftPx: number,
  intensity: number,
  z: number,
  nowMs: number,
  reducedMotion: boolean,
): void => {
  const k = Math.max(0, Math.min(1, intensity));
  if (k <= 0.01) return;
  const side = { x: -dir.y, y: dir.x };
  const at = (back: number, lateral: number): [number, number] => {
    const [sx, sy] = toScreen(
      tip.x - dir.x * back + side.x * lateral,
      tip.y - dir.y * back + side.y * lateral,
    );
    return [sx, sy - liftPx];
  };
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  // O VOLUME do cone: uma cunha translucida da ponta para tras, o ar
  // deslocado como massa. E o que os chevrons riscam por cima.
  {
    const apex = at(-0.15, 0);
    const l = at(CHEVRON_REACH_TILES + 0.6, -(0.22 + CHEVRON_SPREAD_TILES));
    const r = at(CHEVRON_REACH_TILES + 0.6, 0.22 + CHEVRON_SPREAD_TILES);
    const grad = ctx.createLinearGradient(apex[0], apex[1], (l[0] + r[0]) / 2, (l[1] + r[1]) / 2);
    grad.addColorStop(0, `rgba(232,241,255,${(0.22 * k).toFixed(3)})`);
    grad.addColorStop(1, 'rgba(123,139,163,0)');
    ctx.globalAlpha = 1;
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(apex[0], apex[1]);
    ctx.lineTo(l[0], l[1]);
    ctx.lineTo(r[0], r[1]);
    ctx.closePath();
    ctx.fill();
  }
  // OS CHEVRONS: o vertice na frente, as asas abrindo para tras — a onda
  // conica que a ponta empurra para os lados.
  for (const c of chevronsAt(nowMs, reducedMotion)) {
    const apex = at(c.back, 0);
    const wingBack = c.back + 0.55 + c.halfWidth * 0.35;
    const l = at(wingBack, -c.halfWidth);
    const r = at(wingBack, c.halfWidth);
    ctx.globalAlpha = c.alpha * k;
    ctx.strokeStyle = c.age < 0.35 ? PAL.player : PAL.mist;
    ctx.lineWidth = Math.max(1, (3.4 - 2.2 * c.age) * z);
    ctx.beginPath();
    ctx.moveTo(l[0], l[1]);
    ctx.lineTo(apex[0], apex[1]);
    ctx.lineTo(r[0], r[1]);
    ctx.stroke();
  }
  // OS RISCOS de velocidade pelas laterais.
  ctx.strokeStyle = PAL.player;
  ctx.lineWidth = Math.max(1, z);
  for (const s of streaksAt(nowMs, reducedMotion)) {
    const a = at(s.back, s.side * s.offset);
    const b = at(s.back + s.length, s.side * (s.offset + 0.12));
    ctx.globalAlpha = s.alpha * k;
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(b[0], b[1]);
    ctx.stroke();
  }
  ctx.restore();
  // A PONTA incandescente, girando: um halo quente e uma faisca que corre em
  // volta do eixo.
  const [tx, ty] = at(0, 0);
  drawEmissiveHalo(ctx, PAL.fire, tx, ty, 14 * z * k, 0.8 * k);
  drawEmissiveHalo(ctx, PAL.loot, tx, ty, 7 * z, 0.9 * k);
  if (!reducedMotion) {
    const spin = (nowMs / 60) % (Math.PI * 2);
    ctx.save();
    ctx.globalAlpha = 0.9 * k;
    ctx.fillStyle = PAL.player;
    const s = Math.max(2, 2 * z);
    ctx.fillRect(tx + Math.cos(spin) * 4 * z - s / 2, ty + Math.sin(spin) * 2 * z - s / 2, s, s);
    ctx.restore();
  }
};
