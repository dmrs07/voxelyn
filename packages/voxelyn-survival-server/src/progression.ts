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
  type LoreFragmentId,
  type PlayerTuning,
  type ProspectorGeneration,
  type RunPhase,
  type UpgradeId,
} from '@voxelyn/survival-sim';
import type { ProgressionErrorCode, PublicProgressionProfile } from '@voxelyn/survival-protocol';
import { DEFAULT_UNLOCKED_LORE, loreForGeneration } from './progression-lore.js';

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
  statistics: emptyStatistics(),
  createdAt: now,
  updatedAt: now,
});

// ---------------------------------------------------------------------------
// Derivacoes
// ---------------------------------------------------------------------------

/**
 * Quais fragmentos este perfil DEVERIA ter, derivado da arvore.
 *
 * Existe para REPARAR: a lista materializada e conveniencia de leitura, e a
 * verdade e a arvore comprada. Um perfil que perdeu um unlock por falha parcial
 * volta ao lugar na proxima leitura, em vez de exigir intervencao manual.
 */
export const expectedLoreIds = (purchased: readonly UpgradeId[]): LoreFragmentId[] => {
  const ids = new Set<LoreFragmentId>(DEFAULT_UNLOCKED_LORE);
  for (const id of normalizeUpgradeIds(purchased)) {
    const upgrade = findUpgrade(id);
    if (upgrade) ids.add(upgrade.loreFragmentId);
  }
  for (const generation of generationsReached(purchased)) {
    const fragment = loreForGeneration(generation);
    if (fragment) ids.add(fragment);
  }
  return [...ids];
};

/**
 * Higieniza um perfil vindo do armazenamento.
 *
 * Roda na LEITURA, e nao so na escrita: um registro pode ter envelhecido mal
 * (protocolo removido do catalogo, unlock perdido por falha parcial, saldo
 * negativo por bug antigo), e a alternativa a reparar e servir dado
 * inconsistente para a interface e para a emissao de ticket.
 */
export const sanitizeProfile = (profile: StoredProfile): StoredProfile => {
  const purchased = normalizeUpgradeIds(profile.purchasedUpgradeIds);
  const valid = isValidUpgradeSet(purchased) ? purchased : repairTree(purchased);
  return {
    ...profile,
    wallet: {
      ore: Math.max(0, Math.floor(profile.wallet?.ore ?? 0)),
      cores: Math.max(0, Math.floor(profile.wallet?.cores ?? 0)),
    },
    purchasedUpgradeIds: valid,
    unlockedLoreFragmentIds: expectedLoreIds(valid),
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

export const publicProfile = (profile: StoredProfile): PublicProgressionProfile => ({
  profileId: profile.profileId,
  profileVersion: profile.profileVersion,
  wallet: { ...profile.wallet },
  purchasedUpgradeIds: [...profile.purchasedUpgradeIds],
  generation: deriveGeneration(profile.purchasedUpgradeIds),
  unlockedLoreFragmentIds: [...profile.unlockedLoreFragmentIds],
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

/** O perfil depois de uma liquidacao. PURO: quem persiste e o store. */
export const applySettlement = (
  profile: StoredProfile,
  phase: RunPhase,
  reward: RunReward,
  now: string,
): StoredProfile => ({
  ...profile,
  profileVersion: profile.profileVersion + 1,
  wallet: {
    ore: profile.wallet.ore + reward.ore,
    cores: profile.wallet.cores + reward.cores,
  },
  statistics: {
    ...profile.statistics,
    oreHomologated: profile.statistics.oreHomologated + reward.ore,
    oreLost: profile.statistics.oreLost + reward.lost,
    coresRecovered: profile.statistics.coresRecovered + reward.cores,
    successfulReturns: profile.statistics.successfulReturns + (phase === 'dead' ? 0 : 1),
    failedExpeditions: profile.statistics.failedExpeditions + (phase === 'dead' ? 1 : 0),
  },
  updatedAt: now,
});

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
    unlockedLoreFragmentIds: expectedLoreIds(purchased),
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

/** Quantos protocolos existem, para a interface e para os testes de catalogo. */
export const TOTAL_PROTOCOLS = UPGRADES.length;
