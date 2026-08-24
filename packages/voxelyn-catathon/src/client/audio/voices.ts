import { hz } from './theory.js';
import type { Mixer, BusId } from './mixer.js';

/**
 * As VOZES sintetizadas. Fofura por TEXTURA (direcao §1): transientes
 * arredondados, ataques macios, nada estridente. Cada voz e uma funcao curta
 * que agenda osciladores e morre — o padrao da casa.
 *
 * `when` e tempo do AudioContext: as vozes sao agendaveis pelo transporte com
 * antecedencia, que e o que permite ritmo firme num setInterval impreciso.
 */

export type NotePlayer = (mix: Mixer, midi: number, when: number, velocity?: number) => void;

const env = (
  mix: Mixer,
  bus: BusId,
  when: number,
  attack: number,
  decay: number,
  peak: number,
  pan = 0
): { in: AudioNode; stop: (t: number) => void } => {
  const g = mix.ctx.createGain();
  g.gain.setValueAtTime(0.0001, when);
  g.gain.linearRampToValueAtTime(peak, when + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, when + attack + decay);
  const p = mix.ctx.createStereoPanner();
  p.pan.value = pan;
  g.connect(p).connect(mix.buses[bus]);
  return { in: g, stop: () => undefined };
};

/** Piano eletrico quente: FM de um modulador so, indice baixo. A fundacao. */
export const epiano: NotePlayer = (mix, midi, when, vel = 0.5) => {
  const f = hz(midi);
  const car = mix.ctx.createOscillator();
  car.type = 'sine';
  car.frequency.value = f;
  const mod = mix.ctx.createOscillator();
  mod.type = 'sine';
  mod.frequency.value = f * 2;
  const modGain = mix.ctx.createGain();
  modGain.gain.setValueAtTime(f * 0.9, when);
  modGain.gain.exponentialRampToValueAtTime(f * 0.08, when + 0.4);
  mod.connect(modGain).connect(car.frequency);
  const e = env(mix, 'music', when, 0.004, 1.4, 0.16 * vel * 2);
  car.connect(e.in);
  car.start(when);
  mod.start(when);
  car.stop(when + 1.6);
  mod.stop(when + 1.6);
};

/** Piano de feltro: triangulo escuro, ataque de almofada. A voz da derrota gentil. */
export const felt: NotePlayer = (mix, midi, when, vel = 0.5) => {
  const o = mix.ctx.createOscillator();
  o.type = 'triangle';
  o.frequency.value = hz(midi);
  const lp = mix.ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 1100;
  const e = env(mix, 'music', when, 0.025, 1.8, 0.2 * vel * 2);
  o.connect(lp).connect(e.in);
  o.start(when);
  o.stop(when + 2);
};

/** Pluck abafado para o motivo: curto, redondo, nunca vidro puro. */
export const pluck: NotePlayer = (mix, midi, when, vel = 0.5) => {
  const o = mix.ctx.createOscillator();
  o.type = 'triangle';
  o.frequency.value = hz(midi);
  const lp = mix.ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(3200, when);
  lp.frequency.exponentialRampToValueAtTime(700, when + 0.22);
  const e = env(mix, 'music', when, 0.002, 0.3, 0.17 * vel * 2);
  o.connect(lp).connect(e.in);
  o.start(when);
  o.stop(when + 0.4);
};

/** Baixo redondo: seno com um fio de triangulo por cima. */
export const bass: NotePlayer = (mix, midi, when, vel = 0.6) => {
  const s = mix.ctx.createOscillator();
  s.type = 'sine';
  s.frequency.value = hz(midi);
  const t = mix.ctx.createOscillator();
  t.type = 'triangle';
  t.frequency.value = hz(midi);
  const tg = mix.ctx.createGain();
  tg.gain.value = 0.25;
  const e = env(mix, 'music', when, 0.006, 0.42, 0.3 * vel * 1.6);
  s.connect(e.in);
  t.connect(tg).connect(e.in);
  s.start(when);
  t.start(when);
  s.stop(when + 0.5);
  t.stop(when + 0.5);
};

/**
 * O PAD-RONRONAR (instrumento de personagem da direcao §2): serrote grave
 * filtrado com tremolo de 24Hz — um ronronar ressintetizado em harmonia. E a
 * assinatura de "meia-noite" do jogo, e por isso mora na cama harmonica.
 */
export const purrPad = (mix: Mixer, midi: number): { stop: () => void } => {
  const ctx = mix.ctx;
  const o = ctx.createOscillator();
  o.type = 'sawtooth';
  o.frequency.value = hz(midi);
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 240;
  const g = ctx.createGain();
  g.gain.value = 0.0001;
  g.gain.setTargetAtTime(0.1, ctx.currentTime, 2.5);
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 24;
  const lfoG = ctx.createGain();
  lfoG.gain.value = 0.045;
  lfo.connect(lfoG).connect(g.gain);
  o.connect(lp).connect(g).connect(mix.buses.music);
  o.start();
  lfo.start();
  return {
    stop: () => {
      g.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.4);
      o.stop(ctx.currentTime + 1.5);
      lfo.stop(ctx.currentTime + 1.5);
    },
  };
};

// ------------------------------------------------------------- percussao

let noiseBuf: AudioBuffer | null = null;
const noise = (ctx: AudioContext): AudioBuffer => {
  if (!noiseBuf) {
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  return noiseBuf;
};

/** Bumbo abafado: queda rapida de seno. Empurra sem bater. */
export const kick = (mix: Mixer, when: number, vel = 0.6): void => {
  const o = mix.ctx.createOscillator();
  o.type = 'sine';
  o.frequency.setValueAtTime(105, when);
  o.frequency.exponentialRampToValueAtTime(38, when + 0.09);
  const e = env(mix, 'music', when, 0.001, 0.16, 0.5 * vel);
  o.connect(e.in);
  o.start(when);
  o.stop(when + 0.2);
};

/** Rim click: tick de banda estreita. O "clique de caneta" da bateria. */
export const rim = (mix: Mixer, when: number, vel = 0.5): void => {
  const src = mix.ctx.createBufferSource();
  src.buffer = noise(mix.ctx);
  const bp = mix.ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 2600;
  bp.Q.value = 9;
  const e = env(mix, 'music', when, 0.001, 0.05, 0.35 * vel);
  src.connect(bp).connect(e.in);
  src.start(when);
  src.stop(when + 0.07);
};

/** Shaker: sopro de agudos curtíssimo. */
export const shaker = (mix: Mixer, when: number, vel = 0.3): void => {
  const src = mix.ctx.createBufferSource();
  src.buffer = noise(mix.ctx);
  const hp = mix.ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 7200;
  const e = env(mix, 'music', when, 0.001, 0.04, 0.16 * vel);
  src.connect(hp).connect(e.in);
  src.start(when);
  src.stop(when + 0.06);
};

/**
 * Um CLACK de tecla mecanica. Vive no barramento de TYPING (rotina fica
 * abaixo da musica, §12) e aceita pan e material — cada gato tem teclado.
 */
export const clack = (mix: Mixer, when: number, pan: number, freq = 2400, vel = 0.5): void => {
  const src = mix.ctx.createBufferSource();
  src.buffer = noise(mix.ctx);
  const bp = mix.ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = freq * (0.92 + Math.random() * 0.16);
  bp.Q.value = 5;
  const g = mix.ctx.createGain();
  g.gain.setValueAtTime(0.0001, when);
  g.gain.linearRampToValueAtTime(0.5 * vel, when + 0.001);
  g.gain.exponentialRampToValueAtTime(0.0001, when + 0.03);
  const p = mix.ctx.createStereoPanner();
  p.pan.value = pan;
  src.connect(bp).connect(g).connect(p).connect(mix.buses.typing);
  src.start(when);
  src.stop(when + 0.045);
};

/** Nota de madeira (marimba de brinquedo): o som do bug descendo a escada. */
export const wood: NotePlayer = (mix, midi, when, vel = 0.5) => {
  const o = mix.ctx.createOscillator();
  o.type = 'sine';
  o.frequency.value = hz(midi);
  const o2 = mix.ctx.createOscillator();
  o2.type = 'sine';
  o2.frequency.value = hz(midi) * 3.9;
  const g2 = mix.ctx.createGain();
  g2.gain.value = 0.12;
  const e = env(mix, 'sfx', when, 0.001, 0.28, 0.3 * vel);
  o.connect(e.in);
  o2.connect(g2).connect(e.in);
  o.start(when);
  o2.start(when);
  o.stop(when + 0.35);
  o2.stop(when + 0.35);
};

/** "Thunk" de coral: a queda do build. Grave, macio, terminal — sem susto. */
export const thunk = (mix: Mixer, when: number): void => {
  const o = mix.ctx.createOscillator();
  o.type = 'sine';
  o.frequency.setValueAtTime(hz(38), when);
  o.frequency.exponentialRampToValueAtTime(hz(31), when + 0.5);
  const e = env(mix, 'sfx', when, 0.008, 0.9, 0.5);
  o.connect(e.in);
  o.start(when);
  o.stop(when + 1);
};

/** Ping de servidor subindo: a transferencia do deploy. */
export const ping = (mix: Mixer, midi: number, when: number, pan = 0): void => {
  const o = mix.ctx.createOscillator();
  o.type = 'sine';
  o.frequency.value = hz(midi);
  const e = env(mix, 'sfx', when, 0.002, 0.35, 0.2, pan);
  o.connect(e.in);
  o.start(when);
  o.stop(when + 0.4);
};

/** Ventoinha perdendo a confianca: ruido filtrado caindo. O cabo mordido. */
export const spinDown = (mix: Mixer, when: number): void => {
  const src = mix.ctx.createBufferSource();
  src.buffer = noise(mix.ctx);
  const lp = mix.ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(1400, when);
  lp.frequency.exponentialRampToValueAtTime(90, when + 0.8);
  const g = mix.ctx.createGain();
  g.gain.setValueAtTime(0.16, when);
  g.gain.exponentialRampToValueAtTime(0.0001, when + 0.85);
  src.connect(lp).connect(g).connect(mix.buses.sfx);
  src.start(when);
  src.stop(when + 0.9);
};
