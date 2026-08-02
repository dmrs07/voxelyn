import { describe, expect, it } from 'vitest';
import { SurvivalServer } from '@voxelyn/survival-server';
import { CURRENT_VERSIONS } from '@voxelyn/survival-protocol';
import {
  breakSolid,
  CART_WINDUP_TICKS,
  createRun,
  emptyCommand,
  lineageOf,
  type PlayerCommand,
  type RailTrack,
} from '@voxelyn/survival-sim';
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

  it('o HUD do viewer reflete heat, Celulas de Purga e modulos', () => {
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
    expect(view.playerExtras[0].purgeCells).toBe(1);
  });

  it('espelha o stun autoritativo de players e inimigos no cliente online', () => {
    const loop = new Loop();
    const a = loop.connect('A');
    a.connect();
    loop.advance(3);
    const room = loop.server.roomForClient('A')!;
    const enemy = room.state.enemies.find((candidate) => candidate.alive)!;
    room.state.players[0].stunnedUntil = room.state.tick + 24;
    enemy.stunnedUntil = room.state.tick + 18;
    // Mais que um tick porque o render corre atrasado de proposito (ver
    // INTERP_DELAY_TICKS): o quadro desenhado e o de dois ticks atras, e uma
    // mudanca so aparece nele quando a linha de render alcanca o tick dela.
    loop.advance(1 + 3);
    const view = a.sampleRenderState(loop['now'] as number)!;
    expect(view.players[0].stunnedUntil).toBe(room.state.players[0].stunnedUntil);
    expect(view.enemies.find((candidate) => candidate.id === enemy.id)?.stunnedUntil).toBe(enemy.stunnedUntil);
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

  it('resume token invalido limpa o token e dispara onReject (sessao nova)', () => {
    const loop = new Loop();
    const c = loop.connect('A');
    let rejected = false;
    c.onReject = () => {
      rejected = true;
    };
    // finge que ja tinha um token de uma sessao anterior (servidor nao o conhece)
    (c as unknown as { resumeToken: string }).resumeToken = 'token-fantasma';
    c.connect('token-fantasma');
    expect(rejected).toBe(true);
    expect(c.resumeToken).toBeNull(); // limpo -> proximo handshake e sessao nova
    expect(c.status).toBe('offline');
  });

  it('o view expoe os DOIS players para o renderer (parceiro visivel)', () => {
    const loop = new Loop();
    const a = loop.connect('A');
    const b = loop.connect('B');
    a.connect();
    b.connect();
    loop.advance(5);
    const view = a.sampleRenderState(loop['now'] as number)!;
    const alivePlayers = view.players.filter((p) => p.alive);
    expect(alivePlayers.length).toBe(2); // o renderer itera view.players
  });

  it('sem parceiro, o view NAO expoe um player fantasma', () => {
    const loop = new Loop();
    const a = loop.connect('A');
    a.connect();
    loop.advance(5);
    const view = a.sampleRenderState(loop['now'] as number)!;
    // o slot 1 existe no state local, mas nao veio no snapshot -> nao-joined
    expect(view.playerExtras[0].joined).toBe(true);
    expect(view.playerExtras[1].joined).toBe(false);
  });

  it('cofre aberto no servidor deixa de ser desenhado no cliente', () => {
    const loop = new Loop();
    const a = loop.connect('A');
    a.connect();
    loop.advance(3);

    const room = loop.server.roomForClient('A')!;
    expect(a.sampleRenderState(loop['now'] as number)!.salvageSites[0].cacheOpened).toBe(false);

    room.state.salvageSites[0].terminalState = 'complete';
    room.state.salvageSites[0].cacheRevealed = true;
    room.state.salvageSites[0].cacheOpened = true;
    room.state.coreTaken = true;
    loop.advance(3);

    const view = a.sampleRenderState(loop['now'] as number)!;
    expect(view.salvageSites[0].cacheOpened).toBe(true); // antes: crate desenhada para sempre
    expect(view.coreTaken).toBe(true);
  });

  it('mapHash divergente no welcome dispara resync (mundo local descartado)', () => {
    const loop = new Loop();
    const a = loop.connect('A');
    let diverged = '';
    a.onDiverged = (reason) => {
      diverged = reason;
    };
    // servidor anuncia um mundo estatico diferente do que o cliente gerou
    a.receive(
      JSON.stringify({
        t: 'welcome',
        versions: CURRENT_VERSIONS,
        playerId: 1,
        resumeToken: 'tok',
        seed: 99,
        worldWidth: 96,
        worldHeight: 96,
        mapHash: 'deadbeef',
      }),
      0
    );
    expect(diverged).toContain('mapHash'); // antes: seguia renderizando terreno errado
  });

  it('mapHash igual no welcome NAO dispara resync', () => {
    const loop = new Loop();
    const a = loop.connect('A');
    let diverged = '';
    a.onDiverged = (reason) => {
      diverged = reason;
    };
    a.connect();
    loop.advance(3);
    expect(diverged).toBe(''); // caminho normal: geracao local confere
    expect(a.status).toBe('online');
  });

  it('diff de chunk incoerente dispara resync em vez de terreno errado', () => {
    const loop = new Loop();
    const a = loop.connect('A');
    let diverged = '';
    a.onDiverged = (reason) => {
      diverged = reason;
    };
    a.connect();
    loop.advance(3);

    // snapshot com chunk fora da grade deste mundo (36 chunks em 96x96)
    a.receive(
      JSON.stringify({
        t: 'snapshot',
        serverTick: 99,
        ackSeq: 0,
        phase: 'running',
        entities: [],
        projectiles: [],
        removedEntities: [],
        chunkDiffs: [{ c: 9999, v: 1, cells: [{ i: 0, solid: 1, surface: 0 }] }],
        events: [],
        contamination: 0,
      }),
      0
    );
    expect(diverged).toContain('incoerente');
  });

  it('reconexao aplica o full_resync (mundo alterado nao volta ao estado gerado)', () => {
    const loop = new Loop();
    const a = loop.connect('A');
    a.connect();
    loop.advance(3);

    // Destroi terreno e deixa o ChunkTracker ABSORVER esse diff. A partir daqui
    // a mudanca so chega a um cliente novo pelo full_resync: os snapshots
    // seguintes nao a reenviam (a baseline do tracker ja a inclui).
    const room = loop.server.roomForClient('A')!;
    const w = room.state.config.width;
    let broken = -1;
    for (let y = 20; y < 60 && broken < 0; y++) {
      for (let x = 20; x < 60; x++) {
        const i = y * w + x;
        if (room.state.solid[i] !== 0) {
          breakSolid(room.state, x, y, []);
          if (room.state.solid[i] === 0) broken = i;
          break;
        }
      }
    }
    expect(broken).toBeGreaterThan(0);
    loop.advance(3); // tracker consome o diff

    const token = a.resumeToken;
    loop.server.removeConnection('A');
    const a2 = loop.connect('A2');
    a2.connect(token ?? undefined);
    loop.advance(2);

    // o resync tem ~290 KB: sob o limite de comando ele era descartado em
    // silencio e o cliente ficava com a parede que a geracao local criou
    const view = a2.sampleRenderState(loop['now'] as number)!;
    expect(view.solid[broken]).toBe(room.state.solid[broken]);
  });

  it('bordas sobrevivem ao throttle: um uso entre envios nao e perdido', () => {
    const loop = new Loop();
    const a = loop.connect('A');
    a.connect();
    loop.advance(3);

    const room = loop.server.roomForClient('A')!;
    room.state.playerExtras[0].purgeCells = 5;
    room.state.players[0].hp = 10;
    const before = room.state.playerExtras[0].purgeCells;

    const idle = (): PlayerCommand => {
      const c = emptyCommand();
      c.aim = { x: 1, y: 0 };
      return c;
    };

    // normaliza a janela do throttle (~25 Hz): ultimo envio em T
    const T = 10_000;
    a.setCommand(idle());
    a.pump(T);

    // frame com a borda cai DENTRO da janela: pump nao transmite
    const withPurge = idle();
    withPurge.purge = true;
    a.setCommand(withPurge);
    a.pump(T + 10);

    // frame seguinte sem borda; antes ele sobrescrevia o comando e o uso sumia
    a.setCommand(idle());
    a.pump(T + 100); // agora sim transmite
    loop.tick();
    loop.tick();

    expect(room.state.playerExtras[0].purgeCells).toBe(before - 1);
  });

  it('resetSession descarta token e estado: o proximo hello entra em sala nova', () => {
    const loop = new Loop();
    const a = loop.connect('A');
    a.connect();
    loop.advance(5);
    const firstRoom = loop.server.roomForClient('A')!;
    expect(a.resumeToken).toBeTruthy();

    // fim de run online: o jogador pede outra descida
    firstRoom.state.phase = 'dead';
    a.resetSession();
    expect(a.resumeToken).toBeNull(); // senao o hello reentraria na sala morta
    expect(a.sampleRenderState(loop['now'] as number)).toBeNull();

    // reconecta como sessao nova (server ve outra conexao, sem token)
    loop.server.removeConnection('A');
    const a2 = loop.connect('A2');
    a2.connect();
    loop.advance(5);
    const secondRoom = loop.server.roomForClient('A2')!;
    expect(a2.status).toBe('online');
    expect(secondRoom.id).not.toBe(firstRoom.id); // sala terminal nao e reusada
    expect(secondRoom.state.phase).toBe('running');
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

describe('telegrafo do carrinho em co-op', () => {
  // Os relogios dos trilhos NAO viajam nos WorldFlags: o espelho local nasce
  // com firingAt = 0 e ficaria assim para sempre — o carrinho chegaria pelo
  // snapshot de projeteis SEM aviso. O cliente rearma o relogio do espelho a
  // partir do evento `cart_warning`, que ja cruza o fio com a geometria.
  it('cart_warning rearma o firingAt do tramo espelhado', () => {
    const seedIndustrial = (() => {
      for (let s = 1; s < 4096; s++) if (lineageOf(s) === 'industrial') return s;
      throw new Error('nenhuma seed industrial');
    })();
    // Referencia local do mundo que o cliente vai gerar da mesma seed.
    const reference = createRun({ seed: seedIndustrial, sector: 2, playerCount: 2 });
    expect(reference.railTracks.length).toBeGreaterThan(0);

    const client = new NetClient(() => {});
    client.receive(JSON.stringify({
      t: 'welcome',
      versions: CURRENT_VERSIONS,
      playerId: 1,
      resumeToken: 'tk',
      roomCode: 'SALA',
      seed: seedIndustrial,
      sector: 2,
      worldWidth: reference.config.width,
      worldHeight: reference.config.height,
      mapHash: '', // vazio: pula a validacao de mapa neste teste de unidade
    }));

    const mirror = (client as unknown as { state: { railTracks: RailTrack[] } }).state;
    const track = mirror.railTracks[0];
    expect(track.firingAt).toBe(0);

    client.receive(JSON.stringify({
      t: 'snapshot',
      serverTick: 400,
      ackSeq: 0,
      phase: 'running',
      entities: [],
      projectiles: [],
      removedEntities: [],
      chunkDiffs: [],
      contamination: 0,
      events: [{
        t: 'cart_warning',
        x: track.x, y: track.y, dx: track.dx, dy: track.dy, len: track.len,
      }],
    }));

    // O aviso do espelho e TICK-based, como no solo: o renderer le
    // state.railTracks e compara com o tick da linha de render.
    expect(track.firingAt).toBe(400 + CART_WINDUP_TICKS);
  });
});
