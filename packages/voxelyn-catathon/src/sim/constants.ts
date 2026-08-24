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

// ---------------------------------------------------- carinho com memoria
//
// O EXPLOIT que esta secao mata: carinho recuperava energia, entao segurar o
// dedo substituia comida, sono e planejamento. Agora carinho so mexe em
// ESTRESSE e MORAL, tem memoria (sessoes seguidas rendem menos) e a terceira
// seguida SUPERESTIMULA — estresse sobe. O jogador aprende o ritmo de cada
// gato em vez de esfregar o dedo no mesmo botao.

/** A memoria do carinho: sem carinho por ~40s, o streak zera. */
export const PET_MEMORY_TICKS = 40 * TICK_HZ;
/** Moral por tick de carinho (primeira sessao). */
export const MORAL_PET_RATE = 0.012;
/** Streak 1 rende metade; streak >= 2 superestimula. */
export const PET_DECAY_SCALE = 0.5;
export const OVERPET_STRESS_RATE = 0.01;
/** Personalidade muda a resposta ao carinho (relevo, nao so numero). */
export const PET_PROFILE: Record<string, { stress: number; moral: number }> = {
  cowboy: { stress: 1.2, moral: 1.3 }, // o laranja e carente
  calmo: { stress: 0.6, moral: 0.7 }, // ja esta bem, obrigado
  perfeccionista: { stress: 1.0, moral: 1.0 },
  'julga-em-silencio': { stress: 1.0, moral: 1.3 }, // ser visto importa
};

// ------------------------------------------------------------------- moral

/** Moral manda na velocidade: de 0.85x (no fundo) a 1.1x (radiante). */
export const MORAL_SPEED_MIN = 0.85;
export const MORAL_SPEED_MAX = 1.1;
export const MORAL_SHIP_OWN = 0.1;
export const MORAL_SHIP_TEAM = 0.04;
/** Trabalhar exausto (energia < 0.3) corroi a moral. */
export const MORAL_OVERWORK_AT = 0.3;
export const MORAL_OVERWORK_RATE = 1 / (70 * TICK_HZ);
export const MORAL_DISPLACED = 0.12;
export const MORAL_TREAT = 0.08;

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

// ---------------------------------------------------------------- escolhas

/** Multiplicadores de custo das opcoes (aplicados UMA vez, na decisao). */
export const CHOICE_COST = {
  monolito: 0.8,
  micro: 1.25,
  microDownstream: 0.85,
  serverless: 0.7,
  sistemaPrimeiro: 1.3,
  sistemaDownstream: 0.75,
  componentesLocais: 0.85,
  templateSponsor: 0.6,
  pipelineCompleto: 1.25,
  deployNaMao: 0.7,
  presetSponsor: 0.8,
} as const;
/** Cada ponto de divida tecnica exposta morde a estabilidade na banca. */
export const SCORE_DEBT_PENALTY = -4;
export const SCORE_INNOVATION = 5;
export const SCORE_UX_CARE = 4;
export const SCORE_STABILITY_CHOICE = 4;
/** Escolha amarrada ao sponsor: a API dele PODE cair na demo. */
export const SPONSOR_RISK_CRASH = 0.12;
export const STABILITY_CRASH_RELIEF = 0.05;

// ------------------------------------------------------------------- pitch

/** 30 segundos de palco. Curto de proposito: pitch bom e pitch enxuto. */
export const PITCH_TICKS = 30 * TICK_HZ;
export const PITCH_GAUGE_START = 0.5;
/** Sem fazer nada, a plateia esfria ate ~0.1 no fim. */
export const PITCH_GAUGE_DECAY = 0.4 / PITCH_TICKS;
/** Habilidade de palco: cooldown por gato; repetir a MESMA rende metade. */
export const ABILITY_COOLDOWN = 4 * TICK_HZ;
export const ABILITY_REPEAT_SCALE = 0.5;
/** O efeito de cada gato no gauge (personalidade no palco). */
export const ABILITY_EFFECT: Record<string, number> = {
  bigode: 0.1, // encarada felina: pressiona jurado indeciso
  cheeto: 0.16, // cacar o cursor: entretenimento puro...
  almofada: 0.08, // ronronar no microfone: acalma e sustenta
  smoking: 0.12, // amassar paozinho: fofura dirigida
};
/** ...mas o cursor pode mudar o slide (o risco e do Cheeto). */
export const ABILITY_CHEETO_MISHAP_P = 0.25;
export const ABILITY_CHEETO_MISHAP = -0.08;
/** Crise de demo: janela de resposta e o premio do improviso heroico. */
export const CRISIS_WINDOW = 3 * TICK_HZ;
export const CRISIS_DRAIN = 0.05 / TICK_HZ;
export const IMPROVISO_BONUS = 0.15;
/** O pitch vale ate isto em pontos (gauge final x escala). */
export const PITCH_SCORE_SCALE = 30;

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
/**
 * Cortes, retunados com o pitch valendo ate 30: o maximo teorico subiu para
 * ~160 e o grand prize continua mastery (features + estabilidade + palco),
 * nunca rotina. Validados pelos bots dos testes, como sempre.
 */
export const CUT_GRAND = 118;
export const CUT_PODIUM = 74;
export const CUT_MENTION = 36;

// -------------------------------------------------------------------- hash

export const HASH_POS = 10;
export const HASH_METER = 1000;
