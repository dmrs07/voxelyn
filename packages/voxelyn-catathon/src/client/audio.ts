/**
 * AUDIO sintetizado em tempo real, na tradicao da casa: nenhum arquivo de som.
 *
 * Um contexto, dois ganhos (musiquinha lo-fi e efeitos), cada som uma funcao
 * curta que agenda osciladores. O ronronar e o unico som continuo — e o
 * feedback tatil do carinho, entao ele PRECISA ser continuo.
 */

export type AudioEngine = {
  ctx: AudioContext | null;
  sfx: GainNode | null;
  purr: { osc: OscillatorNode; gain: GainNode } | null;
  unlocked: boolean;
};

export const createAudio = (): AudioEngine => ({ ctx: null, sfx: null, purr: null, unlocked: false });

/** Navegador exige gesto para abrir audio; chamado no primeiro toque. */
export const unlock = (a: AudioEngine): void => {
  if (a.unlocked) return;
  try {
    const ctx = new AudioContext();
    const sfx = ctx.createGain();
    sfx.gain.value = 0.25;
    sfx.connect(ctx.destination);
    a.ctx = ctx;
    a.sfx = sfx;
    a.unlocked = true;
  } catch {
    // Sem audio nao e sem jogo.
  }
};

const blip = (a: AudioEngine, freq: number, dur: number, type: OscillatorType, slide = 0): void => {
  if (!a.ctx || !a.sfx) return;
  const t = a.ctx.currentTime;
  const osc = a.ctx.createOscillator();
  const g = a.ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (slide !== 0) osc.frequency.linearRampToValueAtTime(freq + slide, t + dur);
  g.gain.setValueAtTime(0.5, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  osc.connect(g).connect(a.sfx);
  osc.start(t);
  osc.stop(t + dur);
};

export const sfxMeow = (a: AudioEngine): void => blip(a, 620, 0.22, 'triangle', -180);
export const sfxGrab = (a: AudioEngine): void => blip(a, 340, 0.08, 'triangle', 120);
export const sfxDrop = (a: AudioEngine): void => blip(a, 260, 0.1, 'triangle', -60);
export const sfxShip = (a: AudioEngine): void => {
  blip(a, 520, 0.1, 'square');
  setTimeout(() => blip(a, 780, 0.14, 'square'), 90);
};
export const sfxBug = (a: AudioEngine): void => blip(a, 300, 0.3, 'sawtooth', -140);
export const sfxAlarm = (a: AudioEngine): void => {
  blip(a, 440, 0.15, 'square');
  setTimeout(() => blip(a, 440, 0.15, 'square'), 220);
};
export const sfxTreat = (a: AudioEngine): void => blip(a, 700, 0.12, 'sine', 200);
export const sfxClack = (a: AudioEngine): void => blip(a, 1800 + Math.random() * 600, 0.02, 'square');

/** Liga/desliga o ronronar continuo do carinho. */
export const setPurr = (a: AudioEngine, on: boolean): void => {
  if (!a.ctx || !a.sfx) return;
  if (on && !a.purr) {
    const osc = a.ctx.createOscillator();
    const gain = a.ctx.createGain();
    const lfo = a.ctx.createOscillator();
    const lfoGain = a.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.value = 52;
    // O tremor de 24Hz no ganho E o ronronar.
    lfo.frequency.value = 24;
    lfoGain.gain.value = 0.12;
    gain.gain.value = 0.14;
    lfo.connect(lfoGain).connect(gain.gain);
    osc.connect(gain).connect(a.sfx);
    osc.start();
    lfo.start();
    a.purr = { osc, gain };
  } else if (!on && a.purr) {
    a.purr.gain.gain.linearRampToValueAtTime(0.0001, a.ctx.currentTime + 0.1);
    a.purr.osc.stop(a.ctx.currentTime + 0.15);
    a.purr = null;
  }
};
