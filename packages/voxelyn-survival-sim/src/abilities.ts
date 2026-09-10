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
  SLIPSTREAM_SPEED_MUL,
  SLIPSTREAM_TICKS,
  VENT_COOLDOWN_TICKS,
  VENT_RADIUS,
  WELL_CHOICE_REACH,
  WELL_COMBAT_RADIUS,
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
import {
  LURKER_HIDDEN,
  MINER_MOOD_ENRAGED,
  type AbilityId,
  type EchoUnlock,
  type Entity,
  type ResonanceKind,
  type ResonanceTally,
  type SurvivalState,
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
 * Um numero em (0, 1), deterministico da (seed, setor, id).
 *
 * E o "dado" do draft. Nao e `Math.random()` porque o replay e o co-op
 * precisam tirar o MESMO Eco nas duas maquinas; e nao e a seed crua porque a
 * seed crua daria o mesmo resultado em todo setor da run.
 */
const draftUnit = (seed: number, sector: number, id: string): number => {
  let h = (seed ^ Math.imul(sector + 1, 0x9e3779b9)) >>> 0;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 0x01000193) >>> 0;
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d) >>> 0;
  h ^= h >>> 12;
  return (h + 0.5) / 4294967296;
};

/**
 * As duas habilidades que os Ecos demonstram no poço — um DRAFT, nao um ranking.
 *
 * A versao anterior ordenava pelo que o jogador mais provocou e cortava as
 * duas primeiras. Com tres habilidades isso passava despercebido; com seis,
 * quem desbloqueia todas num setor via SEMPRE as mesmas duas — as outras
 * quatro existiam so na ficha. Um Eco que nunca aparece nao foi desenhado.
 *
 * Agora e um sorteio ponderado sem reposicao (Efraimidis–Spirakis): cada
 * candidata desbloqueada recebe a chave `u^(1/peso)`, com `u` deterministico
 * da (seed, setor, id) e `peso` = 1 + log2(quantas vezes passou do limiar).
 * As duas maiores chaves saem. Tres propriedades, todas testadas:
 *
 * 1. JUSTO: com tudo desbloqueado por igual, cada Eco tem a mesma chance.
 * 2. INCLINADO: o que o jogador mais praticou continua aparecendo mais —
 *    peso maior e chave maior em media —, so nao aparece SEMPRE.
 * 3. DETERMINISTICO: mesma run, mesmo setor, mesma dupla; setores diferentes
 *    da mesma run tiram duplas diferentes.
 *
 * Na tela, a dupla vem com a mais praticada primeiro: a ordem de exibicao e
 * leitura, nao sorte.
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
  const unlocked = (Object.keys(ABILITY_DEFINITIONS) as AbilityId[])
    .filter((id) => id !== current)
    .map((id) => {
      const { resonance: kind, threshold } = ABILITY_DEFINITIONS[id];
      // Normalise by the unlock threshold: one spent purge is not drowned by six dodges.
      // Peso = 1 + log2(vezes acima do limiar): o habito conta, mas nao
      // esmaga. Com a razao crua, doze incendios contra um de cada outro
      // punham o Sopro em 100% dos sorteios — e isso e o ranking de volta.
      const ratio = kind && tally[kind] >= threshold ? tally[kind] / threshold : 0;
      return { id, weight: ratio > 0 ? 1 + Math.log2(ratio) : 0 };
    })
    // O pulso tem peso 0 e some aqui: ele é o ponto de partida, não um prêmio.
    .filter((entry) => entry.weight > 0);
  const drawn = unlocked
    .map((entry) => ({
      ...entry,
      key: Math.pow(draftUnit(seed, sector, entry.id), 1 / entry.weight),
    }))
    .sort((a, b) => b.key - a.key || a.id.localeCompare(b.id))
    .slice(0, 2);
  return drawn
    .sort((a, b) => b.weight - a.weight || a.id.localeCompare(b.id))
    .map((entry) => entry.id);
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
  slipstream: { ticks: SLIPSTREAM_TICKS, speed: SLIPSTREAM_SPEED_MUL },
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

/**
 * Este inimigo e uma AMEACA que segura o poco fechado?
 *
 * A mesma leitura de postura da assistencia de combate (IA-01): o Minerador
 * so conta enfurecido; passivo ou fugindo, ele esta trabalhando ou indo
 * embora. Ninhada e aranhinha nao mordem (contato zero) — sao materia, nao
 * luta. O espreitador ESCONDIDO nao conta de proposito: ele fica enterrado
 * ao lado do poco esperando, e um painel que nunca abre por causa de um bicho
 * que o jogador nao consegue ver nem alcancar seria um bug sem mensagem.
 */
const holdsWellClosed = (enemy: Entity): boolean => {
  if (!enemy.alive) return false;
  if (enemy.archetype === 'miner') return enemy.mood === MINER_MOOD_ENRAGED;
  if (enemy.archetype === 'devourer_brood' || enemy.archetype === 'silk_spiderling') return false;
  if (
    (enemy.archetype === 'mud_lamprey' || enemy.archetype === 'frost_wraith') &&
    (enemy.mood ?? LURKER_HIDDEN) === LURKER_HIDDEN
  ) {
    return false;
  }
  return true;
};

/**
 * O jogador esta EM COMBATE para efeito do poco: ha ameaca viva a menos de
 * `WELL_COMBAT_RADIUS` dele. Exportado porque o cliente pode querer dizer
 * "o poco espera o combate acabar" em vez de simplesmente nao abrir nada.
 */
export const wellInCombat = (
  state: SurvivalState,
  slot = state.players.indexOf(state.player),
): boolean => {
  const player = state.players[slot];
  if (!player) return false;
  return state.enemies.some(
    (enemy) =>
      holdsWellClosed(enemy) &&
      Math.hypot(enemy.x - player.x, enemy.y - player.y) <= WELL_COMBAT_RADIUS,
  );
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
    // Em combate o poco espera: nada de menu no meio da luta.
    !wellInCombat(state, slot) &&
    state.wellOffers.some((offer) => offer.takenBy === null) &&
    Math.hypot(player.x - state.corePos.x - 0.5, player.y - state.corePos.y - 0.5) <=
      WELL_CHOICE_REACH
  );
};
