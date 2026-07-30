// Endpoints HTTP do pool de Ecos do Veio.
//
// Vive fora de `ws.ts` pela mesma razão do ranking, e o POST daqui tem o MESMO
// perfil de risco do POST de lá: superfície não autenticada que aceita um corpo
// grande e gasta CPU proporcional a ele, no processo que roda o tick autoritativo
// a 20 Hz. Todo controle deste arquivo existe por causa disso.
//
// A diferença em relação ao ranking é o volume esperado. Ranking recebe só runs
// que EXTRAÍRAM; o pool receberia toda morte de todo jogador, que é a maioria
// esmagadora das runs. Por isso existe a fração determinística — mas ela guarda
// STORAGE, não CPU. O que protege a CPU é o limite por origem mais o orçamento de
// uma re-simulação concorrente, e é assim que tem de ser: ver o comentário de
// `isDeathEchoSampled`.

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
 * Uma em quantas mortes verificadas entra no pool.
 *
 * A spec pedia "apenas uma amostra pode ser transmitida e validada", e a primeira
 * versão disto rodava ANTES da re-simulação, sobre o comprimento e o começo do
 * Base64 cru. Aquilo era grátis de burlar: o cliente anexava blocos de comando
 * válidos DEPOIS do tick terminal até cair num comprimento que passasse. A
 * re-simulação para no tick terminal e a canonicalização apaga a cauda, então
 * todas as variantes davam a mesma morte e o mesmo digest — o portão decidia
 * sobre bytes que não faziam parte da run.
 *
 * Agora ele decide sobre o DIGEST CANÔNICO, depois da verificação. A cauda não
 * muda o digest, então a fração deixa de ser esterçável de graça.
 *
 * O que ele NÃO é: proteção de CPU. Qualquer portão que o cliente consiga calcular
 * é moído por um cliente que simule localmente — e todo cliente simula, é a mesma
 * simulação. A CPU é protegida pelo limite por origem e pelo orçamento de uma
 * re-simulação concorrente, que não dependem de nada que o cliente escolha. Fingir
 * o contrário custaria a três quartos das mortes honestas a chance de virar
 * carcaça, em troca de uma barreira que se atravessa com padding.
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

/**
 * A run verificada entrou na amostra?
 *
 * Recebe o digest canônico — a identidade da run re-simulada — e não o corpo da
 * requisição. Mudar a resposta exige mudar a run de verdade.
 */
export const isDeathEchoSampled = (digest: string): boolean =>
  avalanche(deathEchoHash(`voxelyn.echo.sample:${digest}`)) % DEATH_ECHO_ACCEPT_ONE_IN === 0;

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
      // Semanal por padrão; `?cadence=daily` continua disponível para operação.
      const cadence = url.searchParams.get('cadence') === 'daily' ? 'daily' : 'weekly';
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
      // A fração decide DEPOIS da verificação, sobre a identidade da run. Recusar
      // aqui não é erro: a run do jogador está inteira, ela apenas não foi
      // sorteada, e por isso `200` com `accepted: false` — o cliente não deve
      // tentar de novo nem avisar ninguém.
      if (!isDeathEchoSampled(verdict.digest)) {
        opts.log({ ev: 'echo_unsampled', ip, seed, ms: elapsed });
        json(res, 200, { accepted: false, reason: 'fora da amostra' });
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
