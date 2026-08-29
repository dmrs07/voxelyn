// Instrumentos do logo sonoro. Osciladores PolyBLEP (sem aliasing audivel),
// sinos aditivos e ruido determinista.
import { applyEnv, biquad, buf, clamp, envAD, envADSR, mixInto, noise, rng, SR, sweepLowpass } from './dsp.mjs';

const NAMES = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** "G#3" | "Bb4" | "E1" -> Hz (temperamento igual, A4 = 440). */
export function hz(name) {
  const m = /^([A-G])([#b]?)(-?\d+)$/.exec(name);
  if (!m) throw new Error(`nota invalida: ${name}`);
  const semi = NAMES[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
  const midi = 12 * (Number(m[3]) + 1) + semi;
  return 440 * 2 ** ((midi - 69) / 12);
}

// -------------------------------------------------------- osciladores ------

// Correcao PolyBLEP: remove o degrau do salto do dente-de-serra/pulso.
function blep(t, dt) {
  if (t < dt) { const x = t / dt; return x + x - x * x - 1; }
  if (t > 1 - dt) { const x = (t - 1) / dt; return x * x + x + x + 1; }
  return 0;
}

/** Dente-de-serra. `freq` pode ser numero ou Float64Array (envelope de altura). */
export function saw(freq, n, phase0 = 0, sr = SR) {
  const y = buf(n);
  let p = phase0;
  for (let i = 0; i < n; i++) {
    const f = typeof freq === 'number' ? freq : freq[i];
    const dt = f / sr;
    y[i] = 2 * p - 1 - blep(p, dt);
    p += dt; if (p >= 1) p -= 1;
  }
  return y;
}

/** Pulso com duty variavel (0.5 = quadrada, 0.125 = lead de NES). */
export function pulse(freq, n, duty = 0.5, phase0 = 0, sr = SR) {
  const y = buf(n);
  let p = phase0;
  for (let i = 0; i < n; i++) {
    const f = typeof freq === 'number' ? freq : freq[i];
    const dt = f / sr;
    let v = p < duty ? 1 : -1;
    v += blep(p, dt);
    let q = p - duty; if (q < 0) q += 1;
    v -= blep(q, dt);
    y[i] = v;
    p += dt; if (p >= 1) p -= 1;
  }
  return y;
}

export function sine(freq, n, phase0 = 0, sr = SR) {
  const y = buf(n);
  let p = phase0;
  for (let i = 0; i < n; i++) {
    const f = typeof freq === 'number' ? freq : freq[i];
    y[i] = Math.sin(2 * Math.PI * p);
    p += f / sr; if (p >= 1) p -= 1;
  }
  return y;
}

/** Rampa exponencial de `from` a `to` Hz em `n` samples (envelope de altura). */
export function glide(from, to, n, hold = 0) {
  const f = buf(n);
  const g = Math.max(1, Math.round(n - hold));
  for (let i = 0; i < n; i++) {
    const t = clamp(i / g, 0, 1);
    f[i] = from * (to / from) ** (t ** 0.55);
  }
  return f;
}

// ------------------------------------------------------------ vozes --------

/**
 * Supersaw: `detune` vozes por nota, espalhadas em cents, fases decorrelacionadas.
 * E a traducao sonora do degrade roxo->magenta da marca: uma cor so, com largura.
 */
export function supersaw(freqHz, n, { voices = 5, cents = 14, seed = 7, sr = SR } = {}) {
  const r = rng(seed);
  const y = buf(n);
  for (let v = 0; v < voices; v++) {
    const spread = voices === 1 ? 0 : (-1 + (2 * v) / (voices - 1)) * cents;
    const f = freqHz * 2 ** (spread / 1200);
    const s = saw(f, n, r(), sr);
    for (let i = 0; i < n; i++) y[i] += s[i];
  }
  const g = 1 / Math.sqrt(voices);
  for (let i = 0; i < n; i++) y[i] *= g;
  return y;
}

/** Sino/pluck aditivo: parciais inarmonicos com decaimento mais curto nos agudos. */
export function bell(freqHz, n, { decay = 0.9, partials = [1, 2.01, 3.03, 4.21, 5.43], sr = SR } = {}) {
  const y = buf(n);
  const amps = [1, 0.5, 0.28, 0.14, 0.08];
  partials.forEach((mult, k) => {
    const f = freqHz * mult;
    if (f > sr * 0.45) return;
    const e = envAD(n, 0.002, decay / (1 + k * 0.85), sr, 3.2);
    const s = sine(f, n, (k * 0.37) % 1, sr);
    for (let i = 0; i < n; i++) y[i] += s[i] * e[i] * amps[k];
  });
  return y;
}

/** Sub do impacto: seno com queda de altura + um pouco de saturacao no corpo. */
export function subDrop(n, { from = 180, to = hz('E1'), dropSec = 0.09, decay = 0.85, sr = SR } = {}) {
  const f = glide(from, to, n, n - Math.round(dropSec * sr));
  const e = envAD(n, 0.001, decay, sr, 3.0);
  const s = sine(f, n, 0, sr);
  const y = buf(n);
  for (let i = 0; i < n; i++) y[i] = Math.tanh(s[i] * 1.6) * 0.62 * e[i];
  return y;
}

/** Transiente do impacto: estalo curto de ruido filtrado — o "encaixe da ferramenta". */
export function click(n, { seed = 21, tone = 3200, sr = SR } = {}) {
  const nz = noise(n, seed);
  const e = envAD(n, 0.0004, 0.028, sr, 6);
  const band = biquad(applyEnv(nz, e), 'bandpass', tone, 1.1, 0, sr);
  const hi = biquad(applyEnv(nz, envAD(n, 0.0002, 0.008, sr, 9)), 'highpass', 6500, 0.7, 0, sr);
  const y = buf(n);
  for (let i = 0; i < n; i++) y[i] = band[i] * 0.85 + hi[i] * 0.5;
  return y;
}

/** Riser: ruido com passa-banda subindo + um seno que sobe junto. */
export function riser(n, { fromHz = 300, toHz = 7000, seed = 33, sr = SR } = {}) {
  const nz = noise(n, seed);
  const sweep = buf(n);
  for (let i = 0; i < n; i++) sweep[i] = fromHz * (toHz / fromHz) ** ((i / n) ** 1.9);
  const hp = biquad(nz, 'highpass', 900, 0.7, 0, sr);
  const swept = sweepLowpass(hp, sweep, sr);
  const e = buf(n);
  for (let i = 0; i < n; i++) e[i] = (i / n) ** 1.5;
  const tone = sine(glide(fromHz * 0.8, toHz * 0.55, n), n, 0, sr);
  const y = buf(n);
  for (let i = 0; i < n; i++) y[i] = (swept[i] * 1.0 + tone[i] * 0.16) * e[i];
  return y;
}

/**
 * Arpejo chiptune: uma nota por passo, pulso com duty fixo, envelope duro.
 * Sao os blocos empilhando antes do impacto.
 */
export function chipArp(notes, stepSec, { duty = 0.25, gap = 0.12, sr = SR } = {}) {
  const step = Math.round(stepSec * sr);
  const out = buf(step * notes.length + Math.round(0.25 * sr));
  const len = Math.round(step * (1 - gap));
  notes.forEach((name, k) => {
    const v = applyEnv(pulse(hz(name), len, duty, 0, sr), envADSR(len, 0.0008, 0.02, 0.75, 0.03, sr));
    mixInto(out, v, k * step, 1);
  });
  return out;
}

/** Acorde sustentado: uma supersaw por nota, com abertura de filtro comum. */
export function chordPad(notes, n, { cents = 14, voices = 5, seed = 101, sr = SR } = {}) {
  const y = buf(n);
  notes.forEach((name, k) => {
    const s = supersaw(hz(name), n, { voices, cents, seed: seed + k * 13, sr });
    const g = 1 / Math.sqrt(notes.length);
    for (let i = 0; i < n; i++) y[i] += s[i] * g;
  });
  return y;
}
