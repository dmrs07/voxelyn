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
import { blobRadius, fbm01, fbm2 } from './noise';
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
 * Um contorno IRREGULAR em volta de `(cx, cy)`: uma elipse `rx` x `ry` cuja
 * borda ondula pelo ruido de Perlin (ver noise.ts) — `amount` e quanto o
 * raio varia (0,25 = ate um quarto), `lobes` quantas ondulacoes cabem numa
 * volta, `t` o tempo (segundos) que faz a forma evoluir. Fecha sempre: o
 * angulo entra no ruido como um ponto num circulo.
 */
const blobPath = (
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  seed: number,
  t: number,
  amount: number,
  lobes: number,
  points = 40,
): void => {
  ctx.beginPath();
  for (let i = 0; i <= points; i++) {
    const a = (i / points) * Math.PI * 2;
    const f = blobRadius(a, t, seed, amount, lobes);
    const x = cx + Math.cos(a) * rx * f;
    const y = cy + Math.sin(a) * ry * f;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
};

/**
 * A CRATERA que a detonacao deixa: escura, de contorno irregular (o ruido da
 * propria detonacao, parado no tempo), com a borda queimada, apagando
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
  blobPath(ctx, sx, sy, rx * 0.8, ry * 0.8, blast.seed ^ 0x51, 0, 0.18, 2.4, 32);
  ctx.fill();
  ctx.globalAlpha = 0.5 * (1 - crater) * (1 - crater);
  ctx.strokeStyle = PAL.rust;
  ctx.lineWidth = Math.max(1, 1.5 * z);
  ctx.stroke();
  // Terra revirada em volta: cubinhos escuros onde o ruido e mais alto.
  ctx.globalAlpha = 0.45 * (1 - crater);
  const grain = Math.max(1, 1.6 * z);
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    const n = fbm01(Math.cos(a) * 2.1, Math.sin(a) * 2.1 + 3, blast.seed ^ 0x77, 2);
    if (n < 0.45) continue;
    const d = 0.85 + 0.35 * n;
    ctx.fillStyle = n > 0.7 ? PAL.rust : PAL.rockShadow;
    ctx.fillRect(
      Math.round(sx + Math.cos(a) * rx * d),
      Math.round(sy + Math.sin(a) * ry * d),
      Math.ceil(grain),
      Math.ceil(grain * 0.6),
    );
  }
  ctx.restore();
};

/**
 * A DETONACAO num instante: onda de choque no chao, bola de fogo e coluna de
 * fumaca (a cratera e `drawCrater`). Cada camada tem o proprio relogio;
 * `tileW`/`tileH` sao a projecao do jogo (2:1), e `radius` o raio REAL do
 * estrago — a bola de fogo cobre exatamente a area que a simulacao cobrou.
 *
 * O que da a ela a materia de uma explosao de verdade e o RUIDO (noise.ts):
 * nenhuma borda e um circulo. A onda de choque ondula, a bola de fogo e um
 * volume irregular que se rasga em linguas de fogo onde o ruido e alto, e a
 * fumaca e uma coluna turbulenta que se retorce enquanto sobe. Tudo pela
 * semente da detonacao e pela idade dela: os dois clientes do co-op veem a
 * mesma forma, e um teste pode conferir cada raio.
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
  // Com movimento reduzido a forma nao evolui: cada camada tem o contorno do
  // instante zero e so cresce e apaga.
  const t = reducedMotion ? 0 : age / 1000;

  // A ONDA DE CHOQUE: um anel que abre ate alem do raio, grosso no comeco e
  // fino no fim, com a borda ondulando — e, atras dele, uma saia de poeira
  // rente ao chao que o ruido rasga em nesgas.
  const shock = age / SHOCKWAVE_MS;
  if (shock < 1) {
    const k = easeOut(shock);
    const grow = 0.2 + 1.3 * k;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.95 * (1 - shock);
    ctx.strokeStyle = PAL.player;
    ctx.lineWidth = Math.max(1, (7 - 6 * shock) * z);
    blobPath(ctx, sx, sy, rx * grow, ry * grow, blast.seed ^ 0x11, t * 2, 0.07, 3, 48);
    ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 0.35 * (1 - shock);
    ctx.fillStyle = PAL.bone;
    blobPath(ctx, sx, sy, rx * grow * 0.92, ry * grow * 0.92, blast.seed ^ 0x13, t, 0.22, 2, 36);
    ctx.fill();
    ctx.restore();
  }

  // A BOLA DE FOGO, em tres tempos: o CLARAO branco (os primeiros 15%), o
  // VOLUME laranja que incha alem do raio e sobe, e as LINGUAS de fogo — cubos
  // de voxel onde o ruido rasga a borda, subindo e apagando — que dao ao fogo
  // a materia do resto do jogo. Tudo somado ('lighter'): fogo e luz.
  const fire = age / FIREBALL_MS;
  if (fire < 1) {
    const k = easeOut(fire);
    const r = rx * (0.35 + 0.85 * k);
    const lift = ry * 0.8 * k;
    const cy = sy - lift;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    if (fire < 0.15) {
      const flash = 1 - fire / 0.15;
      ctx.globalAlpha = 0.9 * flash;
      ctx.fillStyle = PAL.player;
      blobPath(
        ctx,
        sx,
        sy - ry * 0.3,
        rx * (0.5 + 0.5 * k),
        ry * (0.5 + 0.5 * k),
        blast.seed,
        t,
        0.15,
        2,
      );
      ctx.fill();
    }
    // O volume: um degrade radial recortado por um contorno de ruido — a
    // borda se move enquanto o fogo dura, e nunca e um circulo.
    const grad = ctx.createRadialGradient(sx, cy, r * 0.1, sx, cy, r * 1.15);
    grad.addColorStop(0, `rgba(255,244,214,${(0.95 * (1 - fire)).toFixed(3)})`);
    grad.addColorStop(0.4, `rgba(255,209,102,${(0.85 * (1 - fire)).toFixed(3)})`);
    grad.addColorStop(0.75, `rgba(255,122,47,${(0.6 * (1 - fire)).toFixed(3)})`);
    grad.addColorStop(1, 'rgba(217,59,76,0)');
    ctx.globalAlpha = 1;
    ctx.fillStyle = grad;
    blobPath(ctx, sx, cy, r, r * 0.8, blast.seed ^ 0x21, t * 1.4, 0.3, 1.8, 44);
    ctx.fill();
    // Um segundo volume menor e mais quente, deslocado para cima: o nucleo
    // que ainda esta queimando enquanto a casca esfria.
    const core = ctx.createRadialGradient(sx, cy - r * 0.15, 0, sx, cy - r * 0.15, r * 0.6);
    core.addColorStop(0, `rgba(255,244,214,${(0.8 * (1 - fire) * (1 - fire)).toFixed(3)})`);
    core.addColorStop(1, 'rgba(255,209,102,0)');
    ctx.fillStyle = core;
    blobPath(ctx, sx, cy - r * 0.15, r * 0.6, r * 0.5, blast.seed ^ 0x23, t * 1.9, 0.35, 2.3, 32);
    ctx.fill();
    ctx.restore();
    // As LINGUAS: onde o ruido da borda e alto o fogo escapa em cubos, mais
    // longe e maiores quanto mais alto ele e. Quentes no comeco, frias no fim.
    ctx.save();
    const tongues = 12;
    for (let i = 0; i < tongues; i++) {
      const ang = (i / tongues) * Math.PI * 2 + fire * 0.4;
      const n = fbm01(Math.cos(ang) * 1.7 + t * 1.1, Math.sin(ang) * 1.7 + 5, blast.seed ^ 0x31, 3);
      if (n < 0.42) continue;
      const reach = (0.45 + 0.75 * n) * k;
      const px = sx + Math.cos(ang) * rx * reach;
      const py = cy - lift * 0.4 * n + Math.sin(ang) * ry * reach;
      const size = Math.max(3, rx * (0.1 + 0.16 * n) * (1 - 0.5 * fire));
      ctx.globalAlpha = 0.9 * (1 - fire) * (1 - fire) * (0.5 + 0.5 * n);
      drawVoxel(ctx, px, py, size, fire < 0.5 && n > 0.6 ? FIRE_HOT : FIRE_COOL);
    }
    ctx.restore();
    drawEmissiveHalo(ctx, PAL.fire, sx, cy, r * 1.8, 0.95 * (1 - fire));
  }

  // A COLUNA DE FUMACA: sopros escuros subindo do centro, abrindo e
  // desbotando — o que fica quando o fogo acaba. A coluna e TURBULENTA: cada
  // sopro se desloca de lado pelo ruido (parado com movimento reduzido), e o
  // contorno de cada um ondula. Os mais altos sao os mais velhos e os mais
  // abertos.
  const smoke = age / SMOKE_MS;
  if (smoke < 1 && smoke >= 0.2) {
    const k = (smoke - 0.2) / 0.8;
    ctx.save();
    const puffs = 9;
    for (let i = 0; i < puffs; i++) {
      const s = i / (puffs - 1);
      // Os de cima nascem antes: o sopro `i` so aparece quando a coluna ja
      // subiu ate ele.
      const born = Math.max(0, Math.min(1, (k - s * 0.55) / 0.45));
      if (born <= 0) continue;
      const rise = ry * (0.25 + 1.3 * s) * (0.6 + 0.6 * born);
      const swirl = fbm2(s * 1.7 + 0.3, t * 0.8 + s * 0.9, blast.seed ^ 0x41, 3);
      const drift = swirl * rx * (0.25 + 0.5 * s);
      const puff = Math.max(4, rx * (0.16 + 0.26 * s) * (0.6 + 0.6 * born));
      const shade = fbm01(s * 3.1, 2.2, blast.seed ^ 0x43, 2);
      ctx.globalAlpha = 0.62 * (1 - k) * born * (0.55 + 0.45 * (1 - s));
      ctx.fillStyle = shade > 0.55 ? PAL.rock : PAL.rockShadow;
      blobPath(
        ctx,
        sx + drift,
        sy - rise,
        puff,
        puff * 0.8,
        blast.seed ^ (0x45 + i * 17),
        t * 0.7,
        0.28,
        2.2,
        24,
      );
      ctx.fill();
    }
    ctx.restore();
  }
};

/** O raio real da carga, reexportado para quem desenha a marca junto. */
export const DEMOLITION_RADIUS = DIAMANDIS_DEMOLISH_RADIUS;
