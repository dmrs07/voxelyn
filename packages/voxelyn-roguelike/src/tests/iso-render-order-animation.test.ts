import { describe, expect, it } from 'vitest';
import { makeDrawKey } from '@voxelyn/core';
import { makeAnimatedDrawKey } from '@voxelyn/animation';

describe('iso render order animation', () => {
  it('keeps animated draw key ordering compatible with core keys', () => {
    const base = makeDrawKey(10, 10, 0, 2);
    const animated = makeAnimatedDrawKey(10, 10, 0, 3);
    const far = makeAnimatedDrawKey(4, 4, 0, 2);

    expect(animated).toBeGreaterThan(base);
    expect(base).toBeGreaterThan(far);
  });
});
