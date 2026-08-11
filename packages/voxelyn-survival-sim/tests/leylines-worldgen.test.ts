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
import { biomeProfile, leylineGuaranteeSector, lineageOf } from '../src/strata';
import { DEFAULT_PROFILE, deriveLeylineNodes, generateWorld } from '../src/worldgen';
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
      for (const node of world.leylineNodes) expect(world.solid[node.cell]).toBe(SOLID_LEYLINE_NODE);
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

describe('leylines: adjacencia das juncoes', () => {
  it('a rede derivada tem juncoes que articulam dois segmentos em toda seed', () => {
    const profile = biomeProfile(PRISMATIC, 2);
    for (const seed of SEEDS) {
      const world = generateWorld(seed, WORLD_W, WORLD_H, profile);
      const nodes = deriveLeylineNodes(world.leylineNodes, world.leylines, WORLD_W);
      expect(nodes.length).toBe(world.leylineNodes.length);
      for (const node of nodes) expect(node.routed).toBe(false);
      // Juncao ORFA (zero segmentos a Chebyshev <= 2) e aceita: a gravacao
      // pode trocar de lado da parede e abrir um vao — o rele dela e no-op
      // honesto, e ela tambem nao le como conectada na tela. O que a rede NAO
      // pode e ser toda orfa: a maioria articula, e em toda seed existe
      // juncao com >= 2 segmentos — sem ela o rele nao teria o que rotear.
      const linked = nodes.filter((n) => n.segments.length > 0);
      expect(linked.length, `seed ${seed}: rede sem juncoes ligadas`).toBeGreaterThan(nodes.length / 2);
      expect(
        nodes.some((n) => n.segments.length >= 2),
        `seed ${seed}: nenhuma juncao articula dois segmentos`
      ).toBe(true);
    }
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

describe('leylines: a rede densifica com a profundidade', () => {
  it('setores 1-3 ficam identicos (o gate da impressao digital); o fundo ganha linhas', () => {
    // Historico intacto onde a assinatura enxerga:
    expect(biomeProfile(PRISMATIC, 2).leylines).toBe(2);
    expect(biomeProfile(PRISMATIC, 3).leylines).toBe(3);
    expect(biomeProfile(AURIX_BASALT, 2).leylines).toBe(1);
    expect(biomeProfile(AURIX_BASALT, 3).leylines).toBe(1);
    // A Catedral funda e mais nervada; a cicatriz funda expoe duas.
    expect(biomeProfile(PRISMATIC, 4).leylines).toBe(4);
    expect(biomeProfile(PRISMATIC, 7).leylines).toBe(4);
    expect(biomeProfile(AURIX_BASALT, 4).leylines).toBe(2);
    // O Ferrifero continua fora em qualquer profundidade.
    expect(biomeProfile(AURIX_FERRIC, 7).leylines).toBe(0);
  });
});

describe('leylines: descobribilidade', () => {
  it('o setor 1 traca uma linha em TODA linhagem, e a garantia cobre a descida', () => {
    // A boca do Veio ensina a linguagem: perfil do setor 1 sempre tem >= 1.
    for (const lineage of ['basaltic', 'cryo', 'thermal', 'arid', 'hydric', 'mineral', 'industrial'] as const) {
      const s1 = biomeProfile({ stratum: 'basalt', occupation: 'none', lineage }, 1);
      expect(s1.leylines, lineage).toBeGreaterThanOrEqual(1);
    }
    // E o grid do setor 1 realmente recebe a linha, em varias seeds.
    for (const seed of SEEDS) {
      const state = createRun({ seed });
      expect(state.leylineSegments.length, `seed ${seed}: setor 1 sem leyline`).toBeGreaterThan(0);
    }
  });

  it('a garantia forca o setor 2 quando a descida nao teria leyline natural', () => {
    // Uma seed cuja descida 2-3 nao tem prismatic nem aurix fora do ferric.
    let bare = 0;
    let natural = 0;
    for (let s = 1; s < 4096 && (bare === 0 || natural === 0); s++) {
      if (leylineGuaranteeSector(s) === 2 && bare === 0) bare = s;
      if (leylineGuaranteeSector(s) === null && natural === 0) natural = s;
    }
    expect(bare).toBeGreaterThan(0);
    expect(natural).toBeGreaterThan(0);
    // O setor 2 da seed sem leyline natural ganha a linha forcada.
    const forced = createRun({ seed: bare, sector: 2 });
    expect(forced.leylineSegments.length).toBeGreaterThan(0);
  });
});
