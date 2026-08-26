import { CIRCUIT, HACK_TICKS, JUNIOR_GROWN_AT, RUN_BUDGET, SHIP_IT_WINDOW, nextLockedEvent, rollRivalName } from '../sim/index.js';
import type { Candidate, CircuitEventId, CircuitEventSpec } from '../sim/gen.js';
import type { HackState, Outcome } from '../sim/types.js';

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

/**
 * UMA LINHA do historico: o suficiente para a Central contar a jornada —
 * "quase bati meu rival", "faltou um podio para o Nacional".
 */
export type RunRecord = {
  /** Dia UTC do fechamento (o unico relogio da carreira). */
  date: string;
  mode: Mode;
  outcome: Outcome;
  score: number;
  /** O palco do circuito (null = quick/daily). */
  eventId: CircuitEventId | null;
  rival: { score: number; beat: boolean } | null;
};

export type Career = {
  wallet: number;
  achievements: string[];
  /** Dia UTC em que cada conquista caiu (a galeria mostra a data). */
  achievedAt: Record<string, string>;
  runs: number;
  /** REPUTACAO: colocacoes somam, vexames descontam, sponsors exigem. */
  rep: number;
  rival: RivalState | null;
  /** Juniores que CRESCERAM em edicoes tuas: voltam como plenos. */
  alumni: Candidate[];
  /** Recordes: a melhor nota e a melhor colocacao de todas as runs. */
  bestScore: number;
  bestOutcome: Outcome | null;
  /** As ultimas runs, da mais recente para tras (teto HISTORY_CAP). */
  history: RunRecord[];
  /** Colocacoes no podio (ou melhores) por palco do circuito. */
  circuitWins: Partial<Record<CircuitEventId, number>>;
  /** A temporada fechou: podio no Global COM o rival batido. */
  seasonWon: boolean;
};

const KEY = 'catathon-career';
const ALUMNI_CAP = 6;
const HISTORY_CAP = 12;

/** Ordem de "melhor colocacao" para o recorde (crashed e o fundo do poco). */
const OUTCOME_RANK: Record<string, number> = {
  crashed: 0,
  participacao: 1,
  mencao: 2,
  podio: 3,
  'grand-prize': 4,
};

const betterOutcome = (a: Outcome | null, b: Outcome): Outcome =>
  a === null || (OUTCOME_RANK[b] ?? 0) > (OUTCOME_RANK[a] ?? 0) ? b : a;

const FRESH: Career = {
  wallet: RUN_BUDGET,
  achievements: [],
  achievedAt: {},
  runs: 0,
  rep: 0,
  rival: null,
  alumni: [],
  bestScore: 0,
  bestOutcome: null,
  history: [],
  circuitWins: {},
  seasonWon: false,
};

export const loadCareer = (): Career => {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const c = JSON.parse(raw) as Partial<Career>;
      return {
        wallet: Math.max(RUN_BUDGET, (c.wallet ?? RUN_BUDGET) | 0),
        achievements: Array.isArray(c.achievements) ? c.achievements : [],
        achievedAt: c.achievedAt && typeof c.achievedAt === 'object' ? c.achievedAt : {},
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
        bestScore: Math.max(0, (c.bestScore ?? 0) | 0),
        bestOutcome: typeof c.bestOutcome === 'string' ? (c.bestOutcome as Outcome) : null,
        history: Array.isArray(c.history) ? (c.history as RunRecord[]).slice(0, HISTORY_CAP) : [],
        circuitWins: c.circuitWins && typeof c.circuitWins === 'object' ? c.circuitWins : {},
        seasonWon: c.seasonWon === true,
      };
    }
  } catch {
    // storage indisponivel ou corrompido: carreira nova, jogo igual
  }
  return { ...FRESH, achievedAt: {}, achievements: [], alumni: [], history: [], circuitWins: {} };
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
  // Stretch Sprint: parar cedo com estilo, esticar ate o talo, e o ovo.
  if (state.sprint.frozenAt >= 0 && state.sprint.frozenAt <= HACK_TICKS * 0.75 && placed) out.push('early-bird');
  if (state.sprint.done >= 3 && placed) out.push('overclock');
  if (state.sprint.offers.some((o) => o.kind === 'easter-egg-felino' && o.status === 'done')) out.push('egg-hunter');
  return out;
};

/**
 * A GALERIA: todas as conquistas do jogo, na ordem da vitrine. `secret`
 * esconde nome e condicao ate cair — surpresa e parte da recompensa.
 */
export const ACHIEVEMENTS_ALL: readonly { id: string; secret: boolean }[] = [
  { id: 'zero-bugs', secret: false },
  { id: 'ship-it', secret: false },
  { id: 'scope-social', secret: false },
  { id: 'no-touchy', secret: false },
  { id: 'standing-ovation', secret: false },
  { id: 'orange-crew', secret: false },
  { id: 'improv-legend', secret: true },
  { id: 'grand', secret: false },
  { id: 'early-bird', secret: false },
  { id: 'overclock', secret: false },
  { id: 'egg-hunter', secret: true },
];

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
  /** A reputacao CRUZOU um gate: classificado para este palco do circuito. */
  qualified: CircuitEventId | null;
  /** Recorde pessoal de nota quebrado NESTA run. */
  newBest: boolean;
  /** A temporada fechou AGORA: podio no Global com o rival batido. */
  seasonWonNow: boolean;
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
  opts: {
    mode: Mode;
    spent: number;
    hired: readonly Candidate[];
    rivalScore: number | null;
    /** O palco do circuito desta run (carreira; null fora dele). */
    event?: CircuitEventSpec | null;
  }
): RunClose => {
  const r = state.result!;
  const today = todayUTC();
  const unlocked = achievementsFor(state);
  const fresh = unlocked.filter((a) => !career.achievements.includes(a));
  career.achievements.push(...fresh);
  for (const a of fresh) career.achievedAt[a] = today;
  career.runs++;

  const close: RunClose = {
    newAchievements: fresh,
    wallet: null,
    repBefore: career.rep,
    repAfter: career.rep,
    rival: null,
    graduates: [],
    poachedStar: null,
    qualified: null,
    newBest: false,
    seasonWonNow: false,
  };

  // RECORDES e HISTORICO valem em todo modo: a Central conta a jornada
  // inteira, e o "seu recorde" do daily nasce daqui.
  if (r.score > career.bestScore) {
    career.bestScore = r.score;
    close.newBest = true;
  }
  career.bestOutcome = betterOutcome(career.bestOutcome, r.outcome);

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
    // O gate que a reputacao NOVA abriu e a antiga nao abria: classificado.
    const lockedBefore = nextLockedEvent(career.rep);
    career.rep = Math.max(0, rep);
    close.repAfter = career.rep;
    if (lockedBefore && career.rep >= lockedBefore.repGate) close.qualified = lockedBefore.id;

    // O CIRCUITO lembra dos podios por palco — e a temporada fecha quando o
    // Global cai COM o rival batido no mesmo palco.
    const event = opts.event ?? null;
    const placed = r.outcome === 'podio' || r.outcome === 'grand-prize';
    if (event && placed) {
      career.circuitWins[event.id] = (career.circuitWins[event.id] ?? 0) + 1;
      if (event.id === 'global' && close.rival?.beat && !career.seasonWon) {
        career.seasonWon = true;
        close.seasonWonNow = true;
      }
    }
  }

  // O HISTORICO guarda a run em qualquer modo (o daily compara consigo).
  career.history.unshift({
    date: today,
    mode: opts.mode,
    outcome: r.outcome,
    score: r.score,
    eventId: opts.mode === 'career' ? (opts.event?.id ?? null) : null,
    rival: close.rival ? { score: close.rival.score, beat: close.rival.beat } : null,
  });
  while (career.history.length > HISTORY_CAP) career.history.pop();

  saveCareer(career);
  return close;
};

/** Os palcos da temporada com o estado de cada um, para a Central. */
export const circuitLadder = (
  career: Career
): { spec: CircuitEventSpec; unlocked: boolean; wins: number; current: boolean }[] => {
  const currentId = CIRCUIT.filter((ev) => career.rep >= ev.repGate).at(-1)?.id;
  return CIRCUIT.map((spec) => ({
    spec,
    unlocked: career.rep >= spec.repGate,
    wins: career.circuitWins[spec.id] ?? 0,
    current: spec.id === currentId,
  }));
};

/** A semente do DAILY vem do dia UTC — unica leitura de relogio do modo. */
export const todayUTC = (): string => new Date().toISOString().slice(0, 10);
