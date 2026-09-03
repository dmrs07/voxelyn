// O CORACAO DA FORNALHA: a sala inteira e o corpo dele, e este e o leito.
//
// Ele nao vocaliza — se rugisse, ficaria menor. O que se ouve o tempo todo e
// um BATIMENTO grave e lento junto do som de pressao dentro de uma caldeira,
// e e nesse par que a luta e legivel sem olhar:
//
//   superaquecendo  batimentos aceleram; o metal expande e range.
//   esfriando       a pressao cai, sobra vapor e batimentos fracos — a
//                   janela de dano, ouvida.
//   instavel (10%)  o ritmo deixa de ser regular: batimentos FALHAM.
//
// Duas partes, dois mecanismos. A PRESSAO e um leito de verdade — nos
// persistentes, so o ganho e o filtro andam. O BATIMENTO e um scheduler de
// lookahead, como o riff da musica (`music-bus.ts`): cada batida e um par de
// nos curtos agendados no relogio do contexto um pouco a frente do quadro.
// Um oscilador permanente com tremolo nao serve aqui porque a batida tem de
// FALTAR na instabilidade, e um LFO nao sabe faltar.
//
// A fase vem do ESTADO (`furnaceOverheatingAt(tick)`, os bits de fase), nunca
// de um relogio do cliente: e a mesma conta que a simulacao faz para abrir e
// fechar a blindagem, entao o batimento acelera exatamente quando ela fecha.

import { FURNACE_HEART_CYCLE_TICKS, furnaceOverheatingAt } from '@voxelyn/survival-sim';

const GAIN_GLIDE = 0.12;
const PARAM_GLIDE = 0.25;

/** Teto da pressao. E o fundo da sala, sob tudo o mais. */
const PRESSURE_CEILING = 0.2;
/** Pico de cada batida, antes da presenca. */
const BEAT_PEAK = 0.55;

/** Batidas por segundo: esfriando, superaquecendo, e o pico do fim do ciclo. */
const BEAT_RATE_COOL = 0.85;
const BEAT_RATE_HOT = 1.5;
const BEAT_RATE_HOT_PEAK = 2.1;

/** Quanto do relogio do contexto o scheduler enxerga a frente, em segundos. */
const LOOKAHEAD = 0.12;

/**
 * Na instabilidade, uma batida a cada tantas FALHA. Deterministico a partir
 * do indice da batida, para o ritmo quebrado ser o mesmo ritmo quebrado nos
 * dois clientes de uma sala.
 */
const UNSTABLE_SKIP_EVERY = 3;

export type FurnaceHeartInput = {
  tick: number;
  /** Ja passou pelo colapso termico (45%)? O metal range o tempo todo. */
  collapsed: boolean;
  /** Ja passou pela instabilidade (10%)? O ritmo falha. */
  unstable: boolean;
  /** Atenuacao por distancia ate o corpo, 0..1. */
  presence: number;
};

/**
 * A taxa de batimento para um tick, pura e testavel: sobe ao longo do
 * superaquecimento (o fim do ciclo e o pico) e cai no resfriamento.
 */
export const furnaceBeatRateAt = (tick: number): number => {
  const cycle = FURNACE_HEART_CYCLE_TICKS;
  const within = ((tick % cycle) + cycle) % cycle;
  const progress = within / cycle;
  if (furnaceOverheatingAt(tick))
    return BEAT_RATE_HOT + (BEAT_RATE_HOT_PEAK - BEAT_RATE_HOT) * progress;
  return BEAT_RATE_COOL;
};

export class FurnaceHeartBus {
  private gain: GainNode | null = null;
  private pressure: BiquadFilterNode | null = null;
  private pressureGain: GainNode | null = null;
  private creak: BiquadFilterNode | null = null;
  private creakGain: GainNode | null = null;
  private steamGain: GainNode | null = null;
  private started = false;
  private readonly sources: AudioScheduledSourceNode[] = [];

  /** Relogio do contexto da proxima batida, e quantas ja sairam. */
  private nextBeatAt = 0;
  private beatIndex = 0;
  /** Presenca do ultimo quadro, para as batidas agendadas usarem. */
  private presence = 0;

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

    // A PRESSAO da caldeira: ruido grave e denso, abafado.
    const pSrc = ctx.createBufferSource();
    pSrc.buffer = noise;
    pSrc.loop = true;
    pSrc.playbackRate.value = 0.6;
    const pressure = ctx.createBiquadFilter();
    pressure.type = 'lowpass';
    pressure.frequency.setValueAtTime(220, t0);
    const pressureGain = ctx.createGain();
    pressureGain.gain.setValueAtTime(0.7, t0);
    pSrc.connect(pressure).connect(pressureGain).connect(gain);
    pSrc.start(t0);
    this.sources.push(pSrc);

    // O METAL rangendo: banda estreita e ressonante, que so entra no calor.
    const cSrc = ctx.createBufferSource();
    cSrc.buffer = noise;
    cSrc.loop = true;
    cSrc.playbackRate.value = 0.9;
    const creak = ctx.createBiquadFilter();
    creak.type = 'bandpass';
    creak.frequency.setValueAtTime(340, t0);
    creak.Q.setValueAtTime(11, t0);
    const creakGain = ctx.createGain();
    creakGain.gain.setValueAtTime(0, t0);
    cSrc.connect(creak).connect(creakGain).connect(gain);
    cSrc.start(t0);
    this.sources.push(cSrc);

    // O VAPOR do resfriamento: agudo e fino, que so entra na janela fria.
    const sSrc = ctx.createBufferSource();
    sSrc.buffer = noise;
    sSrc.loop = true;
    sSrc.playbackRate.value = 1.4;
    const steam = ctx.createBiquadFilter();
    steam.type = 'highpass';
    steam.frequency.setValueAtTime(3200, t0);
    const steamGain = ctx.createGain();
    steamGain.gain.setValueAtTime(0, t0);
    sSrc.connect(steam).connect(steamGain).connect(gain);
    sSrc.start(t0);
    this.sources.push(sSrc);

    this.gain = gain;
    this.pressure = pressure;
    this.pressureGain = pressureGain;
    this.creak = creak;
    this.creakGain = creakGain;
    this.steamGain = steamGain;
    this.nextBeatAt = t0 + 0.2;
  }

  /** Poe a sala neste ponto do ciclo. Chamar uma vez por quadro. */
  set(input: FurnaceHeartInput): void {
    const { ctx, gain, pressure, pressureGain, creak, creakGain, steamGain } = this;
    if (!gain || !pressure || !pressureGain || !creak || !creakGain || !steamGain) return;
    const now = ctx.currentTime;
    const hot = furnaceOverheatingAt(input.tick);
    this.presence = Math.max(0, Math.min(1, input.presence));

    // Superaquecendo: pressao cheia e grave; metal expandindo (mais no
    // colapso). Esfriando: a pressao cai e o vapor sobe.
    pressure.frequency.setTargetAtTime(hot ? 260 : 140, now, PARAM_GLIDE);
    pressureGain.gain.setTargetAtTime(hot ? 0.8 : 0.3, now, GAIN_GLIDE);
    creakGain.gain.setTargetAtTime(hot ? (input.collapsed ? 0.3 : 0.14) : 0, now, GAIN_GLIDE);
    creak.frequency.setTargetAtTime(
      hot ? 340 + (input.collapsed ? 120 : 0) : 300,
      now,
      PARAM_GLIDE,
    );
    steamGain.gain.setTargetAtTime(hot ? 0 : 0.18, now, GAIN_GLIDE);
    gain.gain.setTargetAtTime(PRESSURE_CEILING * this.presence, now, GAIN_GLIDE);

    this.scheduleBeats(input.tick, hot, input.unstable);
  }

  /**
   * Agenda as batidas que caem dentro do lookahead. A taxa e lida do TICK,
   * entao o ritmo segue a fase autoritativa; o instante de cada batida e do
   * relogio do contexto, para a batida nunca depender do quadro.
   */
  private scheduleBeats(tick: number, hot: boolean, unstable: boolean): void {
    const { ctx } = this;
    const now = ctx.currentTime;
    // Um leito que ficou calado por muito tempo nao "recupera" batidas
    // atrasadas: recomeca do agora.
    if (this.nextBeatAt < now - 0.5) this.nextBeatAt = now + 0.05;
    while (this.nextBeatAt < now + LOOKAHEAD) {
      const rate = furnaceBeatRateAt(tick);
      const index = this.beatIndex++;
      const skipped = unstable && index % UNSTABLE_SKIP_EVERY === UNSTABLE_SKIP_EVERY - 1;
      if (!skipped) this.beat(this.nextBeatAt, hot ? 1 : 0.45, hot);
      // Na instabilidade a batida seguinte tambem chega fora do lugar.
      const jitter = unstable ? (index % 2 === 0 ? 0.12 : -0.08) : 0;
      this.nextBeatAt += 1 / rate + jitter;
    }
  }

  /** UMA batida: seno grave curto, com um toque de pressao por cima. */
  private beat(at: number, strength: number, hot: boolean): void {
    const { ctx, gain } = this;
    if (!gain || this.presence <= 0) return;
    const peak = BEAT_PEAK * strength * this.presence;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(hot ? 58 : 46, at);
    osc.frequency.exponentialRampToValueAtTime(28, at + 0.22);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.linearRampToValueAtTime(peak, at + 0.012);
    g.gain.setTargetAtTime(0.0001, at + 0.012, 0.07);
    // Direto no destino do leito, e nao no ganho do leito: o `gain` ja
    // carrega a presenca da pressao, e a batida tem a sua.
    osc.connect(g).connect(this.out);
    osc.start(at);
    osc.stop(at + 0.4);
  }

  /** Cala a sala sem destruir nada. */
  silence(): void {
    if (!this.gain) return;
    this.presence = 0;
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
    this.pressure = null;
    this.pressureGain = null;
    this.creak = null;
    this.creakGain = null;
    this.steamGain = null;
    this.started = false;
  }
}
