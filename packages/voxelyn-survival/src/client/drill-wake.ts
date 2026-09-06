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
//   AVANCO    na ponta da broca, o ar e RASGADO: uma ONDA DE PROA nasce na
//             ponta e abre para tras ao longo do corpo, com a largura
//             crescendo pela raiz da distancia, em lencois translucidos que
//             correm para tras e se dissolvem em poeira — o ar comprimido e
//             jogado para os lados e para tras. O giro da broca torce filetes
//             em helice em volta do eixo, redemoinhos soltam das bordas, a
//             ponta incandesce e a poeira (nas particulas) e arrancada do
//             chao nas laterais. Tudo se move PARA TRAS em relacao ao chefe:
//             e isso que le como "ele vem".
//
// Tudo e derivado da acao autoritativa (`enemy.action`) e do relogio de
// parede: nada guarda estado, e quem reconecta no meio do avanco ve o mesmo
// rasgo. Com movimento reduzido os lencois e os redemoinhos nao correm (ficam
// na posicao media) e os riscos somem; a faixa e a ponta acesa continuam.
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
// A onda de proa
// ---------------------------------------------------------------------------
//
// O ar que uma ponta empurra nao abre em V reto: abre como a onda de proa de
// um casco — a largura cresce com a RAIZ da distancia atras da ponta, a
// frente e arredondada, e o que se ve nao e uma linha, e um LENCOL: ar
// comprimido e poeira fina, translucidos, em camadas que se deslocam para
// tras e se dissolvem. O giro da broca torce esse lencol num helice, e nas
// bordas o fluxo se enrola em redemoinhos que soltam e somem.

/** Intervalo entre um lencol e o seguinte, em ms. */
export const SHEET_EVERY_MS = 90;
/** Quanto cada lencol vive, viajando para tras. */
export const SHEET_LIFE_MS = 520;
/** Quantos lencois existem ao mesmo tempo. */
export const SHEET_COUNT = Math.ceil(SHEET_LIFE_MS / SHEET_EVERY_MS);
/** Ate onde a onda vai para tras, em tiles. */
export const WAKE_REACH_TILES = 3.4;
/** Abertura da onda: meia largura = `WAKE_SPREAD * sqrt(back)`, em tiles. */
export const WAKE_SPREAD = 1.05;

/** Meia largura da onda de proa a `back` tiles atras da ponta. */
export const bowHalfWidth = (back: number): number =>
  0.18 + WAKE_SPREAD * Math.sqrt(Math.max(0, back));

export type WakeSheet = {
  /** 0 = acabou de nascer na ponta, 1 = dissolvendo atras do corpo. */
  age: number;
  /** Distancia atras da ponta, em tiles (a frente do lencol). */
  back: number;
  /** Meia abertura das asas, em tiles — pela onda de proa. */
  halfWidth: number;
  alpha: number;
  /** Espessura do lencol, em tiles: fino ao nascer, gordo e difuso ao morrer. */
  thickness: number;
};

/**
 * Os lencois vivos neste instante. Determinista pelo relogio: um nasce a
 * cada `SHEET_EVERY_MS` e viaja para tras enquanto abre e engrossa. Com
 * movimento reduzido todos ficam na posicao media, parados: a onda existe,
 * mas nao corre.
 */
export const wakeSheetsAt = (nowMs: number, reducedMotion: boolean): WakeSheet[] => {
  const out: WakeSheet[] = [];
  const slot = Math.floor(nowMs / SHEET_EVERY_MS);
  for (let k = 0; k < SHEET_COUNT; k++) {
    const born = (slot - k) * SHEET_EVERY_MS;
    const age = reducedMotion
      ? (k + 0.5) / SHEET_COUNT
      : Math.max(0, Math.min(1, (nowMs - born) / SHEET_LIFE_MS));
    if (age >= 1) continue;
    // Desacelera para tras: o ar sai rapido da ponta e vai perdendo impulso.
    const ease = 1 - (1 - age) * (1 - age);
    const back = ease * WAKE_REACH_TILES;
    out.push({
      age,
      back,
      halfWidth: bowHalfWidth(back),
      alpha: (1 - age) * (1 - age) * 0.5 + 0.04,
      thickness: 0.12 + 0.55 * age,
    });
  }
  return out;
};

/** Quantos riscos helicoidais correm pelo lencol. */
export const STREAK_COUNT = 7;

export type Streak = {
  /** Lado inicial: -1 ou +1. */
  side: number;
  /** Fase 0..1 do risco ao longo da vida dele. */
  phase: number;
  /** Onde comeca atras da ponta, em tiles, e quanto mede. */
  back: number;
  length: number;
  /** Angulo do helice no comeco do risco (o giro da broca). */
  twist: number;
  alpha: number;
};

/**
 * Os riscos HELICOIDAIS: filetes de poeira fina que o giro da broca enrola em
 * volta do eixo enquanto correm para tras — sobem de um lado, descem do
 * outro. Nenhum com movimento reduzido.
 */
export const streaksAt = (nowMs: number, reducedMotion: boolean): Streak[] => {
  if (reducedMotion) return [];
  const out: Streak[] = [];
  for (let i = 0; i < STREAK_COUNT; i++) {
    const period = 260 + (i % 3) * 50;
    const phase = ((nowMs + i * 113) % period) / period;
    out.push({
      side: i % 2 === 0 ? -1 : 1,
      phase,
      back: 0.15 + phase * 2.2,
      length: 0.7 + 0.5 * (1 - phase),
      twist: (nowMs / 55 + i * 0.9) % (Math.PI * 2),
      alpha: (1 - phase) * 0.55,
    });
  }
  return out;
};

/** Quantos redemoinhos soltam das bordas ao mesmo tempo. */
export const EDDY_COUNT = 4;

export type Eddy = {
  side: number;
  /** Distancia atras da ponta e lateral (na borda da onda), em tiles. */
  back: number;
  lateral: number;
  /** Raio do enrolamento, em tiles, e quanto ja girou. */
  radius: number;
  turn: number;
  alpha: number;
};

/**
 * Os REDEMOINHOS: o fluxo que se enrola nas bordas da onda, cada um nascendo
 * numa altura da borda, girando enquanto e levado para tras, e somindo.
 */
export const eddiesAt = (nowMs: number, reducedMotion: boolean): Eddy[] => {
  const out: Eddy[] = [];
  for (let i = 0; i < EDDY_COUNT; i++) {
    const period = 640 + (i % 2) * 120;
    const phase = reducedMotion ? (i + 0.5) / EDDY_COUNT : ((nowMs + i * 210) % period) / period;
    const back = 0.6 + phase * (WAKE_REACH_TILES - 0.4);
    out.push({
      side: i % 2 === 0 ? -1 : 1,
      back,
      lateral: bowHalfWidth(back) * 0.9,
      radius: 0.12 + 0.28 * phase,
      turn: reducedMotion ? Math.PI * 0.75 : phase * Math.PI * 3.5,
      alpha: Math.sin(phase * Math.PI) * 0.45,
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
 * O RASGO na ponta, do lado de quem ve: a onda de proa em lencois
 * translucidos, os riscos helicoidais, os redemoinhos nas bordas e a ponta
 * incandescente. `tip` e a ponta da broca no mundo; `liftPx` a altura dela na
 * tela; `intensity` 0..1 (o avanco esfria no ultimo trecho).
 *
 * Nada aqui e uma linha dura: cada lencol e um arco de proa com a largura da
 * onda naquela distancia, tracado varias vezes com opacidade baixa e
 * espessura crescente — o que o olho le como ar denso, nao como desenho.
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
  /** Ponto atras da ponta (`back` tiles) e ao lado (`lateral` tiles), a `height` tiles do chao. */
  const at = (back: number, lateral: number, height = 0): [number, number] => {
    const [sx, sy] = toScreen(
      tip.x - dir.x * back + side.x * lateral,
      tip.y - dir.y * back + side.y * lateral,
    );
    return [sx, sy - liftPx - height * liftPx];
  };
  /** Um arco de proa: da asa esquerda, pela frente arredondada, a asa direita. */
  const bowPath = (back: number, halfWidth: number, height: number): void => {
    const apex = at(back, 0, height);
    const l = at(back + halfWidth * 0.9, -halfWidth, height);
    const r = at(back + halfWidth * 0.9, halfWidth, height);
    const cl = at(back - halfWidth * 0.15, -halfWidth * 0.45, height);
    const cr = at(back - halfWidth * 0.15, halfWidth * 0.45, height);
    ctx.beginPath();
    ctx.moveTo(l[0], l[1]);
    ctx.quadraticCurveTo(cl[0], cl[1], apex[0], apex[1]);
    ctx.quadraticCurveTo(cr[0], cr[1], r[0], r[1]);
  };

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // O VOLUME: a massa de ar comprimido e poeira fina, uma cunha arredondada
  // da ponta para tras, clara junto da ponta e sumindo atras do corpo.
  {
    const apex = at(-0.1, 0, 0.1);
    const far = at(WAKE_REACH_TILES, 0, 0.1);
    const grad = ctx.createLinearGradient(apex[0], apex[1], far[0], far[1]);
    grad.addColorStop(0, `rgba(232,241,255,${(0.16 * k).toFixed(3)})`);
    grad.addColorStop(0.5, `rgba(184,169,143,${(0.07 * k).toFixed(3)})`);
    grad.addColorStop(1, 'rgba(123,139,163,0)');
    ctx.fillStyle = grad;
    ctx.globalAlpha = 1;
    ctx.beginPath();
    const steps = 9;
    const left: [number, number][] = [];
    const right: [number, number][] = [];
    for (let i = 0; i <= steps; i++) {
      const back = (i / steps) * WAKE_REACH_TILES;
      const hw = bowHalfWidth(back);
      left.push(at(back, -hw, 0.05 + 0.15 * (i / steps)));
      right.push(at(back, hw, 0.05 + 0.15 * (i / steps)));
    }
    ctx.moveTo(apex[0], apex[1]);
    for (const p of left) ctx.lineTo(p[0], p[1]);
    for (let i = right.length - 1; i >= 0; i--) ctx.lineTo(right[i][0], right[i][1]);
    ctx.closePath();
    ctx.fill();
  }

  // OS LENCOIS: cada um tracado tres vezes — largo e apagado, medio, fino e
  // claro — para ler como ar denso em vez de linha. Nascem brancos junto da
  // ponta e viram poeira (osso) conforme correm para tras.
  for (const sheet of wakeSheetsAt(nowMs, reducedMotion)) {
    const color = sheet.age < 0.3 ? PAL.player : sheet.age < 0.65 ? PAL.mist : PAL.bone;
    const passes: [number, number][] = [
      [sheet.thickness * 14, 0.35],
      [sheet.thickness * 7, 0.55],
      [Math.max(1, 1.2 - sheet.age), 1],
    ];
    for (const [width, weight] of passes) {
      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(1, width * z);
      ctx.globalAlpha = sheet.alpha * weight * k;
      bowPath(sheet.back, sheet.halfWidth, 0.1 + 0.25 * sheet.age);
      ctx.stroke();
    }
  }

  // OS RISCOS HELICOIDAIS: filetes torcidos pelo giro, correndo para tras.
  ctx.strokeStyle = PAL.player;
  for (const s of streaksAt(nowMs, reducedMotion)) {
    ctx.globalAlpha = s.alpha * k;
    ctx.lineWidth = Math.max(1, 1.1 * z);
    ctx.beginPath();
    const n = 6;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const back = s.back + s.length * t;
      const radius = bowHalfWidth(back) * 0.55;
      const ang = s.twist + t * Math.PI * 1.1 * s.side;
      const p = at(back, Math.cos(ang) * radius, 0.12 + 0.3 * (0.5 + 0.5 * Math.sin(ang)));
      if (i === 0) ctx.moveTo(p[0], p[1]);
      else ctx.lineTo(p[0], p[1]);
    }
    ctx.stroke();
  }

  // OS REDEMOINHOS: espirais curtas soltando das bordas da onda.
  ctx.strokeStyle = PAL.mist;
  for (const e of eddiesAt(nowMs, reducedMotion)) {
    ctx.globalAlpha = e.alpha * k;
    ctx.lineWidth = Math.max(1, 1.3 * z);
    ctx.beginPath();
    const n = 10;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const ang = e.turn * t + (e.side < 0 ? Math.PI : 0);
      const r = e.radius * (0.3 + 0.7 * t);
      const p = at(
        e.back + Math.sin(ang) * r,
        e.side * e.lateral + Math.cos(ang) * r * e.side,
        0.15,
      );
      if (i === 0) ctx.moveTo(p[0], p[1]);
      else ctx.lineTo(p[0], p[1]);
    }
    ctx.stroke();
  }
  ctx.restore();

  // A PONTA incandescente: um halo quente compacto e a faisca correndo no eixo.
  const [tx, ty] = at(0, 0);
  drawEmissiveHalo(ctx, PAL.fire, tx, ty, 11 * z * k, 0.7 * k);
  drawEmissiveHalo(ctx, PAL.loot, tx, ty, 5 * z, 0.9 * k);
  if (!reducedMotion) {
    const spin = (nowMs / 60) % (Math.PI * 2);
    ctx.save();
    ctx.globalAlpha = 0.85 * k;
    ctx.fillStyle = PAL.player;
    const sz = Math.max(2, 2 * z);
    ctx.fillRect(
      tx + Math.cos(spin) * 4 * z - sz / 2,
      ty + Math.sin(spin) * 2 * z - sz / 2,
      sz,
      sz,
    );
    ctx.restore();
  }
};
