// O MOTOR do canhao rotativo: o unico som contínuo da arma.
//
// Por que ele nao vive em `synth.ts`: la, cada evento cria nos que nascem,
// tocam e morrem. Aqui os nos nascem UMA vez e vivem enquanto o contexto
// existir, e o que muda e a altura e o ganho. E a mesma decisao do
// `AmbienceBus`, pelo mesmo motivo, e a alternativa e conhecida — criar um
// oscilador por quadro para simular rotacao continua sairia granulado no
// ritmo do quadro em vez do ritmo do motor, e custaria sessenta nos por
// segundo para dizer uma coisa so.
//
// O que este barramento cobre e o que NAO cobre:
//
//   - COBRE o motor do jogador LOCAL. Uma rotacao continua com altura ligada
//     ao RPM autoritativo, sem posicao — o motor do proprio bot esta sempre
//     "aqui", como o `hitPlayer` esta.
//   - NAO COBRE o parceiro remoto. O motor dele chega pelas vozes espaciais
//     `minigunSpinStart` / `minigunSpinStop` e pelo `minigunBurst`, que
//     carrega a posicao no evento. Um segundo leito continuo por jogador
//     remoto seria um par de osciladores permanentes por slot para uma arma
//     que ele pode nunca pegar, e o paneamento de um leito que persegue um
//     corpo em movimento e justamente o que soa artificial.
//
// Todo movimento de parametro passa por `setTargetAtTime`. Atribuir `.value`
// direto num no continuo e literalmente um clique na amostra seguinte, e aqui
// isso aconteceria a cada quadro.

/** Constante de suavizacao do ganho, em segundos. Curta: o motor responde. */
const GAIN_GLIDE = 0.05;

/**
 * Constante de suavizacao da ALTURA. Mais longa que a do ganho de proposito.
 *
 * A rotacao autoritativa e um degrau por tick (50 ms); seguir esses degraus
 * de perto produziria uma escada audivel na subida. Com 90 ms a escada vira
 * rampa, e a rampa ainda chega ao topo dentro dos 700 ms do spin-up.
 */
const PITCH_GLIDE = 0.09;

/** Altura do motor parado e do motor no maximo, em Hz. */
const IDLE_HZ = 46;
const FULL_HZ = 172;

/** Teto de ganho do leito. Baixo: ele e o LEITO, nao a rajada. */
const CEILING = 0.16;

export class MinigunBus {
  private gain: GainNode | null = null;
  private body: OscillatorNode | null = null;
  private harmonic: OscillatorNode | null = null;
  private grit: BiquadFilterNode | null = null;
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

    // A ARMADURA girando: dente de serra grave. E a fundamental do motor.
    const body = ctx.createOscillator();
    body.type = 'sawtooth';
    body.frequency.setValueAtTime(IDLE_HZ, t0);
    const bodyGain = ctx.createGain();
    bodyGain.gain.setValueAtTime(0.6, t0);
    body.connect(bodyGain).connect(gain);
    body.start(t0);
    this.sources.push(body);

    // A quinta desafinada por cima: e ela que faz o motor soar como um
    // CONJUNTO de pecas em vez de uma nota. Sem ela o leito e um zumbido de
    // sintetizador, e a arma perde a massa metalica inteira.
    const harmonic = ctx.createOscillator();
    harmonic.type = 'square';
    harmonic.frequency.setValueAtTime(IDLE_HZ * 1.5, t0);
    harmonic.detune.setValueAtTime(11, t0);
    const harmonicGain = ctx.createGain();
    harmonicGain.gain.setValueAtTime(0.16, t0);
    harmonic.connect(harmonicGain).connect(gain);
    harmonic.start(t0);
    this.sources.push(harmonic);

    // O ATRITO: ruido em banda estreita cuja frequencia central sobe com o
    // RPM. E o que separa "motor eletrico industrial" de "nota grave".
    const src = ctx.createBufferSource();
    src.buffer = noise;
    src.loop = true;
    src.playbackRate.value = 0.75;
    const grit = ctx.createBiquadFilter();
    grit.type = 'bandpass';
    grit.frequency.setValueAtTime(500, t0);
    grit.Q.setValueAtTime(1.6, t0);
    const gritGain = ctx.createGain();
    gritGain.gain.setValueAtTime(0.34, t0);
    src.connect(grit).connect(gritGain).connect(gain);
    src.start(t0);
    this.sources.push(src);

    this.gain = gain;
    this.body = body;
    this.harmonic = harmonic;
    this.grit = grit;
  }

  /**
   * Poe o motor nesta rotacao. Chamar uma vez por quadro.
   *
   * `spin` e 0..1 e vem do ESTADO autoritativo (`playerExtra.minigun.spin`
   * dividido pelo maximo), nunca de um contador do cliente: um relogio
   * proprio divergiria do gatilho na primeira reconexao, e o jogador ouviria
   * o motor acelerar depois de a arma ja ter comecado a cuspir.
   *
   * `strain` (0..1) e o esforco: perto do superaquecimento o motor desafina
   * para baixo e ganha atrito. E o unico canal sonoro que antecipa o
   * travamento, e ele acompanha a mesma barra de calor que o HUD desenha.
   */
  set(spin: number, strain: number): void {
    const { ctx, gain, body, harmonic, grit } = this;
    if (!gain || !body || !harmonic || !grit) return;
    const rpm = Math.max(0, Math.min(1, spin));
    const stress = Math.max(0, Math.min(1, strain));
    const now = ctx.currentTime;

    // Curva de altura levemente acelerada (potencia 0,85): o motor "pega" no
    // fim da subida, que e onde a antecipacao tem de estar.
    const hz = IDLE_HZ + (FULL_HZ - IDLE_HZ) * Math.pow(rpm, 0.85) * (1 - stress * 0.14);
    body.frequency.setTargetAtTime(hz, now, PITCH_GLIDE);
    harmonic.frequency.setTargetAtTime(hz * 1.5, now, PITCH_GLIDE);
    grit.frequency.setTargetAtTime(320 + 1500 * rpm + 400 * stress, now, PITCH_GLIDE);
    // Rampa de ganho com piso em zero: `rpm ** 0.7` faz o motor JA ser
    // audivel no primeiro tick de rotacao, que e o que vende a antecipacao.
    gain.gain.setTargetAtTime(CEILING * Math.pow(rpm, 0.7), now, GAIN_GLIDE);
  }

  /** Cala o motor sem destruir nada. */
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
    this.body = null;
    this.harmonic = null;
    this.grit = null;
    this.started = false;
  }
}
