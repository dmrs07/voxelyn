// Encanamento HTTP compartilhado pelas rotas não-jogo: ranking, telemetria e pool
// de ecos.
//
// Nasceu dentro de `leaderboard-http.ts`, e as outras rotas importavam de lá — a
// telemetria buscava o limitador no módulo do ranking e mantinha a própria cópia
// do leitor de corpo. Com uma terceira rota chegando, a duplicação virava três
// cópias de um leitor cuja parte difícil é justamente a que não se vê: parar de
// acumular no instante em que o corpo estoura, e responder antes de fechar.
//
// Nada aqui sabe o que é um placar, um evento ou uma cápsula.

import { isIP } from 'node:net';
import type { IncomingMessage } from 'node:http';

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

/**
 * Orçamento de re-simulações concorrentes.
 *
 * Um contador, não um semáforo com fila: quem não consegue a vaga é RECUSADO na
 * hora. Uma fila daria a um atacante uma forma barata de acumular trabalho
 * pendente contra o event loop que roda o tick autoritativo.
 *
 * Existe como objeto para poder ser COMPARTILHADO entre rotas. Ranking e pool de
 * ecos re-simulam pelo mesmo motivo e disputam o mesmo event loop; um contador
 * por rota permitiria N replays simultâneos em N rotas.
 */
export type VerificationBudget = {
  /**
   * Não há vaga agora?
   *
   * Consulta que NÃO reserva, para a rota poder recusar antes de ler um corpo de
   * meio megabyte. Separada de `claim` de propósito: uma reserva feita cedo teria
   * de ser liberada em cada retorno antecipado — corpo grande, JSON inválido — e
   * esquecer um deles vaza a vaga para sempre, transformando a rota em 503
   * permanente. Com a consulta separada, `claim` fica sempre colado ao `try`.
   */
  busy: () => boolean;
  /** Reserva uma vaga. False quando não há. Sempre pareado com `release`. */
  claim: () => boolean;
  release: () => void;
};

export const createVerificationBudget = (max = 1): VerificationBudget => {
  let running = 0;
  return {
    busy: () => running >= max,
    claim: () => {
      if (running >= max) return false;
      running += 1;
      return true;
    },
    release: () => {
      running = Math.max(0, running - 1);
    },
  };
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

/**
 * Le o corpo com teto, devolvendo null quando ele estoura.
 *
 * Para de acumular ASSIM QUE estoura, em vez de bufferizar tudo e conferir no
 * fim: conferir no fim significa ter aceitado o corpo inteiro na memoria, que e o
 * que o limite existe para impedir.
 *
 * `pause()` e nao `destroy()`: destruir aqui fecha o socket antes de o 413 sair, e
 * o cliente ve "erro de rede" em vez da recusa — sem saber que basta mandar menos.
 * O pause aplica contrapressao de TCP, o handler responde, e so entao a conexao e
 * encerrada.
 */
export const readJsonBody = (req: IncomingMessage, limit: number): Promise<string | null> =>
  new Promise((resolve) => {
    let size = 0;
    let overflowed = false;
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => {
      if (overflowed) return;
      size += chunk.length;
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
