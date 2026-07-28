// Os leitos continuos, do lado do browser.
//
// Diferenca essencial para `synth.ts`: la, cada evento cria nos que morrem
// sozinhos; aqui os nos nascem uma vez e vivem a run inteira, e o que muda e o
// ganho. Criar e destruir osciladores a 60 Hz para simular fogo continuo seria
// caro e, pior, cheio de descontinuidades — o crepitar sairia granulado no
// ritmo do quadro em vez do ritmo do fogo.
//
// Todo movimento de parametro passa por `setTargetAtTime`. Atribuir `.value`
// direto num no de audio produz um degrau na amostra seguinte, que num leito
// continuo e literalmente um clique. Aqui isso aconteceria a cada quadro.

import type { AmbienceLevels } from './ambience';

/** Constante de suavizacao dos ganhos, em segundos. */
const GLIDE = 0.12;

type Bed = {
  gain: GainNode;
  /** Ganho maximo do leito quando o nivel esta em 1. */
  ceiling: number;
  /** Chamado a cada atualizacao, para leitos que mudam mais que o volume. */
  modulate?: (level: number, now: number) => void;
};

export class AmbienceBus {
  private readonly beds = new Map<keyof AmbienceLevels, Bed>();
  private readonly sources: AudioScheduledSourceNode[] = [];
  private started = false;

  constructor(
    private readonly ctx: AudioContext,
    private readonly out: AudioNode,
    private readonly noise: AudioBuffer,
  ) {}

  /** Cria e inicia todos os leitos em ganho zero. Idempotente. */
  start(): void {
    if (this.started) return;
    this.started = true;
    const { ctx, out, noise } = this;
    const t0 = ctx.currentTime;

    const loop = (): AudioBufferSourceNode => {
      const src = ctx.createBufferSource();
      src.buffer = noise;
      src.loop = true;
      // Cada leito parte de um ponto diferente do MESMO buffer: dois leitos
      // partindo de zero correlacionariam, e ruido correlacionado soma como
      // tom, nao como ruido — produz um zumbido fantasma que ninguem pediu.
      src.playbackRate.value = 0.6 + Math.random() * 0.5;
      this.sources.push(src);
      return src;
    };

    // Fogo: ruido em banda media com o filtro oscilando devagar. A oscilacao e
    // o que separa "fogo" de "chuveiro"; sem ela o leito e estatico e o ouvido
    // para de registra-lo em poucos segundos.
    {
      const src = loop();
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 760;
      filter.Q.value = 0.7;
      const lfo = ctx.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.value = 0.7;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 320;
      lfo.connect(lfoGain).connect(filter.frequency);
      lfo.start(t0);
      this.sources.push(lfo);
      const gain = ctx.createGain();
      gain.gain.value = 0;
      src.connect(filter).connect(gain).connect(out);
      src.start(t0);
      this.beds.set('fire', { gain, ceiling: 0.3 });
    }

    // Gas: sibilo agudo e estavel. Estavel de proposito — gas nao "crepita", e
    // a imobilidade do som e parte do desconforto.
    {
      const src = loop();
      const filter = ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.value = 3800;
      const gain = ctx.createGain();
      gain.gain.value = 0;
      src.connect(filter).connect(gain).connect(out);
      src.start(t0);
      this.beds.set('gas', { gain, ceiling: 0.17 });
    }

    // Calor: apito que SOBE de altura com o nivel. Volume sozinho nao serviria
    // — o jogador precisa saber a que distancia esta do travamento, e isso e
    // uma escala continua, nao um alarme binario que so dispara no fim.
    {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = 320;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 1400;
      const gain = ctx.createGain();
      gain.gain.value = 0;
      osc.connect(filter).connect(gain).connect(out);
      osc.start(t0);
      this.sources.push(osc);
      this.beds.set('heat', {
        gain,
        // Teto baixo: isto toca junto de tudo o mais e nunca pode competir com
        // um telegrafo. Ele informa por PRESENCA e por altura, nao por volume.
        ceiling: 0.1,
        modulate: (level, now) => {
          osc.frequency.setTargetAtTime(320 + level * 620, now, GLIDE);
        },
      });
    }

    // Contaminacao: sub grave que cresce a run inteira. E o relogio do jogo
    // tornado audivel — a unica coisa que informa, sem HUD, que a run esta
    // acabando.
    {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = 42;
      const osc2 = ctx.createOscillator();
      osc2.type = 'sine';
      // Batimento lento entre 42 e 42,7 Hz: a dissonancia se move sozinha e
      // impede que o drone vire silencio perceptivo.
      osc2.frequency.value = 42.7;
      const gain = ctx.createGain();
      gain.gain.value = 0;
      osc.connect(gain);
      osc2.connect(gain);
      gain.connect(out);
      osc.start(t0);
      osc2.start(t0);
      this.sources.push(osc, osc2);
      this.beds.set('dread', { gain, ceiling: 0.24 });
    }

    // Ameaca: pulsacao grave. O ritmo e fixo; o que muda e a profundidade,
    // entao mais inimigos por perto nao aceleram a batida (o que soaria como
    // musica), so a tornam mais presente.
    {
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = 68;
      const pulse = ctx.createGain();
      pulse.gain.value = 0;
      const lfo = ctx.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.value = 1.35;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 1;
      lfo.connect(lfoGain).connect(pulse.gain);
      lfo.start(t0);
      const gain = ctx.createGain();
      gain.gain.value = 0;
      osc.connect(pulse).connect(gain).connect(out);
      osc.start(t0);
      this.sources.push(osc, lfo);
      this.beds.set('threat', { gain, ceiling: 0.16 });
    }
  }

  /** Aplica os niveis suavizados aos leitos. */
  apply(levels: AmbienceLevels): void {
    if (!this.started) return;
    const now = this.ctx.currentTime;
    for (const [key, bed] of this.beds) {
      const level = levels[key];
      bed.gain.gain.setTargetAtTime(bed.ceiling * level, now, GLIDE);
      bed.modulate?.(level, now);
    }
  }

  /** Silencia tudo imediatamente, sem destruir os nos. */
  silence(): void {
    if (!this.started) return;
    const now = this.ctx.currentTime;
    for (const bed of this.beds.values()) bed.gain.gain.setTargetAtTime(0, now, 0.05);
  }

  /** Solta os osciladores. So no encerramento do contexto. */
  dispose(): void {
    for (const src of this.sources) {
      try {
        src.stop();
      } catch {
        /* ja parado */
      }
    }
    this.sources.length = 0;
    this.beds.clear();
    this.started = false;
  }
}
