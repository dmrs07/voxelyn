// A RESPIRACAO do Pulmao-Matriz: o relogio da luta, como leito.
//
// O ciclo do Pulmao e derivado do tick (`LUNG_MATRIX_CYCLE_TICKS` inspirando,
// o mesmo tanto expelindo), e a inspiracao e um movimento CONTINUO — 6,5 s
// de succao crescente, com o gas, as particulas e ate o ruido ambiente
// parecendo recuar para dentro dele. Isso nao e uma voz: e um leito, pelo
// mesmo motivo do motor da minigun. As BORDAS do ciclo (o pulmao cheio, a
// membrana abrindo, a valvula fechando, a expiracao acesa) sao vozes em
// `synth.ts`; este arquivo e so o que acontece ENTRE elas.
//
// A regra semantica que rege as duas metades:
//
//   INSPIRAR   frequencia e intensidade SOBEM, para dentro.
//   EXPIRAR    transiente inicial (voz) e ruido se espalhando para FORA:
//              aqui, um sopro largo que DESCE e se afasta.
//
// A retencao ("pulmao cheio") e o unico momento em que o leito CALA de
// proposito: meio segundo de pressao sem succao, antes do jato. E o
// silencio que da medo.
//
// Vida baixa: a respiracao fica mais curta, irregular e rapida — o tremolo
// da succao acelera e ganha um batimento fora de fase.

import { LUNG_MATRIX_CYCLE_TICKS, LUNG_MATRIX_HOLD_TICKS } from '@voxelyn/survival-sim';

const GAIN_GLIDE = 0.1;
const PARAM_GLIDE = 0.18;

/** Teto do leito. Ele e o fundo do encontro, nunca o jato em si. */
const CEILING = 0.26;

/** A succao: corte do passa-banda do inicio ao fim da inspiracao, em Hz. */
const INHALE_CUTOFF_START_HZ = 260;
const INHALE_CUTOFF_END_HZ = 1900;

/** O sopro da expiracao: corte do passa-baixa do jato ao fim, em Hz. */
const EXHALE_CUTOFF_START_HZ = 2200;
const EXHALE_CUTOFF_END_HZ = 300;

/** Fracao da vida abaixo da qual a respiracao fica irregular. */
const STRAIN_HP_FRACTION = 0.3;

export type LungPhase = 'inhale' | 'hold' | 'exhale';

/**
 * A fase e o progresso (0..1 dentro da fase) para um tick, com a MESMA
 * aritmetica da simulacao (ver `lungMatrixStep`). Pura e exportada para ser
 * testavel sem AudioContext.
 */
export const lungPhaseAt = (tick: number): { phase: LungPhase; progress: number } => {
  const cycle = LUNG_MATRIX_CYCLE_TICKS;
  const within = ((tick % (cycle * 2)) + cycle * 2) % (cycle * 2);
  if (within < cycle) {
    const holdStart = cycle - LUNG_MATRIX_HOLD_TICKS;
    if (within >= holdStart) {
      return { phase: 'hold', progress: (within - holdStart) / LUNG_MATRIX_HOLD_TICKS };
    }
    return { phase: 'inhale', progress: within / holdStart };
  }
  return { phase: 'exhale', progress: (within - cycle) / cycle };
};

export class LungBreathBus {
  private gain: GainNode | null = null;
  private inhale: BiquadFilterNode | null = null;
  private inhaleGain: GainNode | null = null;
  private inhaleTone: OscillatorNode | null = null;
  private inhaleLfo: OscillatorNode | null = null;
  private exhale: BiquadFilterNode | null = null;
  private exhaleGain: GainNode | null = null;
  private started = false;
  private readonly sources: AudioScheduledSourceNode[] = [];

  constructor(
    private readonly ctx: AudioContext,
    private readonly out: AudioNode,
    private readonly noise: AudioBuffer,
  ) {}

  /** Cria a cadeia em ganho zero. Idempotente. */
  start(): void {
    if (this.started) return;
    this.started = true;
    const { ctx, out, noise } = this;
    const t0 = ctx.currentTime;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, t0);
    gain.connect(out);

    // A SUCCAO: ruido em passa-banda cujo centro sobe ao longo da
    // inspiracao, com um tremolo lento por cima (o fole trabalhando).
    const inSrc = ctx.createBufferSource();
    inSrc.buffer = noise;
    inSrc.loop = true;
    const inhale = ctx.createBiquadFilter();
    inhale.type = 'bandpass';
    inhale.frequency.setValueAtTime(INHALE_CUTOFF_START_HZ, t0);
    inhale.Q.setValueAtTime(1.4, t0);
    const inhaleGain = ctx.createGain();
    inhaleGain.gain.setValueAtTime(0, t0);
    const depth = ctx.createGain();
    depth.gain.setValueAtTime(0.18, t0);
    const inhaleLfo = ctx.createOscillator();
    inhaleLfo.type = 'sine';
    inhaleLfo.frequency.setValueAtTime(1.1, t0);
    inhaleLfo.connect(depth).connect(inhaleGain.gain);
    inSrc.connect(inhale).connect(inhaleGain).connect(gain);
    inSrc.start(t0);
    inhaleLfo.start(t0);
    this.sources.push(inSrc, inhaleLfo);

    // A PRESSAO subindo: um seno grave que sobe meio-oitava com a inspiracao.
    // E o "para dentro" que o ruido sozinho nao diz.
    const inhaleTone = ctx.createOscillator();
    inhaleTone.type = 'sine';
    inhaleTone.frequency.setValueAtTime(58, t0);
    const toneGain = ctx.createGain();
    toneGain.gain.setValueAtTime(0.5, t0);
    inhaleTone.connect(toneGain).connect(inhaleGain);
    inhaleTone.start(t0);
    this.sources.push(inhaleTone);

    // O SOPRO da expiracao: passa-baixa largo que desce e se afasta.
    const exSrc = ctx.createBufferSource();
    exSrc.buffer = noise;
    exSrc.loop = true;
    exSrc.playbackRate.value = 0.8;
    const exhale = ctx.createBiquadFilter();
    exhale.type = 'lowpass';
    exhale.frequency.setValueAtTime(EXHALE_CUTOFF_START_HZ, t0);
    const exhaleGain = ctx.createGain();
    exhaleGain.gain.setValueAtTime(0, t0);
    exSrc.connect(exhale).connect(exhaleGain).connect(gain);
    exSrc.start(t0);
    this.sources.push(exSrc);

    this.gain = gain;
    this.inhale = inhale;
    this.inhaleGain = inhaleGain;
    this.inhaleTone = inhaleTone;
    this.inhaleLfo = inhaleLfo;
    this.exhale = exhale;
    this.exhaleGain = exhaleGain;
  }

  /**
   * Poe o leito no ponto do ciclo. Chamar uma vez por quadro.
   *
   * `tick` e o da simulacao (a fase sai dele, nunca de um relogio local);
   * `hpFraction` (0..1) governa a irregularidade; `presence` (0..1) e a
   * atenuacao por distancia ate o corpo, aplicada aqui porque o leito nao
   * passa pelo mixer.
   */
  set(tick: number, hpFraction: number, presence: number): void {
    const { ctx, gain, inhale, inhaleGain, inhaleTone, inhaleLfo, exhale, exhaleGain } = this;
    if (!gain || !inhale || !inhaleGain || !inhaleTone || !inhaleLfo || !exhale || !exhaleGain)
      return;
    const now = ctx.currentTime;
    const { phase, progress } = lungPhaseAt(tick);
    const strained = hpFraction < STRAIN_HP_FRACTION;

    if (phase === 'inhale') {
      // Frequencia e intensidade sobem, para dentro.
      const hz =
        INHALE_CUTOFF_START_HZ + (INHALE_CUTOFF_END_HZ - INHALE_CUTOFF_START_HZ) * progress;
      inhale.frequency.setTargetAtTime(hz, now, PARAM_GLIDE);
      inhaleTone.frequency.setTargetAtTime(58 + 30 * progress, now, PARAM_GLIDE);
      // Ferido: o fole trabalha mais rapido e fora de compasso.
      inhaleLfo.frequency.setTargetAtTime(
        strained ? 3.3 + progress * 2 : 1.1 + progress * 0.6,
        now,
        PARAM_GLIDE,
      );
      inhaleGain.gain.setTargetAtTime(0.25 + 0.75 * progress, now, GAIN_GLIDE);
      exhaleGain.gain.setTargetAtTime(0, now, GAIN_GLIDE);
    } else if (phase === 'hold') {
      // O PULMAO CHEIO: a succao para. O que fica e a pressao presa, baixa.
      inhaleGain.gain.setTargetAtTime(0.12, now, 0.04);
      inhale.frequency.setTargetAtTime(INHALE_CUTOFF_END_HZ, now, PARAM_GLIDE);
      exhaleGain.gain.setTargetAtTime(0, now, GAIN_GLIDE);
    } else {
      // Expirar: o sopro desce e se afasta, e some antes do ciclo virar.
      const hz =
        EXHALE_CUTOFF_START_HZ + (EXHALE_CUTOFF_END_HZ - EXHALE_CUTOFF_START_HZ) * progress;
      exhale.frequency.setTargetAtTime(hz, now, PARAM_GLIDE);
      exhaleGain.gain.setTargetAtTime(Math.max(0, 1 - progress * 1.3), now, GAIN_GLIDE);
      inhaleGain.gain.setTargetAtTime(0, now, GAIN_GLIDE);
    }
    gain.gain.setTargetAtTime(CEILING * Math.max(0, Math.min(1, presence)), now, GAIN_GLIDE);
  }

  /** Cala o leito sem destruir nada. */
  silence(): void {
    if (!this.gain) return;
    this.gain.gain.setTargetAtTime(0, this.ctx.currentTime, GAIN_GLIDE);
  }

  /** Solta os nos. So no descarte do contexto. */
  dispose(): void {
    for (const source of this.sources) {
      try {
        source.stop();
      } catch {
        // Um no ja parado lanca; parar duas vezes nao e erro nosso.
      }
    }
    this.sources.length = 0;
    this.gain?.disconnect();
    this.gain = null;
    this.inhale = null;
    this.inhaleGain = null;
    this.inhaleTone = null;
    this.inhaleLfo = null;
    this.exhale = null;
    this.exhaleGain = null;
    this.started = false;
  }
}
