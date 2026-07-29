// Endpoints HTTP do ranking.
//
// Vive fora de `ws.ts` porque tem um perfil de risco completamente diferente do
// resto do servidor: e a unica superficie que aceita um corpo grande de um
// cliente nao autenticado E gasta CPU proporcional a ele. Todo controle deste
// arquivo existe por causa disso, e nao por formalidade.

import { isIP } from 'node:net';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { LeaderboardMode, LeaderboardStore } from './leaderboard.js';
import { MAX_REPLAY_BYTES, replayDigest, sanitizeName, verifySoloRun } from './replay.js';

/**
 * Verificacoes de replay simultaneas.
 *
 * UMA. Re-simular uma run de 12 minutos e trabalho sincrono de CPU que nao
 * cede o event loop, e o event loop e o mesmo que roda o tick autoritativo a
 * 20 Hz. Duas verificacoes concorrentes nao terminariam mais rapido — Node nao
 * as paraleliza — e engasgariam a simulacao de quem esta jogando. Excedentes
 * sao RECUSADOS com 503, e nao enfileirados: uma fila daria ao atacante uma
 * forma barata de acumular trabalho pendente.
 */
const MAX_CONCURRENT_VERIFICATIONS = 1;

/** Janela, teto e retencao das submissoes por origem. */
export const SUBMIT_WINDOW_MS = 60_000;
export const SUBMIT_MAX_PER_WINDOW = 6;
export const BUCKET_IDLE_TTL_MS = 5 * SUBMIT_WINDOW_MS;
const BUCKET_SWEEP_INTERVAL_MS = SUBMIT_WINDOW_MS;
const MAX_RATE_LIMIT_BUCKETS = 10_000;

type Bucket = { count: number; resetAt: number; lastSeenAt: number };

export type SubmissionRateLimiterOptions = {
  windowMs?: number;
  maxPerWindow?: number;
  idleTtlMs?: number;
  sweepIntervalMs?: number;
  maxBuckets?: number;
};

/**
 * Limite em memoria com coleta de origens inativas e teto defensivo.
 *
 * Sem a coleta, um fluxo de IPs legitimos — ou uma chave de origem mal
 * configurada — deixaria uma entrada permanente por visitante ate o processo
 * reiniciar. Ao atingir o teto depois da varredura, falha fechado.
 */
export class SubmissionRateLimiter {
  private readonly buckets = new Map<string, Bucket>();
  private readonly windowMs: number;
  private readonly maxPerWindow: number;
  private readonly idleTtlMs: number;
  private readonly sweepIntervalMs: number;
  private readonly maxBuckets: number;
  private nextSweepAt = 0;

  constructor(options: SubmissionRateLimiterOptions = {}) {
    this.windowMs = options.windowMs ?? SUBMIT_WINDOW_MS;
    this.maxPerWindow = options.maxPerWindow ?? SUBMIT_MAX_PER_WINDOW;
    this.idleTtlMs = options.idleTtlMs ?? BUCKET_IDLE_TTL_MS;
    this.sweepIntervalMs = options.sweepIntervalMs ?? BUCKET_SWEEP_INTERVAL_MS;
    this.maxBuckets = options.maxBuckets ?? MAX_RATE_LIMIT_BUCKETS;
  }

  private sweep(now: number): void {
    for (const [key, bucket] of this.buckets) {
      if (now - bucket.lastSeenAt >= this.idleTtlMs) this.buckets.delete(key);
    }
    this.nextSweepAt = now + this.sweepIntervalMs;
  }

  check(key: string, now: number): boolean {
    if (now >= this.nextSweepAt) this.sweep(now);

    let bucket = this.buckets.get(key);
    if (!bucket) {
      if (this.buckets.size >= this.maxBuckets) {
        this.sweep(now);
        if (this.buckets.size >= this.maxBuckets) return true;
      }
      bucket = { count: 1, resetAt: now + this.windowMs, lastSeenAt: now };
      this.buckets.set(key, bucket);
      return false;
    }

    bucket.lastSeenAt = now;
    if (now >= bucket.resetAt) {
      bucket.count = 1;
      bucket.resetAt = now + this.windowMs;
      return false;
    }
    bucket.count += 1;
    return bucket.count > this.maxPerWindow;
  }

  /** Apenas para regressao/diagnostico; nao faz parte do protocolo HTTP. */
  size(): number {
    return this.buckets.size;
  }
}

export type LeaderboardHttpOptions = {
  store: LeaderboardStore;
  log: (line: Record<string, unknown>) => void;
  allowedOrigins?: string[];
  /** Quantos proxies imediatamente a frente da aplicacao sao confiaveis. */
  trustedProxyHops?: number;
};

const canonicalIp = (raw: string | undefined): string | null => {
  if (!raw) return null;
  let value = raw.trim().replace(/^"|"$/g, '');
  if (value.startsWith('[')) {
    const closing = value.indexOf(']');
    if (closing > 0) value = value.slice(1, closing);
  }
  if (value.startsWith('::ffff:')) value = value.slice('::ffff:'.length);
  return isIP(value) > 0 ? value : null;
};

/**
 * Chave de origem baseada somente em saltos de proxy explicitamente confiados.
 *
 * O array X-Forwarded-For e percorrido DA DIREITA para a esquerda: cada proxy
 * confiavel acrescenta o peer que recebeu. Valores que o cliente prependa a
 * esquerda nunca mudam a chave enquanto o numero de saltos confiaveis for o
 * mesmo. Sem configuracao de proxy, o header inteiro e ignorado.
 */
export const requestRateLimitKey = (req: IncomingMessage, trustedProxyHops = 0): string => {
  const socketAddress = canonicalIp(req.socket.remoteAddress) ?? 'desconhecido';
  const hops = Math.max(0, Math.floor(trustedProxyHops));
  if (hops === 0) return socketAddress;

  const header = req.headers['x-forwarded-for'];
  const raw = Array.isArray(header) ? header.join(',') : header;
  const chain = raw
    ?.split(',')
    .map((part) => canonicalIp(part))
    .filter((part): part is string => part !== null);
  if (!chain || chain.length < hops) return socketAddress;
  return chain[chain.length - hops] ?? socketAddress;
};

const readBody = (req: IncomingMessage, limit: number): Promise<string | null> =>
  new Promise((resolve) => {
    let size = 0;
    let overflowed = false;
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => {
      if (overflowed) return;
      size += chunk.length;
      // Para de acumular ASSIM QUE estoura, em vez de bufferizar tudo e
      // conferir no fim: conferir no fim significa ter aceitado o corpo inteiro
      // na memoria, que e o que o limite existe para impedir.
      //
      // `pause()` e nao `destroy()`: destruir aqui fecha o socket antes de o
      // 413 sair, e o cliente ve "erro de rede" em vez da recusa — sem saber
      // que basta mandar menos. O pause aplica contrapressao de TCP, o handler
      // responde, e so entao a conexao e encerrada.
      if (size > limit) {
        overflowed = true;
        chunks.length = 0;
        req.pause();
        resolve(null);
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (!overflowed) resolve(Buffer.concat(chunks).toString('utf8'));
    });
    req.on('error', () => resolve(null));
  });

export const createLeaderboardHandler = (opts: LeaderboardHttpOptions) => {
  const limiter = new SubmissionRateLimiter();
  let running = 0;

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
    if (running >= MAX_CONCURRENT_VERIFICATIONS) {
      json(res, 503, { error: 'verificacao ocupada; tente de novo' });
      return true;
    }

    // Margem sobre o teto do log para o resto do JSON (nome, seed, aspas).
    const raw = await readBody(req, MAX_REPLAY_BYTES + 4096);
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

    running += 1;
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

      const digest = replayDigest(seed, log);
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
      running -= 1;
    }
  };
};
