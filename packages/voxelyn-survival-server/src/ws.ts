import { createServer, type IncomingMessage, type Server as HttpServer, type ServerResponse } from 'node:http';
import { WebSocketServer, type WebSocket } from 'ws';
import { LIMITS, encodeMessage } from '@voxelyn/survival-protocol';
import { TICK_MS } from '@voxelyn/survival-sim';
import { SurvivalServer, type ServerOptions } from './server.js';
import { createLeaderboard, type LeaderboardStore } from './leaderboard.js';
import { createLeaderboardHandler } from './leaderboard-http.js';

export type WsServerHandle = {
  http: HttpServer;
  survival: SurvivalServer;
  /** Pronto quando o store do ranking terminou de conectar. */
  ready: Promise<void>;
  leaderboard: () => LeaderboardStore | null;
  close: () => Promise<void>;
};

export type WsOptions = ServerOptions & {
  port?: number;
  host?: string;
  allowedOrigins?: string[]; // CORS/origem restrita para wss
  /** URL do Postgres. Ausente = ranking em memoria (dev e testes). */
  databaseUrl?: string;
  /** Quantos proxies imediatamente a frente da aplicacao podem definir XFF. */
  trustedProxyHops?: number;
};

/**
 * Adaptador de rede: HTTP (/healthz, /readyz) + WebSocket. Roda o loop
 * autoritativo a 20 Hz e transporta as mensagens do SurvivalServer.
 */
export const createWsServer = (opts: WsOptions = {}): WsServerHandle => {
  let leaderboardStore: LeaderboardStore | null = null;

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
          log({ ev: 'leaderboard_submit_failed', error: err instanceof Error ? err.message : String(err) })
        );
    },
  });
  const log = opts.logger ?? ((line) => console.log(JSON.stringify(line)));
  let ready = true;
  let draining = false;

  let handleLeaderboard: ((req: IncomingMessage, res: ServerResponse) => Promise<boolean>) | null = null;

  // A conexao com o banco e assincrona; o servidor NAO espera por ela para
  // aceitar jogo. Ate o store existir, as rotas de ranking respondem 503 e o
  // resto do jogo funciona normalmente — indisponibilidade do ranking nao pode
  // virar indisponibilidade do jogo.
  const leaderboardReady = createLeaderboard(opts.databaseUrl ?? process.env.DATABASE_URL, log).then((store) => {
    leaderboardStore = store;
    handleLeaderboard = createLeaderboardHandler({
      store,
      log,
      allowedOrigins: opts.allowedOrigins,
      trustedProxyHops: opts.trustedProxyHops,
    });
  });

  const http = createServer((req: IncomingMessage, res: ServerResponse) => {
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
    if (req.url === '/healthz') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ ok: true, rooms: survival.roomCount(), conns: survival.connectionCount() }));
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
          void (leaderboardStore?.close() ?? Promise.resolve()).then(() => resolve());
        })
      );
    });

  return { http, survival, ready: leaderboardReady, leaderboard: () => leaderboardStore, close };
};
