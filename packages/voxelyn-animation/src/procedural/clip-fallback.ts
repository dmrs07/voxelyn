import type { ProceduralCharacter } from '../types.js';

export type ResolvedClip =
  | { base: string }
  | { base: 'idle'; overlay: 'cast' | 'hit' | 'die' };

export const resolveClip = (
  character: ProceduralCharacter,
  requested: string
): ResolvedClip => {
  const clips = character.clips as Record<string, unknown>;
  if (clips[requested]) return { base: requested };
  if (requested === 'cast' || requested === 'hit' || requested === 'die') {
    return { base: 'idle', overlay: requested };
  }
  return { base: requested };
};
