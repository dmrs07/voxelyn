// As habilidades do Prospector, e como o Veio decide quais oferecer.
//
// O jogo tinha UMA habilidade fixa — o pulso cinético — e ela vivia solta dentro
// de `stepRun`. Isso bastava enquanto era uma só; com quatro, um `if` por
// habilidade no meio do laço do jogador espalharia balanceamento, cooldown e
// telegrafia por três lugares diferentes, e a quinta habilidade seria escrita por
// quem já não lembra onde as outras estão.
//
// ---------------------------------------------------------------------------
// RESSONÂNCIA DO POÇO
// ---------------------------------------------------------------------------
// A pergunta que o desenho responde é "como o jogador troca de habilidade sem
// que isso vire loja, sorteio ou meta-progressão".
//
// Durante o setor, o Veio REGISTRA as reações que o jogador provocou: o que ele
// incendiou, o que eletrificou, o que detonou, o que quebrou com as próprias
// mãos. Ao chegar ao poço, dois Ecos demonstram habilidades derivadas justamente
// dessas ações. Pegar um substitui a habilidade atual; descer direto mantém a que
// já se tem.
//
// Três propriedades saem de graça dessa escolha:
//
// 1. Não compete com módulo. A decisão acontece no poço, não no terminal, então
//    habilidade e módulo nunca disputam a mesma tela — e habilidade, que é sempre
//    mais forte, nunca transforma módulo em prêmio de consolação.
// 2. Não exige meta-progressão. Nada persiste entre runs; a oferta nasce do que
//    ACONTECEU nesta descida.
// 3. O estilo de jogo daquela run vira a progressão dela. Quem passou o setor
//    incendiando tudo recebe fogo; quem eletrificou poças recebe descarga. O
//    jogo não pergunta que build você quer — ele observa a que você já estava
//    jogando e oferece o próximo degrau dela.
//
// A oferta é CONGELADA na primeira chegada ao poço. Recalculá-la a cada tick
// faria os dois Ecos trocarem de habilidade enquanto o jogador anda entre eles.

import {
  SEISMIC_COOLDOWN_TICKS,
  SEISMIC_RADIUS,
  SEISMIC_DAMAGE,
  SEISMIC_STUN_TICKS,
  SLIPSTREAM_COOLDOWN_TICKS,
  SLIPSTREAM_TICKS,
  VENT_COOLDOWN_TICKS,
  VENT_RADIUS,
  WELL_CHOICE_REACH,
  ABILITY_COOLDOWN_TICKS,
  ABILITY_KNOCKBACK,
  ABILITY_RADIUS,
  ARC_CHAIN_RANGE,
  ARC_COOLDOWN_TICKS,
  ARC_DAMAGE,
  ARC_MAX_TARGETS,
  FLAMETHROWER_ARC,
  FLAMETHROWER_COOLDOWN_TICKS,
  FLAMETHROWER_RANGE,
  SEEKER_COOLDOWN_TICKS,
  SEEKER_DAMAGE,
  SEEKER_SPEED,
  SEEKER_TTL,
} from './constants.js';
import type {
  AbilityId,
  EchoUnlock,
  ResonanceKind,
  ResonanceTally,
  SurvivalState,
} from './types.js';

export type AbilityDefinition = {
  id: AbilityId;
  cooldownTicks: number;
  /**
   * A reação que ENSINA esta habilidade.
   *
   * `null` no pulso: ele é a habilidade inicial e não é oferecida por ressonância
   * nenhuma — trocar de volta para o que você já tinha não é uma decisão.
   */
  resonance: ResonanceKind | null;
  threshold: number;
};

export const ABILITY_DEFINITIONS: Record<AbilityId, AbilityDefinition> = {
  pulse: { id: 'pulse', cooldownTicks: ABILITY_COOLDOWN_TICKS, resonance: null, threshold: 0 },
  flamethrower: {
    id: 'flamethrower',
    cooldownTicks: FLAMETHROWER_COOLDOWN_TICKS,
    resonance: 'fire',
    threshold: 1,
  },
  seeker: { id: 'seeker', cooldownTicks: SEEKER_COOLDOWN_TICKS, resonance: 'blast', threshold: 1 },
  arc: { id: 'arc', cooldownTicks: ARC_COOLDOWN_TICKS, resonance: 'current', threshold: 1 },
  seismic: {
    id: 'seismic',
    cooldownTicks: SEISMIC_COOLDOWN_TICKS,
    resonance: 'kinetic',
    threshold: 6,
  },
  slipstream: {
    id: 'slipstream',
    cooldownTicks: SLIPSTREAM_COOLDOWN_TICKS,
    resonance: 'evasion',
    threshold: 6,
  },
  vent: { id: 'vent', cooldownTicks: VENT_COOLDOWN_TICKS, resonance: 'purge', threshold: 1 },
};

export const abilityDefinition = (id: AbilityId): AbilityDefinition => ABILITY_DEFINITIONS[id];

/** A habilidade com que todo Prospector desce. */
export const STARTING_ABILITY: AbilityId = 'pulse';

export const emptyResonance = (): ResonanceTally => ({
  fire: 0,
  current: 0,
  blast: 0,
  kinetic: 0,
  evasion: 0,
  purge: 0,
});

/**
 * Registra uma reação provocada PELO JOGADOR.
 *
 * Só conta o que ele causou. Um incêndio que o Portador de Esporos começou
 * sozinho não ensina nada sobre o jogador, e deixá-lo contar faria a oferta do
 * poço descrever o comportamento dos inimigos em vez do dele.
 */
export const recordResonance = (tally: ResonanceTally, kind: ResonanceKind, amount = 1): void => {
  // Teto por tipo: sem ele, uma poça grande de biofluido eletrificada uma vez
  // somaria cinquenta células e afogaria todo o resto do registro. O que a oferta
  // precisa saber é COM QUE FREQUÊNCIA o jogador recorre a cada reação, não o
  // tamanho do maior acidente que ele causou.
  tally[kind] = Math.min(RESONANCE_CAP, tally[kind] + amount);
};

const RESONANCE_CAP = 999;

/**
 * As duas habilidades que os Ecos demonstram no poço.
 *
 * Ordena as reações pelo que o jogador mais provocou e devolve as duas primeiras
 * habilidades que ele ainda não está usando. Empate é desfeito pela seed do setor
 * — não por `Math.random()`, que quebraria o replay.
 *
 * Devolve menos de duas (ou nenhuma) quando não há candidata: sem ressonância
 * nenhuma o Veio não tem o que demonstrar, e um poço que sempre oferece algo
 * transformaria a oferta em corredor obrigatório.
 */
export const resonanceOffers = (
  tally: ResonanceTally,
  current: AbilityId,
  seed: number,
  sector: number,
): AbilityId[] => {
  const candidates = (Object.keys(ABILITY_DEFINITIONS) as AbilityId[])
    .filter((id) => id !== current)
    .map((id) => {
      const { resonance: kind, threshold } = ABILITY_DEFINITIONS[id];
      // Normalise by the unlock threshold: one spent purge is not drowned by six dodges.
      return { id, score: kind && tally[kind] >= threshold ? tally[kind] / threshold : -1 };
    })
    // O pulso tem score -1 e some aqui: ele é o ponto de partida, não um prêmio.
    .filter((entry) => entry.score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      // Desempate determinístico: mesma run, mesmo setor, mesma oferta.
      const ta = Math.imul(seed ^ Math.imul(sector + 1, 0x9e3779b9), a.id.length + 1) >>> 0;
      const tb = Math.imul(seed ^ Math.imul(sector + 1, 0x9e3779b9), b.id.length + 1) >>> 0;
      return ta === tb ? a.id.localeCompare(b.id) : ta - tb;
    });
  return candidates.slice(0, 2).map((entry) => entry.id);
};

/**
 * O Eco garantido do primeiro setor.
 *
 * `resonanceOffers` devolve vazio quando o jogador nao provocou reacao nenhuma
 * — regra certa nos setores fundos ("o Veio so demonstra o que observou") e
 * errada no primeiro contato: um poco calado na primeira descida ensina que o
 * poco nao oferece nada. Sorteio deterministico pela seed, entre as
 * habilidades que nao sao a equipada nem o pulso inicial: mesma run, mesmo
 * Eco, nas duas maquinas da sala e no replay.
 */
export const fallbackOffer = (current: AbilityId, seed: number, sector: number): AbilityId => {
  // First contact demonstrates only the original elemental kit. New echoes must be earned.
  const pool = (['flamethrower', 'seeker', 'arc'] as AbilityId[]).filter((id) => id !== current);
  const roll = Math.imul(seed ^ Math.imul(sector + 1, 0x9e3779b9), 0x85ebca6b) >>> 0;
  return pool[roll % pool.length];
};

/**
 * Geometria e números de cada habilidade, num lugar só.
 *
 * Sem `as const`: os valores viram tipos literais e qualquer variável iniciada a
 * partir deles passa a recusar outro número, o que transforma um alcance em uma
 * constante de tipo.
 */
export const ABILITY_SHAPE = {
  pulse: { radius: ABILITY_RADIUS, knockback: ABILITY_KNOCKBACK },
  seismic: { radius: SEISMIC_RADIUS, damage: SEISMIC_DAMAGE, stun: SEISMIC_STUN_TICKS },
  slipstream: { ticks: SLIPSTREAM_TICKS },
  vent: { radius: VENT_RADIUS },
  flamethrower: { range: FLAMETHROWER_RANGE, arc: FLAMETHROWER_ARC },
  seeker: { damage: SEEKER_DAMAGE, speed: SEEKER_SPEED, ttl: SEEKER_TTL },
  arc: { range: ARC_CHAIN_RANGE, damage: ARC_DAMAGE, maxTargets: ARC_MAX_TARGETS },
};

/** An offer explains the actual qualifying action, including the teaching fallback. */
export const echoUnlock = (
  id: AbilityId,
  tally: ResonanceTally,
  slot: number,
  fallback = false,
): EchoUnlock => {
  const { resonance, threshold } = abilityDefinition(id);
  return {
    kind: fallback || resonance === null ? 'first_descent' : resonance,
    amount: fallback || resonance === null ? 0 : tally[resonance],
    required: fallback ? 0 : threshold,
    slot,
  };
};

/** Same eligibility in the authoritative sim and in the card UI. */
export const canChooseEcho = (
  state: SurvivalState,
  slot = state.players.indexOf(state.player),
): boolean => {
  const player = state.players[slot],
    extra = state.playerExtras[slot];
  return (
    state.phase === 'running' &&
    !!player?.alive &&
    !!extra?.joined &&
    !extra.downed &&
    !extra.frostbitten &&
    extra.cocoonUntil <= state.tick &&
    player.stunnedUntil <= state.tick &&
    !extra.pendingModuleChoice &&
    state.wellOffers.some((offer) => offer.takenBy === null) &&
    Math.hypot(player.x - state.corePos.x - 0.5, player.y - state.corePos.y - 0.5) <=
      WELL_CHOICE_REACH
  );
};
