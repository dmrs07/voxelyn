import {
  ABILITY_COOLDOWN_TICKS,
  DODGE_COOLDOWN_TICKS,
  TICK_HZ,
  type SurvivalState,
} from '@voxelyn/survival-sim';
import type { InputState, TouchButton } from './input';

type CooldownButtonId = Extract<TouchButton['id'], 'dodge' | 'ability'>;

type CooldownSpec = {
  duration: number;
  readyAt: (state: SurvivalState) => number;
  accent: string;
};

const COOLDOWNS: Record<CooldownButtonId, CooldownSpec> = {
  dodge: {
    duration: DODGE_COOLDOWN_TICKS,
    readyAt: (state) => state.playerExtra.dodgeCooldownUntil,
    accent: '#e8f1ff',
  },
  ability: {
    duration: ABILITY_COOLDOWN_TICKS,
    readyAt: (state) => state.playerExtra.abilityCooldownUntil,
    accent: '#7ab8ff',
  },
};

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

/** Fração ainda bloqueada: 1 imediatamente após usar, 0 quando pronta. */
export const cooldownRemainingFraction = (readyAt: number, tick: number, duration: number): number =>
  clamp01((readyAt - tick) / Math.max(1, duration));

/**
 * Desenha um radial de 360° sobre os botões com cooldown real na simulação.
 * A máscara escura começa cobrindo o círculo inteiro e recua no sentido horário,
 * revelando o ícone conforme a ação fica disponível. Ao completar, há um pulso curto.
 */
export class TouchCooldownOverlay {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly cooling = new Set<CooldownButtonId>();
  private readonly readyPulseUntil = new Map<CooldownButtonId, number>();

  constructor(canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D indisponivel para cooldowns.');
    this.ctx = ctx;
  }

  render(state: SurvivalState, input: InputState, tick: number, nowMs: number): void {
    if (!input.usingTouch || state.phase !== 'running') return;

    for (const button of input.buttons) {
      if (button.id !== 'dodge' && button.id !== 'ability') continue;
      const id: CooldownButtonId = button.id;
      const spec = COOLDOWNS[id];
      const remaining = cooldownRemainingFraction(spec.readyAt(state), tick, spec.duration);

      if (remaining > 0) {
        this.cooling.add(id);
        this.drawCooldown(button, remaining, spec.accent);
      } else if (this.cooling.delete(id)) {
        this.readyPulseUntil.set(id, nowMs + 240);
      }

      const pulseUntil = this.readyPulseUntil.get(id) ?? 0;
      if (pulseUntil > nowMs) {
        this.drawReadyPulse(button, 1 - (pulseUntil - nowMs) / 240, spec.accent);
      } else if (pulseUntil > 0) {
        this.readyPulseUntil.delete(id);
      }
    }
  }

  private drawCooldown(button: TouchButton, remaining: number, accent: string): void {
    const ctx = this.ctx;
    const start = -Math.PI / 2;
    const revealed = 1 - remaining;
    const revealAngle = start + revealed * Math.PI * 2;
    const radius = button.r - 2;

    ctx.save();

    // Cobertura restante: desaparece em uma volta completa, no sentido horário.
    ctx.beginPath();
    ctx.moveTo(button.cx, button.cy);
    ctx.arc(button.cx, button.cy, radius, revealAngle, start + Math.PI * 2);
    ctx.closePath();
    ctx.fillStyle = 'rgba(11,14,20,0.72)';
    ctx.fill();

    // Linha de progresso reforça a leitura sem depender apenas da transparência.
    if (revealed > 0.002) {
      ctx.beginPath();
      ctx.arc(button.cx, button.cy, radius - 1.5, start, revealAngle);
      ctx.strokeStyle = accent;
      ctx.globalAlpha = 0.88;
      ctx.lineWidth = Math.max(2, button.r * 0.09);
      ctx.lineCap = 'round';
      ctx.stroke();
    }

    // Contagem curta apenas para cooldowns de pelo menos um segundo.
    const seconds = (remaining * COOLDOWNS[button.id as CooldownButtonId].duration) / TICK_HZ;
    if (seconds >= 0.95) {
      ctx.globalAlpha = 0.92;
      ctx.fillStyle = '#e8f1ff';
      ctx.font = `bold ${Math.max(10, Math.round(button.r * 0.38))}px ui-monospace, monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${Math.ceil(seconds)}`, button.cx, button.cy + 0.5);
    }

    ctx.restore();
  }

  private drawReadyPulse(button: TouchButton, progress: number, accent: string): void {
    const ctx = this.ctx;
    const eased = 1 - (1 - clamp01(progress)) ** 3;
    ctx.save();
    ctx.globalAlpha = 1 - eased;
    ctx.strokeStyle = accent;
    ctx.lineWidth = Math.max(2, button.r * 0.09 * (1 - eased * 0.45));
    ctx.beginPath();
    ctx.arc(button.cx, button.cy, button.r + 2 + eased * 9, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}
