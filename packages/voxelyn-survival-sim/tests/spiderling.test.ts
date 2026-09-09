import { describe, expect, it } from 'vitest';
import { createRun } from '../src/run';
import { sectorBiome } from '../src/strata';
import { ARCHETYPES, damageEntity, spawnEnemy, updateEnemies } from '../src/entities';
import {
  SOLID_NONE,
  SOLID_ROCK,
  SPIDERLING_COUNT,
  SPIDERLING_FLEE_TICKS,
  SPIDERLING_SIGHT,
} from '../src/constants';
import type { SemanticEvent } from '../src/types';

/** Uma sala vazia com um Prospector parado e uma aranhinha a distancia pedida. */
const room = (dx: number, dy = 0) => {
  const state = createRun({ seed: 1, playerCount: 1 });
  state.solid.fill(SOLID_NONE);
  state.surface.fill(0);
  state.enemies = [];
  state.tick = 100;
  state.player.x = 30.5;
  state.player.y = 30.5;
  state.playerExtras[0].joined = true;
  const spider = spawnEnemy(state, 'silk_spiderling', 30 + dx, 30 + dy, false);
  return { state, spider };
};

const dist = (a: { x: number; y: number }, b: { x: number; y: number }): number =>
  Math.hypot(a.x - b.x, a.y - b.y);

describe('a aranhinha da rocha suturada', () => {
  it('e inofensiva por definicao: sem dano de contato, sem aggro, um ponto de vida', () => {
    const def = ARCHETYPES.silk_spiderling;
    expect(def.contactDamage).toBe(0);
    expect(def.aggroRange).toBe(0);
    expect(def.hp).toBe(1);
  });

  it('foge ao AVISTAR o Prospector, e continua correndo depois de perde-lo de vista', () => {
    const { state, spider } = room(3);
    const before = dist(spider, state.player);
    for (let n = 0; n < 10; n++) {
      state.tick++;
      updateEnemies(state, []);
    }
    expect(dist(spider, state.player)).toBeGreaterThan(before + 1);
    expect(spider.alertedUntil).toBeGreaterThan(state.tick);
    // O susto renova enquanto ele estiver a vista; tirado de vista, ainda
    // corre ate o relogio acabar, no rumo em que ja ia.
    const seenAt = spider.alertedUntil;
    state.player.x = 5.5;
    state.player.y = 5.5;
    const x0 = spider.x;
    for (let n = 0; n < 5; n++) {
      state.tick++;
      updateEnemies(state, []);
    }
    expect(spider.alertedUntil).toBe(seenAt);
    expect(spider.x).not.toBe(x0);
    expect(seenAt - (state.tick - 5)).toBeLessThanOrEqual(SPIDERLING_FLEE_TICKS);
  });

  it('atras de uma parede nao sabe do Prospector: fica onde esta', () => {
    const { state, spider } = room(4);
    const w = state.config.width;
    // Uma parede entre os dois, a dois tiles do Prospector.
    for (let y = 26; y <= 34; y++) state.solid[y * w + 32] = SOLID_ROCK;
    const x0 = spider.x,
      y0 = spider.y;
    for (let n = 0; n < 6; n++) {
      state.tick++;
      updateEnemies(state, []);
    }
    expect(spider.alertedUntil).toBeLessThanOrEqual(state.tick);
    // Sem susto ela so passeia em passinhos curtos: nunca mais que um tile.
    expect(dist(spider, { x: x0, y: y0 })).toBeLessThan(1);
  });

  it('nao ve mais longe que o alcance de visao', () => {
    const { state, spider } = room(SPIDERLING_SIGHT + 2);
    state.tick++;
    updateEnemies(state, []);
    expect(spider.alertedUntil).toBeLessThanOrEqual(state.tick);
  });

  it('e esmagada por quem passa por cima, sem contar como abate', () => {
    const { state, spider } = room(0.1);
    const events: SemanticEvent[] = [];
    state.tick++;
    updateEnemies(state, events);
    expect(spider.alive).toBe(false);
    expect(events.some((e) => e.t === 'death' && e.entity === spider.id)).toBe(true);
    expect(state.stats.kills.silk_spiderling).toBe(0);
    // Um tiro tambem a mata, e tambem nao conta.
    const { state: s2, spider: sp2 } = room(4);
    damageEntity(s2, sp2, 5, []);
    expect(sp2.alive).toBe(false);
    expect(s2.stats.kills.silk_spiderling).toBe(0);
    // O Prospector nunca leva dano dela.
    const { state: s3 } = room(0.2);
    const hp = s3.player.hp;
    for (let n = 0; n < 20; n++) {
      s3.tick++;
      updateEnemies(s3, []);
    }
    expect(s3.player.hp).toBe(hp);
  });

  it('nasce so na rocha suturada, em volta das suturas e longe da entrada', () => {
    let seen = 0;
    for (let seed = 0; seed < 120 && seen < 4; seed++) {
      const biome = sectorBiome(seed, 7);
      const state = createRun({
        seed,
        sector: 7,
        depth: { generation: 'G-04', sectorCount: 7, coreSectors: [3, 7] },
      });
      const spiders = state.enemies.filter((e) => e.archetype === 'silk_spiderling');
      if (biome.occupation !== 'stitchers') {
        expect(spiders).toHaveLength(0);
        continue;
      }
      seen++;
      expect(spiders.length).toBeGreaterThanOrEqual(SPIDERLING_COUNT / 2);
      expect(spiders.length).toBeLessThanOrEqual(SPIDERLING_COUNT);
      for (const s of spiders) {
        expect(dist(s, state.entry)).toBeGreaterThanOrEqual(8);
        expect(state.solid[Math.floor(s.y) * state.config.width + Math.floor(s.x)]).toBe(
          SOLID_NONE,
        );
      }
    }
    expect(seen).toBeGreaterThan(0);
  });
});
