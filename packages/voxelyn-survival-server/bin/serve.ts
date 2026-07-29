#!/usr/bin/env node
import { createWsServer } from '../src/ws.js';

const allowed = process.env.ALLOWED_ORIGINS?.split(',').map((s) => s.trim()).filter(Boolean);
const configuredProxyHops = Number.parseInt(process.env.TRUST_PROXY_HOPS ?? '0', 10);
const trustedProxyHops = Number.isFinite(configuredProxyHops)
  ? Math.max(0, configuredProxyHops)
  : 0;

const handle = createWsServer({
  port: Number(process.env.PORT ?? 8080),
  host: '0.0.0.0',
  allowedOrigins: allowed && allowed.length > 0 ? allowed : undefined,
  trustedProxyHops,
});

const shutdown = (signal: string): void => {
  console.log(JSON.stringify({ ev: 'shutdown', signal }));
  handle
    .close()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
