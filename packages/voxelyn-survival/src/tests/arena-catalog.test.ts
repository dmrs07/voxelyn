import { describe, expect, it } from 'vitest';
import {
  SOLID_CRYSTAL,
  SOLID_ORE,
  SOLID_NONE,
  SURF_WATER,
  createRun,
  emptyCommand,
  isPipe,
  stepRun,
} from '@voxelyn/survival-sim';
import { ARENA_BOSS_ORDER, ARENA_CATALOG, type ArenaBossId } from '../client/arena-catalog';
import {
  ARENA_KEEP_RADIUS,
  ARENA_MAX_HP,
  ARENA_MIN_FLOOR,
  ARENA_MIN_HP,
  clampArenaHp,
  createArenaRun,
} from '../client/arena-setup';

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

  it('deixa em campo o chefe e o que E DELE, e mais nada', () => {
    // A fauna comum do setor sai: a arena existe para testar UMA luta, e um
    // stalker passando por ali e ruido de outra coisa.
    //
    // A ninhada do Devorador nao e fauna comum, e por isso ela fica. Ela nasce
    // com a mae, existe so onde ela existe e some do mapa junto com ela —
    // varre-la daqui tiraria da arena metade do encontro que a arena serve para
    // testar, e a ferramenta passaria a mostrar uma luta que o jogo nao tem.
    for (const boss of ARENA_BOSS_ORDER) {
      const state = arena(boss);
      const kinds = new Set(state.enemies.map((e) => e.archetype));
      kinds.delete(boss);
      if (boss === 'white_devourer') kinds.delete('devourer_brood');
      expect([...kinds], `arena de ${boss} tem bicho que nao e do chefe`).toEqual([]);
      // O chefe continua sendo o PRIMEIRO corpo em campo: o teste abaixo (e o
      // recorte da propria arena) leem `enemies[0]` como sendo ele.
      expect(state.enemies[0].archetype, `arena de ${boss}`).toBe(boss);
    }
  });

  it('a ninhada acompanha a mae na arena, e so ela tem uma', () => {
    for (const boss of ARENA_BOSS_ORDER) {
      const state = arena(boss);
      const brood = state.enemies.filter((e) => e.archetype === 'devourer_brood').length;
      if (boss === 'white_devourer') {
        expect(brood, 'a arena do Devorador ficou sem ninhada').toBeGreaterThan(0);
      } else {
        expect(brood, `arena de ${boss} herdou ninhada`).toBe(0);
      }
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
      // E ela tem de ser uma ARENA, e nao um corredor. O piso nao e um numero
      // escolhido no olho: e o que `carveArena` promete escavar quando a
      // caverna nao entrega (ARENA_MIN_FLOOR), e ele existe porque a versao
      // anterior deixava o Coracao numa caixa de 16x19 com uma varredura que
      // alcanca 15 — o chefe cobria a arena inteira.
      expect(open, `arena de ${boss}: ${open} celulas e pouco`).toBeGreaterThanOrEqual(
        ARENA_MIN_FLOOR,
      );
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

  it('da para CIRCULAR: a arena nao e um emaranhado de corredores', () => {
    // Extensao e largura sao dois problemas diferentes, e o segundo nao se
    // resolve com raio. Medida antes do alargamento, a arena do Diamandis tinha
    // 13% de celulas com dois tiles livres em cruz: nao era uma sala apertada,
    // era um labirinto — e ele e uma maquina de 1,5 tile/s que abre galeria com
    // a broca.
    for (const boss of ARENA_BOSS_ORDER) {
      const state = arena(boss);
      const w = state.config.width;
      const open = (i: number) => state.solid[i] === SOLID_NONE;
      let cells = 0;
      let wide = 0;
      for (let y = 1; y < state.config.height - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
          const i = y * w + x;
          if (!open(i)) continue;
          cells++;
          let room = true;
          for (let d = -2; d <= 2 && room; d++) {
            if (!open(i + d) || !open(i + d * w)) room = false;
          }
          if (room) wide++;
        }
      }
      const ratio = wide / cells;
      expect(ratio, `arena de ${boss}: so ${(ratio * 100) | 0}% de chao largo`).toBeGreaterThan(0.35);
    }
  });

  it('o macico selado e rocha LISA: sem cristal aceso do lado de fora', () => {
    // O que sobra fora da arena nao pode chamar atencao para si. Cristal e
    // minerio se desenham diferentes de pedra, e o cristal ainda por cima e
    // fonte de luz no cliente: a rocha que ninguem vai visitar ficava salpicada
    // de clarao azul e veio de ferrugem.
    const state = arena('archcantor');
    const w = state.config.width;
    const body = state.enemies[0];
    let strayFar = 0;
    for (let i = 0; i < state.solid.length; i++) {
      if (state.solid[i] !== SOLID_CRYSTAL && state.solid[i] !== SOLID_ORE) continue;
      const d = Math.hypot((i % w) - body.x, Math.floor(i / w) - body.y);
      if (d > ARENA_KEEP_RADIUS + 6) strayFar++;
    }
    expect(strayFar, 'sobrou cristal/minerio solto no macico selado').toBe(0);
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
