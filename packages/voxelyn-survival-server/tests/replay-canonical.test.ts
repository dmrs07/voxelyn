import { describe, expect, it } from 'vitest';
import { createRun, emptyCommand, stepRun, type PlayerCommand } from '@voxelyn/survival-sim';
import { encodeCommandLog, quantizeCommand, toBase64 } from '@voxelyn/survival-protocol';
import { verifySoloRun } from '../src/replay';

const completedRun = (seed: number): PlayerCommand[] => {
  const state = createRun({ seed, playerCount: 1 });
  const commands: PlayerCommand[] = [];
  for (let t = 0; t < 4000 && state.phase === 'running'; t++) {
    const command = quantizeCommand({
      ...emptyCommand(),
      move: { x: Math.sin(t / 40), y: Math.cos(t / 37) },
      aim: { x: Math.cos(t / 13), y: Math.sin(t / 11) },
      fire: t % 4 === 0,
      interact: t % 11 === 0,
    });
    commands.push(command);
    stepRun(state, [command]);
  }
  expect(state.phase).not.toBe('running');
  return commands;
};

describe('digest canonico do replay', () => {
  it('deduplica cauda pos-terminal e representacao Base64 equivalente', () => {
    const seed = 4242;
    const commands = completedRun(seed);
    const exactBase64 = toBase64(encodeCommandLog(commands));
    const paddedBase64 = toBase64(encodeCommandLog([...commands, emptyCommand(), emptyCommand()]));
    const withoutPadding = exactBase64.replace(/=+$/, '');

    const exact = verifySoloRun(seed, exactBase64);
    const padded = verifySoloRun(seed, paddedBase64);
    const alternateBase64 = verifySoloRun(seed, withoutPadding);
    expect(exact.ok).toBe(true);
    expect(padded.ok).toBe(true);
    expect(alternateBase64.ok).toBe(true);
    if (!exact.ok || !padded.ok || !alternateBase64.ok) return;

    expect(padded.summary).toEqual(exact.summary);
    expect(padded.ticks).toBe(exact.ticks);
    expect(padded.digest).toBe(exact.digest);
    expect(alternateBase64.digest).toBe(exact.digest);
  });
});
