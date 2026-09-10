// O CO-OP como MULTIPLICADOR DO ENCONTRO.
//
// Este arquivo existe porque a sala de dois nasceu de graca. `playerCount: 2`
// dobrava os canos, a vida do time, o alcance de visao e — o que mais pesa — a
// margem de erro: quem cai fica ABATIDO e volta de pe pelas maos do parceiro,
// enquanto o solo paga permadeath por um passo em falso. O setor, do outro
// lado, continuava o mesmo: vinte e dois corpos com a vida de tabela, um elite
// no meio da lista, ondas de contaminacao do tamanho de sempre. Um encontro
// desenhado para um Prospector, resolvido por dois, nao e o mesmo encontro —
// e o mesmo encontro pela metade.
//
// A correcao NAO e "dobrar tudo". Dois jogadores nao valem dois solos: eles
// valem dois canos, duas barras de vida, um revive e a atencao dividida do
// bestiario, que mira sempre o mais proximo. Dobrar a densidade e a vida
// devolveria pressao por jogador IGUAL a do solo e apagaria de graca o unico
// bonus que o co-op deveria manter — jogar acompanhado tem de ser mais seguro
// que descer sozinho, so nao GRATIS.
//
// Os numeros abaixo vem dessa conta e estao todos expressos POR JOGADOR EXTRA,
// e nao "em co-op": o dia em que MAX_PLAYERS passar de dois nao pode ser o dia
// em que alguem descobre que a escala era um `if` binario escondido em cinco
// arquivos.
//
// O que este arquivo NAO escala, de proposito:
//
//   - DANO. Vida e quantidade cobram tempo de arena e municao; dano cobra
//     leitura de padrao. Os padroes do bestiario foram afinados contra UM
//     corpo com a vida do Prospector, e engorda-los transformaria golpes
//     legiveis em one-shots — que o parceiro nao tem como responder, so
//     recolher. A pressao extra do co-op vem de MAIS BOCAS, nao de bocas
//     maiores.
//   - LOOT E CACHES. Sao da sala e ja se dividem entre dois; multiplicar a
//     recompensa junto com a ameaca anularia as duas pontas.

import { MAX_PLAYERS } from './constants.js';
import { isBossArchetype } from './bosses.js';
import type { EnemyArchetype, SurvivalState } from './types.js';

/**
 * Vida do bestiario comum, por jogador extra.
 *
 * Meia vida a mais e nao uma inteira: dois canos derrubam um Stalker no dobro
 * da velocidade, mas raramente ao mesmo tempo no mesmo alvo — o bestiario mira
 * o mais proximo e o time se espalha. 1,55x em dois deixa a morte de cada
 * corpo perto de 78% do tempo que ela custa no solo, que e a diferenca entre
 * "somos dois" e "o setor virou papel".
 */
export const COOP_HP_PER_EXTRA = 0.55;

/**
 * Vida de CHEFE, por jogador extra — maior que a do bestiario comum.
 *
 * O chefe e o unico encontro em que os dois canos convergem no mesmo alvo o
 * tempo inteiro: nao ha aggro para dividir nem corredor onde se perder. Com a
 * escala do bestiario comum, toda arena autoral desta run (as fases do Bispo,
 * a escada termica da Fornalha, os modulos do Diamandis) seria atravessada
 * antes de virar o que ela e — luta de fase encurtada nao e luta facil, e luta
 * que nunca aconteceu.
 */
export const COOP_BOSS_HP_PER_EXTRA = 0.75;

/**
 * Densidade do setor (quantos corpos a povoacao coloca), por jogador extra.
 *
 * Abaixo da escala de vida de proposito. Corpo a mais e sempre corpo a mais em
 * TODO lugar do mapa — inclusive nos corredores estreitos que o worldgen abre
 * entre os pontos de spawn —, e o teto de `MAX_ENEMIES` e compartilhado com
 * mineradores, ninhadas e ondas. 1,45x em dois sao 22 -> 32 corpos, que e o
 * limite do que a arena aguenta sem virar parede de carne.
 */
export const COOP_DENSITY_PER_EXTRA = 0.45;

/**
 * Levas fechadas — ondas de contaminacao, alarme de terminal, bando da
 * assinatura, invocacao de chefe — por jogador extra.
 *
 * Uma leva e um MOMENTO, e nao uma populacao: ela existe para forcar uma
 * decisao imediata (recuar, queimar o corredor, gastar o pulso). Escalada
 * abaixo da densidade, ela mantem o momento e nao vira cerco: com dois, uma
 * leva de tres passa a cinco, e cada jogador ainda ve menos bocas do que o solo
 * veria — o que ele nao ve e a chance de resolver todas sozinho.
 */
export const COOP_PACK_PER_EXTRA = 0.5;

/**
 * O TIME que este setor esta cobrando: quantos slots estao efetivamente em
 * jogo, nunca menos de um e nunca mais do que a sala comporta.
 *
 * Le `joined`, e nao `config.playerCount`, e a diferenca importa nos dois
 * sentidos. Uma sala de co-op e criada com dois assentos ANTES de qualquer
 * cliente reivindicar um deles (ver GameRoom): quem entra primeiro e joga
 * enquanto espera o parceiro nao pode receber a conta de dois, e quem entra no
 * meio da descida nao pode continuar pagando a conta de um. Como toda escala
 * daqui e aplicada NO INSTANTE DO SPAWN, o setor ja povoado nao muda debaixo do
 * jogador: a mudanca vale para a proxima onda, o proximo alarme, o proximo
 * setor — que e exatamente onde ela e legivel.
 *
 * Funcao PURA do estado, como tudo em depth.ts: o servidor autoritativo e
 * qualquer re-simulacao chegam ao mesmo numero no mesmo tick, e nada aqui
 * consulta perfil, RNG ou relogio.
 */
export const partySize = (state: SurvivalState): number => {
  const seats = Math.max(1, Math.min(MAX_PLAYERS, state.config.playerCount));
  let joined = 0;
  for (let slot = 0; slot < state.players.length && slot < seats; slot++) {
    if (state.playerExtras[slot]?.joined) joined++;
  }
  return Math.max(1, Math.min(seats, joined));
};

/** Ha mais de um Prospector em jogo neste instante? */
export const isCoop = (state: SurvivalState): boolean => partySize(state) > 1;

/** O fator de uma alavanca, dado o quanto ela cresce por jogador extra. */
export const coopScale = (state: SurvivalState, perExtra: number): number =>
  1 + perExtra * (partySize(state) - 1);

/**
 * A vida com que ESTE corpo nasce, ja pesada pelo tamanho do time.
 *
 * Recebe a vida base ja resolvida pelo chamador (elite incluso) em vez de
 * reabrir a tabela: elite e uma propriedade do SPAWN, nao do arquetipo, e
 * duplicar a regra aqui daria dois lugares para o multiplicador de elite
 * mudar. O piso de 1 existe porque `Math.round` de uma vida minuscula podia
 * devolver zero, e um inimigo que nasce morto nunca aparece — some sem evento,
 * sem cadaver e sem ninguem entendendo por que a camara veio vazia.
 */
export const coopEnemyHp = (
  state: SurvivalState,
  archetype: EnemyArchetype,
  baseHp: number,
): number => {
  const perExtra = isBossArchetype(archetype) ? COOP_BOSS_HP_PER_EXTRA : COOP_HP_PER_EXTRA;
  return Math.max(1, Math.round(baseHp * coopScale(state, perExtra)));
};

/**
 * O tamanho de uma LEVA fechada (onda, alarme, bando, invocacao).
 *
 * Arredonda para o inteiro mais proximo, com o meio subindo: uma leva de um
 * vira dois no co-op, que e a diferenca entre "o chefe cuspiu um bicho" e "o
 * chefe cuspiu um bicho para cada um". Quem chama continua responsavel pelo
 * teto de `MAX_ENEMIES` e por ter POSICOES DISTINTAS para a leva maior — leva
 * que nao cabe no anel nasce empilhada, e dois corpos na mesma celula sao um
 * sprite e duas hitboxes.
 */
export const coopPack = (state: SurvivalState, base: number): number =>
  Math.max(base, Math.round(base * coopScale(state, COOP_PACK_PER_EXTRA)));

/**
 * A mesma leva, recortada pelo que ainda cabe no orcamento do setor.
 *
 * `MAX_ENEMIES` e teto de SETOR e nao de corpos vivos: `state.enemies` guarda os
 * cadaveres tambem e so e zerado na descida. Todo outro spawn do jogo ja para
 * quando ele enche (`if (state.enemies.length >= MAX_ENEMIES) return`); as levas
 * daqui nao paravam, e a densidade de co-op transformou isso num estouro real —
 * seed 2, setor 3: 46 corpos na povoacao, 52 depois de um alarme de tier 3, 55
 * depois da primeira onda.
 *
 * O SOLO passa reto, com a leva de sempre. Nao e descuido: com 26 corpos num
 * setor de 48 ele praticamente nao encosta no teto, a versao anterior nunca
 * checou nada aqui, e recusar um corpo que ela spawnava mudaria o setor de quem
 * joga sozinho — a garantia que esta escala inteira existe para nao quebrar.
 */
export const coopPackCapped = (state: SurvivalState, base: number, capacity: number): number =>
  isCoop(state) ? Math.max(0, Math.min(coopPack(state, base), capacity)) : base;

/** Quantos corpos a povoacao do setor coloca, dado o orcamento solo. */
export const coopDensity = (state: SurvivalState, base: number): number =>
  Math.max(base, Math.round(base * coopScale(state, COOP_DENSITY_PER_EXTRA)));

/**
 * Quantos ELITES o setor recebe: um por jogador.
 *
 * O elite e a ameaca de destaque do setor — o corpo que obriga o time a parar
 * de andar e resolver. Com um so, o co-op o resolve em foco cruzado antes de
 * ele terminar a primeira acao, e o destaque some. Um por jogador devolve ao
 * setor a chance de dividir o time.
 */
export const coopElites = (state: SurvivalState): number => partySize(state);
