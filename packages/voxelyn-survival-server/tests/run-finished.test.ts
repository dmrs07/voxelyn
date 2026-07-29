import { describe, expect, it } from 'vitest';
import { CURRENT_VERSIONS, type ServerMessage } from '@voxelyn/survival-protocol';
import { SurvivalServer } from '../src/server';
import type { GameRoom } from '../src/room';

describe('resultado terminal da sala', () => {
  it('reporta no mesmo tick do snapshot final e apenas uma vez', () => {
    const finished: GameRoom[] = [];
    const server = new SurvivalServer({
      maxPlayersPerRoom: 1,
      baseSeed: 123,
      onRunFinished: (room) => finished.push(room),
    });
    server.addConnection('a', 0);
    server.handleMessage('a', JSON.stringify({ t: 'hello', versions: CURRENT_VERSIONS }), 0);
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

    // O ultimo cliente fecha imediatamente depois de receber o snapshot terminal.
    server.removeConnection('a');
    expect(server.roomCount()).toBe(0);
    server.tick();
    expect(finished).toHaveLength(1);
  });
});
