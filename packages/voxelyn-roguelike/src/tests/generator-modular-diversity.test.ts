import { describe, expect, it } from 'vitest';
import { hasPath } from '../world/connectivity';
import { generateFloor } from '../world/generator';

describe('generator modular diversity', () => {
  it('keeps valid module count and preserves entry to exit connectivity', () => {
    for (let floor = 1; floor <= 10; floor += 1) {
      const generated = generateFloor(13371337, floor);
      expect(generated.layoutModules.length).toBeGreaterThanOrEqual(2);
      expect(generated.layoutModules.length).toBeLessThanOrEqual(3);
      expect(
        hasPath(
          generated.mask,
          generated.width,
          generated.height,
          generated.entry,
          generated.exit
        )
      ).toBe(true);
    }
  });

  it('produces varied module combinations over a seed sweep', () => {
    const signatures = new Set<string>();
    for (let seed = 0; seed < 20; seed += 1) {
      const generated = generateFloor(5000 + seed * 97, (seed % 10) + 1);
      const signature = [...generated.layoutModules].sort().join('|');
      signatures.add(signature);
    }

    expect(signatures.size).toBeGreaterThanOrEqual(6);
  });
});
