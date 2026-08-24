import { hz, D2 } from './theory.js';
import type { Mixer } from './mixer.js';

/**
 * A AMBIENCIA do pavilhao (direcao §10): o lugar tem de parecer enorme sem
 * cansar o ouvido. Duas camadas continuas e transientes raros:
 *
 *  - MULTIDAO: ruido rosa-ish filtrado bem grave, com respiracao lenta.
 *  - VENTILACAO AFINADA NA TONICA: o detalhe da direcao que costura tudo — o
 *    drone do rack e um RE, entao a sala inteira esta no tom da musica.
 *
 * A ambiencia acompanha o relogio do hackathon: comeco social (multidao mais
 * presente), meio "madrugada" (quase so ventilacao), reta final acordando de
 * novo. E a arquitetura emocional da direcao §4 comprimida num expediente.
 */

export type Ambience = {
  crowd: { src: AudioBufferSourceNode; gain: GainNode; lp: BiquadFilterNode } | null;
  fan: { osc: OscillatorNode; gain: GainNode } | null;
  nextChatter: number;
};

export const createAmbience = (): Ambience => ({ crowd: null, fan: null, nextChatter: 0 });

export const startAmbience = (a: Ambience, mix: Mixer): void => {
  if (a.crowd) return;
  const ctx = mix.ctx;

  const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < d.length; i++) {
    // Ruido "rosa de pobre": passa-baixa de um polo sobre branco. Suficiente.
    last = last * 0.94 + (Math.random() * 2 - 1) * 0.06;
    d[i] = last * 3;
  }
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 500;
  const gain = ctx.createGain();
  gain.gain.value = 0.5;
  src.connect(lp).connect(gain).connect(mix.buses.ambience);
  src.start();
  a.crowd = { src, gain, lp };

  // A ventoinha em RE (uma oitava sob o baixo): drone quase subliminar.
  const osc = ctx.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.value = hz(D2 - 12);
  const fanLp = ctx.createBiquadFilter();
  fanLp.type = 'lowpass';
  fanLp.frequency.value = 130;
  const fanGain = ctx.createGain();
  fanGain.gain.value = 0.35;
  osc.connect(fanLp).connect(fanGain).connect(mix.buses.ambience);
  osc.start();
  a.fan = { osc, gain: fanGain };
};

/** O arco do dia: multidao cede a madrugada e volta na reta final. */
export const stepAmbience = (a: Ambience, mix: Mixer, clock01: number): void => {
  if (!a.crowd) return;
  const mid = 1 - Math.abs(clock01 - 0.55) / 0.45; // 1 no meio da "noite"
  const crowdLevel = 0.55 - Math.max(0, mid) * 0.4;
  a.crowd.gain.gain.setTargetAtTime(Math.max(0.12, crowdLevel), mix.ctx.currentTime, 1.2);

  // Balbucio distante ocasional: um blip filtrado, nunca palavras.
  const now = mix.ctx.currentTime;
  if (now >= a.nextChatter && crowdLevel > 0.3) {
    a.nextChatter = now + 4 + Math.random() * 9;
    const o = mix.ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(180 + Math.random() * 140, now);
    o.frequency.linearRampToValueAtTime(140 + Math.random() * 100, now + 0.3);
    const g = mix.ctx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.linearRampToValueAtTime(0.05, now + 0.08);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.4);
    const p = mix.ctx.createStereoPanner();
    p.pan.value = Math.random() * 1.4 - 0.7;
    o.connect(g).connect(p).connect(mix.buses.ambience);
    o.start(now);
    o.stop(now + 0.45);
  }
};

export const stopAmbience = (a: Ambience): void => {
  a.crowd?.src.stop();
  a.fan?.osc.stop();
  a.crowd = null;
  a.fan = null;
};
