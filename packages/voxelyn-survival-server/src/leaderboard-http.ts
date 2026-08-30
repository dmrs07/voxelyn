// Endpoints HTTP do ranking.
//
// Vive fora de `ws.ts` porque tem um perfil de risco completamente diferente do
// resto do servidor: e a unica superficie que aceita um corpo grande de um
// cliente nao autenticado E gasta CPU proporcional a ele. Todo controle deste
// arquivo existe por causa disso, e nao por formalidade.

import type { IncomingMessage, ServerResponse } from 'node:http';
import type { PlayerTuning, RunDepthConfig } from '@voxelyn/survival-sim';
import {
  LEGACY_SECTOR_COUNT,
  type LeaderboardClass,
  type LeaderboardMode,
  type LeaderboardStore,
} from './leaderboard.js';
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

/**
 * A configuracao sob a qual uma run foi AUTORIZADA a rodar.
 *
 * O que o servidor guardou quando emitiu o ticket: com quais atributos e com
 * quantos setores aqueles comandos tem direito de ser re-simulados.
 */
export type AuthorizedRunConfig = {
  seed: number;
  tuning?: PlayerTuning;
  depth?: RunDepthConfig;
};

export type LeaderboardHttpOptions = {
  store: LeaderboardStore;
  log: (line: Record<string, unknown>) => void;
  allowedOrigins?: string[];
  /** Quantos proxies imediatamente a frente da aplicacao sao confiaveis. */
  trustedProxyHops?: number;
  /** Orcamento de re-simulacao, compartilhado com o pool de ecos. */
  budget?: VerificationBudget;
  /**
   * Resolve o `runId` da submissao para a configuracao que o servidor autorizou.
   *
   * Este parametro e o que torna o ranking por classe POSSIVEL sem entregar a
   * classe ao cliente. O jogador nao declara "minha run tinha sete setores": ele
   * manda o identificador de um ticket que ESTE servidor emitiu, e a
   * profundidade sai de la. Nao ha campo para inflar a propria classe, do mesmo
   * jeito que nunca houve campo para inflar as estrelas.
   *
   * Ausente (ou devolvendo null: ticket vencido, servidor sem progressao, run
   * offline) cai em G-00 de fabrica — tres setores, sem protocolo —, que
   * continua sendo o que toda run sem ticket sempre foi.
   */
  runConfig?: (runId: string) => Promise<AuthorizedRunConfig | null>;
};

/** Teto do identificador de ticket aceito no corpo. UUID cabe com folga. */
const MAX_RUN_ID_LENGTH = 64;

/**
 * Qual livro abrir quando o cliente nao pediu nenhum.
 *
 * O MAIS RASO que existe, e nao o mais fundo nem o do perfil de quem pergunta:
 * e o livro que todo jogador pode ler tendo jogado o que ja jogou. Abrir no de
 * sete setores mostraria a um recem-chegado um placar em que ele nao pode
 * entrar, e o convite do ranking e "isto e alcancavel", nao "isto e de outros".
 */
const defaultClass = (classes: LeaderboardClass[]): number =>
  classes[0]?.sectorCount ?? LEGACY_SECTOR_COUNT;

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
      const sectorsParam = url.searchParams.get('sectors');
      const seed = seedParam === null ? undefined : Number(seedParam);
      if (seed !== undefined && !Number.isInteger(seed)) {
        json(res, 400, { error: 'seed invalida' });
        return true;
      }
      const sectors = sectorsParam === null ? undefined : Number(sectorsParam);
      if (sectors !== undefined && (!Number.isInteger(sectors) || sectors < 1)) {
        json(res, 400, { error: 'classe invalida' });
        return true;
      }
      const filter = {
        seed,
        mode:
          modeParam === 'solo' || modeParam === 'coop' ? (modeParam as LeaderboardMode) : undefined,
      };
      // Os livros que existem sao lidos ANTES da lista, e nao ao lado dela: a
      // classe pedida pode nao ter nenhuma run, e sem esta consulta o cliente
      // receberia uma lista vazia sem nada que explique qual livro ele deveria
      // ter aberto.
      const classes = await opts.store.classes(filter);
      const sectorCount = sectors ?? defaultClass(classes);
      // Sempre COM classe. O placar por classe nao e uma preferencia de leitura
      // — e a regra —, e uma consulta sem `sectorCount` misturaria descidas de
      // tres e de sete setores no mesmo livro, que e exatamente o que ele
      // existe para impedir.
      const entries = await opts.store.top({
        ...filter,
        sectorCount,
        limit: Number(url.searchParams.get('limit') ?? '') || undefined,
      });
      json(res, 200, { sectorCount, classes, entries });
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

    let payload: { seed?: unknown; log?: unknown; name?: unknown; runId?: unknown };
    try {
      payload = JSON.parse(raw) as typeof payload;
    } catch {
      json(res, 400, { error: 'corpo nao e JSON valido' });
      return true;
    }

    const log = typeof payload.log === 'string' ? payload.log : '';
    const name = sanitizeName(payload.name);
    const runId =
      typeof payload.runId === 'string' && payload.runId.length > 0
        ? payload.runId.slice(0, MAX_RUN_ID_LENGTH)
        : null;

    // A configuracao autorizada e resolvida ANTES de reservar o orcamento: e
    // uma leitura barata de banco, e reservar antes dela seguraria a vaga de
    // re-simulacao durante uma consulta que pode nem terminar em replay.
    //
    // Falha de leitura NAO derruba a submissao: ela cai no caminho de fabrica,
    // do mesmo jeito que uma run sem ticket. O banco de progressao fora do ar
    // ja custa a recompensa da run; custar tambem a entrada no ranking seria
    // uma indisponibilidade virando duas.
    let authorized: AuthorizedRunConfig | null = null;
    if (runId && opts.runConfig) {
      try {
        authorized = await opts.runConfig(runId);
      } catch (err) {
        opts.log({
          ev: 'leaderboard_run_config_failed',
          runId,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
    // A seed vem do TICKET quando ha ticket. O corpo so responde por ela na run
    // sem autorizacao (offline, servidor sem progressao) — e ali ela nao decide
    // nada alem de qual mundo foi sorteado.
    const seed = authorized ? authorized.seed : Number(payload.seed);

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
      const verdict = verifySoloRun(seed, log, authorized?.tuning, authorized?.depth);
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
        cores: verdict.summary.cores,
        sectors: verdict.summary.sectorCount,
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
