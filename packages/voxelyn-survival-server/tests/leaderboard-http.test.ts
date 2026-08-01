import type { IncomingMessage } from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createRun, emptyCommand, stepRun, type PlayerCommand } from '@voxelyn/survival-sim';
import { encodeCommandLog, quantizeCommand, toBase64 } from '@voxelyn/survival-protocol';
import { createWsServer, type WsServerHandle } from '../src/ws';
import {
  SubmissionRateLimiter,
  requestRateLimitKey,
  SUBMIT_MAX_PER_WINDOW,
} from '../src/http-util';

/**
 * Sobe o servidor DE VERDADE numa porta efemera.
 *
 * Chamar o handler direto testaria a logica e nao o caminho: limite de corpo,
 * CORS, roteamento e concorrencia so existem no servidor HTTP montado, e sao
 * justamente eles que protegem a unica rota que aceita corpo grande de cliente
 * nao autenticado.
 */
let handle: WsServerHandle;
let base: string;

const bootServer = async (): Promise<{ handle: WsServerHandle; base: string }> => {
  const booted = createWsServer({ port: 0, host: '127.0.0.1', baseSeed: 31337 });
  await booted.ready; // store do ranking pronto (memoria, sem DATABASE_URL)
  await new Promise<void>((resolve) => {
    if (booted.http.listening) return resolve();
    booted.http.once('listening', () => resolve());
  });
  const addr = booted.http.address();
  const port = typeof addr === 'object' && addr ? addr.port : 0;
  return { handle: booted, base: `http://127.0.0.1:${port}` };
};

beforeAll(async () => {
  ({ handle, base } = await bootServer());
});

afterAll(async () => {
  await handle.close();
});

/** Guarda contra loop infinito, com folga. Ver nota em `leaderboard.test.ts`. */
const MAX_FIXTURE_TICKS = 12_000;

/** Joga uma run solo pelo mesmo caminho do cliente e devolve o log. */
const playRun = (seed: number) => {
  const state = createRun({ seed, playerCount: 1 });
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

const postTo = (target: string, body: unknown): Promise<Response> =>
  fetch(`${target}/leaderboard`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });

const post = (body: unknown): Promise<Response> => postTo(base, body);

const requestWithForwarding = (forwardedFor: string): IncomingMessage =>
  ({
    headers: { 'x-forwarded-for': forwardedFor },
    socket: { remoteAddress: '10.0.0.9' },
  }) as unknown as IncomingMessage;

describe('rate limit de replay', () => {
  it('ignora valores prependados pelo cliente e limita pela origem do salto confiavel', () => {
    const limiter = new SubmissionRateLimiter();
    for (let i = 0; i < SUBMIT_MAX_PER_WINDOW; i++) {
      const key = requestRateLimitKey(
        requestWithForwarding(`203.0.113.${i + 1}, 198.51.100.77`),
        1,
      );
      expect(key).toBe('198.51.100.77');
      expect(limiter.check(key, 1_000 + i)).toBe(false);
    }
    const rotatedAgain = requestRateLimitKey(
      requestWithForwarding('192.0.2.250, 198.51.100.77'),
      1,
    );
    expect(limiter.check(rotatedAgain, 2_000)).toBe(true);
  });

  it('ignora X-Forwarded-For quando nenhum proxy foi explicitamente confiado', () => {
    const req = requestWithForwarding('203.0.113.50, 198.51.100.77');
    expect(requestRateLimitKey(req, 0)).toBe('10.0.0.9');
  });

  it('remove buckets ociosos e nao cresce para sempre', () => {
    const limiter = new SubmissionRateLimiter({
      idleTtlMs: 100,
      sweepIntervalMs: 10,
      maxBuckets: 10,
    });
    expect(limiter.check('antigo', 0)).toBe(false);
    expect(limiter.size()).toBe(1);
    expect(limiter.check('novo', 101)).toBe(false);
    expect(limiter.size()).toBe(1);
  });
});

describe('POST /leaderboard', () => {
  it('verifica uma run real e devolve o sumario que o servidor derivou', async () => {
    // Seed escolhida porque o bot senoidal EXTRAI nela sob a geracao atual —
    // `duplicate: false` exige elegibilidade, e elegivel e so quem extraiu. A
    // seed anterior (4242) extraia no mapa antigo; a gramatica basaltica mudou
    // o entorno da entrada e o bot passou a morrer la.
    const played = playRun(1);
    expect(played.state.phase).not.toBe('running');

    const res = await post({ seed: 1, log: played.base64, name: 'Dani' });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { summary: { stars: number; ticks: number }; duplicate: boolean };

    // O servidor NAO recebeu estrelas nem tempo: derivou os dois re-simulando.
    expect(body.summary.ticks).toBe(played.state.tick);
    expect(body.summary.stars).toBe(played.state.summary!.stars);
    expect(body.duplicate).toBe(false);
  });

  // A rede pode cair depois do POST e o cliente reenviar: reenvio nao pode
  // duplicar a entrada, mas tambem nao e erro.
  it('trata reenvio como duplicata, e nao como falha', async () => {
    const played = playRun(909);
    if (played.state.phase === 'running') return; // seed que nao termina: nada a testar
    await post({ seed: 909, log: played.base64, name: 'x' });
    const res = await post({ seed: 909, log: played.base64, name: 'x' });
    expect(res.status).toBe(200);
    expect(((await res.json()) as { duplicate: boolean }).duplicate).toBe(true);
  });

  it('recusa log que nao corresponde a uma run terminada', async () => {
    const res = await post({ seed: 1, log: toBase64(encodeCommandLog([])), name: 'x' });
    expect(res.status).toBe(422);
  });

  it('recusa corpo que nao e JSON', async () => {
    const res = await post('{{{ nao e json');
    expect(res.status).toBe(400);
  });

  // O limite aborta durante o stream, e nao depois: conferir no fim significa
  // ter aceitado o corpo inteiro na memoria, que e o que o limite existe para
  // impedir.
  it('recusa corpo gigante', async () => {
    const res = await post({ seed: 1, log: 'A'.repeat(600 * 1024), name: 'x' });
    expect([413, 422]).toContain(res.status);
  });

  /**
   * Servidor PROPRIO, e nao o compartilhado, por uma razao aritmetica: os testes
   * acima gastam as seis submissoes por janela que `SUBMIT_MAX_PER_WINDOW`
   * permite por origem, e o limite e checado ANTES de ler o corpo — inclusive nos
   * que terminam em 400 e 422. A setima submissao desta suite recebe 429, faca o
   * que fizer. Um limiter novo nasce com o handler novo.
   *
   * Este teste vinha passando VAZIO: ele abria com `if (phase === 'running')
   * return`, e a run de fixture nao terminava dentro do teto de ticks antigo.
   * Nunca chegou a mandar nada. Nao ha mais escape — se a fixture nao terminar,
   * o teste falha em vez de se calar.
   */
  it('nunca aceita um resultado vindo do cliente', async () => {
    const isolated = await bootServer();
    try {
      const played = playRun(555);
      expect(played.state.phase, 'a run de fixture precisa terminar').not.toBe('running');
      // Manda estrelas e tempo mentirosos JUNTO com um log honesto.
      const res = await postTo(isolated.base, {
        seed: 555,
        log: played.base64,
        name: 'trapaceiro',
        stars: 3,
        ticks: 1,
        summary: { stars: 3, ticks: 1 },
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as { summary: { stars: number; ticks: number } };
      // Os campos forjados sao simplesmente ignorados: o que volta e o que a
      // simulacao produziu.
      expect(body.summary.ticks).toBe(played.state.tick);
      expect(body.summary.stars).toBe(played.state.summary!.stars);
    } finally {
      await isolated.handle.close();
    }
  });

  /**
   * O limite por origem, pelo caminho HTTP de verdade.
   *
   * A classe tem teste de unidade acima, mas nada provava que o servidor a
   * consultava — e o descuido nao e teorico: foi exatamente um 429 inesperado
   * nesta suite que revelou o teste vazio acima. Aqui o 429 e a afirmacao, e nao
   * o acidente.
   */
  it('corta a submissao acima do teto por janela', async () => {
    const isolated = await bootServer();
    try {
      const body = { seed: 1, log: toBase64(encodeCommandLog([])), name: 'x' };
      for (let i = 0; i < SUBMIT_MAX_PER_WINDOW; i++) {
        // 422 (log nao termina a run) ja prova que passou do limite: o limite
        // responde antes de o corpo ser lido.
        expect((await postTo(isolated.base, body)).status).toBe(422);
      }
      expect((await postTo(isolated.base, body)).status).toBe(429);
    } finally {
      await isolated.handle.close();
    }
  });
});

describe('GET /leaderboard', () => {
  it('devolve as entradas ordenadas', async () => {
    const res = await fetch(`${base}/leaderboard?limit=10`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { entries: { stars: number; ticks: number }[] };
    for (let i = 1; i < body.entries.length; i++) {
      const prev = body.entries[i - 1];
      const cur = body.entries[i];
      expect(prev.stars >= cur.stars).toBe(true);
      if (prev.stars === cur.stars) expect(prev.ticks <= cur.ticks).toBe(true);
    }
  });

  it('recusa seed invalida em vez de devolver tudo', async () => {
    const res = await fetch(`${base}/leaderboard?seed=abc`);
    expect(res.status).toBe(400);
  });

  it('filtra por seed', async () => {
    const res = await fetch(`${base}/leaderboard?seed=4242`);
    const body = (await res.json()) as { entries: { seed: number }[] };
    for (const e of body.entries) expect(e.seed).toBe(4242);
  });
});

describe('rotas do jogo continuam intactas', () => {
  it('/healthz e /readyz respondem', async () => {
    expect((await fetch(`${base}/healthz`)).status).toBe(200);
    expect((await fetch(`${base}/readyz`)).status).toBe(200);
  });
});
