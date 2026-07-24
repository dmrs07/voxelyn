import { describe, expect, it } from 'vitest';
import { SurvivalServer } from '@voxelyn/survival-server';
import { emptyCommand } from '@voxelyn/survival-sim';
import { NetClient } from '../client/net';

/**
 * Integracao ponta a ponta em memoria: NetClient <-> SurvivalServer, sem socket.
 * Prova que o cliente de rede reconstroi o mundo autoritativo e completa uma run.
 */
class Loop {
  readonly server = new SurvivalServer({ maxPlayersPerRoom: 2, baseSeed: 5150 });
  readonly clients = new Map<string, NetClient>();
  private now = 0;

  connect(id: string): NetClient {
    this.server.addConnection(id, this.now);
    const client = new NetClient((raw) => {
      for (const o of this.server.handleMessage(id, raw, this.now)) {
        this.clients.get(o.clientId)?.receive(JSON.stringify(o.msg), this.now);
      }
    });
    this.clients.set(id, client);
    return client;
  }
  tick(): void {
    this.now += 50;
    for (const o of this.server.tick()) {
      this.clients.get(o.clientId)?.receive(JSON.stringify(o.msg), this.now);
    }
  }
  advance(ticks: number, drive?: (t: number) => void): void {
    for (let t = 0; t < ticks; t++) {
      drive?.(t);
      for (const c of this.clients.values()) c.pump(this.now);
      this.tick();
    }
  }
}

describe('NetClient <-> SurvivalServer (in-process)', () => {
  it('handshake reconstroi o estado renderavel com os dois players', () => {
    const loop = new Loop();
    const a = loop.connect('A');
    const b = loop.connect('B');
    a.connect();
    b.connect();
    loop.advance(5);

    expect(a.status).toBe('online');
    expect(b.status).toBe('online');
    const view = a.sampleRenderState(1000);
    expect(view).not.toBeNull();
    expect(view!.players.length).toBe(2);

    // os aliases de render (camera/HUD) seguem o slot LOCAL de cada cliente
    expect(a.slot).toBe(0);
    expect(b.slot).toBe(1);
    const va = a.sampleRenderState(1000)!;
    const vb = b.sampleRenderState(1000)!;
    expect(va.player).toBe(va.players[0]);
    expect(vb.player).toBe(vb.players[1]);
    expect(vb.playerExtra).toBe(vb.playerExtras[1]);
  });

  it('o espelho do cliente segue o mundo destrutivel do servidor', () => {
    const loop = new Loop();
    const a = loop.connect('A');
    a.connect();
    loop.advance(2);

    // A atira e se move, destruindo cenario
    loop.advance(120, () => {
      const cmd = emptyCommand();
      cmd.move = { x: 1, y: 0.3 };
      cmd.aim = { x: 1, y: 0.2 };
      cmd.fire = true;
      a.setCommand(cmd);
    });

    const room = loop.server.roomForClient('A')!;
    const view = a.sampleRenderState(loop['now'] as number)!;
    for (let i = 0; i < room.state.solid.length; i++) {
      expect(view.solid[i]).toBe(room.state.solid[i]);
      expect(view.surface[i]).toBe(room.state.surface[i]);
    }
  });

  it('o HUD do viewer reflete o estado autoritativo (heat/consumiveis)', () => {
    const loop = new Loop();
    const a = loop.connect('A');
    a.connect();
    loop.advance(2);
    loop.advance(30, () => {
      const cmd = emptyCommand();
      cmd.fire = true;
      cmd.aim = { x: 1, y: 0 };
      a.setCommand(cmd);
    });
    const view = a.sampleRenderState(loop['now'] as number)!;
    expect(view.playerExtras[0].heat).toBeGreaterThan(0); // disparos aqueceram
    expect(view.playerExtras[0].consumables).toBe(1);
  });

  it('reconnect por resume token restaura o cliente ao mesmo slot', () => {
    const loop = new Loop();
    const a = loop.connect('A');
    const b = loop.connect('B');
    a.connect();
    b.connect();
    loop.advance(10);
    const token = b.resumeToken;
    expect(token).toBeTruthy();

    // B "cai" e reconecta com nova conexao usando o token
    loop.server.removeConnection('B');
    const b2 = loop.connect('B2');
    b2.connect(token ?? undefined);
    loop.advance(5);

    expect(b2.status).toBe('online');
    expect(b2.slot).toBe(1); // mesmo slot
    const room = loop.server.roomForClient('B2')!;
    expect(room.slots[1].clientId).toBe('B2');
  });

  it('dois clientes completam a run: extracao coletiva chega no view', () => {
    const loop = new Loop();
    const a = loop.connect('A');
    const b = loop.connect('B');
    a.connect();
    b.connect();
    loop.advance(3);

    const room = loop.server.roomForClient('A')!;
    room.state.leftEntryZone = true;
    for (const p of room.state.players) {
      p.x = room.state.entry.x + 0.6;
      p.y = room.state.entry.y + 0.6;
    }
    loop.advance(3, () => {
      const cmd = emptyCommand();
      cmd.interact = true;
      a.setCommand(cmd);
      b.setCommand(cmd);
    });

    const view = a.sampleRenderState(loop['now'] as number)!;
    expect(['extracted', 'extracted_with_core']).toContain(view.phase);
  });
});
