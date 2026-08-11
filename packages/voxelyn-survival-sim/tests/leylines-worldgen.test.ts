// LEYLINES no worldgen: o condutor geologico que acompanha a macroestrutura.
//
// O que estes testes cobram:
// 1. GEOGRAFIA: so os estratos com a identidade tracam leylines (Catedral
//    Prismatica; ocupacao Aurix fora do Ferrifero). O basalto historico e o
//    Ferrifero — cuja identidade "a parede inteira e fiacao" nao pode ser
//    diluida — nao tem uma unica celula.
// 2. TOPOLOGIA SAGRADA: a gravacao troca rocha por rocha ao longo de
//    corredores ja provados; a abertura do mapa e byte a byte a mesma com e
//    sem leylines.
// 3. SEGMENTOS: toda ativacao tem alcance ESTRUTURAL — nenhum segmento passa
//    de LEYLINE_SEGMENT_MAX_CELLS, e as juncoes existem no grid.
import { describe, expect, it } from 'vitest';
import {
  LEYLINE_SEGMENT_MAX_CELLS,
  SOLID_LEYLINE,
  SOLID_LEYLINE_NODE,
  SOLID_NONE,
  WORLD_H,
  WORLD_W,
} from '../src/constants';
import { biomeProfile, lineageOf } from '../src/strata';
import { DEFAULT_PROFILE, generateWorld } from '../src/worldgen';
import { createRun } from '../src/run';
import type { SectorBiome } from '../src/strata';

const SEEDS = [1, 2, 3, 42, 1337, 7];

const PRISMATIC: SectorBiome = { stratum: 'prismatic', occupation: 'none', lineage: 'mineral' };
const AURIX_BASALT: SectorBiome = { stratum: 'basalt', occupation: 'aurix', lineage: 'basaltic' };
const AURIX_FERRIC: SectorBiome = { stratum: 'ferric', occupation: 'aurix', lineage: 'industrial' };

describe('leylines: onde existem', () => {
  it('a Catedral traca leylines; a cicatriz Aurix expoe uma; o Ferrifero nunca', () => {
    expect(biomeProfile(PRISMATIC, 2).leylines).toBeGreaterThan(0);
    expect(biomeProfile(AURIX_BASALT, 2).leylines).toBe(1);
    // No Ferrifero a parede inteira ja e fiacao (FERRIC_VEIN_SCALE): leyline
    // por cima diluiria as duas identidades.
    expect(biomeProfile(AURIX_FERRIC, 2).leylines).toBe(0);
  });

  it('o perfil historico nao ganha uma celula de leyline', () => {
    for (const seed of SEEDS) {
      const world = generateWorld(seed, WORLD_W, WORLD_H, DEFAULT_PROFILE);
      expect(world.leylines.length).toBe(0);
      expect(world.leylineNodes.length).toBe(0);
      for (let i = 0; i < world.solid.length; i++) {
        expect(world.solid[i]).not.toBe(SOLID_LEYLINE);
        expect(world.solid[i]).not.toBe(SOLID_LEYLINE_NODE);
      }
    }
  });
});

describe('leylines: tracado', () => {
  it('gera segmentos gravados no grid, com juncoes e teto estrutural', () => {
    const profile = biomeProfile(PRISMATIC, 2);
    for (const seed of SEEDS) {
      const world = generateWorld(seed, WORLD_W, WORLD_H, profile);
      expect(world.leylines.length, `seed ${seed}: nenhuma leyline tracada`).toBeGreaterThan(0);
      expect(world.leylineNodes.length, `seed ${seed}: nenhuma juncao`).toBeGreaterThan(0);
      for (const seg of world.leylines) {
        expect(seg.cells.length).toBeGreaterThan(0);
        // O alcance de uma ativacao e decidido AQUI, nunca em runtime.
        expect(seg.cells.length).toBeLessThanOrEqual(LEYLINE_SEGMENT_MAX_CELLS);
        for (const cell of seg.cells) expect(world.solid[cell]).toBe(SOLID_LEYLINE);
      }
      for (const node of world.leylineNodes) expect(world.solid[node]).toBe(SOLID_LEYLINE_NODE);
      // Nenhuma celula do grid pertence a dois segmentos: a juncao separa.
      const all = world.leylines.flatMap((s) => s.cells);
      expect(new Set(all).size).toBe(all.length);
    }
  });

  it('a abertura do mapa e identica com e sem leylines', () => {
    const profile = biomeProfile(PRISMATIC, 2);
    for (const seed of SEEDS) {
      const com = generateWorld(seed, WORLD_W, WORLD_H, profile);
      const sem = generateWorld(seed, WORLD_W, WORLD_H, { ...profile, leylines: 0 });
      for (let i = 0; i < com.solid.length; i++) {
        expect(com.solid[i] === SOLID_NONE).toBe(sem.solid[i] === SOLID_NONE);
      }
    }
  });

  it('o tracado e deterministico: mesma seed, mesmos segmentos', () => {
    const profile = biomeProfile(PRISMATIC, 2);
    const a = generateWorld(42, WORLD_W, WORLD_H, profile);
    const b = generateWorld(42, WORLD_W, WORLD_H, profile);
    expect(a.leylines).toEqual(b.leylines);
    expect(a.leylineNodes).toEqual(b.leylineNodes);
  });
});

describe('leylines: integracao com a run', () => {
  it('createRun monta os segmentos dormentes a partir da seed', () => {
    let mineralSeed = 0;
    for (let s = 1; s < 4096; s++) {
      if (lineageOf(s) === 'mineral') {
        mineralSeed = s;
        break;
      }
    }
    expect(mineralSeed).toBeGreaterThan(0);
    const state = createRun({ seed: mineralSeed, sector: 2 });
    expect(state.stratum).toBe('prismatic');
    expect(state.leylineSegments.length).toBeGreaterThan(0);
    for (const seg of state.leylineSegments) {
      expect(seg.dischargeAt).toBe(0);
      expect(seg.refractoryUntil).toBe(0);
      expect(seg.triggeredBy).toBe(-1);
      for (const cell of seg.cells) expect(state.solid[cell]).toBe(SOLID_LEYLINE);
    }
  });
});
