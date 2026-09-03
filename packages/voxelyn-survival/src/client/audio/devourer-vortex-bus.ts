// O VORTICE do Devorador Branco: o unico som continuo da boca.
//
// Por que e um leito e nao uma voz: a boca fica aberta 7,5 s, e a sucao e
// uma coisa so, crescendo. Uma voz nova a cada tick sairia granulada no
// ritmo do quadro e comeria o orcamento de dezesseis vozes sozinha — a mesma
// razao pela qual o motor da minigun e um leito. Os nos nascem UMA vez, em
// ganho zero, e o que muda por quadro e a intensidade.
//
// O que ele e, em camadas:
//
//   - RUIDO FILTRADO DESCENDO de frequencia: o ar (e a areia) sendo puxados
//     para dentro. Quanto mais aberta a boca, mais grave o corte — o vortice
//     "engole" o proprio agudo.
//   - SUBGRAVE PULSANTE: um seno muito baixo com tremolo lento. E a garganta.
//   - FRAGMENTOS DE SILICA acelerando para o centro: ruido em banda estreita
//     e aguda cuja taxa de tremolo SOBE com a intensidade. E o que diz que as
//     coisas em volta estao indo para la — e que voce e uma delas.
//
// Quem manda e o estado autoritativo (`bossRuntime.mawOpenedAt` mais a mesma
// `mawIntensity` que a simulacao usa para puxar), nunca um relogio do
// cliente: um contador proprio divergiria da sucao na primeira reconexao e o
// jogador ouviria um vortice que nao puxa, ou um puxao sem vortice.

/** Constante de suavizacao do ganho, em segundos. */
const GAIN_GLIDE = 0.08;
/** Constante de suavizacao dos filtros e taxas. Mais longa: e um leito. */
const PARAM_GLIDE = 0.15;

/** Teto de ganho do leito. Ele e o LEITO; a boca abrindo e fechando sao vozes. */
const CEILING = 0.3;

/** Corte do passa-baixa do ar com a boca fechada (nunca soa) e escancarada. */
const AIR_CUTOFF_OPEN_HZ = 2400;
const AIR_CUTOFF_FULL_HZ = 420;

/** Tremolo da garganta, em Hz, do inicio ao fim da rampa. */
const THROAT_RATE_MIN = 0.9;
const THROAT_RATE_MAX = 2.4;

/** Taxa dos fragmentos de silica, em Hz: acelera para o centro. */
const SHARD_RATE_MIN = 3;
const SHARD_RATE_MAX = 14;

export class DevourerVortexBus {
  private gain: GainNode | null = null;
  private air: BiquadFilterNode | null = null;
  private throatLfo: OscillatorNode | null = null;
  private shardLfo: OscillatorNode | null = null;
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

    // O AR sendo puxado: ruido em passa-baixa cujo corte desce com a boca.
    const airSrc = ctx.createBufferSource();
    airSrc.buffer = noise;
    airSrc.loop = true;
    const air = ctx.createBiquadFilter();
    air.type = 'lowpass';
    air.frequency.setValueAtTime(AIR_CUTOFF_OPEN_HZ, t0);
    air.Q.setValueAtTime(0.9, t0);
    const airGain = ctx.createGain();
    airGain.gain.setValueAtTime(0.5, t0);
    airSrc.connect(air).connect(airGain).connect(gain);
    airSrc.start(t0);
    this.sources.push(airSrc);

    // A GARGANTA: subgrave com tremolo lento. O LFO modula o ganho do seno.
    const throat = ctx.createOscillator();
    throat.type = 'sine';
    throat.frequency.setValueAtTime(38, t0);
    const throatGain = ctx.createGain();
    throatGain.gain.setValueAtTime(0.45, t0);
    const throatDepth = ctx.createGain();
    throatDepth.gain.setValueAtTime(0.35, t0);
    const throatLfo = ctx.createOscillator();
    throatLfo.type = 'sine';
    throatLfo.frequency.setValueAtTime(THROAT_RATE_MIN, t0);
    throatLfo.connect(throatDepth).connect(throatGain.gain);
    throat.connect(throatGain).connect(gain);
    throat.start(t0);
    throatLfo.start(t0);
    this.sources.push(throat, throatLfo);

    // OS FRAGMENTOS: banda estreita e aguda, com tremolo rapido — cada batida
    // do LFO e um grao de silica passando. A taxa sobe com a intensidade.
    const shardSrc = ctx.createBufferSource();
    shardSrc.buffer = noise;
    shardSrc.loop = true;
    shardSrc.playbackRate.value = 1.3;
    const shard = ctx.createBiquadFilter();
    shard.type = 'bandpass';
    shard.frequency.setValueAtTime(3200, t0);
    shard.Q.setValueAtTime(5, t0);
    const shardGain = ctx.createGain();
    shardGain.gain.setValueAtTime(0.1, t0);
    const shardDepth = ctx.createGain();
    shardDepth.gain.setValueAtTime(0.1, t0);
    const shardLfo = ctx.createOscillator();
    shardLfo.type = 'square';
    shardLfo.frequency.setValueAtTime(SHARD_RATE_MIN, t0);
    shardLfo.connect(shardDepth).connect(shardGain.gain);
    shardSrc.connect(shard).connect(shardGain).connect(gain);
    shardSrc.start(t0);
    shardLfo.start(t0);
    this.sources.push(shardSrc, shardLfo);

    this.gain = gain;
    this.air = air;
    this.throatLfo = throatLfo;
    this.shardLfo = shardLfo;
  }

  /**
   * Poe o vortice nesta intensidade. Chamar uma vez por quadro.
   *
   * `intensity` (0..1) e a mesma `mawIntensity` da simulacao; `presence`
   * (0..1) e a atenuacao por distancia do ouvinte ate a boca — o leito nao
   * passa pelo mixer, entao a distancia e aplicada aqui, com a mesma curva.
   */
  set(intensity: number, presence: number): void {
    const { ctx, gain, air, throatLfo, shardLfo } = this;
    if (!gain || !air || !throatLfo || !shardLfo) return;
    const k = Math.max(0, Math.min(1, intensity));
    const now = ctx.currentTime;
    air.frequency.setTargetAtTime(
      AIR_CUTOFF_OPEN_HZ + (AIR_CUTOFF_FULL_HZ - AIR_CUTOFF_OPEN_HZ) * k,
      now,
      PARAM_GLIDE,
    );
    throatLfo.frequency.setTargetAtTime(
      THROAT_RATE_MIN + (THROAT_RATE_MAX - THROAT_RATE_MIN) * k,
      now,
      PARAM_GLIDE,
    );
    shardLfo.frequency.setTargetAtTime(
      SHARD_RATE_MIN + (SHARD_RATE_MAX - SHARD_RATE_MIN) * k,
      now,
      PARAM_GLIDE,
    );
    // Ja audivel no primeiro tick da rampa (`k ** 0.6`): a boca acabou de
    // abrir e o jogador precisa OUVIR que ela esta puxando antes de sentir.
    const level = k <= 0 ? 0 : CEILING * Math.pow(k, 0.6) * Math.max(0, Math.min(1, presence));
    gain.gain.setTargetAtTime(level, now, GAIN_GLIDE);
  }

  /** Cala o vortice sem destruir nada. */
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
    this.air = null;
    this.throatLfo = null;
    this.shardLfo = null;
    this.started = false;
  }
}
