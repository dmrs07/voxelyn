// A MAQUINA DE ESTADOS DO CANHAO ROTATIVO.
//
// Aritmetica pura: entra a rotacao atual e a intencao do jogador, sai a
// rotacao seguinte, a fase e a cadencia. Nenhuma funcao daqui toca no mundo —
// quem cria projetil, cobra calor e publica evento e o `run.ts`, que e onde o
// combate mora. A separacao existe pelo mesmo motivo do `mixer.ts` no audio: a
// parte que decide QUANDO a bala sai e a que mais precisa de teste, e ela nao
// deve exigir um mundo inteiro para ser conferida.
//
// TUDO AQUI E INTEIRO, e essa e a decisao estrutural do arquivo. Rotacao em
// milesimos, cadencia em milesimos de tiro por tick, acumulador em milesimos.
// Um `spin += 0.05` por tick acumularia erro de float ao longo de uma run, e
// duas maquinas de co-op que discordassem do terceiro decimal divergiriam no
// tick exato em que uma cruza o limiar operacional e a outra ainda nao — o
// pior tipo de divergencia possivel, porque ela aparece como "o parceiro
// atirou e eu nao".

import {
  MINIGUN_RATE_MAX_MILLI,
  MINIGUN_RATE_MIN_MILLI,
  MINIGUN_SHOT_MILLI,
  MINIGUN_SPIN_DOWN_PER_TICK,
  MINIGUN_SPIN_FIRE_AT,
  MINIGUN_SPIN_MAX,
  MINIGUN_SPIN_UP_PER_TICK,
  MINIGUN_SPREAD_BASE,
  MINIGUN_SPREAD_MAX,
} from './constants.js';
import type { MinigunPhase, MinigunState } from './types.js';

/** O canhao parado. Todo slot nasce com um, mesmo sem o modulo instalado. */
export const emptyMinigunState = (): MinigunState => ({
  spin: 0,
  fireAccum: 0,
  phase: 'idle',
  pendingRounds: 0,
});

/**
 * Devolve o canhao ao repouso, no lugar.
 *
 * Usado nas transicoes de setor e no reset de slot, pelas mesmas razoes que o
 * calor zera ali: o mapa novo nao tem a luta que estava acontecendo, e um
 * Prospector que desce o poco com os canos girando comeca o setor seguinte
 * cuspindo bala numa sala vazia.
 */
export const resetMinigun = (mg: MinigunState): void => {
  mg.spin = 0;
  mg.fireAccum = 0;
  mg.phase = 'idle';
  mg.pendingRounds = 0;
};

/**
 * A rotacao do proximo tick.
 *
 * `wantsSpin` e "o gatilho esta apertado E a arma pode girar" — a decisao de
 * quem pode girar (municao, superaquecimento, canal do sopro) e de quem chama.
 * Aqui so ha a rampa, e ela e assimetrica de proposito: sobe em 14 ticks e
 * desce em 10. Ver `constants.ts`.
 */
export const minigunNextSpin = (spin: number, wantsSpin: boolean): number =>
  wantsSpin
    ? Math.min(MINIGUN_SPIN_MAX, spin + MINIGUN_SPIN_UP_PER_TICK)
    : Math.max(0, spin - MINIGUN_SPIN_DOWN_PER_TICK);

/**
 * A fase que corresponde a esta rotacao e a esta intencao.
 *
 * Funcao TOTAL sobre os cinco estados: nao existe combinacao de entradas que
 * caia fora dela, e e por isso que o resto do sistema nunca precisa perguntar
 * "esta girando E travado ao mesmo tempo?".
 *
 * `overheated` vence tudo, inclusive rotacao alta e gatilho apertado — e a
 * fase que diz "o mecanismo continua quente", e ela e o unico jeito de a
 * apresentacao mostrar canos desacelerando com metal incandescente em vez de
 * uma arma simplesmente parada.
 */
export const minigunPhaseFor = (
  spin: number,
  wantsSpin: boolean,
  overheated: boolean,
): MinigunPhase => {
  if (overheated) return 'overheated';
  if (wantsSpin) return spin >= MINIGUN_SPIN_FIRE_AT ? 'firing' : 'spinning_up';
  return spin > 0 ? 'spinning_down' : 'idle';
};

/**
 * Cadencia nesta rotacao, em MILESIMOS DE TIRO POR TICK.
 *
 * Linear entre o limiar operacional e o topo. Abaixo do limiar e zero, e nao
 * "muito devagar": o contrato da arma e que NENHUM projetil existe antes de os
 * canos chegarem a rotacao de trabalho, e uma bala solta durante o spin-up
 * apagaria a unica coisa que o atraso tem a dizer.
 */
export const minigunRateMilli = (spin: number): number => {
  if (spin < MINIGUN_SPIN_FIRE_AT) return 0;
  const span = MINIGUN_SPIN_MAX - MINIGUN_SPIN_FIRE_AT;
  const over = Math.min(spin, MINIGUN_SPIN_MAX) - MINIGUN_SPIN_FIRE_AT;
  return (
    MINIGUN_RATE_MIN_MILLI +
    Math.floor((over * (MINIGUN_RATE_MAX_MILLI - MINIGUN_RATE_MIN_MILLI)) / span)
  );
};

/**
 * Quantos tiros o acumulador libera neste tick, e o que sobra nele.
 *
 * E ESTA funcao que cumpre a promessa de "nao perder municao nem DPS em
 * aparelho lento". A simulacao roda a TICK_HZ em qualquer maquina, e o resto
 * (quantos quadros foram desenhados no meio) nao entra na conta em lugar
 * nenhum: o mesmo numero de ticks entrega sempre o mesmo numero de balas.
 *
 * O laco existe — em vez de um unico `if` — para uma cadencia futura acima de
 * um tiro por tick continuar correta sem reescrever nada. Hoje o maximo e 800
 * milesimos e ele nunca da duas voltas.
 */
export const minigunDrainAccumulator = (
  accum: number,
  rateMilli: number,
  maxShots: number,
): { shots: number; accum: number } => {
  let next = accum + rateMilli;
  let shots = 0;
  while (next >= MINIGUN_SHOT_MILLI && shots < maxShots) {
    next -= MINIGUN_SHOT_MILLI;
    shots++;
  }
  return { shots, accum: next };
};

/**
 * O acumulador com que a rajada COMECA.
 *
 * Sem isto, o primeiro tick de disparo somaria a cadencia (no maximo 800) e
 * nao chegaria aos 1000 de um tiro: haveria um tick de silencio depois de a
 * rotacao ja ter cruzado o limiar, e o jogador leria como travamento. Semear
 * o acumulador em "falta exatamente uma cadencia" faz a primeira bala sair no
 * proprio tick da virada, sem adiantar nenhuma das seguintes.
 */
export const minigunPrimedAccumulator = (rateMilli: number): number =>
  Math.max(0, MINIGUN_SHOT_MILLI - rateMilli);

/**
 * Meia-abertura da dispersao, em radianos, para esta fracao de calor.
 *
 * A saturacao e o que impede "segurar o gatilho para sempre" de ser a resposta
 * a todo problema: fria a arma e quase precisa, e perto do travamento ela
 * espalha o triplo. De perto a diferenca nao existe; a 10 tiles ela e mais de
 * um tile, que e a largura de um corpo.
 */
export const minigunSpread = (heatFraction: number): number => {
  const t = Math.max(0, Math.min(1, heatFraction));
  return MINIGUN_SPREAD_BASE + (MINIGUN_SPREAD_MAX - MINIGUN_SPREAD_BASE) * t;
};

/** FNV-1a de 32 bits sobre tres inteiros. Barato e sem estado. */
const hash3 = (a: number, b: number, c: number): number => {
  let h = 0x811c9dc5;
  for (const v of [a, b, c]) {
    h = Math.imul(h ^ (v & 0xffff), 0x01000193);
    h = Math.imul(h ^ ((v >>> 16) & 0xffff), 0x01000193);
  }
  h ^= h >>> 15;
  return h >>> 0;
};

/**
 * O desvio deste tiro, em -1..1, DETERMINISTICO.
 *
 * `Math.random()` seria a escolha obvia e esta proibida aqui: a simulacao e
 * reproduzida no servidor para verificacao de replay e espelhada nas duas
 * maquinas de uma sala de co-op. Um desvio sorteado faria cada uma delas
 * mandar a bala para um lugar diferente, e a divergencia apareceria como
 * dano que so acontece de um lado.
 *
 * A semente e (tick, slot, indice do tiro dentro do tick), que e a unica
 * tripla que identifica um projetil desta arma sem depender de nada mutavel.
 */
export const minigunJitter = (tick: number, slot: number, index: number): number =>
  (hash3(tick, slot, index) / 0xffffffff) * 2 - 1;

/**
 * Gira um vetor unitario por `angle` radianos.
 *
 * Fica aqui, e nao em `run.ts`, porque quem testa a dispersao quer conferir a
 * conta sem construir um mundo.
 */
export const rotateUnit = (x: number, y: number, angle: number): { x: number; y: number } => {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return { x: x * c - y * s, y: x * s + y * c };
};
