// A rota do digest de leitura de lore, no servidor de verdade.
//
// Ela e de OPERADOR: nao ha perfil autenticado, e por isso o teste que mais
// importa aqui e o do token ausente ou errado.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createWsServer, type WsServerHandle } from '../src/ws';

let handle: WsServerHandle;
let base: string;

beforeAll(async () => {
  const booted = createWsServer({
    port: 0,
    host: '127.0.0.1',
    baseSeed: 99,
    progressionSecret: 'segredo-de-teste-com-tamanho-suficiente',
    telemetryToken: 'token-de-operador',
    progressionRateLimits: { settlePerMinute: 10_000, readsPerMinute: 10_000 },
  });
  await booted.ready;
  await new Promise<void>((resolve) => {
    if (booted.http.listening) return resolve();
    booted.http.once('listening', () => resolve());
  });
  handle = booted;
  const addr = booted.http.address();
  const port = typeof addr === 'object' && addr ? addr.port : 0;
  base = `http://127.0.0.1:${port}`;
});

afterAll(async () => {
  await handle?.close();
});

describe('GET /api/progression/lore-digest', () => {
  it('sem token, a rota nem admite existir', async () => {
    // 404 e nao 401 de proposito: uma rota de operador nao confirma que esta
    // ali para quem nao tem o segredo.
    const res = await fetch(`${base}/api/progression/lore-digest`);
    expect(res.status).toBe(404);
  });

  it('com token errado, mesma resposta', async () => {
    const res = await fetch(`${base}/api/progression/lore-digest?token=chute`);
    expect(res.status).toBe(404);
  });

  it('com o token certo, devolve o agregado', async () => {
    const res = await fetch(`${base}/api/progression/lore-digest?token=token-de-operador`);
    expect(res.status).toBe(200);
    const digest = await res.json();
    // Servidor recem-subido, sem perfil: os campos existem e sao zero, em vez
    // de faltarem. Um painel que recebe `undefined` desenha "NaN%".
    expect(digest.profiles).toBe(0);
    expect(digest.readRate).toBe(0);
    expect(digest.fragments).toEqual([]);
    expect(digest.readBuckets.map((b: { bucket: string }) => b.bucket)).toEqual([
      '0',
      '1',
      '2-5',
      '6-15',
      '16+',
    ]);
  });

  it('nao vaza identificador de perfil', async () => {
    const res = await fetch(`${base}/api/progression/lore-digest?token=token-de-operador`);
    const body = await res.text();
    expect(body).not.toMatch(/profileId|profile_id/);
  });
});
