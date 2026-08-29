// Primitivas de DSP para o logo sonoro da DaniTools.
// Node puro, sem dependencias — mesma regra do resto do repositorio.
// Tudo opera em Float64Array mono, exceto onde o nome diz "stereo" (par [L, R]).

import { readFileSync, writeFileSync } from 'node:fs';

export const SR = 48000;

// ---------------------------------------------------------------- WAV ------

/** Le um WAV PCM (8/16/24/32 bits inteiros ou float32) e devolve canais Float64 em -1..1. */
export function readWav(path) {
  const buf = readFileSync(path);
  if (buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WAVE') {
    throw new Error(`${path}: nao e um RIFF/WAVE`);
  }
  let pos = 12;
  let fmt = null;
  let data = null;
  while (pos + 8 <= buf.length) {
    const id = buf.toString('ascii', pos, pos + 4);
    const size = buf.readUInt32LE(pos + 4);
    const body = pos + 8;
    if (id === 'fmt ') {
      fmt = {
        format: buf.readUInt16LE(body),
        channels: buf.readUInt16LE(body + 2),
        sampleRate: buf.readUInt32LE(body + 4),
        bits: buf.readUInt16LE(body + 14),
      };
    } else if (id === 'data') {
      data = buf.subarray(body, body + size);
    }
    pos = body + size + (size & 1);
  }
  if (!fmt || !data) throw new Error(`${path}: chunk fmt/data ausente`);

  const bytes = fmt.bits >> 3;
  const frames = Math.floor(data.length / (bytes * fmt.channels));
  const channels = Array.from({ length: fmt.channels }, () => new Float64Array(frames));

  for (let f = 0; f < frames; f++) {
    for (let c = 0; c < fmt.channels; c++) {
      const o = (f * fmt.channels + c) * bytes;
      let v;
      if (fmt.format === 3 && fmt.bits === 32) v = data.readFloatLE(o);
      else if (fmt.bits === 8) v = (data[o] - 128) / 128;
      else if (fmt.bits === 16) v = data.readInt16LE(o) / 32768;
      else if (fmt.bits === 24) v = ((data[o] | (data[o + 1] << 8) | (data[o + 2] << 24 >> 8)) << 8 >> 8) / 8388608;
      else if (fmt.bits === 32) v = data.readInt32LE(o) / 2147483648;
      else throw new Error(`${path}: ${fmt.bits} bits nao suportado`);
      channels[c][f] = v;
    }
  }
  return { channels, sampleRate: fmt.sampleRate };
}

/** Escreve WAV PCM inteiro (16 ou 24 bits) a partir de canais Float64. */
export function writeWav(path, channels, sampleRate = SR, bits = 24) {
  const nch = channels.length;
  const frames = channels[0].length;
  const bytes = bits >> 3;
  const dataSize = frames * nch * bytes;
  const buf = Buffer.alloc(44 + dataSize);

  buf.write('RIFF', 0, 'ascii');
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write('WAVE', 8, 'ascii');
  buf.write('fmt ', 12, 'ascii');
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(nch, 22);
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * nch * bytes, 28);
  buf.writeUInt16LE(nch * bytes, 32);
  buf.writeUInt16LE(bits, 34);
  buf.write('data', 36, 'ascii');
  buf.writeUInt32LE(dataSize, 40);

  const peak = bits === 24 ? 8388607 : 32767;
  let o = 44;
  for (let f = 0; f < frames; f++) {
    for (let c = 0; c < nch; c++) {
      let v = Math.round(clamp(channels[c][f], -1, 1) * peak);
      if (bits === 24) {
        buf.writeUInt8(v & 0xff, o);
        buf.writeUInt8((v >> 8) & 0xff, o + 1);
        buf.writeUInt8((v >> 16) & 0xff, o + 2);
      } else {
        buf.writeInt16LE(v, o);
      }
      o += bytes;
    }
  }
  writeFileSync(path, buf);
}

// -------------------------------------------------------------- basico -----

export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
export const dbToGain = (db) => 10 ** (db / 20);
export const gainToDb = (g) => 20 * Math.log10(Math.max(g, 1e-12));
/** Semitons acima de A4=440. */
export const note = (semitonesFromA4) => 440 * 2 ** (semitonesFromA4 / 12);

export function buf(n) { return new Float64Array(n); }

/** Soma `src` em `dst` a partir de `offset` (em samples), com ganho. */
export function mixInto(dst, src, offset, gain = 1) {
  const start = Math.max(0, Math.round(offset));
  const n = Math.min(src.length, dst.length - start);
  for (let i = 0; i < n; i++) dst[start + i] += src[i] * gain;
  return dst;
}

export function scale(x, g) {
  const y = buf(x.length);
  for (let i = 0; i < x.length; i++) y[i] = x[i] * g;
  return y;
}

export function peakOf(x) {
  let p = 0;
  for (let i = 0; i < x.length; i++) { const a = Math.abs(x[i]); if (a > p) p = a; }
  return p;
}

/** Normaliza para um pico alvo (linear). Mutacao nao, devolve copia. */
export function normalize(x, target = 1) {
  const p = peakOf(x);
  return p > 0 ? scale(x, target / p) : x.slice();
}

// ---------------------------------------------------------- envelopes ------

/** Envelope AD/AR exponencial. attack/decay em segundos, curve>0. */
export function envAD(n, attack, decay, sr = SR, curve = 2.5) {
  const e = buf(n);
  const a = Math.max(1, Math.round(attack * sr));
  for (let i = 0; i < n; i++) {
    if (i < a) e[i] = (i / a) ** 0.7;
    else e[i] = Math.exp(-curve * ((i - a) / sr) / Math.max(decay, 1e-6));
  }
  return e;
}

/** Envelope ADSR completo, tudo em segundos. */
export function envADSR(n, a, d, s, r, sr = SR) {
  const e = buf(n);
  const A = Math.round(a * sr), D = Math.round(d * sr), R = Math.round(r * sr);
  const relStart = Math.max(A + D, n - R);
  for (let i = 0; i < n; i++) {
    if (i < A) e[i] = i / Math.max(A, 1);
    else if (i < A + D) e[i] = 1 + (s - 1) * ((i - A) / Math.max(D, 1));
    else if (i < relStart) e[i] = s;
    else e[i] = s * Math.max(0, 1 - (i - relStart) / Math.max(R, 1)) ** 1.8;
  }
  return e;
}

export function applyEnv(x, e) {
  const y = buf(x.length);
  for (let i = 0; i < x.length; i++) y[i] = x[i] * (e[i] ?? 0);
  return y;
}

/** Fade-out linear-em-potencia nos ultimos `sec` segundos (evita clique no fim). */
export function fadeOut(x, sec, sr = SR) {
  const n = Math.round(sec * sr);
  const s = Math.max(0, x.length - n);
  for (let i = s; i < x.length; i++) x[i] *= (1 - (i - s) / n) ** 1.5;
  return x;
}

export function fadeIn(x, sec, sr = SR) {
  const n = Math.max(1, Math.round(sec * sr));
  for (let i = 0; i < Math.min(n, x.length); i++) x[i] *= i / n;
  return x;
}

// ------------------------------------------------------------- biquad ------

/** Biquad RBJ. type: lowpass|highpass|peaking|lowshelf|highshelf|bandpass|notch */
export function biquadCoeffs(type, f0, Q, gainDb = 0, sr = SR) {
  const A = 10 ** (gainDb / 40);
  const w0 = (2 * Math.PI * f0) / sr;
  const cw = Math.cos(w0), sw = Math.sin(w0);
  const alpha = sw / (2 * Q);
  let b0, b1, b2, a0, a1, a2;
  switch (type) {
    case 'lowpass':
      b0 = (1 - cw) / 2; b1 = 1 - cw; b2 = b0;
      a0 = 1 + alpha; a1 = -2 * cw; a2 = 1 - alpha; break;
    case 'highpass':
      b0 = (1 + cw) / 2; b1 = -(1 + cw); b2 = b0;
      a0 = 1 + alpha; a1 = -2 * cw; a2 = 1 - alpha; break;
    case 'bandpass':
      b0 = alpha; b1 = 0; b2 = -alpha;
      a0 = 1 + alpha; a1 = -2 * cw; a2 = 1 - alpha; break;
    case 'notch':
      b0 = 1; b1 = -2 * cw; b2 = 1;
      a0 = 1 + alpha; a1 = -2 * cw; a2 = 1 - alpha; break;
    case 'peaking':
      b0 = 1 + alpha * A; b1 = -2 * cw; b2 = 1 - alpha * A;
      a0 = 1 + alpha / A; a1 = -2 * cw; a2 = 1 - alpha / A; break;
    case 'lowshelf': {
      const s = 2 * Math.sqrt(A) * alpha;
      b0 = A * ((A + 1) - (A - 1) * cw + s); b1 = 2 * A * ((A - 1) - (A + 1) * cw); b2 = A * ((A + 1) - (A - 1) * cw - s);
      a0 = (A + 1) + (A - 1) * cw + s; a1 = -2 * ((A - 1) + (A + 1) * cw); a2 = (A + 1) + (A - 1) * cw - s; break;
    }
    case 'highshelf': {
      const s = 2 * Math.sqrt(A) * alpha;
      b0 = A * ((A + 1) + (A - 1) * cw + s); b1 = -2 * A * ((A - 1) + (A + 1) * cw); b2 = A * ((A + 1) + (A - 1) * cw - s);
      a0 = (A + 1) - (A - 1) * cw + s; a1 = 2 * ((A - 1) - (A + 1) * cw); a2 = (A + 1) - (A - 1) * cw - s; break;
    }
    default: throw new Error(`biquad desconhecido: ${type}`);
  }
  return [b0 / a0, b1 / a0, b2 / a0, a1 / a0, a2 / a0];
}

export function biquad(x, type, f0, Q, gainDb = 0, sr = SR) {
  return biquadRaw(x, biquadCoeffs(type, f0, Q, gainDb, sr));
}

export function biquadRaw(x, [b0, b1, b2, a1, a2]) {
  const y = buf(x.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const v = b0 * x[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1; x1 = x[i]; y2 = y1; y1 = v;
    y[i] = v;
  }
  return y;
}

/** Filtro de ordem 2N aplicando o mesmo biquad N vezes. */
export function biquadN(x, n, ...args) {
  let y = x;
  for (let i = 0; i < n; i++) y = biquad(y, ...args);
  return y;
}

/** Lowpass de 1 polo com frequencia variavel por sample (varredura de filtro). */
export function sweepLowpass(x, freqs, sr = SR) {
  const y = buf(x.length);
  let z = 0;
  for (let i = 0; i < x.length; i++) {
    const f = clamp(freqs[i] ?? freqs[freqs.length - 1], 20, sr * 0.45);
    const a = 1 - Math.exp((-2 * Math.PI * f) / sr);
    z += a * (x[i] - z);
    y[i] = z;
  }
  return y;
}

// --------------------------------------------------- resample / pitch ------

/** Le `x` com passo `step` (>1 acelera, agudiza). Interpolacao de Hermite cubica. */
export function resampleStep(x, step) {
  const n = Math.max(1, Math.floor(x.length / step));
  const y = buf(n);
  for (let i = 0; i < n; i++) {
    const p = i * step;
    const i1 = Math.floor(p);
    const t = p - i1;
    const x0 = x[i1 - 1] ?? x[i1] ?? 0, x1 = x[i1] ?? 0, x2 = x[i1 + 1] ?? x1, x3 = x[i1 + 2] ?? x2;
    const c0 = x1;
    const c1 = 0.5 * (x2 - x0);
    const c2 = x0 - 2.5 * x1 + 2 * x2 - 0.5 * x3;
    const c3 = 0.5 * (x3 - x0) + 1.5 * (x1 - x2);
    y[i] = ((c3 * t + c2) * t + c1) * t + c0;
  }
  return y;
}

/** Converte de `from` Hz para `to` Hz. */
export function resampleTo(x, from, to) {
  return from === to ? x.slice() : resampleStep(x, from / to);
}

/** Time-stretch por overlap-add com janela de Hann. factor>1 alonga. */
export function timeStretch(x, factor, grainSec = 0.06, sr = SR) {
  const N = Math.max(64, Math.round(grainSec * sr));
  const outHop = N >> 1;
  const inHop = outHop / factor;
  const outLen = Math.round(x.length * factor) + N;
  const y = buf(outLen);
  const win = buf(N);
  for (let i = 0; i < N; i++) win[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (N - 1));

  for (let g = 0; ; g++) {
    const outPos = g * outHop;
    if (outPos + N >= outLen) break;
    const inPos = g * inHop;
    const i0 = Math.floor(inPos);
    const frac = inPos - i0;
    for (let i = 0; i < N; i++) {
      const a = x[i0 + i] ?? 0;
      const b = x[i0 + i + 1] ?? 0;
      y[outPos + i] += (a + (b - a) * frac) * win[i];
    }
  }
  return y;
}

/** Transpoe `semitones` mantendo a duracao (resample + OLA de volta). */
export function pitchShift(x, semitones, sr = SR, grainSec = 0.06) {
  if (Math.abs(semitones) < 1e-6) return x.slice();
  const r = 2 ** (semitones / 12);
  const fast = resampleStep(x, r);          // pitch x r, duracao / r
  const back = timeStretch(fast, r, grainSec, sr); // duracao restaurada
  const y = buf(x.length);
  y.set(back.subarray(0, Math.min(back.length, x.length)));
  return y;
}

// ----------------------------------------------------------- efeitos -------

/** Delay com feedback e filtro no laco. */
export function delay(x, timeSec, feedback, damp = 6000, sr = SR) {
  const d = Math.max(1, Math.round(timeSec * sr));
  const y = buf(x.length);
  const line = buf(d);
  let idx = 0, z = 0;
  const a = 1 - Math.exp((-2 * Math.PI * damp) / sr);
  for (let i = 0; i < x.length; i++) {
    const rd = line[idx];
    y[i] = rd;
    z += a * (rd - z);
    line[idx] = x[i] + z * feedback;
    idx = (idx + 1) % d;
  }
  return y;
}

/** Chorus/doubler: `voices` copias com delay modulado por LFO. Devolve [L, R]. */
export function chorus(x, { voices = 3, baseMs = 12, spreadMs = 8, rateHz = 0.5, depthMs = 2.2, sr = SR } = {}) {
  const L = buf(x.length), R = buf(x.length);
  const maxD = Math.round(((baseMs + spreadMs + depthMs + 2) * sr) / 1000);
  for (let v = 0; v < voices; v++) {
    const base = ((baseMs + (spreadMs * v) / Math.max(1, voices - 1)) * sr) / 1000;
    const rate = rateHz * (1 + 0.37 * v);
    const phase = (v * 2 * Math.PI) / voices;
    const pan = voices === 1 ? 0 : -1 + (2 * v) / (voices - 1);
    const gl = Math.cos(((pan + 1) * Math.PI) / 4), gr = Math.sin(((pan + 1) * Math.PI) / 4);
    for (let i = 0; i < x.length; i++) {
      const mod = (depthMs * sr / 1000) * Math.sin((2 * Math.PI * rate * i) / sr + phase);
      const p = i - base - mod;
      if (p < 1 || p >= x.length) continue;
      const i0 = Math.floor(p), f = p - i0;
      const s = x[i0] + (x[i0 + 1] - x[i0]) * f;
      L[i] += s * gl; R[i] += s * gr;
    }
  }
  const g = 1 / Math.sqrt(voices);
  for (let i = 0; i < x.length; i++) { L[i] *= g; R[i] *= g; }
  void maxD;
  return [L, R];
}

/** Reverb de placa (Freeverb: 8 combs + 4 allpass por canal). Devolve [L, R]. */
export function reverb(x, { room = 0.84, damp = 0.28, preDelay = 0.02, width = 1, sr = SR } = {}) {
  const k = sr / 44100;
  const COMB = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617].map((n) => Math.round(n * k));
  const ALLP = [556, 441, 341, 225].map((n) => Math.round(n * k));
  const SPREAD = Math.round(23 * k);
  const pd = Math.round(preDelay * sr);

  const run = (offset) => {
    const combs = COMB.map((n) => ({ line: buf(n + offset), idx: 0, store: 0 }));
    const allps = ALLP.map((n) => ({ line: buf(n + offset), idx: 0 }));
    const out = buf(x.length + pd);
    for (let i = 0; i < out.length; i++) {
      const inp = (x[i - pd] ?? 0) * 0.015;
      let acc = 0;
      for (const c of combs) {
        const v = c.line[c.idx];
        acc += v;
        c.store = v * (1 - damp) + c.store * damp;
        c.line[c.idx] = inp + c.store * room;
        c.idx = (c.idx + 1) % c.line.length;
      }
      for (const a of allps) {
        const v = a.line[a.idx];
        const o = -acc + v;
        a.line[a.idx] = acc + v * 0.5;
        a.idx = (a.idx + 1) % a.line.length;
        acc = o;
      }
      out[i] = acc;
    }
    return out;
  };

  const l = run(0);
  const r = run(SPREAD);
  if (width < 1) {
    for (let i = 0; i < l.length; i++) {
      const m = (l[i] + r[i]) * 0.5;
      l[i] = m + (l[i] - m) * width;
      r[i] = m + (r[i] - m) * width;
    }
  }
  return [l, r];
}

/** Bitcrush: quantizacao em `bits` + reducao de taxa para `rate` Hz. */
export function bitcrush(x, bits = 10, rate = 12000, sr = SR) {
  const y = buf(x.length);
  const steps = 2 ** (bits - 1);
  const hold = Math.max(1, Math.round(sr / rate));
  let s = 0;
  for (let i = 0; i < x.length; i++) {
    if (i % hold === 0) s = Math.round(clamp(x[i], -1, 1) * steps) / steps;
    y[i] = s;
  }
  return y;
}

/** Saturacao suave (tanh) com compensacao de ganho. */
export function saturate(x, drive = 2) {
  const y = buf(x.length);
  const comp = 1 / Math.tanh(drive);
  for (let i = 0; i < x.length; i++) y[i] = Math.tanh(x[i] * drive) * comp;
  return y;
}

/** Compressor feed-forward com detector RMS. */
export function compress(x, { threshDb = -18, ratio = 4, attack = 0.005, release = 0.12, makeupDb = 0, sr = SR } = {}) {
  const y = buf(x.length);
  const aA = Math.exp(-1 / (attack * sr));
  const aR = Math.exp(-1 / (release * sr));
  const makeup = dbToGain(makeupDb);
  let env = 0;
  for (let i = 0; i < x.length; i++) {
    const lvl = Math.abs(x[i]);
    env = lvl > env ? aA * env + (1 - aA) * lvl : aR * env + (1 - aR) * lvl;
    const db = gainToDb(env);
    const over = db - threshDb;
    const gr = over > 0 ? -over * (1 - 1 / ratio) : 0;
    y[i] = x[i] * dbToGain(gr) * makeup;
  }
  return y;
}

/** Envelope de ducking (sidechain) a partir de um sinal de controle. */
export function duckEnvelope(control, { depthDb = -6, attack = 0.01, release = 0.25, threshDb = -34, sr = SR } = {}) {
  const n = control.length;
  const e = buf(n);
  const aA = Math.exp(-1 / (attack * sr));
  const aR = Math.exp(-1 / (release * sr));
  let env = 0;
  const depth = dbToGain(depthDb);
  const thr = dbToGain(threshDb);
  for (let i = 0; i < n; i++) {
    const lvl = Math.abs(control[i]);
    env = lvl > env ? aA * env + (1 - aA) * lvl : aR * env + (1 - aR) * lvl;
    const amt = clamp((env - thr) / (0.25 - thr), 0, 1);
    e[i] = 1 + (depth - 1) * amt;
  }
  return e;
}

/** Limitador de pico com lookahead. Devolve [L, R] e a reducao maxima em dB. */
export function limit(L, R, { ceiling = dbToGain(-1), lookahead = 0.005, release = 0.08, sr = SR } = {}) {
  const la = Math.round(lookahead * sr);
  const n = L.length;
  const gain = buf(n + la).fill(1);

  for (let i = 0; i < n; i++) {
    const pk = Math.max(Math.abs(L[i]), Math.abs(R[i]));
    if (pk > ceiling) {
      const g = ceiling / pk;
      // rampa de ataque nos `la` samples anteriores
      for (let j = Math.max(0, i - la); j <= i; j++) {
        const t = (j - (i - la)) / la;
        const target = 1 + (g - 1) * t;
        if (target < gain[j]) gain[j] = target;
      }
    }
  }
  // release suave
  const aR = Math.exp(-1 / (release * sr));
  let g = 1;
  let maxGr = 0;
  const oL = buf(n), oR = buf(n);
  for (let i = 0; i < n; i++) {
    g = gain[i] < g ? gain[i] : aR * g + (1 - aR) * gain[i];
    maxGr = Math.min(maxGr, gainToDb(g));
    oL[i] = clamp(L[i] * g, -1, 1);
    oR[i] = clamp(R[i] * g, -1, 1);
  }
  return [oL, oR, -maxGr];
}

/** Pan de potencia constante: mono -> [L, R]. pan em -1..1. */
export function pan(x, p) {
  const a = ((clamp(p, -1, 1) + 1) * Math.PI) / 4;
  return [scale(x, Math.cos(a)), scale(x, Math.sin(a))];
}

/** Alarga a imagem estereo por mid/side. */
export function widen(L, R, amount = 1.4) {
  const oL = buf(L.length), oR = buf(R.length);
  for (let i = 0; i < L.length; i++) {
    const m = (L[i] + R[i]) * 0.5;
    const s = (L[i] - R[i]) * 0.5 * amount;
    oL[i] = m + s; oR[i] = m - s;
  }
  return [oL, oR];
}

// ----------------------------------------------------------- ruido ---------

/** PRNG determinista (mulberry32) — o render tem que ser reprodutivel. */
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function noise(n, seed = 1) {
  const r = rng(seed);
  const y = buf(n);
  for (let i = 0; i < n; i++) y[i] = r() * 2 - 1;
  return y;
}
