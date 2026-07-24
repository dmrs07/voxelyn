import { describe, expect, it } from 'vitest';
import { createRun, emptyCommand, hashAuthoritativeState, stepRun } from '../sim/run';
import type { PlayerCommand } from '../sim/types';

/** Script de comandos deterministico: anda em espiral, atira em rajadas, esquiva. */
const scriptedCommand = (tick: number): PlayerCommand => {
  const cmd = emptyCommand();
  const phase = Math.floor(tick / 40) % 4;
  cmd.move =
    phase === 0 ? { x: 1, y: 0 } : phase === 1 ? { x: 0, y: 1 } : phase === 2 ? { x: -1, y: 0 } : { x: 0, y: -1 };
  cmd.aim = { x: Math.cos(tick * 0.11), y: Math.sin(tick * 0.11) };
  cmd.fire = tick % 3 === 0;
  cmd.dodge = tick % 55 === 0;
  cmd.ability = tick % 130 === 0;
  cmd.interact = tick % 70 === 0;
  return cmd;
};

describe('determinismo da simulacao', () => {
  it('mesma seed e mesmos comandos produzem o mesmo hash a cada checkpoint', () => {
    const a = createRun({ seed: 20260724 });
    const b = createRun({ seed: 20260724 });
    expect(hashAuthoritativeState(a)).toBe(hashAuthoritativeState(b));

    for (let t = 0; t < 400; t++) {
      stepRun(a, [scriptedCommand(t)]);
      stepRun(b, [scriptedCommand(t)]);
      if (t % 50 === 0) {
        expect(hashAuthoritativeState(a), `divergencia no tick ${t}`).toBe(hashAuthoritativeState(b));
      }
    }
    expect(hashAuthoritativeState(a)).toBe(hashAuthoritativeState(b));
  });

  it('seeds diferentes produzem estados diferentes', () => {
    const a = createRun({ seed: 1 });
    const b = createRun({ seed: 2 });
    expect(hashAuthoritativeState(a)).not.toBe(hashAuthoritativeState(b));
  });

  it('a simulacao avanca por ticks inteiros, independente de FPS de render', () => {
    // duas execucoes com "frame pacing" diferentes chamam stepRun o mesmo numero de vezes
    const a = createRun({ seed: 99 });
    const b = createRun({ seed: 99 });
    for (let t = 0; t < 120; t++) stepRun(a, [scriptedCommand(t)]);
    // b: processa em lotes irregulares (como um cliente com FPS oscilando faria)
    let done = 0;
    const batches = [7, 1, 30, 2, 40, 25, 15];
    for (const batch of batches) {
      for (let k = 0; k < batch; k++) {
        stepRun(b, [scriptedCommand(done)]);
        done++;
      }
    }
    expect(done).toBe(120);
    expect(hashAuthoritativeState(a)).toBe(hashAuthoritativeState(b));
  });
});
