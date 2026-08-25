import { HACK_TICKS, RUN_BUDGET, SHIP_IT_WINDOW } from '../sim/index.js';
import type { HackState } from '../sim/types.js';

/**
 * A CARREIRA, do lado do cliente: a sim continua pura — o que persiste entre
 * runs (carteira, conquistas) mora no localStorage do jogador, e o modo
 * decide o que entra e o que sai:
 *
 * - CARREIRA: a carteira persiste; o premio de cada edicao vira orcamento da
 *   proxima. Piso de RUN_BUDGET: a carreira nunca quebra — acumular e para
 *   CIMA do minimo, nunca para baixo (uma run impossivel nao e roguelite).
 * - QUICK RUN: orcamento fixo, nada persiste alem das conquistas.
 * - DAILY: a semente do dia (UTC), a mesma para todo mundo — comparar
 *   pontuacao vira conversa. Orcamento fixo.
 */

export type Mode = 'career' | 'quick' | 'daily';

export type Career = {
  wallet: number;
  achievements: string[];
  runs: number;
};

const KEY = 'catathon-career';

export const loadCareer = (): Career => {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const c = JSON.parse(raw) as Career;
      return {
        wallet: Math.max(RUN_BUDGET, c.wallet | 0),
        achievements: Array.isArray(c.achievements) ? c.achievements : [],
        runs: c.runs | 0,
      };
    }
  } catch {
    // storage indisponivel ou corrompido: carreira nova, jogo igual
  }
  return { wallet: RUN_BUDGET, achievements: [], runs: 0 };
};

export const saveCareer = (c: Career): void => {
  try {
    localStorage.setItem(KEY, JSON.stringify(c));
  } catch {
    // sem storage nao e sem jogo
  }
};

/**
 * As CONQUISTAS de uma run, lidas do estado final. Cada uma e checavel
 * mecanicamente — conquista que depende de interpretacao e enfeite.
 */
export const achievementsFor = (state: HackState): string[] => {
  const r = state.result;
  if (!r) return [];
  const out: string[] = [];
  const placed = r.outcome === 'podio' || r.outcome === 'grand-prize';
  if (r.bugs === 0 && !r.crashed) out.push('zero-bugs');
  if (state.events.some((e) => e.kind === 'ship' && e.tick >= HACK_TICKS - SHIP_IT_WINDOW)) out.push('ship-it');
  if (state.tasks.filter((t) => t.cut).length >= 4 && placed) out.push('scope-social');
  if (state.petSessions === 0 && placed) out.push('no-touchy');
  if (r.plateia >= 0.99) out.push('standing-ovation');
  if (state.cats.length > 0 && state.cats.every((c) => c.personality === 'cowboy')) out.push('orange-crew');
  if (r.improvised) out.push('improv-legend');
  if (r.outcome === 'grand-prize') out.push('grand');
  return out;
};

/** A semente do DAILY vem do dia UTC — unica leitura de relogio do modo. */
export const todayUTC = (): string => new Date().toISOString().slice(0, 10);
