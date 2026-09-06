// A SALVA DE DEMOLICAO do Diamandis, do lado de quem ve: as cargas ARREMESSADAS
// e a DETONACAO.
//
// A simulacao marca tres celulas no comeco do telegrafo (`blastCells`, com o
// relogio na acao do chefe) e as implode no release (`explodeAt` -> `explosion`).
// O cliente desenhava so o anel no chao: a carga aparecia como uma marca de
// interface, sem sair de lugar nenhum, e a explosao era um clarao com
// particulas. Faltava o ARREMESSO — e faltava a explosao ser uma explosao.
//
// Agora cada carga e um FEIXE DE DINAMITE que sai do rack de demolicao, voa
// em parabola ate a celula (uma por vez, o rack lanca em sequencia), quica,
// fica no chao com o estopim aceso ate o release — piscando mais rapido no
// fim — e entao DETONA: bola de fogo, onda de choque no chao, coluna de fumaca
// e a cratera escura que fica.
//
// Tudo o que e posicao e tempo vem do ESTADO (as celulas e os relogios da
// acao), como as marcas de chao: quem reconecta no meio do telegrafo ve as
// cargas no lugar certo do voo. So a detonacao vem do evento `explosion`, que
// e o que ela e. Com movimento reduzido a dinamite nao tomba nem pisca; o
// arco, o estopim e a explosao continuam.
import { DIAMANDIS_DEMOLISH_RADIUS } from '@voxelyn/survival-sim';
import type { SemanticEvent } from '@voxelyn/survival-sim';
import { drawEmissiveHalo } from './emissive-halo';
import { PAL } from './palette';
import { drawGroundShadow, drawVoxel, type FaceRamp } from './voxel-draw';

/** Intervalo entre um arremesso e o seguinte: o rack lanca UMA carga por vez. */
export const THROW_STAGGER_TICKS = 3;
/** Fracao do telegrafo em que a primeira carga POUSA. As outras, um passo depois cada. */
export const LAND_AT = 0.5;

export type Charge = {
  index: number;
  /** Centro da celula marcada. */
  x: number;
  y: number;
  launchTick: number;
  landTick: number;
  fireTick: number;
};

/**
 * As cargas desta salva, derivadas do estado: as celulas em `blastCells` e o
 * relogio da acao `demolish` do chefe. Sem chefe em demolicao nao ha cargas —
 * meia carga (onde, mas nao quando) e pior que nenhuma.
 */
export const demolitionCharges = (state: {
  config: { width: number };
  bossRuntime: { blastCells: readonly number[] };
  enemies: readonly {
    alive: boolean;
    archetype: string;
    action?: { kind: string; startedAt: number; releaseAt: number };
  }[];
}): Charge[] => {
  const cells = state.bossRuntime.blastCells;
  if (cells.length === 0) return [];
  const action = state.enemies.find(
    (e) => e.alive && e.archetype === 'diamandis' && e.action?.kind === 'demolish',
  )?.action;
  if (!action) return [];
  const w = state.config.width;
  const windup = Math.max(1, action.releaseAt - action.startedAt);
  const out: Charge[] = [];
  for (let i = 0; i < cells.length; i++) {
    const launchTick = action.startedAt + i * THROW_STAGGER_TICKS;
    const landTick = Math.min(
      action.releaseAt - 1,
      action.startedAt + Math.round(windup * LAND_AT) + i * THROW_STAGGER_TICKS,
    );
    out.push({
      index: i,
      x: (cells[i] % w) + 0.5,
      y: Math.floor(cells[i] / w) + 0.5,
      launchTick,
      landTick: Math.max(launchTick + 1, landTick),
      fireTick: action.releaseAt,
    });
  }
  return out;
};

export type ChargeFlight =
  | { phase: 'waiting' }
  | { phase: 'flying'; t: number }
  | { phase: 'landed'; fuse: number };

/** Em que ponto do voo (ou do estopim) a carga esta no tick. */
export const chargeFlight = (charge: Charge, tick: number): ChargeFlight => {
  if (tick < charge.launchTick) return { phase: 'waiting' };
  if (tick < charge.landTick) {
    return {
      phase: 'flying',
      t: (tick - charge.launchTick) / Math.max(1, charge.landTick - charge.launchTick),
    };
  }
  const span = Math.max(1, charge.fireTick - charge.landTick);
  return { phase: 'landed', fuse: Math.max(0, Math.min(1, (tick - charge.landTick) / span)) };
};

/**
 * Altura da parabola, em TILES, para um voo de `distance` tiles: um arco alto
 * o bastante para ler como arremesso (e nao como tiro), mais alto quanto mais
 * longe, com teto. `t` e 0..1 ao longo do voo.
 */
export const arcHeightTiles = (t: number, distance: number): number => {
  const peak = Math.min(1.7, 0.5 + distance * 0.12);
  const k = Math.max(0, Math.min(1, t));
  return Math.sin(k * Math.PI) * peak;
};

/** O tombo da dinamite no ar: uma volta e meia por voo. Zero com movimento reduzido. */
export const tumbleAngle = (t: number, index: number, reducedMotion: boolean): number =>
  reducedMotion ? 0 : (t * 1.5 + index * 0.37) * Math.PI * 2;

/**
 * O estopim: 0..1 de quanto ele ja QUEIMOU. Pisca devagar no comeco e rapido
 * no fim — a leitura de "vai agora" sem numero. Com movimento reduzido fica
 * aceso fixo.
 */
export const fuseBlink = (fuse: number, nowMs: number, reducedMotion: boolean): number => {
  if (reducedMotion) return 1;
  const hz = 3 + 14 * fuse * fuse;
  const s = Math.sin((nowMs / 1000) * hz * Math.PI * 2);
  return fuse > 0.75 ? (s > 0 ? 1 : 0.25) : 0.65 + 0.35 * s;
};

// ---------------------------------------------------------------------------
// A detonacao
// ---------------------------------------------------------------------------

/** Quanto dura a bola de fogo, em ms. */
export const FIREBALL_MS = 560;
/** A onda de choque no chao. */
export const SHOCKWAVE_MS = 320;
/** A coluna de fumaca. */
export const SMOKE_MS = 1300;
/** A cratera escura. */
export const CRATER_MS = 2600;

export type Blast = { x: number; y: number; radius: number; at: number; seed: number };

/**
 * A memoria da demolicao do lado de quem desenha: as detonacoes recentes.
 * Memoria da RUN — `reset` a cada run nova e a cada setor.
 */
export class DemolitionPresentation {
  readonly blasts: Blast[] = [];

  /**
   * Uma explosao DO DIAMANDIS vira detonacao. `isDiamandis` decide pelo dono do
   * evento — a explosao de um modulo do Prospector ou de gas nao e uma carga.
   */
  ingest(
    events: readonly SemanticEvent[],
    nowMs: number,
    isDiamandis: (owner: number | undefined) => boolean,
  ): Blast[] {
    const born: Blast[] = [];
    for (const ev of events) {
      if (ev.t !== 'explosion' || ev.source !== 'enemy' || !isDiamandis(ev.owner)) continue;
      const blast: Blast = {
        x: ev.x,
        y: ev.y,
        radius: ev.radius,
        at: nowMs,
        seed: (Math.round(ev.x * 8) * 7919) ^ (Math.round(ev.y * 8) * 104729),
      };
      this.blasts.push(blast);
      born.push(blast);
    }
    return born;
  }

  step(nowMs: number): void {
    for (let i = this.blasts.length - 1; i >= 0; i--) {
      if (nowMs - this.blasts[i].at >= CRATER_MS) this.blasts.splice(i, 1);
    }
  }

  reset(): void {
    this.blasts.length = 0;
  }
}

// ---------------------------------------------------------------------------
// Desenho
// ---------------------------------------------------------------------------

const STICK: FaceRamp = ['#e0524f', '#b03a3a', '#8c2c2c'];
const TAPE: FaceRamp = ['#d9c9a8', '#b8a98f', '#8f8370'];
const FIRE_HOT: FaceRamp = ['#fff4d6', '#ffd166', '#ff7a2f'];
const FIRE_COOL: FaceRamp = ['#ff7a2f', '#d93b4c', '#8c2c2c'];

/**
 * O FEIXE DE DINAMITE: tres bastoes vermelhos lado a lado, presos por uma
 * fita de osso, e o estopim aceso no topo quando `fuse` nao e nulo. Desenhado
 * em voxels, no tamanho de meio tile: grande o bastante para ler de longe,
 * pequeno o bastante para caber na mao do rack.
 */
export const drawDynamiteCluster = (
  ctx: CanvasRenderingContext2D,
  sx: number,
  sy: number,
  z: number,
  angle: number,
  fuse: number | null,
  nowMs: number,
  reducedMotion: boolean,
): void => {
  const size = Math.max(3, 6 * z);
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  ctx.save();
  // Tres bastoes: o do meio um pouco acima, os laterais tombados pelo angulo.
  for (let i = -1; i <= 1; i++) {
    const ox = i * size * 0.9 * cos;
    const oy = i * size * 0.45 * sin;
    drawVoxel(ctx, sx + ox, sy + oy, size, STICK);
    drawVoxel(ctx, sx + ox, sy + oy - size * 0.5, size, STICK);
  }
  // A fita que segura o feixe.
  drawVoxel(ctx, sx, sy - size * 0.25, size * 0.7, TAPE);
  ctx.restore();
  if (fuse !== null) {
    const blink = fuseBlink(fuse, nowMs, reducedMotion);
    const fx = sx + size * 0.4;
    const fy = sy - size * 1.4;
    drawEmissiveHalo(ctx, PAL.loot, fx, fy, (6 + 6 * fuse) * z, 0.5 * blink);
    ctx.save();
    ctx.globalAlpha = blink;
    ctx.fillStyle = fuse > 0.75 ? PAL.player : PAL.loot;
    const s = Math.max(2, 2 * z);
    ctx.fillRect(fx - s / 2, fy - s / 2, s, s);
    ctx.restore();
  }
};

/** A sombra da carga em voo, abrindo e desbotando com a altura. */
export const drawChargeShadow = (
  ctx: CanvasRenderingContext2D,
  sx: number,
  sy: number,
  z: number,
  heightTiles: number,
): void => {
  const h = Math.max(0, Math.min(1, heightTiles / 1.7));
  drawGroundShadow(ctx, sx, sy, (5 + 4 * h) * z, 0.4 * (1 - 0.6 * h));
};

const easeOut = (t: number): number => 1 - (1 - t) * (1 - t);

/**
 * A CRATERA que a detonacao deixa: escura, com a borda queimada, apagando
 * devagar. Separada da detonacao porque vive no CHAO — entra na fila ordenada
 * com a profundidade da celula, por baixo de quem pisa nela; a bola de fogo e
 * a fumaca passam por cima de tudo.
 */
export const drawCrater = (
  ctx: CanvasRenderingContext2D,
  blast: Blast,
  sx: number,
  sy: number,
  tileW: number,
  tileH: number,
  z: number,
  nowMs: number,
): void => {
  const age = nowMs - blast.at;
  const crater = age / CRATER_MS;
  if (age < 0 || crater >= 1) return;
  const rx = blast.radius * tileW * 0.5 * Math.SQRT2 * z;
  const ry = blast.radius * tileH * 0.5 * Math.SQRT2 * z;
  ctx.save();
  ctx.globalAlpha = 0.55 * (1 - crater);
  ctx.fillStyle = PAL.dark;
  ctx.beginPath();
  ctx.ellipse(sx, sy, rx * 0.8, ry * 0.8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 0.5 * (1 - crater) * (1 - crater);
  ctx.strokeStyle = PAL.rust;
  ctx.lineWidth = Math.max(1, 1.5 * z);
  ctx.stroke();
  ctx.restore();
};

/**
 * A DETONACAO num instante: onda de choque no chao, bola de fogo e coluna de
 * fumaca (a cratera e `drawCrater`). Cada camada tem o proprio relogio;
 * `tileW`/`tileH` sao a projecao do jogo (2:1), e `radius` o raio REAL do
 * estrago — a bola de fogo cobre exatamente a area que a simulacao cobrou.
 */
export const drawBlast = (
  ctx: CanvasRenderingContext2D,
  blast: Blast,
  sx: number,
  sy: number,
  tileW: number,
  tileH: number,
  z: number,
  nowMs: number,
  reducedMotion: boolean,
): void => {
  const age = nowMs - blast.at;
  if (age < 0) return;
  const rx = blast.radius * tileW * 0.5 * Math.SQRT2 * z;
  const ry = blast.radius * tileH * 0.5 * Math.SQRT2 * z;

  // A ONDA DE CHOQUE: um anel que abre ate alem do raio, grosso no comeco e
  // fino no fim, e some.
  const shock = age / SHOCKWAVE_MS;
  if (shock < 1) {
    const k = easeOut(shock);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.95 * (1 - shock);
    ctx.strokeStyle = PAL.player;
    ctx.lineWidth = Math.max(1, (7 - 6 * shock) * z);
    ctx.beginPath();
    ctx.ellipse(sx, sy, rx * (0.2 + 1.3 * k), ry * (0.2 + 1.3 * k), 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // A BOLA DE FOGO, em tres tempos: o CLARAO branco (os primeiros 15%), a
  // ESFERA laranja que incha alem do raio e sobe, e os SOPROS de fogo — cubos
  // de voxel espalhados dentro do raio, subindo e apagando — que dao ao fogo a
  // materia do resto do jogo. Tudo somado ('lighter'): fogo e luz.
  const fire = age / FIREBALL_MS;
  if (fire < 1) {
    const k = easeOut(fire);
    const r = rx * (0.35 + 0.85 * k);
    const lift = ry * 0.8 * k;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    if (fire < 0.15) {
      const flash = 1 - fire / 0.15;
      ctx.globalAlpha = 0.9 * flash;
      ctx.fillStyle = PAL.player;
      ctx.beginPath();
      ctx.ellipse(sx, sy - ry * 0.3, rx * (0.5 + 0.5 * k), ry * (0.5 + 0.5 * k), 0, 0, Math.PI * 2);
      ctx.fill();
    }
    const grad = ctx.createRadialGradient(sx, sy - lift, r * 0.1, sx, sy - lift, r);
    grad.addColorStop(0, `rgba(255,244,214,${(0.95 * (1 - fire)).toFixed(3)})`);
    grad.addColorStop(0.4, `rgba(255,209,102,${(0.85 * (1 - fire)).toFixed(3)})`);
    grad.addColorStop(0.75, `rgba(255,122,47,${(0.6 * (1 - fire)).toFixed(3)})`);
    grad.addColorStop(1, 'rgba(217,59,76,0)');
    ctx.globalAlpha = 1;
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(sx, sy - lift, r, r * 0.8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    // Os sopros: seis cubos, cada um com o proprio rumo e tamanho pela semente.
    ctx.save();
    for (let i = 0; i < 6; i++) {
      const a = ((blast.seed >> (i * 4)) & 15) / 15;
      const b = ((blast.seed >> (i * 4 + 2)) & 15) / 15;
      const ang = a * Math.PI * 2;
      const dist = (0.25 + 0.6 * b) * k;
      const px = sx + Math.cos(ang) * rx * dist;
      const py = sy - lift * (0.6 + 0.6 * b) + Math.sin(ang) * ry * dist;
      const size = Math.max(3, rx * (0.16 + 0.12 * b) * (1 - 0.5 * fire));
      ctx.globalAlpha = 0.9 * (1 - fire) * (1 - fire);
      drawVoxel(ctx, px, py, size, fire < 0.5 ? FIRE_HOT : FIRE_COOL);
    }
    ctx.restore();
    drawEmissiveHalo(ctx, PAL.fire, sx, sy - lift, r * 1.8, 0.95 * (1 - fire));
  }

  // A COLUNA DE FUMACA: sopros escuros subindo do centro, abrindo e
  // desbotando — o que fica quando o fogo acaba. Sem movimento reduzido eles
  // derivam de lado, um a um.
  const smoke = age / SMOKE_MS;
  if (smoke < 1 && smoke >= 0.2) {
    const k = (smoke - 0.2) / 0.8;
    ctx.save();
    for (let i = 0; i < 6; i++) {
      const s = ((blast.seed >> (i * 3)) & 7) / 7;
      const rise = ry * (0.3 + 1.1 * k) * (0.7 + 0.6 * s);
      const drift = reducedMotion ? 0 : (s - 0.5) * rx * 0.7 * k;
      const puff = Math.max(4, rx * (0.22 + 0.3 * k) * (0.7 + 0.5 * s));
      ctx.globalAlpha = 0.6 * (1 - k) * (0.6 + 0.4 * s);
      ctx.fillStyle = PAL.rockShadow;
      ctx.beginPath();
      ctx.ellipse(
        sx + drift + (i - 2.5) * rx * 0.14,
        sy - rise,
        puff,
        puff * 0.8,
        0,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }
    ctx.restore();
  }
};

/** O raio real da carga, reexportado para quem desenha a marca junto. */
export const DEMOLITION_RADIUS = DIAMANDIS_DEMOLISH_RADIUS;
