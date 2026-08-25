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
/**
 * Reerguer um build perdido exige uma intervencao maior no rack. Continua
 * sendo uma crise cara, mas nunca transforma o resto da run em tempo morto.
 */
export const BUILD_REPAIR_COST = 18 * TICK_HZ;

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
/** O estilo de palco vem da PERSONALIDADE — o time agora e gerado. */
export const ABILITY_EFFECT: Record<string, number> = {
  perfeccionista: 0.1, // encarada felina: pressiona jurado indeciso
  cowboy: 0.16, // cacar o cursor: entretenimento puro...
  calmo: 0.08, // ronronar no microfone: acalma e sustenta
  'julga-em-silencio': 0.12, // amassar paozinho: fofura dirigida
};
/** ...mas o cursor pode mudar o slide (o risco e do cowboy). */
export const ABILITY_COWBOY_MISHAP_P = 0.25;
export const ABILITY_COWBOY_MISHAP = -0.08;
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

// ---------------------------------------------------------------------- pm

/**
 * O PM circula num ritmo proprio: escolhe DETERMINISTICAMENTE o dev de
 * menor moral numa mesa, anda ate ele e entrega o pep talk na chegada.
 * O resmungo de prazo tem teto de frequencia — preocupado, nao spam.
 */
export const PM_PEP_PERIOD = 40 * TICK_HZ;
export const PM_PEP_MORAL = 0.05;
export const PM_PEP_STRESS = 0.03;
export const PM_WALK_SPEED = 1.6;
export const PM_WORRY_PERIOD = 70 * TICK_HZ;

// -------------------------------------------------------------------- hash

export const HASH_POS = 10;
export const HASH_METER = 1000;
/**
 * Progresso de conserto avanca em fracoes (fixSpeed 1.3 no Server Corner):
 * na escala 1 o arredondamento colava estados que divergem no tick seguinte.
 */
export const HASH_FIX = 10;

// ---------------------------------------------------------- tiers e traits

/** Junior: comeca devagar e APRENDE durante a run (ate +0.18). */
export const JUNIOR_SPEED = 0.78;
export const JUNIOR_LEARN = 0.18;
export const JUNIOR_BUG_EXTRA = 0.12;
export const JUNIOR_ENERGY_SCALE = 0.85;
/** Senior: conserta 1.4x e shipa 2x mais limpo. */
export const SENIOR_SPEED = 1.05;
export const SENIOR_FIX = 1.4;
export const SENIOR_CLEAN = 0.5;
/** Especialista: voa na trilha dele, afunda fora. */
export const SPECIALIST_MATCH = 1.3;
export const FREESTYLER_SPEED = 0.75;

// ------------------------------------------------------------- convivencia
//
// COMPATIBILIDADE: gatos trabalhando em mesas VIZINHAS se afetam. O vibe de
// um par vem de personalidade + traits — inclusive o OCULTO, desde o inicio:
// o atrito aparece no comportamento antes de o curriculo explicar o porque
// (e a profundidade do trait oculto). O raio faz o LAYOUT importar: mesas
// juntas na Ilha Central conversam; cubiculos isolam.

/** Mesas a ate isto (px de cena) sao vizinhas. */
export const VIBE_RADIUS = 110;
/** Vizinho bom: estresse de trabalho rende 0.88x; ruim: 1.18x. */
export const VIBE_STRESS_GOOD = 0.88;
export const VIBE_STRESS_BAD = 1.18;
/** Deriva de moral por tick ao lado de amigo (+) ou rival (-). */
export const VIBE_MORAL_DRIFT = 0.0005;
/** Atrito alto entre vizinhos pode escalar; raro o bastante para ser historia. */
export const FIGHT_P = 0.00012;
export const FIGHT_STRESS_RATE = 0.00035;

/**
 * MENTORIA: o junior aprende TRABALHANDO (nao por relogio) — e 1.6x mais
 * rapido com um senior/especialista numa mesa vizinha. Sozinho, ~240s de
 * trabalho chegam ao teto; mentorado, ~150s.
 */
export const JUNIOR_LEARN_RATE = 1 / (240 * TICK_HZ);
export const MENTOR_LEARN_SCALE = 1.6;
/** learned daqui para cima = CRESCEU: bonus no premio, volta como pleno. */
export const JUNIOR_GROWN_AT = 0.75;

export const TRAIT_FIX_HUNTER = 1.5;
export const TRAIT_FIX_LEGACY = 0.6;
export const TRAIT_NAP_FAST = 1.5;
export const TRAIT_SPEED_POLY = 1.1;
export const TRAIT_PITCH_UP = 1.5;
export const TRAIT_PITCH_DOWN = 0.5;
export const TRAIT_SHORTCUT_P = 0.1;
export const TRAIT_MAIN_BUG = 0.12;
export const TRAIT_SLEEPY_KB_P = 0.4;
export const TRAIT_ZOOMIES_SCALE = 1.6;
export const TRAIT_ZOOMIES_AFTER = 0.6;
export const TRAIT_ZEN = 0.85;
export const TRAIT_HUNGRY = 1.4;
/** O trait oculto age desde o inicio; REVELA-SE aqui (a surpresa e ver antes de saber). */
export const REVEAL_AT = 0.3;

// ------------------------------------------------------------------ riscos

export const RISK_OUTAGE_AT = 0.55;
export const RISK_HYPE_DECAY = 1.3;
export const RISK_BUGCOST = 1.25;
/** A enfase anunciada da banca multiplica UMA dimensao. */
export const EMPHASIS_SCALE = 1.25;

// -------------------------------------------------------------- apetrechos

/** Passivos: modificadores do booth. Consumiveis: usos por run. */
export const GEAR_KEYBOARD_SPEED = 1.08;
export const GEAR_CUSHION_NAP = 1.25;
export const GEAR_DUCK_STRESS = 0.9;
export const GEAR_COFFEE_EAT = 0.7;
export const CATNIP_USES = 2;
export const CATNIP_MORAL = 0.35;
export const CATNIP_STRESS_DROP = 0.1;
export const CATNIP_ZOOMIES_P = 0.4;
export const LASER_USES = 1;
export const LASER_STRESS_DROP = 0.18;
export const LASER_ZOOMIES_TICKS = Math.round(2.5 * TICK_HZ);

// ---------------------------------------------------------- eventos sociais

export const SOCIAL_AT = [0.42, 0.72] as const;
export const SOCIAL_JITTER_TICKS = 8 * TICK_HZ;
export const SOCIAL_WINDOW = 15 * TICK_HZ;
export const INFLUENCER_STRESS = 0.08;
export const INFLUENCER_HYPE = 0.06;
export const POACH_BONUS = 80;
export const POACH_STAR_STRESS = 0.15;
export const POACH_STAR_MORAL = 0.1;
export const POACH_SHIELD_MORAL = 0.05;
export const WORKSHOP_BOOST = 0.08;
export const WORKSHOP_AWAY_TICKS = 15 * TICK_HZ;

// ------------------------------------------------------------------ premio

/** O premio por colocacao, em tampinhas. Zero bugs paga bonus. */
export const PRIZE_BY_OUTCOME: Record<string, number> = {
  'grand-prize': 250,
  podio: 120,
  mencao: 60,
  participacao: 20,
  crashed: 0,
};
export const PRIZE_ZERO_BUGS = 30;
/** "Ship It": um deploy no ultimo minuto das 48h. */
export const SHIP_IT_WINDOW = 60 * TICK_HZ;
/**
 * O premio tambem paga DESENVOLVIMENTO (§7 do brief): cada junior que
 * cresceu na run vale tampinhas — e a divida tecnica restante MORDE o
 * cheque. A banca premia; o financeiro desconta.
 */
export const PRIZE_JUNIOR_GROWTH = 25;
export const PRIZE_DEBT_MALUS = 8;
/** O trofeu da categoria especial da edicao. */
export const PRIZE_SPECIAL = 40;

// ---------------------------------------------------------------- sponsors

/** O terno de mascote do sponsor: a plateia ve o anuncio antes do pitch. */
export const SPONSOR_BRANDING_GAUGE = 0.08;
/** Auditoria do sponsor: cada bug custa mais para consertar. */
export const SPONSOR_AUDIT_BUGCOST = 1.25;
/** Limiares dos objetivos checaveis. */
export const SPONSOR_SHIP_TARGET = 8;
export const SPONSOR_CROWD_TARGET = 0.8;
export const SPONSOR_INNOVATION_TARGET = 2;

// ------------------------------------------------------ categoria especial

/** Limiares das categorias especiais (sobre as dimensoes FINAIS da banca). */
export const SPECIAL_INNOVATION_AT = 10;
export const SPECIAL_UX_AT = 20;
export const SPECIAL_STABILITY_AT = 18;
export const SPECIAL_CROWD_AT = 0.85;

// -------------------------------------------------------------- rivalidade

/**
 * O RIVAL (os Golden Retrievers do booth ao lado): a nota deles e funcao
 * pura de (semente, skill). Skill 0 = 38..78 — o bot parado perde ate para
 * eles; o jogador decente vence com folga. Cada derrota TUA os deixa mais
 * confiantes (a carreira sobe o skill deles); vence-los os abala um pouco.
 */
export const RIVAL_BASE = 58;
export const RIVAL_PER_SKILL = 45;
export const RIVAL_JITTER = 20;
export const RIVAL_MIN_SCORE = 15;
