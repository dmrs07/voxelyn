// A AMARROTADA dos chefes: reducao de bits e de banda, sem assets.
//
// Feedback de playtest: "eu daria so uma amarrotada nos sons, tipo baixar a
// taxa de bit, pra ficar um pouco mais amedrontador". E a observacao esta
// certa por um motivo que da para nomear: as receitas de `synth.ts` sao
// LIMPAS — osciladores ideais, ruido branco filtrado — e limpeza soa como
// sintetizador, nao como uma coisa enorme ouvida atraves de pedra e agua.
// Uma gravacao ruim de um monstro assusta mais que uma gravacao boa, porque
// o ouvido preenche o que a degradacao esconde.
//
// O que a cadeia faz, em ordem:
//
//   1. SATURACAO leve (tanh com `drive`): as bordas dos transientes ganham
//      harmonicos, o subgrave ganha corpo audivel em fone barato.
//   2. QUANTIZACAO a `bits` niveis: o "baixar a taxa de bit" literal. Cada
//      amostra e arredondada para um dos 2^bits degraus, e o erro de
//      arredondamento vira um ruido granular que segue o sinal — o crepitar
//      digital que o playtest pediu.
//   3. PASSA-BAIXA em `cutoffHz`: o que uma taxa de amostragem baixa faz com
//      os agudos, sem reamostrar de verdade (nao ha reamostragem no grafo do
//      Web Audio sem AudioWorklet, e um worklet e uma segunda thread, um
//      modulo carregado por URL e um caminho de falha novo para ganhar o que
//      um filtro ja da).
//
// Os dois primeiros passos sao UMA curva num `WaveShaperNode`: a composicao
// e calculada uma vez, em tabela, e o no aplica por amostra. `oversample`
// fica em 'none' de proposito — o aliasing da quantizacao e parte do
// amarrotado, e suaviza-lo seria desfazer o pedido.
//
// So os CHEFES passam por aqui (vozes e leitos). O resto do banco continua
// limpo: um telegrafo de bruiser amarrotado seria um telegrafo mais dificil
// de ler, e a legibilidade do aviso e a promessa que este audio nao quebra. O
// chefe pode ser amedrontador porque o aviso dele continua sendo um windup
// de prioridade 10 com forma propria — o amarrotado e textura, nao ruido.

/** Profundidade de bits da quantizacao. Oito e o "8-bit" que o ouvido reconhece. */
export const BOSS_LOFI_BITS = 8;

/** Corte do passa-baixa, em Hz: o teto de uma taxa de amostragem de ~11 kHz. */
export const BOSS_LOFI_CUTOFF_HZ = 5400;

/** Ganho de entrada da saturacao. Acima de ~2 o subgrave vira serra. */
export const BOSS_LOFI_DRIVE = 1.6;

/** Tamanho da tabela da curva. Impar, para o zero cair exatamente num ponto. */
const CURVE_SIZE = 4097;

/**
 * A curva de transferencia: saturacao seguida de quantizacao, em tabela.
 *
 * Pura e exportada para ser testavel sem AudioContext: o que se protege e
 * que a tabela tem de fato 2^bits degraus, e simetrica e monotona — uma
 * curva com um degrau a mais ou um salto invertido soaria como distorcao
 * quebrada, e nenhum teste de timbre pegaria isso.
 */
export const crushCurve = (
  bits: number,
  drive: number,
  size: number = CURVE_SIZE,
): Float32Array<ArrayBuffer> => {
  // Quantizador MID-TREAD: 2^bits - 1 degraus, impar, com um degrau exatamente
  // no zero e os extremos exatamente em -1 e +1. Um numero par de degraus
  // (2^bits) nao tem degrau no zero, e o silencio viraria um deslocamento DC
  // que estala a cada nota que comeca.
  const levels = Math.pow(2, bits) - 1;
  const step = 2 / (levels - 1);
  const curve = new Float32Array(size);
  const norm = Math.tanh(drive);
  for (let i = 0; i < size; i++) {
    const x = (i / (size - 1)) * 2 - 1;
    // Saturacao normalizada para tanh(drive) = 1: a curva chega ao teto sem
    // passar dele, e o ganho unitario perto do zero e preservado.
    const saturated = Math.tanh(x * drive) / norm;
    curve[i] = Math.round(saturated / step) * step;
  }
  return curve;
};

/**
 * Cria a cadeia lo-fi e devolve o no de ENTRADA. Quem toca um chefe conecta
 * aqui em vez de no barramento de efeitos; a saida ja esta ligada a `out`.
 */
export const createBossLofi = (ctx: AudioContext, out: AudioNode): GainNode => {
  const input = ctx.createGain();
  input.gain.value = 1;
  const shaper = ctx.createWaveShaper();
  shaper.curve = crushCurve(BOSS_LOFI_BITS, BOSS_LOFI_DRIVE);
  shaper.oversample = 'none';
  const lowpass = ctx.createBiquadFilter();
  lowpass.type = 'lowpass';
  lowpass.frequency.value = BOSS_LOFI_CUTOFF_HZ;
  lowpass.Q.value = 0.8;
  input.connect(shaper).connect(lowpass).connect(out);
  return input;
};
