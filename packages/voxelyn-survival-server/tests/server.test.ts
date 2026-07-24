import { describe, expect, it } from 'vitest';
import { CURRENT_VERSIONS, ClientWorldMirror, type ServerMessage } from '@voxelyn/survival-protocol';
import { createRun, type SurvivalState } from '@voxelyn/survival-sim';
import { SurvivalServer } from '../src/server';

// --- harness: roteia respostas e snapshots para caixas de entrada por cliente ---
class Harness {
  readonly server = new SurvivalServer({ maxPlayersPerRoom: 2, baseSeed: 20260724 });
  readonly inbox = new Map<string, ServerMessage[]>();
  private now = 0;

  connect(clientId: string): void {
    this.inbox.set(clientId, []);
    this.server.addConnection(clientId, this.now);
  }
  send(clientId: string, msg: unknown): void {
    this.now += 5;
    const replies = this.server.handleMessage(clientId, JSON.stringify(msg), this.now);
    for (const r of replies) this.inbox.get(r.clientId)?.push(r.msg);
  }
  tick(n = 1): void {
    for (let i = 0; i < n; i++) {
      for (const o of this.server.tick()) this.inbox.get(o.clientId)?.push(o.msg);
    }
  }
  disconnect(clientId: string): void {
    this.server.removeConnection(clientId);
  }
  drain(clientId: string): ServerMessage[] {
    const box = this.inbox.get(clientId) ?? [];
    this.inbox.set(clientId, []);
    return box;
  }
  hello(clientId: string, resumeToken?: string): void {
    this.send(clientId, { t: 'hello', versions: CURRENT_VERSIONS, resumeToken });
  }
  cmd(clientId: string, seq: number, command: Record<string, unknown>): void {
    this.send(clientId, { t: 'cmd', seq, clientTick: seq, commands: [command] });
  }
}

const move = (x: number, y: number) => ({ move: { x, y }, aim: { x: 1, y: 0 } });
const interact = () => ({ move: { x: 0, y: 0 }, aim: { x: 1, y: 0 }, interact: true });

describe('servidor autoritativo de co-op', () => {
  it('dois clientes entram na mesma sala em slots distintos', () => {
    const h = new Harness();
    h.connect('A');
    h.connect('B');
    h.hello('A');
    h.hello('B');

    const wa = h.drain('A').find((m) => m.t === 'welcome');
    const wb = h.drain('B').find((m) => m.t === 'welcome');
    expect(wa?.t).toBe('welcome');
    expect(wb?.t).toBe('welcome');
    if (wa?.t === 'welcome' && wb?.t === 'welcome') {
      expect(wa.seed).toBe(wb.seed); // mesma sala/seed
      expect(wa.playerId).not.toBe(wb.playerId);
    }
    expect(h.server.roomCount()).toBe(1);
  });

  it('handshake com versao incompativel e rejeitado', () => {
    const h = new Harness();
    h.connect('A');
    h.send('A', { t: 'hello', versions: { ...CURRENT_VERSIONS, protocolVersion: 999 } });
    const reject = h.drain('A').find((m) => m.t === 'reject');
    expect(reject?.t).toBe('reject');
  });

  it('cliente malicioso NAO concede vida nem itens (servidor ignora fatos)', () => {
    const h = new Harness();
    h.connect('A');
    h.hello('A');
    const room = h.server.roomForClient('A')!;
    room.state.players[0].hp = 40;

    // mensagem forjada afirmando hp/dano/itens/kills
    h.cmd('A', 1, { ...move(0, 0), hp: 9999, maxHp: 9999, damage: 9999, killed: [10, 11], consumables: 99, modifiers: ['siphon', 'explosive'] });
    h.tick(3);

    const p = room.state.players[0];
    expect(p.hp).toBeLessThanOrEqual(40); // nunca subiu para 9999
    expect(h.server.roomForClient('A')!.state.playerExtras[0].consumables).toBe(1);
    expect(h.server.roomForClient('A')!.state.playerExtras[0].modifiers).toEqual([]);
  });

  it('deduplicacao: comando com seq repetida e ignorado', () => {
    const h = new Harness();
    h.connect('A');
    h.hello('A');
    const room = h.server.roomForClient('A')!;
    h.cmd('A', 5, move(1, 0));
    const c1 = { ...room.slots[0].command };
    h.cmd('A', 5, move(-1, 0)); // mesma seq -> ignorada
    expect(room.slots[0].command.move).toEqual(c1.move);
  });

  it('cliente segue o mundo destrutivel por diffs de chunk (geracao local + incremental)', () => {
    const h = new Harness();
    h.connect('A');
    h.connect('B');
    h.hello('A');
    h.hello('B');
    h.drain('A');
    h.drain('B');

    const room = h.server.roomForClient('A')!;
    // cliente A gera o mundo estatico localmente pela mesma seed
    const local: SurvivalState = createRun({ seed: room.seed, playerCount: 2 });
    const mirror = new ClientWorldMirror(local.config.width, local.config.height, local.solid, local.surface);

    // ambos atiram e se movem, destruindo cenario
    for (let t = 0; t < 120; t++) {
      h.cmd('A', t + 1, { ...move(1, 0.3), fire: true, aim: { x: 1, y: 0.2 } });
      h.cmd('B', t + 1, { ...move(-0.5, 1), fire: true, aim: { x: -1, y: 0.4 } });
      h.tick(1);
      for (const m of h.drain('A')) if (m.t === 'snapshot') mirror.apply(m.chunkDiffs);
    }

    // o espelho do cliente bate com o mundo autoritativo
    for (let i = 0; i < room.state.solid.length; i++) {
      expect(mirror.solid[i]).toBe(room.state.solid[i]);
      expect(mirror.surface[i]).toBe(room.state.surface[i]);
    }
  });

  it('desconexao nao corrompe a run; reconnect por resume token reanexa o mesmo slot', () => {
    const h = new Harness();
    h.connect('A');
    h.connect('B');
    h.hello('A');
    h.hello('B');
    const welcomeB = h.drain('B').find((m) => m.t === 'welcome');
    const token = welcomeB?.t === 'welcome' ? welcomeB.resumeToken : '';
    h.drain('A');

    const room = h.server.roomForClient('A')!;
    h.tick(30);
    const phaseBefore = room.state.phase;

    // B cai
    h.disconnect('B');
    expect(room.slots[1].clientId).toBeNull();
    h.tick(30); // a run continua com A
    expect(room.state.phase).toBe(phaseBefore); // sim intacta

    // B reconecta com o resume token -> mesmo slot
    h.connect('B2');
    h.hello('B2', token);
    const reB = h.drain('B2');
    expect(reB.some((m) => m.t === 'welcome')).toBe(true);
    expect(reB.some((m) => m.t === 'full_resync')).toBe(true);
    expect(room.slots[1].clientId).toBe('B2');
  });

  it('resync reconstroi o mundo de um cliente divergente', () => {
    const h = new Harness();
    h.connect('A');
    h.hello('A');
    h.drain('A');
    const room = h.server.roomForClient('A')!;
    h.cmd('A', 1, { ...move(1, 0), fire: true });
    h.tick(40);
    h.drain('A');

    // cliente corrompido pede resync
    const mirror = new ClientWorldMirror(room.width, room.height);
    mirror.solid.fill(9);
    h.send('A', { t: 'resync', reason: 'divergencia detectada' });
    const full = h.drain('A').find((m) => m.t === 'full_resync');
    expect(full?.t).toBe('full_resync');
    if (full?.t === 'full_resync') {
      mirror.apply(full.chunkDiffs);
      for (let i = 0; i < room.state.solid.length; i++) expect(mirror.solid[i]).toBe(room.state.solid[i]);
    }
  });

  it('dois clientes completam a run: extracao coletiva via intents validados', () => {
    const h = new Harness();
    h.connect('A');
    h.connect('B');
    h.hello('A');
    h.hello('B');
    const room = h.server.roomForClient('A')!;

    // exploraram e voltaram para a saida (posicionamento e setup de teste;
    // a EXTRACAO em si acontece por intents validados dos clientes)
    room.state.leftEntryZone = true;
    for (const p of room.state.players) {
      p.x = room.state.entry.x + 0.6;
      p.y = room.state.entry.y + 0.6;
    }

    // ambos os clientes enviam a intencao de interagir na saida
    h.cmd('A', 1, interact());
    h.cmd('B', 1, interact());
    h.tick(2);

    expect(['extracted', 'extracted_with_core']).toContain(room.state.phase);
    // o snapshot final reflete a fase terminal para os dois
    const lastA = h.drain('A').filter((m) => m.t === 'snapshot').pop();
    expect(lastA?.t === 'snapshot' && ['extracted', 'extracted_with_core'].includes(lastA.phase)).toBe(true);
  });

  it('slot desconectado fica reservado ao token: um novo cliente NAO o herda', () => {
    const h = new Harness();
    h.connect('A');
    h.connect('B');
    h.hello('A');
    h.hello('B');
    const roomA = h.server.roomForClient('A')!;
    h.drain('A');
    h.drain('B');

    // B cai: o slot 1 fica vago mas token-reservado
    h.disconnect('B');
    expect(roomA.slots[1].clientId).toBeNull();

    // um visitante novo (sem token) NAO deve herdar o avatar de B; vai para outra sala
    h.connect('C');
    h.hello('C');
    const welcomeC = h.drain('C').find((m) => m.t === 'welcome');
    expect(welcomeC?.t).toBe('welcome');
    const roomC = h.server.roomForClient('C')!;
    expect(roomC.id).not.toBe(roomA.id); // sala diferente
    expect(roomA.slots[1].clientId).toBeNull(); // slot de B intacto, ainda reservado
    if (welcomeC?.t === 'welcome') {
      expect(welcomeC.resumeToken).not.toBe(roomA.slots[1].resumeToken); // token de B nao vazou
    }
  });

  it('um unico cliente conectado joga em modo SOLO (avatar do parceiro nao existe ainda)', () => {
    const h = new Harness();
    h.connect('A');
    h.hello('A');
    const room = h.server.roomForClient('A')!;

    // o slot 1 existe na sim mas nao foi reivindicado
    expect(room.state.playerExtras[0].joined).toBe(true);
    expect(room.state.playerExtras[1].joined).toBe(false);

    h.tick(3);
    // snapshots expoem apenas o player em jogo
    const snap = h.drain('A').filter((m) => m.t === 'snapshot').pop();
    expect(snap?.t === 'snapshot' && snap.entities.filter((e) => e.kind === 'player').length).toBe(1);

    // extracao com um unico jogador em jogo nao espera "todos na saida"
    room.state.leftEntryZone = true;
    room.state.players[0].x = room.state.entry.x + 0.6;
    room.state.players[0].y = room.state.entry.y + 0.6;
    h.cmd('A', 1, interact());
    h.tick(2);
    expect(['extracted', 'extracted_with_core']).toContain(room.state.phase);
  });

  it('parceiro que entra depois recebe avatar novo na entrada (nao um ja usado)', () => {
    const h = new Harness();
    h.connect('A');
    h.hello('A');
    const room = h.server.roomForClient('A')!;
    // A explora e se machuca por um tempo
    for (let t = 0; t < 40; t++) {
      h.cmd('A', t + 1, move(1, 0.5));
      h.tick(1);
    }
    room.state.players[1].hp = 5; // simula "dano" que teria vazado para o slot reservado

    h.connect('B');
    h.hello('B');
    const p2 = room.state.players[1];
    expect(room.state.playerExtras[1].joined).toBe(true);
    expect(p2.hp).toBe(p2.maxHp); // avatar reivindicado nasce integro
    expect(Math.hypot(p2.x - room.state.entry.x, p2.y - room.state.entry.y)).toBeLessThan(4);
  });

  it('sala sem clientes nao e pareada com um cliente novo', () => {
    const h = new Harness();
    h.connect('A');
    h.hello('A');
    const roomA = h.server.roomForClient('A')!;
    h.disconnect('A'); // sala fica reservada, sem clientes

    h.connect('B');
    h.hello('B');
    const roomB = h.server.roomForClient('B')!;
    expect(roomB.id).not.toBe(roomA.id); // nunca herda a run abandonada
  });

  it('salas abandonadas expiram apos a carencia', () => {
    const h = new Harness();
    h.connect('A');
    h.hello('A');
    expect(h.server.roomCount()).toBe(1);
    h.disconnect('A');
    h.tick(5);
    expect(h.server.roomCount()).toBe(1); // ainda na carencia (reconnect possivel)
    h.tick(20 * 90 + 5);
    expect(h.server.roomCount()).toBe(0); // expirada
  });

  it('reapStale expira conexoes ociosas e retorna os ids removidos', () => {
    const server = new SurvivalServer({ maxPlayersPerRoom: 2 });
    server.addConnection('X', 0);
    const dead = server.reapStale(60_000); // muito alem do heartbeatTimeoutMs
    expect(dead).toContain('X');
    expect(server.connectionCount()).toBe(0);
  });

  it('snapshots trazem os dois players e um hash autoritativo periodico', () => {
    const h = new Harness();
    h.connect('A');
    h.connect('B');
    h.hello('A');
    h.hello('B');
    h.drain('A');
    h.tick(20);
    const snaps = h.drain('A').filter((m) => m.t === 'snapshot');
    expect(snaps.length).toBeGreaterThan(0);
    const withPlayers = snaps.find((s) => s.t === 'snapshot' && s.entities.filter((e) => e.kind === 'player').length === 2);
    expect(withPlayers).toBeDefined();
    expect(snaps.some((s) => s.t === 'snapshot' && typeof s.authHash === 'string')).toBe(true);
  });

  it('parceiro desconectado deixa de travar a extracao apos o grace', () => {
    const h = new Harness();
    h.connect('A');
    h.connect('B');
    h.hello('A');
    h.hello('B');
    h.tick(1);

    const room = h.server.roomForClient('A')!;
    room.state.leftEntryZone = true;
    // A na saida; B longe (e vai cair da rede)
    room.state.players[0].x = room.state.entry.x + 0.5;
    room.state.players[0].y = room.state.entry.y + 0.5;
    room.state.players[1].x = room.state.entry.x + 25;
    room.state.players[1].y = room.state.entry.y + 25;
    h.disconnect('B');

    // dentro do grace o slot segue reservado: o avatar parado bloqueia a saida
    h.cmd('A', 5, interact());
    h.tick(5);
    expect(room.state.phase).toBe('running');
    expect(room.state.playerExtras[1].joined).toBe(true);
    expect(room.hasOpenSlot()).toBe(false); // token do B ainda vale

    // passado o grace, o slot aposenta e o avatar sai da sim
    h.tick(20 * 45 + 2);
    expect(room.state.playerExtras[1].joined).toBe(false);
    expect(room.hasOpenSlot()).toBe(true); // vaga reofertada

    h.cmd('A', 200, interact());
    h.tick(3);
    expect(room.state.phase).toBe('extracted'); // antes: preso para sempre
  });

  it('token de slot aposentado nao reanexa; a vaga aceita um novo jogador', () => {
    const h = new Harness();
    h.connect('A');
    h.connect('B');
    h.hello('A');
    h.hello('B');
    h.tick(1);
    const wb = h.drain('B').find((m) => m.t === 'welcome');
    if (wb?.t !== 'welcome') throw new Error('sem welcome');
    const deadToken = wb.resumeToken;

    const room = h.server.roomForClient('A')!;
    h.disconnect('B');
    h.tick(20 * 45 + 2); // grace expira

    // o dono anterior tenta voltar com o token antigo
    h.connect('B2');
    h.hello('B2', deadToken);
    const rejected = h.drain('B2');
    expect(rejected.some((m) => m.t === 'reject')).toBe(true);

    // um jogador novo ocupa a vaga liberada, com avatar fresco na entrada
    h.connect('C');
    h.hello('C');
    h.tick(1);
    expect(h.server.roomForClient('C')?.id).toBe(room.id);
    expect(room.state.playerExtras[1].joined).toBe(true);
    expect(room.state.players[1].hp).toBe(room.state.players[1].maxHp);
  });

  it('reconexao dentro do grace mantem o avatar onde estava (sem teleporte)', () => {
    const h = new Harness();
    h.connect('A');
    h.connect('B');
    h.hello('A');
    h.hello('B');
    h.tick(1);
    const wb = h.drain('B').find((m) => m.t === 'welcome');
    if (wb?.t !== 'welcome') throw new Error('sem welcome');

    const room = h.server.roomForClient('A')!;
    room.state.players[1].x = room.state.entry.x + 18;
    room.state.players[1].y = room.state.entry.y + 12;
    room.state.players[1].hp = 40;

    h.disconnect('B');
    h.tick(40); // blip curto, bem dentro do grace
    h.connect('B2');
    h.hello('B2', wb.resumeToken);
    h.tick(1);

    // retomar a run nao pode virar cura/teleporte gratuito para a entrada
    expect(room.state.players[1].hp).toBe(40);
    expect(room.state.players[1].x).toBeCloseTo(room.state.entry.x + 18, 5);
    expect(room.slots[1].clientId).toBe('B2');
  });

  it('resume tokens sao imprevisiveis: nao derivam de seed, id da sala nem ordem', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 40; i++) {
      // mesma seed base e mesma ordem de entrada em todas as iteracoes: se o
      // token fosse derivado desses dados, repetiria entre servidores iguais
      const h = new Harness();
      h.connect('A');
      h.connect('B');
      h.hello('A');
      h.hello('B');
      for (const id of ['A', 'B']) {
        const w = h.drain(id).find((m) => m.t === 'welcome');
        if (w?.t !== 'welcome') throw new Error('sem welcome');
        expect(w.resumeToken).toMatch(/^[0-9a-f]{32}$/); // 128 bits de CSPRNG
        // nao pode conter seed nem id da sala (dados que o participante conhece)
        expect(w.resumeToken).not.toContain(String(w.seed));
        seen.add(w.resumeToken);
      }
    }
    expect(seen.size).toBe(80); // nenhuma colisao/repeticao entre execucoes
  });

  it('comandos de borda valem um tick: consume nao drena o inventario', () => {
    const h = new Harness();
    h.connect('A');
    h.hello('A');
    h.drain('A');

    const room = h.server.roomForClient('A')!;
    // varios frascos: com 1 so, drenar-por-tick e gastar-uma-vez dariam 0 igual
    room.state.playerExtras[0].consumables = 5;
    room.state.players[0].hp = 10; // ferido, senao o consumo pode ser ignorado

    // cliente envia consume:true e depois "congela" (suspenso / conexao travada)
    h.cmd('A', 1, { move: { x: 0, y: 0 }, aim: { x: 1, y: 0 }, consume: true });
    h.tick(30); // 30 ticks sem nova mensagem

    // antes: gastava um frasco por tick, zerando o inventario em 5 ticks
    expect(room.state.playerExtras[0].consumables).toBe(4);
  });

  it('abrir um bau propaga WorldFlags uma vez e depois so no full_resync', () => {
    const h = new Harness();
    h.connect('A');
    h.hello('A');
    h.drain('A');
    h.tick(2);
    // baseline: ja recebeu as flags iniciais, nada aberto
    h.drain('A');

    const room = h.server.roomForClient('A')!;
    room.state.caches[0].opened = true;
    h.tick(1);
    const first = h.drain('A').filter((m) => m.t === 'snapshot');
    const withWorld = first.find((s) => s.t === 'snapshot' && s.world);
    expect(withWorld).toBeDefined();
    if (withWorld?.t === 'snapshot') expect(withWorld.world!.openedCaches).toContain(0);

    // sem novas mudancas, as flags nao viajam de novo (delta, nao estado por tick)
    h.tick(10);
    expect(h.drain('A').filter((m) => m.t === 'snapshot' && m.world).length).toBe(0);

    // quem reconecta/chega tarde recebe tudo de uma vez no full_resync
    h.send('A', { t: 'resync', reason: 'test' });
    const resync = h.drain('A').find((m) => m.t === 'full_resync');
    expect(resync).toBeDefined();
    if (resync?.t === 'full_resync') expect(resync.world.openedCaches).toContain(0);
  });
});
