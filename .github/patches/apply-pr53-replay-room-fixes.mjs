import { readFileSync, writeFileSync } from 'node:fs';

const replaceExact = (path, before, after, expected = 1) => {
  const source = readFileSync(path, 'utf8');
  const matches = source.split(before).length - 1;
  if (matches !== expected) throw new Error(`${path}: expected ${expected} occurrence(s), found ${matches}`);
  writeFileSync(path, source.replace(before, after), 'utf8');
};

replaceExact(
  'packages/voxelyn-survival-server/src/leaderboard-http.ts',
  `import { MAX_REPLAY_BYTES, replayDigest, sanitizeName, verifySoloRun } from './replay.js';`,
  `import { MAX_REPLAY_BYTES, sanitizeName, verifySoloRun } from './replay.js';`,
);
replaceExact(
  'packages/voxelyn-survival-server/src/leaderboard-http.ts',
  `      const digest = replayDigest(seed, log);`,
  `      const digest = verdict.digest;`,
);

replaceExact(
  'packages/voxelyn-survival-server/src/server.ts',
  `const ABANDON_GRACE_TICKS = 20 * 90;`,
  `export const ABANDON_GRACE_TICKS = 20 * 90;`,
);
replaceExact(
  'packages/voxelyn-survival-server/src/server.ts',
  `      this.log({ ev: 'disconnect', clientId, room: conn.room.id });
      this.reapRoom(conn.room);`,
  `      this.log({ ev: 'disconnect', clientId, room: conn.room.id });
      // Inclusive salas terminais ficam disponiveis para resume token durante o
      // grace. O snapshot final pode ter se perdido antes deste close.` ,
);
replaceExact(
  'packages/voxelyn-survival-server/src/server.ts',
  `
  private reapRoom(room: GameRoom): void {
    // sala sem clientes e ja finalizada -> descarta na hora; salas 'running'
    // abandonadas expiram pela varredura periodica (sweepRooms).
    if (room.connectedCount() === 0 && room.state.phase !== 'running') {
      this.dropRoom(room, 'finished_and_empty');
    }
  }
`,
  ``,
);

writeFileSync(
  'packages/voxelyn-survival-server/tests/run-finished.test.ts',
  `import { describe, expect, it } from 'vitest';
import { CURRENT_VERSIONS, type ServerMessage } from '@voxelyn/survival-protocol';
import { ABANDON_GRACE_TICKS, SurvivalServer } from '../src/server';
import type { GameRoom } from '../src/room';

describe('resultado terminal da sala', () => {
  it('reporta no tick final, permite reconnect e expira uma unica vez depois do grace', () => {
    const finished: GameRoom[] = [];
    const server = new SurvivalServer({
      maxPlayersPerRoom: 1,
      baseSeed: 123,
      onRunFinished: (room) => finished.push(room),
    });
    server.addConnection('a', 0);
    const initial = server.handleMessage(
      'a',
      JSON.stringify({ t: 'hello', versions: CURRENT_VERSIONS }),
      0,
    );
    const welcome = initial
      .map((item) => item.msg)
      .find((msg): msg is Extract<ServerMessage, { t: 'welcome' }> => msg.t === 'welcome');
    expect(welcome).toBeDefined();
    const room = server.roomForClient('a');
    expect(room).not.toBeNull();

    // A morte e o summary nascem dentro de room.step(), neste server.tick().
    room!.state.players[0].hp = 0;
    const outbound = server.tick();

    expect(room!.state.phase).toBe('dead');
    expect(room!.state.summary).not.toBeNull();
    expect(finished).toEqual([room]);
    expect(room!.resultReported).toBe(true);
    const finalSnapshot = outbound
      .map((item) => item.msg)
      .find((msg): msg is Extract<ServerMessage, { t: 'snapshot' }> => msg.t === 'snapshot');
    expect(finalSnapshot?.phase).toBe('dead');

    // Simula perda do snapshot terminal: fecha e reconecta pelo token.
    server.removeConnection('a');
    expect(server.roomCount()).toBe(1);
    server.addConnection('b', 1);
    const reconnect = server.handleMessage(
      'b',
      JSON.stringify({ t: 'hello', versions: CURRENT_VERSIONS, resumeToken: welcome!.resumeToken }),
      1,
    );
    expect(reconnect.some((item) => item.msg.t === 'welcome')).toBe(true);
    expect(reconnect.some((item) => item.msg.t === 'full_resync')).toBe(true);

    // O snapshot seguinte repete o summary terminal para reconstruir a tela final.
    const repeated = server.tick()
      .map((item) => item.msg)
      .find((msg): msg is Extract<ServerMessage, { t: 'snapshot' }> => msg.t === 'snapshot');
    expect(repeated?.phase).toBe('dead');
    expect(repeated?.summary).toEqual(room!.state.summary);
    expect(finished).toHaveLength(1);

    server.removeConnection('b');
    expect(server.roomCount()).toBe(1);
    for (let i = 0; i <= ABANDON_GRACE_TICKS; i++) server.tick();
    expect(server.roomCount()).toBe(0);
    expect(finished).toHaveLength(1);
  });
});
`,
  'utf8',
);

writeFileSync(
  'packages/voxelyn-survival-server/tests/replay-canonical.test.ts',
  `import { describe, expect, it } from 'vitest';
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
`,
  'utf8',
);

console.log('canonical replay and terminal reconnect fixes applied');
