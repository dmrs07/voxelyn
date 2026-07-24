import { describe, expect, it } from 'vitest';
import {
  ENEMY_MIN_SPAWN_DIST,
  SOLID_NONE,
  SURF_NONE,
  WORLD_H,
  WORLD_W,
} from '../src/constants';
import { chunkOf, floodOpen, generateWorld } from '../src/worldgen';
import { createRun } from '../src/run';
import { setSurface } from '../src/cells';

const SEEDS = [1, 2, 3, 42, 1337, 0xdecafbad, 987654321, 7];

describe('worldgen', () => {
  it('gera mapas solucionaveis: nucleo alcancavel a partir da entrada em todas as seeds', () => {
    for (const seed of SEEDS) {
      const world = generateWorld(seed, WORLD_W, WORLD_H);
      const open = floodOpen(world.solid, WORLD_W, WORLD_H, world.entry.x, world.entry.y);
      const coreIdx = world.corePos.y * WORLD_W + world.corePos.x;
      expect(open.has(coreIdx), `seed ${seed}: nucleo inalcancavel`).toBe(true);
      expect(open.size).toBeGreaterThan(WORLD_W * WORLD_H * 0.2);
    }
  });

  it('jogador nao nasce em material perigoso e a area de entrada esta limpa', () => {
    for (const seed of SEEDS) {
      const world = generateWorld(seed, WORLD_W, WORLD_H);
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const i = (world.entry.y + dy) * WORLD_W + (world.entry.x + dx);
          expect(world.surface[i]).toBe(SURF_NONE);
        }
      }
      expect(world.solid[world.entry.y * WORLD_W + world.entry.x]).toBe(SOLID_NONE);
    }
  });

  it('inimigos nascem longe da entrada e em celulas abertas', () => {
    for (const seed of SEEDS) {
      const world = generateWorld(seed, WORLD_W, WORLD_H);
      expect(world.enemySpawns.length).toBeGreaterThanOrEqual(10);
      for (const spawn of world.enemySpawns) {
        expect(world.solid[spawn.y * WORLD_W + spawn.x]).toBe(SOLID_NONE);
        const d = Math.hypot(spawn.x - world.entry.x, spawn.y - world.entry.y);
        expect(d, `seed ${seed}: spawn a ${d.toFixed(1)} tiles da entrada`).toBeGreaterThanOrEqual(
          ENEMY_MIN_SPAWN_DIST * 0.75
        );
      }
    }
  });

  it('mesma seed produz o mesmo mundo (determinismo da geracao)', () => {
    const a = generateWorld(1337, WORLD_W, WORLD_H);
    const b = generateWorld(1337, WORLD_W, WORLD_H);
    expect(Buffer.from(a.solid).equals(Buffer.from(b.solid))).toBe(true);
    expect(Buffer.from(a.surface).equals(Buffer.from(b.surface))).toBe(true);
    expect(a.entry).toEqual(b.entry);
    expect(a.corePos).toEqual(b.corePos);
    expect(a.enemySpawns).toEqual(b.enemySpawns);
  });
});

describe('chunkOf com mundos customizados', () => {
  it('usa a largura real, nao a constante do mundo padrao', () => {
    // mundo 64 de largura -> 4 chunks por linha (o padrao 96 tem 6)
    expect(chunkOf(0, 0, 64)).toBe(0);
    expect(chunkOf(48, 0, 64)).toBe(3);
    expect(chunkOf(0, 16, 64)).toBe(4); // antes: 6, com stride do mundo padrao
    expect(chunkOf(0, 32, 64)).toBe(8);
  });

  it('mutacoes em mundo customizado marcam o chunk certo e ficam no vetor', () => {
    const state = createRun({ seed: 5, width: 64, height: 64 });
    const chunks = state.chunkVersion.length;
    expect(chunks).toBe(16); // 4x4

    const before = Array.from(state.chunkVersion);
    setSurface(state, 40 * 64 + 8, 4, 10); // linha 40 -> chunkY 2, chunkX 0 -> 8
    const changed: number[] = [];
    for (let i = 0; i < chunks; i++) if (state.chunkVersion[i] !== before[i]) changed.push(i);

    expect(changed).toEqual([8]); // antes: indice 12, fora da coluna correta
  });
});
