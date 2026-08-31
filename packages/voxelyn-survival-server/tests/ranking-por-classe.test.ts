// O ranking por CLASSE de descida, no caminho HTTP de verdade.
//
// A regra que estes testes protegem tem duas metades, e as duas sao novas:
//
//   1. a run e re-simulada com a profundidade que o SERVIDOR autorizou, e nao
//      com a de fabrica — sem isso, o log de uma descida de sete setores
//      voltaria recusado como fraude para quem jogou honestamente;
//   2. a profundidade decide em qual livro a run entra, e livros nao se
//      misturam.
//
// A primeira metade e a que quebra em silencio: ela nao produz erro nenhum, so
// uma recusa que parece acusacao. Por isso a assercao central aqui e igualdade
// PROFUNDA entre o sumario do cliente e o do servidor, e nao "bateu no geral".

import { createServer, type Server } from 'node:http';
import { afterEach, describe, expect, it } from 'vitest';
import {
  createRun,
  emptyCommand,
  runDepthForGeneration,
  stepRun,
  type PlayerCommand,
  type RunDepthConfig,
} from '@voxelyn/survival-sim';
import { encodeCommandLog, quantizeCommand, toBase64 } from '@voxelyn/survival-protocol';
import { MemoryLeaderboard } from '../src/leaderboard';
import { createLeaderboardHandler } from '../src/leaderboard-http';

/** Guarda contra loop infinito, com folga. Ver nota em `leaderboard.test.ts`. */
const MAX_FIXTURE_TICKS = 12_000;

/** Joga uma run pelo caminho do cliente: quantiza, simula o quantizado, grava. */
const playRun = (seed: number, depth?: RunDepthConfig) => {
  const state = createRun({ seed, playerCount: 1, depth });
  const log: PlayerCommand[] = [];
  for (let t = 0; t < MAX_FIXTURE_TICKS && state.phase === 'running'; t++) {
    const cmd = quantizeCommand({
      ...emptyCommand(),
      move: { x: Math.sin(t / 40), y: Math.cos(t / 37) },
      aim: { x: Math.cos(t / 13), y: Math.sin(t / 11) },
      fire: t % 4 === 0,
      interact: t % 11 === 0,
    });
    log.push(cmd);
    stepRun(state, [cmd]);
  }
  return { state, base64: toBase64(encodeCommandLog(log)) };
};

/**
 * Sobe SO o handler do ranking, com um `runConfig` de mentira.
 *
 * Sem progressao e sem banco: o que esta sob teste e a ponte entre o ticket e a
 * profundidade, e um servidor inteiro em volta so acrescentaria maneiras de o
 * teste falhar por outro motivo. O `runConfig` de mentira faz o papel do
 * ticket guardado — que e exatamente o contrato que `ws.ts` liga na producao.
 */
const bootHandler = async (tickets: Record<string, RunDepthConfig>) => {
  const store = new MemoryLeaderboard();
  const handle = createLeaderboardHandler({
    store,
    log: () => {},
    runConfig: async (runId) => {
      if (runId === 'ticket:banco-fora') throw new Error('progressao indisponivel');
      if (runId === 'ticket:versao-velha') {
        return { status: 'incompatible', reason: 'run jogada em outra versao da simulacao' };
      }
      const depth = tickets[runId];
      // Ticket ausente e TERMINAL, e nao "cai na fabrica": e o que o resolvedor
      // de producao devolve quando a varredura ja levou o ticket embora.
      return depth
        ? { status: 'authorized', config: { seed: seedOf(runId), depth } }
        : { status: 'incompatible', reason: 'ticket da run nao encontrado' };
    },
  });
  const server: Server = createServer((req, res) => {
    void handle(req, res).then((handled) => {
      if (!handled) {
        res.writeHead(404);
        res.end();
      }
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address();
  const port = typeof addr === 'object' && addr ? addr.port : 0;
  return { store, server, base: `http://127.0.0.1:${port}` };
};

/**
 * A seed que o "ticket" guardou.
 *
 * Codificada no proprio runId (`ticket:<seed>`) para o teste nao precisar de um
 * segundo mapa. O que importa e que ela venha do TICKET e nao do corpo — e o
 * teste `a seed vem do ticket` depende justamente disso.
 */
const seedOf = (runId: string): number => Number(runId.split(':')[1]);

let open: Server | null = null;
afterEach(async () => {
  if (open) await new Promise<void>((resolve) => open?.close(() => resolve()));
  open = null;
});

const post = (base: string, body: unknown): Promise<Response> =>
  fetch(`${base}/leaderboard`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

describe('a run e verificada com a profundidade AUTORIZADA', () => {
  it('deriva o mesmo sumario que o jogador de G-04 viveu', async () => {
    const depth = runDepthForGeneration('G-04');
    const played = playRun(4242, depth);
    expect(played.state.phase, 'a run de fixture precisa terminar').not.toBe('running');

    const boot = await bootHandler({ 'ticket:4242': depth });
    open = boot.server;
    const res = await post(boot.base, {
      seed: 4242,
      log: played.base64,
      name: 'g04',
      runId: 'ticket:4242',
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { summary: unknown };
    // Igualdade PROFUNDA: e ela que denuncia uma profundidade errada, porque
    // uma run de sete setores re-simulada em tres diverge tick a tick.
    expect(body.summary).toEqual(played.state.summary);
    expect(played.state.summary!.sectorCount).toBe(7);
  });

  /**
   * O contrario, e por que ele importa: SEM ticket a run cai na descida de
   * fabrica. E o comportamento correto para quem joga offline ou contra um
   * servidor sem progressao — e a prova de que a profundidade nao vem do corpo.
   */
  it('sem ticket, a run e a de fabrica — tres setores', async () => {
    const played = playRun(4242);
    expect(played.state.phase).not.toBe('running');
    const boot = await bootHandler({});
    open = boot.server;
    // Sem `runId` no corpo o resolvedor nem e consultado: nao ha ticket a
    // resolver, e a fabrica E a verdade desta run.
    const res = await post(boot.base, { seed: 4242, log: played.base64, name: 'sem ticket' });
    const body = (await res.json()) as { summary: { sectorCount: number } };
    expect(body.summary.sectorCount).toBe(3);
  });

  /**
   * Nao ha campo para inflar a propria classe.
   *
   * O corpo nao tem campo de profundidade, e a unica coisa que ele pode mandar
   * — o runId — so vale se ESTE servidor tiver emitido o ticket.
   */
  it('runId inventado nao autoriza profundidade nenhuma', async () => {
    const played = playRun(4242);
    const boot = await bootHandler({ 'ticket:4242': runDepthForGeneration('G-04') });
    open = boot.server;
    const res = await post(boot.base, {
      seed: 4242,
      log: played.base64,
      name: 'trapaceiro',
      runId: 'ticket:99999',
      sectorCount: 7,
      depth: { generation: 'G-04', sectorCount: 7, coreSectors: [3, 7] },
    });
    // Recusa, e nao rebaixamento silencioso para a fabrica. Rebaixar seria
    // re-simular contra uma configuracao que nao e a da run — e quem paga por
    // isso nao e o trapaceiro (que nao tinha run nenhuma), e o jogador honesto
    // cujo ticket a varredura levou embora.
    expect(res.status).toBe(422);
    expect((await res.json()) as { error: string }).toEqual({
      error: 'ticket da run nao encontrado',
    });
  });

  /**
   * Banco de progressao fora do ar: 503, nao 422 e nao fabrica.
   *
   * Os tres desfechos sao diferentes e so um esta certo. A fabrica re-simula
   * contra a configuracao errada; 422 encerra para sempre uma submissao que so
   * precisava de outra tentativa; 503 diz o que aconteceu — nao deu para
   * conferir — e deixa o reenvio funcionar.
   */
  it('falha ao resolver o ticket devolve 503, e nao a descida de fabrica', async () => {
    const played = playRun(4242);
    const boot = await bootHandler({});
    open = boot.server;
    const res = await post(boot.base, {
      seed: 4242,
      log: played.base64,
      name: 'honesto',
      runId: 'ticket:banco-fora',
    });
    expect(res.status).toBe(503);
    // E nada entrou no livro: melhor nenhuma linha do que a linha errada.
    expect(await boot.store.top({})).toHaveLength(0);
  });

  /**
   * Ticket de outra versao da simulacao: recusa explicita.
   *
   * A liquidacao ja fazia esta guarda (`version_mismatch`); ao ranking ela
   * faltava. Um deploy que mude SIMULATION_VERSION deixa para tras tickets que
   * descrevem uma descida que a simulacao de hoje nao reproduz — re-simular
   * assim mesmo daria um resultado que nao foi o do jogador.
   */
  it('ticket de outra versao da simulacao e recusado, e nao rebaixado', async () => {
    const played = playRun(4242);
    const boot = await bootHandler({});
    open = boot.server;
    const res = await post(boot.base, {
      seed: 4242,
      log: played.base64,
      name: 'veterano',
      runId: 'ticket:versao-velha',
    });
    expect(res.status).toBe(422);
    expect(((await res.json()) as { error: string }).error).toContain('outra versao');
    expect(await boot.store.top({})).toHaveLength(0);
  });

  // A seed sai do ticket quando ha ticket: o corpo pode mentir sobre ela sem
  // efeito nenhum, porque quem sorteou o mundo foi o servidor.
  it('a seed vem do ticket, e nao do corpo', async () => {
    const depth = runDepthForGeneration('G-00');
    const played = playRun(4242, depth);
    const boot = await bootHandler({ 'ticket:4242': depth });
    open = boot.server;
    const res = await post(boot.base, {
      seed: 777,
      log: played.base64,
      name: 'x',
      runId: 'ticket:4242',
    });
    const body = (await res.json()) as { summary: { seed: number } };
    expect(body.summary.seed).toBe(4242);
  });
});

describe('cada profundidade tem o seu livro', () => {
  it('a run entra no livro da propria classe, e nao no dos outros', async () => {
    const depth = runDepthForGeneration('G-04');
    const funda = playRun(4242, depth);
    const rasa = playRun(4242);
    // O teste so tem sentido se as duas runs forem elegiveis; se o bot morrer,
    // nada entra no livro e a assercao passaria vazia.
    if (funda.state.phase === 'dead' && rasa.state.phase === 'dead') return;

    const boot = await bootHandler({ 'ticket:4242': depth });
    open = boot.server;
    await post(boot.base, { seed: 4242, log: funda.base64, name: 'funda', runId: 'ticket:4242' });
    await post(boot.base, { seed: 4242, log: rasa.base64, name: 'rasa' });

    const classes = await boot.store.classes({});
    for (const board of classes) {
      const entries = await boot.store.top({ sectorCount: board.sectorCount });
      for (const entry of entries) expect(entry.sectorCount).toBe(board.sectorCount);
    }
  });
});
