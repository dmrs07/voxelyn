import { describe, expect, it } from 'vitest';
import { CURRENT_VERSIONS, isValidRoomCode, type ServerMessage } from '@voxelyn/survival-protocol';
import { DEFAULT_SECTOR_COUNT, emptyCommand } from '@voxelyn/survival-sim';
import { SurvivalServer } from '../src/server';

class Harness {
  readonly server = new SurvivalServer({ maxPlayersPerRoom: 2, baseSeed: 987654 });
  readonly inbox = new Map<string, ServerMessage[]>();
  private now = 0;

  connect(clientId: string): void {
    this.inbox.set(clientId, []);
    this.server.addConnection(clientId, this.now);
  }
  send(clientId: string, msg: unknown): void {
    this.now += 5;
    for (const r of this.server.handleMessage(clientId, JSON.stringify(msg), this.now)) {
      this.inbox.get(r.clientId)?.push(r.msg);
    }
  }
  tick(n = 1): void {
    for (let i = 0; i < n; i++) {
      for (const o of this.server.tick()) this.inbox.get(o.clientId)?.push(o.msg);
    }
  }
  drain(clientId: string): ServerMessage[] {
    const box = this.inbox.get(clientId) ?? [];
    this.inbox.set(clientId, []);
    return box;
  }
  hello(clientId: string, roomCode?: string): void {
    this.connect(clientId);
    this.send(clientId, { t: 'hello', versions: CURRENT_VERSIONS, roomCode });
  }
  welcomeOf(clientId: string): Extract<ServerMessage, { t: 'welcome' }> | undefined {
    return this.drain(clientId).find((m) => m.t === 'welcome') as
      | Extract<ServerMessage, { t: 'welcome' }>
      | undefined;
  }
  rejectOf(clientId: string): Extract<ServerMessage, { t: 'reject' }> | undefined {
    return this.drain(clientId).find((m) => m.t === 'reject') as
      | Extract<ServerMessage, { t: 'reject' }>
      | undefined;
  }
}

describe('codigo de sala', () => {
  it('toda sala nasce com um codigo valido e o entrega no welcome', () => {
    const h = new Harness();
    h.hello('a');
    const welcome = h.welcomeOf('a');
    expect(welcome).toBeDefined();
    expect(isValidRoomCode(welcome!.roomCode)).toBe(true);
  });

  // A razao de o sistema existir: sem isto, "co-op" significa "caia com quem
  // estiver online", e duas pessoas que combinaram jogar juntas nao tem como.
  it('duas pessoas com o mesmo codigo caem na MESMA sala', () => {
    const h = new Harness();
    h.hello('a', 'BCDF');
    h.hello('b', 'BCDF');
    const wa = h.welcomeOf('a');
    const wb = h.welcomeOf('b');
    expect(wa?.roomCode).toBe('BCDF');
    expect(wb?.roomCode).toBe('BCDF');
    expect(wa?.seed).toBe(wb?.seed);
    expect(wa?.playerId).not.toBe(wb?.playerId);
  });

  it('codigos diferentes separam as salas', () => {
    const h = new Harness();
    h.hello('a', 'BCDF');
    h.hello('b', 'GHJK');
    expect(h.welcomeOf('a')?.seed).not.toBe(h.welcomeOf('b')?.seed);
  });

  // Criar sob demanda e o que faz o convite funcionar nos dois sentidos: quem
  // combinou o codigo pode entrar primeiro, sem "dono" que precise chegar antes.
  it('quem chega primeiro com um codigo novo cria a sala', () => {
    const h = new Harness();
    h.hello('a', 'MNPQ');
    expect(h.welcomeOf('a')?.roomCode).toBe('MNPQ');
  });

  it('aceita o codigo como o jogador digita', () => {
    const h = new Harness();
    h.hello('a', 'bc-df');
    expect(h.welcomeOf('a')?.roomCode).toBe('BCDF');
  });

  it('recusa codigo malformado em vez de sortear outra sala', () => {
    const h = new Harness();
    h.hello('a', 'BCD0');
    expect(h.rejectOf('a')?.reason).toContain('invalido');
  });

  // Uma sala cheia NAO vira sala nova com o mesmo codigo: isso separaria em
  // silencio duas pessoas que digitaram o mesmo codigo para se encontrar.
  it('recusa entrada em sala cheia sem inventar outra', () => {
    const h = new Harness();
    h.hello('a', 'BCDF');
    h.hello('b', 'BCDF');
    h.hello('c', 'BCDF');
    expect(h.rejectOf('c')?.reason).toContain('cheia');
  });

  it('matchmaking aberto continua funcionando sem codigo', () => {
    const h = new Harness();
    h.hello('a');
    h.tick();
    h.hello('b');
    const wa = h.welcomeOf('a');
    const wb = h.welcomeOf('b');
    expect(wa?.seed).toBe(wb?.seed); // pareados na mesma sala
  });
});

describe('setor no protocolo', () => {
  it('o welcome informa o setor da sala', () => {
    const h = new Harness();
    h.hello('a');
    expect(h.welcomeOf('a')?.sector).toBe(1);
  });

  /**
   * O caso que o campo `sector` existe para evitar: quem entra atrasado numa
   * sala ja no setor 2 geraria localmente o mapa do SETOR 1 e receberia diffs
   * de chunk que nao casam com nada.
   */
  it('quem entra atrasado recebe o setor corrente, e nao o primeiro', () => {
    const h = new Harness();
    h.hello('a', 'BCDF');
    h.drain('a');

    // Leva a sala ao setor 2 pelo caminho autoritativo.
    const room = h.server.roomForCode('BCDF');
    expect(room).toBeDefined();
    for (const p of room!.state.players) {
      p.x = room!.state.corePos.x + 0.5;
      p.y = room!.state.corePos.y + 0.5;
    }
    h.send('a', {
      t: 'cmd',
      seq: 1,
      clientTick: 1,
      commands: [{ ...emptyCommand(), interact: true }],
    });
    h.tick(2);
    expect(room!.state.sector).toBe(2);

    h.hello('b', 'BCDF');
    expect(h.welcomeOf('b')?.sector).toBe(2);
  });

  it('o full_resync carrega o setor que descreve', () => {
    const h = new Harness();
    h.hello('a');
    const resync = h.drain('a').find((m) => m.t === 'full_resync');
    expect(resync).toBeDefined();
    expect((resync as Extract<ServerMessage, { t: 'full_resync' }>).sector).toBe(1);
  });
});

describe('descida no servidor', () => {
  // Descer nao e uma mudanca incremental: exprimi-la como diff custaria mais
  // bytes que o mundo inteiro, e um cliente que perdesse um diff ficaria com
  // os dois mapas costurados.
  it('a troca de setor forca resync completo em todos os slots', () => {
    const h = new Harness();
    h.hello('a', 'BCDF');
    h.hello('b', 'BCDF');
    h.tick(3);
    h.drain('a');
    h.drain('b');

    const room = h.server.roomForCode('BCDF')!;
    for (const p of room.state.players) {
      p.x = room.state.corePos.x + 0.5;
      p.y = room.state.corePos.y + 0.5;
    }
    const interact = { ...emptyCommand(), interact: true };
    h.send('a', { t: 'cmd', seq: 9, clientTick: 9, commands: [interact] });
    h.send('b', { t: 'cmd', seq: 9, clientTick: 9, commands: [interact] });
    h.tick(2);

    expect(room.state.sector).toBe(2);
    for (const id of ['a', 'b']) {
      const msgs = h.drain(id);
      expect(
        msgs.some((m) => m.t === 'full_resync'),
        `${id} sem resync`,
      ).toBe(true);
    }
  });

  it('o mapHash acompanha o mundo novo', () => {
    const h = new Harness();
    h.hello('a', 'BCDF');
    const room = h.server.roomForCode('BCDF')!;
    const before = room.mapHash;

    for (const p of room.state.players) {
      p.x = room.state.corePos.x + 0.5;
      p.y = room.state.corePos.y + 0.5;
    }
    h.send('a', {
      t: 'cmd',
      seq: 1,
      clientTick: 1,
      commands: [{ ...emptyCommand(), interact: true }],
    });
    h.tick(2);

    expect(room.state.sector).toBe(2);
    // Com o hash do setor anterior, todo cliente que entrasse depois da descida
    // seria acusado de divergencia estando certo.
    expect(room.mapHash).not.toBe(before);
  });

  it('a sala so termina a run no setor final', () => {
    const h = new Harness();
    h.hello('a', 'BCDF');
    const room = h.server.roomForCode('BCDF')!;
    for (let i = 0; i < DEFAULT_SECTOR_COUNT + 2; i++) {
      for (const p of room.state.players) {
        p.x = room.state.corePos.x + 0.5;
        p.y = room.state.corePos.y + 0.5;
      }
      h.send('a', {
        t: 'cmd',
        seq: 10 + i,
        clientTick: i,
        commands: [{ ...emptyCommand(), interact: true }],
      });
      h.tick(2);
    }
    // A sala PARA no ultimo setor: interagir de novo no ponto especial nao
    // desce nem termina. Ela nao chega a recolher o Nucleo — o pedestal do
    // setor final comeca selado pelo dono dele —, e e justamente por isso que a
    // run continua correndo.
    expect(room.state.sector).toBe(room.state.config.depth.sectorCount);
    expect(room.state.phase).toBe('running');
  });
});
