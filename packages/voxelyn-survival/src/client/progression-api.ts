// O cliente da Matriz Geracional.
//
// Este arquivo NAO calcula saldo, NAO valida custo e NAO decide geracao. Ele
// pergunta e mostra. Toda funcao aqui devolve o que o servidor disse, ou uma
// falha — nunca um valor "provavel" derivado localmente.
//
// A razao esta em `progression-http.ts` no servidor: um saldo que mora no
// navegador e um saldo que qualquer aba de devtools edita, e uma economia
// editavel nao consegue dar peso a decisao de extrair. Todo o desenho da feature
// depende de perder a carga DOER.
//
// `credentials: 'include'` em todas as chamadas: a sessao e um cookie HttpOnly,
// e sem isso o navegador nao o envia para outra origem — o jogo e servido de um
// lugar e o servidor de outro.

import type {
  CodexResponse,
  ProgressionErrorCode,
  ProgressionRunTicket,
  ProgressionSettlementResponse,
  PublicLoreFragment,
  PublicProgressionProfile,
} from '@voxelyn/survival-protocol';

export type ApiResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: ProgressionErrorCode | 'offline'; status?: number };

const httpBase = (serverUrl: string): string =>
  serverUrl.replace(/^ws/, 'http').replace(/\/+$/, '');

const call = async <T>(
  serverUrl: string,
  path: string,
  init: RequestInit = {},
): Promise<ApiResult<T>> => {
  try {
    const res = await fetch(`${httpBase(serverUrl)}${path}`, {
      ...init,
      credentials: 'include',
      headers: init.body ? { 'content-type': 'application/json', ...init.headers } : init.headers,
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: ProgressionErrorCode };
      return { ok: false, error: body.error ?? 'internal', status: res.status };
    }
    return { ok: true, value: (await res.json()) as T };
  } catch {
    // Offline e um estado NORMAL aqui, e nao um erro de jogo: o solo funciona
    // sem rede e o PWA existe para isso. Quem chama transforma isto em
    // "simulacao local", com o aviso de que nada sera registrado.
    return { ok: false, error: 'offline' };
  }
};

export const openSession = (
  serverUrl: string,
): Promise<ApiResult<{ profile: PublicProgressionProfile }>> =>
  call(serverUrl, '/api/progression/session', { method: 'POST' });

export const fetchProfile = (
  serverUrl: string,
): Promise<ApiResult<{ profile: PublicProgressionProfile }>> =>
  call(serverUrl, '/api/progression/profile');

/**
 * Pede autorizacao para uma expedicao que pode render recurso.
 *
 * A `seed` e um PEDIDO: o servidor pode atende-lo (a seed compartilhada e um
 * recurso do jogo) e nao decide recompensa nenhuma por causa dele. O tuning vem
 * de volta congelado, e e com ele que a run roda.
 */
export const requestRunTicket = (
  serverUrl: string,
  seed?: number,
): Promise<ApiResult<{ ticket: ProgressionRunTicket }>> =>
  call(serverUrl, '/api/progression/runs', {
    method: 'POST',
    body: JSON.stringify({ seed, mode: 'expedition' }),
  });

/**
 * Manda o que o jogador apertou. So isso.
 *
 * Nao existe parametro para minerio, fase, nucleo ou tempo — e a assinatura
 * desta funcao e o lugar em que isso fica visivel para quem for mexer aqui
 * depois.
 */
export const settleRun = (
  serverUrl: string,
  runId: string,
  log: string,
): Promise<ApiResult<ProgressionSettlementResponse>> =>
  call(serverUrl, `/api/progression/runs/${encodeURIComponent(runId)}/settle`, {
    method: 'POST',
    body: JSON.stringify({ log }),
  });

export const purchaseUpgrade = (
  serverUrl: string,
  upgradeId: string,
  expectedProfileVersion: number,
  idempotencyKey: string,
): Promise<
  ApiResult<{
    profile: PublicProgressionProfile;
    purchase: { upgradeId: string; oreSpent: number; coresSpent: number };
    unlockedLoreFragment: PublicLoreFragment | null;
  }>
> =>
  call(serverUrl, `/api/progression/upgrades/${encodeURIComponent(upgradeId)}/purchase`, {
    method: 'POST',
    // Repare no que NAO vai: custo. O preco sai do catalogo do servidor.
    body: JSON.stringify({ expectedProfileVersion, idempotencyKey }),
  });

export const fetchCodex = (serverUrl: string, lang: string): Promise<ApiResult<CodexResponse>> =>
  call(serverUrl, `/api/progression/codex?lang=${encodeURIComponent(lang)}`);

/**
 * Chave de idempotencia de uma compra.
 *
 * Derivada do que a compra E — perfil, protocolo e versao —, e nao aleatoria: um
 * retry depois de um timeout precisa gerar a MESMA chave, senao o servidor o
 * trata como uma segunda compra. Aleatoria por clique protegeria contra
 * clique duplo e nao contra a rede, que e o caso que acontece.
 */
export const purchaseKey = (profileId: string, upgradeId: string, profileVersion: number): string =>
  `${profileId.slice(0, 12)}-${upgradeId}-${profileVersion}`.replace(/[^A-Za-z0-9_-]/g, '');
