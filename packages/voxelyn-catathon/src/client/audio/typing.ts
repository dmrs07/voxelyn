import type { HackState } from '../../sim/types.js';
import { clack } from './voices.js';
import { panOf, type Mixer } from './mixer.js';

/**
 * DIGITACAO PROCEDURAL (direcao §7): nada de loop gravado. Cada gato digita
 * como quem e, e o som conta o estado sem HUD:
 *
 *  - Bigode digita FIRME e regular (senior): cadencia estavel, teclado grave.
 *  - Cheeto digita em RAJADAS com silencio longo (cowboy): dez teclas, pausa.
 *  - Almofada digita LENTO e pesado (patas enormes): teclas graves, espacadas.
 *  - Smoking digita moderado com pausas de cabeca inclinada.
 *
 * A energia arrasta a cadencia: gato cansado digita mais devagar — audivel
 * antes de qualquer barra aparecer. Build travado silencia todo mundo: nao ha
 * o que digitar contra um repositorio que nao compila (e o silencio subito e o
 * proprio aviso).
 */

type Style = { rate: number; freq: number; burst: number; rest: number };

const STYLES: Record<string, Style> = {
  bigode: { rate: 7, freq: 2200, burst: 999, rest: 0 },
  cheeto: { rate: 13, freq: 2800, burst: 10, rest: 1.1 },
  almofada: { rate: 3.4, freq: 1500, burst: 999, rest: 0 },
  smoking: { rate: 6, freq: 2500, burst: 14, rest: 0.55 },
};

export type Typing = {
  next: Record<string, number>;
  burstLeft: Record<string, number>;
};

export const createTyping = (): Typing => ({ next: {}, burstLeft: {} });

export const stepTyping = (t: Typing, mix: Mixer, state: HackState, nowS: number): void => {
  const silenced = state.hairball.active || state.cableOut || state.buildBroken;
  for (const cat of state.cats) {
    if (cat.mode !== 'work' || cat.slot === 'rack' || silenced) continue;
    const s = STYLES[cat.id];
    const due = t.next[cat.id] ?? 0;
    if (nowS < due) continue;
    let left = t.burstLeft[cat.id] ?? s.burst;
    if (left <= 0) {
      t.burstLeft[cat.id] = s.burst;
      t.next[cat.id] = nowS + s.rest * (0.8 + Math.random() * 0.5);
      continue;
    }
    // Cansaco desacelera os dedos; e o unico acoplamento com medidor, e e
    // proposital: da para OUVIR quem precisa de petisco.
    const pace = s.rate * (0.55 + cat.energy * 0.6);
    clack(mix, mix.ctx.currentTime, panOf(cat.x), s.freq, 0.75 + Math.random() * 0.4);
    t.burstLeft[cat.id] = left - 1;
    t.next[cat.id] = nowS + (1 / pace) * (0.75 + Math.random() * 0.55);
  }
};
