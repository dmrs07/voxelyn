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

/** Batidas por segundo do aviso de calor, do primeiro tique ao travamento. */
const TICK_RATE_MIN = 2.2;
const TICK_RATE_MAX = 14;

/**
 * Fatia do topo da senoide, em amplitude, em que a porta do tique abre.
 *
 * O valor e pequeno porque a senoide se arrasta perto do pico: 0,022 de
 * amplitude sao quase 9% do periodo. Como a janela e sempre a mesma fracao do
 * periodo, a batida aperta sozinha quando a taxa sobe — 40 ms de "toc" a 2,2 Hz,
 * 6 ms de estalo a 14 Hz — sem nenhum parametro extra para manter em sincronia.
 */
const TICK_DUTY = 0.022;

/**
 * Meia batida, sobre 0..1 da subida da janela. MONOTONA, e este e o ponto.
 *
 * O formatador nao tem memoria: enxerga so a amplitude instantanea, e a senoide
 * visita cada valor abaixo do pico duas vezes por ciclo, subindo e descendo. Um
 * envelope completo escrito na curva era portanto percorrido duas vezes — o
 * leito entregava um PAR de batidas por ciclo, o dobro da taxa anunciada, com a
 * segunda ainda por cima invertida no tempo.
 *
 * Com uma curva que so cresce, as duas travessias se somam em UMA batida: a
 * subida desenha o ataque, a descida desenha a queda, e o pico cai no apice da
 * senoide. Uma batida por ciclo, que e o que a taxa promete.
 *
 * Uma rampa (`sawtooth`) resolveria o mesmo e ainda deixaria a batida assimetrica,
 * mas o salto dela atravessa a faixa inteira em poucas amostras e reabre a porta
 * de passagem: medido, um fantasma a -8,6 dB da batida, uma vez por ciclo. Um
 * clique fixo e pior que a simetria, entao fica a senoide.
 *
 * Expoente acima de 1 para contrariar a lentidao da senoide no apice, que sem
 * isso acharia o topo do envelope e daria um pulso arredondado em vez de batida.
 */
const tickRise = (u: number): number => {
  if (u <= 0) return 0;
  if (u >= 1) return 1;
  return Math.pow(u, 1.8);
};

/**
 * Curva do formatador: amplitude do LFO (-1..1) para abertura da porta (0..1).
 *
 * Tabela grande porque so `TICK_DUTY` dela e usada — com 1024 pontos, a batida
 * inteira caberia em uma dezena, e os degraus chegariam ao alto-falante como
 * estalo em cima do tique. E memoria de uma vez so, na criacao do leito.
 */
const tickCurve = (): Float32Array<ArrayBuffer> => {
  const n = 16384;
  // Buffer explicito: `new Float32Array(n)` sai como `ArrayBufferLike`, e
  // `WaveShaperNode.curve` so aceita um respaldado por `ArrayBuffer`.
  const curve = new Float32Array(new ArrayBuffer(n * Float32Array.BYTES_PER_ELEMENT));
  const opensAt = 1 - 2 * TICK_DUTY;
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    curve[i] = tickRise((x - opensAt) / (2 * TICK_DUTY));
  }
  return curve;
};

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
      this.beds.set('gas', { gain, ceiling: 0.14 });
    }

    // Calor: tique metalico que ACELERA rumo ao travamento — e silencio antes
    // do limiar.
    //
    // Era um dente-de-serra deslizando de 320 a 940 Hz, e o problema nunca foi o
    // volume. Primeiro, nao tinha limiar: com `HEAT_PER_SHOT` 9 contra
    // decaimento 1,15 por tick, qualquer combate o mantinha aceso, e o jogador
    // aprendia a ignora-lo justamente porque ele nunca calava. Segundo, o
    // timbre: um dente-de-serra com glissando entre 300 e 900 Hz mora na banda
    // mais cansativa que existe, e e a MESMA banda do tiro e do impacto. Os
    // outros leitos passam por baixo da mixagem (ruido, sub); este disputava
    // espaco com ela.
    //
    // Tique corrige os dois. Intermitente cansa muito menos que sustentado, e a
    // urgencia vira TAXA em vez de altura. Taxa e a grandeza certa porque se le
    // sem referencia: para saber que um tom subiu e preciso lembrar de onde ele
    // estava, mas um tique acelerando e obvio no proprio instante em que soa.
    {
      const src = loop();
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 1500;
      // Q alto: ruido de banda larga daria um "ch" de vapor, nao metal batendo.
      filter.Q.value = 7;

      // A batida nasce de uma PORTA, nao de nos criados por tique. Agendar um
      // envelope por batida a 14 Hz seria voltar exatamente ao custo que este
      // arquivo existe para evitar, e ainda amarraria o som ao ritmo do quadro.
      const gate = ctx.createGain();
      gate.gain.value = 0;
      const rate = ctx.createOscillator();
      // Senoide, com a curva monotona de `tickRise` cuidando de haver uma unica
      // batida por ciclo. Onda sem salto e sem canto: nao ha ringing de banda
      // limitada para a porta deixar passar.
      rate.type = 'sine';
      rate.frequency.value = TICK_RATE_MIN;
      // O formatador recorta a senoide numa batida curta. Ligar o LFO direto na
      // porta daria tremolo — o som ondularia sem nunca calar, que e de novo um
      // leito continuo, so que disfarcado.
      const shaper = ctx.createWaveShaper();
      shaper.curve = tickCurve();
      rate.connect(shaper).connect(gate.gain);
      rate.start(t0);
      this.sources.push(rate);

      const gain = ctx.createGain();
      gain.gain.value = 0;
      src.connect(filter).connect(gate).connect(gain).connect(out);
      src.start(t0);
      this.beds.set('heat', {
        gain,
        // Teto acima do leito antigo, energia media bem abaixo: o ciclo util e
        // de poucos por cento, entao o pico pode ser alto sem que o aviso pese
        // na mixagem. Ele continua informando por presenca e por taxa.
        ceiling: 0.34,
        modulate: (level, now) => {
          rate.frequency.setTargetAtTime(
            TICK_RATE_MIN + level * (TICK_RATE_MAX - TICK_RATE_MIN),
            now,
            GLIDE,
          );
          // O metal tambem esquenta: a banda sobe junto com a taxa, e as
          // ultimas batidas antes do travamento saem mais duras que as
          // primeiras. Sozinha a taxa ja bastaria; isto e o que faz as duas
          // pontas da escala soarem como coisas diferentes, e nao como a mesma
          // batida em velocidades diferentes.
          filter.frequency.setTargetAtTime(1500 + level * 1300, now, GLIDE);
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
