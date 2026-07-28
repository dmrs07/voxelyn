import { describe, expect, it } from 'vitest';
import { stunIndicatorOffsets } from '../client/render';

describe('indicador visual de stun', () => {
  it('e deterministico por entidade e tick', () => {
    expect(stunIndicatorOffsets(7, 42)).toEqual(stunIndicatorOffsets(7, 42));
    expect(stunIndicatorOffsets(7, 42)).not.toEqual(stunIndicatorOffsets(7, 43));
  });

  it('mantem dois arcos em lados opostos', () => {
    const [a, b] = stunIndicatorOffsets(3, 11);
    expect(a[0] + b[0]).toBeCloseTo(0);
    expect(a[1] + b[1]).toBeCloseTo(0);
  });
});
