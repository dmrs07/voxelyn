import { describe, expect, it } from 'vitest';
import { cooldownRemainingFraction, resolveCooldownReadyAt } from '../client/cooldown-overlay';
import {
  AIM_JOYSTICK_RADIUS,
  MOVE_JOYSTICK_RADIUS,
  TOUCH_BUTTON_HIT_SCALE,
  deactivateTouchControls,
  SurvivalInput,
} from '../client/input';

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

  it('never invents a cooldown from a rejected solo press', () => {
    expect(resolveCooldownReadyAt('authoritative', 0, 0, true, 25, 120)).toBe(0);
  });

  it('predicts an online press once without restarting repeated taps', () => {
    const firstReadyAt = resolveCooldownReadyAt('predicted', 0, 0, true, 25, 120);
    expect(firstReadyAt).toBe(145);
    expect(resolveCooldownReadyAt('predicted', 0, firstReadyAt, true, 30, 120)).toBe(firstReadyAt);
  });
});

describe('touch modality', () => {
  it('deactivates both sticks and pressed buttons when mouse takes over', () => {
    const input = new SurvivalInput({} as HTMLCanvasElement);
    input.layoutButtons(844, 390);
    input.state.usingTouch = true;
    input.state.joystick = { active: true, originX: 80, originY: 300, dx: 0.8, dy: 0.2, pointerId: 1 };
    input.state.aimTouch.active = true;
    input.state.aimTouch.dx = 1;
    input.state.aimTouch.dy = 0.5;
    input.state.aimTouch.pointerId = 2;
    input.state.buttons[0]!.pressed = true;

    deactivateTouchControls(input.state);

    expect(input.state.usingTouch).toBe(false);
    expect(input.state.joystick).toMatchObject({ active: false, dx: 0, dy: 0, pointerId: -1 });
    expect(input.state.aimTouch).toMatchObject({ active: false, dx: 0, dy: 0, pointerId: -1 });
    expect(input.state.buttons.every((button) => !button.pressed)).toBe(true);
  });

  it('ignores stale touch vectors whenever touch is not the active modality', () => {
    const input = new SurvivalInput({} as HTMLCanvasElement);
    input.state.usingTouch = false;
    input.state.joystick = { active: true, originX: 0, originY: 0, dx: 1, dy: 1, pointerId: 1 };
    input.state.aimTouch = { active: true, originX: 0, originY: 0, dx: 1, dy: 1, pointerId: 2 };

    const command = input.snapshot({ x: 0, y: 0 });

    expect(command.move).toEqual({ x: 0, y: 0 });
    expect(command.fire).toBe(false);
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

  it('ancora sticks simetricos e separa todas as hitboxes de acao', () => {
    const input = new SurvivalInput({} as HTMLCanvasElement);
    const width = 844;
    const height = 390;
    const safeLeft = 28;
    const safeRight = 44;
    const safeBottom = 21;

    input.layoutButtons(width, height, { left: safeLeft, right: safeRight, bottom: safeBottom });

    const move = input.state.joystick;
    const aim = input.state.aimTouch;
    expect(move.originX - MOVE_JOYSTICK_RADIUS).toBeGreaterThanOrEqual(safeLeft);
    expect(aim.originX + AIM_JOYSTICK_RADIUS).toBeLessThanOrEqual(width - safeRight);
    expect(move.originY).toBe(aim.originY);
    expect(move.originX).toBeLessThan(width / 2);
    expect(aim.originX).toBeGreaterThan(width / 2);

    for (let i = 0; i < input.state.buttons.length; i++) {
      const a = input.state.buttons[i]!;
      const aHit = a.r * TOUCH_BUTTON_HIT_SCALE;
      const distanceFromAim = Math.hypot(a.cx - aim.originX, a.cy - aim.originY);
      expect(distanceFromAim).toBeGreaterThanOrEqual(AIM_JOYSTICK_RADIUS + aHit + 10);

      for (let j = i + 1; j < input.state.buttons.length; j++) {
        const b = input.state.buttons[j]!;
        const gap = Math.hypot(a.cx - b.cx, a.cy - b.cy) -
          (aHit + b.r * TOUCH_BUTTON_HIT_SCALE);
        expect(gap).toBeGreaterThanOrEqual(10);
      }
    }
  });
});
