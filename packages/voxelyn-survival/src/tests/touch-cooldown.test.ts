import { describe, expect, it } from 'vitest';
import { cooldownRemainingFraction } from '../client/cooldown-overlay';
import { SurvivalInput } from '../client/input';

describe('touch cooldown reveal', () => {
  it('moves from fully covered to fully revealed', () => {
    expect(cooldownRemainingFraction(120, 0, 120)).toBe(1);
    expect(cooldownRemainingFraction(120, 60, 120)).toBe(0.5);
    expect(cooldownRemainingFraction(120, 120, 120)).toBe(0);
  });

  it('clamps stale and future timers', () => {
    expect(cooldownRemainingFraction(20, 30, 10)).toBe(0);
    expect(cooldownRemainingFraction(40, 10, 10)).toBe(1);
  });
});

describe('touch safe-area layout', () => {
  it('keeps every action inside the actual right and bottom safe bounds', () => {
    const input = new SurvivalInput({} as HTMLCanvasElement);
    const width = 844;
    const height = 390;
    const safeRight = 44;
    const safeBottom = 21;

    input.layoutButtons(width, height, { right: safeRight, bottom: safeBottom });

    for (const button of input.state.buttons) {
      expect(button.cx + button.r).toBeLessThanOrEqual(width - safeRight);
      expect(button.cy + button.r).toBeLessThanOrEqual(height - safeBottom);
    }
  });
});
