// O arranjo do logo sonoro da DaniTools.
//
// A traducao do logotipo para som, elemento por elemento:
//   voxel / pixel     -> pulso chiptune quantizado e uma camada de bitcrush na voz
//   degrade roxo-magenta -> supersaw desafinada com abertura de filtro (uma cor, com largura)
//   letreiro de neon  -> sinos aditivos e cauda de placa brilhante
//   "tools"           -> o estalo de encaixe no ataque do impacto
//
// Tudo em 120 BPM (semininma = 0,5 s). O impacto cai no tempo 0 da grade musical;
// o que vem antes e anacruse.
import {
  applyEnv, biquad, buf, compress, dbToGain, delay, duckEnvelope, envAD, envADSR,
  fadeOut, limit, mixInto, pan, reverb, saturate, scale, SR, sweepLowpass, widen,
} from './dsp.mjs';
import { bell, chipArp, chordPad, click, hz, pulse, riser, subDrop } from './synth.mjs';
import { buildVoice } from './voice.mjs';

export const BPM = 120;
const BEAT = 60 / BPM;

/** Acorde da marca: Mi maior com nona acrescentada. Aberto, sem terca dobrada no grave. */
export const CHORD = ['E2', 'B2', 'E3', 'G#3', 'B3', 'F#4'];
export const ARP = ['B3', 'E4', 'G#4', 'B4'];
export const BELLS = ['E5', 'G#5', 'B5', 'E6', 'F#6', 'B6'];

export const TIMELINE = {
  latch: 0.02,      // estalo de ferramenta que abre a peca
  riser: 0.02,      // anacruse
  arp: 0.27,        // 4 notas de 32avo subindo o acorde
  hit: 0.52,        // O IMPACTO — tempo 0 da grade
  voice: 0.64,      // "DANITOOLS"
  bells: 1.60,      // florescimento de neon
};

const ARP_STEP = BEAT / 8; // 0,0625 s — 32avos; 4 passos = meio tempo
const DUCK_DB = -4.5;

/**
 * @param {'full'|'short'|'tag'} variant
 * @returns {{ L: Float64Array, R: Float64Array, events: object[], voiceLengthSec: number }}
 */
export function arrange(takePath, { variant = 'full', sr = SR, voiceOpts = {} } = {}) {
  const withIntro = variant === 'full';
  const withMusic = variant !== 'tag';
  // A variante curta comeca no impacto: o deslocamento traz tudo para o inicio.
  const shift = withIntro ? 0 : TIMELINE.hit - 0.02;
  const tailSec = variant === 'full' ? 1.95 : variant === 'short' ? 1.55 : 1.35;
  const at = (t) => Math.round((t - shift) * sr);

  const voice = buildVoice(takePath, { ...voiceOpts, sr });
  const endSec = TIMELINE.voice - shift + voice.lengthSec + tailSec;
  const n = Math.round(endSec * sr);

  // Cada stem e um par L/R independente. A soma so acontece no fim, depois do
  // ducking — assim o abaixamento atinge exatamente quem deve, e a voz nunca
  // precisa ser "devolvida" por compensacao.
  const stems = {};
  const stem = (name) => (stems[name] ??= [buf(n), buf(n)]);
  const put = (name, mono, off, gL = 1, gR = gL) => {
    const [l, r] = stem(name);
    mixInto(l, mono, off, gL);
    mixInto(r, mono, off, gR);
  };
  const putStereo = (name, L, R, off, g = 1) => {
    const [l, r] = stem(name);
    mixInto(l, L, off, g);
    mixInto(r, R, off, g);
  };

  const sendVoice = buf(n);   // barramento para a placa escura
  const sendShine = buf(n);   // barramento para a placa brilhante
  const events = [];
  const log = (name, t, detail) => {
    if (t >= shift - 1e-9) events.push({ name, atSec: round3(t - shift), ...detail });
  };

  // ---------------------------------------------------------- anacruse ----
  if (withIntro) {
    const lt = scale(click(Math.round(0.12 * sr), { seed: 5, tone: 5200, sr }), 0.30);
    put('anacruse', lt, at(TIMELINE.latch), 0.9, 0.75);
    log('latch', TIMELINE.latch, { nota: 'estalo de encaixe — o "tools" da marca' });

    const rn = Math.round((TIMELINE.hit - TIMELINE.riser) * sr);
    const rs = scale(riser(rn, { fromHz: 320, toHz: 7400, seed: 33, sr }), 0.40);
    const [rL, rR] = pan(rs, -0.12);
    putStereo('anacruse', rL, rR, at(TIMELINE.riser));
    mixInto(sendShine, rs, at(TIMELINE.riser), 0.16);
    log('riser', TIMELINE.riser, { durSec: round3(rn / sr), varreduraHz: [320, 7400] });

    let arp = chipArp(ARP, ARP_STEP, { duty: 0.25, gap: 0.14, sr });
    arp = scale(biquad(arp, 'highpass', 220, 0.7, 0, sr), 0.25);
    const [aL, aR] = pan(arp, 0.10);
    putStereo('anacruse', aL, aR, at(TIMELINE.arp));
    mixInto(sendShine, arp, at(TIMELINE.arp), 0.22);
    log('arp', TIMELINE.arp, { notas: ARP, passoSec: round3(ARP_STEP), duty: 0.25 });
  }

  // ----------------------------------------------------------- impacto ----
  if (withMusic) {
    const hitAt = at(TIMELINE.hit);

    const sub = scale(subDrop(Math.round(1.15 * sr), { from: 180, to: hz('E1'), dropSec: 0.085, decay: 0.80, sr }), 0.80);
    put('impacto', sub, hitAt);
    const ck = scale(click(Math.round(0.16 * sr), { seed: 21, tone: 3100, sr }), 0.52);
    put('impacto', ck, hitAt, 1.0, 0.92);
    mixInto(sendShine, ck, hitAt, 0.30);

    // camada de forca: quadrada curta em oitavas — o "8 bits" do impacto
    const pn = Math.round(0.30 * sr);
    const pw = buf(pn);
    for (const nm of ['E2', 'E3']) {
      const v = applyEnv(pulse(hz(nm), pn, 0.5, 0, sr), envAD(pn, 0.001, 0.11, sr, 3.4));
      for (let i = 0; i < pn; i++) pw[i] += v[i] * 0.5;
    }
    put('impacto', scale(biquad(pw, 'lowpass', 2600, 0.8, 0, sr), 0.24), hitAt);
    log('impacto', TIMELINE.hit, {
      camadas: ['sub 180->41,2 Hz', 'estalo em 3,1 kHz', 'quadrada E2+E3'],
      subDecaySec: 0.8,
    });

    // ------------------------------------------------------------ acorde --
    const cn = n - hitAt;
    let chord = chordPad(CHORD, cn, { voices: 5, cents: 15, seed: 101, sr });
    // A abertura do corte e o degrade roxo->magenta em forma de filtro.
    const sweep = buf(cn);
    const swEnd = Math.round(1.15 * sr);
    for (let i = 0; i < cn; i++) {
      const t = Math.min(1, i / swEnd);
      sweep[i] = 420 * (5400 / 420) ** (t ** 0.62);
    }
    chord = sweepLowpass(chord, sweep, sr);
    chord = biquad(chord, 'highpass', 110, 0.7, 0, sr);
    chord = applyEnv(chord, envADSR(cn, 0.010, 0.35, 0.72, Math.min(1.5, cn / sr - 0.45), sr));
    chord = saturate(scale(chord, 0.46), 1.25);
    const [chL, chR] = widen(...pan(chord, 0), 1.35);
    putStereo('acorde', chL, chR, hitAt);
    mixInto(sendVoice, chord, hitAt, 0.10);
    mixInto(sendShine, chord, hitAt, 0.10);
    log('acorde', TIMELINE.hit, {
      notas: CHORD, filtroHz: [420, 5400], vozesPorNota: 5, desafinacaoCents: 15,
    });
  }

  // --------------------------------------------------------------- voz ----
  const vAt = at(TIMELINE.voice);
  putStereo('voz', voice.L, voice.R, vAt);
  mixInto(sendVoice, voice.mono, vAt, 0.26);
  log('voz', TIMELINE.voice, {
    palavra: 'DANITOOLS', durSec: round3(voice.lengthSec), camadas: voice.layers,
  });

  // --------------------------------------------------------- florescer ----
  if (withMusic) {
    const bStep = 0.055;
    const bn = Math.round(1.5 * sr);
    const bL = buf(n), bR = buf(n), bM = buf(n);
    BELLS.forEach((nm, k) => {
      const b = scale(bell(hz(nm), bn, { decay: 1.05 - k * 0.10, sr }), 0.21 * (1 - k * 0.07));
      const p = (k % 2 === 0 ? -0.55 : 0.55) * (0.45 + k * 0.09);
      const [l, r] = pan(b, p);
      const off = at(TIMELINE.bells + k * bStep);
      mixInto(bL, l, off); mixInto(bR, r, off); mixInto(bM, b, off);
    });
    // eco de semicolcheia pontuada a 120 BPM — o rastro do neon
    const [eL, eR] = pan(delay(bM, BEAT * 0.375, 0.34, 5200, sr), 0.25);
    mixInto(bL, eL, 0, 0.26); mixInto(bR, eR, 0, 0.26);
    putStereo('sinos', bL, bR, 0);
    mixInto(sendShine, bM, 0, 0.34);
    log('sinos', TIMELINE.bells, { notas: BELLS, passoSec: bStep, ecoSec: round3(BEAT * 0.375) });
  }

  // ------------------------------------------------------------- placas ---
  const [rvL, rvR] = reverb(sendVoice, { room: 0.83, damp: 0.42, preDelay: 0.028, width: 0.9, sr });
  const [shL, shR] = reverb(sendShine, { room: 0.90, damp: 0.13, preDelay: 0.012, width: 1.0, sr });
  putStereo('caudas', rvL.subarray(0, n), rvR.subarray(0, n), 0, 0.85);
  putStereo('caudas', shL.subarray(0, n), shR.subarray(0, n), 0, 0.60);

  // ------------------------------------------------------------ ducking ---
  // O acorde e os sinos abaixam sob a palavra. A marca e a palavra.
  const ctrl = buf(n);
  mixInto(ctrl, voice.mono, vAt);
  const duck = duckEnvelope(ctrl, { depthDb: DUCK_DB, attack: 0.012, release: 0.26, threshDb: -32, sr });
  for (const name of ['acorde', 'sinos', 'caudas']) {
    if (!stems[name]) continue;
    const [l, r] = stems[name];
    for (let i = 0; i < n; i++) { l[i] *= duck[i]; r[i] *= duck[i]; }
  }

  // ---------------------------------------------------------------- soma --
  const L = buf(n), R = buf(n);
  for (const [l, r] of Object.values(stems)) {
    for (let i = 0; i < n; i++) { L[i] += l[i]; R[i] += r[i]; }
  }
  for (const [l, r] of Object.values(stems)) { fadeOut(l, 0.25, sr); fadeOut(r, 0.25, sr); }
  fadeOut(L, 0.25, sr); fadeOut(R, 0.25, sr);

  return { L, R, stems, events, voiceLengthSec: voice.lengthSec, duckDepthDb: DUCK_DB };
}

/** Masterizacao: EQ de barramento, cola, saturacao leve, alvo de loudness, limitador. */
export function master(L, R, { targetLufs = -14, ceilingDb = -1.0, measure, sr = SR } = {}) {
  const eq = (x) => {
    let y = biquad(x, 'highpass', 28, 0.7, 0, sr);
    y = biquad(y, 'lowshelf', 95, 0.7, 1.2, sr);
    y = biquad(y, 'peaking', 330, 1.1, -1.6, sr);   // mesma caixa que a voz tinha
    y = biquad(y, 'highshelf', 8200, 0.7, 1.6, sr);
    return y;
  };
  let mL = eq(L), mR = eq(R);
  mL = compressBus(mL, sr); mR = compressBus(mR, sr);
  mL = saturate(mL, 1.12); mR = saturate(mR, 1.12);

  // Ganho para o alvo de loudness, medido — nao estimado.
  const before = measure([mL, mR]);
  const gain = dbToGain(targetLufs - before.integratedLufs);
  mL = scale(mL, gain); mR = scale(mR, gain);

  const [oL, oR, gr] = limit(mL, mR, { ceiling: dbToGain(ceilingDb), lookahead: 0.005, release: 0.08, sr });
  return { L: oL, R: oR, appliedGainDb: round1(20 * Math.log10(gain)), maxGainReductionDb: round1(gr), preLufs: before.integratedLufs };
}

function compressBus(x, sr) {
  return compress(x, { threshDb: -16, ratio: 2.2, attack: 0.012, release: 0.18, makeupDb: 1.0, sr });
}

const round3 = (v) => Math.round(v * 1000) / 1000;
const round1 = (v) => Math.round(v * 10) / 10;
