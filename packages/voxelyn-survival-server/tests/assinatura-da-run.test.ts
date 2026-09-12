// Quem pode assinar o relatorio de uma run de co-op, e quando.
//
// A regra inteira e de AUTORIDADE, e e por isso que ela mora no servidor e tem
// teste proprio: `name_run` reescreve uma linha do ranking que JA ESTA GRAVADA.
// Todo caminho que este arquivo cobre e um caminho em que o nome de outra
// pessoa, ou de outra run, seria sobrescrito por quem nao tinha esse direito.
import { describe, expect, it } from 'vitest';
import { CURRENT_VERSIONS, type ServerMessage } from '@voxelyn/survival-protocol';
import { SurvivalServer } from '../src/server';
import type { GameRoom } from '../src/room';

type Named = { room: GameRoom; name: string };

/** Uma sala de dois, com os dois dentro. `a` pegou o slot 0. */
const salaDeDois = () => {
  const named: Named[] = [];
  const server = new SurvivalServer({
    maxPlayersPerRoom: 2,
    baseSeed: 4242,
    onRunNamed: (room, name) => named.push({ room, name }),
  });
  let now = 0;
  const send = (clientId: string, msg: unknown): ServerMessage[] => {
    now += 5;
    return server.handleMessage(clientId, JSON.stringify(msg), now).map((item) => item.msg);
  };
  for (const id of ['a', 'b']) {
    server.addConnection(id, now);
    send(id, { t: 'hello', versions: CURRENT_VERSIONS });
  }
  const room = server.roomForClient('a');
  expect(room).not.toBeNull();
  // Confirma a premissa do teste inteiro em vez de supo-la: `a` e o slot 0.
  expect(room!.slotForClient('a')?.slot).toBe(0);
  expect(room!.slotForClient('b')?.slot).toBe(1);
  return { server, room: room!, named, send };
};

/** Mata o time para a run terminar e a linha do ranking nascer. */
const terminar = (server: SurvivalServer, room: GameRoom): void => {
  for (const player of room.state.players) player.hp = 0;
  server.tick();
  expect(room.resultReported).toBe(true);
};

describe('assinatura da run de co-op', () => {
  it('o dono da sala assina, e o nome chega ao gancho', () => {
    const { server, room, named, send } = salaDeDois();
    terminar(server, room);

    expect(send('a', { t: 'name_run', name: 'Os Barrigudos' })).toEqual([]);
    expect(named).toEqual([{ room, name: 'Os Barrigudos' }]);
  });

  it('o PARCEIRO nao assina: uma linha, um nome, e nao o do dedo mais rapido', () => {
    const { server, room, named, send } = salaDeDois();
    terminar(server, room);

    send('b', { t: 'name_run', name: 'roubado' });
    expect(named).toEqual([]);

    // E o slot 1 ser recusado nao pode envenenar o slot 0 depois dele.
    send('a', { t: 'name_run', name: 'legitimo' });
    expect(named.map((n) => n.name)).toEqual(['legitimo']);
  });

  it('antes do fim da run nao ha o que assinar', () => {
    const { room, named, send } = salaDeDois();
    expect(room.resultReported).toBe(false);

    send('a', { t: 'name_run', name: 'cedo demais' });
    // Guardar este nome para carimbar a run quando ela terminasse seria deixar
    // o jogador assinar um relatorio em branco.
    expect(named).toEqual([]);
  });

  it('um socket sem slot na sala nao assina', () => {
    const { server, room, named, send } = salaDeDois();
    terminar(server, room);
    // Conectado ao processo, mas sem `hello`: nao entrou em sala nenhuma.
    server.addConnection('c', 999);

    send('c', { t: 'name_run', name: 'de fora' });
    expect(named).toEqual([]);
  });

  it('recusa em silencio, sem `reject` e sem derrubar a sessao', () => {
    const { server, room, send } = salaDeDois();
    terminar(server, room);

    // O parceiro tem o mesmo cliente e pode mandar por engano; a tela dele nao
    // tem nada a relatar sobre isso.
    const replies = send('b', { t: 'name_run', name: 'qualquer' });
    expect(replies).toEqual([]);
    // A sessao continua de pe: o ping seguinte responde normalmente.
    expect(send('b', { t: 'ping', seq: 1, clientTimeMs: 7 }).map((m) => m.t)).toEqual(['pong']);
  });

  it('UMA assinatura por run: a segunda nao chega ao livro', () => {
    const { server, room, named, send } = salaDeDois();
    terminar(server, room);

    send('a', { t: 'name_run', name: 'primeiro' });
    send('a', { t: 'name_run', name: 'pensei melhor' });
    // A interface nao permite reassinar — o painel fecha e nao reabre —, entao
    // quem manda a segunda nao e a interface. E `name_run` e a unica mensagem de
    // cliente do protocolo que provoca escrita no banco: sem a trava, o slot 0
    // sustentaria uma escrita por mensagem no teto do limitador.
    expect(named.map((n) => n.name)).toEqual(['primeiro']);
    expect(room.runNamed).toBe(true);
  });

  it('a trava e por SALA: a recusa ao parceiro nao queima a assinatura do dono', () => {
    const { server, room, named, send } = salaDeDois();
    terminar(server, room);

    // O parceiro tenta primeiro e e recusado por nao ser o slot 0. Se a trava
    // fosse ligada antes da checagem de autoridade, ele gastaria a unica
    // assinatura da sala e o dono ficaria sem nenhuma.
    send('b', { t: 'name_run', name: 'roubado' });
    expect(room.runNamed).toBe(false);

    send('a', { t: 'name_run', name: 'legitimo' });
    expect(named.map((n) => n.name)).toEqual(['legitimo']);
  });
});
