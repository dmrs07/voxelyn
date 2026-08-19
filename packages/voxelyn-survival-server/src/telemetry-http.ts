// Endpoints de telemetria.
//
// Perfil de risco oposto ao do ranking: aqui o corpo e minusculo e o
// processamento e trivial, mas o VOLUME e alto (toda run de todo jogador,
// inclusive mortes e abandonos) e o dado nao e verificado. Os controles daqui
// existem contra inundacao e contra lixo, nao contra fraude — fraude em
// telemetria e um problema de interpretacao, nao de seguranca.
//
// Tudo que entra e SANEADO em vez de recusado, ate onde faz sentido. Recusar um
// evento por um campo estranho perderia o resto do evento, que era o que
// importava; e a diferenca entre um dado levemente sujo e um buraco no
// histograma.

import type { IncomingMessage, ServerResponse } from 'node:http';
import { DISCOVERY_MASK } from '@voxelyn/survival-sim';
import { SubmissionRateLimiter, readJsonBody, requestRateLimitKey,
  operatorTokenMatches,
} from './http-util.js';
import type { RunOutcome, TelemetryEvent, TelemetryStore } from './telemetry.js';

/** Corpo maximo. Um evento cabe em ~400 bytes; o resto e margem. */
const MAX_BODY_BYTES = 8 * 1024;

/** Janela e teto por origem. Generoso: uma run de 12 min gera UM evento. */
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 40;

/** Teto de linhas lidas por digest. */
const MAX_DIGEST_ROWS = 50_000;
const DEFAULT_DIGEST_ROWS = 5_000;

const OUTCOMES: readonly RunOutcome[] = ['dead', 'extracted', 'extracted_with_core', 'abandoned'];

export type TelemetryHttpOptions = {
  store: TelemetryStore;
  log: (line: Record<string, unknown>) => void;
  allowedOrigins?: string[];
  /**
   * Saltos de proxy confiaveis, igual ao ranking.
   *
   * Reusa `requestRateLimitKey` em vez de reler o cabecalho aqui: um cliente
   * pode PREPENDER valores em X-Forwarded-For, entao pegar o primeiro elemento
   * da lista da a ele um limite novo a cada requisicao. O bug e o mesmo nos dois
   * endpoints, e por isso a correcao mora num lugar so.
   */
  trustedProxyHops?: number;
  /**
   * Token para ler o digest. Sem ele, a rota de leitura fica FECHADA.
   *
   * O digest e diagnostico interno: expor taxa de abandono e funil de setor
   * publicamente entrega a concorrente (e a qualquer um) a saude do jogo. A
   * escrita e aberta porque precisa ser; a leitura nao precisa.
   */
  digestToken?: string;
};

/** Sanea um campo de BITS: fora da mascara e descartado, nunca saturado. */
const maskBits = (value: unknown, mask: number): number => {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n) & mask;
};

const clampInt = (value: unknown, min: number, max: number, fallback = 0): number => {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.round(n)));
};

/**
 * Converte corpo cru em evento, com todo campo dentro de faixa.
 *
 * Devolve null so quando o evento nao significa nada (sem sessao). Todo o resto
 * e clampado: um cliente que mande `ticks: 1e12` vira o teto, e nao um buraco
 * no histograma.
 */
export const sanitizeEvent = (raw: unknown, quality: unknown): TelemetryEvent | null => {
  if (typeof raw !== 'object' || raw === null) return null;
  const o = raw as Record<string, unknown>;

  const session = typeof o.session === 'string' ? o.session.slice(0, 40) : '';
  if (session.length < 4) return null;

  const outcome = OUTCOMES.includes(o.outcome as RunOutcome)
    ? (o.outcome as RunOutcome)
    : 'abandoned';

  const msSincePrev =
    o.msSincePreviousRun === null || o.msSincePreviousRun === undefined
      ? null
      : clampInt(o.msSincePreviousRun, 0, 24 * 60 * 60 * 1000);

  return {
    session,
    runIndex: clampInt(o.runIndex, 1, 10_000, 1),
    msSincePreviousRun: msSincePrev,
    outcome,
    sector: clampInt(o.sector, 1, 16, 1),
    ticks: clampInt(o.ticks, 0, 60 * 60 * 20),
    stars: clampInt(o.stars, 0, 3),
    contamination: Math.max(0, Math.min(1, Number(o.contamination) || 0)),
    deathCause: typeof o.deathCause === 'string' ? o.deathCause.slice(0, 32) : null,
    kills: clampInt(o.kills, 0, 100_000),
    shots: clampInt(o.shots, 0, 1_000_000),
    damageTakenTenths: clampInt(o.damageTakenTenths, 0, 10_000_000),
    damageDealtTenths: clampInt(o.damageDealtTenths, 0, 10_000_000),
    salvageCompleted: clampInt(o.salvageCompleted, 0, 1_000),
    modulesAcquired: clampInt(o.modulesAcquired, 0, 1_000),
    // MASCARA, e nao faixa. Prender por faixa satura: um valor acima do teto
    // vira o proprio teto, e saturar uma bitmask LIGA todos os bits abaixo — a
    // run que descobriu uma coisa era gravada como tendo descoberto dezesseis.
    // Mascarar descarta o que nao se reconhece, que e o unico jeito honesto de
    // sanear um campo de bits vindo de fora.
    discoveries: maskBits(o.discoveries, DISCOVERY_MASK),
    quality: typeof quality === 'string' ? quality.slice(0, 12) : null,
  };
};

export const createTelemetryHandler = (opts: TelemetryHttpOptions) => {
  // Limitador com coleta de origens ociosas: sem ela, um fluxo de visitantes
  // legitimos deixaria uma entrada permanente por IP ate o processo reiniciar.
  const limiter = new SubmissionRateLimiter({
    windowMs: WINDOW_MS,
    maxPerWindow: MAX_PER_WINDOW,
  });

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
    if (!url.pathname.startsWith('/telemetry')) return false;
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
      // 204 e nao 429: o cliente NAO deve reagir a isso de forma nenhuma, nem
      // com retry nem com aviso. Telemetria que fala com o jogador virou bug.
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

    let payload: { event?: unknown; quality?: unknown };
    try {
      payload = JSON.parse(rawBody) as typeof payload;
    } catch {
      json(res, 400, { error: 'corpo nao e JSON valido' });
      return true;
    }

    const event = sanitizeEvent(payload.event, payload.quality);
    if (!event) {
      json(res, 400, { error: 'evento invalido' });
      return true;
    }

    try {
      await opts.store.record(event);
    } catch (err) {
      // Falha de gravacao de telemetria NUNCA vira erro visivel: o jogo nao
      // depende disso, e um 500 aqui so ensinaria o cliente a insistir.
      opts.log({
        ev: 'telemetry_write_failed',
        error: err instanceof Error ? err.message : String(err),
      });
    }
    res.writeHead(204);
    res.end();
    return true;
  };
};
