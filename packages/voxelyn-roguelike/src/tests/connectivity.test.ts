import { describe, expect, it } from 'vitest';
import { computeComponents, hasPath } from '../world/connectivity';
import { generateFloor } from '../world/generator';

describe('connectivity', () => {
  it('keeps entry and exit connected', () => {
    const floor = generateFloor(999, 6);
    expect(hasPath(floor.mask, floor.width, floor.height, floor.entry, floor.exit)).toBe(true);
  });

  it('results in a single passable component', () => {
    const floor = generateFloor(1337, 8);
    const components = computeComponents(floor.mask, floor.width, floor.height);
    expect(components.length).toBe(1);
  });
});
