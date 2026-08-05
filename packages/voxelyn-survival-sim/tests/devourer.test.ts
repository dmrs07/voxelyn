// DEVORADOR BRANCO — o chefe dos Sumidouros de Silica.
//
// O que estes testes protegem, em ordem de gravidade:
// 1. O CONTRA-JOGO EXISTE E FUNCIONA. Calor vitrifica silica solta, e sobre
//    vidro ele NAO emerge. Se qualquer metade disso quebrar, o encontro vira um
//    verme que sai onde quer e o jogador nao tem resposta nenhuma.
// 2. O RASTRO E O AVISO. Mergulhado ele deixa silica por onde passa — e essa
//    faixa e ao mesmo tempo o telegrafo e a materia-prima do contra-jogo.
// 3. A JANELA E A JANELA. Submerso ele quase nao toma dano; exposto, toma.
//    Sem isso o ciclo inteiro deixa de significar alguma coisa.
import { describe, expect, it } from 'vitest';
import { createRun, emptyCommand, stepRun } from '../src/run';
import { damageEntity, spawnEnemy } from '../src/entities';
import { igniteCell } from '../src/cells';
import { bossArchetypeForBiome } from '../src/bosses';
import { sectorBiome } from '../src/strata';
import {
  DEVOURER_BURROWED_ARMOR,
  DEVOURER_ERUPT_WINDUP_TICKS,
  SECTOR_COUNT,
  SOLID_NONE,
  SURF_GLASS,
  SURF_NONE,
  SURF_SILT,
} from '../src/constants';
import {
  DEVOURER_BURROWED,
  DEVOURER_SURFACED,
  DISCOVERY_SILICA_VITRIFIED,
  type SurvivalState,
} from '../src/types';

const arena = (seed: number) => {
  const state = createRun({ seed });
  state.player.x = Math.floor(state.config.width / 2) + 0.5;
  state.player.y = Math.floor(state.config.height / 2) + 0.5;
  const w = state.config.width;
  const px = Math.floor(state.player.x);
  const py = Math.floor(state.player.y);
  for (let y = py - 20; y <= py + 20; y++) {
    for (let x = px - 20; x <= px + 20; x++) {
      if (x < 1 || y < 1 || x >= w - 1 || y >= state.config.height - 1) continue;
      state.solid[y * w + x] = SOLID_NONE;
      state.surface[y * w + x] = SURF_NONE;
      state.surfaceTimer[y * w + x] = 0;
    }
  }
  state.enemies = [];
  const worm = spawnEnemy(state, 'white_devourer', px + 10, py, false);
  return { state, worm, px, py };
};

const countSurface = (state: SurvivalState, kind: number, cx: number, cy: number, r: number): number => {
  const w = state.config.width;
  let n = 0;
  for (let y = cy - r; y <= cy + r; y++) {
    for (let x = cx - r; x <= cx + r; x++) {
      if (x < 0 || y < 0 || x >= w || y >= state.config.height) continue;
      if (state.surface[y * w + x] === kind) n++;
    }
  }
  return n;
};

describe('Devorador Branco — onde ele mora', () => {
  it('e o chefe do mapa final de Sumidouros de Silica', () => {
    expect(bossArchetypeForBiome({ stratum: 'silica', occupation: 'none', lineage: 'arid' }))
      .toBe('white_devourer');
    // Ocupacao forte continua tendo prioridade sobre o estrato.
    expect(bossArchetypeForBiome({ stratum: 'silica', occupation: 'mycelial', lineage: 'arid' }))
      .toBe('bishop');
  });

  it('quando a linhagem termina em silica, ele esta na camara', () => {
    let found = false;
    for (let seed = 1; seed <= 300 && !found; seed++) {
      if (bossArchetypeForBiome(sectorBiome(seed, SECTOR_COUNT)) !== 'white_devourer') continue;
      const state = createRun({ seed, sector: SECTOR_COUNT });
      found = state.enemies.some((e) => e.archetype === 'white_devourer');
      expect(found, `seed ${seed}: sumidouro sem Devorador`).toBe(true);
    }
    expect(found, 'nenhuma seed da amostra terminou em Sumidouros de Silica').toBe(true);
  });
});

describe('Devorador Branco — o rastro', () => {
  it('nasce POR BAIXO e deixa faixa de silica por onde anda', () => {
    const { state, worm, px, py } = arena(501);
    expect(worm.mood).toBe(DEVOURER_BURROWED);
    expect(countSurface(state, SURF_SILT, px, py, 18)).toBe(0);

    for (let t = 0; t < 30; t++) stepRun(state, [emptyCommand()]);
    expect(countSurface(state, SURF_SILT, px, py, 18), 'nao deixou rastro nenhum').toBeGreaterThan(4);
  });

  it('atravessa parede: perseguir nao e uma resposta a ele', () => {
    const { state, worm, px, py } = arena(502);
    const w = state.config.width;
    for (let dy = -6; dy <= 6; dy++) state.solid[(py + dy) * w + px + 5] = 1; // rocha
    const before = worm.x;
    for (let t = 0; t < 40; t++) stepRun(state, [emptyCommand()]);
    expect(worm.x, 'a parede segurou quem anda por baixo dela').toBeLessThan(before - 2);
  });
});

describe('Devorador Branco — o contra-jogo', () => {
  it('calor VITRIFICA a silica solta, e isso e uma Descoberta', () => {
    const { state, px, py } = arena(511);
    const w = state.config.width;
    const cell = py * w + px + 3;
    state.surface[cell] = SURF_SILT;
    state.surfaceTimer[cell] = 0;

    igniteCell(state, cell, []);
    expect(state.surface[cell], 'o calor nao virou vidro').toBe(SURF_GLASS);
    expect(state.stats.discoveries & DISCOVERY_SILICA_VITRIFIED).not.toBe(0);
  });

  it('sobre VIDRO ele nao emerge — o chao negado o segura embaixo', () => {
    // O teste que sustenta o encontro inteiro. Com o jogador de pe sobre uma
    // placa de vidro larga, nenhuma emergencia pode acontecer ali dentro.
    const { state, px, py } = arena(512);
    const w = state.config.width;
    const R = 9;
    for (let y = py - R; y <= py + R; y++) {
      for (let x = px - R; x <= px + R; x++) {
        state.surface[y * w + x] = SURF_GLASS;
        state.surfaceTimer[y * w + x] = 0;
      }
    }

    let eruptedInside = false;
    for (let t = 0; t < 600; t++) {
      for (const ev of stepRun(state, [emptyCommand()]).events) {
        if (ev.t !== 'action_start' || ev.action !== 'erupt') continue;
        if (Math.abs(ev.x - (px + 0.5)) <= R && Math.abs(ev.y - (py + 0.5)) <= R) eruptedInside = true;
      }
      state.player.hp = state.player.maxHp;
    }
    expect(eruptedInside, 'emergiu por dentro do vidro').toBe(false);
  });

  it('em chao solto ele EMERGE — o vidro e que faz diferenca, nao o teste', () => {
    // O controle do teste acima: sem vidro, a mesma cena produz emergencia. Sem
    // este par, um Devorador que nunca emergisse passaria no teste do vidro.
    const { state } = arena(513);
    let erupted = false;
    for (let t = 0; t < 600 && !erupted; t++) {
      for (const ev of stepRun(state, [emptyCommand()]).events) {
        if (ev.t === 'action_start' && ev.action === 'erupt') erupted = true;
      }
      state.player.hp = state.player.maxHp;
    }
    expect(erupted, 'nunca emergiu nem em areia solta').toBe(true);
  });

  it('a emergencia NAO desfaz o vidro do jogador', () => {
    const { state, worm, px, py } = arena(514);
    const w = state.config.width;
    const glassCell = py * w + px + 2;
    state.surface[glassCell] = SURF_GLASS;
    state.surfaceTimer[glassCell] = 0;
    // Emergencia forcada ao lado da placa.
    worm.x = px + 3.5;
    worm.y = py + 0.5;
    worm.nextActionAt = 0;
    for (let t = 0; t < DEVOURER_ERUPT_WINDUP_TICKS + 30; t++) {
      stepRun(state, [emptyCommand()]);
      state.player.hp = state.player.maxHp;
    }
    expect(state.surface[glassCell], 'o chefe apagou a decisao do jogador').toBe(SURF_GLASS);
  });
});

describe('Devorador Branco — a janela de dano', () => {
  it('submerso a areia absorve quase tudo; exposto, o tiro entra inteiro', () => {
    const { state, worm } = arena(521);
    worm.mood = DEVOURER_BURROWED;
    const hp0 = worm.hp;
    damageEntity(state, worm, 100, [], { kind: 'player_shot' });
    const buried = hp0 - worm.hp;

    worm.mood = DEVOURER_SURFACED;
    const hp1 = worm.hp;
    damageEntity(state, worm, 100, [], { kind: 'player_shot' });
    const exposed = hp1 - worm.hp;

    expect(buried).toBeCloseTo(100 * DEVOURER_BURROWED_ARMOR, 3);
    expect(exposed).toBe(100);
    expect(exposed, 'a janela nao vale mais que o mergulho').toBeGreaterThan(buried * 4);
  });

  it('depois de emergir ele fica exposto e depois volta para baixo', () => {
    const { state, worm } = arena(522);
    let surfaced = false;
    for (let t = 0; t < 600 && !surfaced; t++) {
      stepRun(state, [emptyCommand()]);
      state.player.hp = state.player.maxHp;
      if (worm.mood === DEVOURER_SURFACED) surfaced = true;
    }
    expect(surfaced, 'nunca chegou a ficar exposto').toBe(true);

    let reburrowed = false;
    for (let t = 0; t < 400 && !reburrowed; t++) {
      stepRun(state, [emptyCommand()]);
      state.player.hp = state.player.maxHp;
      if (worm.mood === DEVOURER_BURROWED) reburrowed = true;
    }
    expect(reburrowed, 'ficou exposto para sempre').toBe(true);
  });
});
