// Camadas continuas: o som do mundo, nao dos eventos.
//
// Eventos contam o que ACONTECEU. A ambiencia conta o que ESTA acontecendo — e
// e a unica forma de o jogador saber que ha fogo alastrando atras dele, que a
// sala em que ele entrou esta cheia de gas, ou que o calor da arma esta a dois
// tiros do travamento. Nada disso e um instante; nada disso cabe num evento.
//
// Continuo nao quer dizer constante. Um leito que nunca cala nao informa nada: o
// ouvido o adota como piso da cena e para de registra-lo. Fogo e gas se calam
// sozinhos porque o mundo os apaga; o calor da arma nao se apaga nunca de todo,
// e por isso e o unico leito que precisa de um limiar proprio.
//
// Tudo aqui e amostragem do estado autoritativo, nunca decisao: a ambiencia le
// a grade e o jogador local, e devolve numeros de 0 a 1. Quem transforma isso
// em som e o synth, e quem suaviza a transicao e o barramento — um nivel que
// pula de 0 a 1 num quadro soa como um clique, nao como fogo.

import {
  HEAT_MAX,
  SURF_FIRE,
  SURF_FUNGAL_HEATED,
  SURF_GAS,
  SURF_SPORES,
} from '@voxelyn/survival-sim';
import type { SurvivalState } from '@voxelyn/survival-sim';

export type AmbienceLevels = {
  /** Fogo por perto: crepitar. */
  fire: number;
  /** Gas e esporos por perto: sibilo toxico. */
  gas: number;
  /** Aviso de travamento da arma local: tique que acelera. Zero antes do limiar. */
  heat: number;
  /** Contaminacao da run: zumbido grave que cresce a run inteira. */
  dread: number;
  /** Inimigos vivos por perto: pulsacao baixa. */
  threat: number;
};

export const SILENT_AMBIENCE: AmbienceLevels = { fire: 0, gas: 0, heat: 0, dread: 0, threat: 0 };

/**
 * Raio de amostragem da grade, em tiles.
 *
 * Catorze e maior que a tela e menor que o alcance dos eventos (22): a
 * ambiencia deve antecipar o que voce esta prestes a encontrar, mas nao
 * descrever o mapa inteiro — um incendio a vinte tiles nao e informacao
 * acionavel, e um sibilo constante que nunca some vira ruido de fundo que o
 * ouvido aprende a ignorar, destruindo o valor do sibilo quando importa.
 */
export const AMBIENCE_RADIUS = 14;

/**
 * Quantas celulas saturam cada leito.
 *
 * Numeros baixos de proposito. Vinte celulas de fogo ja e um incendio dos
 * grandes neste mundo — exigir cem para o leito chegar ao topo faria a maioria
 * dos incendios reais soar como uma vela.
 */
const FIRE_SATURATION = 20;
const GAS_SATURATION = 34;
/** Inimigos vivos no raio que saturam a pulsacao de ameaca. */
const THREAT_SATURATION = 5;

/**
 * Fracao de calor abaixo da qual a arma nao faz som nenhum.
 *
 * O leito de calor era o unico que tocava o tempo todo. `HEAT_PER_SHOT` e 9 e o
 * decaimento e 1,15 por tick: um unico tiro deixava o som aceso por oito ticks,
 * e fogo sustentado o deixava aceso indefinidamente. Um aviso que soa em todo
 * combate nao avisa nada — vira o som do jogo, o ouvido aprende a filtra-lo, e
 * quando o travamento enfim se aproxima ele nao se destaca de coisa alguma.
 *
 * Meio tanque e o ponto certo porque e onde a informacao ainda e acionavel: a
 * `HEAT_PER_SHOT` 9 sobram cerca de cinco tiros ate travar, tempo de soltar o
 * gatilho. E tambem e onde o calor cai depois de um travamento (`HEAT_MAX *
 * 0.55`, em run.ts), entao sair da trava devolve um tique lento em vez de
 * silencio — o que e verdade, a arma continua quente.
 *
 * O HUD le esta mesma constante para marcar e pulsar a barra de calor. As duas
 * fronteiras TEM de ser a mesma: se o audio calasse num ponto que a tela nao
 * mostra, o jogador leria o silencio como sorte, e nao como um limite que ele
 * pode aprender a usar.
 */
export const HEAT_WARN_AT = 0.5;

/**
 * Fracao de calor para intensidade do aviso, 0..1. Pura, testavel sem browser.
 *
 * Expoente abaixo de 1 para o primeiro tique ja nascer audivel. Com rampa linear
 * o inicio da faixa util sairia perto de zero, e o aviso so passaria a existir
 * de fato nos ultimos tiros — tarde demais para mudar a decisao de quem atira.
 */
export const heatWarning = (heatFrac: number): number => {
  if (heatFrac <= HEAT_WARN_AT) return 0;
  const t = Math.min(1, (heatFrac - HEAT_WARN_AT) / (1 - HEAT_WARN_AT));
  return Math.pow(t, 0.6);
};

/** Le a grade e o estado e devolve os niveis-alvo de cada leito. */
export const sampleAmbience = (state: SurvivalState, listenerId: number): AmbienceLevels => {
  const width = state.config.width;
  const height = state.config.height;

  const listener =
    state.players.find((p) => p.id === listenerId && p.alive) ?? state.players.find((p) => p.alive);
  if (!listener) {
    // Sem ouvinte vivo o mundo continua existindo, mas nao ha de onde ouvi-lo.
    // Devolver os leitos do ultimo quadro faria o fogo continuar crepitando na
    // tela de morte, exatamente onde o silencio e o efeito desejado.
    return SILENT_AMBIENCE;
  }

  const cx = Math.floor(listener.x);
  const cy = Math.floor(listener.y);
  const x0 = Math.max(0, cx - AMBIENCE_RADIUS);
  const x1 = Math.min(width - 1, cx + AMBIENCE_RADIUS);
  const y0 = Math.max(0, cy - AMBIENCE_RADIUS);
  const y1 = Math.min(height - 1, cy + AMBIENCE_RADIUS);

  let fireCells = 0;
  let gasCells = 0;
  for (let y = y0; y <= y1; y++) {
    const row = y * width;
    for (let x = x0; x <= x1; x++) {
      const surf = state.surface[row + x];
      if (surf === SURF_FIRE) fireCells++;
      // Fungo aquecido ainda nao pega fogo, mas ja fumega — e o unico aviso de
      // que o chao vai acender. Vale meia celula: audivel, sem competir com
      // fogo de verdade.
      else if (surf === SURF_FUNGAL_HEATED) fireCells += 0.5;
      else if (surf === SURF_GAS || surf === SURF_SPORES) gasCells++;
    }
  }

  let threatCount = 0;
  const threatRadiusSq = AMBIENCE_RADIUS * AMBIENCE_RADIUS;
  for (const enemy of state.enemies) {
    if (!enemy.alive) continue;
    const dx = enemy.x - listener.x;
    const dy = enemy.y - listener.y;
    if (dx * dx + dy * dy <= threatRadiusSq) threatCount++;
  }

  const slot = state.players.indexOf(listener);
  const extra = slot >= 0 ? state.playerExtras[slot] : undefined;

  return {
    fire: Math.min(1, fireCells / FIRE_SATURATION),
    gas: Math.min(1, gasCells / GAS_SATURATION),
    heat: extra ? heatWarning(extra.heat / HEAT_MAX) : 0,
    dread: Math.min(1, state.contamination),
    threat: Math.min(1, threatCount / THREAT_SATURATION),
  };
};

/**
 * Aproxima os niveis atuais dos alvos, quadro a quadro.
 *
 * Exponencial com constante de tempo em ms, e nao um passo fixo por quadro:
 * com passo fixo, a mesma cena sobe o dobro mais rapido a 60 FPS do que a 30 —
 * e o jogo rebaixa para 30 FPS sozinho quando o aparelho aperta, o que faria a
 * ambiencia mudar de comportamento exatamente nos momentos de mais carga.
 *
 * A subida e mais rapida que a descida de proposito: perigo aparecendo tem de
 * ser imediato, perigo sumindo pode relaxar devagar.
 */
export const RISE_TAU_MS = 180;
export const FALL_TAU_MS = 900;

export const approachLevels = (
  current: AmbienceLevels,
  target: AmbienceLevels,
  dtMs: number,
): AmbienceLevels => {
  const step = (from: number, to: number): number => {
    const tau = to > from ? RISE_TAU_MS : FALL_TAU_MS;
    const k = 1 - Math.exp(-Math.max(0, dtMs) / tau);
    return from + (to - from) * k;
  };
  return {
    fire: step(current.fire, target.fire),
    gas: step(current.gas, target.gas),
    heat: step(current.heat, target.heat),
    dread: step(current.dread, target.dread),
    threat: step(current.threat, target.threat),
  };
};
