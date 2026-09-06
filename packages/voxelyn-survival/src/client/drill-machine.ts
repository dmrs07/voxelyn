// A BROCA DO DIAMANDIS COMO MAQUINA, do lado de quem ve.
//
// A simulacao (diamandis-drill.ts, na sim) ja conta a historia inteira em
// ticks: o chassi que GIRA ate o corredor e trava, a broca que acelera antes
// de sair, a corrida com peso (solavanco, aceleracao, maximo, derrapagem), a
// ponta que fere, o impacto no que ela nao come, o recuo e a recuperacao.
// Este modulo nao inventa nada disso — ele LE o mesmo relogio e o traduz em:
//
//   TELEGRAFO   o chao avisando: cascalho vibrando ao longo da faixa, rachas
//               finas nascendo do pe do chefe, chevrons curtos e apagados. Sem
//               raio grande, sem branco: o aviso mostra a faixa inteira sem
//               esconder o chefe.
//   POSE        o chassi reagindo ao torque: comprime para tras como mola
//               carregada no spool, mergulha o nariz na aceleracao, chacoalha
//               com a rotacao, esmaga no impacto. E uma transformacao em volta
//               do pe — o sprite continua sendo o sprite.
//   PASSADA     o andar hidraulico: o quadro do `walk` vem da DISTANCIA
//               percorrida, nao do relogio — os pes nunca deslizam.
//   GIRO        a pose da broca (oito fases discretas do atlas) vem da fase
//               acumulada do giro, a mesma curva que o som le. Acelerando, as
//               poses passam cada vez mais depressa; no maximo, saltam.
//   RASTRO      marcas de arrasto paralelas e persistentes atras dos pes, a
//               cicatriz do impacto, tudo com borda dura.
//   POEIRA      baixa e densa atras do chassi (nas particulas), entulho para
//               os lados e para tras; so as faiscas da ponta e do mancal
//               chegam ao branco.
//
// Tudo o que precisa de memoria (marcas, impactos, o spin-down da
// recuperacao) vive em `DrillPresentation`, alimentado pelos eventos
// `boss_state` da broca — que viajam no wire, entao o parceiro do co-op ve o
// mesmo. Com movimento reduzido: sem chacoalho, sem vibracao de cascalho, sem
// mergulho de nariz; o resto fica.
import type { EntityAction, SemanticEvent } from '@voxelyn/survival-sim';
import {
  DIAMANDIS_DRILL_ALIGN_TICKS,
  DIAMANDIS_DRILL_RECOIL_TICKS,
  DIAMANDIS_DRILL_RUN_TILES,
  DIAMANDIS_DRILL_SKID_RECOVERY_TICKS,
  DIAMANDIS_DRILL_TICKS,
  DIAMANDIS_DRILL_TIP_AHEAD,
  DIAMANDIS_DRILL_WALL_RECOVERY_TICKS,
  DIAMANDIS_DRILL_WIDTH,
  TICK_HZ,
  drillSpeedFractionAt,
  drillSpinAt,
  drillSpinDown,
  drillStepAt,
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

/** Quanto o avanco percorre, em tiles — o mesmo numero da simulacao. */
export const DRILL_RUN_TILES = DIAMANDIS_DRILL_RUN_TILES;
/** Meia largura do corredor aberto, em tiles (a broca abre `2w + 1` celulas). */
export const DRILL_LANE_HALF = DIAMANDIS_DRILL_WIDTH + 0.5;
/** Onde a PONTA da broca fica a frente do centro do chefe, em tiles. */
export const DRILL_TIP_AHEAD = DIAMANDIS_DRILL_TIP_AHEAD;
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

// ---------------------------------------------------------------------------
// O giro
// ---------------------------------------------------------------------------

/** Voltas por tick na rotacao maxima: 12 voltas por segundo. */
export const DRILL_TURNS_PER_TICK = 0.6;

/**
 * A FASE ACUMULADA do giro, em voltas, integrando `drillSpinAt` tick a tick
 * desde o inicio da acao ate `tick` (fracionario: o resto do tick corrente
 * entra proporcional). E dela que sai a pose da broca — e por ser integral,
 * a broca que acelera troca de pose cada vez mais depressa, sem que
 * nenhum relogio do cliente decida o ritmo.
 */
export const drillSpinPhase = (action: EntityAction, tick: number, impactAt = -1): number => {
  const whole = Math.floor(tick);
  let turns = 0;
  for (let t = action.startedAt; t < whole; t++) {
    turns += drillSpinAt(action, t, impactAt) * DRILL_TURNS_PER_TICK;
  }
  turns += drillSpinAt(action, whole, impactAt) * DRILL_TURNS_PER_TICK * (tick - whole);
  return turns;
};

/** A pose discreta (0..frames-1) para uma fase em voltas. */
export const drillPoseFrame = (turns: number, frames: number): number => {
  const f = Math.floor(((turns % 1) + 1) * frames) % frames;
  return f;
};

// ---------------------------------------------------------------------------
// A passada
// ---------------------------------------------------------------------------

/** Quanto o chassi anda por ciclo completo do `walk`, em tiles. */
export const DRILL_STRIDE_TILES = 1.4;

/** Distancia percorrida na corrida ate o tick `k` (inteiro) desde o release. */
export const drillDistanceAt = (k: number): number => {
  let d = 0;
  for (let i = 0; i < k; i++) d += drillStepAt(i);
  return d;
};

/**
 * O relogio SINTETICO do `walk` para uma distancia percorrida: devolve um
 * `elapsedMs` que cai no quadro certo do ciclo. O pe so troca de quadro
 * quando o corpo andou o bastante — e por isso ele nunca desliza.
 */
export const drillGaitMs = (
  distanceTiles: number,
  frames: number,
  fps: number,
  strideTiles = DRILL_STRIDE_TILES,
): number => {
  const frame = Math.floor((distanceTiles / strideTiles) * frames) % frames;
  return ((frame + 0.5) / fps) * 1000;
};

// ---------------------------------------------------------------------------
// A pose do chassi
// ---------------------------------------------------------------------------

export type ChassisPose = {
  /** Compressao vertical, 0..1 (0,25 = esmagado um quarto). */
  squash: number;
  /** Inclinacao: positivo = nariz para baixo (frente afunda), negativo = recua. */
  pitch: number;
  /** Amplitude do chacoalho, em pixels de mundo (x zoom). */
  rattle: number;
  /** Fracao da rotacao da broca, 0..1 — o que o som e a broca leem. */
  spin: number;
};

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);

/**
 * Como o chassi REAGE ao que a maquina esta fazendo neste tick.
 *
 *   alinhamento  quase parado; um tremor fino do mancal;
 *   spool        comprime PARA TRAS (mola carregada), chacoalha com o giro;
 *   corrida      nariz para baixo proporcional a ACELERACAO (o solavanco e o
 *                pico), levantando na derrapagem (freio);
 *   impacto      esmaga por dois ou tres compassos e solta;
 *   recuperacao  chacoalho que morre com o spin-down.
 *
 * `sinceImpactTicks` < 0 quando nao houve impacto. `recovery` descreve a
 * recuperacao depois da acao (spin-down), quando a acao ja nao existe.
 */
export const chassisPoseAt = (
  action: EntityAction | null,
  tick: number,
  impactAt: number,
  recovery: { from: number; sinceTicks: number; ticks: number } | null,
  reducedMotion: boolean,
): ChassisPose => {
  if (!action || action.kind !== 'drill') {
    if (recovery) {
      const spin = drillSpinDown(recovery.from, recovery.sinceTicks, recovery.ticks);
      return { squash: 0, pitch: 0, rattle: reducedMotion ? 0 : spin * 1.6, spin };
    }
    return { squash: 0, pitch: 0, rattle: 0, spin: 0 };
  }
  const spin = drillSpinAt(action, tick, impactAt);
  const rattle = reducedMotion ? 0 : spin * spin * 2.2;
  if (tick < action.releaseAt) {
    const t = tick - action.startedAt;
    if (t < DIAMANDIS_DRILL_ALIGN_TICKS) return { squash: 0, pitch: 0, rattle: rattle * 0.5, spin };
    // A mola: quanto mais giro, mais o corpo senta para tras.
    const load = clamp01((spin - 0.05) / 0.75);
    return { squash: 0.12 * load, pitch: -0.6 * load, rattle, spin };
  }
  if (impactAt >= 0 && tick >= impactAt) {
    const since = tick - impactAt;
    // Esmaga por ~3 compassos (6 ticks) e solta ao longo do recuo.
    const crush =
      since < 6 ? 1 - since / 12 : Math.max(0, 0.5 - (since - 6) / DIAMANDIS_DRILL_RECOIL_TICKS);
    return { squash: 0.28 * crush, pitch: 1 * crush, rattle: rattle + crush * 2, spin };
  }
  const k = tick - action.releaseAt;
  const k0 = Math.floor(k);
  const accel = drillSpeedFractionAt(k0 + 1) - drillSpeedFractionAt(k0);
  // A aceleracao de um tick e pequena (centesimos); escala para uma
  // inclinacao legivel, com o solavanco do primeiro tick a mais.
  const lurch = k < 2 ? 0.5 : 0;
  const pitch = clamp01(accel * 14 + lurch) - clamp01(-accel * 10) * 0.8;
  return {
    squash: 0.04 * drillSpeedFractionAt(k0),
    pitch: reducedMotion ? 0 : pitch,
    rattle,
    spin,
  };
};

// ---------------------------------------------------------------------------
// O telegrafo no chao
// ---------------------------------------------------------------------------

/** A partir de que fracao do preparo a faixa "trava" (o rumo esta fixo). */
export const LANE_LOCK_AT = DIAMANDIS_DRILL_ALIGN_TICKS / 36;

export type LaneStyle = { color: string; alpha: number; locked: boolean };

/** Como a faixa se veste conforme o preparo avanca — apagada, sem brilho. */
export const laneStyle = (progress: number): LaneStyle => {
  const p = clamp01(progress);
  const locked = p >= LANE_LOCK_AT;
  return { color: locked ? PAL.fire : PAL.loot, alpha: 0.16 + 0.3 * p, locked };
};

export type GravelGrain = { along: number; lateral: number; jitter: number; size: number };

const hash = (n: number): number => {
  let s = (n | 0) ^ 0x9e3779b9;
  s = Math.imul(s ^ (s >>> 16), 0x85ebca6b);
  s = Math.imul(s ^ (s >>> 13), 0xc2b2ae35);
  return ((s ^ (s >>> 16)) >>> 0) / 4294967296;
};

/**
 * O CASCALHO da faixa: graos fixos (semeados pela origem) que VIBRAM com o
 * giro — o chao sente a maquina antes de ela sair. `jitter` e o deslocamento
 * lateral do grao neste instante, em tiles; zero com movimento reduzido.
 */
export const gravelAt = (
  seed: number,
  length: number,
  spin: number,
  nowMs: number,
  reducedMotion: boolean,
): GravelGrain[] => {
  const out: GravelGrain[] = [];
  const count = Math.min(60, Math.round(length * 4));
  for (let i = 0; i < count; i++) {
    const along = 1 + hash(seed + i * 7) * Math.max(0.1, length - 1.5);
    const lateral = (hash(seed + i * 7 + 1) - 0.5) * 2 * DRILL_LANE_HALF * 0.9;
    const phase = hash(seed + i * 7 + 2) * Math.PI * 2;
    const amp = reducedMotion ? 0 : 0.06 * spin * spin;
    const jitter = amp * Math.sin(nowMs * 0.05 * (1 + spin) + phase);
    out.push({ along, lateral, jitter, size: 0.5 + hash(seed + i * 7 + 3) * 0.7 });
  }
  return out;
};

export type Fracture = { points: Vec[] };

/**
 * RACHAS FINAS nascendo do pe do chefe no rumo do corredor: crescem com o
 * preparo (0..1) e ficam. Cada uma e uma polilinha de tres a cinco segmentos
 * em coordenadas locais (along, lateral), em tiles.
 */
export const fracturesAt = (seed: number, growth: number): Fracture[] => {
  const g = clamp01(growth);
  const out: Fracture[] = [];
  for (let f = 0; f < 4; f++) {
    const base = seed + f * 31;
    const spread = (f - 1.5) * 0.45;
    const points: Vec[] = [{ x: 0.9, y: spread * 0.4 }];
    const segments = 3 + (f % 2);
    for (let s = 1; s <= segments; s++) {
      const reach = 0.9 + (s / segments) * (2.2 + hash(base + s) * 1.6) * g;
      const lat = spread + (hash(base + s + 100) - 0.5) * 0.5 * s * 0.4;
      points.push({ x: reach, y: lat });
    }
    out.push({ points });
  }
  return out;
};

/**
 * Desenha o TELEGRAFO: faixa apagada, cascalho vibrando, rachas e chevrons
 * curtos. O chefe fica visivel — nada aqui tem brilho nem cobre o corpo.
 */
export const drawDrillTelegraph = (
  ctx: CanvasRenderingContext2D,
  toScreen: ToScreen,
  origin: Vec,
  dir: Vec,
  length: number,
  progress: number,
  spin: number,
  z: number,
  nowMs: number,
  reducedMotion: boolean,
): void => {
  const style = laneStyle(progress);
  const side = { x: -dir.y, y: dir.x };
  const local = (along: number, lateral: number): [number, number] =>
    toScreen(
      origin.x + dir.x * along + side.x * lateral,
      origin.y + dir.y * along + side.y * lateral,
    );
  const seed = Math.round(origin.x * 8) * 131 + Math.round(origin.y * 8) * 17;
  ctx.save();
  // As BORDAS da faixa: duas linhas finas, sem tracejado correndo.
  ctx.strokeStyle = style.color;
  ctx.globalAlpha = style.alpha;
  ctx.lineWidth = Math.max(1, z);
  for (const s of [-1, 1]) {
    const a = local(0.6, s * DRILL_LANE_HALF);
    const b = local(length, s * DRILL_LANE_HALF);
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(b[0], b[1]);
    ctx.stroke();
  }
  // CHEVRONS curtos, apagados, a cada dois tiles e meio — o rumo, sem gritar.
  ctx.globalAlpha = style.alpha * 0.8;
  ctx.lineWidth = Math.max(1, 1.2 * z);
  for (let d = 2.2; d < length - 0.4; d += 2.5) {
    const tip = local(d, 0);
    const l = local(d - 0.45, 0.4);
    const r = local(d - 0.45, -0.4);
    ctx.beginPath();
    ctx.moveTo(l[0], l[1]);
    ctx.lineTo(tip[0], tip[1]);
    ctx.lineTo(r[0], r[1]);
    ctx.stroke();
  }
  // O CASCALHO: cubinhos duros que vibram com o giro.
  ctx.globalAlpha = 0.55 + 0.3 * progress;
  const grainPx = Math.max(1, 1.6 * z);
  for (const g of gravelAt(seed, length, spin, nowMs, reducedMotion)) {
    const [gx, gy] = local(g.along, g.lateral + g.jitter);
    const s = grainPx * g.size;
    ctx.fillStyle = PAL.rockLight;
    ctx.fillRect(Math.round(gx - s / 2), Math.round(gy - s / 2), Math.ceil(s), Math.ceil(s * 0.6));
    ctx.fillStyle = PAL.rockShadow;
    ctx.fillRect(
      Math.round(gx - s / 2),
      Math.round(gy + s * 0.1),
      Math.ceil(s),
      Math.max(1, Math.ceil(s * 0.3)),
    );
  }
  // As RACHAS: linhas finas e escuras a partir do pe, crescendo com o preparo.
  ctx.strokeStyle = PAL.rockShadow;
  ctx.globalAlpha = 0.5 + 0.4 * progress;
  ctx.lineWidth = Math.max(1, 0.9 * z);
  for (const f of fracturesAt(seed, progress)) {
    ctx.beginPath();
    f.points.forEach((p, i) => {
      const [px, py] = local(p.x, p.y);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.stroke();
  }
  ctx.restore();
};

// ---------------------------------------------------------------------------
// As marcas no chao, o impacto e a recuperacao
// ---------------------------------------------------------------------------

export type GroundMark = {
  kind: 'drag' | 'scar' | 'scrape';
  x: number;
  y: number;
  dx: number;
  dy: number;
  length: number;
  bornMs: number;
};

export type DrillImpact = {
  kind: 'wall' | 'skid' | 'strike';
  x: number;
  y: number;
  dx: number;
  dy: number;
  intensity: number;
  bornMs: number;
};

/** Quanto tempo cada marca fica, em ms. */
export const DRAG_MS = 24000;
export const SCAR_MS = 60000;
/** Distancia entre pares de marcas de arrasto (uma por bucket de tempo). */
export const DRAG_EVERY_MS = 45;
/** Afastamento lateral das duas esteiras de arrasto, em tiles. */
export const DRAG_HALF = 0.55;

/**
 * O que a broca deixa e o que ela fez de ultimo: marcas, impactos e a
 * recuperacao (o spin-down que continua depois de a acao morrer).
 */
export class DrillPresentation {
  marks: GroundMark[] = [];
  impacts: DrillImpact[] = [];
  /** A recuperacao em curso: de onde o giro cai e quando comecou. */
  recovery: { from: number; startMs: number; ticks: number } | null = null;
  /** Tick (em ms de parede) do ultimo `drill_lock`, para o clique visual. */
  lockedAtMs = -1;
  private lastDragBucket = -1;
  private lastDragAt: Vec | null = null;

  reset(): void {
    this.marks = [];
    this.impacts = [];
    this.recovery = null;
    this.lockedAtMs = -1;
    this.lastDragBucket = -1;
    this.lastDragAt = null;
  }

  /**
   * Le os momentos da broca. Devolve os impactos NOVOS para o render soltar
   * luz, particulas e o solavanco de camera.
   */
  ingest(events: readonly SemanticEvent[], nowMs: number): DrillImpact[] {
    const born: DrillImpact[] = [];
    for (const ev of events) {
      if (ev.t !== 'boss_state' || ev.archetype !== 'diamandis') continue;
      const dx = ev.dx ?? 1;
      const dy = ev.dy ?? 0;
      if (ev.state === 'drill_impact') {
        const impact: DrillImpact = {
          kind: 'wall',
          x: ev.x,
          y: ev.y,
          dx,
          dy,
          intensity: ev.intensity ?? 1,
          bornMs: nowMs,
        };
        this.impacts.push(impact);
        born.push(impact);
        this.marks.push({ kind: 'scar', x: ev.x, y: ev.y, dx, dy, length: 1.2, bornMs: nowMs });
        this.recovery = {
          from: 0.15,
          startMs: nowMs + (DIAMANDIS_DRILL_RECOIL_TICKS * 1000) / TICK_HZ,
          ticks: DIAMANDIS_DRILL_WALL_RECOVERY_TICKS,
        };
        this.lastDragAt = null;
      } else if (ev.state === 'drill_skid') {
        const impact: DrillImpact = {
          kind: 'skid',
          x: ev.x,
          y: ev.y,
          dx,
          dy,
          intensity: ev.intensity ?? 0.3,
          bornMs: nowMs,
        };
        this.impacts.push(impact);
        born.push(impact);
        // A derrapagem deixa duas marcas mais longas e tortas a frente dos pes.
        const side = { x: -dy, y: dx };
        for (const s of [-1, 1]) {
          this.marks.push({
            kind: 'scrape',
            x: ev.x + side.x * s * DRAG_HALF - dx * 0.6,
            y: ev.y + side.y * s * DRAG_HALF - dy * 0.6,
            dx,
            dy,
            length: 1.1,
            bornMs: nowMs,
          });
        }
        this.recovery = { from: 0.85, startMs: nowMs, ticks: DIAMANDIS_DRILL_SKID_RECOVERY_TICKS };
        this.lastDragAt = null;
      } else if (ev.state === 'drill_strike') {
        const impact: DrillImpact = {
          kind: 'strike',
          x: ev.x,
          y: ev.y,
          dx,
          dy,
          intensity: ev.intensity ?? 1,
          bornMs: nowMs,
        };
        this.impacts.push(impact);
        born.push(impact);
      } else if (ev.state === 'drill_lock') {
        this.lockedAtMs = nowMs;
      } else if (ev.state === 'drill_bearing') {
        // O clique e som e um tremor do corpo; nada a guardar.
      }
    }
    return born;
  }

  /**
   * Uma passada da corrida: deixa o par de marcas de arrasto entre a ultima
   * posicao registrada e a atual. Chamado por quadro durante o avanco; so
   * grava a cada `DRAG_EVERY_MS`.
   */
  drag(x: number, y: number, dir: Vec, nowMs: number): void {
    const bucket = (nowMs / DRAG_EVERY_MS) | 0;
    if (bucket === this.lastDragBucket) return;
    this.lastDragBucket = bucket;
    const last = this.lastDragAt;
    this.lastDragAt = { x, y };
    if (!last) return;
    const len = Math.hypot(x - last.x, y - last.y);
    if (len < 0.02) return;
    const side = { x: -dir.y, y: dir.x };
    for (const s of [-1, 1]) {
      this.marks.push({
        kind: 'drag',
        x: last.x + side.x * s * DRAG_HALF,
        y: last.y + side.y * s * DRAG_HALF,
        dx: dir.x,
        dy: dir.y,
        length: len,
        bornMs: nowMs,
      });
    }
    if (this.marks.length > 600) this.marks.splice(0, this.marks.length - 600);
  }

  /** A recuperacao neste instante, em ticks desde o inicio, ou null se acabou. */
  recoveryAt(nowMs: number): { from: number; sinceTicks: number; ticks: number } | null {
    const r = this.recovery;
    if (!r) return null;
    const sinceTicks = ((nowMs - r.startMs) / 1000) * TICK_HZ;
    if (sinceTicks < 0) return { from: r.from, sinceTicks: 0, ticks: r.ticks };
    if (sinceTicks >= r.ticks) {
      this.recovery = null;
      return null;
    }
    return { from: r.from, sinceTicks, ticks: r.ticks };
  }

  step(nowMs: number): void {
    this.marks = this.marks.filter(
      (m) => nowMs - m.bornMs < (m.kind === 'scar' ? SCAR_MS : DRAG_MS),
    );
    this.impacts = this.impacts.filter((i) => nowMs - i.bornMs < IMPACT_FX_MS);
  }
}

/** Quanto tempo o efeito de impacto (faiscas desenhadas, luz) vive. */
export const IMPACT_FX_MS = 700;

/** As marcas no chao: arrasto, raspagem e cicatriz — borda dura, sem degrade. */
export const drawGroundMarks = (
  ctx: CanvasRenderingContext2D,
  toScreen: ToScreen,
  marks: readonly GroundMark[],
  z: number,
  nowMs: number,
): void => {
  if (marks.length === 0) return;
  ctx.save();
  ctx.lineCap = 'butt';
  for (const m of marks) {
    const age = nowMs - m.bornMs;
    const life = m.kind === 'scar' ? SCAR_MS : DRAG_MS;
    const fade = clamp01(1 - age / life);
    if (fade <= 0) continue;
    const a = toScreen(m.x, m.y);
    const b = toScreen(m.x + m.dx * m.length, m.y + m.dy * m.length);
    if (m.kind === 'scar') {
      // A cicatriz: um sulco escuro e curto, com a borda clara de rocha
      // lascada de um lado — o ponto exato onde a ponta parou.
      const side = { x: -m.dy, y: m.dx };
      ctx.globalAlpha = 0.85 * fade;
      ctx.strokeStyle = PAL.rockShadow;
      ctx.lineWidth = Math.max(2, 3 * z);
      ctx.beginPath();
      ctx.moveTo(...toScreen(m.x - side.x * 0.6, m.y - side.y * 0.6));
      ctx.lineTo(...toScreen(m.x + side.x * 0.6, m.y + side.y * 0.6));
      ctx.stroke();
      ctx.strokeStyle = PAL.rockLight;
      ctx.lineWidth = Math.max(1, z);
      ctx.beginPath();
      ctx.moveTo(...toScreen(m.x - side.x * 0.5 - m.dx * 0.12, m.y - side.y * 0.5 - m.dy * 0.12));
      ctx.lineTo(...toScreen(m.x + side.x * 0.5 - m.dx * 0.12, m.y + side.y * 0.5 - m.dy * 0.12));
      ctx.stroke();
      // Fragmentos parados em volta: cubinhos.
      const s = Math.max(1, 1.5 * z);
      ctx.fillStyle = PAL.rockLight;
      for (let i = 0; i < 5; i++) {
        const [fx, fy] = toScreen(
          m.x - m.dx * (0.3 + hash(i * 3 + 1) * 0.9) + side.x * (hash(i * 3 + 2) - 0.5) * 1.6,
          m.y - m.dy * (0.3 + hash(i * 3 + 1) * 0.9) + side.y * (hash(i * 3 + 2) - 0.5) * 1.6,
        );
        ctx.fillRect(Math.round(fx), Math.round(fy), Math.ceil(s), Math.ceil(s * 0.6));
      }
      continue;
    }
    ctx.globalAlpha = (m.kind === 'scrape' ? 0.7 : 0.5) * fade;
    ctx.strokeStyle = PAL.rockShadow;
    ctx.lineWidth = Math.max(1, (m.kind === 'scrape' ? 2.2 : 1.6) * z);
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(b[0], b[1]);
    ctx.stroke();
  }
  ctx.restore();
};

/**
 * O IMPACTO visto: faiscas brancas curtas no ponto de contato (o unico branco
 * da broca, alem da ponta) e fragmentos de rocha saindo em leque para tras.
 * A derrapagem so levanta poeira (nas particulas) e nao passa por aqui.
 */
export const drawImpactSparks = (
  ctx: CanvasRenderingContext2D,
  toScreen: ToScreen,
  impact: DrillImpact,
  liftPx: number,
  z: number,
  nowMs: number,
): void => {
  if (impact.kind === 'skid') return;
  const age = (nowMs - impact.bornMs) / IMPACT_FX_MS;
  if (age >= 1) return;
  const [cx, cy0] = toScreen(impact.x, impact.y);
  const cy = cy0 - liftPx;
  const seed = Math.round(impact.x * 8) * 977 + Math.round(impact.y * 8) * 13;
  ctx.save();
  const hot = impact.kind === 'strike' ? PAL.fire : '#fff6e0';
  const count = 10 + Math.round(8 * impact.intensity);
  const s = Math.max(1, 1.2 * z);
  for (let i = 0; i < count; i++) {
    const t0 = hash(seed + i * 5) * 0.35;
    const t = (age - t0) / (1 - t0);
    if (t < 0 || t > 1) continue;
    // Para tras e para os lados do rumo, em arcos curtos que caem.
    const ang = Math.atan2(-impact.dy, -impact.dx) + (hash(seed + i * 5 + 1) - 0.5) * 2.2;
    const speed = 1.4 + hash(seed + i * 5 + 2) * 2.4 * impact.intensity;
    const dist = speed * t;
    const [px, py] = toScreen(impact.x + Math.cos(ang) * dist, impact.y + Math.sin(ang) * dist);
    const rise = Math.sin(Math.min(1, t) * Math.PI) * (0.5 + hash(seed + i * 5 + 3) * 0.6);
    const yy = py - liftPx - rise * 16 * z;
    ctx.globalAlpha = (1 - t) * (i % 3 === 0 ? 1 : 0.8);
    ctx.fillStyle = i % 3 === 0 ? hot : PAL.rockLight;
    ctx.fillRect(Math.round(px), Math.round(yy), Math.ceil(s), Math.ceil(s));
  }
  if (impact.kind === 'wall') {
    drawEmissiveHalo(ctx, PAL.fire, cx, cy, 14 * z, 0.5 * (1 - age));
  }
  ctx.restore();
};

/**
 * As FAISCAS DA PONTA e do mancal: cubinhos brancos minusculos, proporcionais
 * ao giro — o unico lugar onde a broca chega ao branco. `tipPx` e a ponta na
 * tela; `bearingPx` o mancal. Sem borrao: pontos discretos, semeados pelo
 * tempo, que nascem e somem.
 */
export const drawSpinSparks = (
  ctx: CanvasRenderingContext2D,
  tipPx: [number, number],
  bearingPx: [number, number],
  dirScreen: Vec,
  spin: number,
  z: number,
  nowMs: number,
  reducedMotion: boolean,
): void => {
  if (spin <= 0.2) return;
  const bucket = reducedMotion ? 0 : (nowMs / 40) | 0;
  const count = Math.round(2 + spin * 5);
  const s = Math.max(1, z);
  ctx.save();
  for (let i = 0; i < count; i++) {
    const h = hash(bucket * 17 + i * 3);
    const h2 = hash(bucket * 17 + i * 3 + 1);
    const atTip = i % 2 === 0;
    const [bx, by] = atTip ? tipPx : bearingPx;
    // Do mancal saem para tras; da ponta, para os lados.
    const ox = atTip ? (h - 0.5) * 10 * z * -dirScreen.y : -dirScreen.x * (2 + h * 6) * z;
    const oy = atTip
      ? (h - 0.5) * 5 * z * dirScreen.x - h2 * 4 * z
      : -dirScreen.y * (1 + h * 3) * z - h2 * 3 * z;
    ctx.globalAlpha = 0.5 + 0.5 * h2;
    ctx.fillStyle = i % 3 === 0 ? PAL.loot : '#fff6e0';
    ctx.fillRect(Math.round(bx + ox), Math.round(by + oy), Math.ceil(s), Math.ceil(s));
  }
  // Um brilho minimo na ponta, so no giro alto.
  if (spin > 0.75) drawEmissiveHalo(ctx, PAL.loot, tipPx[0], tipPx[1], 5 * z, (spin - 0.75) * 1.2);
  ctx.restore();
};

/** O quanto o tremor de camera de um impacto vale, antes do ajuste do jogador. */
export const impactShake = (impact: DrillImpact): { power: number; ms: number } => {
  if (impact.kind === 'wall') return { power: 5 + 4 * impact.intensity, ms: 260 };
  if (impact.kind === 'strike') return { power: 4, ms: 160 };
  return { power: 2.5, ms: 140 };
};

/** Quanto do tick corrente ja passou, para interpolar o giro entre ticks. */
export const tickFraction = (nowMs: number, tickStartedMs: number): number =>
  clamp01((nowMs - tickStartedMs) / (1000 / TICK_HZ));

export { DIAMANDIS_DRILL_TICKS };
