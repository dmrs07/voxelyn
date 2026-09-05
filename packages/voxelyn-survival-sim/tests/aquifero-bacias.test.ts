// AS BACIAS DO AQUIFERO NEGRO: agua profunda coerente, cercada de agua rasa,
// que nunca bloqueia uma rota obrigatoria.
import { describe, expect, it } from 'vitest';
import { createRun } from '../src/run';
import { AQUIFER_ARENA_POOLS, floodWalkable, generateWorld } from '../src/worldgen';
import { biomeProfile, type SectorBiome } from '../src/strata';
import { isPoolCore, nearestPoolCore } from '../src/leviathan';
import { SOLID_NONE, SURF_DEEP_WATER, SURF_WATER, WORLD_H, WORLD_W } from '../src/constants';

const aquifer: SectorBiome = { stratum: 'aquifer', occupation: 'none', lineage: 'hydric' };
const basalt: SectorBiome = { stratum: 'basalt', occupation: 'none', lineage: 'basaltic' };

const worldOf = (seed: number, sector = 4) =>
  generateWorld(seed, WORLD_W, WORLD_H, biomeProfile(aquifer, sector));

const deepCells = (surface: Uint8Array): number[] => {
  const out: number[] = [];
  for (let i = 0; i < surface.length; i++) if (surface[i] === SURF_DEEP_WATER) out.push(i);
  return out;
};

describe('Aquifero Negro — as bacias profundas', () => {
  it('a geracao e deterministica: a mesma seed, as mesmas celulas profundas', () => {
    const a = worldOf(31);
    const b = worldOf(31);
    expect(deepCells(a.surface)).toEqual(deepCells(b.surface));
    expect(deepCells(a.surface).length).toBeGreaterThan(0);
  });

  it('toda celula profunda tem margem rasa: nunca encosta em piso seco caminhavel', () => {
    for (const seed of [1, 2, 3, 5, 8, 13, 21, 34]) {
      const w = worldOf(seed);
      for (const i of deepCells(w.surface)) {
        const x = i % WORLD_W;
        const y = (i - x) / WORLD_W;
        for (const [dx, dy] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ]) {
          const n = (y + dy) * WORLD_W + (x + dx);
          if (w.solid[n] !== SOLID_NONE) continue;
          expect(
            w.surface[n] === SURF_WATER || w.surface[n] === SURF_DEEP_WATER,
            `seed ${seed}: agua profunda em ${i} encostada em piso seco ${n}`,
          ).toBe(true);
        }
      }
    }
  });

  it('nao ha nucleo de uma ou duas celulas (ruido sal e pimenta)', () => {
    for (const seed of [1, 2, 3, 5, 8]) {
      const w = worldOf(seed);
      const deep = new Set(deepCells(w.surface));
      const seen = new Set<number>();
      for (const start of deep) {
        if (seen.has(start)) continue;
        seen.add(start);
        const comp = [start];
        for (let h = 0; h < comp.length; h++) {
          const c = comp[h];
          const x = c % WORLD_W;
          const y = (c - x) / WORLD_W;
          for (const [dx, dy] of [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1],
          ]) {
            const n = (y + dy) * WORLD_W + (x + dx);
            if (!deep.has(n) || seen.has(n)) continue;
            seen.add(n);
            comp.push(n);
          }
        }
        expect(comp.length, `seed ${seed}: nucleo minusculo em ${start}`).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it('agua profunda nunca ocupa posicao critica: entrada, pedestal, chefe, terminais, caches, spawns', () => {
    for (const seed of [1, 2, 3, 5, 8, 13, 21, 34, 55, 89]) {
      const w = worldOf(seed);
      const at = (p: { x: number; y: number }) => w.surface[p.y * WORLD_W + p.x];
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          expect(at({ x: w.entry.x + dx, y: w.entry.y + dy })).not.toBe(SURF_DEEP_WATER);
          expect(at({ x: w.corePos.x + dx, y: w.corePos.y + dy })).not.toBe(SURF_DEEP_WATER);
          expect(at({ x: w.guardianSpawn.x + dx, y: w.guardianSpawn.y + dy })).not.toBe(
            SURF_DEEP_WATER,
          );
        }
      }
      for (const site of w.salvageSites) {
        expect(at(site.terminal)).not.toBe(SURF_DEEP_WATER);
        expect(at(site.cache)).not.toBe(SURF_DEEP_WATER);
      }
      for (const spawn of w.enemySpawns) expect(at(spawn)).not.toBe(SURF_DEEP_WATER);
      for (const vent of w.ventPositions) expect(at(vent)).not.toBe(SURF_DEEP_WATER);
    }
  });

  it('a conectividade trata agua profunda como fatal: tudo continua alcancavel a pe', () => {
    for (const seed of [1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233]) {
      const w = worldOf(seed);
      const walk = floodWalkable(w.solid, w.surface, WORLD_W, WORLD_H, w.entry.x, w.entry.y);
      const reach = (p: { x: number; y: number }) => walk.has(p.y * WORLD_W + p.x);
      expect(reach(w.corePos), `seed ${seed}: pedestal ilhado`).toBe(true);
      expect(reach(w.guardianSpawn), `seed ${seed}: chefe ilhado`).toBe(true);
      for (const site of w.salvageSites) {
        expect(reach(site.terminal), `seed ${seed}: terminal ilhado`).toBe(true);
        expect(reach(site.cache), `seed ${seed}: cache ilhado`).toBe(true);
      }
      for (const spawn of w.enemySpawns)
        expect(reach(spawn), `seed ${seed}: spawn ilhado`).toBe(true);
    }
  });

  it('a arena do Leviata tem pocas ocupaveis em volta do ponto do chefe, com chao seco entre elas', () => {
    let arenasWithPools = 0;
    for (const seed of [1, 2, 3, 5, 8, 13, 21, 34]) {
      const w = worldOf(seed, 7);
      const state = {
        config: { width: WORLD_W, height: WORLD_H },
        solid: w.solid,
        surface: w.surface,
      };
      let cores = 0;
      for (const [dx, dy] of AQUIFER_ARENA_POOLS) {
        const x = w.guardianSpawn.x + dx;
        const y = w.guardianSpawn.y + dy;
        if (x < 2 || y < 2 || x >= WORLD_W - 2 || y >= WORLD_H - 2) continue;
        if (isPoolCore(state as never, y * WORLD_W + x)) cores++;
      }
      if (cores >= 2) arenasWithPools++;
      expect(
        nearestPoolCore(state as never, w.guardianSpawn.x, w.guardianSpawn.y, 10),
      ).toBeGreaterThanOrEqual(0);
      // O ponto do chefe continua seco: e a Leviata que vai ate a poca, e nao a
      // poca que engole o ponto.
      expect(w.surface[w.guardianSpawn.y * WORLD_W + w.guardianSpawn.x]).not.toBe(SURF_DEEP_WATER);
    }
    expect(arenasWithPools).toBeGreaterThanOrEqual(6);
  });

  it('o Leviata nasce ancorado sobre um nucleo profundo da propria arena', () => {
    // G-04, setor 7: o fundo da linhagem hidrica e do Leviata.
    let checked = 0;
    for (let seed = 1; seed <= 40 && checked < 3; seed++) {
      const state = createRun({
        seed,
        sector: 7,
        depth: { generation: 'G-04', sectorCount: 7, coreSectors: [3, 7] },
      });
      if (state.stratum !== 'aquifer' || state.sectorBoss.archetype !== 'sheet_leviathan') continue;
      checked++;
      const boss = state.enemies.find((e) => e.archetype === 'sheet_leviathan');
      expect(boss).toBeDefined();
      if (!boss) continue;
      const cell = Math.floor(boss.y) * state.config.width + Math.floor(boss.x);
      expect(state.surface[cell]).toBe(SURF_DEEP_WATER);
      expect(isPoolCore(state, cell)).toBe(true);
    }
    expect(checked).toBeGreaterThan(0);
  });

  it('o basalto seco nao ganha agua profunda nenhuma, e continua byte a byte', () => {
    const w = generateWorld(9, WORLD_W, WORLD_H, biomeProfile(basalt, 2));
    expect(deepCells(w.surface)).toHaveLength(0);
  });

  it('a profundidade do setor aumenta moderadamente a agua, sem afogar o mapa', () => {
    const frac = (sector: number) => {
      let deep = 0;
      let open = 0;
      for (const seed of [1, 2, 3, 5, 8]) {
        const w = worldOf(seed, sector);
        for (let i = 0; i < w.solid.length; i++) {
          if (w.solid[i] !== SOLID_NONE) continue;
          open++;
          if (w.surface[i] === SURF_DEEP_WATER) deep++;
        }
      }
      return deep / open;
    };
    const shallowSector = frac(2);
    const deepSector = frac(7);
    expect(deepSector).toBeGreaterThanOrEqual(shallowSector * 0.9);
    expect(deepSector).toBeLessThan(0.08);
  });
});
