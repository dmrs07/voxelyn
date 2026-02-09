import { describe, expect, it } from 'vitest';
import type { AnimationClip, AnimationSet } from '../types.js';
import { createAnimationPlayer, stepAnimation } from '../runtime/player.js';

const clip = (id: string, loop: boolean, lengthMs: number): AnimationClip => ({
  id,
  fps: 10,
  loop,
  lengthMs,
  generator: ({ out }) => {
    out.pixels.fill(0);
    return out;
  },
});

const set: AnimationSet = {
  idle: clip('idle', true, 500),
  walk: clip('walk', true, 300),
  attack: clip('attack', false, 260),
  hit: clip('hit', false, 160),
  die: clip('die', false, 500),
};

describe('state machine', () => {
  it('keeps one-shot hit until it ends', () => {
    const player = createAnimationPlayer({ set, width: 8, height: 8 });
    const a = stepAnimation(player, 16, 'hit', 'dr');
    const b = stepAnimation(player, 16, 'move', 'dr');
    expect(a.clipId).toBe('hit');
    expect(b.clipId).toBe('hit');

    const c = stepAnimation(player, 260, 'move', 'dr');
    expect(c.clipId).toBe('walk');
  });

  it('allows die to interrupt current one-shot', () => {
    const player = createAnimationPlayer({ set, width: 8, height: 8 });
    stepAnimation(player, 16, 'attack', 'dr');
    const die = stepAnimation(player, 16, 'die', 'dr');
    expect(die.clipId).toBe('die');
  });
});
