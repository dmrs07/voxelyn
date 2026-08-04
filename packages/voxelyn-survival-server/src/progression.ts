// As regras AUTORITATIVAS da Matriz Geracional.
//
// Tudo aqui e funcao pura sobre o perfil: nenhuma consulta, nenhum relogio,
// nenhum efeito. A razao e a mesma que faz o leaderboard re-simular em vez de
// acreditar — a decisao precisa ser reproduzivel e testavel sem banco por perto,
// e o store precisa poder aplica-la dentro de uma transacao sem ter opiniao
// sobre economia.
//
// A divisao de trabalho:
//
//   progression.ts        decide (puro)
//   progression-store.ts  persiste o que foi decidido (atomico)
//   progression-http.ts   traduz HTTP e protege a rota
//
// O cliente nao aparece em lugar nenhum dessa lista. Custo, pre-requisito,
// saldo, geracao e lore saem SEMPRE do catalogo compilado no servidor; o que
// chega na requisicao e, no maximo, a intencao de comprar um id.

import {
  deriveGeneration,
  derivePlayerTuning,
  findUpgrade,
  generationsReached,
  isValidUpgradeSet,
  normalizeUpgradeIds,
  UPGRADES,
  type EnemyArchetype,
  type LoreFragmentId,
  type PlayerTuning,
  type ProspectorGeneration,
  type RunPhase,
  type UpgradeId,
} from '@voxelyn/survival-sim';
import type {
  LoreIndex,
  ProgressionErrorCode,
  PublicProgressionProfile,
} from '@voxelyn/survival-protocol';
import {
  ASSET_ARCHETYPES,
  DEFAULT_UNLOCKED_LORE,
  findLoreFragment,
  LORE_DISCOVERY_BITS,
  LORE_DISCOVERY_MASK,
  triggerMentionsArchetype,
  triggerMentionsDiscovery,
  unlockedLoreFor,
  type LoreFacts,
} from './progression-lore.js';

export type ProgressionWallet = { ore: number; cores: number };

export type ProgressionStatistics = {
  oreHomologated: number;
  oreLost: number;
  coresRecovered: number;
  successfulReturns: number;
  failedExpeditions: number;
  upgradesPurchased: number;
};

/** O perfil como o SERVIDOR o guarda. `generation` nao esta aqui: e derivada. */
export type StoredProfile = {
  profileId: string;
  schemaVersion: number;
  profileVersion: number;
  wallet: ProgressionWallet;
  purchasedUpgradeIds: UpgradeId[];
  unlockedLoreFragmentIds: LoreFragmentId[];
  /**
   * Ativos e Descobertas CONFIRMADOS por liquidacao re-simulada.
   *
   * Sao fatos narrativos, nao economia — mas moram no perfil autoritativo pela
   * mesma razao que a carteira: o Registro local do navegador e editavel, e um
   * documento corporativo liberado por um localStorage adulterado deixaria de
   * ser recompensa. Perfis anteriores a esta versao comecam com os dois vazios
   * e a progressao narrativa passa a contar da PROXIMA run liquidada — nada e
   * importado do Registro local, por politica (ver spec 2026-08-04).
   */
  knownArchetypes: EnemyArchetype[];
  /** Bitmask de DISCOVERY_*, restrita aos bits que o Codex reconhece. */
  discoveries: number;
  /** Estado de leitura do Codex. Nunca entra em hash; sempre ⊆ unlocked. */
  readLoreFragmentIds: LoreFragmentId[];
  statistics: ProgressionStatistics;
  createdAt: string;
  updatedAt: string;
};

export const PROFILE_SCHEMA_VERSION = 1;

export const emptyStatistics = (): ProgressionStatistics => ({
  oreHomologated: 0,
  oreLost: 0,
  coresRecovered: 0,
  successfulReturns: 0,
  failedExpeditions: 0,
  upgradesPurchased: 0,
});

/**
 * Um perfil novo comeca ZERADO. Nao existe importacao de saldo local.
 *
 * A feature esta nascendo: nao ha saldo legitimo anterior a importar, e aceitar
 * um numero vindo do navegador na primeira sessao seria abrir, no dia um, o
 * buraco que toda a arquitetura autoritativa existe para fechar.
 */
export const newProfile = (profileId: string, now: string): StoredProfile => ({
  profileId,
  schemaVersion: PROFILE_SCHEMA_VERSION,
  profileVersion: 1,
  wallet: { ore: 0, cores: 0 },
  purchasedUpgradeIds: [],
  unlockedLoreFragmentIds: [...DEFAULT_UNLOCKED_LORE],
  knownArchetypes: [],
  discoveries: 0,
  readLoreFragmentIds: [],
  statistics: emptyStatistics(),
  createdAt: now,
  updatedAt: now,
});

// ---------------------------------------------------------------------------
// Derivacoes
// ---------------------------------------------------------------------------

/** Ordena e deduplica pela lista canonica; descarta o que o Codex nao conhece. */
export const normalizeArchetypes = (
  archetypes: readonly EnemyArchetype[] | undefined,
): EnemyArchetype[] => {
  const seen = new Set(archetypes ?? []);
  return ASSET_ARCHETYPES.filter((a) => seen.has(a));
};

/** Os fatos narrativos de um perfil, prontos para avaliar gatilhos. */
export const factsFor = (
  purchased: readonly UpgradeId[],
  knownArchetypes: readonly EnemyArchetype[],
  discoveries: number,
): LoreFacts => ({
  purchasedUpgradeIds: new Set(normalizeUpgradeIds(purchased)),
  generations: new Set(generationsReached(purchased)),
  knownArchetypes: new Set(normalizeArchetypes(knownArchetypes)),
  discoveries: discoveries & LORE_DISCOVERY_MASK,
});

/**
 * Quais fragmentos este perfil DEVERIA ter, derivado dos fatos.
 *
 * Existe para REPARAR: a lista materializada e conveniencia de leitura, e a
 * verdade sao os fatos (arvore comprada, Ativos conhecidos, Descobertas). Um
 * perfil que perdeu um unlock por falha parcial volta ao lugar na proxima
 * leitura, em vez de exigir intervencao manual.
 */
export const expectedLoreIds = (
  purchased: readonly UpgradeId[],
  knownArchetypes: readonly EnemyArchetype[] = [],
  discoveries = 0,
): LoreFragmentId[] => unlockedLoreFor(factsFor(purchased, knownArchetypes, discoveries));

/**
 * Higieniza um perfil vindo do armazenamento.
 *
 * Roda na LEITURA, e nao so na escrita: um registro pode ter envelhecido mal
 * (protocolo removido do catalogo, unlock perdido por falha parcial, saldo
 * negativo por bug antigo, campo narrativo que ainda nao existia quando a
 * linha foi gravada), e a alternativa a reparar e servir dado inconsistente
 * para a interface e para a emissao de ticket.
 */
export const sanitizeProfile = (profile: StoredProfile): StoredProfile => {
  const purchased = normalizeUpgradeIds(profile.purchasedUpgradeIds);
  const valid = isValidUpgradeSet(purchased) ? purchased : repairTree(purchased);
  const knownArchetypes = normalizeArchetypes(profile.knownArchetypes);
  const discoveries = (profile.discoveries ?? 0) & LORE_DISCOVERY_MASK;
  const unlocked = expectedLoreIds(valid, knownArchetypes, discoveries);
  const unlockedSet = new Set(unlocked);
  return {
    ...profile,
    wallet: {
      ore: Math.max(0, Math.floor(profile.wallet?.ore ?? 0)),
      cores: Math.max(0, Math.floor(profile.wallet?.cores ?? 0)),
    },
    purchasedUpgradeIds: valid,
    unlockedLoreFragmentIds: unlocked,
    knownArchetypes,
    discoveries,
    // Lido ⊆ desbloqueado, SEMPRE: um documento bloqueado nao pode constar
    // como lido, senao ele nasceria sem bolinha quando abrir de verdade.
    readLoreFragmentIds: (profile.readLoreFragmentIds ?? []).filter((id) => unlockedSet.has(id)),
    statistics: { ...emptyStatistics(), ...profile.statistics },
  };
};

/** Descarta protocolos cujo pre-requisito sumiu. Conservador: so remove. */
const repairTree = (purchased: readonly UpgradeId[]): UpgradeId[] => {
  const owned = new Set(purchased);
  let changed = true;
  while (changed) {
    changed = false;
    for (const id of [...owned]) {
      const def = findUpgrade(id);
      if (def?.prerequisite && !owned.has(def.prerequisite)) {
        owned.delete(id);
        changed = true;
      }
    }
  }
  return normalizeUpgradeIds([...owned]);
};

/**
 * O indice "Ver docs": para cada Ativo conhecido e Descoberta feita, os
 * fragmentos JA DESBLOQUEADOS cujo gatilho fala deles (direto ou compound).
 *
 * Derivado aqui, e nao embutido no bundle do cliente: um mapa estatico
 * archetype→codigo entregaria, pelo prefixo, o ato de documentos que o perfil
 * ainda nao pode ler.
 */
export const loreIndexFor = (profile: StoredProfile): LoreIndex => {
  const assets: LoreIndex['assets'] = {};
  const discoveries: LoreIndex['discoveries'] = {};
  const unlockedDefs = profile.unlockedLoreFragmentIds
    .map((id) => findLoreFragment(id))
    .filter((def) => def !== undefined);
  for (const archetype of normalizeArchetypes(profile.knownArchetypes)) {
    const ids = unlockedDefs
      .filter((def) => triggerMentionsArchetype(def.trigger, archetype))
      .map((def) => def.id);
    if (ids.length > 0) assets[archetype] = ids;
  }
  for (const bit of LORE_DISCOVERY_BITS) {
    if ((profile.discoveries & bit) === 0) continue;
    const ids = unlockedDefs
      .filter((def) => triggerMentionsDiscovery(def.trigger, bit))
      .map((def) => def.id);
    if (ids.length > 0) discoveries[String(bit)] = ids;
  }
  return { assets, discoveries };
};

export const publicProfile = (profile: StoredProfile): PublicProgressionProfile => ({
  profileId: profile.profileId,
  profileVersion: profile.profileVersion,
  wallet: { ...profile.wallet },
  purchasedUpgradeIds: [...profile.purchasedUpgradeIds],
  generation: deriveGeneration(profile.purchasedUpgradeIds),
  unlockedLoreFragmentIds: [...profile.unlockedLoreFragmentIds],
  readLoreFragmentIds: [...profile.readLoreFragmentIds],
  knownAssetArchetypes: [...profile.knownArchetypes],
  discoveries: profile.discoveries,
  loreIndex: loreIndexFor(profile),
  statistics: { ...profile.statistics },
});

export const tuningForProfile = (profile: StoredProfile): PlayerTuning =>
  derivePlayerTuning(profile.purchasedUpgradeIds);

// ---------------------------------------------------------------------------
// Ledger
// ---------------------------------------------------------------------------

export type LedgerEntryBase = {
  id: string;
  profileId: string;
  oreDelta: number;
  coreDelta: number;
  balanceAfter: ProgressionWallet;
  createdAt: string;
};

export type ProgressionLedgerEntry =
  | (LedgerEntryBase & {
      type: 'run_settlement';
      runId: string;
      metadata: { phase: RunPhase; seed: number; simulationVersion: number; durationTicks: number };
    })
  | (LedgerEntryBase & {
      type: 'upgrade_purchase';
      purchaseId: string;
      upgradeId: UpgradeId;
      metadata: { unlockedLoreFragmentId: LoreFragmentId };
    });

// ---------------------------------------------------------------------------
// Decisoes
// ---------------------------------------------------------------------------

/**
 * A recompensa, calculada SOMENTE a partir do replay canonico.
 *
 * Nenhum parametro desta funcao pode vir do cliente: `phase` e `cargoOre` saem
 * do estado terminal que o servidor re-simulou. E o coracao da politica —
 * morrer perde tudo, extrair salva o minerio, e so o nucleo compra futuro.
 */
export type RunReward = { ore: number; cores: number; lost: number };

export const rewardFor = (phase: RunPhase, cargoOre: number): RunReward => {
  switch (phase) {
    case 'extracted':
      return { ore: cargoOre, cores: 0, lost: 0 };
    case 'extracted_with_core':
      return { ore: cargoOre, cores: 1, lost: 0 };
    case 'dead':
      return { ore: 0, cores: 0, lost: cargoOre };
    // Uma run que nao terminou nao e liquidavel; quem chama ja barrou antes.
    default:
      return { ore: 0, cores: 0, lost: 0 };
  }
};

/**
 * O que a re-simulacao CONTOU sobre a run, alem da recompensa.
 *
 * `kills` e `discoveries` saem de `summary.stats` do replay canonico — nunca
 * do corpo da requisicao. Sao o unico caminho pelo qual um Ativo vira
 * conhecido e uma Descoberta vira fato no perfil autoritativo.
 */
export type SettlementFacts = {
  kills: Partial<Record<EnemyArchetype, number>>;
  discoveries: number;
};

const NO_FACTS: SettlementFacts = { kills: {}, discoveries: 0 };

/**
 * O perfil depois de uma liquidacao. PURO: quem persiste e o store.
 *
 * Alem de carteira e estatisticas, incorpora os fatos narrativos: arquetipos
 * com abate viram conhecidos, bits de descoberta acumulam por OR, e a lista de
 * documentos desbloqueados e RE-DERIVADA dos fatos novos — o desbloqueio nao e
 * um passo separado que possa falhar sozinho. Uniao e OR sao idempotentes, e a
 * barreira de `runId` unico no store garante que nada conta duas vezes.
 */
export const applySettlement = (
  profile: StoredProfile,
  phase: RunPhase,
  reward: RunReward,
  now: string,
  facts: SettlementFacts = NO_FACTS,
): StoredProfile => {
  // Defensivo contra registro velho: uma linha gravada antes destes campos
  // existirem chega sem eles, e a liquidacao nao pode falhar por isso.
  const kills = facts.kills ?? {};
  const killed = ASSET_ARCHETYPES.filter((a) => (kills[a] ?? 0) > 0);
  const knownArchetypes = normalizeArchetypes([...(profile.knownArchetypes ?? []), ...killed]);
  const discoveries =
    ((profile.discoveries ?? 0) | (facts.discoveries ?? 0)) & LORE_DISCOVERY_MASK;
  return {
    ...profile,
    profileVersion: profile.profileVersion + 1,
    wallet: {
      ore: profile.wallet.ore + reward.ore,
      cores: profile.wallet.cores + reward.cores,
    },
    knownArchetypes,
    discoveries,
    unlockedLoreFragmentIds: expectedLoreIds(
      profile.purchasedUpgradeIds,
      knownArchetypes,
      discoveries,
    ),
    statistics: {
      ...profile.statistics,
      oreHomologated: profile.statistics.oreHomologated + reward.ore,
      oreLost: profile.statistics.oreLost + reward.lost,
      coresRecovered: profile.statistics.coresRecovered + reward.cores,
      successfulReturns: profile.statistics.successfulReturns + (phase === 'dead' ? 0 : 1),
      failedExpeditions: profile.statistics.failedExpeditions + (phase === 'dead' ? 1 : 0),
    },
    updatedAt: now,
  };
};

export type PurchaseDecision =
  | { ok: false; error: ProgressionErrorCode }
  | {
      ok: true;
      profile: StoredProfile;
      upgradeId: UpgradeId;
      oreSpent: number;
      coresSpent: number;
      generationBefore: ProspectorGeneration;
      generationAfter: ProspectorGeneration;
      loreFragmentId: LoreFragmentId;
    };

/**
 * A compra, na ordem em que uma compra tem de ser validada.
 *
 * Ordem importa para a MENSAGEM, e nao para a corretude: quem nao tem nem
 * minerio nem nucleo precisa ouvir primeiro que falta minerio, e quem pediu um
 * protocolo sem o anterior precisa ouvir isso antes de qualquer coisa sobre
 * saldo. Um "saldo insuficiente" para um no bloqueado manda o jogador minerar
 * por nada.
 *
 * O debito e integral ou inexistente: nao ha caminho que subtraia minerio e
 * pare antes de gravar o protocolo, porque nada aqui muta — quem chama recebe um
 * perfil NOVO e o persiste inteiro, ou nao persiste nada.
 */
export const decidePurchase = (
  profile: StoredProfile,
  upgradeId: UpgradeId,
  now: string,
): PurchaseDecision => {
  const upgrade = findUpgrade(upgradeId);
  if (!upgrade) return { ok: false, error: 'unknown_upgrade' };
  const owned = new Set(profile.purchasedUpgradeIds);
  if (owned.has(upgrade.id)) return { ok: false, error: 'already_owned' };
  if (upgrade.prerequisite && !owned.has(upgrade.prerequisite)) {
    return { ok: false, error: 'missing_prerequisite' };
  }
  if (profile.wallet.ore < upgrade.oreCost) return { ok: false, error: 'insufficient_ore' };
  if (profile.wallet.cores < upgrade.coreCost) return { ok: false, error: 'insufficient_cores' };

  const purchased = normalizeUpgradeIds([...profile.purchasedUpgradeIds, upgrade.id]);
  const next: StoredProfile = {
    ...profile,
    profileVersion: profile.profileVersion + 1,
    wallet: {
      ore: profile.wallet.ore - upgrade.oreCost,
      cores: profile.wallet.cores - upgrade.coreCost,
    },
    purchasedUpgradeIds: purchased,
    // O desbloqueio nao e um passo separado que possa falhar sozinho: ele sai da
    // MESMA derivacao, no mesmo objeto que o store vai gravar. Comprar sem lore,
    // ou lore sem compra, nao tem por onde acontecer.
    unlockedLoreFragmentIds: expectedLoreIds(
      purchased,
      profile.knownArchetypes,
      profile.discoveries,
    ),
    statistics: {
      ...profile.statistics,
      upgradesPurchased: profile.statistics.upgradesPurchased + 1,
    },
    updatedAt: now,
  };

  return {
    ok: true,
    profile: next,
    upgradeId: upgrade.id,
    oreSpent: upgrade.oreCost,
    coresSpent: upgrade.coreCost,
    generationBefore: deriveGeneration(profile.purchasedUpgradeIds),
    generationAfter: deriveGeneration(purchased),
    loreFragmentId: upgrade.loreFragmentId,
  };
};

export type MarkReadDecision =
  | { ok: false; error: ProgressionErrorCode }
  | { ok: true; profile: StoredProfile; changed: boolean };

/**
 * Marca UM documento como lido. Idempotente e puro.
 *
 * So um documento desbloqueado pode virar lido — a mesma resposta 404 do GET
 * cobre inexistente e nao autorizado, para nao mapear o catalogo de graca.
 *
 * `profileVersion` NAO sobe: leitura e estado de apresentacao persistido, e
 * bumpa-la faria toda abertura de documento derrubar uma compra concorrente
 * em 409 sem nenhum ganho de integridade (a lista so cresce, e a uniao e
 * idempotente).
 */
export const decideMarkRead = (
  profile: StoredProfile,
  fragmentId: LoreFragmentId,
  now: string,
): MarkReadDecision => {
  if (!findLoreFragment(fragmentId) || !profile.unlockedLoreFragmentIds.includes(fragmentId)) {
    return { ok: false, error: 'unknown_upgrade' };
  }
  if (profile.readLoreFragmentIds.includes(fragmentId)) {
    return { ok: true, profile, changed: false };
  }
  return {
    ok: true,
    changed: true,
    profile: {
      ...profile,
      readLoreFragmentIds: [...profile.readLoreFragmentIds, fragmentId],
      updatedAt: now,
    },
  };
};

/** Quantos protocolos existem, para a interface e para os testes de catalogo. */
export const TOTAL_PROTOCOLS = UPGRADES.length;
