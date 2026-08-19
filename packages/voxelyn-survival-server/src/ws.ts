import { randomBytes } from 'node:crypto';
import {
  createServer,
  type IncomingMessage,
  type Server as HttpServer,
  type ServerResponse,
} from 'node:http';
import { WebSocketServer, type WebSocket } from 'ws';
import { LIMITS, buildDeathEchoCapsule, encodeMessage } from '@voxelyn/survival-protocol';
import { TICK_MS } from '@voxelyn/survival-sim';
import { SurvivalServer, type ServerOptions } from './server.js';
import { createLeaderboard, type LeaderboardStore } from './leaderboard.js';
import { createLeaderboardHandler } from './leaderboard-http.js';
import { createTelemetry, type TelemetryStore } from './telemetry.js';
import { createTelemetryHandler } from './telemetry-http.js';
import { createArenaTelemetry, type ArenaTelemetryStore } from './arena-telemetry.js';
import { createArenaTelemetryHandler } from './arena-telemetry-http.js';
import { createDeathEchoStore, type DeathEchoStore } from './death-echoes.js';
import { createDeathEchoHandler } from './death-echoes-http.js';
import { createProgressionStore, type ProgressionStore } from './progression-store.js';
import { createProgressionHandler } from './progression-http.js';
import { resolveProgressionSecret } from './progression-auth.js';
import { createDevlogStore } from './devlog.js';
import { createDevlogHandler } from './devlog-http.js';
import { createVerificationBudget } from './http-util.js';

export type WsServerHandle = {
  http: HttpServer;
  survival: SurvivalServer;
  /** Pronto quando os stores de ranking e telemetria terminaram de conectar. */
  ready: Promise<void>;
  leaderboard: () => LeaderboardStore | null;
  telemetry: () => TelemetryStore | null;
  arenaTelemetry: () => ArenaTelemetryStore | null;
  deathEchoes: () => DeathEchoStore | null;
  progression: () => ProgressionStore | null;
  close: () => Promise<void>;
};

export type WsOptions = ServerOptions & {
  port?: number;
  host?: string;
  allowedOrigins?: string[]; // CORS/origem restrita para wss
  /** URL do Postgres. Ausente = ranking e telemetria em memoria (dev e testes). */
  databaseUrl?: string;
  /** Quantos proxies imediatamente a frente da aplicacao podem definir XFF. */
  trustedProxyHops?: number;
  /** Token de leitura do digest de telemetria. Ausente = leitura fechada. */
  telemetryToken?: string;
  /** Token de leitura do digest da Arena de Chefes. Ausente = leitura fechada. */
  arenaTelemetryToken?: string;
  /** Segredo do HMAC das sessoes de progressao. Sem ele, sessao efemera + aviso. */
  progressionSecret?: string;
  /** Tetos por origem da rota de progressao. Ver `progression-http.ts`. */
  progressionRateLimits?: { settlePerMinute?: number; readsPerMinute?: number };
  /**
   * Token do console e do painel do devlog. Ausente = as duas rotas fechadas.
   *
   * Credencial de OPERADOR, e nao de leitor: quem a tem ve o material ainda
   * nao publicado e os mesmos digests que `TELEMETRY_TOKEN` protege.
   */
  devlogToken?: string;
};

/**
 * Adaptador de rede: HTTP (/healthz, /readyz) + WebSocket. Roda o loop
 * autoritativo a 20 Hz e transporta as mensagens do SurvivalServer.
 */
export const createWsServer = (opts: WsOptions = {}): WsServerHandle => {
  let leaderboardStore: LeaderboardStore | null = null;
  let deathEchoStore: DeathEchoStore | null = null;
  // UM orcamento de re-simulacao para o processo inteiro. Ranking e pool disputam
  // o mesmo event loop que roda o tick autoritativo a 20 Hz; um contador por rota
  // permitiria dois replays concorrentes e o dobro de engasgo na simulacao.
  const verificationBudget = createVerificationBudget();

  /**
   * Nonce desta instancia, para a identidade de uma morte de co-op ser unica.
   *
   * Sala, setor, tick e slot NAO bastam. `seedCounter` volta a zero em cada boot e
   * `baseSeed` e o mesmo, entao a primeira sala depois de dois deploys recebe a
   * mesma seed; um jogador parado morre de contaminacao no mesmo tick e no mesmo
   * slot, e a segunda morte — legitima — bate na restricao de unicidade e
   * desaparece do pool. Duas instancias com a mesma baseSeed tem o problema
   * identico. O nonce torna a identidade unica por processo sem precisar de estado
   * persistido.
   */
  const instanceNonce = randomBytes(6).toString('hex');

  const survival = new SurvivalServer({
    ...opts,
    // Runs de co-op nao passam por re-simulacao e nao precisam: elas foram
    // simuladas por ESTE processo a partir de intencoes validadas, e o
    // resultado ja e autoritativo no instante em que nasce.
    onRunFinished: (room) => {
      const summary = room.state.summary;
      if (!summary || summary.phase === 'dead' || !leaderboardStore) return;
      // Sala de um jogador so no online continua sendo 'coop' de modo: o que
      // separa os dois rankings nao e quantas pessoas jogaram, e QUEM simulou.
      void leaderboardStore
        .submit({ name: `sala ${room.code}`, mode: 'coop', summary, digest: null })
        .catch((err: unknown) =>
          log({
            ev: 'leaderboard_submit_failed',
            error: err instanceof Error ? err.message : String(err),
          }),
        );
    },
    // Capturado no MESMO tick da morte, e nao no fim da run: `descend` reposiciona
    // inclusive os mortos, e uma captura tardia colocaria o corpo de quem morreu no
    // setor 1 na entrada do setor 3.
    onPlayerDeath: (room, death) => {
      if (!deathEchoStore) return;
      // Anonimo por construcao: nonce da instancia, sala, setor, tick e slot. Nada
      // aqui identifica uma pessoa, e o serial que o jogador le sai deste id.
      const identity = `coop:${instanceNonce}:${room.seed}:${death.sector}:${death.tick}:${death.slot}`;
      const capsule = buildDeathEchoCapsule(room.state, {
        id: identity,
        x: death.x,
        y: death.y,
        facingX: death.facingX,
        facingY: death.facingY,
        cause: death.cause,
        ticks: death.tick,
        // Sem rastro no co-op. Reconstrui-lo exigiria amostrar a posicao de cada
        // slot a cada dois ticks dentro do laco autoritativo, e o holograma nao
        // vale custo no caminho que roda a 20 Hz para todas as salas. O que o
        // co-op contribui e a associacao causa<->posicao, que e a parte que o
        // cliente nao consegue provar sozinho.
      });
      void deathEchoStore
        .record({ capsule, origin: 'coop', sourceDigest: identity })
        .catch((err: unknown) =>
          log({
            ev: 'death_echo_record_failed',
            error: err instanceof Error ? err.message : String(err),
          }),
        );
    },
  });
  const log = opts.logger ?? ((line) => console.log(JSON.stringify(line)));
  let ready = true;
  let draining = false;

  let telemetryStore: TelemetryStore | null = null;
  let arenaTelemetryStore: ArenaTelemetryStore | null = null;
  let handleLeaderboard: ((req: IncomingMessage, res: ServerResponse) => Promise<boolean>) | null =
    null;
  let handleTelemetry: ((req: IncomingMessage, res: ServerResponse) => Promise<boolean>) | null =
    null;
  let handleArenaTelemetry:
    | ((req: IncomingMessage, res: ServerResponse) => Promise<boolean>)
    | null = null;
  let handleDeathEchoes: ((req: IncomingMessage, res: ServerResponse) => Promise<boolean>) | null =
    null;
  let progressionStore: ProgressionStore | null = null;
  let handleProgression: ((req: IncomingMessage, res: ServerResponse) => Promise<boolean>) | null =
    null;

  // O devlog le do DISCO, nao do banco, entao esta pronto antes de qualquer
  // conexao — nao entra na corrida assincrona abaixo. Os digests, esses sim,
  // sao lidos por funcao: quando o painel abre antes de o Postgres conectar,
  // ele mostra "indisponivel" em vez de segurar a resposta.
  const handleDevlog = createDevlogHandler({
    store: createDevlogStore(undefined, log),
    log,
    trustedProxyHops: opts.trustedProxyHops,
    operatorToken: opts.devlogToken ?? process.env.DEVLOG_TOKEN,
    telemetry: () => telemetryStore,
    arenaTelemetry: () => arenaTelemetryStore,
  });

  // A conexao com o banco e assincrona; o servidor NAO espera por ela para
  // aceitar jogo. Ate o store existir, as rotas de ranking respondem 503 e o
  // resto do jogo funciona normalmente — indisponibilidade do ranking nao pode
  // virar indisponibilidade do jogo.
  const databaseUrl = opts.databaseUrl ?? process.env.DATABASE_URL;
  const leaderboardReady = Promise.all([
    createLeaderboard(databaseUrl, log).then((store) => {
      leaderboardStore = store;
      handleLeaderboard = createLeaderboardHandler({
        store,
        log,
        allowedOrigins: opts.allowedOrigins,
        trustedProxyHops: opts.trustedProxyHops,
        budget: verificationBudget,
      });
    }),
    createDeathEchoStore(databaseUrl, log).then((store) => {
      deathEchoStore = store;
      handleDeathEchoes = createDeathEchoHandler({
        store,
        log,
        allowedOrigins: opts.allowedOrigins,
        trustedProxyHops: opts.trustedProxyHops,
        budget: verificationBudget,
      });
    }),
    createProgressionStore(databaseUrl, log).then((store) => {
      progressionStore = store;
      handleProgression = createProgressionHandler({
        store,
        log,
        secret: resolveProgressionSecret(
          opts.progressionSecret ?? process.env.PROGRESSION_SECRET,
          log,
        ),
        allowedOrigins: opts.allowedOrigins,
        trustedProxyHops: opts.trustedProxyHops,
        // O digest de leitura de lore usa o MESMO token dos outros digests: e
        // a mesma classe de dado (agregado, sem PII) e quem opera o painel ja
        // tem esse segredo em maos.
        digestToken: opts.telemetryToken ?? process.env.TELEMETRY_TOKEN,
        // MESMO orcamento do ranking e do pool: os tres re-simulam contra o
        // event loop que roda o tick autoritativo. Tres orcamentos de um
        // significariam tres replays concorrentes.
        budget: verificationBudget,
        rateLimits: opts.progressionRateLimits,
      });
    }),
    createTelemetry(databaseUrl, log).then((store) => {
      telemetryStore = store;
      handleTelemetry = createTelemetryHandler({
        store,
        log,
        allowedOrigins: opts.allowedOrigins,
        // MESMA contagem de saltos confiaveis do ranking: a telemetria tem o
        // proprio limite por origem e herdaria a mesma falha de confiar num
        // X-Forwarded-For que o cliente pode prepender.
        trustedProxyHops: opts.trustedProxyHops,
        digestToken: opts.telemetryToken ?? process.env.TELEMETRY_TOKEN,
      });
    }),
    createArenaTelemetry(databaseUrl, log).then((store) => {
      arenaTelemetryStore = store;
      handleArenaTelemetry = createArenaTelemetryHandler({
        store,
        log,
        allowedOrigins: opts.allowedOrigins,
        trustedProxyHops: opts.trustedProxyHops,
        digestToken: opts.arenaTelemetryToken ?? process.env.ARENA_TELEMETRY_TOKEN,
      });
    }),
  ]).then(() => undefined);

  const http = createServer((req: IncomingMessage, res: ServerResponse) => {
    if (req.url?.startsWith('/telemetry')) {
      // Telemetria indisponivel responde 204 e nao 503: o cliente nao deve
      // reagir, nem com retry nem com aviso. Diagnostico que atrapalha o jogo
      // deixou de ser diagnostico.
      if (!handleTelemetry) {
        res.writeHead(204);
        res.end();
        return;
      }
      void handleTelemetry(req, res).catch((err: unknown) => {
        log({ ev: 'telemetry_error', error: err instanceof Error ? err.message : String(err) });
        if (!res.headersSent) {
          res.writeHead(204);
          res.end();
        }
      });
      return;
    }
    if (req.url?.startsWith('/arena-telemetry')) {
      // Mesma politica de indisponibilidade da telemetria de campanha: 204,
      // nunca 503 — a Arena nao deve reagir a isso de forma nenhuma.
      if (!handleArenaTelemetry) {
        res.writeHead(204);
        res.end();
        return;
      }
      void handleArenaTelemetry(req, res).catch((err: unknown) => {
        log({
          ev: 'arena_telemetry_error',
          error: err instanceof Error ? err.message : String(err),
        });
        if (!res.headersSent) {
          res.writeHead(204);
          res.end();
        }
      });
      return;
    }
    if (req.url?.startsWith('/echoes')) {
      // Pool indisponivel responde 503 como o ranking, e nao 204: o cliente TEM
      // um caminho de retry sensato (a proxima descida) e trata lista vazia como
      // estado normal, entao vale dizer a verdade sobre o servidor.
      if (!handleDeathEchoes) {
        res.writeHead(503, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ error: 'pool de ecos ainda inicializando' }));
        return;
      }
      void handleDeathEchoes(req, res).catch((err: unknown) => {
        log({ ev: 'death_echo_error', error: err instanceof Error ? err.message : String(err) });
        if (!res.headersSent) {
          res.writeHead(500, { 'content-type': 'application/json' });
          res.end(JSON.stringify({ error: 'erro interno' }));
        }
      });
      return;
    }
    if (req.url?.startsWith('/api/progression')) {
      // 503 como o ranking, e nao 204: o cliente TEM um caminho de retry sensato
      // (a simulacao local, e uma nova tentativa depois) e precisa saber que a
      // expedicao nao vai render nada agora.
      if (!handleProgression) {
        res.writeHead(503, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ error: 'busy', detail: 'progressao inicializando' }));
        return;
      }
      void handleProgression(req, res).catch((err: unknown) => {
        log({ ev: 'progression_error', error: err instanceof Error ? err.message : String(err) });
        if (!res.headersSent) {
          res.writeHead(500, { 'content-type': 'application/json' });
          res.end(JSON.stringify({ error: 'internal' }));
        }
      });
      return;
    }
    if (req.url?.startsWith('/leaderboard')) {
      if (!handleLeaderboard) {
        res.writeHead(503, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ error: 'ranking ainda inicializando' }));
        return;
      }
      void handleLeaderboard(req, res).catch((err: unknown) => {
        log({ ev: 'leaderboard_error', error: err instanceof Error ? err.message : String(err) });
        if (!res.headersSent) {
          res.writeHead(500, { 'content-type': 'application/json' });
          res.end(JSON.stringify({ error: 'erro interno' }));
        }
      });
      return;
    }
    if (req.url?.startsWith('/devlog')) {
      void handleDevlog(req, res).catch((err: unknown) => {
        log({ ev: 'devlog_error', error: err instanceof Error ? err.message : String(err) });
        if (!res.headersSent) {
          res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
          res.end('erro interno');
        }
      });
      return;
    }
    if (req.url === '/healthz') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(
        JSON.stringify({
          ok: true,
          rooms: survival.roomCount(),
          conns: survival.connectionCount(),
        }),
      );
      return;
    }
    if (req.url === '/readyz') {
      res.writeHead(ready && !draining ? 200 : 503, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ ready: ready && !draining }));
      return;
    }
    res.writeHead(404);
    res.end();
  });

  // maxPayload no TRANSPORTE: sem ele o ws monta o frame inteiro e converte
  // para UTF-8 antes de qualquer checagem, e um peer nao autenticado poderia
  // forcar o servidor a bufferizar frames muito maiores que o limite anunciado.
  const wss = new WebSocketServer({ server: http, maxPayload: LIMITS.maxClientMessageBytes });
  const sockets = new Map<string, WebSocket>();
  let nextId = 1;

  const send = (clientId: string, raw: string): void => {
    const ws = sockets.get(clientId);
    if (ws && ws.readyState === ws.OPEN) ws.send(raw);
  };

  wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
    if (draining) {
      ws.close(1013, 'server draining');
      return;
    }
    const origin = req.headers.origin;
    if (opts.allowedOrigins && origin && !opts.allowedOrigins.includes(origin)) {
      ws.close(1008, 'origem nao permitida');
      return;
    }
    const clientId = `c${nextId++}`;
    sockets.set(clientId, ws);
    survival.addConnection(clientId, Date.now());
    log({ ev: 'ws_open', clientId });

    ws.on('message', (data) => {
      const raw = typeof data === 'string' ? data : data.toString('utf8');
      const replies = survival.handleMessage(clientId, raw, Date.now());
      for (const r of replies) send(r.clientId, encodeMessage(r.msg));
    });
    ws.on('close', () => {
      sockets.delete(clientId);
      survival.removeConnection(clientId);
      log({ ev: 'ws_close', clientId });
    });
    ws.on('error', () => ws.close());
  });

  // loop autoritativo a 20 Hz
  const loop = setInterval(() => {
    const outbound = survival.tick();
    for (const o of outbound) send(o.clientId, encodeMessage(o.msg));
    // fecha os sockets cujas conexoes o heartbeat reaper removeu; sem isso o
    // cliente (ex.: PWA em background) segue "online" sobre um socket cujo
    // clientId ja nao existe e nunca recebe o 'close' que dispara o reconnect.
    const stale = survival.reapStale(Date.now());
    for (const id of stale) {
      const s = sockets.get(id);
      s?.close(1001, 'idle timeout');
      sockets.delete(id);
    }
  }, TICK_MS);

  const port = opts.port ?? Number(process.env.PORT ?? 8080);
  const host = opts.host ?? '0.0.0.0';
  http.listen(port, host, () => log({ ev: 'listening', host, port }));

  const close = (): Promise<void> =>
    new Promise((resolve) => {
      draining = true;
      ready = false;
      clearInterval(loop);
      for (const ws of sockets.values()) ws.close(1001, 'server shutdown');
      wss.close(() =>
        http.close(() => {
          void Promise.all([
            leaderboardStore?.close() ?? Promise.resolve(),
            telemetryStore?.close() ?? Promise.resolve(),
            arenaTelemetryStore?.close() ?? Promise.resolve(),
            deathEchoStore?.close() ?? Promise.resolve(),
            progressionStore?.close() ?? Promise.resolve(),
          ]).then(() => resolve());
        }),
      );
    });

  return {
    http,
    survival,
    ready: leaderboardReady,
    leaderboard: () => leaderboardStore,
    telemetry: () => telemetryStore,
    arenaTelemetry: () => arenaTelemetryStore,
    deathEchoes: () => deathEchoStore,
    progression: () => progressionStore,
    close,
  };
};
