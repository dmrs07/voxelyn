import { describe, expect, it } from 'vitest';
import { createRun } from '@voxelyn/survival-sim';
import { ARENA_BOSS_ORDER, ARENA_CATALOG } from '../client/arena-catalog';
import { ARENA_MAX_HP, ARENA_MIN_HP, clampArenaHp, createArenaRun } from '../client/arena-setup';

/**
 * O catalogo aponta para (seed, geracao, setor) achados por busca offline nas
 * funcoes puras de bioma/chefe. Este teste e o que denuncia se a resolucao de
 * chefe (ou a tabela de linhagem) mudar e uma entrada parar de apontar para
 * quem ela promete — sem ele, a arena mostraria silenciosamente o chefe
 * errado (ou nenhum) para quem escolhesse aquele item no seletor.
 */
describe('ARENA_CATALOG', () => {
  it('lista uma entrada para cada chefe da ordem de exibicao', () => {
    for (const id of ARENA_BOSS_ORDER) {
      expect(ARENA_CATALOG[id]).toBeDefined();
    }
  });

  it('cada entrada resolve, de fato, para o chefe que promete', () => {
    for (const [boss, entry] of Object.entries(ARENA_CATALOG)) {
      const state = createRun({
        seed: entry.seed,
        sector: entry.sector,
        depth: {
          generation: entry.generation,
          sectorCount: entry.sectorCount,
          coreSectors: entry.coreSectors,
        },
      });
      expect(state.sectorBoss.archetype, `chefe de '${boss}'`).toBe(boss);
      expect(state.sectorBoss.entityId, `corpo do chefe de '${boss}' em campo`).not.toBeNull();
    }
  });
});

describe('createArenaRun', () => {
  it('aplica HP, eco e modulos escolhidos antes do primeiro tick', () => {
    const state = createArenaRun({
      boss: 'guardian',
      maxHp: 250,
      ability: 'flamethrower',
      modules: ['piercing', 'explosive'],
    });
    expect(state.player.hp).toBe(250);
    expect(state.player.maxHp).toBe(250);
    expect(state.playerExtra.ability).toBe('flamethrower');
    const equipped = state.playerExtra.activeModules.map((m) => m.id).sort();
    expect(equipped).toEqual(['explosive', 'piercing']);
    expect(state.sectorBoss.archetype).toBe('guardian');
  });

  it('nao equipa nenhum modulo quando a lista vem vazia', () => {
    const state = createArenaRun({ boss: 'bishop', maxHp: 100, ability: 'pulse', modules: [] });
    expect(state.playerExtra.activeModules).toHaveLength(0);
  });
});

describe('clampArenaHp', () => {
  it('mantem valores dentro da faixa', () => {
    expect(clampArenaHp(150)).toBe(150);
  });

  it('satura no minimo e no maximo', () => {
    expect(clampArenaHp(0)).toBe(ARENA_MIN_HP);
    expect(clampArenaHp(1)).toBe(ARENA_MIN_HP);
    expect(clampArenaHp(10_000)).toBe(ARENA_MAX_HP);
  });

  it('cai num default sensato para entrada invalida', () => {
    expect(clampArenaHp(Number.NaN)).toBeGreaterThanOrEqual(ARENA_MIN_HP);
  });
});
