import { describe, expect, it } from 'vitest';
import type { EnemyArchetype, LoreFragmentId } from '@voxelyn/survival-sim';
import { expectedLoreIds, loreIndexFor, newProfile } from '../src/progression';
import { MemoryProgressionStore } from '../src/progression-store';
import {
  ASSET_MEMORY_FRAGMENT_IDS,
  ASSET_MEMORY_MILESTONE_LORE,
} from '../src/progression-lore-asset-memory';
import {
  ASSET_LORE,
  LORE_FRAGMENTS,
  TOTAL_LORE_FRAGMENTS,
  findLoreFragment,
} from '../src/progression-lore';
import { ASSET_MEMORY_TEXT } from '../src/progression-lore-asset-memory-text';

const NOW = '2026-08-04T21:00:00.000Z';
let idCounter = 0;
const idFactory = (): string => `asset-memory-${++idCounter}`;

type Arc = {
  archetype: EnemyArchetype;
  base: LoreFragmentId;
  milestones: readonly [LoreFragmentId, LoreFragmentId, LoreFragmentId, LoreFragmentId];
};

const ARCS: readonly Arc[] = [
  {
    archetype: 'resonant',
    base: 'AX-ENG-017',
    milestones: ['AX-ENG-019', 'AX-INC-035', 'AX-EXE-044', 'AX-UNK-053'],
  },
  {
    archetype: 'mud_lamprey',
    base: 'AX-PRC-018',
    milestones: ['AX-ENG-024', 'AX-INC-036', 'AX-EXE-045', 'AX-UNK-054'],
  },
  {
    archetype: 'bellows',
    base: 'AX-INC-022',
    milestones: ['AX-ENG-026', 'AX-INC-037', 'AX-EXE-046', 'AX-UNK-055'],
  },
  {
    archetype: 'scoriac',
    base: 'AX-INC-026',
    milestones: ['AX-ENG-027', 'AX-INC-038', 'AX-EXE-047', 'AX-UNK-056'],
  },
  {
    archetype: 'frost_wraith',
    base: 'AX-INC-028',
    milestones: ['AX-ENG-028', 'AX-INC-039', 'AX-EXE-048', 'AX-UNK-057'],
  },
];

const settle = (
  store: MemoryProgressionStore,
  runId: string,
  kills: Partial<Record<EnemyArchetype, number>>,
) =>
  store.settleRun({
    profileId: 'p1',
    runId,
    phase: 'extracted',
    cargoOre: 0,
    kills,
    discoveries: 0,
    seed: 17,
    simulationVersion: 19,
    durationTicks: 100,
    now: NOW,
    idFactory,
  });

describe('catalogo dos Ecos de assinatura', () => {
  it('adiciona vinte documentos e eleva o Codex a 88', () => {
    expect(ASSET_MEMORY_MILESTONE_LORE).toHaveLength(20);
    expect(ASSET_MEMORY_FRAGMENT_IDS).toHaveLength(20);
    expect(TOTAL_LORE_FRAGMENTS).toBe(88);
    expect(LORE_FRAGMENTS.filter((fragment) => fragment.trigger.kind === 'asset')).toHaveLength(
      39,
    );
  });

  it('cada arco usa exatamente 3, 6, 10 e 15 abates, sem chave repetida', () => {
    const pairs = new Set<string>();
    const ids = new Set<LoreFragmentId>();

    for (const arc of ARCS) {
      const entries = ASSET_MEMORY_MILESTONE_LORE.filter(
        (entry) => entry.archetype === arc.archetype,
      );
      expect(entries.map((entry) => entry.minKills), arc.archetype).toEqual([3, 6, 10, 15]);
      expect(entries.map((entry) => entry.fragmentId), arc.archetype).toEqual(arc.milestones);

      for (const entry of entries) {
        const pair = `${entry.archetype}:${entry.minKills}`;
        expect(pairs.has(pair), pair).toBe(false);
        expect(ids.has(entry.fragmentId), entry.fragmentId).toBe(false);
        pairs.add(pair);
        ids.add(entry.fragmentId);
      }
    }
  });

  it('todo documento existe, tem cronologia e texto completo nos dois idiomas', () => {
    for (const id of ASSET_MEMORY_FRAGMENT_IDS) {
      const fragment = findLoreFragment(id);
      expect(fragment, id).toBeDefined();
      expect(fragment?.chronologyIndex, id).toBeGreaterThanOrEqual(0);

      for (const locale of ['pt-BR', 'en'] as const) {
        const text = ASSET_MEMORY_TEXT[locale][id];
        expect(text, `${locale}/${id}`).toBeDefined();
        expect(text.title.length).toBeGreaterThan(3);
        expect(text.summary.length).toBeGreaterThan(3);
        expect(text.body.length).toBeGreaterThan(40);
        expect(text.source.length).toBeGreaterThan(3);
      }
    }
  });

  it('as fichas base continuam sendo as mesmas do Registro', () => {
    for (const arc of ARCS) expect(ASSET_LORE[arc.archetype]).toBe(arc.base);
  });
});

describe('desbloqueio por milestones', () => {
  for (const arc of ARCS) {
    it(`${arc.archetype}: 1 → 3 → 6 → 10 → 15 sem revelar um abate antes`, () => {
      const idsAt = (kills: number): LoreFragmentId[] =>
        expectedLoreIds([], { [arc.archetype]: kills }, 0);

      expect(idsAt(0)).not.toContain(arc.base);
      expect(idsAt(1)).toContain(arc.base);
      expect(idsAt(2)).not.toContain(arc.milestones[0]);
      expect(idsAt(3)).toContain(arc.milestones[0]);
      expect(idsAt(5)).not.toContain(arc.milestones[1]);
      expect(idsAt(6)).toContain(arc.milestones[1]);
      expect(idsAt(9)).not.toContain(arc.milestones[2]);
      expect(idsAt(10)).toContain(arc.milestones[2]);
      expect(idsAt(14)).not.toContain(arc.milestones[3]);
      expect(idsAt(15)).toContain(arc.milestones[3]);
    });
  }

  it('cruzar varios limiares numa unica run abre todos os documentos elegiveis', () => {
    for (const arc of ARCS) {
      const ids = expectedLoreIds([], { [arc.archetype]: 15 }, 0);
      expect(ids).toEqual(expect.arrayContaining([arc.base, ...arc.milestones]));
    }
  });

  it('abates de outro Ativo nao atravessam arcos', () => {
    const ids = expectedLoreIds([], { resonant: 15 }, 0);
    expect(ids).toContain('AX-UNK-053');
    expect(ids).not.toContain('AX-UNK-054');
    expect(ids).not.toContain('AX-UNK-055');
    expect(ids).not.toContain('AX-UNK-056');
    expect(ids).not.toContain('AX-UNK-057');
  });
});

describe('settlement e indice Ver docs', () => {
  for (const arc of ARCS) {
    it(`${arc.archetype}: acumula entre runs e os novos documentos nascem nao lidos`, async () => {
      const store = new MemoryProgressionStore();
      await store.createProfile('p1', NOW);

      await settle(store, `${arc.archetype}-1`, { [arc.archetype]: 2 });
      await settle(store, `${arc.archetype}-2`, { [arc.archetype]: 1 });
      await settle(store, `${arc.archetype}-3`, { [arc.archetype]: 12 });

      const profile = await store.getProfile('p1');
      if (!profile) throw new Error('perfil ausente');
      expect(profile.assetKills[arc.archetype]).toBe(15);
      expect(profile.unlockedLoreFragmentIds).toEqual(
        expect.arrayContaining([arc.base, ...arc.milestones]),
      );
      for (const id of arc.milestones) expect(profile.readLoreFragmentIds).not.toContain(id);

      const index = loreIndexFor(profile);
      expect(index.assets[arc.archetype]).toEqual(
        expect.arrayContaining([arc.base, ...arc.milestones]),
      );
    });
  }

  it('repetir o runId que cruzou um milestone nao conta nem desbloqueia duas vezes', async () => {
    const store = new MemoryProgressionStore();
    await store.createProfile('p1', NOW);
    await settle(store, 'same-run', { bellows: 3 });
    const before = await store.getProfile('p1');
    const replay = await settle(store, 'same-run', { bellows: 3 });
    if ('error' in replay) throw new Error('settlement inesperadamente recusado');
    expect(replay.fresh).toBe(false);
    expect(await store.getProfile('p1')).toEqual(before);
  });

  it('perfil legado conhecido continua em 1, sem inventar memoria avancada', () => {
    const profile = newProfile('p1', NOW);
    const ids = expectedLoreIds([], { frost_wraith: 1 }, 0);
    expect(profile.unlockedLoreFragmentIds).not.toContain('AX-ENG-028');
    expect(ids).toContain(ASSET_LORE.frost_wraith);
    expect(ids).not.toContain('AX-ENG-028');
  });
});
