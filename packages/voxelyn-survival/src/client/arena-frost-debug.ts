// OS CENARIOS DE CONGELAMENTO DA ARENA — e so da arena.
//
// A ferramenta de playtest precisa chegar a cada estado do medidor sem
// esperar tres Novas: uma dose, duas, quase cheio, congelado agora, arma
// quente, o parceiro em outro nivel, um Espectro pronto para o bote. Tudo
// aqui mexe no estado AUTORITATIVO pelas mesmas funcoes que a simulacao usa
// (`applyFreezeDose`, `spawnEnemy`), nunca por um caminho paralelo — o que a
// arena mostra e o que a run mostraria.
//
// Nada disto e importado por `main.ts`: a arena e a porta, e a unica.
import {
  FREEZE_DECAY_INTERVAL_TICKS,
  FREEZE_DECAY_PER_INTERVAL,
  FREEZE_MAX,
  FREEZE_QUEEN_DOSE,
  HEAT_MAX,
  LURKER_HIDDEN,
  applyFreezeDose,
  clearFreeze,
  freezeFraction,
  spawnEnemy,
} from '@voxelyn/survival-sim';
import type { SemanticEvent, SurvivalState } from '@voxelyn/survival-sim';

export type FrostScenario =
  | 'clear'
  | 'queen'
  | 'queen2'
  | 'nearFull'
  | 'frostbite'
  | 'hotWeapon'
  | 'wraith'
  | 'partnerHalf';

/** Os cenarios, na ordem do painel. Os rotulos vivem em `arena-main.ts`. */
export const FROST_SCENARIOS: readonly FrostScenario[] = [
  'clear',
  'queen',
  'queen2',
  'nearFull',
  'frostbite',
  'hotWeapon',
  'wraith',
  'partnerHalf',
];

/** Quantas vezes mais rapido o decaimento corre com o controle de debug. */
export const FAST_DECAY_SCALE = 10;

/** Aplica um cenario ao estado. Devolve os eventos que a simulacao emitiria. */
export const applyFrostScenario = (
  state: SurvivalState,
  scenario: FrostScenario,
): SemanticEvent[] => {
  const events: SemanticEvent[] = [];
  const extra = state.playerExtras[0];
  switch (scenario) {
    case 'clear':
      clearFreeze(extra);
      break;
    case 'queen':
      applyFreezeDose(state, 0, FREEZE_QUEEN_DOSE, 'frost_queen', events);
      break;
    case 'queen2':
      applyFreezeDose(state, 0, FREEZE_QUEEN_DOSE, 'frost_queen', events);
      applyFreezeDose(state, 0, FREEZE_QUEEN_DOSE, 'frost_queen', events);
      break;
    case 'nearFull':
      clearFreeze(extra);
      applyFreezeDose(state, 0, 950, 'frost_queen', events);
      break;
    case 'frostbite':
      applyFreezeDose(state, 0, FREEZE_MAX, 'frost_queen', events);
      break;
    case 'hotWeapon':
      extra.heat = HEAT_MAX * 0.85;
      break;
    case 'wraith': {
      // A tres tiles, em diagonal (para nao nascer atras do parceiro): no gelo
      // ele vira nevoa no tick seguinte, e o bote sai assim que o relogio
      // permitir — materializacao, lanca, e a volta a nevoa, tudo a vista.
      const wraith = spawnEnemy(
        state,
        'frost_wraith',
        Math.floor(state.player.x) - 3,
        Math.floor(state.player.y) + 3,
        false,
      );
      wraith.alertedUntil = state.tick + 100_000;
      wraith.contactReadyAt = 0;
      break;
    }
    case 'partnerHalf': {
      const partner = state.playerExtras[1];
      if (!partner) break;
      clearFreeze(partner);
      applyFreezeDose(state, 1, Math.round(FREEZE_MAX * 0.6), 'frost_queen', events);
      break;
    }
  }
  return events;
};

/**
 * O decaimento ACELERADO do controle de debug: o mesmo passo da simulacao,
 * repetido `FAST_DECAY_SCALE - 1` vezes por tick — e com as mesmas regras
 * (nunca abaixo de zero, nunca sobre o latch, nunca na graca). Vive aqui e
 * nao na simulacao de proposito: a run normal nao tem este relogio.
 */
export const applyFastDecay = (state: SurvivalState): void => {
  for (const extra of state.playerExtras) {
    if (extra.frostbitten || extra.freeze <= 0 || state.tick <= extra.freezeGraceUntil) continue;
    if (state.tick % FREEZE_DECAY_INTERVAL_TICKS !== 0) continue;
    extra.freeze = Math.max(0, extra.freeze - FREEZE_DECAY_PER_INTERVAL * (FAST_DECAY_SCALE - 1));
  }
};

export type FrostReadout = {
  freeze: number;
  percent: number;
  frostbitten: boolean;
  /** Pontos percentuais por segundo, com o controle de debug incluido. */
  decayPerSecond: number;
  /** Ha quantos ticks entrou a ultima dose (a graca conta a partir dela). */
  lastDoseTicksAgo: number | null;
  heat: number;
  overheatLockTicks: number;
  nextCycleInTicks: number;
  partner: { freeze: number; frostbitten: boolean } | null;
  wraiths: { total: number; hidden: number };
};

export const arenaFrostReadout = (state: SurvivalState, fastDecay: boolean): FrostReadout => {
  const extra = state.playerExtras[0];
  const partner = state.playerExtras[1];
  const decaying = !extra.frostbitten && extra.freeze > 0 && state.tick > extra.freezeGraceUntil;
  const perTick = FREEZE_DECAY_PER_INTERVAL / FREEZE_DECAY_INTERVAL_TICKS;
  const wraiths = state.enemies.filter((e) => e.alive && e.archetype === 'frost_wraith');
  return {
    freeze: extra.freeze,
    percent: Math.round(freezeFraction(extra) * 100),
    frostbitten: extra.frostbitten,
    decayPerSecond: decaying
      ? ((perTick * 20) / FREEZE_MAX) * 100 * (fastDecay ? FAST_DECAY_SCALE : 1)
      : 0,
    lastDoseTicksAgo:
      extra.freezeGraceUntil > 0 ? state.tick - (extra.freezeGraceUntil - 40) : null,
    heat: Math.round(extra.heat),
    overheatLockTicks: Math.max(0, extra.overheatedUntil - state.tick),
    nextCycleInTicks: extra.frostbitten ? Math.max(0, extra.thermalCycleReadyAt - state.tick) : 0,
    partner:
      partner && partner.joined
        ? { freeze: partner.freeze, frostbitten: partner.frostbitten }
        : null,
    wraiths: {
      total: wraiths.length,
      hidden: wraiths.filter((w) => w.mood === LURKER_HIDDEN).length,
    },
  };
};
