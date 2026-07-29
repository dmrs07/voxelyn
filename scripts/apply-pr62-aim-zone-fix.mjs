import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const root = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
process.chdir(root);

const replaceExact = (path, before, after, expected = 1) => {
  const source = readFileSync(path, 'utf8');
  const count = source.split(before).length - 1;
  if (count !== expected) throw new Error(`${path}: expected ${expected} occurrence(s), found ${count}`);
  writeFileSync(path, source.replace(before, after), 'utf8');
};

const inputPath = 'packages/voxelyn-survival/src/client/input.ts';
const testPath = 'packages/voxelyn-survival/src/tests/touch-cooldown.test.ts';

replaceExact(
  inputPath,
  "export const TOUCH_BUTTON_HIT_SCALE = 1.08;\nconst STICK_ACTIVATION_SCALE = 1.55;\nconst MOVE_DEAD_ZONE = 0.08;",
  "export const TOUCH_BUTTON_HIT_SCALE = 1.08;\nconst MOVE_STICK_ACTIVATION_SCALE = 1.55;\nexport const AIM_STICK_ACTIVATION_SCALE = 1.45;\nconst MOVE_DEAD_ZONE = 0.08;",
);
replaceExact(
  inputPath,
  "    const aimX = width - AIM_JOYSTICK_RADIUS - safeRight;\n    const aimY = height - AIM_JOYSTICK_RADIUS - safeBottom;",
  "    const aimX = width - AIM_JOYSTICK_RADIUS - safeRight;\n    const aimY = height - AIM_JOYSTICK_RADIUS - safeBottom;\n    const aimActivationRadius = AIM_JOYSTICK_RADIUS * AIM_STICK_ACTIVATION_SCALE;",
);
replaceExact(
  inputPath,
  "    const actionY = aimY - AIM_JOYSTICK_RADIUS - hitRadius - gap;\n    const dodgeX = aimX - AIM_JOYSTICK_RADIUS - hitRadius - gap;",
  "    const actionY = aimY - aimActivationRadius - hitRadius - gap;\n    const dodgeX = aimX - aimActivationRadius - hitRadius - gap;",
);
replaceExact(
  inputPath,
  "Math.hypot(x - move.originX, y - move.originY) <= MOVE_JOYSTICK_RADIUS * STICK_ACTIVATION_SCALE;",
  "Math.hypot(x - move.originX, y - move.originY) <= MOVE_JOYSTICK_RADIUS * MOVE_STICK_ACTIVATION_SCALE;",
);
replaceExact(
  inputPath,
  "const inAimZone = Math.hypot(x - aim.originX, y - aim.originY) <= AIM_JOYSTICK_RADIUS * 1.65;",
  "const inAimZone =\n        Math.hypot(x - aim.originX, y - aim.originY) <=\n        AIM_JOYSTICK_RADIUS * AIM_STICK_ACTIVATION_SCALE;",
);

replaceExact(
  testPath,
  "  AIM_JOYSTICK_RADIUS,\n  MOVE_JOYSTICK_RADIUS,",
  "  AIM_JOYSTICK_RADIUS,\n  AIM_STICK_ACTIVATION_SCALE,\n  MOVE_JOYSTICK_RADIUS,",
);
replaceExact(
  testPath,
  "expect(distanceFromAim).toBeGreaterThanOrEqual(AIM_JOYSTICK_RADIUS + aHit + 10);",
  "expect(distanceFromAim).toBeGreaterThanOrEqual(\n        AIM_JOYSTICK_RADIUS * AIM_STICK_ACTIVATION_SCALE + aHit + 10\n      );",
);

const testSource = readFileSync(testPath, 'utf8');
const finalClose = testSource.lastIndexOf('\n});');
if (finalClose < 0) throw new Error(`${testPath}: final describe close not found`);
const regression = `\n\n  it('mantem botoes fora da zona real da mira em landscape estreito', () => {\n    const input = new SurvivalInput({} as HTMLCanvasElement);\n    input.layoutButtons(568, 320);\n\n    const aim = input.state.aimTouch;\n    const activationRadius = AIM_JOYSTICK_RADIUS * AIM_STICK_ACTIVATION_SCALE;\n    for (const button of input.state.buttons) {\n      const buttonHitRadius = button.r * TOUCH_BUTTON_HIT_SCALE;\n      const gap = Math.hypot(button.cx - aim.originX, button.cy - aim.originY) -\n        (activationRadius + buttonHitRadius);\n      expect(gap).toBeGreaterThanOrEqual(10);\n    }\n  });`;
writeFileSync(testPath, testSource.slice(0, finalClose) + regression + testSource.slice(finalClose), 'utf8');

execFileSync('git', ['diff', '--check'], { stdio: 'inherit' });
console.log('aim activation zone fix applied');
