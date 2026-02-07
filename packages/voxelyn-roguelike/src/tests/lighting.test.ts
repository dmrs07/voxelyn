import { describe, expect, it } from 'vitest';
import { createGameState } from '../game/state';
import { generateFloor } from '../world/generator';

describe('lighting', () => {
  it('generates deterministic height map and fungal lights by seed/floor', () => {
    const a = generateFloor(4242, 6);
    const b = generateFloor(4242, 6);

    expect(Array.from(a.heightMap)).toEqual(Array.from(b.heightMap));
    expect(a.fungalLights).toEqual(b.fungalLights);
  });

  it('precomputes shadow/ao/combined light maps with values in [0,1]', () => {
    const state = createGameState(99001);
    const { width, height, shadowMap, aoMap, baseLightMap } = state.level;

    expect(shadowMap.length).toBe(width * height);
    expect(aoMap.length).toBe(width * height);
    expect(baseLightMap.length).toBe(width * height);

    for (let i = 0; i < baseLightMap.length; i += 1) {
      expect(shadowMap[i]).toBeGreaterThanOrEqual(0);
      expect(shadowMap[i]).toBeLessThanOrEqual(1);
      expect(aoMap[i]).toBeGreaterThanOrEqual(0);
      expect(aoMap[i]).toBeLessThanOrEqual(1);
      expect(baseLightMap[i]).toBeGreaterThanOrEqual(0);
      expect(baseLightMap[i]).toBeLessThanOrEqual(1);
    }
  });
});
