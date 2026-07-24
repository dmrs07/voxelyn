import { createServer, type IncomingMessage, type Server as HttpServer, type ServerResponse } from 'node:http';
import { WebSocketServer, type WebSocket } from 'ws';
import { encodeMessage } from '@voxelyn/survival-protocol';
import { TICK_MS } from '@voxelyn/survival-sim';
import { SurvivalServer, type ServerOptions } from './server.js';

export type WsServerHandle = {
  http: HttpServer;
  survival: SurvivalServer;
  close: () => Promise<void>;
};

export type WsOptions = ServerOptions & {
  port?: number;
  host?: string;
  allowedOrigins?: string[]; // CORS/origem restrita para wss
};

/**
 * Adaptador de rede: HTTP (/healthz, /readyz) + WebSocket. Roda o loop
 * autoritativo a 20 Hz e transporta as mensagens do SurvivalServer.
 */
export const createWsServer = (opts: WsOptions = {}): WsServerHandle => {
  const survival = new SurvivalServer(opts);
  const log = opts.logger ?? ((line) => console.log(JSON.stringify(line)));
  let ready = true;
  let draining = false;

  const http = createServer((req: IncomingMessage, res: ServerResponse) => {
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

  const wss = new WebSocketServer({ server: http });
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
    survival.reapStale(Date.now());
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
      wss.close(() => http.close(() => resolve()));
    });

  return { http, survival, close };
};
