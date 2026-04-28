import { describe, expect, it } from 'vitest';
import { resolveClip } from '../procedural/clip-fallback.js';
import type { ProceduralCharacter } from '../types.js';

const charWithClips = (ids: string[]): ProceduralCharacter =>
  ({
    id: 'x',
    seed: 1,
    width: 48,
    height: 48,
    anchor: { x: 24, y: 43 },
    palette: {},
    style: 'stalker',
    clips: Object.fromEntries(
      ids.map((id) => [
        id,
        {
          id,
          fps: 8,
          loop: true,
          lengthMs: 1000,
          generator: () => null as never,
        },
      ])
    ) as ProceduralCharacter['clips'],
  }) satisfies ProceduralCharacter;

describe('resolveClip', () => {
  it('returns present clips as base only', () => {
    expect(resolveClip(charWithClips(['idle', 'walk']), 'walk')).toEqual({ base: 'walk' });
  });

  it('falls missing cast back to idle plus overlay', () => {
    expect(resolveClip(charWithClips(['idle', 'walk', 'attack']), 'cast')).toEqual({
      base: 'idle',
      overlay: 'cast',
    });
  });

  it('falls missing hit back to idle plus overlay', () => {
    expect(resolveClip(charWithClips(['idle']), 'hit')).toEqual({
      base: 'idle',
      overlay: 'hit',
    });
  });

  it('falls missing die back to idle plus overlay', () => {
    expect(resolveClip(charWithClips(['idle']), 'die')).toEqual({
      base: 'idle',
      overlay: 'die',
    });
  });

  it('does not special-case missing walk', () => {
    expect(resolveClip(charWithClips(['idle']), 'walk')).toEqual({ base: 'walk' });
  });
});
