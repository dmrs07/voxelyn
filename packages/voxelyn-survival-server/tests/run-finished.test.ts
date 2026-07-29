import { describe, expect, it } from 'vitest';
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
