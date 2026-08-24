import type { DemoResult, HackState, SimEvent } from '../../sim/types.js';
import { D2, D3, D4, MOTIF, SHIP_NOTES, hz } from './theory.js';
import { bass, epiano, felt, ping, pluck, rim, spinDown, thunk, wood } from './voices.js';
import { duck, panOf, type Mixer } from './mixer.js';
import { SLOTS } from '../../sim/index.js';

/**
 * OS EVENTOS COMO MUSICA (direcao §8-9). A regra unica: tudo soa DENTRO de re
 * maior, e o erro nunca e buzina — e intervalo suspenso, madeira descendo,
 * ritmo que tropeca. A comedia vem do TIMING (a pausa suspeita antes da
 * caneca cair), nunca do volume.
 */

const deskPan = (track: string): number => {
  const slot = SLOTS.find((s) => s.track === track);
  return slot ? panOf(slot.x) : 0;
};

/** Ship: o "pop" melodico no timbre da disciplina, vindo DA MESA (pan). */
const shipSound = (mix: Mixer, track: keyof typeof SHIP_NOTES): void => {
  const def = SHIP_NOTES[track];
  const t = mix.ctx.currentTime + 0.02;
  const pan = deskPan(track);
  def.midi.forEach((n, i) => {
    if (def.voice === 'bass') bass(mix, n, t + i * 0.07, 0.5);
    else if (def.voice === 'chime') epiano(mix, n + 12, t + i * 0.09, 0.5);
    else if (def.voice === 'click') wood(mix, n, t + i * 0.05, 0.6);
    else pluck(mix, n, t + i * 0.06, 0.6);
  });
  void pan;
};

/** Bug: tres notas de madeira descendo + chocalho breve. Nunca um alarme. */
const bugSound = (mix: Mixer): void => {
  const t = mix.ctx.currentTime + 0.02;
  [D4, D4 - 2, D4 - 5].forEach((n, i) => wood(mix, n, t + i * 0.11, 0.55));
  rim(mix, t + 0.42, 0.4);
};

/**
 * MERGE CONFLICT (direcao §9): dois padroes compativeis comecam, sobrepoem
 * ERRADO (meio passo fora), dao um no ritmico e um "clack" de madeira fecha.
 * A piada e legivel de olhos fechados antes do card aparecer.
 */
const hairballSound = (mix: Mixer): void => {
  const t = mix.ctx.currentTime + 0.02;
  const a = [D4, D4 + 4, D4 + 7];
  a.forEach((n, i) => pluck(mix, n, t + i * 0.14, 0.55));
  a.forEach((n, i) => pluck(mix, n + 1, t + 0.07 + i * 0.14, 0.5));
  wood(mix, D3 - 2, t + 0.58, 0.7);
  duck(mix);
};

/** Cabo mordido: estica, "pip" eletrico, ventoinha perde a confianca. */
const cableSound = (mix: Mixer): void => {
  const t = mix.ctx.currentTime + 0.02;
  const o = mix.ctx.createOscillator();
  o.type = 'sawtooth';
  o.frequency.setValueAtTime(hz(D3), t);
  o.frequency.linearRampToValueAtTime(hz(D3 - 5), t + 0.22);
  const g = mix.ctx.createGain();
  g.gain.setValueAtTime(0.12, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.24);
  o.connect(g).connect(mix.buses.sfx);
  o.start(t);
  o.stop(t + 0.26);
  ping(mix, D4 + 19, t + 0.26, 0.4);
  spinDown(mix, t + 0.4);
  duck(mix);
};

/** Religou: a sequencia mecanica resolve num acorde "menta" com sub quente. */
const fixedSound = (mix: Mixer): void => {
  const t = mix.ctx.currentTime + 0.02;
  [D4, D4 + 7, D4 + 9, D4 + 14].forEach((n, i) => pluck(mix, n, t + i * 0.05, 0.5));
  bass(mix, D2 + 12, t + 0.24, 0.5);
};

/** O build QUEBROU de vez: um elemento cai do tempo, para sem resolver, thunk. */
const brokenSound = (mix: Mixer): void => {
  const t = mix.ctx.currentTime + 0.02;
  pluck(mix, D4, t, 0.5);
  pluck(mix, D4 + 4, t + 0.15, 0.5);
  pluck(mix, D4 + 5, t + 0.34, 0.4); // fora do lugar, sem terca
  thunk(mix, t + 0.62);
  spinDown(mix, t + 0.7);
  duck(mix);
};

/** Corte de escopo: papel desliza, dobra macia. Decisao, nao derrota. */
const cutSound = (mix: Mixer): void => {
  const t = mix.ctx.currentTime + 0.02;
  wood(mix, D4 + 5, t, 0.4);
  wood(mix, D4, t + 0.09, 0.35);
};

const treatSound = (mix: Mixer): void => {
  const t = mix.ctx.currentTime + 0.02;
  pluck(mix, D4 + 7, t, 0.5);
  pluck(mix, D4 + 12, t + 0.08, 0.55);
};

/**
 * O RITUAL DA SUBMISSAO (direcao §7), o momento mais satisfatorio do jogo:
 * silencio de digitacao (o chamador congela a musica), pacotes clicam,
 * transferencias SOBEM espacialmente, pausa de tensao... e ou o acorde quente
 * com a celebracao, ou o tropeço e o thunk — decidido pela simulacao, aqui so
 * contado.
 */
export const submissionRitual = (mix: Mixer, result: DemoResult, onDone: () => void): void => {
  const t = mix.ctx.currentTime + 0.15;
  // Pacotes.
  [0, 0.12, 0.22].forEach((dt, i) => wood(mix, D3 + i * 2, t + dt, 0.45));
  // Transferencias sobem, viajando da esquerda para a direita (o rack e a direita).
  [D3 + 12, D3 + 16, D3 + 19, D3 + 24].forEach((n, i) => ping(mix, n, t + 0.5 + i * 0.22, -0.6 + i * 0.4));
  // A pausa. O jogo inteiro prende a respiracao aqui.
  const decision = t + 0.5 + 4 * 0.22 + 0.65;
  if (result.crashed) {
    pluck(mix, D4 + 5, decision, 0.5);
    thunk(mix, decision + 0.25);
    spinDown(mix, decision + 0.3);
  } else {
    // O acorde da chegada: Dmaj9 quente, sub embaixo, motivo por cima.
    [D3, D3 + 4, D3 + 7, D3 + 11, D3 + 16].forEach((n, i) => epiano(mix, n, decision + i * 0.02, 0.6));
    bass(mix, D2, decision, 0.7);
    MOTIF.forEach((n, i) => pluck(mix, n + 12, decision + 0.5 + i * 0.16, 0.6));
  }
  window.setTimeout(onDone, (decision - mix.ctx.currentTime + 1.2) * 1000);
};

/** Roteia um evento da simulacao para o som. Devolve true se era critico. */
export const playEvent = (mix: Mixer, state: HackState, e: SimEvent): boolean => {
  switch (e.kind) {
    case 'ship':
    case 'shortcut':
      shipSound(mix, (e.kind === 'ship' ? e.track : 'frontend') as keyof typeof SHIP_NOTES);
      return false;
    case 'await-ship': {
      // A pergunta do perfeccionista: duas notas suspensas, sem resolucao.
      const t = mix.ctx.currentTime + 0.02;
      epiano(mix, D4 + 7, t, 0.45);
      epiano(mix, D4 + 5, t + 0.28, 0.45);
      return false;
    }
    case 'bug':
      bugSound(mix);
      return false;
    case 'bugfix':
      fixedSound(mix);
      return false;
    case 'hairball':
      hairballSound(mix);
      return true;
    case 'cable':
      cableSound(mix);
      return true;
    case 'hairball-fixed':
    case 'cable-fixed':
      fixedSound(mix);
      return false;
    case 'build-broken':
      brokenSound(mix);
      return true;
    case 'cut':
      cutSound(mix);
      return false;
    case 'treat':
      treatSound(mix);
      return false;
    case 'eat': {
      const t = mix.ctx.currentTime;
      [0, 0.14, 0.26].forEach((dt) => rim(mix, t + dt, 0.25));
      return false;
    }
    default:
      return false;
  }
};
