import {
  FLAMETHROWER_CHANNEL_TICKS,
  TICK_HZ,
  abilityDefinition,
  type SurvivalState,
} from '@voxelyn/survival-sim';
import type { InputState, TouchButton } from './input';

type CooldownButtonId = Extract<TouchButton['id'], 'dodge' | 'ability'>;
export type CooldownMode = 'authoritative' | 'predicted';

type CooldownSpec = {
  duration: (state: SurvivalState) => number;
  readyAt: (state: SurvivalState) => number;
  accent: string;
};

/**
 * Cooldown da habilidade EQUIPADA, ja escalado pelo tuning — a mesma conta que
 * a simulacao faz ao cobrar. A duracao fixa de antes so estava certa para o
 * pulso: o radial do sopro (160 ticks) e do drone (180) enchia e esvaziava no
 * ritmo dos 120 do pulso, prometendo prontidao que o servidor recusava.
 */
export const abilityCooldownTicks = (state: SurvivalState): number =>
  Math.round(
    abilityDefinition(state.playerExtra.ability).cooldownTicks *
      state.config.tuning.abilityCooldownScale,
  );

/**
 * Quando a habilidade equipada volta a estar disponivel, em tick absoluto.
 *
 * Durante o canal do sopro `abilityCooldownUntil` ainda nao foi cobrado — a
 * simulacao so grava o cooldown NA liquidacao do canal. O HUD projeta
 * `channelingUntil + cooldown`, que e exatamente o instante que
 * `settleBreathChannel` vai escrever: o radial cobre o compromisso inteiro
 * (canal + recarga) desde o cast, sem anunciar prontidao 4,5 s antes da hora.
 */
export const abilityReadyAtTick = (state: SurvivalState): number => {
  const extra = state.playerExtra;
  if (extra.channelingUntil > state.tick) {
    return extra.channelingUntil + abilityCooldownTicks(state);
  }
  return extra.abilityCooldownUntil;
};

/** Duracao total do radial da habilidade: recarga, mais o canal quando ha um. */
export const abilityCooldownDurationTicks = (state: SurvivalState): number =>
  abilityCooldownTicks(state) +
  (state.playerExtra.ability === 'flamethrower' ? FLAMETHROWER_CHANNEL_TICKS : 0);

const COOLDOWNS: Record<CooldownButtonId, CooldownSpec> = {
  dodge: {
    // Do TUNING, nao da constante: a arvore MV-02 encurta a esquiva, e um
    // radial na duracao de fabrica esvaziaria atrasado para quem comprou.
    duration: (state) => state.config.tuning.dodgeCooldownTicks,
    readyAt: (state) => state.playerExtra.dodgeCooldownUntil,
    accent: '#e8f1ff',
  },
  ability: {
    duration: abilityCooldownDurationTicks,
    readyAt: abilityReadyAtTick,
    accent: '#7ab8ff',
  },
};

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

/** Fração ainda bloqueada: 1 imediatamente após usar, 0 quando pronta. */
export const cooldownRemainingFraction = (readyAt: number, tick: number, duration: number): number =>
  clamp01((readyAt - tick) / Math.max(1, duration));

/** Online usa predição visual; solo sempre segue os timers autoritativos. */
export const cooldownModeForState = (state: SurvivalState): CooldownMode =>
  state.config.playerCount > 1 ? 'predicted' : 'authoritative';

/**
 * Calcula o próximo readyAt sem permitir que um toque rejeitado invente cooldown
 * em modo autoritativo ou que taps repetidos reiniciem um cooldown já em curso.
 */
export const resolveCooldownReadyAt = (
  mode: CooldownMode,
  authoritativeReadyAt: number,
  predictedReadyAt: number,
  pressChanged: boolean,
  tick: number,
  duration: number
): number => {
  if (mode === 'authoritative') return authoritativeReadyAt;
  const currentReadyAt = Math.max(authoritativeReadyAt, predictedReadyAt);
  if (pressChanged && tick >= currentReadyAt) return tick + duration;
  return currentReadyAt;
};

/**
 * Desenha um radial de 360° sobre os botões com cooldown real na simulação.
 * A máscara escura começa cobrindo o círculo inteiro e recua no sentido horário,
 * revelando o ícone conforme a ação fica disponível. Ao completar, há um pulso curto.
 *
 * No solo, o timer é exclusivamente autoritativo. No online, o `ViewerState`
 * transporta os timers privados a cada snapshot; a predição local sobrevive só
 * para cobrir a ida-e-volta entre o toque e o primeiro snapshot que já o viu.
 */
export class TouchCooldownOverlay {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly cooling = new Set<CooldownButtonId>();
  private readonly readyPulseUntil = new Map<CooldownButtonId, number>();
  private readonly predictedReadyAt = new Map<CooldownButtonId, number>();
  private readonly seenPressSeq: Record<CooldownButtonId, number> = { dodge: 0, ability: 0 };
  private lastState: SurvivalState | null = null;
  private lastUsingTouch = false;

  constructor(canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D indisponivel para cooldowns.');
    this.ctx = ctx;
  }

  render(state: SurvivalState, input: InputState, tick: number, nowMs: number): void {
    // Cada createRun/welcome produz uma nova identidade de estado. Isso cobre
    // reinícios e matchmaking em salas cujo tick pode ser maior que o anterior.
    //
    // A troca de estado descarta a PREDIÇÃO antiga sem engolir o toque novo.
    //
    // No online, `runOnline` consome e envia o comando antes de chegar aqui: uma
    // esquiva apertada entre o welcome e o primeiro quadro renderizado já virou
    // comando aceito pelo servidor. Sincronizar a sequência de toques nesse
    // instante fazia `pressChanged` nascer falso, e — como o snapshot online não
    // carrega os cooldowns privados — aquela ação ficava para sempre sem radial.
    // O jogador via o botão pronto enquanto o servidor o considerava em recarga.
    //
    // Na PRIMEIRA renderização a sincronia continua certa: aí não há sessão
    // anterior, e a sequência já acumulada vem de antes de existir uma run.
    if (state !== this.lastState) {
      const firstEver = this.lastState === null;
      this.clearPrediction();
      if (firstEver) this.syncPressSequences(input);
      this.lastState = state;
    }

    // A transição touch -> mouse elimina radiais, predições e pulsos pendentes.
    if (!input.usingTouch) {
      if (this.lastUsingTouch) this.reset(input);
      else this.syncPressSequences(input);
      this.lastUsingTouch = false;
      return;
    }
    this.lastUsingTouch = true;

    if (state.phase !== 'running') {
      this.syncPressSequences(input);
      return;
    }

    const mode = cooldownModeForState(state);

    for (const button of input.buttons) {
      if (button.id !== 'dodge' && button.id !== 'ability') continue;
      const id: CooldownButtonId = button.id;
      const spec = COOLDOWNS[id];
      const pressSeq = input.actionPressSeq[id];
      const pressChanged = pressSeq !== this.seenPressSeq[id];
      this.seenPressSeq[id] = pressSeq;

      const duration = spec.duration(state);
      const authoritativeReadyAt = spec.readyAt(state);
      const predicted = this.predictedReadyAt.get(id) ?? 0;
      const readyAt = resolveCooldownReadyAt(
        mode,
        authoritativeReadyAt,
        predicted,
        pressChanged,
        tick,
        duration
      );

      if (mode === 'predicted' && readyAt > authoritativeReadyAt && readyAt > tick) {
        this.predictedReadyAt.set(id, readyAt);
      } else {
        this.predictedReadyAt.delete(id);
      }

      const remaining = cooldownRemainingFraction(readyAt, tick, duration);

      if (remaining > 0) {
        this.cooling.add(id);
        this.drawCooldown(button, remaining, duration, spec);
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

  private syncPressSequences(input: InputState): void {
    this.seenPressSeq.dodge = input.actionPressSeq.dodge;
    this.seenPressSeq.ability = input.actionPressSeq.ability;
  }

  /** Descarta radiais, pulsos e predições — sem tocar nas sequências de toque. */
  private clearPrediction(): void {
    this.cooling.clear();
    this.readyPulseUntil.clear();
    this.predictedReadyAt.clear();
  }

  private reset(input: InputState): void {
    this.clearPrediction();
    this.syncPressSequences(input);
  }

  private drawCooldown(
    button: TouchButton,
    remaining: number,
    duration: number,
    spec: CooldownSpec,
  ): void {
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
      ctx.strokeStyle = spec.accent;
      ctx.globalAlpha = 0.88;
      ctx.lineWidth = Math.max(2, button.r * 0.09);
      ctx.lineCap = 'round';
      ctx.stroke();
    }

    // Contagem curta apenas para cooldowns de pelo menos um segundo.
    const seconds = (remaining * duration) / TICK_HZ;
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
