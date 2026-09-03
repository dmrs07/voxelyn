// Sintese: a unica parte do audio que precisa de browser.
//
// Nao ha um unico arquivo de som no projeto, e isso e uma decisao, nao uma
// limitacao. Tres razoes, na ordem em que pesaram:
//
// 1. O jogo e um PWA que precisa iniciar offline no primeiro uso. Cada .ogg
//    entra no precache do service worker; um pacote de sons decente passa
//    facil de 2 MB, contra ~8 KB deste arquivo. O que se ganha em timbre se
//    perde na promessa de instalar e jogar.
// 2. A biblioteca inteira e "sem dependencias, sem assets" — importar um
//    formato de audio e um pipeline de conversao contradiz o resto do repo.
// 3. Som sintetizado tem parametro, nao forma de onda: a altura do telegrafo
//    do bruiser e um numero neste arquivo, ajustavel numa linha, e nao um
//    render novo.
//
// O que ISTO NAO E: musica. A musica existe (music.ts / music-bus.ts, um tema
// de doom/drone por estrato), mas nao vive aqui: este arquivo e SO eventos —
// nos que nascem, tocam e morrem. A musica e feita de nos persistentes e de um
// scheduler proprio, e a mixagem dela e subordinada por contrato: SFX > musica.

/** Duracao do buffer de ruido compartilhado, em segundos. */
const NOISE_SECONDS = 2;

export type VoiceRenderer = (
  ctx: AudioContext,
  out: AudioNode,
  t0: number,
  noise: AudioBuffer,
) => void;

// ---------------------------------------------------------------------------
// Blocos de construcao
// ---------------------------------------------------------------------------

/**
 * Envelope percussivo padrao.
 *
 * `setTargetAtTime` e nao `linearRampToValueAtTime` para a cauda: decaimento
 * linear em audio soa como um portao fechando, porque a percepcao de volume e
 * logaritmica. A exponencial e o que faz um impacto soar como impacto.
 *
 * O ataque nunca e instantaneo (2 ms de rampa) porque salto de amplitude em
 * amostra unica produz um estalo audivel — em fone de ouvido, num jogo que vai
 * disparar isto milhares de vezes por run, o estalo vira fadiga.
 */
const shape = (
  ctx: AudioContext,
  t0: number,
  peak: number,
  decaySec: number,
  attackSec = 0.002,
): GainNode => {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.linearRampToValueAtTime(peak, t0 + attackSec);
  g.gain.setTargetAtTime(0.0001, t0 + attackSec, decaySec / 3);
  return g;
};

/** Oscilador com varredura de frequencia e envelope. */
const tone = (
  ctx: AudioContext,
  out: AudioNode,
  t0: number,
  opts: {
    type: OscillatorType;
    from: number;
    to?: number;
    peak: number;
    decay: number;
    attack?: number;
    detune?: number;
  },
): void => {
  const osc = ctx.createOscillator();
  osc.type = opts.type;
  if (opts.detune) osc.detune.setValueAtTime(opts.detune, t0);
  osc.frequency.setValueAtTime(opts.from, t0);
  if (opts.to !== undefined && opts.to !== opts.from) {
    // exponencial: varredura de altura tambem e percebida em oitavas
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, opts.to), t0 + opts.decay);
  }
  const g = shape(ctx, t0, opts.peak, opts.decay, opts.attack);
  osc.connect(g).connect(out);
  osc.start(t0);
  osc.stop(t0 + opts.decay + 0.12);
};

/** Rajada de ruido filtrado: base de tudo que e impacto, fogo, gas e vento. */
const burst = (
  ctx: AudioContext,
  out: AudioNode,
  t0: number,
  noise: AudioBuffer,
  opts: {
    peak: number;
    decay: number;
    type: BiquadFilterType;
    from: number;
    to?: number;
    q?: number;
    attack?: number;
    rate?: number;
  },
): void => {
  const src = ctx.createBufferSource();
  src.buffer = noise;
  // Deslocamento aleatorio dentro do buffer: sem isso toda rajada parte da
  // mesma amostra e duas explosoes seguidas soam LITERALMENTE identicas, o que
  // o ouvido detecta na hora e le como bug.
  const offset = Math.random() * (NOISE_SECONDS - opts.decay - 0.05);
  if (opts.rate) src.playbackRate.setValueAtTime(opts.rate, t0);

  const filter = ctx.createBiquadFilter();
  filter.type = opts.type;
  filter.frequency.setValueAtTime(opts.from, t0);
  if (opts.to !== undefined && opts.to !== opts.from) {
    filter.frequency.exponentialRampToValueAtTime(Math.max(20, opts.to), t0 + opts.decay);
  }
  if (opts.q !== undefined) filter.Q.setValueAtTime(opts.q, t0);

  const g = shape(ctx, t0, opts.peak, opts.decay, opts.attack);
  src.connect(filter).connect(g).connect(out);
  src.start(t0, Math.max(0, offset), opts.decay + 0.12);
};

/**
 * Tom SUSTENTADO: sobe, segura, e so entao cai. E o bloco dos chefes.
 *
 * `tone` e percussivo — ataque de 2 ms e cauda — e serve para tudo o que
 * e um impacto. Um chamado de baleia, um motor ganhando rotacao, um gemido
 * com harmonicos se acumulando NAO sao impactos: sao coisas que duram, e a
 * forma delas e o ataque lento e a sustentacao. A varredura de altura corre
 * do ataque ao fim do hold, para o "subindo" e o "descendo" coincidirem com
 * o tempo em que a voz esta plena.
 */
const sustain = (
  ctx: AudioContext,
  out: AudioNode,
  t0: number,
  opts: {
    type: OscillatorType;
    from: number;
    to?: number;
    peak: number;
    attack: number;
    hold: number;
    release: number;
    detune?: number;
  },
): void => {
  const osc = ctx.createOscillator();
  osc.type = opts.type;
  if (opts.detune) osc.detune.setValueAtTime(opts.detune, t0);
  osc.frequency.setValueAtTime(opts.from, t0);
  if (opts.to !== undefined && opts.to !== opts.from) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, opts.to), t0 + opts.attack + opts.hold);
  }
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.linearRampToValueAtTime(opts.peak, t0 + opts.attack);
  g.gain.setValueAtTime(opts.peak, t0 + opts.attack + opts.hold);
  g.gain.setTargetAtTime(0.0001, t0 + opts.attack + opts.hold, opts.release / 3);
  osc.connect(g).connect(out);
  osc.start(t0);
  osc.stop(t0 + opts.attack + opts.hold + opts.release + 0.15);
};

/**
 * A VOZ CORPORATIVA do Diamandis: fonemas roboticos, sem gravacao humana.
 *
 * Cada silaba e uma onda quadrada curta com um formante (ruido em banda
 * estreita) por cima, e o que separa as frases umas das outras e o RITMO:
 * "SON-DA-GEM" tem tres batidas, "A-FAS-TE-SE" tem quatro. As palavras nao
 * ficam inteligiveis, e nao precisam — o que o jogador aprende e a
 * cadencia, e a cadencia e a personalidade: uma ordem de trabalho lida em
 * voz alta por uma maquina que ainda acredita que esta trabalhando.
 *
 * `pattern` e uma lista de [altura em Hz, duracao em s]; o intervalo entre
 * silabas e fixo (40 ms), o que da a fala o staccato de um sintetizador de
 * voz dos anos 80 em vez de uma fala continua.
 */
const speak = (
  ctx: AudioContext,
  out: AudioNode,
  t0: number,
  noise: AudioBuffer,
  pattern: ReadonlyArray<readonly [number, number]>,
  peak = 0.3,
): void => {
  let at = t0;
  for (const [hz, dur] of pattern) {
    tone(ctx, out, at, {
      type: 'square',
      from: hz,
      to: hz * 0.94,
      peak,
      decay: dur,
      attack: 0.008,
    });
    tone(ctx, out, at, {
      type: 'sawtooth',
      from: hz * 2.02,
      to: hz * 1.9,
      peak: peak * 0.35,
      decay: dur * 0.8,
      attack: 0.008,
    });
    burst(ctx, out, at, noise, {
      peak: peak * 0.5,
      decay: dur * 0.7,
      type: 'bandpass',
      from: 1400 + (hz % 60) * 8,
      q: 4,
      attack: 0.01,
    });
    at += dur + 0.04;
  }
};

/** Uma nota AFINADA do Arquicantor: triangulo com a oitava e a quinta por cima. */
const crystalNote = (
  ctx: AudioContext,
  out: AudioNode,
  t0: number,
  hz: number,
  peak: number,
  decay: number,
): void => {
  tone(ctx, out, t0, { type: 'triangle', from: hz, to: hz, peak, decay, attack: 0.012 });
  tone(ctx, out, t0, {
    type: 'sine',
    from: hz * 2,
    to: hz * 2,
    peak: peak * 0.35,
    decay: decay * 0.8,
    attack: 0.012,
  });
  tone(ctx, out, t0 + 0.01, {
    type: 'sine',
    from: hz * 3,
    to: hz * 3,
    peak: peak * 0.12,
    decay: decay * 0.6,
    attack: 0.012,
  });
};

/**
 * O MOTIVO de tres notas do Arquicantor. A4, C#5, E5: uma triade maior, que
 * e a frase que RESOLVE. O tritono troca a terceira por D#5 e deixa a frase
 * sem chao — e a diferenca entre "vem canto" e "vem canto e ele e grande".
 */
const ARCHCANTOR_MOTIF = [440, 554.37, 659.25] as const;
const ARCHCANTOR_TRITONE = 622.25;

/** Um "bling" de gelo: aperiodico, levemente desafinado, cauda curta. */
const iceBling = (
  ctx: AudioContext,
  out: AudioNode,
  t0: number,
  hz: number,
  peak: number,
): void => {
  tone(ctx, out, t0, {
    type: 'triangle',
    from: hz,
    to: hz * 0.97,
    peak,
    decay: 0.09,
    detune: (hz % 17) * 3 - 24,
  });
};

// ---------------------------------------------------------------------------
// Receitas
// ---------------------------------------------------------------------------
//
// Regra de legibilidade que rege a tabela inteira: os TELEGRAFOS ocupam a faixa
// media-aguda (500-2000 Hz) com formas tonais e ritmadas, e o mundo (entulho,
// fogo, gas) ocupa ruido de banda larga. Sao categorias timbricas diferentes,
// entao um aviso nunca e mascarado por uma parede caindo, mesmo quando os dois
// tocam no mesmo instante com o mesmo ganho. Volume nao resolveria isso: dois
// ruidos de banda larga se mascaram por mais alto que um deles esteja.

export const VOICE_RENDERERS: Record<string, VoiceRenderer> = {
  // --- telegrafos ---------------------------------------------------------
  // Dois toques subindo: "vem na sua direcao".
  telegraphCharge: (ctx, out, t0) => {
    tone(ctx, out, t0, { type: 'square', from: 520, to: 700, peak: 0.5, decay: 0.07 });
    tone(ctx, out, t0 + 0.1, { type: 'square', from: 700, to: 940, peak: 0.5, decay: 0.09 });
  },
  // Metalico e ascendente: algo pesado sendo ERGUIDO. O jogador tem 0,8 s para
  // reagir; o som ocupa a metade inicial disso e deixa o resto em silencio,
  // porque o silencio depois do aviso e o que marca "agora".
  telegraphHurl: (ctx, out, t0) => {
    tone(ctx, out, t0, {
      type: 'sawtooth',
      from: 180,
      to: 620,
      peak: 0.32,
      decay: 0.34,
      attack: 0.02,
    });
    tone(ctx, out, t0, {
      type: 'square',
      from: 270,
      to: 930,
      peak: 0.14,
      decay: 0.34,
      attack: 0.02,
      detune: 12,
    });
  },
  telegraphSlam: (ctx, out, t0, noise) => {
    tone(ctx, out, t0, {
      type: 'triangle',
      from: 90,
      to: 240,
      peak: 0.55,
      decay: 0.3,
      attack: 0.03,
    });
    burst(ctx, out, t0, noise, {
      peak: 0.2,
      decay: 0.3,
      type: 'bandpass',
      from: 220,
      to: 500,
      q: 1.4,
      attack: 0.03,
    });
  },
  // Agudo, curto, duplo: cuspe chegando. Fica acima de tudo o mais.
  telegraphRanged: (ctx, out, t0) => {
    tone(ctx, out, t0, { type: 'triangle', from: 1180, to: 1180, peak: 0.34, decay: 0.05 });
    tone(ctx, out, t0 + 0.08, { type: 'triangle', from: 1560, to: 1560, peak: 0.34, decay: 0.06 });
  },
  // Tres toques acelerando: a gramatica universal de "isso vai explodir".
  telegraphDetonate: (ctx, out, t0) => {
    tone(ctx, out, t0, { type: 'square', from: 880, to: 880, peak: 0.4, decay: 0.05 });
    tone(ctx, out, t0 + 0.13, { type: 'square', from: 1100, to: 1100, peak: 0.45, decay: 0.05 });
    tone(ctx, out, t0 + 0.22, { type: 'square', from: 1400, to: 1400, peak: 0.5, decay: 0.06 });
  },
  telegraphPulse: (ctx, out, t0, noise) => {
    burst(ctx, out, t0, noise, {
      peak: 0.4,
      decay: 0.26,
      type: 'bandpass',
      from: 400,
      to: 1500,
      q: 3,
      attack: 0.06,
    });
  },

  // --- jogador ------------------------------------------------------------
  shot: (ctx, out, t0, noise) => {
    tone(ctx, out, t0, { type: 'square', from: 760, to: 200, peak: 0.34, decay: 0.075 });
    burst(ctx, out, t0, noise, { peak: 0.16, decay: 0.05, type: 'highpass', from: 2200 });
  },
  dodge: (ctx, out, t0, noise) => {
    burst(ctx, out, t0, noise, {
      peak: 0.4,
      decay: 0.16,
      type: 'bandpass',
      from: 1800,
      to: 500,
      q: 1.1,
      attack: 0.012,
    });
  },
  pulse: (ctx, out, t0, noise) => {
    tone(ctx, out, t0, { type: 'sine', from: 220, to: 60, peak: 0.7, decay: 0.28 });
    burst(ctx, out, t0, noise, { peak: 0.3, decay: 0.22, type: 'lowpass', from: 1800, to: 300 });
  },
  // Alarme de dois tons: e um ESTADO ruim, nao um acerto. Repete para nao ser
  // confundido com um impacto qualquer.
  overheat: (ctx, out, t0) => {
    tone(ctx, out, t0, { type: 'sawtooth', from: 660, to: 660, peak: 0.34, decay: 0.11 });
    tone(ctx, out, t0 + 0.14, { type: 'sawtooth', from: 495, to: 495, peak: 0.34, decay: 0.16 });
  },

  // --- canhao rotativo ----------------------------------------------------
  //
  // O TIMBRE do motor e industrial e nao eletronico: dente de serra grave
  // (a armadura girando) somado a uma banda de ruido media (o atrito do
  // conjunto). Um oscilador puro soaria como sintetizador; o ruido sozinho
  // soaria como vento. A massa metalica esta na SOMA.
  //
  // O arranque SOBE, a parada DESCE, e as duas usam a mesma varredura ao
  // contrario — e o vocabulario mais simples que existe para "ligando" e
  // "desligando", e o banco inteiro ja o usa (ver `bishopHeal`).
  minigunSpinStart: (ctx, out, t0, noise) => {
    tone(ctx, out, t0, {
      type: 'sawtooth',
      from: 52,
      to: 165,
      peak: 0.36,
      decay: 0.5,
      attack: 0.03,
    });
    // A segunda parcial, uma quinta acima e desafinada: e ela que da ao motor
    // o batimento de um conjunto de pecas, em vez de uma nota so.
    tone(ctx, out, t0, {
      type: 'square',
      from: 78,
      to: 246,
      peak: 0.1,
      decay: 0.5,
      attack: 0.05,
      detune: 14,
    });
    burst(ctx, out, t0, noise, {
      peak: 0.16,
      decay: 0.5,
      type: 'bandpass',
      from: 420,
      to: 1500,
      q: 1.3,
      attack: 0.06,
    });
  },
  minigunSpinStop: (ctx, out, t0, noise) => {
    tone(ctx, out, t0, {
      type: 'sawtooth',
      from: 150,
      to: 44,
      peak: 0.3,
      decay: 0.6,
      attack: 0.02,
    });
    burst(ctx, out, t0, noise, {
      peak: 0.12,
      decay: 0.55,
      type: 'bandpass',
      from: 1300,
      to: 320,
      q: 1.2,
      attack: 0.04,
    });
  },
  /**
   * A SARAIVADA de uma janela inteira, numa voz so.
   *
   * Este e o ponto do arquivo em que a arma deixa de ser cara. Uma bala =
   * uma voz seriam dezesseis `AudioNode` novos por segundo por jogador, e o
   * teto de dezesseis vozes do mixer nao sobreviveria a nenhum combate. Aqui
   * TRES transientes sao AGENDADOS dentro da mesma voz, espacados por 45 ms
   * — o Web Audio agenda no futuro sem custo por evento, entao o preco de
   * uma saraivada e o preco de um som.
   *
   * O deslocamento de altura por transiente e deterministico (`i * 60`) e
   * pequeno. E o que separa "metralhadora" de "metralhadora de brinquedo":
   * tres estalos identicos seguidos o ouvido detecta como amostra repetida;
   * tres com o topo caindo lê como mecanismo.
   */
  minigunBurst: (ctx, out, t0, noise) => {
    for (let i = 0; i < 3; i++) {
      const at = t0 + i * 0.045;
      tone(ctx, out, at, {
        type: 'square',
        from: 640 - i * 60,
        to: 190,
        peak: 0.24,
        decay: 0.042,
      });
      burst(ctx, out, at, noise, {
        peak: 0.14,
        decay: 0.035,
        type: 'highpass',
        from: 2400 + i * 220,
      });
    }
    // O CORPO da rajada, por baixo dos estalos: um sopro grave curto que da
    // peso ao conjunto. Sem ele a saraivada e aguda e leve, que e exatamente
    // o oposto do que a arma promete.
    burst(ctx, out, t0, noise, {
      peak: 0.2,
      decay: 0.13,
      type: 'lowpass',
      from: 900,
      to: 240,
      attack: 0.006,
    });
  },
  /**
   * O LATAO no chao: dois cliques metalicos agudos e curtissimos.
   *
   * Dois, e nao um, porque a irregularidade E o som: uma capsula sozinha soa
   * como um clique de UI. E dois, e nao seis, porque o resto da chuva ja e
   * contado pela trava de 130 ms da voz — o que se ouve e um crepitar de
   * latao, nunca a contagem das capsulas.
   */
  minigunCasing: (ctx, out, t0) => {
    tone(ctx, out, t0, { type: 'triangle', from: 2600, to: 1900, peak: 0.2, decay: 0.032 });
    tone(ctx, out, t0 + 0.037, {
      type: 'triangle',
      from: 3100,
      to: 2300,
      peak: 0.14,
      decay: 0.028,
    });
  },

  // --- impactos -----------------------------------------------------------
  hitEnemy: (ctx, out, t0, noise) => {
    burst(ctx, out, t0, noise, {
      peak: 0.45,
      decay: 0.075,
      type: 'bandpass',
      from: 900,
      to: 320,
      q: 0.9,
    });
    tone(ctx, out, t0, { type: 'triangle', from: 300, to: 150, peak: 0.2, decay: 0.06 });
  },
  // Dano em MIM tem corpo grave e cauda longa: e o unico impacto que precisa
  // ser sentido, nao so ouvido, num celular sem graves.
  hitPlayer: (ctx, out, t0, noise) => {
    tone(ctx, out, t0, { type: 'sine', from: 190, to: 62, peak: 0.75, decay: 0.24 });
    burst(ctx, out, t0, noise, { peak: 0.4, decay: 0.14, type: 'lowpass', from: 1400, to: 260 });
  },
  // Dano ambiental por tick. A diferenca para `hitPlayer` tem de ser
  // CATEGORICA no ouvido: nenhum transiente agudo, nenhuma queda dramatica —
  // uma pressao surda que aperta e solta. Quem informa "estou no gas" e o
  // leito continuo; esta voz so lembra que a permanencia custa vida.
  hitPlayerHazard: (ctx, out, t0, noise) => {
    tone(ctx, out, t0, { type: 'sine', from: 85, to: 55, peak: 0.5, decay: 0.16, attack: 0.012 });
    burst(ctx, out, t0, noise, {
      peak: 0.15,
      decay: 0.09,
      type: 'lowpass',
      from: 300,
      attack: 0.01,
    });
  },
  death: (ctx, out, t0, noise) => {
    burst(ctx, out, t0, noise, {
      peak: 0.4,
      decay: 0.3,
      type: 'lowpass',
      from: 1200,
      to: 180,
      attack: 0.008,
    });
    tone(ctx, out, t0, { type: 'sawtooth', from: 260, to: 70, peak: 0.26, decay: 0.3 });
  },
  // Uma maquina PARANDO, e a voz mais curta do banco. Medido num
  // OfflineAudioContext, som audivel ate cair abaixo de -40 dB:
  //
  //   deathMiner     ~190 ms
  //   death           329 ms
  //   deathGuardian  1770 ms
  //
  // A forma sobreviveu a uma troca de ficcao, e vale registrar por que. Ela foi
  // escrita quando o mineiro era humano, com o argumento "esta morte nao pode
  // ressoar". O argumento estava certo pelo motivo errado: nao e a humanidade
  // que pede o corte, e o fato de que ISTO NAO E UM EVENTO. Um automato que para
  // nao tem agonia nem queda dramatica — a corrente cessa, e o que sobra e o
  // silencio de uma coisa que estava zumbindo ha decadas.
  //
  // O que mudou foi o timbre: saiu a parcial dupla batendo (que era voz) e
  // entrou a queda de corrente. Um estalo eletrico e uma descida curta que morre
  // sem cauda, no registro medio — nada de grave, que e dos chefes.
  deathMiner: (ctx, out, t0, noise) => {
    // O corte da corrente: banda estreita e alta, quase instantanea.
    burst(ctx, out, t0, noise, {
      peak: 0.3,
      decay: 0.05,
      type: 'bandpass',
      from: 2600,
      to: 1400,
      q: 3,
    });
    // A queda: o zumbido perdendo tensao. Desce e para, sem chegar ao chao.
    tone(ctx, out, t0, {
      type: 'square',
      from: 420,
      to: 190,
      peak: 0.26,
      decay: 0.13,
      attack: 0.004,
    });
    tone(ctx, out, t0 + 0.02, { type: 'sawtooth', from: 300, to: 210, peak: 0.1, decay: 0.1 });
    // Sem terceira camada, sem grave, sem cauda. O corte E o desenho.
  },
  // Fim de ato: acorde grave descendente, longo o bastante para durar mais que
  // o corpo caindo na tela.
  deathGuardian: (ctx, out, t0, noise) => {
    tone(ctx, out, t0, {
      type: 'sawtooth',
      from: 160,
      to: 40,
      peak: 0.5,
      decay: 1.5,
      attack: 0.02,
    });
    tone(ctx, out, t0 + 0.05, {
      type: 'sine',
      from: 107,
      to: 27,
      peak: 0.5,
      decay: 1.6,
      attack: 0.02,
    });
    burst(ctx, out, t0, noise, { peak: 0.35, decay: 1.1, type: 'lowpass', from: 900, to: 120 });
  },

  // Cura do bispo: a unica voz do jogo que SOBE.
  //
  // Todo o resto do banco desce em frequencia — tiro, impacto, morte, quebra —
  // porque tudo o mais e alguma coisa terminando. Uma glissando ascendente nao
  // precisa ser aprendida: contra um vocabulario inteiro de quedas, ela le como
  // "isto esta voltando" antes de o jogador saber o que e o som.
  // Grito humano. Serra denteada subindo, curta e crua — deliberadamente a voz
  // mais FEIA do banco: nada mais no jogo grita, e o desconforto e o ponto.
  minerRage: (ctx, out, t0, noise) => {
    tone(ctx, out, t0, {
      type: 'sawtooth',
      from: 210,
      to: 430,
      peak: 0.4,
      decay: 0.34,
      attack: 0.01,
    });
    tone(ctx, out, t0 + 0.04, { type: 'square', from: 320, to: 250, peak: 0.16, decay: 0.28 });
    burst(ctx, out, t0, noise, {
      peak: 0.2,
      decay: 0.2,
      type: 'bandpass',
      from: 1400,
      to: 600,
      q: 1.2,
    });
  },
  // Fuga: sopro curto que DESCE e se afasta. Sem tom definido — quem foge nao
  // esta anunciando nada, so foi visto.
  minerFlee: (ctx, out, t0, noise) => {
    burst(ctx, out, t0, noise, {
      peak: 0.3,
      decay: 0.3,
      type: 'bandpass',
      from: 900,
      to: 260,
      q: 0.9,
    });
    tone(ctx, out, t0, { type: 'triangle', from: 300, to: 170, peak: 0.14, decay: 0.24 });
  },
  // Minerio na cota: clique curto e metalico, no registro alto onde nada mais
  // do jogo toca. E um recibo, nao um evento — tem de sumir sob o combate.
  oreGained: (ctx, out, t0) => {
    tone(ctx, out, t0, {
      type: 'square',
      from: 1180,
      to: 1560,
      peak: 0.14,
      decay: 0.09,
      attack: 0.002,
    });
  },
  bishopHeal: (ctx, out, t0) => {
    tone(ctx, out, t0, { type: 'sine', from: 320, to: 620, peak: 0.3, decay: 0.26, attack: 0.03 });
    tone(ctx, out, t0 + 0.02, {
      type: 'triangle',
      from: 480,
      to: 930,
      peak: 0.14,
      decay: 0.22,
      attack: 0.03,
    });
  },

  // --- mundo --------------------------------------------------------------
  explosion: (ctx, out, t0, noise) => {
    tone(ctx, out, t0, { type: 'sine', from: 150, to: 34, peak: 0.85, decay: 0.55 });
    burst(ctx, out, t0, noise, { peak: 0.75, decay: 0.42, type: 'lowpass', from: 3200, to: 200 });
    // Cauda de entulho: e o que separa "explosao numa caverna" de "explosao no
    // vazio". Entra depois do estouro, nunca junto.
    burst(ctx, out, t0 + 0.12, noise, {
      peak: 0.22,
      decay: 0.5,
      type: 'bandpass',
      from: 700,
      to: 300,
      q: 0.7,
      attack: 0.05,
    });
  },
  discharge: (ctx, out, t0, noise) => {
    burst(ctx, out, t0, noise, { peak: 0.55, decay: 0.22, type: 'highpass', from: 1500, to: 4000 });
    tone(ctx, out, t0, { type: 'sawtooth', from: 2400, to: 380, peak: 0.28, decay: 0.14 });
  },
  ignite: (ctx, out, t0, noise) => {
    burst(ctx, out, t0, noise, {
      peak: 0.45,
      decay: 0.3,
      type: 'bandpass',
      from: 500,
      to: 1700,
      q: 0.8,
      attack: 0.03,
    });
  },
  breakRock: (ctx, out, t0, noise) => {
    burst(ctx, out, t0, noise, { peak: 0.5, decay: 0.14, type: 'lowpass', from: 1700, to: 380 });
  },
  // Cristal e tonal e agudo — informacao, nao textura: se um cristal quebrou,
  // vem descarga.
  breakCrystal: (ctx, out, t0, noise) => {
    tone(ctx, out, t0, { type: 'triangle', from: 2400, to: 1500, peak: 0.34, decay: 0.22 });
    tone(ctx, out, t0 + 0.02, { type: 'triangle', from: 3300, to: 2100, peak: 0.2, decay: 0.18 });
    burst(ctx, out, t0, noise, { peak: 0.24, decay: 0.16, type: 'highpass', from: 2600 });
  },
  corrode: (ctx, out, t0, noise) => {
    burst(ctx, out, t0, noise, {
      peak: 0.3,
      decay: 0.34,
      type: 'bandpass',
      from: 2600,
      to: 1400,
      q: 2.4,
      attack: 0.05,
    });
  },
  chip: (ctx, out, t0, noise) => {
    tone(ctx, out, t0, { type: 'triangle', from: 1700, to: 1100, peak: 0.28, decay: 0.06 });
    burst(ctx, out, t0, noise, { peak: 0.2, decay: 0.05, type: 'highpass', from: 3000 });
  },
  spit: (ctx, out, t0, noise) => {
    burst(ctx, out, t0, noise, {
      peak: 0.36,
      decay: 0.13,
      type: 'bandpass',
      from: 2400,
      to: 900,
      q: 1.6,
    });
  },
  rock: (ctx, out, t0, noise) => {
    burst(ctx, out, t0, noise, {
      peak: 0.4,
      decay: 0.2,
      type: 'bandpass',
      from: 300,
      to: 700,
      q: 0.8,
      attack: 0.04,
    });
  },

  // --- objetivos e UI -----------------------------------------------------
  terminalStart: (ctx, out, t0) => {
    tone(ctx, out, t0, { type: 'square', from: 400, to: 400, peak: 0.3, decay: 0.08 });
    tone(ctx, out, t0 + 0.1, { type: 'square', from: 600, to: 600, peak: 0.3, decay: 0.14 });
  },
  terminalDone: (ctx, out, t0) => {
    tone(ctx, out, t0, { type: 'square', from: 600, to: 600, peak: 0.3, decay: 0.08 });
    tone(ctx, out, t0 + 0.09, { type: 'square', from: 800, to: 800, peak: 0.3, decay: 0.08 });
    tone(ctx, out, t0 + 0.18, { type: 'square', from: 1200, to: 1200, peak: 0.34, decay: 0.2 });
  },
  cacheRevealed: (ctx, out, t0) => {
    tone(ctx, out, t0, {
      type: 'sine',
      from: 880,
      to: 1320,
      peak: 0.34,
      decay: 0.35,
      attack: 0.02,
    });
  },
  cacheOpened: (ctx, out, t0, noise) => {
    burst(ctx, out, t0, noise, {
      peak: 0.3,
      decay: 0.18,
      type: 'bandpass',
      from: 900,
      to: 2200,
      q: 1.2,
    });
    tone(ctx, out, t0 + 0.06, { type: 'triangle', from: 1046, to: 1568, peak: 0.3, decay: 0.3 });
  },
  // O nucleo e o climax da run: acorde ascendente cheio, e o unico som do jogo
  // que soa como recompensa sem reservas.
  pickupCore: (ctx, out, t0) => {
    for (const [i, f] of [523, 659, 784, 1046].entries()) {
      tone(ctx, out, t0 + i * 0.07, {
        type: 'triangle',
        from: f,
        to: f,
        peak: 0.35,
        decay: 0.55,
        attack: 0.015,
      });
    }
  },
  purgeAcquired: (ctx, out, t0) => {
    tone(ctx, out, t0, { type: 'sine', from: 700, to: 1000, peak: 0.3, decay: 0.2, attack: 0.015 });
  },
  purgeUsed: (ctx, out, t0, noise) => {
    tone(ctx, out, t0, { type: 'sine', from: 400, to: 900, peak: 0.4, decay: 0.4, attack: 0.03 });
    burst(ctx, out, t0, noise, {
      peak: 0.2,
      decay: 0.35,
      type: 'bandpass',
      from: 1200,
      to: 2600,
      q: 2,
      attack: 0.05,
    });
  },
  moduleSelected: (ctx, out, t0) => {
    tone(ctx, out, t0, { type: 'square', from: 440, to: 440, peak: 0.26, decay: 0.1 });
    tone(ctx, out, t0 + 0.1, { type: 'square', from: 660, to: 660, peak: 0.26, decay: 0.1 });
    tone(ctx, out, t0 + 0.2, { type: 'square', from: 880, to: 880, peak: 0.3, decay: 0.26 });
  },
  moduleCharge: (ctx, out, t0) => {
    tone(ctx, out, t0, { type: 'triangle', from: 1400, to: 1100, peak: 0.2, decay: 0.06 });
  },
  // Descendente: perdi alguma coisa. A direcao do intervalo faz o trabalho.
  moduleExpired: (ctx, out, t0) => {
    tone(ctx, out, t0, { type: 'square', from: 700, to: 700, peak: 0.24, decay: 0.09 });
    tone(ctx, out, t0 + 0.1, { type: 'square', from: 466, to: 466, peak: 0.26, decay: 0.24 });
  },
  // Sub grave longo com batida: a coisa mais alta do jogo, e a unica que soa
  // antes de ser vista.
  guardianAwake: (ctx, out, t0, noise) => {
    tone(ctx, out, t0, { type: 'sine', from: 55, to: 33, peak: 0.9, decay: 2.2, attack: 0.15 });
    tone(ctx, out, t0, { type: 'sawtooth', from: 82, to: 49, peak: 0.22, decay: 2, attack: 0.2 });
    burst(ctx, out, t0 + 0.3, noise, {
      peak: 0.3,
      decay: 1.4,
      type: 'lowpass',
      from: 400,
      to: 90,
      attack: 0.2,
    });
  },
  playerDown: (ctx, out, t0, noise) => {
    tone(ctx, out, t0, {
      type: 'sawtooth',
      from: 330,
      to: 60,
      peak: 0.6,
      decay: 0.9,
      attack: 0.02,
    });
    burst(ctx, out, t0, noise, { peak: 0.35, decay: 0.7, type: 'lowpass', from: 1200, to: 150 });
  },
  revive: (ctx, out, t0) => {
    tone(ctx, out, t0, { type: 'sine', from: 220, to: 660, peak: 0.5, decay: 0.7, attack: 0.05 });
    tone(ctx, out, t0 + 0.1, {
      type: 'triangle',
      from: 330,
      to: 990,
      peak: 0.3,
      decay: 0.6,
      attack: 0.05,
    });
  },
  extracted: (ctx, out, t0) => {
    for (const [i, f] of [392, 523, 659, 784, 1046].entries()) {
      tone(ctx, out, t0 + i * 0.11, {
        type: 'triangle',
        from: f,
        to: f,
        peak: 0.34,
        decay: 0.8,
        attack: 0.02,
      });
    }
  },
  // Morte: descida longa que nao resolve. Nao ha acorde final porque nao ha
  // conclusao — a run acabou, e so.
  died: (ctx, out, t0, noise) => {
    tone(ctx, out, t0, {
      type: 'sawtooth',
      from: 200,
      to: 28,
      peak: 0.55,
      decay: 1.8,
      attack: 0.05,
    });
    burst(ctx, out, t0, noise, {
      peak: 0.3,
      decay: 1.5,
      type: 'lowpass',
      from: 800,
      to: 80,
      attack: 0.1,
    });
  },
  uiTap: (ctx, out, t0) => {
    tone(ctx, out, t0, { type: 'square', from: 900, to: 900, peak: 0.22, decay: 0.045 });
  },
  // A estatica do deploy: ruido de banda subindo com a onda de hexagonos —
  // radio mal sintonizado que ganha sinal. A banda SOBE (900 → 3200 Hz)
  // porque a colmeia fecha "para cima" da tela do operador; o crepitar agudo
  // curto no inicio e a faisca do circuito armando. Dura ~0,85 s, o tempo de
  // uma varredura completa do véu.
  deployStatic: (ctx, out, t0, noise) => {
    burst(ctx, out, t0, noise, {
      peak: 0.42,
      decay: 0.85,
      type: 'bandpass',
      from: 900,
      to: 3200,
      q: 1.1,
      attack: 0.05,
    });
    burst(ctx, out, t0, noise, {
      peak: 0.2,
      decay: 0.18,
      type: 'highpass',
      from: 4200,
      attack: 0.005,
    });
  },

  // =========================================================================
  // OS CHEFES
  //
  // Regra de leitura das receitas abaixo: cada chefe e um MATERIAL, e cada
  // habilidade dele usa esse material para dizer preparacao, execucao e
  // consequencia. As faixas de frequencia obedecem a separacao timbral do
  // arquivo: os windups continuam TONAIS e ritmados (para nunca serem
  // mascarados pelo entulho), e as consequencias podem ser ruido — porque
  // consequencia e mundo.
  // =========================================================================

  // --- Guardiao de Pedra: massa, rocha, subgrave. Lento e tectonico. -------
  // O passo: impacto duplo — o peso no chao, e pedrinhas caindo depois.
  guardianStep: (ctx, out, t0, noise) => {
    tone(ctx, out, t0, { type: 'sine', from: 70, to: 38, peak: 0.6, decay: 0.16, attack: 0.006 });
    burst(ctx, out, t0 + 0.09, noise, {
      peak: 0.16,
      decay: 0.14,
      type: 'bandpass',
      from: 900,
      to: 400,
      q: 1.2,
      attack: 0.02,
    });
  },
  // Compressao de rocha: placas apertando. Sobe devagar no subgrave, com um
  // rangido estreito por cima — e o "algo pesado esta sendo armado".
  guardianCompress: (ctx, out, t0, noise) => {
    sustain(ctx, out, t0, {
      type: 'sawtooth',
      from: 48,
      to: 96,
      peak: 0.45,
      attack: 0.2,
      hold: 0.12,
      release: 0.12,
    });
    burst(ctx, out, t0 + 0.05, noise, {
      peak: 0.22,
      decay: 0.3,
      type: 'bandpass',
      from: 300,
      to: 700,
      q: 6,
      attack: 0.1,
    });
  },
  // Estalo seco antes da salva: a rocha lascando ao ser erguida. Curto e
  // medio-agudo, para nao depender so da marca visual da area de impacto.
  guardianSalvoCrack: (ctx, out, t0, noise) => {
    burst(ctx, out, t0, noise, { peak: 0.5, decay: 0.05, type: 'bandpass', from: 1800, q: 2 });
    tone(ctx, out, t0 + 0.06, { type: 'triangle', from: 220, to: 130, peak: 0.3, decay: 0.12 });
    burst(ctx, out, t0 + 0.14, noise, {
      peak: 0.36,
      decay: 0.05,
      type: 'bandpass',
      from: 1500,
      q: 2,
    });
  },
  // O golpe: subgrave curto, SEM cauda musical. Massa encontrando chao.
  guardianSlam: (ctx, out, t0, noise) => {
    tone(ctx, out, t0, { type: 'sine', from: 60, to: 30, peak: 0.9, decay: 0.2, attack: 0.004 });
    burst(ctx, out, t0, noise, { peak: 0.45, decay: 0.1, type: 'lowpass', from: 500, to: 120 });
  },
  // Dano recebido: lascas, nao gemido.
  guardianChip: (ctx, out, t0, noise) => {
    burst(ctx, out, t0, noise, {
      peak: 0.3,
      decay: 0.05,
      type: 'bandpass',
      from: 2200,
      to: 900,
      q: 1.6,
    });
    tone(ctx, out, t0, { type: 'triangle', from: 900, to: 500, peak: 0.12, decay: 0.04 });
  },
  // Fase final: rangido estrutural, sugerindo que o corpo esta cedendo.
  guardianStrain: (ctx, out, t0, noise) => {
    burst(ctx, out, t0, noise, {
      peak: 0.28,
      decay: 0.7,
      type: 'bandpass',
      from: 180,
      to: 420,
      q: 9,
      attack: 0.15,
    });
    tone(ctx, out, t0 + 0.1, {
      type: 'sawtooth',
      from: 44,
      to: 58,
      peak: 0.16,
      decay: 0.6,
      attack: 0.15,
    });
  },

  // --- Bispo: a subida da cura, agora na preparacao da Supernova. ---------
  // Materia organica inchando: a mesma glissando ascendente do `bishopHeal`,
  // mais longa e com um sopro fungico por baixo. Ele nao "carrega" — cresce.
  bishopNovaCharge: (ctx, out, t0, noise) => {
    sustain(ctx, out, t0, {
      type: 'sine',
      from: 220,
      to: 660,
      peak: 0.34,
      attack: 0.5,
      hold: 0.1,
      release: 0.2,
    });
    sustain(ctx, out, t0 + 0.05, {
      type: 'triangle',
      from: 330,
      to: 990,
      peak: 0.14,
      attack: 0.5,
      hold: 0.05,
      release: 0.2,
      detune: 9,
    });
    burst(ctx, out, t0, noise, {
      peak: 0.14,
      decay: 0.6,
      type: 'bandpass',
      from: 250,
      to: 900,
      q: 1.4,
      attack: 0.3,
    });
  },

  // --- Diamandis: maquina industrial + voz corporativa. --------------------
  // Boot: subsistemas ligando um a um — rele, motor pegando, scanner
  // acendendo. Nao e um rugido; e uma maquina retomando uma ordem de servico.
  diamandisBoot: (ctx, out, t0, noise) => {
    burst(ctx, out, t0, noise, { peak: 0.4, decay: 0.04, type: 'bandpass', from: 2400, q: 3 });
    sustain(ctx, out, t0 + 0.08, {
      type: 'sawtooth',
      from: 40,
      to: 110,
      peak: 0.4,
      attack: 0.9,
      hold: 0.4,
      release: 0.5,
    });
    sustain(ctx, out, t0 + 0.08, {
      type: 'square',
      from: 60,
      to: 165,
      peak: 0.1,
      attack: 0.9,
      hold: 0.4,
      release: 0.5,
      detune: 14,
    });
    tone(ctx, out, t0 + 0.9, {
      type: 'sine',
      from: 1400,
      to: 2600,
      peak: 0.18,
      decay: 0.3,
      attack: 0.05,
    });
    tone(ctx, out, t0 + 1.25, { type: 'square', from: 880, to: 880, peak: 0.16, decay: 0.08 });
  },
  // "Á-RE-A NÃO MA-PE-A-DA."
  diamandisVoiceUnmapped: (ctx, out, t0, noise) =>
    speak(ctx, out, t0, noise, [
      [230, 0.09],
      [210, 0.08],
      [200, 0.08],
      [240, 0.11],
      [215, 0.08],
      [200, 0.08],
      [190, 0.08],
      [175, 0.12],
    ]),
  // "SON-DA-GEM."
  diamandisVoiceSurvey: (ctx, out, t0, noise) =>
    speak(ctx, out, t0, noise, [
      [220, 0.11],
      [205, 0.09],
      [180, 0.14],
    ]),
  // "CAR-GA AR-MA-DA."
  diamandisVoiceArmed: (ctx, out, t0, noise) =>
    speak(ctx, out, t0, noise, [
      [240, 0.1],
      [215, 0.09],
      [235, 0.09],
      [210, 0.09],
      [180, 0.13],
    ]),
  // "A-FAS-TE-SE."
  diamandisVoiceStandClear: (ctx, out, t0, noise) =>
    speak(ctx, out, t0, noise, [
      [250, 0.08],
      [235, 0.11],
      [215, 0.09],
      [185, 0.12],
    ]),
  // "FA-LHA O-PE-RA-CI-O-NAL." Mais grave e mais lenta: o sistema que fala
  // e o mesmo que esta falhando.
  diamandisVoiceFault: (ctx, out, t0, noise) =>
    speak(
      ctx,
      out,
      t0,
      noise,
      [
        [200, 0.12],
        [180, 0.12],
        [190, 0.1],
        [175, 0.1],
        [185, 0.1],
        [170, 0.1],
        [160, 0.1],
        [140, 0.18],
      ],
      0.34,
    ),
  // "U-NI-DA-DE NÃO RE-CU-PE-RÁ-VEL."
  diamandisVoiceLost: (ctx, out, t0, noise) =>
    speak(ctx, out, t0, noise, [
      [225, 0.08],
      [215, 0.08],
      [230, 0.08],
      [205, 0.1],
      [240, 0.11],
      [210, 0.08],
      [200, 0.08],
      [215, 0.08],
      [195, 0.1],
      [170, 0.14],
    ]),
  // "OBS-TRU-CAO." Tres batidas secas, a segunda mais alta: a maquina
  // registrando parede — e continuando.
  diamandisVoiceObstruction: (ctx, out, t0, noise) =>
    speak(
      ctx,
      out,
      t0,
      noise,
      [
        [225, 0.1],
        [255, 0.11],
        [185, 0.15],
      ],
      0.33,
    ),
  // A broca: motor ganhando rotacao durante o windup inteiro (1,8 s).
  // Dente de serra subindo com a quinta desafinada por cima — a mesma
  // gramatica do motor da minigun, porque e a mesma familia de maquina.
  diamandisDrillSpin: (ctx, out, t0, noise) => {
    sustain(ctx, out, t0, {
      type: 'sawtooth',
      from: 55,
      to: 210,
      peak: 0.4,
      attack: 1.4,
      hold: 0.3,
      release: 0.15,
    });
    sustain(ctx, out, t0, {
      type: 'square',
      from: 82,
      to: 315,
      peak: 0.1,
      attack: 1.4,
      hold: 0.3,
      release: 0.15,
      detune: 12,
    });
    burst(ctx, out, t0 + 0.3, noise, {
      peak: 0.18,
      decay: 1.5,
      type: 'bandpass',
      from: 400,
      to: 2400,
      q: 1.3,
      attack: 0.6,
    });
  },
  // Contato com o chao: subgrave e fragmentacao metalica.
  diamandisDrillImpact: (ctx, out, t0, noise) => {
    tone(ctx, out, t0, { type: 'sine', from: 90, to: 36, peak: 0.85, decay: 0.3, attack: 0.004 });
    burst(ctx, out, t0, noise, { peak: 0.5, decay: 0.22, type: 'lowpass', from: 2400, to: 300 });
    for (let i = 0; i < 4; i++) {
      tone(ctx, out, t0 + 0.04 + i * 0.05, {
        type: 'square',
        from: 1900 - i * 210,
        to: 1200,
        peak: 0.12,
        decay: 0.035,
      });
    }
  },
  // Tres bipes corporativos secos, ACELERANDO: as cargas armando.
  diamandisChargeArmed: (ctx, out, t0) => {
    tone(ctx, out, t0, { type: 'square', from: 1046, to: 1046, peak: 0.34, decay: 0.06 });
    tone(ctx, out, t0 + 0.2, { type: 'square', from: 1046, to: 1046, peak: 0.36, decay: 0.06 });
    tone(ctx, out, t0 + 0.34, { type: 'square', from: 1318, to: 1318, peak: 0.4, decay: 0.08 });
  },
  // A implosao: o som entra PARA DENTRO antes do impacto grave — ruido
  // subindo e sumindo, depois o baque.
  diamandisImplosion: (ctx, out, t0, noise) => {
    burst(ctx, out, t0, noise, {
      peak: 0.4,
      decay: 0.22,
      type: 'bandpass',
      from: 600,
      to: 3800,
      q: 2,
      attack: 0.03,
    });
    tone(ctx, out, t0, { type: 'sine', from: 320, to: 1100, peak: 0.2, decay: 0.2, attack: 0.03 });
    tone(ctx, out, t0 + 0.24, {
      type: 'sine',
      from: 120,
      to: 32,
      peak: 0.85,
      decay: 0.45,
      attack: 0.004,
    });
    burst(ctx, out, t0 + 0.24, noise, {
      peak: 0.5,
      decay: 0.3,
      type: 'lowpass',
      from: 1600,
      to: 160,
    });
  },
  // Scanner estreito percorrendo frequencias: a varredura medindo.
  diamandisBeamScan: (ctx, out, t0, noise) => {
    sustain(ctx, out, t0, {
      type: 'sine',
      from: 700,
      to: 2600,
      peak: 0.22,
      attack: 0.6,
      hold: 0.05,
      release: 0.1,
    });
    sustain(ctx, out, t0 + 0.75, {
      type: 'sine',
      from: 2600,
      to: 900,
      peak: 0.2,
      attack: 0.5,
      hold: 0.05,
      release: 0.1,
    });
    burst(ctx, out, t0, noise, {
      peak: 0.08,
      decay: 1.3,
      type: 'bandpass',
      from: 3000,
      q: 12,
      attack: 0.2,
    });
  },
  // Trava no jogador: tom FIXO, e a potencia entrando por baixo.
  diamandisBeamLocked: (ctx, out, t0, noise) => {
    sustain(ctx, out, t0, {
      type: 'square',
      from: 1760,
      peak: 0.26,
      attack: 0.01,
      hold: 0.32,
      release: 0.08,
    });
    burst(ctx, out, t0 + 0.05, noise, {
      peak: 0.3,
      decay: 0.4,
      type: 'highpass',
      from: 2400,
      to: 5000,
      attack: 0.08,
    });
    tone(ctx, out, t0, {
      type: 'sawtooth',
      from: 110,
      to: 220,
      peak: 0.16,
      decay: 0.4,
      attack: 0.05,
    });
  },
  // Falha operacional: o motor comeca a funcionar fora dos limites —
  // batimento entre duas serras que nao se acertam, e um rele estalando.
  diamandisReactorFail: (ctx, out, t0, noise) => {
    burst(ctx, out, t0, noise, { peak: 0.45, decay: 0.05, type: 'bandpass', from: 2600, q: 3 });
    sustain(ctx, out, t0 + 0.05, {
      type: 'sawtooth',
      from: 120,
      to: 95,
      peak: 0.4,
      attack: 0.15,
      hold: 1.2,
      release: 0.5,
    });
    sustain(ctx, out, t0 + 0.05, {
      type: 'sawtooth',
      from: 128,
      to: 108,
      peak: 0.3,
      attack: 0.15,
      hold: 1.2,
      release: 0.5,
      detune: 35,
    });
    burst(ctx, out, t0 + 0.3, noise, {
      peak: 0.2,
      decay: 1.4,
      type: 'bandpass',
      from: 900,
      to: 300,
      q: 2,
      attack: 0.4,
    });
  },
  // Desligamento por subsistemas: o scanner apaga, o motor perde rotacao,
  // o rele final desconecta. Nao ha rugido — ha uma ordem de servico
  // terminando decadas atrasada.
  diamandisShutdown: (ctx, out, t0, noise) => {
    tone(ctx, out, t0, { type: 'sine', from: 2400, to: 300, peak: 0.24, decay: 0.5, attack: 0.02 });
    sustain(ctx, out, t0 + 0.2, {
      type: 'sawtooth',
      from: 170,
      to: 22,
      peak: 0.45,
      attack: 0.05,
      hold: 1.6,
      release: 0.4,
    });
    sustain(ctx, out, t0 + 0.2, {
      type: 'square',
      from: 250,
      to: 30,
      peak: 0.1,
      attack: 0.05,
      hold: 1.6,
      release: 0.4,
      detune: 12,
    });
    burst(ctx, out, t0 + 2.1, noise, {
      peak: 0.45,
      decay: 0.06,
      type: 'bandpass',
      from: 2000,
      q: 3,
    });
    tone(ctx, out, t0 + 2.14, { type: 'square', from: 300, to: 60, peak: 0.2, decay: 0.12 });
  },

  // --- Devorador Branco: friccao subterranea, garganta, vacuo. --------------
  // Navegacao: atrito granular grave, com pequenos estalos vitreos por cima.
  // A posicao vem do evento — e o paneamento que faz disto informacao.
  devourerBurrow: (ctx, out, t0, noise) => {
    burst(ctx, out, t0, noise, {
      peak: 0.4,
      decay: 0.42,
      type: 'lowpass',
      from: 260,
      to: 180,
      attack: 0.08,
    });
    for (let i = 0; i < 3; i++) {
      tone(ctx, out, t0 + 0.06 + i * 0.11, {
        type: 'triangle',
        from: 2600 + i * 300,
        to: 1800,
        peak: 0.08,
        decay: 0.025,
      });
    }
  },
  // Emergencia: a silica chia em frequencia CRESCENTE — e o "de onde ele
  // vai sair" que a marca no chao promete.
  devourerEmergeWarning: (ctx, out, t0, noise) => {
    burst(ctx, out, t0, noise, {
      peak: 0.42,
      decay: 1.0,
      type: 'bandpass',
      from: 500,
      to: 4200,
      q: 2.4,
      attack: 0.3,
    });
    sustain(ctx, out, t0, {
      type: 'sawtooth',
      from: 60,
      to: 140,
      peak: 0.2,
      attack: 0.8,
      hold: 0.1,
      release: 0.1,
    });
  },
  // A ruptura seca e grave quando a boca aparece.
  devourerEmerge: (ctx, out, t0, noise) => {
    burst(ctx, out, t0, noise, {
      peak: 0.6,
      decay: 0.12,
      type: 'bandpass',
      from: 1200,
      to: 300,
      q: 0.8,
    });
    tone(ctx, out, t0, { type: 'sine', from: 110, to: 34, peak: 0.85, decay: 0.32, attack: 0.004 });
    burst(ctx, out, t0 + 0.1, noise, {
      peak: 0.25,
      decay: 0.4,
      type: 'lowpass',
      from: 900,
      to: 200,
      attack: 0.04,
    });
  },
  // Placas calcificadas raspando umas nas outras, e uma inspiracao
  // cavernosa: a boca abrindo. O vortice continua no leito, nao aqui.
  devourerMawOpen: (ctx, out, t0, noise) => {
    burst(ctx, out, t0, noise, {
      peak: 0.4,
      decay: 0.5,
      type: 'bandpass',
      from: 700,
      to: 250,
      q: 5,
      attack: 0.05,
    });
    tone(ctx, out, t0 + 0.05, {
      type: 'sawtooth',
      from: 90,
      to: 45,
      peak: 0.24,
      decay: 0.5,
      attack: 0.05,
    });
    burst(ctx, out, t0 + 0.45, noise, {
      peak: 0.35,
      decay: 0.9,
      type: 'lowpass',
      from: 300,
      to: 1200,
      attack: 0.5,
    });
  },
  // Impacto umido-mineral curto, seguido de SILENCIO — o leito do vortice
  // e quem cala; esta voz e so a mordida do fechamento.
  devourerMawClose: (ctx, out, t0, noise) => {
    burst(ctx, out, t0, noise, { peak: 0.55, decay: 0.08, type: 'lowpass', from: 1400, to: 200 });
    tone(ctx, out, t0, { type: 'sine', from: 140, to: 40, peak: 0.6, decay: 0.14, attack: 0.004 });
    burst(ctx, out, t0 + 0.02, noise, {
      peak: 0.2,
      decay: 0.06,
      type: 'bandpass',
      from: 2800,
      q: 2,
    });
  },
  // Presa e vulneravel: respiracao irregular e seca — a criatura fora do
  // elemento dela. Entra DEPOIS da boca abrir, para nao disputar com ela.
  devourerVulnerable: (ctx, out, t0, noise) => {
    for (const [i, gap] of [0.6, 0.95, 1.2, 1.6].entries()) {
      burst(ctx, out, t0 + gap, noise, {
        peak: 0.24 - i * 0.02,
        decay: 0.14 + (i % 2) * 0.08,
        type: 'bandpass',
        from: 420 + i * 60,
        to: 260,
        q: 1.2,
        attack: 0.04,
      });
    }
  },
  // Ninhada engolida: estalos agudos desaparecendo dentro do grave.
  devourerBroodSwallowed: (ctx, out, t0, noise) => {
    tone(ctx, out, t0, { type: 'triangle', from: 2400, to: 300, peak: 0.22, decay: 0.12 });
    burst(ctx, out, t0 + 0.04, noise, {
      peak: 0.12,
      decay: 0.1,
      type: 'lowpass',
      from: 600,
      to: 120,
    });
  },

  // --- Arquicantor: cristal afinado, acordes e ressonancia. -----------------
  // Idle: uma nota isolada, ocasional.
  archcantorNote: (ctx, out, t0) => crystalNote(ctx, out, t0, ARCHCANTOR_MOTIF[0], 0.3, 0.7),
  // Preparacao: primeira e segunda notas. A frase fica no ar.
  archcantorPhrase: (ctx, out, t0) => {
    crystalNote(ctx, out, t0, ARCHCANTOR_MOTIF[0], 0.34, 0.6);
    crystalNote(ctx, out, t0 + 0.32, ARCHCANTOR_MOTIF[1], 0.36, 0.7);
  },
  // Ataque: a terceira nota completa a frase — e o acorde inteiro ressoa.
  archcantorChord: (ctx, out, t0) => {
    crystalNote(ctx, out, t0, ARCHCANTOR_MOTIF[2], 0.4, 1.1);
    crystalNote(ctx, out, t0 + 0.04, ARCHCANTOR_MOTIF[0], 0.22, 1.0);
    crystalNote(ctx, out, t0 + 0.08, ARCHCANTOR_MOTIF[1], 0.22, 1.0);
  },
  // Ataque perigoso: a terceira nota e um TRITONO. A frase nao resolve, e a
  // dissonancia fica batendo ate o jogador cortar a cadeia.
  archcantorTritone: (ctx, out, t0) => {
    crystalNote(ctx, out, t0, ARCHCANTOR_TRITONE, 0.42, 1.3);
    crystalNote(ctx, out, t0 + 0.04, ARCHCANTOR_MOTIF[0], 0.24, 1.2);
    tone(ctx, out, t0 + 0.06, {
      type: 'triangle',
      from: ARCHCANTOR_TRITONE,
      to: ARCHCANTOR_TRITONE,
      peak: 0.16,
      decay: 1.2,
      attack: 0.02,
      detune: 22,
    });
  },
  // Cada cristal da arena assume uma nota do acorde: a quinta, brilhante,
  // com a cauda de um cristal que continua vibrando.
  archcantorResonance: (ctx, out, t0) => {
    crystalNote(ctx, out, t0, ARCHCANTOR_MOTIF[2] * 2, 0.26, 0.5);
    tone(ctx, out, t0 + 0.02, {
      type: 'sine',
      from: ARCHCANTOR_MOTIF[1] * 2,
      to: ARCHCANTOR_MOTIF[1] * 2,
      peak: 0.1,
      decay: 0.45,
      attack: 0.03,
    });
  },
  // Silenciamento: TODO o reverb tonal e cortado, e o que sobra e um ruido
  // mineral seco. Um estalo de corte, e nada afinado depois dele.
  archcantorSilenced: (ctx, out, t0, noise) => {
    tone(ctx, out, t0, {
      type: 'triangle',
      from: ARCHCANTOR_MOTIF[2],
      to: ARCHCANTOR_MOTIF[2],
      peak: 0.3,
      decay: 0.05,
    });
    burst(ctx, out, t0 + 0.05, noise, { peak: 0.45, decay: 0.06, type: 'highpass', from: 3000 });
    burst(ctx, out, t0 + 0.12, noise, {
      peak: 0.3,
      decay: 0.5,
      type: 'bandpass',
      from: 700,
      to: 250,
      q: 0.7,
      attack: 0.02,
    });
  },
  // Morte: o acorde comeca completo e perde as notas uma a uma.
  archcantorDeath: (ctx, out, t0, noise) => {
    crystalNote(ctx, out, t0, ARCHCANTOR_MOTIF[2], 0.36, 0.5);
    crystalNote(ctx, out, t0, ARCHCANTOR_MOTIF[1], 0.36, 1.1);
    crystalNote(ctx, out, t0, ARCHCANTOR_MOTIF[0], 0.4, 1.9);
    burst(ctx, out, t0 + 0.5, noise, { peak: 0.2, decay: 0.15, type: 'highpass', from: 2800 });
    burst(ctx, out, t0 + 1.1, noise, { peak: 0.24, decay: 0.15, type: 'highpass', from: 2400 });
    burst(ctx, out, t0 + 1.9, noise, {
      peak: 0.32,
      decay: 0.5,
      type: 'lowpass',
      from: 1200,
      to: 150,
    });
  },

  // --- Leviata do Lencol: baleia abissal, agua, eletricidade abafada. -------
  // Presenca: chamado longo, muito grave, parcialmente abafado.
  leviathanCall: (ctx, out, t0) => {
    sustain(ctx, out, t0, {
      type: 'sine',
      from: 62,
      to: 78,
      peak: 0.5,
      attack: 0.35,
      hold: 0.5,
      release: 0.5,
    });
    sustain(ctx, out, t0 + 0.05, {
      type: 'triangle',
      from: 124,
      to: 152,
      peak: 0.12,
      attack: 0.35,
      hold: 0.45,
      release: 0.45,
      detune: 7,
    });
  },
  // A rompida da lamina: agua fazendo pressao para cima, e um estalo.
  leviathanBreach: (ctx, out, t0, noise) => {
    burst(ctx, out, t0, noise, {
      peak: 0.36,
      decay: 0.9,
      type: 'lowpass',
      from: 200,
      to: 1400,
      attack: 0.4,
    });
    sustain(ctx, out, t0, {
      type: 'sine',
      from: 70,
      to: 130,
      peak: 0.3,
      attack: 0.7,
      hold: 0.1,
      release: 0.1,
    });
    burst(ctx, out, t0 + 0.9, noise, {
      peak: 0.3,
      decay: 0.08,
      type: 'bandpass',
      from: 1600,
      q: 2,
    });
  },
  // Inicio do Diluvio: um chamado ASCENDENTE e distante; depois o
  // deslocamento de agua e a pressao estrutural. A subida e CONTINUA —
  // um so movimento de grave para medio, nunca uma serie de respingos.
  leviathanDelugeRise: (ctx, out, t0, noise) => {
    sustain(ctx, out, t0, {
      type: 'sine',
      from: 55,
      to: 165,
      peak: 0.45,
      attack: 1.2,
      hold: 0.4,
      release: 0.6,
    });
    burst(ctx, out, t0 + 0.6, noise, {
      peak: 0.34,
      decay: 2.2,
      type: 'lowpass',
      from: 180,
      to: 900,
      attack: 1.0,
    });
    burst(ctx, out, t0 + 1.4, noise, {
      peak: 0.2,
      decay: 1.2,
      type: 'bandpass',
      from: 120,
      to: 260,
      q: 8,
      attack: 0.5,
    });
  },
  // Preparacao da descarga: o canto PARA, e sobe um gemido sustentado com
  // harmonicos eletricos se acumulando por cima. 3,6 s de windup; o som
  // ocupa quase tudo, porque o que anuncia perigo aqui e a tensao crescendo.
  leviathanShockCharge: (ctx, out, t0, noise) => {
    sustain(ctx, out, t0, {
      type: 'sine',
      from: 58,
      to: 92,
      peak: 0.42,
      attack: 0.8,
      hold: 2.2,
      release: 0.3,
    });
    sustain(ctx, out, t0 + 0.6, {
      type: 'sawtooth',
      from: 700,
      to: 2400,
      peak: 0.14,
      attack: 2.2,
      hold: 0.3,
      release: 0.2,
      detune: 18,
    });
    burst(ctx, out, t0 + 1.0, noise, {
      peak: 0.22,
      decay: 2.4,
      type: 'highpass',
      from: 1800,
      to: 5000,
      attack: 1.6,
    });
  },
  // Descarga massiva: um estalo agudo curtissimo, depois um golpe grave e
  // abafado atravessando a agua.
  leviathanShockRelease: (ctx, out, t0, noise) => {
    burst(ctx, out, t0, noise, { peak: 0.7, decay: 0.035, type: 'highpass', from: 5000 });
    tone(ctx, out, t0, { type: 'sawtooth', from: 3200, to: 900, peak: 0.3, decay: 0.05 });
    tone(ctx, out, t0 + 0.06, {
      type: 'sine',
      from: 90,
      to: 28,
      peak: 0.9,
      decay: 0.7,
      attack: 0.01,
    });
    burst(ctx, out, t0 + 0.06, noise, {
      peak: 0.45,
      decay: 0.6,
      type: 'lowpass',
      from: 700,
      to: 120,
    });
  },
  // Bolha protetora: pulso oco, suave e regular — o proprio coracao ouvido
  // de dentro de uma bolha. Um pulso por voz; o ritmo e a trava (500 ms).
  leviathanBubbleSafe: (ctx, out, t0) => {
    tone(ctx, out, t0, { type: 'sine', from: 160, to: 120, peak: 0.34, decay: 0.16, attack: 0.02 });
    tone(ctx, out, t0 + 0.13, {
      type: 'sine',
      from: 140,
      to: 100,
      peak: 0.22,
      decay: 0.14,
      attack: 0.02,
    });
  },
  // Recuperacao: bolhas escapando e um chamado quebrado, descendente.
  leviathanShockRecover: (ctx, out, t0, noise) => {
    for (let i = 0; i < 5; i++) {
      tone(ctx, out, t0 + i * 0.09, {
        type: 'sine',
        from: 500 + i * 140,
        to: 900 + i * 140,
        peak: 0.12,
        decay: 0.06,
        attack: 0.01,
      });
    }
    sustain(ctx, out, t0 + 0.4, {
      type: 'sine',
      from: 96,
      to: 52,
      peak: 0.36,
      attack: 0.15,
      hold: 0.3,
      release: 0.5,
    });
    burst(ctx, out, t0 + 0.4, noise, {
      peak: 0.14,
      decay: 0.8,
      type: 'bandpass',
      from: 400,
      to: 200,
      q: 1.6,
      attack: 0.2,
    });
  },

  // --- Pulmao-Matriz: inspiracao, pressao, membrana, gas. -------------------
  // Pulmao cheio: a succao (leito) para, e fica uma pressao presa — um tom
  // grave subindo meio-tom e travando. E o meio segundo de medo.
  lungHold: (ctx, out, t0, noise) => {
    sustain(ctx, out, t0, {
      type: 'sine',
      from: 84,
      to: 96,
      peak: 0.42,
      attack: 0.12,
      hold: 0.4,
      release: 0.08,
    });
    burst(ctx, out, t0, noise, {
      peak: 0.12,
      decay: 0.5,
      type: 'bandpass',
      from: 900,
      q: 14,
      attack: 0.1,
    });
  },
  // Expiracao: abertura ABRUPTA da membrana e um jato largo de gas. O
  // transiente inicial e o ruido se espalhando para fora — o oposto exato da
  // inspiracao, que sobe para dentro.
  lungExhale: (ctx, out, t0, noise) => {
    burst(ctx, out, t0, noise, { peak: 0.55, decay: 0.06, type: 'bandpass', from: 1200, q: 1.2 });
    burst(ctx, out, t0 + 0.03, noise, {
      peak: 0.5,
      decay: 0.9,
      type: 'lowpass',
      from: 2600,
      to: 500,
      attack: 0.02,
    });
    tone(ctx, out, t0, {
      type: 'sawtooth',
      from: 180,
      to: 70,
      peak: 0.16,
      decay: 0.5,
      attack: 0.01,
    });
  },
  // Fechamento: valvula organica pesada, quase cardiaca.
  lungClose: (ctx, out, t0, noise) => {
    tone(ctx, out, t0, { type: 'sine', from: 110, to: 48, peak: 0.6, decay: 0.2, attack: 0.02 });
    burst(ctx, out, t0 + 0.02, noise, {
      peak: 0.22,
      decay: 0.2,
      type: 'lowpass',
      from: 600,
      to: 150,
      attack: 0.02,
    });
    tone(ctx, out, t0 + 0.22, {
      type: 'sine',
      from: 90,
      to: 44,
      peak: 0.36,
      decay: 0.16,
      attack: 0.02,
    });
  },
  // Gas inflamado: "whoomph" grave seguido de crepitacao — nunca a explosao
  // comum, porque isto e a alavanca do encontro e nao um estouro qualquer.
  lungIgnite: (ctx, out, t0, noise) => {
    burst(ctx, out, t0, noise, {
      peak: 0.6,
      decay: 0.4,
      type: 'lowpass',
      from: 400,
      to: 1800,
      attack: 0.06,
    });
    tone(ctx, out, t0, { type: 'sine', from: 70, to: 40, peak: 0.5, decay: 0.4, attack: 0.05 });
    for (let i = 0; i < 6; i++) {
      burst(ctx, out, t0 + 0.3 + i * 0.07, noise, {
        peak: 0.16,
        decay: 0.04,
        type: 'bandpass',
        from: 2000 + (i % 3) * 500,
        q: 3,
      });
    }
  },
  // Ferido: chiado de vazamento, como um fole perfurado.
  lungWound: (ctx, out, t0, noise) => {
    burst(ctx, out, t0, noise, {
      peak: 0.3,
      decay: 0.35,
      type: 'bandpass',
      from: 2600,
      to: 1600,
      q: 3,
      attack: 0.02,
    });
  },

  // --- Coracao da Fornalha: pulsacao, pressao e combustao. ------------------
  // Setor marcado: um SOPRO direcional percorrendo o arco antes da chama. A
  // posicao do cue e o rumo da cunha — e o paneamento que diz de que lado.
  furnaceWedgeWarn: (ctx, out, t0, noise) => {
    burst(ctx, out, t0, noise, {
      peak: 0.36,
      decay: 1.4,
      type: 'bandpass',
      from: 300,
      to: 1400,
      q: 1.1,
      attack: 0.5,
    });
    sustain(ctx, out, t0 + 0.2, {
      type: 'sine',
      from: 140,
      to: 210,
      peak: 0.16,
      attack: 0.9,
      hold: 0.2,
      release: 0.2,
    });
  },
  // Onda de fogo: combustao larga. O movimento estereo vem da posicao.
  furnaceWave: (ctx, out, t0, noise) => {
    burst(ctx, out, t0, noise, {
      peak: 0.55,
      decay: 0.5,
      type: 'lowpass',
      from: 3000,
      to: 400,
      attack: 0.02,
    });
    tone(ctx, out, t0, { type: 'sine', from: 95, to: 45, peak: 0.5, decay: 0.4, attack: 0.02 });
    burst(ctx, out, t0 + 0.15, noise, {
      peak: 0.22,
      decay: 0.5,
      type: 'bandpass',
      from: 1200,
      to: 600,
      q: 0.9,
      attack: 0.05,
    });
  },
  // Resfriamento: queda ABRUPTA da pressao, vapor — e a janela abrindo.
  furnaceCooling: (ctx, out, t0, noise) => {
    tone(ctx, out, t0, {
      type: 'sawtooth',
      from: 160,
      to: 40,
      peak: 0.3,
      decay: 0.35,
      attack: 0.01,
    });
    burst(ctx, out, t0 + 0.08, noise, {
      peak: 0.4,
      decay: 1.4,
      type: 'highpass',
      from: 1800,
      to: 4500,
      attack: 0.1,
    });
    burst(ctx, out, t0 + 0.08, noise, {
      peak: 0.18,
      decay: 1.0,
      type: 'bandpass',
      from: 500,
      to: 250,
      q: 1.4,
      attack: 0.1,
    });
  },
  // Reaquecimento: a pressao voltando — e a blindagem fechando.
  furnaceReheat: (ctx, out, t0, noise) => {
    sustain(ctx, out, t0, {
      type: 'sawtooth',
      from: 40,
      to: 110,
      peak: 0.34,
      attack: 0.8,
      hold: 0.2,
      release: 0.3,
    });
    burst(ctx, out, t0 + 0.2, noise, {
      peak: 0.22,
      decay: 1.0,
      type: 'lowpass',
      from: 300,
      to: 1200,
      attack: 0.6,
    });
    burst(ctx, out, t0 + 0.9, noise, { peak: 0.3, decay: 0.08, type: 'bandpass', from: 700, q: 4 });
  },
  // Colapso a 45%: rachadura profunda ACIMA do jogador; depois pequenos
  // detritos, antes das estalactites.
  furnaceCrack: (ctx, out, t0, noise) => {
    burst(ctx, out, t0, noise, {
      peak: 0.7,
      decay: 0.16,
      type: 'bandpass',
      from: 900,
      to: 200,
      q: 0.9,
    });
    tone(ctx, out, t0, { type: 'sine', from: 70, to: 24, peak: 0.85, decay: 1.4, attack: 0.01 });
    tone(ctx, out, t0 + 0.05, {
      type: 'sawtooth',
      from: 120,
      to: 40,
      peak: 0.24,
      decay: 1.2,
      attack: 0.02,
    });
    for (let i = 0; i < 5; i++) {
      burst(ctx, out, t0 + 0.6 + i * 0.13, noise, {
        peak: 0.16,
        decay: 0.08,
        type: 'bandpass',
        from: 1400 - i * 120,
        q: 1.5,
      });
    }
  },
  // Instabilidade a 10%: o ritmo deixa de ser regular — dois batimentos
  // falhando, e metal rangendo por cima. O leito passa a falhar tambem.
  furnaceUnstable: (ctx, out, t0, noise) => {
    tone(ctx, out, t0, { type: 'sine', from: 60, to: 34, peak: 0.7, decay: 0.2, attack: 0.01 });
    tone(ctx, out, t0 + 0.55, {
      type: 'sine',
      from: 60,
      to: 34,
      peak: 0.5,
      decay: 0.2,
      attack: 0.01,
    });
    tone(ctx, out, t0 + 0.7, {
      type: 'sine',
      from: 60,
      to: 34,
      peak: 0.62,
      decay: 0.2,
      attack: 0.01,
    });
    burst(ctx, out, t0 + 0.2, noise, {
      peak: 0.3,
      decay: 1.2,
      type: 'bandpass',
      from: 200,
      to: 600,
      q: 9,
      attack: 0.3,
    });
  },
  // Detritos: o teto soltando pedrinhas onde a estalactite vai cair.
  furnaceDebris: (ctx, out, t0, noise) => {
    for (let i = 0; i < 4; i++) {
      burst(ctx, out, t0 + i * 0.09, noise, {
        peak: 0.2,
        decay: 0.06,
        type: 'bandpass',
        from: 1600 - i * 200,
        q: 1.8,
      });
    }
    tone(ctx, out, t0 + 0.2, {
      type: 'sawtooth',
      from: 220,
      to: 160,
      peak: 0.1,
      decay: 0.3,
      attack: 0.05,
    });
  },

  // --- Rainha da Geada: cristais finos, gelo tensionado, estilhacos. --------
  // Preparacao: pequenos "blings" surgem ao redor e CONVERGEM para uma nota
  // aguda so — aperiodicos e desafinados, nunca o motivo do Arquicantor.
  frostQueenFreezeCharge: (ctx, out, t0) => {
    const blings = [3100, 2700, 3600, 2900, 3300, 3900, 3500, 4100];
    for (const [i, hz] of blings.entries()) iceBling(ctx, out, t0 + i * 0.1, hz, 0.16 + i * 0.01);
    sustain(ctx, out, t0 + 0.7, {
      type: 'sine',
      from: 3800,
      to: 4400,
      peak: 0.3,
      attack: 0.3,
      hold: 0.2,
      release: 0.1,
    });
  },
  // Congelamento: expansao rapida de gelo — varias fissuras atravessando a
  // arena, agudas e curtas, sobre um subgrave de massa congelando.
  frostQueenFreeze: (ctx, out, t0, noise) => {
    tone(ctx, out, t0, { type: 'sine', from: 120, to: 40, peak: 0.5, decay: 0.4, attack: 0.01 });
    for (let i = 0; i < 7; i++) {
      burst(ctx, out, t0 + 0.03 + i * 0.06, noise, {
        peak: 0.3,
        decay: 0.05,
        type: 'highpass',
        from: 3000 + i * 300,
      });
    }
    burst(ctx, out, t0 + 0.1, noise, {
      peak: 0.22,
      decay: 0.5,
      type: 'bandpass',
      from: 4000,
      to: 1500,
      q: 1.4,
      attack: 0.02,
    });
  },
  // Espectros: som INVERTIDO de cristal quebrando — os fragmentos parecem se
  // reconstruir. Ataques lentos e cauda cortada, o contrario do `breakCrystal`.
  frostQueenWraithRise: (ctx, out, t0, noise) => {
    burst(ctx, out, t0, noise, {
      peak: 0.3,
      decay: 0.5,
      type: 'highpass',
      from: 2600,
      to: 5000,
      attack: 0.45,
    });
    sustain(ctx, out, t0, {
      type: 'triangle',
      from: 1500,
      to: 2400,
      peak: 0.28,
      attack: 0.5,
      hold: 0.02,
      release: 0.03,
    });
    sustain(ctx, out, t0 + 0.05, {
      type: 'triangle',
      from: 2100,
      to: 3300,
      peak: 0.16,
      attack: 0.5,
      hold: 0.02,
      release: 0.03,
      detune: -15,
    });
  },
  // Armadura ativa: tilintar discreto — o tiro foi absorvido.
  frostQueenArmorHit: (ctx, out, t0) => {
    iceBling(ctx, out, t0, 3400, 0.22);
    iceBling(ctx, out, t0 + 0.03, 4300, 0.14);
  },
  // Armadura quebrada: ruptura grande e SECA, imediatamente diferente do
  // `breakCrystal` — sem tom, so a massa de gelo cedendo.
  frostQueenArmorBreak: (ctx, out, t0, noise) => {
    burst(ctx, out, t0, noise, {
      peak: 0.7,
      decay: 0.09,
      type: 'bandpass',
      from: 1800,
      to: 500,
      q: 0.8,
    });
    tone(ctx, out, t0, { type: 'sine', from: 130, to: 45, peak: 0.55, decay: 0.3, attack: 0.004 });
    for (let i = 0; i < 5; i++) {
      burst(ctx, out, t0 + 0.08 + i * 0.05, noise, {
        peak: 0.2,
        decay: 0.04,
        type: 'highpass',
        from: 3500 + i * 400,
      });
    }
  },
  // Morte: primeiro SILENCIO; depois o corpo inteiro se desfaz em centenas
  // de fragmentos, do grave para o agudo.
  frostQueenShatter: (ctx, out, t0, noise) => {
    tone(ctx, out, t0 + 0.45, {
      type: 'sine',
      from: 90,
      to: 40,
      peak: 0.6,
      decay: 0.5,
      attack: 0.01,
    });
    for (let i = 0; i < 14; i++) {
      const at = t0 + 0.5 + i * 0.07;
      burst(ctx, out, at, noise, {
        peak: 0.22,
        decay: 0.05,
        type: 'bandpass',
        from: 900 + i * 320,
        q: 2,
      });
      iceBling(ctx, out, at + 0.02, 1400 + i * 260, 0.12);
    }
  },

  // --- Magnetarca: magnetismo, inversao e metal tensionado. -----------------
  // Atracao: tom DESCENDENTE que se aproxima do centro, com o batimento entre
  // duas serras ficando mais rapido — o campo puxando.
  magnetarchAttract: (ctx, out, t0) => {
    sustain(ctx, out, t0, {
      type: 'sawtooth',
      from: 320,
      to: 90,
      peak: 0.28,
      attack: 0.1,
      hold: 0.7,
      release: 0.3,
    });
    sustain(ctx, out, t0, {
      type: 'sawtooth',
      from: 323,
      to: 102,
      peak: 0.22,
      attack: 0.1,
      hold: 0.7,
      release: 0.3,
      detune: 20,
    });
  },
  // Repulsao: ataque agudo que se ABRE para fora, seguido de queda grave.
  // Intervalo inverso ao da atracao, para as duas soarem opostas.
  magnetarchRepel: (ctx, out, t0, noise) => {
    tone(ctx, out, t0, {
      type: 'square',
      from: 900,
      to: 2400,
      peak: 0.3,
      decay: 0.25,
      attack: 0.01,
    });
    burst(ctx, out, t0, noise, { peak: 0.24, decay: 0.3, type: 'highpass', from: 1500, to: 4000 });
    tone(ctx, out, t0 + 0.28, {
      type: 'sine',
      from: 180,
      to: 45,
      peak: 0.55,
      decay: 0.5,
      attack: 0.01,
    });
  },
  // Troca de polaridade: um "clack" metalico central — um rele gigantesco
  // invertendo. Sai junto da polaridade que entra.
  magnetarchFlip: (ctx, out, t0, noise) => {
    burst(ctx, out, t0, noise, { peak: 0.6, decay: 0.03, type: 'bandpass', from: 2200, q: 4 });
    tone(ctx, out, t0, { type: 'square', from: 700, to: 350, peak: 0.3, decay: 0.05 });
    tone(ctx, out, t0 + 0.05, { type: 'triangle', from: 1400, to: 1100, peak: 0.16, decay: 0.12 });
  },
  // Esmagamento proximo: metal sob tensao.
  magnetarchCrush: (ctx, out, t0, noise) => {
    burst(ctx, out, t0, noise, {
      peak: 0.4,
      decay: 0.3,
      type: 'bandpass',
      from: 240,
      to: 520,
      q: 10,
      attack: 0.03,
    });
    tone(ctx, out, t0, {
      type: 'sawtooth',
      from: 130,
      to: 180,
      peak: 0.28,
      decay: 0.28,
      attack: 0.02,
    });
    tone(ctx, out, t0 + 0.05, { type: 'sine', from: 80, to: 40, peak: 0.5, decay: 0.2 });
  },
  // Arco de retorno distante: descarga FINA e longa — nada do golpe aquatico
  // do Leviata; isto e um fio de corrente esticado ate estalar.
  magnetarchArc: (ctx, out, t0, noise) => {
    burst(ctx, out, t0, noise, {
      peak: 0.3,
      decay: 0.4,
      type: 'bandpass',
      from: 4200,
      to: 6000,
      q: 6,
      attack: 0.02,
    });
    tone(ctx, out, t0, {
      type: 'sawtooth',
      from: 3200,
      to: 1800,
      peak: 0.18,
      decay: 0.35,
      attack: 0.01,
    });
    burst(ctx, out, t0 + 0.3, noise, { peak: 0.24, decay: 0.05, type: 'highpass', from: 3000 });
  },
};

/** Buffer de ruido branco reaproveitado por todas as rajadas. */
export const createNoiseBuffer = (ctx: AudioContext): AudioBuffer => {
  const length = Math.floor(ctx.sampleRate * NOISE_SECONDS);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
};
