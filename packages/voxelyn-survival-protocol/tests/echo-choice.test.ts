import { describe, expect, it } from 'vitest';
import { createRun, emptyCommand, hashAuthoritativeState, stepRun } from '@voxelyn/survival-sim';
import { decodeCommandLog, encodeCommandLog, quantizeCommand } from '../src/command-log';
import { validatePlayerCommand } from '../src/validate';

describe('Echoes 2.0 commands', () => {
  it('preserves both cards and KEEP through validation, quantisation and RLE', () => {
    for (const choose of [null, 0, 1] as const) {
      const original = { ...emptyCommand(), choose, choiceKind: 'echo' as const };
      const validated = validatePlayerCommand(original);
      expect(validated.ok).toBe(true);
      if (!validated.ok) throw new Error('valid echo command rejected');
      const encoded = encodeCommandLog([quantizeCommand(validated.value)]);
      expect(decodeCommandLog(encoded, 1)).toEqual([original]);
    }
  });
  it('does not confuse module choices with echo choices or malformed indices with KEEP', () => {
    const commands = [
      { ...emptyCommand(), choose: 0 as const },
      { ...emptyCommand(), choose: 0 as const, choiceKind: 'echo' as const },
    ];
    expect(decodeCommandLog(encodeCommandLog(commands), 2)).toEqual(commands);
    expect(validatePlayerCommand({ ...emptyCommand(), choose: 2, choiceKind: 'echo' }).ok).toBe(
      false,
    );
    expect(validatePlayerCommand({ ...emptyCommand(), choose: '0', choiceKind: 'echo' }).ok).toBe(
      false,
    );
  });
  it('replays a selected Echo to the same authoritative state', () => {
    const make = () => {
      const state = createRun({ seed: 551 });
      state.player.x = state.corePos.x + 0.5;
      state.player.y = state.corePos.y + 0.5;
      state.playerExtra.resonance.fire = 12;
      return state;
    };
    const commands = [
      emptyCommand(),
      { ...emptyCommand(), choose: 0 as const, choiceKind: 'echo' as const },
      { ...emptyCommand(), ability: true },
    ].map(quantizeCommand);
    const a = make(),
      b = make();
    for (const command of commands) stepRun(a, [command]);
    for (const command of decodeCommandLog(encodeCommandLog(commands), 3)!) stepRun(b, [command]);
    expect(a.playerExtra.ability).toBe('flamethrower');
    expect(hashAuthoritativeState(a)).toBe(hashAuthoritativeState(b));
  });
});
