import { describe, expect, it } from 'vitest';
import {
  SOLID_NONE,
  SURF_WATER,
  createRun,
  emptyCommand,
  isPipe,
  stepRun,
} from '@voxelyn/survival-sim';
import { ARENA_BOSS_ORDER, ARENA_CATALOG, type ArenaBossId } from '../client/arena-catalog';
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

/**
 * O RECORTE. A arena existe para testar UMA luta, e sem isto ela entregava o
 * setor inteiro: caminhada ate o chefe, fauna que nao tem nada a ver com o
 * encontro, e stalkers nascendo no meio dele por conta da contaminacao.
 */
describe('createArenaRun — o recorte da arena', () => {
  const arena = (boss: ArenaBossId) =>
    createArenaRun({ boss, maxHp: 200, ability: 'pulse', modules: [] });

  it('deixa em campo o chefe, e SO o chefe', () => {
    for (const boss of ARENA_BOSS_ORDER) {
      const state = arena(boss);
      expect(state.enemies.map((e) => e.archetype), `arena de ${boss}`).toEqual([boss]);
    }
  });

  it('o testador comeca DENTRO do alcance, e nao na entrada do setor', () => {
    for (const boss of ARENA_BOSS_ORDER) {
      const state = arena(boss);
      const body = state.enemies[0];
      const gap = Math.hypot(state.player.x - body.x, state.player.y - body.y);
      // Perto o bastante para a luta comecar sozinha (o menor aggro do elenco e
      // 10) e longe o bastante para nao nascer encostado nele.
      expect(gap, `arena de ${boss}: ${gap.toFixed(1)} tiles do chefe`).toBeGreaterThan(2);
      expect(gap, `arena de ${boss}: ${gap.toFixed(1)} tiles do chefe`).toBeLessThan(14);
      expect(
        state.solid[Math.floor(state.player.y) * state.config.width + Math.floor(state.player.x)],
        `arena de ${boss}: o testador nasceu dentro da rocha`,
      ).toBe(SOLID_NONE);
    }
  });

  it('o chao que sobra e SO o alcancavel a pe a partir do chefe', () => {
    // O recorte e uma busca em largura, e nao um quadrado carimbado: nao pode
    // sobrar sala solta do outro lado da rocha, nem corredor que leva a nada.
    for (const boss of ARENA_BOSS_ORDER) {
      const state = arena(boss);
      const w = state.config.width;
      const body = state.enemies[0];
      const seen = new Set<number>();
      const start = Math.floor(body.y) * w + Math.floor(body.x);
      const queue = [start];
      seen.add(start);
      for (let head = 0; head < queue.length; head++) {
        const cell = queue[head];
        const cx = cell % w;
        const cy = (cell - cx) / w;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
          const i = (cy + dy) * w + (cx + dx);
          if (state.solid[i] !== SOLID_NONE || seen.has(i)) continue;
          seen.add(i);
          queue.push(i);
        }
      }
      let open = 0;
      for (let i = 0; i < state.solid.length; i++) if (state.solid[i] === SOLID_NONE) open++;
      expect(seen.size, `arena de ${boss}: sobrou chao ilhado`).toBe(open);
      // E ela tem de ser uma ARENA, e nao um corredor: os golpes do elenco
      // chegam a 15 tiles, e uma sala menor que o golpe mede a moldura.
      expect(open, `arena de ${boss}: ${open} celulas e pouco`).toBeGreaterThan(150);
    }
  });

  it('a contaminacao nao repovoa a arena no meio da luta', () => {
    // As ondas nascem gastas. Sem isto, uma luta longa terminava com stalkers
    // aparecendo do nada — exatamente o que o recorte tirou de campo.
    const state = arena('furnace_heart');
    for (let t = 0; t < 2000; t++) stepRun(state, [emptyCommand()]);
    const intruders = state.enemies.filter(
      (e) => e.archetype === 'stalker' || e.archetype === 'bomber',
    );
    expect(intruders, 'a contaminacao repovoou a arena').toHaveLength(0);
  });

  it('a arena do Leviata nasce com AGUA e com DUTOS', () => {
    // A entrada dele deixou de ser intercambiavel: sem lamina e sem duto, nem o
    // encontro antigo nem o Diluvio tem o que exercitar.
    const state = arena('sheet_leviathan');
    let water = 0;
    let pipes = 0;
    for (let i = 0; i < state.solid.length; i++) {
      if (isPipe(state.solid[i])) pipes++;
      else if (state.solid[i] === SOLID_NONE && state.surface[i] === SURF_WATER) water++;
    }
    expect(water, 'a camara do Leviata nasceu seca').toBeGreaterThan(80);
    expect(pipes, 'a camara do Leviata nasceu sem duto').toBeGreaterThan(0);
  });
});
