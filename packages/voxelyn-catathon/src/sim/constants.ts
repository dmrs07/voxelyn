/**
 * Os numeros do Catathon, com o porque de cada um.
 *
 * A regra de tuning veio de uma licao paga no Livro II da Iliada: uma partida
 * tem de saber SER PERDIDA e ser vencida, e as duas coisas se provam por teste
 * jogando a simulacao — nao inspecionando constantes. Os valores abaixo foram
 * ajustados ate os dois lados passarem com folga.
 */

export const TICK_HZ = 30;
export const TICK_MS = 1000 / TICK_HZ;

/** 8 minutos reais = 48 horas de hackathon. */
export const HACK_TICKS = TICK_HZ * 480;

/** Horas ficticias por tick, para o relogio do palco. */
export const HOURS_PER_TICK = 48 / HACK_TICKS;

// ----------------------------------------------------------------- energia

/** Trabalhar drena a energia inteira em ~90s. */
export const ENERGY_WORK_DRAIN = 1 / (90 * TICK_HZ);
export const ENERGY_IDLE_DRAIN = ENERGY_WORK_DRAIN / 4;
/** Abaixo disto o gato larga tudo e vai dormir. Nao e desobediencia: e gato. */
export const ENERGY_NAP_AT = 0.15;
export const ENERGY_NAP_TO = 0.9;
/** Soneca padrao: ~18s. A caixa do Smoking e mais rapida (mania dele). */
export const ENERGY_NAP_RATE = ENERGY_NAP_TO / (18 * TICK_HZ);
export const QUIRK_BOX_NAP_SCALE = 1.4;
export const ENERGY_PET_RATE = 0.004;

// -------------------------------------------------------------------- fome

/** A fome esvazia em ~150s: duas idas ao balcao por partida, mais ou menos. */
export const HUNGER_DRAIN = 1 / (150 * TICK_HZ);
export const HUNGER_EAT_AT = 0.22;
export const EAT_TICKS = 8 * TICK_HZ;

// ---------------------------------------------------------------- estresse

/** Trabalhando, o estresse enche em ~55s. E o metronomo do jogo. */
export const STRESS_WORK_RATE = 1 / (55 * TICK_HZ);
export const STRESS_IDLE_RATE = 1 / (80 * TICK_HZ);
/** O Almofada e calmo: metade. O Smoking sofre com bug vivo: 1.5x. */
export const CALM_SCALE = 0.5;
export const JUDGE_BUG_SCALE = 1.5;
export const TERRITORIAL_DISPLACED = 0.25;
export const GRABBED_FROM_NAP = 0.2;
/** Acima daqui, cada tick rola o dado do desastre. */
export const STRESS_DANGER = 0.8;
export const STRESS_PROC_P = 0.004;
export const STRESS_AFTER_PROC = 0.15;
export const STRESS_PET_RATE = 0.02;
export const STRESS_TREAT_DROP = 0.35;

// ----------------------------------------------------------------- trabalho

/** Uma feature core: 48s de especialista. */
export const TASK_CORE_COST = 48 * TICK_HZ;
export const TASK_POLISH_COST = 30 * TICK_HZ;
/** Fora da especialidade rende isto. O Bigode em CSS rende MENOS (ele recusa). */
export const OFFSPEC_SPEED = 0.45;
export const BIGODE_CSS_SPEED = 0.2;
/** Cowboy: mais rapido, e shipa sem testar (ver probabilidades abaixo). */
export const COWBOY_SPEED = 1.25;
export const COWBOY_BUG_P = 0.35;
export const COWBOY_SHORTCUT_P = 0.12;
export const SHORTCUT_HEADSTART = 0.3;
/** Consertar um bug: 20s. Bugs BLOQUEIAM a trilha ate sair. */
export const BUG_COST = 20 * TICK_HZ;

// ------------------------------------------------------------------ eventos

export const ZOOMIES_TICKS = 4 * TICK_HZ;
export const KEYBOARD_TICKS = Math.round(3.5 * TICK_HZ);
export const ZOOMIES_SPEED = 5.4;
export const WALK_SPEED = 1.9;
/** Fora da mesa, o proc do Cheeto e mordida no cabo com esta chance. */
export const CABLE_BITE_P = 0.5;
/** Religar o cabo: 6s de qualquer gato no rack. Sem prazo: fica caido ate. */
export const CABLE_FIX_COST = 6 * TICK_HZ;

// ----------------------------------------------------------------- hairball

export const HAIRBALL_AT = [0.3, 0.68] as const;
export const HAIRBALL_JITTER_TICKS = 10 * TICK_HZ;
export const HAIRBALL_WINDOW = 50 * TICK_HZ;
export const HAIRBALL_COST = 12 * TICK_HZ;

// --------------------------------------------------------------------- demo

export const TREATS_START = 3;
/** Von Whiskers (arquitetura). */
export const SCORE_CORE = 10;
export const SCORE_LOOSE_END = -5;
/** Meowper (estabilidade): base cheia, cada bug morde, zero bugs premia. */
export const SCORE_STABILITY_BASE = 12;
export const SCORE_BUG_PENALTY = -7;
export const SCORE_ZERO_BUG_BONUS = 6;
/** Cocada (experiencia). */
export const SCORE_POLISH = 6;
export const SCORE_DESIGN_DONE_BONUS = 6;
export const CRASH_PER_BUG = 0.16;
export const CRASH_CABLE_OUT = 0.35;
/** Cortes. Maximo teorico ~128; grand prize e mastery, nao rotina. */
export const CUT_GRAND = 96;
export const CUT_PODIUM = 62;
export const CUT_MENTION = 30;

// -------------------------------------------------------------------- hash

export const HASH_POS = 10;
export const HASH_METER = 1000;
