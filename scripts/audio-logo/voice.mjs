// Cadeia de voz: quatro camadas derivadas de UMA tomada de espeak-ng.
//
// A tomada crua e um sintetizador de formantes: espectro concentrado em 250 Hz
// (-3,1 dB da energia total) e praticamente vazio acima de 4 kHz (-30,8 dB).
// Medicao em `docs/audio/danitools/sound-logo-manifest.json` -> voice.sourceSpectrum.
//
// Dai as decisoes desta cadeia, todas contra o numero e nao contra o gosto:
//   - a "caixa" de 250 Hz e cortada, nao mascarada;
//   - o brilho e GERADO por uma camada transposta uma oitava acima (que leva o
//     conteudo de 2-4 kHz para 4-8 kHz), porque realcar 8 kHz num espectro vazio
//     so levantaria o ruido do sintetizador;
//   - o peso vem de uma camada uma oitava abaixo, passa-baixa em 600 Hz, para
//     somar peito sem reforcar a mesma regiao que ja estava sobrando.
import {
  applyEnv, biquad, buf, chorus, compress, envAD, fadeIn, normalize, peakOf,
  pitchShift, readWav, resampleTo, saturate, scale, SR, bitcrush,
} from './dsp.mjs';

/** Corta silencio nas pontas a `thresh` do pico, com folga. */
export function trimSilence(x, thresh = 0.02, padSec = 0.006, sr = SR) {
  const pk = peakOf(x);
  if (pk === 0) return { audio: x.slice(), start: 0, end: x.length };
  const t = pk * thresh;
  let s = 0; while (s < x.length && Math.abs(x[s]) < t) s++;
  let e = x.length - 1; while (e > s && Math.abs(x[e]) < t) e--;
  const pad = Math.round(padSec * sr);
  s = Math.max(0, s - pad);
  e = Math.min(x.length, e + pad * 3);
  return { audio: x.slice(s, e), start: s, end: e };
}

/**
 * Monta a voz processada a partir do arquivo de tomada.
 * Devolve { L, R, mono, lengthSec, layers } — `mono` alimenta o sidechain.
 */
export function buildVoice(takePath, opts = {}) {
  const {
    sub = 0.52,        // camada -12 st: peso
    air = 0.15,        // camada +12 st: brilho gerado
    pixel = 0.17,      // camada bitcrush: a textura de pixel da marca
    drive = 1.45,      // saturacao de cola
    width = 0.42,      // quanto do chorus entra no dry central
    sr = SR,
  } = opts;

  const wav = readWav(takePath);
  const raw = resampleTo(wav.channels[0], wav.sampleRate, sr);
  const { audio } = trimSilence(raw, 0.02, 0.006, sr);
  const core0 = normalize(audio, 0.92);
  const n = core0.length;

  // --- nucleo: corta a caixa, abre a presenca ---------------------------
  let core = biquad(core0, 'highpass', 105, 0.7, 0, sr);
  core = biquad(core, 'peaking', 280, 1.0, -4.0, sr);   // a caixa medida
  core = biquad(core, 'peaking', 720, 1.4, -2.0, sr);   // nasalidade do formante
  core = biquad(core, 'peaking', 2600, 1.1, 4.5, sr);   // inteligibilidade
  core = biquad(core, 'highshelf', 3800, 0.7, 5.0, sr); // consoante final de "TOOLS"

  // --- peso: uma oitava abaixo, so o peito ------------------------------
  let low = pitchShift(core0, -12, sr, 0.085);
  low = biquad(low, 'lowpass', 600, 0.8, 0, sr);
  low = biquad(low, 'highpass', 70, 0.7, 0, sr);

  // --- brilho: uma oitava acima, so o topo ------------------------------
  let hi = pitchShift(core0, 12, sr, 0.035);
  hi = biquad(hi, 'highpass', 2600, 0.7, 0, sr);
  hi = biquad(hi, 'lowpass', 11000, 0.7, 0, sr);

  // --- pixel: a marca e voxel, entao a voz carrega quantizacao ----------
  let px = bitcrush(core0, 8, 11025, sr);
  px = biquad(px, 'bandpass', 1500, 0.55, 0, sr);
  px = biquad(px, 'lowpass', 5200, 0.7, 0, sr);

  // --- soma + cola ------------------------------------------------------
  const sum = buf(n);
  for (let i = 0; i < n; i++) {
    sum[i] = core[i] + (low[i] ?? 0) * sub + (hi[i] ?? 0) * air + (px[i] ?? 0) * pixel;
  }

  let mono = saturate(scale(sum, 0.62), drive);
  mono = compress(mono, { threshDb: -20, ratio: 3.2, attack: 0.004, release: 0.09, makeupDb: 3.5, sr });
  // envelope de seguranca: entrada limpa, cauda sem corte abrupto
  mono = applyEnv(mono, envAD(n, 0.004, 6, sr, 0.25));
  fadeIn(mono, 0.004, sr);
  mono = normalize(mono, 0.95);

  // --- largura: chorus somado ao dry central ----------------------------
  const [cL, cR] = chorus(mono, { voices: 3, baseMs: 11, spreadMs: 9, rateHz: 0.42, depthMs: 1.8, sr });
  const L = buf(n), R = buf(n);
  for (let i = 0; i < n; i++) {
    L[i] = mono[i] * (1 - width * 0.5) + cL[i] * width;
    R[i] = mono[i] * (1 - width * 0.5) + cR[i] * width;
  }

  return {
    L, R, mono,
    lengthSec: n / sr,
    layers: { core: 1, sub, air, pixel },
  };
}
