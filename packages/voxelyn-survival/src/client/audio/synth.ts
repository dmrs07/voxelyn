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
// O que ISTO NAO E: musica. Nao ha trilha. O jogo soa como um lugar, e
// silencio faz parte do lugar.

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
  // A unica morte HUMANA do jogo, e a voz mais CURTA do banco. Medido num
  // OfflineAudioContext, som audivel ate cair abaixo de -40 dB:
  //
  //   deathMiner     189 ms
  //   death          329 ms
  //   deathGuardian  1770 ms
  //
  // A brevidade e o desenho. Todo o resto do banco toca e desvanece — a criatura
  // cai, o som acompanha o corpo, a cauda cobre o instante seguinte. Aqui a
  // cauda e o problema: uma morte que ressoa e uma morte estilizada, e o
  // objetivo desta e o oposto. Ela para antes de o ouvido esperar e deixa
  // silencio onde havia som, e o silencio faz o trabalho que nenhuma cauda faria.
  //
  // Duas parciais proximas em vez de uma so: batimento leve, que e o que separa
  // voz de bipe. E nada abaixo de 280 Hz, porque grave e o registro dos chefes e
  // das explosoes — um corpo pequeno nao pode soar como um evento grande.
  deathMiner: (ctx, out, t0, noise) => {
    // Sopro curtissimo de entrada: o ar saindo, antes de qualquer altura.
    burst(ctx, out, t0, noise, { peak: 0.26, decay: 0.07, type: 'bandpass', from: 1100, to: 700, q: 1.4 });
    tone(ctx, out, t0 + 0.01, { type: 'triangle', from: 340, to: 280, peak: 0.34, decay: 0.14, attack: 0.006 });
    tone(ctx, out, t0 + 0.01, { type: 'triangle', from: 352, to: 286, peak: 0.2, decay: 0.13, attack: 0.006 });
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
    tone(ctx, out, t0, { type: 'sawtooth', from: 210, to: 430, peak: 0.4, decay: 0.34, attack: 0.01 });
    tone(ctx, out, t0 + 0.04, { type: 'square', from: 320, to: 250, peak: 0.16, decay: 0.28 });
    burst(ctx, out, t0, noise, { peak: 0.2, decay: 0.2, type: 'bandpass', from: 1400, to: 600, q: 1.2 });
  },
  // Fuga: sopro curto que DESCE e se afasta. Sem tom definido — quem foge nao
  // esta anunciando nada, so foi visto.
  minerFlee: (ctx, out, t0, noise) => {
    burst(ctx, out, t0, noise, { peak: 0.3, decay: 0.3, type: 'bandpass', from: 900, to: 260, q: 0.9 });
    tone(ctx, out, t0, { type: 'triangle', from: 300, to: 170, peak: 0.14, decay: 0.24 });
  },
  // Minerio na cota: clique curto e metalico, no registro alto onde nada mais
  // do jogo toca. E um recibo, nao um evento — tem de sumir sob o combate.
  oreGained: (ctx, out, t0) => {
    tone(ctx, out, t0, { type: 'square', from: 1180, to: 1560, peak: 0.14, decay: 0.09, attack: 0.002 });
  },
  bishopHeal: (ctx, out, t0) => {
    tone(ctx, out, t0, { type: 'sine', from: 320, to: 620, peak: 0.3, decay: 0.26, attack: 0.03 });
    tone(ctx, out, t0 + 0.02, { type: 'triangle', from: 480, to: 930, peak: 0.14, decay: 0.22, attack: 0.03 });
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
};

/** Buffer de ruido branco reaproveitado por todas as rajadas. */
export const createNoiseBuffer = (ctx: AudioContext): AudioBuffer => {
  const length = Math.floor(ctx.sampleRate * NOISE_SECONDS);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
};
