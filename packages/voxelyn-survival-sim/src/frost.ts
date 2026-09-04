// O CONGELAMENTO DO PROSPECTOR: um medidor que o frio enche e que so o calor
// do proprio motor esvazia por inteiro.
//
// A Nova da Rainha e o bote do Espectro nao "machucam de frio": eles
// ACUMULAM. Enquanto o medidor nao esta cheio, o gelo se espalha pelo
// equipamento e o Prospector ainda age — e o frio parcial vai embora sozinho,
// devagar. Cheio, o corpo inteiro congela (`frostbitten`): nada se move, nada
// gira, nada dispara. O unico input que a estatua ainda reconhece e o gatilho,
// e o que ele faz ali nao e atirar: e forcar o motor da arma por baixo da
// crosta, em CICLOS TERMICOS de cadencia fixa que geram calor de verdade (no
// sistema de calor de sempre) e derretem o gelo com esse calor novo.
//
// Regras que este modulo garante e que os testes protegem:
//
// - o decaimento natural NUNCA liberta quem congelou: cheio, o estado trava
//   (latch) ate uma camada inteira (~1/3) ser derretida pelo gatilho;
// - so calor NOVO derrete. Calor guardado antes do congelamento nao apaga a
//   condicao — senao entrar quente seria entrar imune;
// - a cadencia dos ciclos e uma so para toda arma. A Minigun nao degela mais
//   rapido por atirar mais rapido: ela nao atira, ela gira por baixo do gelo.
//
// O estado e AUTORITATIVO (entra no hash, no snapshot e no viewer): o cliente
// so apresenta. Os eventos descrevem o que aconteceu; nunca decidem.
import {
  FREEZE_DECAY_INTERVAL_TICKS,
  FREEZE_DECAY_PER_INTERVAL,
  FREEZE_GRACE_TICKS,
  FREEZE_MAX,
  FREEZE_MELT_PER_HEAT,
  FREEZE_THAW_LAYER,
  FREEZE_THERMAL_CYCLE_TICKS,
} from './constants.js';
import type { FreezeSource, PlayerExtra, SemanticEvent, SurvivalState } from './types.js';

/** O medidor abaixo do qual a crosta se solta, uma camada abaixo do cheio. */
export const FREEZE_THAW_RELEASE_AT = FREEZE_MAX - FREEZE_THAW_LAYER;

/** Zera tudo o que e frio: morte, queda, revive, reset e troca de setor. */
export const clearFreeze = (extra: PlayerExtra): void => {
  extra.freeze = 0;
  extra.frostbitten = false;
  extra.freezeGraceUntil = 0;
  extra.thermalCycleReadyAt = 0;
};

/**
 * Uma DOSE de frio num Prospector. Devolve `true` se entrou.
 *
 * Nao entra em quem nao esta em campo: slot vazio, morto ou abatido. Iframes
 * NAO barram — a esquiva serve para sair do raio antes da liberacao, nao para
 * atravessar a Nova imune; quem esta dentro quando ela sai, esta dentro.
 *
 * Chegar ao maximo TRAVA o congelamento no mesmo tick: velocidade zerada e
 * esquiva cancelada aqui, para a estatua nao deslizar nem um passo com o
 * embalo que tinha; o resto do bloqueio (rumo, acoes, gatilho) e o gate de
 * `stepPlayer`, que le `frostbitten`.
 */
export const applyFreezeDose = (
  state: SurvivalState,
  slot: number,
  amount: number,
  source: FreezeSource,
  events: SemanticEvent[],
): boolean => {
  const extra = state.playerExtras[slot];
  const player = state.players[slot];
  if (!extra || !player || !extra.joined || !player.alive || extra.downed) return false;
  if (amount <= 0) return false;
  extra.freeze = Math.min(FREEZE_MAX, extra.freeze + Math.round(amount));
  extra.freezeGraceUntil = state.tick + FREEZE_GRACE_TICKS;
  events.push({
    t: 'freeze_dose',
    slot,
    x: player.x,
    y: player.y,
    amount: Math.round(amount),
    freeze: extra.freeze,
    source,
  });
  if (extra.freeze >= FREEZE_MAX && !extra.frostbitten) enterFrostbite(state, slot, events);
  return true;
};

const enterFrostbite = (state: SurvivalState, slot: number, events: SemanticEvent[]): void => {
  const extra = state.playerExtras[slot];
  const player = state.players[slot];
  extra.frostbitten = true;
  player.vx = 0;
  player.vy = 0;
  extra.dodgeUntil = Math.min(extra.dodgeUntil, state.tick);
  // O primeiro ciclo so sai uma cadencia depois: a crosta acabou de fechar, e
  // o motor precisa de um instante para pegar por baixo dela.
  extra.thermalCycleReadyAt = state.tick + FREEZE_THERMAL_CYCLE_TICKS;
  events.push({ t: 'frostbite', slot, x: player.x, y: player.y });
};

/**
 * O decaimento natural, um tick. Lento (um ponto percentual por segundo), por
 * relogio de ticks e nunca abaixo de zero. Suspenso na janela de graca logo
 * depois de uma dose — para o medidor nao parecer que "ja esta indo embora"
 * enquanto a segunda dose da mesma Nova ainda nem chegou — e, o que importa,
 * suspenso DE VEZ enquanto o congelamento esta travado.
 */
export const stepFreezeDecay = (state: SurvivalState, slot: number): void => {
  const extra = state.playerExtras[slot];
  if (extra.frostbitten || extra.freeze <= 0) return;
  // Inclusivo: a graca cobre FREEZE_GRACE_TICKS ticks inteiros depois da dose.
  if (state.tick <= extra.freezeGraceUntil) return;
  if (state.tick % FREEZE_DECAY_INTERVAL_TICKS !== 0) return;
  extra.freeze = Math.max(0, extra.freeze - FREEZE_DECAY_PER_INTERVAL);
};

/**
 * Calor NOVO derretendo gelo: `heatAdded` unidades de calor que acabaram de
 * entrar na arma tiram do medidor na razao fixa. E a mesma conta para o
 * ciclo termico de quem esta congelado e para o tiro comum de quem ja se
 * soltou e ainda carrega gelo residual — o que muda e so quem gera o calor.
 * Devolve quanto derreteu.
 */
export const meltFreezeByHeat = (extra: PlayerExtra, heatAdded: number): number => {
  if (extra.freeze <= 0 || heatAdded <= 0) return 0;
  const melt = Math.min(extra.freeze, Math.round(heatAdded * FREEZE_MELT_PER_HEAT));
  extra.freeze -= melt;
  return melt;
};

/**
 * A crosta se solta? So depois de uma camada inteira derretida — a histerese
 * que impede o primeiro ciclo de "libertar" um Prospector ainda coberto.
 */
export const frostbiteBreaks = (extra: PlayerExtra): boolean =>
  extra.frostbitten && extra.freeze <= FREEZE_THAW_RELEASE_AT;

/** O tanto do medidor, 0..1, para quem apresenta. */
export const freezeFraction = (extra: Pick<PlayerExtra, 'freeze'>): number =>
  Math.max(0, Math.min(1, extra.freeze / FREEZE_MAX));
