import { describe, expect, it } from 'vitest';
import { createProceduralCharacter } from '../procedural/character.js';

describe('procedural character anchors', () => {
  it('authored 32x32 characters anchor at their foot baseline', () => {
    const character = createProceduralCharacter({
      id: 'a',
      style: 'player',
      useAuthored: true,
    });

    expect(character.width).toBe(32);
    expect(character.height).toBe(32);
    expect(character.anchor).toEqual({ x: 16, y: 29 });
  });

  it('procedural 16x20 characters anchor at bottom center', () => {
    const character = createProceduralCharacter({ id: 'b', style: 'stalker' });

    expect(character.width).toBe(16);
    expect(character.height).toBe(20);
    expect(character.anchor).toEqual({ x: 8, y: 20 });
  });
});
