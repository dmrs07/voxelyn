// As decisoes puras e o store: economia, idempotencia, ledger e concorrencia.
//
// Nada aqui sobe servidor. O que estes testes vigiam e a camada que decide, e
// ela precisa poder ser lida inteira sem banco por perto — a mesma razao pela
// qual o leaderboard tem um store de memoria.

import { describe, expect, it } from 'vitest';
import { UPGRADES, deriveGeneration, derivePlayerTuning } from '@voxelyn/survival-sim';
import {
  applySettlement,
  decidePurchase,
  expectedLoreIds,
  newProfile,
  publicProfile,
  rewardFor,
  sanitizeProfile,
  tuningForProfile,
  type StoredProfile,
} from '../src/progression';
import { MemoryProgressionStore } from '../src/progression-store';
import { DEFAULT_UNLOCKED_LORE, LORE_FRAGMENTS, TOTAL_LORE_FRAGMENTS, findLoreFragment, loreCoversEveryUpgrade, maskCode } from '../src/progression-lore';
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
    expect(died.statistics).toMatchObject({ oreLost: 30, failedExpeditions: 1, successfulReturns: 0 });
    expect(died.wallet).toEqual({ ore: 0, cores: 0 });

    const returned = applySettlement(base, 'extracted_with_core', rewardFor('extracted_with_core', 30), NOW);
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
      'RX-01', 'RX-02', 'RX-03', 'RX-04', 'RX-05',
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
      const owned = UPGRADES.filter((u) => u.branch === upgrade.branch && u.tier < upgrade.tier).map(
        (u) => u.id,
      );
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
  const settle = (store: MemoryProgressionStore, runId: string, phase: 'dead' | 'extracted' | 'extracted_with_core', ore: number) =>
    store.settleRun({
      profileId: 'p1',
      runId,
      phase,
      cargoOre: ore,
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
    await Promise.all([settle(store, 'run-x', 'extracted', 15), settle(store, 'run-x', 'extracted', 15)]);
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
  it('tem 29 documentos: 24 protocolos, 4 marcos e o publico inicial', () => {
    expect(TOTAL_LORE_FRAGMENTS).toBe(29);
    expect(LORE_FRAGMENTS.filter((f) => f.unlockedByUpgradeId !== null)).toHaveLength(24);
    expect(LORE_FRAGMENTS.filter((f) => f.unlockedByGeneration !== null)).toHaveLength(4);
    expect(DEFAULT_UNLOCKED_LORE).toHaveLength(1);
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

  it('os desbloqueios derivam da arvore — um perfil inconsistente e reparavel', () => {
    const full = expectedLoreIds(UPGRADES.map((u) => u.id));
    expect(full).toHaveLength(TOTAL_LORE_FRAGMENTS);
    expect(expectedLoreIds([])).toEqual([...DEFAULT_UNLOCKED_LORE]);
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
