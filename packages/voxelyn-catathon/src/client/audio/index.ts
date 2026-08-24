import type { Cat, CatId, HackState, SimEvent } from '../../sim/types.js';
import { createMixer, duck, loadPrefs, panOf, setBusLevel, type BusId, type Mixer } from './mixer.js';
import { createMusic, freezeMusic, playSoftLoss, setSignals, startMusic, stopMusic, type MusicEngine } from './music.js';
import { signalsOf, type LayerId } from './theory.js';
import { playEvent, submissionRitual } from './sfx.js';
import { createTyping, stepTyping, type Typing } from './typing.js';
import { createVocals, teamCelebration, vocalize, type Vocals } from './vocals.js';
import { createAmbience, startAmbience, stepAmbience, stopAmbience, type Ambience } from './ambience.js';
import { hz } from './theory.js';

export { BUS_IDS, type BusId } from './mixer.js';

/**
 * O MOTOR DE AUDIO do Catathon: a fachada que o app usa.
 *
 * Consome EVENTOS SEMANTICOS da simulacao e sinais derivados do estado — nunca
 * inspeciona animacao (direcao §15). O AudioContext so nasce no primeiro gesto
 * do jogador: politica de autoplay e regra de teste.
 *
 * A arquitetura interna (transport / mixer / voices / grafo adaptativo /
 * ducking / preferencias) espelha os assentos de um futuro `voxelyn-audio`
 * compartilhado; a matriz de reuso explica por que a promocao espera um
 * segundo consumidor.
 */

export type AudioEngine = {
  mix: Mixer | null;
  music: MusicEngine;
  typing: Typing;
  vocals: Vocals;
  ambience: Ambience;
  unlocked: boolean;
  purring: { osc: OscillatorNode; gain: GainNode; lfo: OscillatorNode } | null;
  /** Estado inspecionavel pela fumaca: o que esta soando e por que. */
  debug: { layers: LayerId[]; ticks: number };
};

export const createAudioEngine = (): AudioEngine => ({
  mix: null,
  music: createMusic(),
  typing: createTyping(),
  vocals: createVocals(),
  ambience: createAmbience(),
  unlocked: false,
  purring: null,
  debug: { layers: ['bed'], ticks: 0 },
});

export const unlockAudio = (a: AudioEngine): void => {
  if (a.unlocked) return;
  try {
    const ctx = new AudioContext();
    a.mix = createMixer(ctx, loadPrefs());
    a.unlocked = true;
  } catch {
    // Sem audio nao e sem jogo.
  }
};

export const setLevel = (a: AudioEngine, bus: BusId, level01: number): void => {
  if (a.mix) setBusLevel(a.mix, bus, level01);
};

export const getLevels = (a: AudioEngine): Record<BusId, number> =>
  a.mix ? { ...a.mix.prefs } : loadPrefs();

export const startGameAudio = (a: AudioEngine): void => {
  if (!a.mix) return;
  startMusic(a.music, a.mix);
  startAmbience(a.ambience, a.mix);
};

export const stopGameAudio = (a: AudioEngine): void => {
  stopMusic(a.music);
  stopAmbience(a.ambience);
  stopPetPurr(a);
};

/** Por tick de simulacao: sinais para o grafo, digitacao, arco da ambiencia. */
export const tickAudio = (a: AudioEngine, state: HackState): void => {
  if (!a.mix || !a.music.running) return;
  const s = signalsOf(state);
  setSignals(a.music, a.mix, s, state.tick);
  a.debug.ticks++;
  a.debug.layers = [...a.music.layers] as LayerId[];
  stepTyping(a.typing, a.mix, state, a.mix.ctx.currentTime);
  stepAmbience(a.ambience, a.mix, s.clock);
};

/** Eventos da simulacao + reacoes felinas raras aos proprios desastres. */
export const eventsAudio = (a: AudioEngine, state: HackState, events: SimEvent[]): void => {
  if (!a.mix) return;
  for (const e of events) {
    const critical = playEvent(a.mix, state, e);
    if (critical) duck(a.mix);
    const now = performance.now();
    const at = (id: CatId): Cat | undefined => state.cats.find((c) => c.id === id);
    if (e.kind === 'bug') {
      const cat = at(e.by);
      if (cat) vocalize(a.vocals, a.mix, e.by, cat.x, 'annoyed', now);
    } else if (e.kind === 'cable') {
      const cat = at(e.by);
      // O chirp CULPADO da direcao §9.
      if (cat) vocalize(a.vocals, a.mix, e.by, cat.x, 'chirp', now);
    } else if (e.kind === 'zoomies') {
      const cat = at(e.cat);
      if (cat) vocalize(a.vocals, a.mix, e.cat, cat.x, 'chirp', now);
    } else if (e.kind === 'ship') {
      const cat = at(e.by);
      if (cat) vocalize(a.vocals, a.mix, e.by, cat.x, 'chirp', now);
    }
  }
};

/** Pegar/soltar/selecionar um gato: reconhecimento raro, nunca garantido. */
export const grabVocal = (a: AudioEngine, state: HackState, id: CatId): void => {
  if (!a.mix) return;
  const cat = state.cats.find((c) => c.id === id);
  if (cat) vocalize(a.vocals, a.mix, id, cat.x, 'chirp', performance.now());
};

/**
 * O ronronar do CARINHO: continuo, espacial, e para na hora que o dedo sai.
 * E o feedback tatil do gesto — o unico som que o jogador "segura".
 */
export const setPetPurr = (a: AudioEngine, cat: Cat | null): void => {
  if (!a.mix) return;
  if (cat && !a.purring) {
    const ctx = a.mix.ctx;
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = hz(26);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 200;
    const gain = ctx.createGain();
    gain.gain.value = 0.0001;
    gain.gain.setTargetAtTime(0.5, ctx.currentTime, 0.15);
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 25;
    const lfoG = ctx.createGain();
    lfoG.gain.value = 0.22;
    lfo.connect(lfoG).connect(gain.gain);
    const pan = ctx.createStereoPanner();
    pan.pan.value = panOf(cat.x);
    osc.connect(lp).connect(gain).connect(pan).connect(a.mix.buses.vocals);
    osc.start();
    lfo.start();
    a.purring = { osc, gain, lfo };
  } else if (!cat && a.purring) {
    stopPetPurr(a);
  }
};

const stopPetPurr = (a: AudioEngine): void => {
  if (!a.purring || !a.mix) return;
  a.purring.gain.gain.setTargetAtTime(0.0001, a.mix.ctx.currentTime, 0.08);
  a.purring.osc.stop(a.mix.ctx.currentTime + 0.4);
  a.purring.lfo.stop(a.mix.ctx.currentTime + 0.4);
  a.purring = null;
};

/** A submissao: congela a musica, roda o ritual, fecha com festa ou feltro. */
export const demoAudio = (a: AudioEngine, state: HackState): void => {
  if (!a.mix || !state.result) return;
  const mix = a.mix;
  freezeMusic(a.music);
  stopPetPurr(a);
  const result = state.result;
  submissionRitual(mix, result, () => {
    if (result.crashed || result.outcome === 'participacao') {
      playSoftLoss(mix);
    } else {
      const xs = Object.fromEntries(state.cats.map((c) => [c.id, c.x])) as Record<CatId, number>;
      teamCelebration(a.vocals, mix, xs);
    }
  });
};
