// Endpoints HTTP do pool de Ecos do Veio.
//
// Vive fora de `ws.ts` pela mesma razão do ranking, e o POST daqui tem o MESMO
// perfil de risco do POST de lá: superfície não autenticada que aceita um corpo
// grande e gasta CPU proporcional a ele, no processo que roda o tick autoritativo
// a 20 Hz. Todo controle deste arquivo existe por causa disso.
//
// A diferença em relação ao ranking é o volume esperado. Ranking recebe só runs
// que EXTRAÍRAM; o pool receberia toda morte de todo jogador, que é a maioria
// esmagadora das runs. Por isso existe a fração determinística: o pool não precisa
// de todas as mortes, precisa de uma amostra — e re-simular todas seria pagar CPU
// autoritativa para guardar cápsulas que ninguém veria.

import type { IncomingMessage, ServerResponse } from 'node:http';
import { deathEchoContract, deathEchoHash } from '@voxelyn/survival-protocol';
import type { DeathEchoStore } from './death-echoes.js';
import { MAX_REPLAY_BYTES, verifySoloDeath } from './replay.js';
import {
  SubmissionRateLimiter,
  readJsonBody,
  requestRateLimitKey,
  type VerificationBudget,
} from './http-util.js';

/**
 * Uma em quantas mortes é aceita para verificação.
 *
 * A spec já previa isso: "apenas uma amostra pode ser transmitida e validada". O
 * portão é barato e roda ANTES da re-simulação, que é a única parte caríssima.
 *
 * Ele é derivado de seed + log, então não é escolha do cliente. Um cliente que
 * quisesse forçar aceitação teria de mudar o log — e um log diferente é uma run
 * diferente, que precisa mesmo assim re-simular até uma morte real. Variações de
 * padding não ajudam: o digest de dedupe vem do log CANÔNICO, então todas elas
 * colapsam na mesma entrada.
 */
export const DEATH_ECHO_ACCEPT_ONE_IN = 4;

/**
 * Finalizador do murmur3 sobre o hash FNV-1a.
 *
 * Não é enfeite. FNV-1a distribui mal os BITS BAIXOS, e `% 4` lê exatamente eles:
 * medido sobre logs de tamanho parecido, o portão aceitava 11% num conjunto e 31%
 * noutro em vez dos 25% pretendidos — a taxa de amostragem passaria a depender do
 * formato do log, e jogadores cujas runs caíssem no lado ruim da distribuição
 * nunca contribuiriam com uma carcaça. O finalizador espalha a entropia por todos
 * os 32 bits e a fração volta a ser a fração.
 */
const avalanche = (hash: number): number => {
  let h = hash;
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
};

export const isDeathEchoSampled = (seed: number, logBase64: string): boolean =>
  avalanche(deathEchoHash(`${seed >>> 0}:${logBase64.length}:${logBase64.slice(0, 64)}`)) %
    DEATH_ECHO_ACCEPT_ONE_IN === 0;

export type DeathEchoHttpOptions = {
  store: DeathEchoStore;
  log: (line: Record<string, unknown>) => void;
  allowedOrigins?: string[];
  trustedProxyHops?: number;
  budget: VerificationBudget;
  /** Injetável para teste; por padrão o relógio real. */
  now?: () => Date;
};

export const createDeathEchoHandler = (opts: DeathEchoHttpOptions) => {
  const limiter = new SubmissionRateLimiter();
  const now = opts.now ?? (() => new Date());

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

  /** Trata a requisicao; devolve false quando a rota nao e do pool. */
  return async (req: IncomingMessage, res: ServerResponse): Promise<boolean> => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    if (!url.pathname.startsWith('/echoes')) return false;
    cors(req, res);

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return true;
    }

    // O contrato é função pura do calendário: não toca o banco, não tem corpo e
    // pode ser cacheado. Por isso vem antes de qualquer outra coisa.
    if (url.pathname === '/echoes/contract') {
      if (req.method !== 'GET') {
        json(res, 405, { error: 'metodo nao suportado' });
        return true;
      }
      const cadence = url.searchParams.get('cadence') === 'weekly' ? 'weekly' : 'daily';
      json(res, 200, { contract: deathEchoContract(now(), cadence) });
      return true;
    }

    if (req.method === 'GET') {
      const sector = Number(url.searchParams.get('sector') ?? '');
      if (!Number.isInteger(sector) || sector < 1 || sector > 32) {
        json(res, 400, { error: 'setor invalido' });
        return true;
      }
      const seedParam = url.searchParams.get('seed');
      const seed = seedParam === null ? undefined : Number(seedParam);
      if (seed !== undefined && (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff)) {
        json(res, 400, { error: 'seed invalida' });
        return true;
      }
      const echoes = await opts.store.sample({
        sector,
        seed,
        limit: Number(url.searchParams.get('limit') ?? '') || undefined,
      });
      json(res, 200, { echoes });
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
    // Recusa ANTES de ler o corpo, como o ranking. A reserva de verdade fica
    // colada ao `try`, mais abaixo.
    if (opts.budget.busy()) {
      json(res, 503, { error: 'verificacao ocupada; tente de novo' });
      return true;
    }

    const raw = await readJsonBody(req, MAX_REPLAY_BYTES + 4096);
    if (raw === null) {
      res.setHeader('connection', 'close');
      json(res, 413, { error: 'corpo excede o tamanho maximo' });
      req.destroy();
      return true;
    }

    let payload: { seed?: unknown; log?: unknown };
    try {
      payload = JSON.parse(raw) as typeof payload;
    } catch {
      json(res, 400, { error: 'corpo nao e JSON valido' });
      return true;
    }

    const seed = Number(payload.seed);
    const logBase64 = typeof payload.log === 'string' ? payload.log : '';

    // A fração vem ANTES do orçamento de CPU e antes da re-simulação: recusar por
    // amostragem é a resposta mais barata que existe, e ela não é um erro. `200`
    // com `accepted: false` porque o cliente não deve tentar de novo nem avisar o
    // jogador — a run dele está inteira, ela apenas não foi sorteada.
    if (!isDeathEchoSampled(seed, logBase64)) {
      json(res, 200, { accepted: false, reason: 'fora da amostra' });
      return true;
    }

    if (!opts.budget.claim()) {
      json(res, 503, { error: 'verificacao ocupada; tente de novo' });
      return true;
    }
    try {
      const started = Date.now();
      const verdict = verifySoloDeath(seed, logBase64);
      const elapsed = Date.now() - started;
      if (!verdict.ok) {
        opts.log({ ev: 'echo_rejected', ip, seed, reason: verdict.reason, ms: elapsed });
        json(res, 422, { error: verdict.reason });
        return true;
      }
      const stored = await opts.store.record({
        capsule: verdict.capsule,
        origin: 'solo',
        sourceDigest: verdict.digest,
      });
      opts.log({
        ev: 'echo_accepted',
        ip,
        seed,
        sector: verdict.capsule.sector,
        ticks: verdict.capsule.ticks,
        ms: elapsed,
        stored,
      });
      // `accepted: true` mesmo quando `stored` é false: reenviar não é erro (a
      // rede pode ter caído depois do POST) e a cápsula já está no pool.
      json(res, 200, { accepted: true, stored });
      return true;
    } finally {
      opts.budget.release();
    }
  };
};
