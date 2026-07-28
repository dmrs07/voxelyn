import { describe, expect, it } from 'vitest';
import { actionAnimation } from '../client/presentation';
import { ROCK_PROJECTILE_SCALE } from '../client/projectiles';

describe('apresentacao do Bruiser gorila', () => {
  it('usa a animacao special durante o hurl', () => {
    expect(actionAnimation('hurl')).toBe('special');
  });

  it('desenha a pedra significativamente maior que um bolt', () => {
    expect(ROCK_PROJECTILE_SCALE).toBeGreaterThanOrEqual(2.5);
  });
});
