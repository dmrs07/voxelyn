import { describe, expect, it } from 'vitest';
import { SPRITE_BY_ARCHETYPE } from '../sprite-archetype-map.js';

describe('SPRITE_BY_ARCHETYPE', () => {
  it('has the locked character mapping', () => {
    expect(SPRITE_BY_ARCHETYPE.player).toBe('excavator');
    expect(SPRITE_BY_ARCHETYPE.stalker).toBe('striker');
    expect(SPRITE_BY_ARCHETYPE.bruiser).toBe('bruiser');
    expect(SPRITE_BY_ARCHETYPE.spitter).toBe('spitter');
    expect(SPRITE_BY_ARCHETYPE.spore_bomber).toBe('spore_bomber');
    expect(SPRITE_BY_ARCHETYPE.guardian).toBe('guardian');
  });
});
