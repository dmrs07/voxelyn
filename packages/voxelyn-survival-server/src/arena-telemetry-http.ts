// Endpoints da telemetria da Arena de Chefes — rota, corpo e digest PROPRIOS,
// nunca compartilhados com `/telemetry` (ver arena-telemetry.ts para o porque).
//
// Mesmo perfil de risco do endpoint de campanha: corpo minusculo, volume alto,
// dado nao verificado. Os controles aqui sao contra inundacao e lixo, nao
// contra fraude — um testador que inventa um resultado so engana o proprio
// digest que ele mesmo vai ler depois.
import type { IncomingMessage, ServerResponse } from 'node:http';
import { SubmissionRateLimiter, readJsonBody, requestRateLimitKey,
  operatorTokenMatches,
} from './http-util.js';
import type { ArenaOutcome, ArenaTelemetryEvent, ArenaTelemetryStore } from './arena-telemetry.js';

/** Corpo maximo. Um evento cabe em ~500 bytes (o loadout e a parte variavel). */
const MAX_BODY_BYTES = 4 * 1024;

/** Janela e teto por origem. Generoso: uma luta de arena gera UM evento. */
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 40;

const MAX_DIGEST_ROWS = 50_000;
const DEFAULT_DIGEST_ROWS = 5_000;

const OUTCOMES: readonly ArenaOutcome[] = ['boss_killed', 'player_dead', 'abandoned'];

export type ArenaTelemetryHttpOptions = {
  store: ArenaTelemetryStore;
  log: (line: Record<string, unknown>) => void;
  allowedOrigins?: string[];
  trustedProxyHops?: number;
  /** Token para ler o digest. Sem ele, a rota de leitura fica FECHADA. */
  digestToken?: string;
};

const clampInt = (value: unknown, min: number, max: number, fallback = 0): number => {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.round(n)));
};

const clampString = (value: unknown, maxLength: number, fallback = ''): string =>
  typeof value === 'string' ? value.slice(0, maxLength) : fallback;

/** Teto de itens do loadout: mais que os 6 modulos que existem hoje e lixo. */
const MAX_MODULES = 12;

/**
 * Converte corpo cru em evento, com todo campo dentro de faixa.
 *
 * Devolve `null` so quando o evento nao identifica NEM chefe nem seed — sem
 * os dois nao ha o que agregar. O resto e clampado, nunca recusado: um
 * `boss` desconhecido ainda vira uma linha no digest (agrupada por aquele
 * texto), o que e mais honesto do que descartar o evento inteiro.
 */
export const sanitizeArenaEvent = (raw: unknown): ArenaTelemetryEvent | null => {
  if (typeof raw !== 'object' || raw === null) return null;
  const o = raw as Record<string, unknown>;

  const boss = clampString(o.boss, 64);
  if (boss.length === 0) return null;

  const outcome = OUTCOMES.includes(o.outcome as ArenaOutcome)
    ? (o.outcome as ArenaOutcome)
    : 'abandoned';

  const modules = Array.isArray(o.modules)
    ? o.modules
        .filter((m): m is string => typeof m === 'string')
        .slice(0, MAX_MODULES)
        .map((m) => m.slice(0, 32))
    : [];

  return {
    boss,
    seed: clampInt(o.seed, 0, 0xffffffff),
    generation: clampString(o.generation, 16, 'G-00'),
    sector: clampInt(o.sector, 1, 16, 1),
    startingHp: clampInt(o.startingHp, 1, 100_000),
    ability: clampString(o.ability, 32, 'pulse'),
    modules,
    tuningHash: clampString(o.tuningHash, 64),
    outcome,
    ticks: clampInt(o.ticks, 0, 60 * 60 * 20),
    hpRemaining: clampInt(o.hpRemaining, 0, 100_000),
    damageDealtTenths: clampInt(o.damageDealtTenths, 0, 10_000_000),
    damageTakenTenths: clampInt(o.damageTakenTenths, 0, 10_000_000),
    shots: clampInt(o.shots, 0, 1_000_000),
    kills: clampInt(o.kills, 0, 100_000),
    deathCause: typeof o.deathCause === 'string' ? o.deathCause.slice(0, 32) : null,
  };
};

export const createArenaTelemetryHandler = (opts: ArenaTelemetryHttpOptions) => {
  const limiter = new SubmissionRateLimiter({ windowMs: WINDOW_MS, maxPerWindow: MAX_PER_WINDOW });

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

  return async (req: IncomingMessage, res: ServerResponse): Promise<boolean> => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    if (!url.pathname.startsWith('/arena-telemetry')) return false;
    cors(req, res);

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return true;
    }

    if (req.method === 'GET') {
      if (!operatorTokenMatches(opts.digestToken, url, req)) {
        json(res, 404, { error: 'nao encontrado' });
        return true;
      }
      const limit = clampInt(
        url.searchParams.get('limit'),
        1,
        MAX_DIGEST_ROWS,
        DEFAULT_DIGEST_ROWS,
      );
      json(res, 200, await opts.store.digest(limit));
      return true;
    }

    if (req.method !== 'POST') {
      json(res, 405, { error: 'metodo nao suportado' });
      return true;
    }

    const origin = requestRateLimitKey(req, opts.trustedProxyHops ?? 0);
    if (limiter.check(origin, Date.now())) {
      // 204: o cliente nao deve reagir a isso — ver a mesma decisao em telemetry-http.ts.
      res.writeHead(204);
      res.end();
      return true;
    }

    const rawBody = await readJsonBody(req, MAX_BODY_BYTES);
    if (rawBody === null) {
      res.setHeader('connection', 'close');
      res.writeHead(413);
      res.end();
      req.destroy();
      return true;
    }

    let payload: { event?: unknown };
    try {
      payload = JSON.parse(rawBody) as typeof payload;
    } catch {
      json(res, 400, { error: 'corpo nao e JSON valido' });
      return true;
    }

    const event = sanitizeArenaEvent(payload.event);
    if (!event) {
      json(res, 400, { error: 'evento invalido' });
      return true;
    }

    try {
      await opts.store.record(event);
    } catch (err) {
      opts.log({
        ev: 'arena_telemetry_write_failed',
        error: err instanceof Error ? err.message : String(err),
      });
    }
    res.writeHead(204);
    res.end();
    return true;
  };
};
