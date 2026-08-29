// Medicao ITU-R BS.1770-4 / EBU R128 — a entrega e calibrada por numero, nao por ouvido.
import { biquadRaw, buf, gainToDb, resampleStep, SR } from './dsp.mjs';

// Filtros de ponderacao K, coeficientes normativos para 48 kHz (BS.1770-4, tabelas 1 e 2).
const K_SHELF = [1.53512485958697, -2.69169618940638, 1.19839281085285, -1.69065929318241, 0.73248077421585];
const K_HPF = [1.0, -2.0, 1.0, -1.99004745483398, 0.99007225036621];

function kWeight(x) {
  return biquadRaw(biquadRaw(x, K_SHELF), K_HPF);
}

/**
 * Serie de loudness por janela deslizante, em LUFS.
 *
 * A EBU R128 define DUAS janelas com nomes que nao sao intercambiaveis:
 * *momentary* (M) usa 400 ms e *short-term* (S) usa 3 s. Esta funcao gera
 * qualquer uma das duas; quem chama escolhe e nomeia o que pediu.
 */
function blockSeries(weighted, blockSec, hopSec, sr) {
  const blockLen = Math.round(blockSec * sr);
  const hop = Math.round(hopSec * sr);
  const n = weighted[0].length;
  const out = [];
  for (let s = 0; s + blockLen <= n; s += hop) {
    let sum = 0;
    for (const ch of weighted) {
      let acc = 0;
      for (let i = s; i < s + blockLen; i++) acc += ch[i] * ch[i];
      sum += acc / blockLen; // peso de canal 1.0 para L e R
    }
    out.push(-0.691 + 10 * Math.log10(Math.max(sum, 1e-20)));
  }
  return out;
}

/**
 * Loudness integrada com gating duplo (absoluto -70 LUFS, relativo -10 LU), mais
 * os maximos das duas janelas da R128.
 *
 * `momentaryMaxLufs` vem da janela de 400 ms e `shortTermMaxLufs` da de 3 s — sao
 * metricas diferentes e o campo diz qual e qual. Numa peca com menos de 3 s nao
 * cabe uma unica janela short-term, e ai o campo vem `null` em vez de um numero
 * inventado a partir de uma janela curta demais.
 *
 * O gating da integrada continua sobre os blocos de 400 ms, como manda a
 * BS.1770-4 — la a janela de 400 ms e a correta.
 */
export function measureLoudness(channels, sr = SR) {
  if (sr !== 48000) throw new Error('measureLoudness assume 48 kHz (coeficientes K normativos)');
  const weighted = channels.map(kWeight);
  const n = channels[0].length;

  const blocks = blockSeries(weighted, 0.4, 0.1, sr);          // momentary
  const shortTerm = blockSeries(weighted, 3.0, 0.1, sr);       // short-term
  const shortTermMax = shortTerm.length ? round1(Math.max(...shortTerm)) : null;
  const durationSec = round1(n / sr);

  const empty = {
    integratedLufs: -Infinity,
    momentaryMaxLufs: -Infinity,
    shortTermMaxLufs: shortTermMax,
    shortTermWindows: shortTerm.length,
    durationSec,
    blocks: blocks.length,
  };
  if (!blocks.length) return empty;

  const meanOf = (list) => {
    let acc = 0;
    for (const l of list) acc += 10 ** ((l + 0.691) / 10);
    return -0.691 + 10 * Math.log10(acc / list.length);
  };

  const absGated = blocks.filter((l) => l > -70);
  if (!absGated.length) return empty;
  const relThreshold = meanOf(absGated) - 10;
  const relGated = absGated.filter((l) => l > relThreshold);
  const integrated = relGated.length ? meanOf(relGated) : meanOf(absGated);

  return {
    integratedLufs: round1(integrated),
    momentaryMaxLufs: round1(Math.max(...blocks)),
    shortTermMaxLufs: shortTermMax,
    shortTermWindows: shortTerm.length,
    durationSec,
    gatingThresholdLufs: round1(relThreshold),
    blocks: blocks.length,
    gatedBlocks: relGated.length,
  };
}

/** Pico de amostra por canal, em dBFS. */
export function samplePeakDb(channels) {
  return channels.map((ch) => {
    let p = 0;
    for (let i = 0; i < ch.length; i++) { const a = Math.abs(ch[i]); if (a > p) p = a; }
    return round1(gainToDb(p));
  });
}

/**
 * Pico inter-amostra estimado por sobreamostragem 8x (interpolacao de Hermite).
 * Nao e o filtro normativo de 4x com FIR de 48 taps — por isso "estimado" no manifesto.
 */
export function truePeakDb(channels, factor = 8) {
  return channels.map((ch) => {
    const up = resampleStep(padEdges(ch), 1 / factor);
    let p = 0;
    for (let i = 0; i < up.length; i++) { const a = Math.abs(up[i]); if (a > p) p = a; }
    return round1(gainToDb(p));
  });
}

function padEdges(x, pad = 4) {
  const y = buf(x.length + pad * 2);
  y.set(x, pad);
  return y;
}

/** Correlacao de fase L/R em -1..1 (1 = mono, 0 = descorrelacionado, <0 = fora de fase). */
export function stereoCorrelation([L, R]) {
  let sll = 0, srr = 0, slr = 0;
  for (let i = 0; i < L.length; i++) { sll += L[i] * L[i]; srr += R[i] * R[i]; slr += L[i] * R[i]; }
  const d = Math.sqrt(sll * srr);
  return d > 0 ? Math.round((slr / d) * 100) / 100 : 1;
}

/** Distribuicao de energia por banda (dB relativo ao total) — prova do equilibrio tonal. */
export function bandEnergy(channels, sr = SR) {
  const bands = [
    ['sub', 20, 60], ['baixo', 60, 200], ['medio-grave', 200, 800],
    ['medio', 800, 2500], ['presenca', 2500, 6000], ['brilho', 6000, 16000],
  ];
  const mono = buf(channels[0].length);
  for (const ch of channels) for (let i = 0; i < ch.length; i++) mono[i] += ch[i] / channels.length;

  let total = 0;
  const raw = bands.map(([name, lo, hi]) => {
    let y = biquadRaw(mono, hpCoeffs(lo, sr));
    y = biquadRaw(y, lpCoeffs(hi, sr));
    let e = 0;
    for (let i = 0; i < y.length; i++) e += y[i] * y[i];
    total += e;
    return [name, e];
  });
  return Object.fromEntries(raw.map(([name, e]) => [name, `${round1(10 * Math.log10(Math.max(e / total, 1e-12)))} dB`]));
}

function hpCoeffs(f, sr) { return coeffs('highpass', f, sr); }
function lpCoeffs(f, sr) { return coeffs('lowpass', f, sr); }
function coeffs(type, f0, sr) {
  const Q = Math.SQRT1_2;
  const w0 = (2 * Math.PI * f0) / sr, cw = Math.cos(w0), sw = Math.sin(w0), al = sw / (2 * Q);
  let b0, b1, b2;
  if (type === 'lowpass') { b0 = (1 - cw) / 2; b1 = 1 - cw; b2 = b0; }
  else { b0 = (1 + cw) / 2; b1 = -(1 + cw); b2 = b0; }
  const a0 = 1 + al, a1 = -2 * cw, a2 = 1 - al;
  return [b0 / a0, b1 / a0, b2 / a0, a1 / a0, a2 / a0];
}

const round1 = (v) => Math.round(v * 10) / 10;

/**
 * Margem da voz sobre a musica, por banda, na janela da palavra.
 *
 * E a medida que decide se o logo funciona: um logo sonoro cuja marca nao se
 * entende nao e um logo sonoro. As bandas de 1 a 8 kHz sao as que carregam
 * inteligibilidade de fala; nelas a margem tem que ser positiva. Em banda larga
 * e no medio-grave a margem NEGATIVA e o esperado — ali o corpo do acorde e o
 * sub e que devem mandar, e a voz foi cortada de proposito nessa regiao.
 */
export function voiceMargin(stems, { voiceStart, voiceEnd, sr = SR } = {}) {
  const n = stems.voz[0].length;
  const mono = (st) => {
    const m = buf(n);
    for (let i = 0; i < n; i++) m[i] = (st[0][i] + st[1][i]) / 2;
    return m;
  };
  const voz = mono(stems.voz);
  const musica = buf(n);
  for (const [name, st] of Object.entries(stems)) {
    if (name === 'voz') continue;
    const m = mono(st);
    for (let i = 0; i < n; i++) musica[i] += m[i];
  }

  const s = Math.max(0, Math.round(voiceStart * sr));
  const e = Math.min(n, Math.round(voiceEnd * sr));
  const rmsDb = (x) => {
    let acc = 0;
    for (let i = s; i < e; i++) acc += x[i] * x[i];
    return gainToDb(Math.sqrt(acc / Math.max(1, e - s)));
  };
  const band = (x, lo, hi) => biquadRaw(biquadRaw(x, hpCoeffs(lo, sr)), lpCoeffs(hi, sr));

  const BANDS = [['bandaLarga', 20, 20000], ['200-800Hz', 200, 800], ['1-2kHz', 1000, 2000], ['2-4kHz', 2000, 4000], ['4-8kHz', 4000, 8000]];
  const out = {};
  for (const [name, lo, hi] of BANDS) {
    const v = rmsDb(band(voz, lo, hi));
    const m = rmsDb(band(musica, lo, hi));
    out[name] = { vozDb: round1(v), musicaDb: round1(m), margemDb: round1(v - m) };
  }
  return out;
}
