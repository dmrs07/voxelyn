// Os endpoints da Matriz Geracional.
//
//   POST /api/progression/session          cria (ou confirma) a sessao anonima
//   GET  /api/progression/profile          o perfil autoritativo
//   POST /api/progression/runs             emite o ticket de uma expedicao
//   POST /api/progression/runs/:id/settle  liquida por RE-SIMULACAO
//   POST /api/progression/upgrades/:id/purchase
//   GET  /api/progression/codex            o que este perfil pode ler
//
// Mesmo perfil de risco do ranking, e mesmas protecoes: teto de corpo antes de
// ler, orcamento de re-simulacao COMPARTILHADO (o event loop que verifica e o
// mesmo que roda o tick autoritativo a 20 Hz), rate limit por origem, e JSON
// invalido tratado como recusa e nao como excecao.
//
// A regra que o arquivo inteiro serve: nada que o cliente escreve vira verdade.
// A rota le o ticket do BANCO, re-simula com o tuning do TICKET, e credita o que
// a simulacao decidiu. Os campos de `IGNORED_CLIENT_CLAIMS` podem chegar no
// corpo; eles nunca sao lidos.

import type { IncomingMessage, ServerResponse } from 'node:http';
import { randomUUID } from 'node:crypto';
import {
  MAX_PURCHASE_BODY_BYTES,
  RUN_TICKET_TTL_MS,
  isRewardEligibleMode,
  isValidIdempotencyKey,
  PROTOCOL_VERSION,
  SIMULATION_VERSION,
  type CodexResponse,
  type ProgressionErrorCode,
  type ProgressionRunTicket,
  type PublicLoreFragment,
  type RunMode,
} from '@voxelyn/survival-protocol';
import { hashPlayerTuning } from '@voxelyn/survival-sim';
import {
  SubmissionRateLimiter,
  createVerificationBudget,
  readJsonBody,
  requestRateLimitKey,
  type VerificationBudget,
} from './http-util.js';
import { MAX_REPLAY_BYTES, resimulateRun } from './replay.js';
import { publicProfile, tuningForProfile, type StoredProfile } from './progression.js';
import type { ProgressionStore } from './progression-store.js';
import { createSessionAuth, readSessionToken, type SessionAuth } from './progression-auth.js';
import {
  findLoreFragment,
  LORE_FRAGMENTS,
  maskCode,
  toPublicFragment,
  TOTAL_LORE_FRAGMENTS,
} from './progression-lore.js';
import { isLoreLocale, type LoreLocale } from './progression-lore-text.js';

export type ProgressionHttpOptions = {
  store: ProgressionStore;
  log: (line: Record<string, unknown>) => void;
  secret: string;
  allowedOrigins?: string[];
  trustedProxyHops?: number;
  /** Compartilhado com ranking e pool de ecos: uma re-simulacao por vez. */
  budget?: VerificationBudget;
  /** Semente das expedicoes. Injetavel para o teste nao depender de sorte. */
  seedFactory?: () => number;
  nowMs?: () => number;
  /**
   * Tetos por origem. Injetaveis para o teste exercitar a ROTA e nao o limite,
   * que ja tem testes proprios em `http-util`.
   */
  rateLimits?: { settlePerMinute?: number; readsPerMinute?: number };
};

const STATUS_BY_ERROR: Record<ProgressionErrorCode, number> = {
  unauthenticated: 401,
  profile_version_conflict: 409,
  unknown_upgrade: 404,
  already_owned: 409,
  missing_prerequisite: 409,
  insufficient_ore: 402,
  insufficient_cores: 402,
  ticket_not_found: 404,
  ticket_expired: 410,
  ticket_foreign: 403,
  mode_not_eligible: 422,
  replay_rejected: 422,
  tuning_mismatch: 409,
  version_mismatch: 426,
  payload_too_large: 413,
  busy: 503,
  rate_limited: 429,
  internal: 500,
};

export const createProgressionHandler = (opts: ProgressionHttpOptions) => {
  /**
   * DOIS limites, e nao um.
   *
   * O do ranking e apertado porque cada POST de la custa uma re-simulacao. Aqui
   * so a liquidacao custa isso; sessao, perfil, ticket e codex sao leituras
   * baratas — e uma run inteira ja consome duas chamadas (ticket + settle), o
   * que estouraria um teto de seis por minuto em tres partidas curtas.
   *
   * Herdar o limite do ranking teria sido "seguro" no papel e, na pratica, um
   * jogador que joga rapido demais recebendo 429 no meio da campanha.
   */
  const settleLimiter = new SubmissionRateLimiter({
    maxPerWindow: opts.rateLimits?.settlePerMinute ?? 12,
  });
  const readLimiter = new SubmissionRateLimiter({
    maxPerWindow: opts.rateLimits?.readsPerMinute ?? 60,
  });
  const budget = opts.budget ?? createVerificationBudget();
  const auth: SessionAuth = createSessionAuth(opts.secret);
  const nowMs = opts.nowMs ?? (() => Date.now());
  const randomSeed = opts.seedFactory ?? (() => (Math.random() * 0xffffffff) >>> 0);

  const cors = (req: IncomingMessage, res: ServerResponse): void => {
    const origin = req.headers.origin;
    if (origin && (!opts.allowedOrigins || opts.allowedOrigins.includes(origin))) {
      res.setHeader('access-control-allow-origin', origin);
      // Sem isto o navegador descarta o Set-Cookie e o jogador nunca tem sessao.
      res.setHeader('access-control-allow-credentials', 'true');
      res.setHeader('vary', 'origin');
    }
    res.setHeader('access-control-allow-methods', 'GET, POST, OPTIONS');
    // `authorization` na allowlist: sem ele o preflight recusa o header que
    // carrega a sessao justamente nos navegadores em que o cookie nao chega.
    res.setHeader('access-control-allow-headers', 'content-type, authorization');
  };

  const json = (res: ServerResponse, status: number, body: unknown): void => {
    res.writeHead(status, { 'content-type': 'application/json' });
    res.end(JSON.stringify(body));
  };

  const fail = (res: ServerResponse, error: ProgressionErrorCode, detail?: string): void =>
    json(res, STATUS_BY_ERROR[error], { error, ...(detail ? { detail } : {}) });

  /** Resolve o perfil da requisicao. Nunca cria: sessao e um POST explicito. */
  const authenticate = async (req: IncomingMessage): Promise<StoredProfile | null> => {
    // Cookie primeiro, `Authorization: Bearer` depois — ver `progression-auth.ts`.
    const token = readSessionToken(
      req.headers.cookie,
      Array.isArray(req.headers.authorization)
        ? req.headers.authorization[0]
        : req.headers.authorization,
    );
    const profileId = auth.verify(token, nowMs());
    if (!profileId) return null;
    return opts.store.getProfile(profileId);
  };

  const localeOf = (url: URL): LoreLocale => {
    const raw = url.searchParams.get('lang');
    return isLoreLocale(raw) ? raw : 'en';
  };

  const codexFor = (profile: StoredProfile, locale: LoreLocale): CodexResponse => {
    const unlocked = new Set(profile.unlockedLoreFragmentIds);
    const open: PublicLoreFragment[] = [];
    const locked: CodexResponse['locked'] = [];
    for (const fragment of LORE_FRAGMENTS) {
      if (unlocked.has(fragment.id)) {
        open.push(toPublicFragment(fragment, locale, unlocked));
      } else {
        // Nem o titulo viaja. O corpo de um documento bloqueado nao sai deste
        // processo — e por isso que "bloqueado" e uma afirmacao sobre bytes que
        // o cliente nunca recebeu, e nao sobre um `if` que ele poderia editar.
        locked.push({
          maskedCode: maskCode(fragment.documentCode),
          clearanceLevel: fragment.clearanceLevel,
          category: fragment.category,
        });
      }
    }
    open.sort((a, b) => a.chronologyIndex - b.chronologyIndex);
    return { unlocked: open, locked, total: TOTAL_LORE_FRAGMENTS };
  };

  return async (req: IncomingMessage, res: ServerResponse): Promise<boolean> => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    if (!url.pathname.startsWith('/api/progression')) return false;
    cors(req, res);

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return true;
    }

    const ip = requestRateLimitKey(req, opts.trustedProxyHops);
    const path = url.pathname.replace(/\/+$/, '');

    // -----------------------------------------------------------------------
    // Sessao
    // -----------------------------------------------------------------------
    if (path === '/api/progression/session' && req.method === 'POST') {
      if (readLimiter.check(ip, nowMs())) return (fail(res, 'rate_limited'), true);
      const existing = await authenticate(req);
      if (existing) {
        json(res, 200, { profile: publicProfile(existing) });
        return true;
      }
      const profileId = auth.newProfileId();
      const profile = await opts.store.createProfile(profileId, new Date(nowMs()).toISOString());
      const secure = (req.headers['x-forwarded-proto'] ?? '').toString().startsWith('https');
      const token = auth.issue(profileId, nowMs());
      res.setHeader('set-cookie', auth.cookieHeader(token, secure));
      opts.log({ ev: 'progression_session_created' });
      // O token vai TAMBEM no corpo. Onde o cookie chegar, o cliente nem olha
      // para ele; onde nao chegar — cookie de terceiros bloqueado —, e a unica
      // credencial que existe. Ver o cabecalho de `progression-auth.ts`.
      json(res, 201, { profile: publicProfile(profile), token });
      return true;
    }

    // -----------------------------------------------------------------------
    // Perfil e codex (leitura)
    // -----------------------------------------------------------------------
    // As TRES rotas de leitura passam pelo limitador.
    //
    // Elas ficaram de fora na primeira versao por parecerem baratas, e nao sao:
    // cada uma consulta o store, e o codex ainda serializa a colecao inteira de
    // documentos. Com uma sessao anonima — que qualquer script consegue num POST
    // — o teto configurado nao protegia justamente as rotas mais faceis de
    // repetir em laco.
    if (path === '/api/progression/profile' && req.method === 'GET') {
      if (readLimiter.check(ip, nowMs())) return (fail(res, 'rate_limited'), true);
      const profile = await authenticate(req);
      if (!profile) return (fail(res, 'unauthenticated'), true);
      json(res, 200, { profile: publicProfile(profile) });
      return true;
    }

    if (path === '/api/progression/codex' && req.method === 'GET') {
      if (readLimiter.check(ip, nowMs())) return (fail(res, 'rate_limited'), true);
      const profile = await authenticate(req);
      if (!profile) return (fail(res, 'unauthenticated'), true);
      json(res, 200, codexFor(profile, localeOf(url)));
      return true;
    }

    if (path.startsWith('/api/progression/codex/') && req.method === 'GET') {
      if (readLimiter.check(ip, nowMs())) return (fail(res, 'rate_limited'), true);
      const profile = await authenticate(req);
      if (!profile) return (fail(res, 'unauthenticated'), true);
      const id = decodeURIComponent(path.slice('/api/progression/codex/'.length));
      const fragment = findLoreFragment(id);
      // Documento inexistente e documento nao autorizado respondem IGUAL. A
      // diferenca so serviria para mapear o que existe antes de merecer.
      if (!fragment || !profile.unlockedLoreFragmentIds.includes(id)) {
        json(res, 404, { error: 'unknown_upgrade', detail: 'fragmento indisponivel' });
        return true;
      }
      json(res, 200, {
        fragment: toPublicFragment(
          fragment,
          localeOf(url),
          new Set(profile.unlockedLoreFragmentIds),
        ),
      });
      return true;
    }

    // -----------------------------------------------------------------------
    // Emissao de ticket
    // -----------------------------------------------------------------------
    if (path === '/api/progression/runs' && req.method === 'POST') {
      if (readLimiter.check(ip, nowMs())) return (fail(res, 'rate_limited'), true);
      const profile = await authenticate(req);
      if (!profile) return (fail(res, 'unauthenticated'), true);

      const raw = await readJsonBody(req, MAX_PURCHASE_BODY_BYTES);
      if (raw === null) return (fail(res, 'payload_too_large'), true);
      let body: { seed?: unknown; mode?: unknown } = {};
      if (raw.trim()) {
        try {
          body = JSON.parse(raw) as typeof body;
        } catch {
          return (json(res, 400, { error: 'internal', detail: 'json invalido' }), true);
        }
      }

      // O modo VEM do cliente e e VALIDADO aqui, em vez de ser inferido: um
      // cliente que peca `ranked` recebe um ticket nao elegivel e nao ganha
      // nada. O que ele nao consegue e o contrario — pedir `expedition` nao
      // basta, porque a recompensa sai do replay e nao do pedido.
      const mode: RunMode = body.mode === 'expedition' ? 'expedition' : 'ranked';
      if (!isRewardEligibleMode(mode)) return (fail(res, 'mode_not_eligible'), true);

      // A seed pode ser escolhida (a seed compartilhada e um recurso do jogo),
      // mas so como uint32 — e ela nao decide recompensa nenhuma sozinha.
      const requested = Number(body.seed);
      const seed =
        Number.isInteger(requested) && requested >= 0 && requested <= 0xffffffff
          ? requested >>> 0
          : randomSeed();

      // O TUNING SAI DO PERFIL, nunca do pedido.
      const tuning = tuningForProfile(profile);
      const issuedAt = nowMs();
      const ticket: ProgressionRunTicket = {
        runId: randomUUID(),
        profileId: profile.profileId,
        seed,
        mode,
        playerCount: 1,
        tuning,
        tuningHash: hashPlayerTuning(tuning),
        progressionProfileVersion: profile.profileVersion,
        protocolVersion: PROTOCOL_VERSION,
        simulationVersion: SIMULATION_VERSION,
        issuedAt: new Date(issuedAt).toISOString(),
        expiresAt: new Date(issuedAt + RUN_TICKET_TTL_MS).toISOString(),
        nonce: randomUUID(),
      };
      await opts.store.saveTicket(ticket);
      json(res, 201, { ticket });
      return true;
    }

    // -----------------------------------------------------------------------
    // Liquidacao
    // -----------------------------------------------------------------------
    const settleMatch = /^\/api\/progression\/runs\/([^/]+)\/settle$/.exec(path);
    if (settleMatch && req.method === 'POST') {
      if (settleLimiter.check(ip, nowMs())) return (fail(res, 'rate_limited'), true);
      const profile = await authenticate(req);
      if (!profile) return (fail(res, 'unauthenticated'), true);

      // Recusa ANTES de ler o corpo: ler meio megabyte para descartar em seguida
      // e exatamente o trabalho que o limite existe para evitar.
      if (budget.busy()) return (fail(res, 'busy'), true);

      const runId = decodeURIComponent(settleMatch[1]);
      const ticket = await opts.store.getTicket(runId);
      if (!ticket) return (fail(res, 'ticket_not_found'), true);
      if (ticket.profileId !== profile.profileId) return (fail(res, 'ticket_foreign'), true);
      if (Date.parse(ticket.expiresAt) <= nowMs()) return (fail(res, 'ticket_expired'), true);
      if (!isRewardEligibleMode(ticket.mode)) return (fail(res, 'mode_not_eligible'), true);
      if (
        ticket.protocolVersion !== PROTOCOL_VERSION ||
        ticket.simulationVersion !== SIMULATION_VERSION
      ) {
        // Uma run jogada contra outra versao da simulacao nao pode ser
        // re-simulada por esta: o resultado seria diferente, e diferente para
        // MENOS na maioria das vezes. Recusar e a resposta honesta.
        return (fail(res, 'version_mismatch'), true);
      }
      // O tuning guardado ainda e o que a arvore de hoje produziria para ele?
      // Divergencia aqui significa registro corrompido, nao trapaca — mas em
      // qualquer dos casos a run nao pode ser creditada contra um Prospector que
      // ninguem consegue reproduzir.
      if (hashPlayerTuning(ticket.tuning) !== ticket.tuningHash) {
        return (fail(res, 'tuning_mismatch'), true);
      }

      const raw = await readJsonBody(req, MAX_REPLAY_BYTES + 4096);
      if (raw === null) {
        res.setHeader('connection', 'close');
        fail(res, 'payload_too_large');
        req.destroy();
        return true;
      }
      let payload: { log?: unknown };
      try {
        payload = JSON.parse(raw) as typeof payload;
      } catch {
        return (json(res, 400, { error: 'internal', detail: 'json invalido' }), true);
      }
      const log = typeof payload.log === 'string' ? payload.log : '';

      if (!budget.claim()) return (fail(res, 'busy'), true);
      try {
        const started = nowMs();
        // AQUI esta a decisao inteira. Seed e tuning saem do ticket guardado no
        // servidor; do corpo veio so o que o jogador apertou.
        const run = resimulateRun(ticket.seed, log, ticket.tuning);
        const elapsed = nowMs() - started;
        if (!run.ok) {
          opts.log({
            ev: 'progression_replay_rejected',
            ip,
            runId,
            reason: run.reason,
            ms: elapsed,
          });
          return (fail(res, 'replay_rejected', run.reason), true);
        }
        const summary = run.state.summary;
        if (!summary || run.state.phase === 'running') {
          return (fail(res, 'replay_rejected', 'run nao terminal'), true);
        }

        const settled = await opts.store.settleRun({
          profileId: profile.profileId,
          runId,
          phase: summary.phase,
          // Do REPLAY, e nunca do corpo. Ver IGNORED_CLIENT_CLAIMS.
          cargoOre: summary.stats.oreCollected,
          seed: ticket.seed,
          simulationVersion: ticket.simulationVersion,
          durationTicks: summary.ticks,
          now: new Date(nowMs()).toISOString(),
          idFactory: () => randomUUID(),
        });
        if ('error' in settled) return (fail(res, settled.error), true);

        opts.log({
          ev: 'progression_settled',
          runId,
          phase: settled.phase,
          fresh: settled.fresh,
          ore: settled.reward.ore,
          cores: settled.reward.cores,
          ms: elapsed,
        });
        json(res, 200, {
          outcome: settled.fresh ? 'settled' : 'already_settled',
          runId,
          result: {
            phase: settled.phase,
            ticks: settled.durationTicks,
            cargoOre: settled.cargoOre,
            oreCredited: settled.reward.ore,
            coresCredited: settled.reward.cores,
            oreLost: settled.reward.lost,
          },
          profile: publicProfile(settled.profile),
        });
        return true;
      } finally {
        budget.release();
      }
    }

    // -----------------------------------------------------------------------
    // Compra
    // -----------------------------------------------------------------------
    const purchaseMatch = /^\/api\/progression\/upgrades\/([^/]+)\/purchase$/.exec(path);
    if (purchaseMatch && req.method === 'POST') {
      if (readLimiter.check(ip, nowMs())) return (fail(res, 'rate_limited'), true);
      const profile = await authenticate(req);
      if (!profile) return (fail(res, 'unauthenticated'), true);

      const raw = await readJsonBody(req, MAX_PURCHASE_BODY_BYTES);
      if (raw === null) return (fail(res, 'payload_too_large'), true);
      let body: { expectedProfileVersion?: unknown; idempotencyKey?: unknown };
      try {
        body = JSON.parse(raw || '{}') as typeof body;
      } catch {
        return (json(res, 400, { error: 'internal', detail: 'json invalido' }), true);
      }
      if (!isValidIdempotencyKey(body.idempotencyKey)) {
        return (json(res, 400, { error: 'internal', detail: 'idempotencyKey invalida' }), true);
      }
      const expected = Number(body.expectedProfileVersion);
      if (!Number.isInteger(expected)) {
        return (json(res, 400, { error: 'internal', detail: 'expectedProfileVersion' }), true);
      }

      // `oreCost`/`coreCost` podem ate ter vindo no corpo. Nao sao lidos: o
      // preco sai do catalogo compilado aqui dentro.
      const result = await opts.store.purchase({
        profileId: profile.profileId,
        upgradeId: decodeURIComponent(purchaseMatch[1]),
        expectedProfileVersion: expected,
        idempotencyKey: String(body.idempotencyKey),
        now: new Date(nowMs()).toISOString(),
        idFactory: () => randomUUID(),
      });
      if (!result.ok) return (fail(res, result.error), true);

      const fragment = findLoreFragment(result.loreFragmentId);
      opts.log({
        ev: 'progression_purchase',
        upgrade: result.upgradeId,
        replayed: result.replayed,
      });
      json(res, 200, {
        profile: publicProfile(result.profile),
        purchase: {
          upgradeId: result.upgradeId,
          oreSpent: result.oreSpent,
          coresSpent: result.coresSpent,
          generationBefore: publicProfile({
            ...result.profile,
            purchasedUpgradeIds: result.profile.purchasedUpgradeIds.filter(
              (id) => id !== result.upgradeId,
            ),
          }).generation,
          generationAfter: publicProfile(result.profile).generation,
        },
        unlockedLoreFragment: fragment
          ? toPublicFragment(
              fragment,
              localeOf(url),
              new Set(result.profile.unlockedLoreFragmentIds),
            )
          : null,
      });
      return true;
    }

    json(res, 404, { error: 'unknown_upgrade', detail: 'rota inexistente' });
    return true;
  };
};
