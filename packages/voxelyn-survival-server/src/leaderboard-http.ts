// Endpoints HTTP do ranking.
//
// Vive fora de `ws.ts` porque tem um perfil de risco completamente diferente do
// resto do servidor: e a unica superficie que aceita um corpo grande de um
// cliente nao autenticado E gasta CPU proporcional a ele. Todo controle deste
// arquivo existe por causa disso, e nao por formalidade.

import type { IncomingMessage, ServerResponse } from 'node:http';
import type { LeaderboardMode, LeaderboardStore } from './leaderboard.js';
import { MAX_REPLAY_BYTES, sanitizeName, verifySoloRun } from './replay.js';
import {
  SubmissionRateLimiter,
  createVerificationBudget,
  readJsonBody,
  requestRateLimitKey,
  type VerificationBudget,
} from './http-util.js';

/**
 * Verificacoes de replay simultaneas.
 *
 * UMA. Re-simular uma run de 12 minutos e trabalho sincrono de CPU que nao
 * cede o event loop, e o event loop e o mesmo que roda o tick autoritativo a
 * 20 Hz. Duas verificacoes concorrentes nao terminariam mais rapido — Node nao
 * as paraleliza — e engasgariam a simulacao de quem esta jogando. Excedentes
 * sao RECUSADOS com 503, e nao enfileirados: uma fila daria ao atacante uma
 * forma barata de acumular trabalho pendente.
 *
 * O orcamento e COMPARTILHADO com o pool de ecos, que re-simula pelo mesmo
 * motivo e disputa o mesmo event loop. Dois orcamentos de um significariam dois
 * replays concorrentes, que e exatamente o que este limite existe para impedir.
 */

export type LeaderboardHttpOptions = {
  store: LeaderboardStore;
  log: (line: Record<string, unknown>) => void;
  allowedOrigins?: string[];
  /** Quantos proxies imediatamente a frente da aplicacao sao confiaveis. */
  trustedProxyHops?: number;
  /** Orcamento de re-simulacao, compartilhado com o pool de ecos. */
  budget?: VerificationBudget;
};

export const createLeaderboardHandler = (opts: LeaderboardHttpOptions) => {
  const limiter = new SubmissionRateLimiter();
  const budget = opts.budget ?? createVerificationBudget();

  const cors = (req: IncomingMessage, res: ServerResponse): void => {
    const origin = req.headers.origin;
    if (origin && (!opts.allowedOrigins || opts.allowedOrigins.includes(origin))) {
      res.setHeader('access-control-allow-origin', origin);
      res.setHeader('vary', 'origin');
    }
    res.setHeader('access-control-allow-methods', 'GET, POST, OPTIONS');
    res.setHeader('access-control-allow-headers', 'content-type');
  };

  const json = (res: ServerResponse, status: number, body: unknown): void => {
    res.writeHead(status, { 'content-type': 'application/json' });
    res.end(JSON.stringify(body));
  };

  /** Trata a requisicao; devolve false quando a rota nao e do ranking. */
  return async (req: IncomingMessage, res: ServerResponse): Promise<boolean> => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    if (!url.pathname.startsWith('/leaderboard')) return false;
    cors(req, res);

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return true;
    }

    if (req.method === 'GET') {
      const seedParam = url.searchParams.get('seed');
      const modeParam = url.searchParams.get('mode');
      const seed = seedParam === null ? undefined : Number(seedParam);
      if (seed !== undefined && !Number.isInteger(seed)) {
        json(res, 400, { error: 'seed invalida' });
        return true;
      }
      const entries = await opts.store.top({
        seed,
        mode:
          modeParam === 'solo' || modeParam === 'coop' ? (modeParam as LeaderboardMode) : undefined,
        limit: Number(url.searchParams.get('limit') ?? '') || undefined,
      });
      json(res, 200, { entries });
      return true;
    }

    if (req.method !== 'POST') {
      json(res, 405, { error: 'metodo nao suportado' });
      return true;
    }

    const ip = requestRateLimitKey(req, opts.trustedProxyHops);
    if (limiter.check(ip, Date.now())) {
      json(res, 429, { error: 'muitas submissoes; tente de novo em um minuto' });
      return true;
    }
    // Recusa ANTES de ler o corpo: ler meio megabyte para descartar em seguida e
    // exatamente o trabalho que o limite existe para evitar.
    if (budget.busy()) {
      json(res, 503, { error: 'verificacao ocupada; tente de novo' });
      return true;
    }

    // Margem sobre o teto do log para o resto do JSON (nome, seed, aspas).
    const raw = await readJsonBody(req, MAX_REPLAY_BYTES + 4096);
    if (raw === null) {
      // `connection: close` porque nao vamos ler o resto do corpo; manter a
      // conexao viva deixaria o pipeline HTTP dessincronizado.
      res.setHeader('connection', 'close');
      json(res, 413, { error: 'corpo excede o tamanho maximo' });
      req.destroy();
      return true;
    }

    let payload: { seed?: unknown; log?: unknown; name?: unknown };
    try {
      payload = JSON.parse(raw) as typeof payload;
    } catch {
      json(res, 400, { error: 'corpo nao e JSON valido' });
      return true;
    }

    const seed = Number(payload.seed);
    const log = typeof payload.log === 'string' ? payload.log : '';
    const name = sanitizeName(payload.name);

    // A reserva fica COLADA ao `try`: entre `busy()` e aqui houve leitura de corpo
    // e parse, e cada retorno antecipado dali teria de lembrar de liberar a vaga.
    if (!budget.claim()) {
      json(res, 503, { error: 'verificacao ocupada; tente de novo' });
      return true;
    }
    try {
      const started = Date.now();
      // O resultado sai DAQUI, nao do corpo da requisicao. Nao ha campo de
      // pontuacao para o cliente preencher — ver replay.ts.
      const verdict = verifySoloRun(seed, log);
      const elapsed = Date.now() - started;
      if (!verdict.ok) {
        opts.log({ ev: 'replay_rejected', ip, seed, reason: verdict.reason, ms: elapsed });
        json(res, 422, { error: verdict.reason });
        return true;
      }

      const digest = verdict.digest;
      const entry = await opts.store.submit({
        name,
        mode: 'solo',
        summary: verdict.summary,
        digest,
      });
      opts.log({
        ev: 'replay_accepted',
        ip,
        seed,
        stars: verdict.summary.stars,
        ticks: verdict.ticks,
        ms: elapsed,
        duplicate: entry === null,
      });
      // Reenvio nao e erro: a rede pode ter caido depois do POST. Devolve o
      // resultado verificado do mesmo jeito, so sem gravar de novo.
      json(res, 200, {
        summary: verdict.summary,
        entry,
        duplicate: entry === null,
      });
      return true;
    } finally {
      budget.release();
    }
  };
};
