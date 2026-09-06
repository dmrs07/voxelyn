// O FEIXE DE PROSPECCAO do Diamandis, do lado de quem ve.
//
// A simulacao ja fazia tudo: dois segundos de LEVANTAMENTO (uma linha de
// medicao que nao machuca, re-emitida a cada quatro ticks) e depois a passagem
// COM POTENCIA, que seca fungo, acende gas, derrete gelo, energiza minerio e
// queima quem estiver na linha. O cliente ouvia o `beam_line` e nao desenhava
// nada: o unico golpe de linha reta do jogo era invisivel, e o jogador levava
// 26 de dano de uma medicao que nunca viu.
//
// Agora o feixe e a coisa mais legivel do encontro, em tres atos:
//
//   LEVANTAMENTO   a lente do mastro acende e varre o chao com um fio fino;
//                  no chao nasce uma LINHA DE MEDICAO — tracejada, com marcas
//                  de estaca a cada tile e uma cabeca de leitura correndo por
//                  ela. Azul-eletrico, apagada; fecha o tracejado e vira ambar
//                  no ultimo terco: "travou".
//   PASSAGEM       o fio vira coluna: nucleo branco, corpo laranja, halo de
//                  calor, cintilacao ao longo dele; o chao na linha acende, a
//                  parede do fim recebe o impacto e a sala inteira pisca na cor
//                  do fogo. Em frenesi a borda puxa para o vermelho.
//   CICATRIZ       a passagem deixa um risco queimado com brasas, que some em
//                  segundo e meio — a prova de onde a linha ESTEVE.
//
// Tudo o que e geometria e tempo sai da acao autoritativa (`enemy.action`) e
// do evento `beam_line`; nada aqui inventa alcance. Com movimento reduzido a
// cintilacao para e a cabeca de leitura anda linear; as cores contam o resto.
import type { EntityAction, SemanticEvent, SurvivalState } from '@voxelyn/survival-sim';
import { DIAMANDIS_BEAM_LENGTH, DIAMANDIS_BEAM_STEP, SOLID_NONE } from '@voxelyn/survival-sim';
import { drawEmissiveHalo } from './emissive-halo';
import { PAL } from './palette';

export type Vec = { x: number; y: number };
export type ToScreen = (x: number, y: number) => [number, number];

export type BeamPhase = { kind: 'survey' | 'fire'; progress: number } | null;

/**
 * Em que ato o feixe esta neste tick, e quanto dele ja passou (0..1).
 *
 * `survey` cobre o windup inteiro (`startedAt`..`releaseAt`); `fire` cobre a
 * recuperacao (`releaseAt`..`endsAt`), que e o tempo em que a coluna esta na
 * tela. Fora de uma acao de feixe, `null`.
 */
export const beamPhaseAt = (action: EntityAction | undefined, tick: number): BeamPhase => {
  if (!action || action.kind !== 'beam') return null;
  if (tick < action.releaseAt) {
    const span = Math.max(1, action.releaseAt - action.startedAt);
    return { kind: 'survey', progress: Math.max(0, Math.min(1, (tick - action.startedAt) / span)) };
  }
  const span = Math.max(1, action.endsAt - action.releaseAt);
  return { kind: 'fire', progress: Math.max(0, Math.min(1, (tick - action.releaseAt) / span)) };
};

/**
 * Ate onde a linha VAI, em tiles: a mesma marcha da simulacao
 * (`fireProspectingBeam`), passo a passo, parando na primeira parede ou na
 * borda do mapa. Derivado aqui para o levantamento ter alcance certo em todo
 * quadro — o evento so chega a cada quatro ticks — e conferido contra o
 * `beam_line` de verdade no teste.
 */
export const beamReach = (
  state: Pick<SurvivalState, 'solid' | 'config'>,
  x: number,
  y: number,
  dx: number,
  dy: number,
): number => {
  const w = state.config.width;
  const h = state.config.height;
  for (let d = 0.5; d <= DIAMANDIS_BEAM_LENGTH; d += DIAMANDIS_BEAM_STEP) {
    const cx = Math.floor(x + dx * d);
    const cy = Math.floor(y + dy * d);
    if (cx < 0 || cy < 0 || cx >= w || cy >= h) return d;
    if (state.solid[cy * w + cx] !== SOLID_NONE) return d;
  }
  return DIAMANDIS_BEAM_LENGTH;
};

/** A partir de que fracao do levantamento a linha "trava" (ambar, tracejado fechado). */
export const SURVEY_LOCK_AT = 0.7;

export type SurveyStyle = {
  color: string;
  alpha: number;
  /** [traco, vao], em pixels de zoom 1. */
  dash: [number, number];
  locked: boolean;
};

/**
 * Como a linha de medicao se veste conforme o levantamento avanca: apagada e
 * aberta no comeco, fechando e clareando ate travar em ambar. E monotona de
 * proposito — o jogador le "quanto falta" pela linha, sem numero.
 */
export const surveyStyle = (progress: number): SurveyStyle => {
  const p = Math.max(0, Math.min(1, progress));
  const locked = p >= SURVEY_LOCK_AT;
  return {
    color: locked ? PAL.loot : PAL.electric,
    alpha: 0.35 + 0.55 * p,
    dash: [6 + 6 * p, Math.max(1.5, 6 - 5 * p)],
    locked,
  };
};

/**
 * Onde a CABECA DE LEITURA esta na linha (0 = lente, 1 = fim), no instante.
 *
 * Varre ida e volta, mais rapido conforme o levantamento avanca; travada,
 * corre so para a frente e cada vez mais depressa — a medicao fechando. Com
 * movimento reduzido anda linear e devagar, uma vez so.
 */
export const readHeadT = (progress: number, nowMs: number, reducedMotion: boolean): number => {
  const p = Math.max(0, Math.min(1, progress));
  if (reducedMotion) return p;
  const hz = p >= SURVEY_LOCK_AT ? 2.2 + 4 * (p - SURVEY_LOCK_AT) : 0.6 + 1.2 * p;
  const phase = (nowMs / 1000) * hz;
  if (p >= SURVEY_LOCK_AT) return phase - Math.floor(phase);
  const tri = phase - Math.floor(phase);
  return tri < 0.5 ? tri * 2 : 2 - tri * 2;
};

export type BeamColors = { core: string; mid: string; edge: string; ground: string };

/**
 * As cores da passagem. O nucleo e sempre branco-osso; o corpo e o fogo da
 * paleta; a borda e o que o FRENESI empurra para o vermelho — a mesma leitura
 * do reator na carcaca, aplicada ao que sai dele.
 */
export const beamColors = (stacks: number): BeamColors => {
  const s = Math.max(0, Math.min(3, stacks)) / 3;
  const edge = mixHex(PAL.fire, PAL.blood, s);
  return { core: PAL.player, mid: PAL.loot, edge, ground: mixHex(PAL.loot, PAL.blood, s * 0.5) };
};

const hexRgb = (hex: string): [number, number, number] => {
  const n = Number.parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const mixHex = (a: string, b: string, t: number): string => {
  const [ar, ag, ab] = hexRgb(a);
  const [br, bg, bb] = hexRgb(b);
  const c = (x: number, y: number) => Math.round(x + (y - x) * t);
  return `#${[c(ar, br), c(ag, bg), c(ab, bb)].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
};

/** Quanto a CICATRIZ dura no chao depois da passagem, em ms. */
export const SCORCH_MS = 1400;
/**
 * Quanto a COLUNA fica na tela depois do release, em ms. Vem do evento, e nao
 * da acao: a simulacao encerra a acao do feixe no proprio release e o chefe ja
 * escolhe a proxima ferramenta no tick seguinte — pela acao, a coluna durava
 * um quadro. Meio segundo e o tempo de ler "foi ISTO que me queimou".
 */
export const FIRE_MS = 520;

export type ScorchMark = {
  x: number;
  y: number;
  dx: number;
  dy: number;
  length: number;
  at: number;
};

/**
 * A memoria do feixe do lado de quem desenha: a ultima passagem (para o
 * renderer acender a sala e para a arena ler) e as cicatrizes ainda visiveis.
 * Memoria da RUN — `reset` a cada run nova e a cada setor.
 */
export class DiamandisBeamPresentation {
  readonly scorches: ScorchMark[] = [];
  /** Instante da ultima passagem com potencia. */
  firedAt = -1e9;
  lastFire: ScorchMark | null = null;

  /** Devolve as passagens com potencia deste lote, para o renderer acender a sala. */
  ingest(events: readonly SemanticEvent[], nowMs: number): ScorchMark[] {
    const fired: ScorchMark[] = [];
    for (const ev of events) {
      if (ev.t !== 'beam_line' || !ev.powered) continue;
      const mark: ScorchMark = {
        x: ev.x,
        y: ev.y,
        dx: ev.dx,
        dy: ev.dy,
        length: ev.length,
        at: nowMs,
      };
      this.scorches.push(mark);
      this.firedAt = nowMs;
      this.lastFire = mark;
      fired.push(mark);
    }
    return fired;
  }

  /** 0..1: quanto da coluna ainda esta na tela (cheia no release, esfriando). */
  fireIntensity(nowMs: number): number {
    const t = (nowMs - this.firedAt) / FIRE_MS;
    return t < 0 || t >= 1 ? 0 : 1 - t * t;
  }

  /** Esquece as cicatrizes que ja apagaram. */
  step(nowMs: number): void {
    for (let i = this.scorches.length - 1; i >= 0; i--) {
      if (nowMs - this.scorches[i].at >= SCORCH_MS) this.scorches.splice(i, 1);
    }
  }

  reset(): void {
    this.scorches.length = 0;
    this.firedAt = -1e9;
    this.lastFire = null;
  }
}

// ---------------------------------------------------------------------------
// Desenho
// ---------------------------------------------------------------------------

/** Pontos de chao ao longo da linha, do primeiro passo ao alcance. */
const groundPoints = (
  toScreen: ToScreen,
  origin: Vec,
  dir: Vec,
  length: number,
): { start: [number, number]; end: [number, number] } => ({
  start: toScreen(origin.x + dir.x * 0.6, origin.y + dir.y * 0.6),
  end: toScreen(origin.x + dir.x * length, origin.y + dir.y * length),
});

const unitPerp = (a: [number, number], b: [number, number]): [number, number] => {
  const vx = b[0] - a[0];
  const vy = b[1] - a[1];
  const len = Math.hypot(vx, vy) || 1;
  return [-vy / len, vx / len];
};

/**
 * A LINHA DE MEDICAO no chao durante o levantamento: tracejado que fecha,
 * estacas a cada tile, a estaca do fim, e a cabeca de leitura correndo.
 */
export const drawSurveyGround = (
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
  if (length <= 0.6) return;
  const style = surveyStyle(progress);
  const { start, end } = groundPoints(toScreen, origin, dir, length);
  const [px, py] = unitPerp(start, end);
  ctx.save();
  ctx.lineCap = 'butt';
  // O fio tracejado.
  ctx.globalAlpha = style.alpha;
  ctx.strokeStyle = style.color;
  ctx.lineWidth = Math.max(1, (style.locked ? 1.6 : 1.1) * z);
  ctx.setLineDash([style.dash[0] * z, style.dash[1] * z]);
  ctx.lineDashOffset = reducedMotion ? 0 : -((nowMs / 40) % 200) * z;
  ctx.beginPath();
  ctx.moveTo(start[0], start[1]);
  ctx.lineTo(end[0], end[1]);
  ctx.stroke();
  ctx.setLineDash([]);
  // As ESTACAS: uma marca perpendicular a cada tile, do tamanho de meia
  // celula. E o que faz a linha ler como medicao, e nao como mira.
  ctx.lineWidth = Math.max(1, z);
  ctx.globalAlpha = style.alpha * 0.85;
  const tickHalf = (style.locked ? 4 : 3) * z;
  for (let d = 1; d <= length; d += 1) {
    const [tx, ty] = toScreen(origin.x + dir.x * d, origin.y + dir.y * d);
    ctx.beginPath();
    ctx.moveTo(tx - px * tickHalf, ty - py * tickHalf);
    ctx.lineTo(tx + px * tickHalf, ty + py * tickHalf);
    ctx.stroke();
  }
  // A estaca do FIM: um quadrado cheio onde a linha para (parede ou alcance).
  ctx.globalAlpha = Math.min(1, style.alpha + 0.2);
  ctx.fillStyle = style.color;
  const stake = Math.max(2, (style.locked ? 4 : 3) * z);
  ctx.fillRect(end[0] - stake / 2, end[1] - stake / 2, stake, stake);
  // A CABECA DE LEITURA.
  const t = readHeadT(progress, nowMs, reducedMotion);
  const hx = start[0] + (end[0] - start[0]) * t;
  const hy = start[1] + (end[1] - start[1]) * t;
  ctx.restore();
  drawEmissiveHalo(ctx, style.color, hx, hy, (8 + 6 * progress) * z, 0.35 + 0.4 * progress);
  ctx.save();
  ctx.globalAlpha = Math.min(1, 0.7 + 0.3 * progress);
  ctx.fillStyle = PAL.player;
  const dot = Math.max(2, 2.5 * z);
  ctx.fillRect(hx - dot / 2, hy - dot / 2, dot, dot);
  ctx.restore();
};

/**
 * O FIO do levantamento no ar: da lente ate a cabeca de leitura no chao. Fino
 * e apagado — e um scanner, nao uma arma; a arma vem no ato seguinte.
 */
export const drawSurveyRay = (
  ctx: CanvasRenderingContext2D,
  lens: Vec,
  toScreen: ToScreen,
  origin: Vec,
  dir: Vec,
  length: number,
  progress: number,
  z: number,
  nowMs: number,
  reducedMotion: boolean,
): void => {
  if (length <= 0.6) return;
  const style = surveyStyle(progress);
  const { start, end } = groundPoints(toScreen, origin, dir, length);
  const t = readHeadT(progress, nowMs, reducedMotion);
  const hx = start[0] + (end[0] - start[0]) * t;
  const hy = start[1] + (end[1] - start[1]) * t;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = 0.18 + 0.32 * progress;
  ctx.strokeStyle = style.color;
  ctx.lineWidth = Math.max(1, (style.locked ? 1.4 : 1) * z);
  ctx.beginPath();
  ctx.moveTo(lens.x, lens.y);
  ctx.lineTo(hx, hy);
  ctx.stroke();
  ctx.restore();
  // A LENTE acesa: cresce e, travada, pulsa.
  const pulse = style.locked && !reducedMotion ? 0.8 + 0.2 * Math.sin(nowMs / 45) : 1;
  // Pequena de proposito: a lente e um ponto aceso no alto do mastro, nao um
  // farol — um halo largo aqui lavava o chassi inteiro de branco.
  drawEmissiveHalo(
    ctx,
    style.color,
    lens.x,
    lens.y,
    (4 + 5 * progress) * z,
    (0.25 + 0.45 * progress) * pulse,
  );
};

/**
 * A COLUNA com potencia: da lente ate o fim da linha no chao, em quatro
 * camadas somadas (halo largo, corpo, nucleo, cintilacao). `intensity` e 0..1
 * — cheia no release e esfriando pela recuperacao e pelo brilho residual.
 */
export const drawBeamBody = (
  ctx: CanvasRenderingContext2D,
  lens: Vec,
  end: [number, number],
  intensity: number,
  colors: BeamColors,
  z: number,
  nowMs: number,
  reducedMotion: boolean,
): void => {
  const k = Math.max(0, Math.min(1, intensity));
  if (k <= 0.01) return;
  const [px, py] = unitPerp([lens.x, lens.y], end);
  const wobble = reducedMotion ? 0 : Math.sin(nowMs / 23) * 0.9 * z * k;
  const line = (width: number, color: string, alpha: number, offset = 0): void => {
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(1, width);
    ctx.beginPath();
    ctx.moveTo(lens.x + px * offset, lens.y + py * offset);
    ctx.lineTo(end[0] + px * offset, end[1] + py * offset);
    ctx.stroke();
  };
  ctx.save();
  ctx.lineCap = 'round';
  ctx.globalCompositeOperation = 'lighter';
  line(16 * z * (0.6 + 0.4 * k), colors.edge, 0.22 * k);
  line(8 * z, colors.mid, 0.5 * k);
  line(3 * z, colors.core, 0.95 * k, wobble);
  // A CINTILACAO: pontos claros correndo pela coluna, o filamento vibrando.
  if (!reducedMotion) {
    ctx.globalAlpha = 0.8 * k;
    ctx.fillStyle = colors.core;
    const n = 7;
    for (let i = 0; i < n; i++) {
      const t = (i / n + ((nowMs / 260) % 1)) % 1;
      const sx = lens.x + (end[0] - lens.x) * t + px * wobble * 0.5;
      const sy = lens.y + (end[1] - lens.y) * t + py * wobble * 0.5;
      const s = Math.max(2, 2 * z);
      ctx.fillRect(sx - s / 2, sy - s / 2, s, s);
    }
  }
  ctx.restore();
  // A lente estourando de luz e o IMPACTO no fim.
  drawEmissiveHalo(ctx, colors.mid, lens.x, lens.y, 22 * z * k, 0.9 * k);
  drawEmissiveHalo(ctx, colors.edge, end[0], end[1], 26 * z * k, 0.8 * k);
};

/** O chao ACESO ao longo da linha durante a passagem. */
export const drawFireGround = (
  ctx: CanvasRenderingContext2D,
  toScreen: ToScreen,
  origin: Vec,
  dir: Vec,
  length: number,
  intensity: number,
  colors: BeamColors,
  z: number,
): void => {
  const k = Math.max(0, Math.min(1, intensity));
  if (k <= 0.01 || length <= 0.6) return;
  const { start, end } = groundPoints(toScreen, origin, dir, length);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  ctx.globalAlpha = 0.5 * k;
  ctx.strokeStyle = colors.ground;
  ctx.lineWidth = Math.max(2, 7 * z);
  ctx.beginPath();
  ctx.moveTo(start[0], start[1]);
  ctx.lineTo(end[0], end[1]);
  ctx.stroke();
  ctx.globalAlpha = 0.9 * k;
  ctx.strokeStyle = colors.core;
  ctx.lineWidth = Math.max(1, 2 * z);
  ctx.stroke();
  ctx.restore();
  for (let d = 2; d < length; d += 2.5) {
    const [hx, hy] = toScreen(origin.x + dir.x * d, origin.y + dir.y * d);
    drawEmissiveHalo(ctx, colors.mid, hx, hy, 12 * z, 0.35 * k);
  }
};

/**
 * A CICATRIZ: a linha ESFRIANDO. Nasce como um fio quente (osso, fino) que some
 * em meio segundo, e por baixo dele as brasas — pontos densos na linha, do
 * amarelo ao vermelho ate apagar — com um halo baixo que desaparece na
 * primeira metade. O risco escuro de fuligem por baixo de tudo so aparece em
 * chao claro; em chao escuro sao as brasas que contam onde a linha esteve.
 */
export const drawScorch = (
  ctx: CanvasRenderingContext2D,
  toScreen: ToScreen,
  mark: ScorchMark,
  z: number,
  nowMs: number,
): void => {
  const age = (nowMs - mark.at) / SCORCH_MS;
  if (age < 0 || age >= 1 || mark.length <= 0.6) return;
  const fade = 1 - age;
  const { start, end } = groundPoints(toScreen, mark, { x: mark.dx, y: mark.dy }, mark.length);
  ctx.save();
  ctx.lineCap = 'round';
  // A fuligem.
  ctx.globalAlpha = 0.5 * fade;
  ctx.strokeStyle = PAL.dark;
  ctx.lineWidth = Math.max(2, 6 * z);
  ctx.beginPath();
  ctx.moveTo(start[0], start[1]);
  ctx.lineTo(end[0], end[1]);
  ctx.stroke();
  // O fio quente, sumindo rapido.
  const hot = Math.max(0, 1 - age / 0.5);
  if (hot > 0) {
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.7 * hot;
    ctx.strokeStyle = PAL.player;
    ctx.lineWidth = Math.max(1, 1.5 * z);
    ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';
  }
  // As brasas, do amarelo ao vermelho.
  ctx.globalAlpha = Math.min(1, 0.95 * fade + 0.05);
  ctx.fillStyle = mixHex(PAL.loot, PAL.blood, Math.min(1, age * 0.9));
  const s = Math.max(2, 3.5 * z * (0.6 + 0.4 * fade));
  for (let d = 0.8; d < mark.length; d += 0.45) {
    const [ex, ey] = toScreen(mark.x + mark.dx * d, mark.y + mark.dy * d);
    const seed = Math.round(d * 20) * 7919;
    const jx = ((seed % 7) - 3) * 0.5 * z;
    const jy = (((seed >> 3) % 5) - 2) * 0.4 * z;
    // Brasas apagam uma a uma, nao todas juntas.
    if ((seed % 11) / 11 > fade + 0.15) continue;
    ctx.fillRect(ex + jx - s / 2, ey + jy - s / 2, s, s);
  }
  ctx.restore();
  // O calor baixo sobre a linha, na primeira metade.
  const glow = Math.max(0, 1 - age * 2);
  if (glow > 0) {
    for (let d = 1.5; d < mark.length; d += 2.5) {
      const [hx, hy] = toScreen(mark.x + mark.dx * d, mark.y + mark.dy * d);
      drawEmissiveHalo(ctx, PAL.fire, hx, hy, 12 * z, 0.45 * glow);
    }
  }
};
