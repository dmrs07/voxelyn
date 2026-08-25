import { HACK_TICKS, JUNIOR_GROWN_AT, RUN_BUDGET, SHIP_IT_WINDOW, rollRivalName } from '../sim/index.js';
import type { Candidate } from '../sim/gen.js';
import type { HackState } from '../sim/types.js';

export type Mode = 'career' | 'quick' | 'daily';

/**
 * A CARREIRA, do lado do cliente: a sim continua pura — o que persiste entre
 * runs (carteira, conquistas, REPUTACAO, o RIVAL, os ALUMNI) mora no
 * localStorage do jogador e volta para a proxima run como ENTRADA (candidato
 * que retorna, oferta de sponsor, skill do rival). O Slice D e isso:
 * consequencias atravessam hackathons sem a sim jamais saber de relogio.
 *
 * - CARREIRA: carteira persiste (piso RUN_BUDGET — acumular e para CIMA do
 *   minimo); reputacao abre sponsors; o rival evolui; juniores crescidos
 *   voltam como plenos.
 * - QUICK RUN / DAILY: nada persiste alem das conquistas — a comparacao
 *   justa do daily nao pode depender da tua reputacao.
 */

export type RivalState = {
  name: string;
  /** 0+ : cada derrota TUA os deixa mais confiantes; vence-los abala. */
  skill: number;
  wins: number;
  losses: number;
  /** Gatos teus que eles levaram (poach aceito): nomes no telao deles. */
  roster: string[];
};

export type Career = {
  wallet: number;
  achievements: string[];
  runs: number;
  /** REPUTACAO: colocacoes somam, vexames descontam, sponsors exigem. */
  rep: number;
  rival: RivalState | null;
  /** Juniores que CRESCERAM em edicoes tuas: voltam como plenos. */
  alumni: Candidate[];
};

const KEY = 'catathon-career';
const ALUMNI_CAP = 6;

export const loadCareer = (): Career => {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const c = JSON.parse(raw) as Partial<Career>;
      return {
        wallet: Math.max(RUN_BUDGET, (c.wallet ?? RUN_BUDGET) | 0),
        achievements: Array.isArray(c.achievements) ? c.achievements : [],
        runs: (c.runs ?? 0) | 0,
        rep: Math.max(0, (c.rep ?? 0) | 0),
        rival: c.rival && typeof c.rival.name === 'string'
          ? {
              name: c.rival.name,
              skill: Math.max(0, Number(c.rival.skill) || 0),
              wins: (c.rival.wins ?? 0) | 0,
              losses: (c.rival.losses ?? 0) | 0,
              roster: Array.isArray(c.rival.roster) ? c.rival.roster : [],
            }
          : null,
        alumni: Array.isArray(c.alumni) ? (c.alumni as Candidate[]) : [],
      };
    }
  } catch {
    // storage indisponivel ou corrompido: carreira nova, jogo igual
  }
  return { wallet: RUN_BUDGET, achievements: [], runs: 0, rep: 0, rival: null, alumni: [] };
};

export const saveCareer = (c: Career): void => {
  try {
    localStorage.setItem(KEY, JSON.stringify(c));
  } catch {
    // sem storage nao e sem jogo
  }
};

/** O rival nasce na PRIMEIRA edicao de carreira e nunca vai embora. */
export const ensureRival = (career: Career, seed: number): RivalState => {
  if (!career.rival) {
    career.rival = { name: rollRivalName(seed), skill: 0, wins: 0, losses: 0, roster: [] };
    saveCareer(career);
  }
  return career.rival;
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

/** O que o FECHAMENTO de uma edicao devolve para a tela de resultado. */
export type RunClose = {
  newAchievements: string[];
  wallet: number | null;
  repBefore: number;
  repAfter: number;
  /** O duelo com o rival (so na carreira): a nota deles ja veio pronta. */
  rival: { name: string; score: number; beat: boolean } | null;
  /** Nomes dos juniores que cresceram (e entraram para os alumni). */
  graduates: string[];
  /** A estrela que o recrutador rival levou (poach aceito), se levou. */
  poachedStar: string | null;
};

/** Reputacao por colocacao: o telao lembra de quem sobe — e de quem crasha. */
const REP_BY_OUTCOME: Record<string, number> = {
  'grand-prize': 3,
  podio: 2,
  mencao: 1,
  participacao: 0,
  crashed: -1,
};

/**
 * FECHA A CONTA da edicao — conquistas em qualquer modo; carteira,
 * reputacao, rival e alumni SO na carreira. Recebe a nota do rival ja
 * computada (funcao pura da semente + o skill de ANTES da run) para nao
 * misturar leitura e escrita do estado persistente.
 */
export const applyRun = (
  career: Career,
  state: HackState,
  opts: { mode: Mode; spent: number; hired: readonly Candidate[]; rivalScore: number | null }
): RunClose => {
  const r = state.result!;
  const unlocked = achievementsFor(state);
  const fresh = unlocked.filter((a) => !career.achievements.includes(a));
  career.achievements.push(...fresh);
  career.runs++;

  const close: RunClose = {
    newAchievements: fresh,
    wallet: null,
    repBefore: career.rep,
    repAfter: career.rep,
    rival: null,
    graduates: [],
    poachedStar: null,
  };

  if (opts.mode === 'career') {
    career.wallet = Math.max(RUN_BUDGET, career.wallet - opts.spent + r.prize);
    close.wallet = career.wallet;

    // ALUMNI: cada junior contratado que cresceu vira candidato de retorno.
    for (const cat of state.cats) {
      if (cat.tier !== 'junior' || cat.learned < JUNIOR_GROWN_AT) continue;
      const snapshot = opts.hired.find((h) => h.id === cat.id);
      if (!snapshot || career.alumni.some((a) => a.id === snapshot.id)) continue;
      career.alumni.push(snapshot);
      while (career.alumni.length > ALUMNI_CAP) career.alumni.shift();
      close.graduates.push(cat.name);
    }

    // O DUELO: a nota do rival contra a tua. Demo crashada perde sempre.
    if (career.rival && opts.rivalScore !== null) {
      const beat = !r.crashed && r.score > opts.rivalScore;
      close.rival = { name: career.rival.name, score: opts.rivalScore, beat };
      if (beat) {
        career.rival.wins++;
        career.rival.skill = Math.max(0, career.rival.skill - 0.05);
      } else {
        career.rival.losses++;
        career.rival.skill += 0.1;
      }
    }

    // CONSEQUENCIA do poach aceito: a estrela abordada troca de telao — o
    // rival fica mais forte, e ela sai dos teus alumni (foi embora).
    const poach = state.events.find(
      (e) => e.kind === 'social-taken' && e.social === 'poach' && e.option === 'a'
    );
    if (poach && poach.kind === 'social-taken' && poach.star && career.rival) {
      const starName = state.cats.find((c) => c.id === poach.star)?.name ?? poach.star;
      close.poachedStar = starName;
      if (!career.rival.roster.includes(starName)) career.rival.roster.push(starName);
      career.rival.skill += 0.15;
      career.alumni = career.alumni.filter((a) => a.id !== poach.star);
      close.graduates = close.graduates.filter((g) => g !== starName);
    }

    // REPUTACAO: colocacao + vencer o rival + a vergonha do contrato furado.
    let rep = career.rep + (REP_BY_OUTCOME[r.outcome] ?? 0);
    if (close.rival?.beat) rep += 1;
    if (r.sponsorMet === false) rep -= 1;
    career.rep = Math.max(0, rep);
    close.repAfter = career.rep;
  }

  saveCareer(career);
  return close;
};

/** A semente do DAILY vem do dia UTC — unica leitura de relogio do modo. */
export const todayUTC = (): string => new Date().toISOString().slice(0, 10);
