import { describe, expect, it } from 'vitest';
import type { AnimationClip, AnimationSet } from '../types.js';
import { createAnimationPlayer, stepAnimation } from '../runtime/player.js';

const solidClip = (id: string, color: number, fps: number, loop: boolean, lengthMs: number): AnimationClip => ({
  id,
  fps,
  loop,
  lengthMs,
  generator: ({ out }) => {
    out.pixels.fill(color >>> 0);
    return out;
  },
});

const makeSet = (): AnimationSet => ({
  idle: solidClip('idle', 0x101010ff, 10, true, 400),
  walk: solidClip('walk', 0x202020ff, 12, true, 300),
  attack: solidClip('attack', 0x303030ff, 12, false, 240),
  die: solidClip('die', 0x404040ff, 8, false, 500),
});

describe('runtime player', () => {
  it('advances looping clips by fps', () => {
    const player = createAnimationPlayer({ set: makeSet(), width: 8, height: 8 });
    const f0 = stepAnimation(player, 0, 'idle', 'dr');
    const f1 = stepAnimation(player, 120, 'idle', 'dr');
    const f2 = stepAnimation(player, 120, 'idle', 'dr');

    expect(f0.clipId).toBe('idle');
    expect(f1.frameIndex).toBeGreaterThanOrEqual(1);
    expect(f2.frameIndex).toBeGreaterThanOrEqual(f1.frameIndex);
  });

  it('keeps die as terminal non-interruptible clip', () => {
    const player = createAnimationPlayer({ set: makeSet(), width: 8, height: 8 });
    stepAnimation(player, 16, 'die', 'dr');
    const during = stepAnimation(player, 100, 'move', 'dr');
    const after = stepAnimation(player, 700, 'idle', 'dr');

    expect(during.clipId).toBe('die');
    expect(after.clipId).toBe('die');
  });
});
