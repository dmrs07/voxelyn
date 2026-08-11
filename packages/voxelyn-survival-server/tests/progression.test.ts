// As decisoes puras e o store: economia, idempotencia, ledger e concorrencia.
//
// Nada aqui sobe servidor. O que estes testes vigiam e a camada que decide, e
// ela precisa poder ser lida inteira sem banco por perto — a mesma razao pela
// qual o leaderboard tem um store de memoria.

import { describe, expect, it } from 'vitest';
import {
  DISCOVERY_CORE_TAKEN,
  DISCOVERY_GAS_IGNITION,
  DISCOVERY_MINER_FLED,
  UPGRADES,
  deriveGeneration,
  derivePlayerTuning,
  type EnemyArchetype,
} from '@voxelyn/survival-sim';
import {
  applySettlement,
  decideMarkRead,
  decidePurchase,
  expectedLoreIds,
  factsFor,
  loreIndexFor,
  newProfile,
  publicProfile,
  rewardFor,
  sanitizeProfile,
  tuningForProfile,
  type StoredProfile,
} from '../src/progression';
import { MemoryProgressionStore } from '../src/progression-store';
import {
  ASSET_ARCHETYPES,
  ASSET_LORE,
  ASSET_MILESTONE_LORE,
  DEFAULT_UNLOCKED_LORE,
  DISCOVERY_LORE,
  LORE_DISCOVERY_BITS,
  LORE_FRAGMENTS,
  TOTAL_LORE_FRAGMENTS,
  findLoreFragment,
  isValidTrigger,
  loreCoversEveryUpgrade,
  maskCode,
  triggerSatisfied,
} from '../src/progression-lore';
import { LORE_LOCALES, LORE_TEXT } from '../src/progression-lore-text';

const NOW = '2026-08-02T12:00:00.000Z';
let counter = 0;
const idFactory = (): string => `id-${++counter}`;

const profileWith = (ore: number, cores: number, purchased: string[] = []): StoredProfile => ({
  ...newProfile('p1', NOW),
  wallet: { ore, cores },
  purchasedUpgradeIds: purchased,
});

// ---------------------------------------------------------------------------
// Economia
// ---------------------------------------------------------------------------

describe('a recompensa sai da fase, e so dela', () => {
  it('morrer nao credita nada, e registra a perda', () => {
    expect(rewardFor('dead', 27)).toEqual({ ore: 0, cores: 0, lost: 27 });
  });

  it('extrair salva o minerio e nao rende nucleo', () => {
    expect(rewardFor('extracted', 27)).toEqual({ ore: 27, cores: 0, lost: 0 });
  });

  it('extrair com o nucleo rende minerio e exatamente um nucleo', () => {
    expect(rewardFor('extracted_with_core', 27)).toEqual({ ore: 27, cores: 1, lost: 0 });
  });

  it('morrer carregando MUITO continua rendendo zero', () => {
    expect(rewardFor('dead', 9999)).toEqual({ ore: 0, cores: 0, lost: 9999 });
  });

  it('a estatistica separa retorno de perda', () => {
    const base = profileWith(0, 0);
    const died = applySettlement(base, 'dead', rewardFor('dead', 30), NOW);
    expect(died.statistics).toMatchObject({
      oreLost: 30,
      failedExpeditions: 1,
      successfulReturns: 0,
    });
    expect(died.wallet).toEqual({ ore: 0, cores: 0 });

    const returned = applySettlement(
      base,
      'extracted_with_core',
      rewardFor('extracted_with_core', 30),
      NOW,
    );
    expect(returned.wallet).toEqual({ ore: 30, cores: 1 });
    expect(returned.statistics).toMatchObject({
      oreHomologated: 30,
      coresRecovered: 1,
      successfulReturns: 1,
      failedExpeditions: 0,
    });
  });
});

// ---------------------------------------------------------------------------
// Compra
// ---------------------------------------------------------------------------

describe('a compra e do servidor', () => {
  it('aceita quando ha arvore, minerio e nucleo', () => {
    const decision = decidePurchase(profileWith(35, 1), 'CA-01', NOW);
    expect(decision.ok).toBe(true);
    if (!decision.ok) return;
    expect(decision.profile.wallet).toEqual({ ore: 0, cores: 0 });
    expect(decision.profile.purchasedUpgradeIds).toEqual(['CA-01']);
    expect(decision.oreSpent).toBe(35);
    expect(decision.coresSpent).toBe(1);
  });

  it('recusa id inexistente', () => {
    expect(decidePurchase(profileWith(9999, 99), 'ZZ-99', NOW)).toEqual({
      ok: false,
      error: 'unknown_upgrade',
    });
  });

  it('recusa comprar duas vezes', () => {
    expect(decidePurchase(profileWith(9999, 99, ['CA-01']), 'CA-01', NOW)).toEqual({
      ok: false,
      error: 'already_owned',
    });
  });

  // A ordem da validacao existe para a MENSAGEM: "saldo insuficiente" num no
  // bloqueado manda o jogador minerar por nada.
  it('recusa pre-requisito ANTES de falar de saldo', () => {
    expect(decidePurchase(profileWith(0, 0), 'CA-02', NOW)).toEqual({
      ok: false,
      error: 'missing_prerequisite',
    });
  });

  it('recusa minerio antes de nucleo quando faltam os dois', () => {
    expect(decidePurchase(profileWith(0, 0), 'CA-01', NOW)).toEqual({
      ok: false,
      error: 'insufficient_ore',
    });
  });

  // A regra que sustenta a decisao de extrair: minerio sozinho nao compra nada.
  it('minerio de sobra sem nucleo nenhum nao compra o protocolo mais barato', () => {
    expect(decidePurchase(profileWith(99999, 0), 'CA-01', NOW)).toEqual({
      ok: false,
      error: 'insufficient_cores',
    });
  });

  it('custo exato passa', () => {
    const upgrade = UPGRADES.find((u) => u.id === 'RX-X');
    expect(upgrade).toBeDefined();
    const withTree = profileWith(upgrade?.oreCost ?? 0, upgrade?.coreCost ?? 0, [
      'RX-01',
      'RX-02',
      'RX-03',
      'RX-04',
      'RX-05',
    ]);
    const decision = decidePurchase(withTree, 'RX-X', NOW);
    expect(decision.ok).toBe(true);
    if (decision.ok) expect(decision.profile.wallet).toEqual({ ore: 0, cores: 0 });
  });

  it('nao muta o perfil de entrada', () => {
    const before = profileWith(35, 1);
    const snapshot = JSON.stringify(before);
    decidePurchase(before, 'CA-01', NOW);
    expect(JSON.stringify(before)).toBe(snapshot);
  });

  it('a compra sobe a versao do perfil e a geracao quando cruza o limiar', () => {
    const third = decidePurchase(profileWith(85, 1, ['CA-01', 'CA-02']), 'CA-03', NOW);
    expect(third.ok).toBe(true);
    if (!third.ok) return;
    expect(third.generationBefore).toBe('G-00');
    expect(third.generationAfter).toBe('G-01');
    expect(third.profile.profileVersion).toBe(2);
  });

  // Comprar sem lore, ou lore sem compra, nao tem por onde acontecer: as duas
  // saem da mesma derivacao no mesmo objeto.
  it('a compra desbloqueia o fragmento correspondente, sempre', () => {
    for (const upgrade of UPGRADES) {
      const owned = UPGRADES.filter(
        (u) => u.branch === upgrade.branch && u.tier < upgrade.tier,
      ).map((u) => u.id);
      const decision = decidePurchase(profileWith(99999, 99, owned), upgrade.id, NOW);
      expect(decision.ok, upgrade.id).toBe(true);
      if (!decision.ok) continue;
      expect(decision.loreFragmentId).toBe(upgrade.loreFragmentId);
      expect(decision.profile.unlockedLoreFragmentIds).toContain(upgrade.loreFragmentId);
    }
  });
});

// ---------------------------------------------------------------------------
// Perfil
// ---------------------------------------------------------------------------

describe('perfil autoritativo', () => {
  it('nasce zerado — nao existe importacao de saldo local', () => {
    const fresh = newProfile('novo', NOW);
    expect(fresh.wallet).toEqual({ ore: 0, cores: 0 });
    expect(fresh.purchasedUpgradeIds).toEqual([]);
    expect(fresh.unlockedLoreFragmentIds).toEqual([...DEFAULT_UNLOCKED_LORE]);
  });

  it('a geracao e DERIVADA, nunca guardada solta', () => {
    const profile = profileWith(0, 0, ['CA-01', 'CA-02', 'CA-03']);
    expect(publicProfile(profile).generation).toBe(deriveGeneration(profile.purchasedUpgradeIds));
    expect('generation' in profile).toBe(false);
  });

  it('o tuning sai do perfil, e bate com a derivacao da sim', () => {
    const profile = profileWith(0, 0, ['CA-01', 'RX-01']);
    expect(tuningForProfile(profile)).toEqual(derivePlayerTuning(['CA-01', 'RX-01']));
  });

  it('repara arvore invalida em vez de servir dado inconsistente', () => {
    // CA-03 sem CA-02: um registro que envelheceu mal.
    const broken = profileWith(0, 0, ['CA-01', 'CA-03']);
    expect(sanitizeProfile(broken).purchasedUpgradeIds).toEqual(['CA-01']);
  });

  it('repara saldo negativo e unlock perdido', () => {
    const broken: StoredProfile = {
      ...profileWith(-50, -2, ['CA-01']),
      unlockedLoreFragmentIds: [],
    };
    const fixed = sanitizeProfile(broken);
    expect(fixed.wallet).toEqual({ ore: 0, cores: 0 });
    expect(fixed.unlockedLoreFragmentIds).toEqual(expectedLoreIds(['CA-01']));
  });

  it('o perfil publico nao carrega segredo nem ledger', () => {
    const keys = Object.keys(publicProfile(profileWith(10, 1)));
    for (const forbidden of ['token', 'secret', 'ledger', 'schemaVersion']) {
      expect(keys).not.toContain(forbidden);
    }
  });
});

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

describe('liquidacao no store', () => {
  const settle = (
    store: MemoryProgressionStore,
    runId: string,
    phase: 'dead' | 'extracted' | 'extracted_with_core',
    ore: number,
    facts: { kills?: Partial<Record<EnemyArchetype, number>>; discoveries?: number } = {},
  ) =>
    store.settleRun({
      profileId: 'p1',
      runId,
      phase,
      cargoOre: ore,
      kills: facts.kills ?? {},
      discoveries: facts.discoveries ?? 0,
      seed: 7,
      simulationVersion: 19,
      durationTicks: 1200,
      now: NOW,
      idFactory,
    });

  it('credita uma vez e escreve o ledger', async () => {
    const store = new MemoryProgressionStore();
    await store.createProfile('p1', NOW);
    const result = await settle(store, 'run-a', 'extracted_with_core', 27);
    expect('error' in result).toBe(false);
    if ('error' in result) return;
    expect(result.fresh).toBe(true);
    expect(result.profile.wallet).toEqual({ ore: 27, cores: 1 });

    const ledger = await store.ledger('p1');
    expect(ledger).toHaveLength(1);
    expect(ledger[0]).toMatchObject({
      type: 'run_settlement',
      oreDelta: 27,
      coreDelta: 1,
      balanceAfter: { ore: 27, cores: 1 },
    });
  });

  // A rede pode cair depois do POST. Recusar o reenvio puniria o jogador por
  // isso; creditar de novo criaria minerio que nunca existiu.
  it('o mesmo runId enviado duas vezes credita UMA vez', async () => {
    const store = new MemoryProgressionStore();
    await store.createProfile('p1', NOW);
    await settle(store, 'run-a', 'extracted', 40);
    const again = await settle(store, 'run-a', 'extracted', 40);
    expect('error' in again).toBe(false);
    if ('error' in again) return;
    expect(again.fresh).toBe(false);
    expect(again.profile.wallet).toEqual({ ore: 40, cores: 0 });
    expect(await store.ledger('p1')).toHaveLength(1);
  });

  it('duas liquidacoes concorrentes do mesmo runId creditam uma vez', async () => {
    const store = new MemoryProgressionStore();
    await store.createProfile('p1', NOW);
    await Promise.all([
      settle(store, 'run-x', 'extracted', 15),
      settle(store, 'run-x', 'extracted', 15),
    ]);
    const profile = await store.getProfile('p1');
    expect(profile?.wallet).toEqual({ ore: 15, cores: 0 });
    expect(await store.ledger('p1')).toHaveLength(1);
  });

  it('runIds diferentes creditam separadamente', async () => {
    const store = new MemoryProgressionStore();
    await store.createProfile('p1', NOW);
    await settle(store, 'run-a', 'extracted', 10);
    await settle(store, 'run-b', 'extracted_with_core', 5);
    const profile = await store.getProfile('p1');
    expect(profile?.wallet).toEqual({ ore: 15, cores: 1 });
  });

  it('uma morte tambem e liquidada: zero creditado, perda registrada', async () => {
    const store = new MemoryProgressionStore();
    await store.createProfile('p1', NOW);
    const result = await settle(store, 'run-morte', 'dead', 33);
    if ('error' in result) throw new Error('inesperado');
    expect(result.reward).toEqual({ ore: 0, cores: 0, lost: 33 });
    expect(result.profile.wallet).toEqual({ ore: 0, cores: 0 });
    expect(result.profile.statistics.oreLost).toBe(33);
    // O runId fica fechado: nao da para tentar de novo com outro log.
    const retry = await settle(store, 'run-morte', 'extracted_with_core', 33);
    if ('error' in retry) throw new Error('inesperado');
    expect(retry.fresh).toBe(false);
    expect(retry.profile.wallet).toEqual({ ore: 0, cores: 0 });
  });

  it('perfil inexistente nao liquida', async () => {
    const store = new MemoryProgressionStore();
    const result = await settle(store, 'run-a', 'extracted', 10);
    expect(result).toEqual({ error: 'unauthenticated' });
  });
});

describe('compra no store', () => {
  const buy = (store: MemoryProgressionStore, upgradeId: string, version: number, key: string) =>
    store.purchase({
      profileId: 'p1',
      upgradeId,
      expectedProfileVersion: version,
      idempotencyKey: key,
      now: NOW,
      idFactory,
    });

  const funded = async (): Promise<MemoryProgressionStore> => {
    const store = new MemoryProgressionStore();
    await store.createProfile('p1', NOW);
    await store.settleRun({
      profileId: 'p1',
      runId: 'seed-run',
      phase: 'extracted_with_core',
      cargoOre: 500,
      kills: {},
      discoveries: 0,
      seed: 1,
      simulationVersion: 19,
      durationTicks: 100,
      now: NOW,
      idFactory,
    });
    return store;
  };

  it('debita e registra, com ledger', async () => {
    const store = await funded();
    const profile = await store.getProfile('p1');
    const result = await buy(store, 'CA-01', profile?.profileVersion ?? 0, 'key-0001');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.profile.wallet).toEqual({ ore: 465, cores: 0 });
    const ledger = await store.ledger('p1');
    expect(ledger.at(-1)).toMatchObject({
      type: 'upgrade_purchase',
      oreDelta: -35,
      coreDelta: -1,
      balanceAfter: { ore: 465, cores: 0 },
    });
  });

  it('versao antiga recebe conflito em vez de comprar contra numeros velhos', async () => {
    const store = await funded();
    const result = await buy(store, 'CA-01', 1, 'key-old-01');
    expect(result).toEqual({ ok: false, error: 'profile_version_conflict' });
  });

  // A regressao mais cara desta feature, e ela so existia no caminho Postgres:
  // a chave de idempotencia era gravada ANTES da checagem de versao, e a recusa
  // saia por `return` — que COMMITA. A chave ficava envenenada: o retry seguinte
  // a encontrava, respondia `replayed: true`, e o jogador via um protocolo que
  // nunca foi debitado nem concedido.
  //
  // O store de memoria nunca teve o bug (ele decide antes de escrever), mas o
  // invariante e o mesmo nos dois e e aqui que ele fica escrito: uma compra
  // recusada nao deixa rastro, e a MESMA chave continua servindo depois.
  it('uma compra recusada por conflito nao envenena a chave de idempotencia', async () => {
    const store = await funded();
    const version = (await store.getProfile('p1'))?.profileVersion ?? 0;

    const stale = await buy(store, 'CA-01', version - 1, 'key-veneno-01');
    expect(stale).toEqual({ ok: false, error: 'profile_version_conflict' });

    // Nada foi gravado: nem compra, nem ledger, nem debito.
    const afterConflict = await store.getProfile('p1');
    expect(afterConflict?.purchasedUpgradeIds).toEqual([]);
    expect(afterConflict?.profileVersion).toBe(version);
    expect(await store.ledger('p1')).toHaveLength(1); // so a liquidacao inicial

    // E a mesma chave ainda funciona, agora com a versao certa.
    const retry = await buy(store, 'CA-01', version, 'key-veneno-01');
    expect(retry.ok).toBe(true);
    if (!retry.ok) return;
    expect(retry.replayed).toBe(false);
    expect(retry.profile.purchasedUpgradeIds).toEqual(['CA-01']);
  });

  it('uma compra recusada por saldo tambem nao deixa rastro', async () => {
    const store = new MemoryProgressionStore();
    await store.createProfile('p1', NOW);
    const version = (await store.getProfile('p1'))?.profileVersion ?? 0;
    const broke = await buy(store, 'CA-01', version, 'key-sem-saldo-1');
    expect(broke).toEqual({ ok: false, error: 'insufficient_ore' });
    expect(await store.ledger('p1')).toHaveLength(0);
    expect((await store.getProfile('p1'))?.profileVersion).toBe(version);
  });

  it('a mesma idempotencyKey nao compra duas vezes', async () => {
    const store = await funded();
    const version = (await store.getProfile('p1'))?.profileVersion ?? 0;
    await buy(store, 'CA-01', version, 'key-dup-01');
    const again = await buy(store, 'CA-01', version, 'key-dup-01');
    expect(again.ok).toBe(true);
    if (!again.ok) return;
    expect(again.replayed).toBe(true);
    const profile = await store.getProfile('p1');
    expect(profile?.purchasedUpgradeIds).toEqual(['CA-01']);
    expect(profile?.wallet.ore).toBe(465);
  });

  // Duas abas clicando junto. Uma grava; a outra encontra a versao mudada.
  it('duas compras concorrentes nao estouram o saldo', async () => {
    const store = new MemoryProgressionStore();
    await store.createProfile('p1', NOW);
    await store.settleRun({
      profileId: 'p1',
      runId: 'exato',
      phase: 'extracted_with_core',
      // Da para UMA compra de 35, e nao duas.
      cargoOre: 35,
      kills: {},
      discoveries: 0,
      seed: 1,
      simulationVersion: 19,
      durationTicks: 10,
      now: NOW,
      idFactory,
    });
    const version = (await store.getProfile('p1'))?.profileVersion ?? 0;
    const [a, b] = await Promise.all([
      buy(store, 'CA-01', version, 'key-race-a1'),
      buy(store, 'MV-01', version, 'key-race-b1'),
    ]);
    expect([a.ok, b.ok].filter(Boolean)).toHaveLength(1);
    const profile = await store.getProfile('p1');
    expect(profile?.wallet.ore).toBe(0);
    expect(profile?.wallet.cores).toBe(0);
    expect(profile?.purchasedUpgradeIds).toHaveLength(1);
  });

  it('o saldo nunca fica negativo, mesmo com muitas tentativas', async () => {
    const store = await funded();
    for (let i = 0; i < 40; i++) {
      const version = (await store.getProfile('p1'))?.profileVersion ?? 0;
      await buy(store, UPGRADES[i % UPGRADES.length].id, version, `key-loop-${i}0`);
      const profile = await store.getProfile('p1');
      expect(profile?.wallet.ore).toBeGreaterThanOrEqual(0);
      expect(profile?.wallet.cores).toBeGreaterThanOrEqual(0);
    }
  });

  it('o saldo materializado bate com o ledger reconstruido', async () => {
    const store = await funded();
    for (const [i, id] of ['CA-01', 'CA-02', 'MV-01'].entries()) {
      const version = (await store.getProfile('p1'))?.profileVersion ?? 0;
      await buy(store, id, version, `key-rebuild-${i}0`);
    }
    const ledger = await store.ledger('p1');
    const rebuilt = ledger.reduce(
      (acc, entry) => ({ ore: acc.ore + entry.oreDelta, cores: acc.cores + entry.coreDelta }),
      { ore: 0, cores: 0 },
    );
    expect(rebuilt).toEqual((await store.getProfile('p1'))?.wallet);
  });

  it('todo delta do ledger e inteiro', async () => {
    const store = await funded();
    const version = (await store.getProfile('p1'))?.profileVersion ?? 0;
    await buy(store, 'CA-01', version, 'key-int-0001');
    for (const entry of await store.ledger('p1')) {
      expect(Number.isInteger(entry.oreDelta)).toBe(true);
      expect(Number.isInteger(entry.coreDelta)).toBe(true);
      expect(Number.isInteger(entry.balanceAfter.ore)).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// Codex
// ---------------------------------------------------------------------------

describe('codex', () => {
  it('tem 128 documentos: 30 protocolos, 8 por geracao, 47 de Ativo, 25 Descobertas, 17 compostos e o publico', () => {
    expect(TOTAL_LORE_FRAGMENTS).toBe(128);
    // A contagem de Ativo = 15 fichas + as trilhas de ASSET_MILESTONE_LORE,
    // derivada e nao chutada: se um arco ganhar um degrau, o teste acompanha.
    expect(TOTAL_LORE_FRAGMENTS).toBe(30 + 8 + 1 + 23 + ASSET_MILESTONE_LORE.length + 25 + 17);
    expect(LORE_FRAGMENTS.filter((f) => f.trigger.kind === 'upgrade')).toHaveLength(30);
    // OITO por geracao: os quatro marcos de homologacao do chassi
    // (`AX-GEN-*`) e as quatro autorizacoes de descida, que sao documentos
    // sobre o VEIO e nao sobre a unidade — mesmo gatilho, assuntos distintos.
    expect(LORE_FRAGMENTS.filter((f) => f.trigger.kind === 'generation')).toHaveLength(8);
    expect(LORE_FRAGMENTS.filter((f) => f.trigger.kind === 'asset')).toHaveLength(
      23 + ASSET_MILESTONE_LORE.length,
    );
    expect(LORE_FRAGMENTS.filter((f) => f.trigger.kind === 'discovery')).toHaveLength(25);
    // Quatro dos seis compostos sao o arco do Bispo: ele aparece uma vez por
    // run, entao a revelacao dele sai de ENTENDER o encontro (viu a cura,
    // sobreviveu a Supernova) e nunca de repetir o abate.
    expect(LORE_FRAGMENTS.filter((f) => f.trigger.kind === 'compound')).toHaveLength(17);
    expect(DEFAULT_UNLOCKED_LORE).toHaveLength(1);
  });

  it('todo Ativo tem documento, e toda Descoberta tambem', () => {
    for (const archetype of ASSET_ARCHETYPES) {
      expect(findLoreFragment(ASSET_LORE[archetype]), archetype).toBeDefined();
    }
    for (const { bit, fragmentId } of DISCOVERY_LORE) {
      expect(findLoreFragment(fragmentId), `bit ${bit}`).toBeDefined();
    }
    // Um documento por bit, sem bit repetido.
    expect(new Set(DISCOVERY_LORE.map((d) => d.bit)).size).toBe(DISCOVERY_LORE.length);
    expect(new Set(Object.values(ASSET_LORE)).size).toBe(ASSET_ARCHETYPES.length);
  });

  it('todo gatilho do catalogo e valido', () => {
    for (const fragment of LORE_FRAGMENTS) {
      expect(isValidTrigger(fragment.trigger), fragment.id).toBe(true);
    }
  });

  it('cada protocolo tem exatamente um fragmento, e cada fragmento um dono', () => {
    expect(loreCoversEveryUpgrade()).toBe(true);
    const ids = LORE_FRAGMENTS.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('toda referencia de "arquivo relacionado" existe', () => {
    for (const fragment of LORE_FRAGMENTS) {
      for (const related of fragment.relatedFragmentIds) {
        expect(findLoreFragment(related), `${fragment.id} -> ${related}`).toBeDefined();
      }
    }
  });

  it('a cronologia cobre todos os documentos, sem buraco nem repeticao', () => {
    const indices = LORE_FRAGMENTS.map((f) => f.chronologyIndex).sort((a, b) => a - b);
    expect(indices).toEqual([...Array(TOTAL_LORE_FRAGMENTS).keys()]);
  });

  it('todo documento tem texto completo nos dois idiomas', () => {
    for (const locale of LORE_LOCALES) {
      for (const fragment of LORE_FRAGMENTS) {
        const text = LORE_TEXT[locale][fragment.id];
        expect(text, `${locale}/${fragment.id}`).toBeDefined();
        for (const field of ['title', 'summary', 'body', 'source'] as const) {
          expect(text[field].length, `${locale}/${fragment.id}/${field}`).toBeGreaterThan(3);
        }
      }
    }
  });

  it('os desbloqueios derivam dos fatos — um perfil inconsistente e reparavel', () => {
    const allBits = LORE_DISCOVERY_BITS.reduce((m, b) => m | b, 0);
    const allKills = Object.fromEntries(ASSET_ARCHETYPES.map((a) => [a, 99]));
    const full = expectedLoreIds(UPGRADES.map((u) => u.id), allKills, allBits);
    expect(full).toHaveLength(TOTAL_LORE_FRAGMENTS);
    expect(expectedLoreIds([])).toEqual([...DEFAULT_UNLOCKED_LORE]);
  });

  it('um Ativo conhecido abre a ficha dele, e nada alem', () => {
    const ids = expectedLoreIds([], { stalker: 1 }, 0);
    expect(ids).toContain(ASSET_LORE.stalker);
    expect(ids).not.toContain(ASSET_LORE.guardian);
    expect(ids).toHaveLength(DEFAULT_UNLOCKED_LORE.length + 1);
  });

  it('uma Descoberta abre o documento dela, e nada alem', () => {
    const ids = expectedLoreIds([], [], DISCOVERY_GAS_IGNITION);
    expect(ids).toContain('AX-INC-030');
    expect(ids).toHaveLength(DEFAULT_UNLOCKED_LORE.length + 1);
  });

  // O compound do catalogo: Nucleo recuperado E Guardiao conhecido.
  it('o desbloqueio composto exige TODAS as partes', () => {
    expect(expectedLoreIds([], { guardian: 1 }, 0)).not.toContain('AX-UNK-051');
    expect(expectedLoreIds([], {}, DISCOVERY_CORE_TAKEN)).not.toContain('AX-UNK-051');
    expect(expectedLoreIds([], { guardian: 1 }, DISCOVERY_CORE_TAKEN)).toContain('AX-UNK-051');
  });

  it('triggerSatisfied avalia cada tipo de gatilho', () => {
    const facts = factsFor(['CA-01', 'CA-02', 'CA-03'], { miner: 1 }, DISCOVERY_MINER_FLED);
    expect(triggerSatisfied({ kind: 'default' }, facts)).toBe(true);
    expect(triggerSatisfied({ kind: 'upgrade', upgradeId: 'CA-01' }, facts)).toBe(true);
    expect(triggerSatisfied({ kind: 'upgrade', upgradeId: 'MV-01' }, facts)).toBe(false);
    expect(triggerSatisfied({ kind: 'generation', generation: 'G-01' }, facts)).toBe(true);
    expect(triggerSatisfied({ kind: 'generation', generation: 'G-02' }, facts)).toBe(false);
    expect(triggerSatisfied({ kind: 'asset', archetype: 'miner' }, facts)).toBe(true);
    expect(triggerSatisfied({ kind: 'asset', archetype: 'bishop' }, facts)).toBe(false);
    expect(
      triggerSatisfied({ kind: 'discovery', discoveryBit: DISCOVERY_MINER_FLED }, facts),
    ).toBe(true);
    expect(
      triggerSatisfied(
        { kind: 'compound', anyOf: [{ kind: 'asset', archetype: 'miner' }] },
        facts,
      ),
    ).toBe(true);
    // Compound vazio nao abre nada: e erro de catalogo, nao um "sempre aberto".
    expect(triggerSatisfied({ kind: 'compound' }, facts)).toBe(false);
  });

  it('os marcos geracionais entram ao cruzar o limiar', () => {
    const three = UPGRADES.slice(0, 3).map((u) => u.id);
    expect(expectedLoreIds(three)).toContain('AX-GEN-G01');
    expect(expectedLoreIds(UPGRADES.slice(0, 2).map((u) => u.id))).not.toContain('AX-GEN-G01');
  });

  // Saber que existe um 041 e parte do desenho; saber que ele e do ato V nao.
  it('o codigo mascarado esconde o ato e mantem o numero', () => {
    expect(maskCode('AX-UNK-041')).toBe('AX-███-041');
    expect(maskCode('AX-PUB-001')).toBe('AX-███-001');
  });

  it('nenhum corpo de documento vaza pela mascara', () => {
    for (const fragment of LORE_FRAGMENTS) {
      const masked = maskCode(fragment.documentCode);
      expect(masked).not.toContain('PUB');
      expect(masked).not.toContain('UNK');
    }
  });
});

// ---------------------------------------------------------------------------
// Liquidacao narrativa: Ativos e Descobertas saem do replay, e so dele
// ---------------------------------------------------------------------------

describe('liquidacao com fatos narrativos', () => {
  const settleWith = (
    store: MemoryProgressionStore,
    runId: string,
    kills: Partial<Record<EnemyArchetype, number>>,
    discoveries: number,
  ) =>
    store.settleRun({
      profileId: 'p1',
      runId,
      phase: 'extracted',
      cargoOre: 10,
      kills,
      discoveries,
      seed: 7,
      simulationVersion: 19,
      durationTicks: 100,
      now: NOW,
      idFactory,
    });

  it('o primeiro abate torna o Ativo conhecido e abre a ficha dele', async () => {
    const store = new MemoryProgressionStore();
    await store.createProfile('p1', NOW);
    const result = await settleWith(store, 'run-1', { stalker: 2 }, 0);
    if ('error' in result) throw new Error('inesperado');
    expect(result.profile.knownArchetypes).toEqual(['stalker']);
    expect(result.profile.unlockedLoreFragmentIds).toContain(ASSET_LORE.stalker);
    // E o documento novo nasce NAO LIDO.
    expect(result.profile.readLoreFragmentIds).not.toContain(ASSET_LORE.stalker);
  });

  it('uma descoberta do replay abre o documento correspondente', async () => {
    const store = new MemoryProgressionStore();
    await store.createProfile('p1', NOW);
    const result = await settleWith(store, 'run-1', {}, DISCOVERY_GAS_IGNITION);
    if ('error' in result) throw new Error('inesperado');
    expect(result.profile.discoveries & DISCOVERY_GAS_IGNITION).toBeTruthy();
    expect(result.profile.unlockedLoreFragmentIds).toContain('AX-INC-030');
  });

  it('reenviar a mesma liquidacao nao desbloqueia nem conta nada duas vezes', async () => {
    const store = new MemoryProgressionStore();
    await store.createProfile('p1', NOW);
    await settleWith(store, 'run-1', { stalker: 1 }, DISCOVERY_GAS_IGNITION);
    const before = await store.getProfile('p1');
    const again = await settleWith(store, 'run-1', { stalker: 1 }, DISCOVERY_GAS_IGNITION);
    if ('error' in again) throw new Error('inesperado');
    expect(again.fresh).toBe(false);
    const after = await store.getProfile('p1');
    expect(after).toEqual(before);
  });

  it('fatos acumulam entre runs, e abate zero nao torna conhecido', async () => {
    const store = new MemoryProgressionStore();
    await store.createProfile('p1', NOW);
    await settleWith(store, 'run-1', { stalker: 1, bomber: 0 }, 0);
    await settleWith(store, 'run-2', { miner: 3 }, DISCOVERY_MINER_FLED);
    const profile = await store.getProfile('p1');
    expect(profile?.knownArchetypes).toEqual(['stalker', 'miner']);
    expect(profile?.knownArchetypes).not.toContain('bomber');
    expect(profile?.unlockedLoreFragmentIds).toContain(ASSET_LORE.miner);
    expect(profile?.unlockedLoreFragmentIds).toContain('AX-EXE-035');
  });

  it('o compound abre quando a SEGUNDA metade chega, em outra run', async () => {
    const store = new MemoryProgressionStore();
    await store.createProfile('p1', NOW);
    await settleWith(store, 'run-1', { guardian: 1 }, 0);
    let profile = await store.getProfile('p1');
    expect(profile?.unlockedLoreFragmentIds).not.toContain('AX-UNK-051');
    await settleWith(store, 'run-2', {}, DISCOVERY_CORE_TAKEN);
    profile = await store.getProfile('p1');
    expect(profile?.unlockedLoreFragmentIds).toContain('AX-UNK-051');
  });

  // O arco do Corcel Fungico: 1 (ficha) → 3 → 6 → 10 → 15 (o cavaleiro).
  it('os marcos do Corcel abrem por abates ACUMULADOS entre runs', async () => {
    const store = new MemoryProgressionStore();
    await store.createProfile('p1', NOW);

    await settleWith(store, 'run-1', { fungal_horse: 2 }, 0);
    let profile = await store.getProfile('p1');
    expect(profile?.unlockedLoreFragmentIds).toContain('AX-INC-024'); // ficha, 1 abate
    expect(profile?.unlockedLoreFragmentIds).not.toContain('AX-ENG-023'); // taxonomia, 3

    await settleWith(store, 'run-2', { fungal_horse: 1 }, 0);
    profile = await store.getProfile('p1');
    expect(profile?.assetKills.fungal_horse).toBe(3);
    expect(profile?.unlockedLoreFragmentIds).toContain('AX-ENG-023');
    expect(profile?.unlockedLoreFragmentIds).not.toContain('AX-INC-034'); // fogo, 6

    await settleWith(store, 'run-3', { fungal_horse: 12 }, 0);
    profile = await store.getProfile('p1');
    expect(profile?.assetKills.fungal_horse).toBe(15);
    expect(profile?.unlockedLoreFragmentIds).toContain('AX-INC-034');
    expect(profile?.unlockedLoreFragmentIds).toContain('AX-EXE-043'); // vocabulario, 10
    expect(profile?.unlockedLoreFragmentIds).toContain('AX-UNK-046'); // o cavaleiro, 15
  });

  it('o segredo do cavaleiro nao abre um abate antes da hora', () => {
    expect(expectedLoreIds([], { fungal_horse: 14 }, 0)).not.toContain('AX-UNK-046');
    expect(expectedLoreIds([], { fungal_horse: 15 }, 0)).toContain('AX-UNK-046');
  });

  // Cada marco do catalogo abre EXATAMENTE no seu limiar. Data-driven sobre
  // ASSET_MILESTONE_LORE: um arco novo entra na tabela e ja esta coberto.
  it('todo marco de abate abre no limiar, e um abate antes nao', () => {
    for (const { archetype, minKills, fragmentId } of ASSET_MILESTONE_LORE) {
      expect(
        expectedLoreIds([], { [archetype]: minKills - 1 }, 0),
        `${fragmentId} @ ${minKills - 1}`,
      ).not.toContain(fragmentId);
      expect(
        expectedLoreIds([], { [archetype]: minKills }, 0),
        `${fragmentId} @ ${minKills}`,
      ).toContain(fragmentId);
    }
  });

  it('os marcos sao dados bem formados: ordenados por arquetipo, sem repeticao', () => {
    const byArchetype = new Map<string, number[]>();
    const fragmentIds = ASSET_MILESTONE_LORE.map((m) => m.fragmentId);
    expect(new Set(fragmentIds).size).toBe(fragmentIds.length);
    for (const { archetype, minKills } of ASSET_MILESTONE_LORE) {
      const list = byArchetype.get(archetype) ?? [];
      list.push(minKills);
      byArchetype.set(archetype, list);
    }
    for (const [archetype, thresholds] of byArchetype) {
      expect(thresholds, archetype).toEqual([...thresholds].sort((a, b) => a - b));
      expect(new Set(thresholds).size, archetype).toBe(thresholds.length);
    }
    // As cinco assinaturas de estrato tem trilha completa (4 marcos + ficha).
    for (const signature of ['resonant', 'mud_lamprey', 'bellows', 'scoriac', 'frost_wraith']) {
      expect(byArchetype.get(signature)?.length, signature).toBe(4);
    }
  });

  // Uma run que cruza VARIOS marcos de uma vez abre todos os elegiveis.
  it('cruzar varios marcos numa unica liquidacao abre todos de uma vez', () => {
    const ids = expectedLoreIds([], { resonant: 15 }, 0);
    for (const doc of ['AX-ENG-026', 'AX-INC-038', 'AX-EXE-045', 'AX-UNK-055']) {
      expect(ids).toContain(doc);
    }
  });

  // A sintese so existe para quem terminou as QUATRO historias humanas —
  // Ressonante e Scoriac ficam fora de proposito (a sintese nao e formula).
  it('a sintese de Solaris exige os quatro finais', () => {
    const threeOfFour = {
      fungal_horse: 15,
      bellows: 15,
      mud_lamprey: 15,
      frost_wraith: 14,
    };
    expect(expectedLoreIds([], threeOfFour, 0)).not.toContain('AX-UNK-054');
    expect(
      expectedLoreIds([], { ...threeOfFour, frost_wraith: 15 }, 0),
    ).toContain('AX-UNK-054');
    expect(expectedLoreIds([], { resonant: 99, scoriac: 99 }, 0)).not.toContain('AX-UNK-054');
  });

  // Perfil da versao anterior: tinha knownArchetypes e nenhuma contagem.
  it('migracao: conhecido sem contagem vira "pelo menos 1", sem inventar marco', () => {
    const legacy: StoredProfile = {
      ...newProfile('p1', NOW),
      knownArchetypes: ['fungal_horse'],
      assetKills: {},
    };
    const fixed = sanitizeProfile(legacy);
    expect(fixed.assetKills.fungal_horse).toBe(1);
    expect(fixed.unlockedLoreFragmentIds).toContain('AX-INC-024');
    expect(fixed.unlockedLoreFragmentIds).not.toContain('AX-ENG-023');
  });

  it('os marcos aparecem no indice "Ver docs" do Corcel quando abertos', async () => {
    const store = new MemoryProgressionStore();
    await store.createProfile('p1', NOW);
    await settleWith(store, 'run-1', { fungal_horse: 15 }, 0);
    const profile = await store.getProfile('p1');
    if (!profile) throw new Error('perfil sumiu');
    const index = loreIndexFor(profile);
    expect(index.assets.fungal_horse).toEqual(
      expect.arrayContaining(['AX-INC-024', 'AX-ENG-023', 'AX-INC-034', 'AX-EXE-043', 'AX-UNK-046']),
    );
  });

  it('o dossie do Ativo inclui os docs de Descoberta dele, em ordem de leitura', async () => {
    const store = new MemoryProgressionStore();
    await store.createProfile('p1', NOW);
    // 15 abates de Corcel + a descoberta do abate: a necropsia (INC-033, que e
    // documento de DESCOBERTA) entra no dossie do fungal_horse.
    await store.settleRun({
      profileId: 'p1',
      runId: 'run-1',
      phase: 'extracted',
      cargoOre: 5,
      kills: { fungal_horse: 15 },
      discoveries: 1 << 9, // DISCOVERY_HORSE_FELLED
      seed: 7,
      simulationVersion: 19,
      durationTicks: 100,
      now: NOW,
      idFactory,
    });
    const profile = await store.getProfile('p1');
    if (!profile) throw new Error('perfil sumiu');
    const index = loreIndexFor(profile);
    const dossier = index.assets.fungal_horse ?? [];
    expect(dossier).toContain('AX-INC-033');
    // Ordem de LEITURA, nao de desbloqueio: cronologia crescente.
    const chrono = dossier.map((id) => findLoreFragment(id)?.chronologyIndex ?? -1);
    expect(chrono).toEqual([...chrono].sort((a, b) => a - b));
    // E a ficha (INC-024) vem antes da sintese do arco (UNK-046).
    expect(dossier.indexOf('AX-INC-024')).toBeLessThan(dossier.indexOf('AX-UNK-046'));
  });

  it('o indice "Ver docs" so lista Ativos conhecidos e Descobertas feitas', async () => {
    const store = new MemoryProgressionStore();
    await store.createProfile('p1', NOW);
    await settleWith(store, 'run-1', { fungal_horse: 1 }, DISCOVERY_GAS_IGNITION);
    const profile = await store.getProfile('p1');
    if (!profile) throw new Error('perfil sumiu');
    const index = loreIndexFor(profile);
    expect(index.assets.fungal_horse).toContain(ASSET_LORE.fungal_horse);
    expect(Object.keys(index.assets)).toEqual(['fungal_horse']);
    expect(index.discoveries[String(DISCOVERY_GAS_IGNITION)]).toContain('AX-INC-030');
  });
});

// ---------------------------------------------------------------------------
// Estado de leitura
// ---------------------------------------------------------------------------

describe('estado de leitura', () => {
  it('documento desbloqueado nasce como nao lido', () => {
    const fresh = newProfile('p1', NOW);
    expect(fresh.unlockedLoreFragmentIds).toContain('AX-PUB-001');
    expect(fresh.readLoreFragmentIds).toEqual([]);
  });

  it('marcar leitura marca SOMENTE aquele documento, e e idempotente', () => {
    const profile = sanitizeProfile({
      ...newProfile('p1', NOW),
      knownArchetypes: ['stalker'],
    });
    const first = decideMarkRead(profile, 'AX-PUB-001', NOW);
    expect(first.ok && first.changed).toBe(true);
    if (!first.ok) return;
    expect(first.profile.readLoreFragmentIds).toEqual(['AX-PUB-001']);
    const again = decideMarkRead(first.profile, 'AX-PUB-001', NOW);
    expect(again.ok && !again.changed).toBe(true);
    // profileVersion NAO sobe: leitura e apresentacao persistida.
    if (again.ok) expect(again.profile.profileVersion).toBe(profile.profileVersion);
  });

  it('documento bloqueado nao pode ser marcado como lido', () => {
    const profile = sanitizeProfile(newProfile('p1', NOW));
    expect(decideMarkRead(profile, 'AX-UNK-052', NOW)).toEqual({
      ok: false,
      error: 'unknown_upgrade',
    });
    expect(decideMarkRead(profile, 'nao-existe', NOW)).toEqual({
      ok: false,
      error: 'unknown_upgrade',
    });
  });

  it('a leitura persiste no store e sobrevive a sanitizacao', async () => {
    const store = new MemoryProgressionStore();
    await store.createProfile('p1', NOW);
    const marked = await store.markLoreRead('p1', 'AX-PUB-001', NOW);
    expect(marked).toEqual({ ok: true, readLoreFragmentIds: ['AX-PUB-001'] });
    const profile = await store.getProfile('p1');
    expect(profile?.readLoreFragmentIds).toEqual(['AX-PUB-001']);
  });

  it('um documento que deixou de estar desbloqueado sai da lista de lidos', () => {
    const broken: StoredProfile = {
      ...newProfile('p1', NOW),
      readLoreFragmentIds: ['AX-PUB-001', 'AX-UNK-052'],
    };
    expect(sanitizeProfile(broken).readLoreFragmentIds).toEqual(['AX-PUB-001']);
  });

  it('o perfil publico carrega leitura, Ativos e Descobertas para as bolinhas', async () => {
    const store = new MemoryProgressionStore();
    await store.createProfile('p1', NOW);
    await store.settleRun({
      profileId: 'p1',
      runId: 'run-1',
      phase: 'extracted',
      cargoOre: 5,
      kills: { stalker: 1 },
      discoveries: DISCOVERY_GAS_IGNITION,
      seed: 7,
      simulationVersion: 19,
      durationTicks: 100,
      now: NOW,
      idFactory,
    });
    const profile = await store.getProfile('p1');
    if (!profile) throw new Error('perfil sumiu');
    const pub = publicProfile(profile);
    expect(pub.knownAssetArchetypes).toEqual(['stalker']);
    expect(pub.discoveries & DISCOVERY_GAS_IGNITION).toBeTruthy();
    expect(pub.readLoreFragmentIds).toEqual([]);
    expect(pub.loreIndex.assets.stalker).toContain(ASSET_LORE.stalker);
  });
});
