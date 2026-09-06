// A CAMADA DE PRESSAO do Diamandis em frenesi: o leito que sobe a cada
// modulo arrancado.
//
// O chefe nao vocaliza o frenesi — a fala corporativa dele e outra tabela.
// O que se ouve e a MAQUINA: um zumbido de servos sobrecarregados que ganha
// altura e presenca a cada degrau, e um estalido de rele que se repete cada
// vez mais perto. E o mesmo desenho dos outros leitos de chefe: nos
// persistentes em ganho zero, criados com a ambiencia, e so ganho e filtro
// andando por quadro. Os degraus vem do ESTADO (`modulesLost`, espelhado
// online em `bossModules`), nunca de um relogio do cliente: quem reconecta
// com dois modulos fora ouve dois degraus.

const GAIN_GLIDE = 0.18;
const PARAM_GLIDE = 0.3;
const CEILING = 0.16;
const RELAY_LOOKAHEAD = 0.12;

export type DiamandisFrenzyInput = {
  /** Modulos arrancados que ja contam, 0..3. Zero cala o leito. */
  stacks: number;
  /** Atenuacao por distancia do ouvinte, 0..1 (a mesma curva do mixer). */
  presence: number;
};

/** A frequencia do zumbido por degrau: sobe uma terca menor a cada modulo. */
export const frenzyHumHz = (stacks: number): number => 110 * Math.pow(1.19, Math.max(0, stacks));
/** O intervalo entre estalidos de rele por degrau, em segundos. */
export const frenzyRelayPeriod = (stacks: number): number => Math.max(0.35, 1.6 - 0.4 * stacks);

export class DiamandisFrenzyBus {
  private gain: GainNode | null = null;
  private hum: OscillatorNode | null = null;
  private humB: OscillatorNode | null = null;
  private humFilter: BiquadFilterNode | null = null;
  private grindGain: GainNode | null = null;
  private started = false;
  private readonly sources: AudioScheduledSourceNode[] = [];
  private nextRelayAt = 0;
  private presence = 0;
  private stacks = 0;

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

    // Os SERVOS: dois dentes de serra em batimento, passando por um passa-baixa
    // que abre com o regime.
    const humFilter = ctx.createBiquadFilter();
    humFilter.type = 'lowpass';
    humFilter.frequency.setValueAtTime(400, t0);
    humFilter.Q.setValueAtTime(2, t0);
    const humGain = ctx.createGain();
    humGain.gain.setValueAtTime(0.35, t0);
    const hum = ctx.createOscillator();
    hum.type = 'sawtooth';
    hum.frequency.setValueAtTime(frenzyHumHz(0), t0);
    const humB = ctx.createOscillator();
    humB.type = 'sawtooth';
    humB.frequency.setValueAtTime(frenzyHumHz(0) * 1.007, t0);
    hum.connect(humFilter);
    humB.connect(humFilter);
    humFilter.connect(humGain).connect(gain);
    hum.start(t0);
    humB.start(t0);
    this.sources.push(hum, humB);

    // O METAL raspando: ruido em banda media, so nos degraus altos.
    const gSrc = ctx.createBufferSource();
    gSrc.buffer = noise;
    gSrc.loop = true;
    gSrc.playbackRate.value = 0.8;
    const grind = ctx.createBiquadFilter();
    grind.type = 'bandpass';
    grind.frequency.setValueAtTime(900, t0);
    grind.Q.setValueAtTime(6, t0);
    const grindGain = ctx.createGain();
    grindGain.gain.setValueAtTime(0, t0);
    gSrc.connect(grind).connect(grindGain).connect(gain);
    gSrc.start(t0);
    this.sources.push(gSrc);

    this.gain = gain;
    this.hum = hum;
    this.humB = humB;
    this.humFilter = humFilter;
    this.grindGain = grindGain;
    this.nextRelayAt = t0 + 0.3;
  }

  /** Poe o leito neste degrau. Chamar uma vez por quadro. */
  set(input: DiamandisFrenzyInput): void {
    const { ctx, gain, hum, humB, humFilter, grindGain } = this;
    if (!gain || !hum || !humB || !humFilter || !grindGain) return;
    const now = ctx.currentTime;
    this.stacks = Math.max(0, Math.min(3, Math.floor(input.stacks)));
    this.presence = Math.max(0, Math.min(1, input.presence));
    const hz = frenzyHumHz(this.stacks);
    hum.frequency.setTargetAtTime(hz, now, PARAM_GLIDE);
    humB.frequency.setTargetAtTime(hz * 1.007, now, PARAM_GLIDE);
    humFilter.frequency.setTargetAtTime(400 + 500 * this.stacks, now, PARAM_GLIDE);
    grindGain.gain.setTargetAtTime(
      this.stacks >= 2 ? 0.12 * (this.stacks - 1) : 0,
      now,
      GAIN_GLIDE,
    );
    const level = this.stacks === 0 ? 0 : CEILING * (0.5 + 0.5 * (this.stacks / 3)) * this.presence;
    gain.gain.setTargetAtTime(level, now, GAIN_GLIDE);
    if (this.stacks > 0) this.scheduleRelays();
  }

  /** Os estalidos de rele, agendados no relogio do contexto com lookahead. */
  private scheduleRelays(): void {
    const { ctx } = this;
    const now = ctx.currentTime;
    if (this.nextRelayAt < now - 0.5) this.nextRelayAt = now + 0.05;
    while (this.nextRelayAt < now + RELAY_LOOKAHEAD) {
      this.relay(this.nextRelayAt);
      this.nextRelayAt += frenzyRelayPeriod(this.stacks);
    }
  }

  private relay(at: number): void {
    const { ctx, gain } = this;
    if (!gain || this.presence <= 0) return;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(2200, at);
    filter.Q.setValueAtTime(3, at);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.linearRampToValueAtTime(0.25 * this.presence, at + 0.004);
    g.gain.setTargetAtTime(0.0001, at + 0.004, 0.012);
    src.connect(filter).connect(g).connect(this.out);
    src.start(at, 0.1, 0.06);
  }

  /** Cala o leito sem destruir nada. */
  silence(): void {
    if (!this.gain) return;
    this.presence = 0;
    this.gain.gain.setTargetAtTime(0, this.ctx.currentTime, GAIN_GLIDE);
  }

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
    this.started = false;
  }
}
