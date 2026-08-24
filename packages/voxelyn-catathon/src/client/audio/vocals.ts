import type { CatId } from '../../sim/types.js';
import { panOf, type Mixer } from './mixer.js';

/**
 * AS VOZES DOS GATOS (direcao §6): expressivas, ESCASSAS.
 *
 * As regras de frequencia sao a diferenca entre fofo e insuportavel, entao
 * elas moram aqui como codigo e nao como boa intencao:
 *  - cooldown por gato (4s) e VAGA GLOBAL: dois gatos nunca vocalizam juntos
 *    (a excecao unica e a celebracao da vitoria, que e deliberada);
 *  - selecionar nem sempre mia (1 em 3 fica em silencio);
 *  - variacao de altura por chamada, para nunca soar sample repetido.
 *
 * Cada personalidade entrega diferente: o senior responde na hora, o gigante
 * calmo faz "mrrp" grave e atrasado, o ansioso trina curto e agudo — e o
 * laranja as vezes responde a uma interacao que NAO era com ele.
 */

type VocalProfile = {
  /** Frequencia base do trinado, Hz. */
  base: number;
  /** Velocidade da curva (s). Menor = mais imediato. */
  glide: number;
  /** Atraso ate responder (s). O sonolento demora. */
  delay: number;
  bend: number;
};

const PROFILES: Record<CatId, VocalProfile> = {
  bigode: { base: 560, glide: 0.1, delay: 0.02, bend: 1.3 },
  cheeto: { base: 700, glide: 0.07, delay: 0.0, bend: 1.5 },
  almofada: { base: 300, glide: 0.22, delay: 0.28, bend: 1.18 },
  smoking: { base: 500, glide: 0.09, delay: 0.08, bend: 1.24 },
};

export type Vocals = {
  lastByCat: Record<string, number>;
  globalUntil: number;
};

export const createVocals = (): Vocals => ({ lastByCat: {}, globalUntil: 0 });

const COOLDOWN_MS = 4000;

const trillAt = (mix: Mixer, cat: CatId, x: number, kind: 'chirp' | 'mrrp' | 'annoyed' | 'victory', when: number): void => {
  const p = PROFILES[cat];
  const o = mix.ctx.createOscillator();
  o.type = 'triangle';
  const jitter = 0.92 + Math.random() * 0.16;
  const f = p.base * jitter;
  const dur = kind === 'mrrp' ? 0.34 : kind === 'victory' ? 0.4 : 0.18;
  o.frequency.setValueAtTime(f, when);
  if (kind === 'annoyed') o.frequency.linearRampToValueAtTime(f * 0.8, when + dur);
  else o.frequency.exponentialRampToValueAtTime(f * p.bend, when + dur * 0.6);
  if (kind === 'victory') o.frequency.exponentialRampToValueAtTime(f * p.bend * 1.25, when + dur);

  // Formante felino: banda estreita da a garganta; sem ela e so um bip.
  const bp = mix.ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = f * 2.1;
  bp.Q.value = 1.6;
  const g = mix.ctx.createGain();
  g.gain.setValueAtTime(0.0001, when);
  g.gain.linearRampToValueAtTime(0.34, when + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
  const pan = mix.ctx.createStereoPanner();
  pan.pan.value = panOf(x);
  o.connect(bp).connect(g).connect(pan).connect(mix.buses.vocals);
  o.start(when);
  o.stop(when + dur + 0.05);
};

export const vocalize = (
  v: Vocals,
  mix: Mixer,
  cat: CatId,
  x: number,
  kind: 'chirp' | 'mrrp' | 'annoyed',
  nowMs: number
): void => {
  if (nowMs < v.globalUntil) return;
  if (nowMs - (v.lastByCat[cat] ?? -1e9) < COOLDOWN_MS) return;
  // Nem toda interacao mia: 1 em 3 fica no gesto.
  if (Math.random() < 0.33) return;
  v.lastByCat[cat] = nowMs;
  v.globalUntil = nowMs + 700;
  const p = PROFILES[cat];
  trillAt(mix, cat, x, kind === 'chirp' && cat === 'almofada' ? 'mrrp' : kind, mix.ctx.currentTime + p.delay);

  // O laranja responde a coisas que nao eram com ele. Uma em cada oito.
  if (cat !== 'cheeto' && Math.random() < 0.125 && nowMs - (v.lastByCat.cheeto ?? -1e9) > COOLDOWN_MS) {
    v.lastByCat.cheeto = nowMs + 600;
    trillAt(mix, 'cheeto', x, 'chirp', mix.ctx.currentTime + 0.75);
  }
};

/** A unica simultaneidade permitida: a equipe celebrando, escalonada. */
export const teamCelebration = (v: Vocals, mix: Mixer, xs: Record<CatId, number>): void => {
  const t = mix.ctx.currentTime + 0.05;
  (['bigode', 'cheeto', 'almofada', 'smoking'] as const).forEach((cat, i) => {
    trillAt(mix, cat, xs[cat], 'victory', t + i * 0.16);
  });
  v.globalUntil = performance.now() + 2500;
};
