import type { AbilityId } from '@voxelyn/survival-sim';

/** A single 32-unit drawing feeds cards, world markers and both control HUDs. */
export const ABILITY_ICON_PATHS: Record<AbilityId, string> = {
  pulse: 'M13 13H19V19H13Z M8 8L5 11V21L8 24 M24 8L27 11V21L24 24 M11 4H21 M11 28H21',
  flamethrower:
    'M5 19L10 14L13 17L8 22Z M13 15L16 7L19 11L24 4L23 13L28 12L25 22L18 27L12 24 M16 22L20 16L20 22',
  seeker:
    'M12 13H20V21H12Z M16 21V27L20 23 M12 13L7 8 M20 13L25 8 M12 20L7 24 M20 20L25 24 M3 6H11V10H3Z M21 6H29V10H21Z M3 22H11V26H3Z M21 22H29V26H21Z',
  arc: 'M2 4H8V10H2Z M24 3H30V9H24Z M23 23H29V29H23Z M8 7L16 11L13 16L24 6 M16 14L20 19L17 23L23 26',
  seismic: 'M3 24H10L13 17L17 28L21 21H29 M5 18L10 13 M27 18L22 13 M12 7H20V13H12Z M16 2V5',
  slipstream: 'M2 9H10 M1 16H7 M3 23H11 M15 6L25 16L15 26 M22 6L31 16L22 26 M11 11L16 16L11 21',
  vent: 'M9 11H23V23H9Z M12 15H20 M12 19H20 M16 3V8 M12 6L16 2L20 6 M4 14L1 17L4 20 M28 14L31 17L28 20 M13 26V30 M19 26V30',
};

export const abilityIconSvg = (id: AbilityId): string =>
  `<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="miter" stroke-linecap="square" aria-hidden="true"><path d="${ABILITY_ICON_PATHS[id]}"/></svg>`;

const paths = new Map<AbilityId, Path2D>();
export const drawAbilityGlyph = (
  ctx: CanvasRenderingContext2D,
  id: AbilityId,
  x: number,
  y: number,
  size: number,
  color: string,
  /** Rotacao e opacidade extras: so o re-eco usa. */
  pose: { angle?: number; alpha?: number } = {},
): boolean => {
  if (typeof Path2D === 'undefined') return false;
  if (size <= 0.01 || (pose.alpha ?? 1) <= 0.001) return true;
  let path = paths.get(id);
  if (!path) {
    path = new Path2D(ABILITY_ICON_PATHS[id]);
    paths.set(id, path);
  }
  ctx.save();
  ctx.globalAlpha *= pose.alpha ?? 1;
  ctx.translate(x, y);
  if (pose.angle) ctx.rotate(pose.angle);
  ctx.translate(-size / 2, -size / 2);
  ctx.scale(size / 32, size / 32);
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.8;
  ctx.lineJoin = 'miter';
  ctx.lineCap = 'square';
  ctx.stroke(path);
  ctx.restore();
  return true;
};

// ---------------------------------------------------------------------------
// O RE-ECO: a troca de habilidade no botao
// ---------------------------------------------------------------------------
// Sintonizar um Eco trocava o glifo do botao entre um quadro e o outro, e o
// jogador que estava olhando os cards nao via nada mudar na mao. O re-eco e
// a mesma troca contada em ~0,7 s: o glifo antigo se contrai girando e some,
// um anel na cor do novo Eco abre, e o glifo novo nasce girando de volta.
// Tudo aqui e funcao pura do tempo — o teste le os quadros sem canvas.

export const ABILITY_MORPH_MS = 720;
/** A metade em que o velho some e o novo ainda nao nasceu. */
const MORPH_SPLIT = 0.45;

export type AbilityMorphFrame = {
  outScale: number;
  outAlpha: number;
  outAngle: number;
  inScale: number;
  inAlpha: number;
  inAngle: number;
  /** Raio do anel, em fracao do tamanho do glifo (0,5 → 1,2). */
  ring: number;
  ringAlpha: number;
};

const easeOutBack = (t: number): number => {
  const c = 1.7;
  const u = t - 1;
  return 1 + (c + 1) * u * u * u + c * u * u;
};

/** Fase 0..1 do re-eco em `nowMs`, ou null fora da janela. */
export const abilityMorphPhase = (startMs: number, nowMs: number): number | null => {
  const t = (nowMs - startMs) / ABILITY_MORPH_MS;
  return t >= 0 && t < 1 ? t : null;
};

export const abilityMorphFrame = (t: number): AbilityMorphFrame => {
  const p = Math.max(0, Math.min(1, t));
  const out = Math.min(1, p / MORPH_SPLIT);
  const inn = Math.max(0, (p - MORPH_SPLIT) / (1 - MORPH_SPLIT));
  return {
    outScale: p < MORPH_SPLIT ? 1 - out * 0.65 : 0,
    outAlpha: p < MORPH_SPLIT ? 1 - out : 0,
    outAngle: out * Math.PI * 0.5,
    inScale: p < MORPH_SPLIT ? 0 : Math.max(0, Math.min(1.08, easeOutBack(inn))),
    inAlpha: p < MORPH_SPLIT ? 0 : Math.min(1, inn / 0.4),
    inAngle: p < MORPH_SPLIT ? 0 : (1 - inn) * -Math.PI * 0.5,
    ring: 0.5 + p * 0.7,
    ringAlpha: p < MORPH_SPLIT ? out * 0.9 : (1 - inn) * 0.9,
  };
};

/** Desenha um quadro do re-eco: glifo velho saindo, anel, glifo novo entrando. */
export const drawAbilityMorph = (
  ctx: CanvasRenderingContext2D,
  from: AbilityId,
  to: AbilityId,
  t: number,
  x: number,
  y: number,
  size: number,
  colorFrom: string,
  colorTo: string,
): boolean => {
  const f = abilityMorphFrame(t);
  ctx.save();
  ctx.globalAlpha *= f.ringAlpha;
  ctx.strokeStyle = colorTo;
  ctx.lineWidth = Math.max(1.5, size * 0.06);
  ctx.beginPath();
  ctx.arc(x, y, size * f.ring, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
  const drewOut = drawAbilityGlyph(ctx, from, x, y, size * f.outScale, colorFrom, {
    angle: f.outAngle,
    alpha: f.outAlpha,
  });
  const drewIn = drawAbilityGlyph(ctx, to, x, y, size * f.inScale, colorTo, {
    angle: f.inAngle,
    alpha: f.inAlpha,
  });
  return drewOut && drewIn;
};

/**
 * Observa a habilidade equipada quadro a quadro e diz quando desenhar o
 * re-eco. Um por botao (toque e desktop tem o proprio). `key` e a identidade
 * da run: uma run nova comeca no pulso sem "trocar" da habilidade da run
 * anterior.
 */
export class AbilityMorphTracker {
  private key: unknown = null;
  private last: AbilityId | null = null;
  private from: AbilityId | null = null;
  private startMs = 0;

  observe(
    key: unknown,
    ability: AbilityId,
    nowMs: number,
  ): { from: AbilityId; to: AbilityId; t: number } | null {
    if (key !== this.key || this.last === null) {
      this.key = key;
      this.last = ability;
      this.from = null;
      return null;
    }
    if (ability !== this.last) {
      // Troca no meio de um re-eco: o quadro atual do novo vira o "velho".
      this.from = this.last;
      this.last = ability;
      this.startMs = nowMs;
    }
    if (this.from === null) return null;
    const t = abilityMorphPhase(this.startMs, nowMs);
    if (t === null) {
      this.from = null;
      return null;
    }
    return { from: this.from, to: ability, t };
  }
}

/**
 * O anel de HABILIDADE ATIVA (a Disparada correndo): pulsa na cor do Eco em
 * volta do glifo enquanto o relogio vive. `remaining` em 0..1.
 */
export const drawAbilityActiveRing = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  color: string,
  remaining: number,
  nowMs: number,
): void => {
  const pulse = 0.55 + 0.35 * Math.sin(nowMs * 0.012);
  ctx.save();
  ctx.globalAlpha *= pulse;
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(2, radius * 0.1);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(
    x,
    y,
    radius,
    -Math.PI / 2,
    -Math.PI / 2 + Math.PI * 2 * Math.max(0, Math.min(1, remaining)),
  );
  ctx.stroke();
  ctx.restore();
};
