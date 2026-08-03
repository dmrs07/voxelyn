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
// `credentials: 'include'` em todas as chamadas: onde o cookie funciona, ele e a
// credencial, e sem isso o navegador nao o envia para outra origem.
//
// Onde ele NAO funciona — cliente e API em sites diferentes e o navegador
// bloqueando cookies de terceiros, que e o padrao do Safari — entra o token no
// header `Authorization`. O custo esta declarado em `progression-auth.ts` no
// servidor: guardado aqui, o token deixa de ser HttpOnly. O que se ganha e a
// feature existir para esses jogadores em vez de virar simulacao local silenciosa.

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

const TOKEN_KEY = 'voxelyn.progression.token';

/**
 * O token de sessao guardado localmente.
 *
 * So e USADO quando o cookie nao acompanha a requisicao — mas e enviado sempre,
 * porque o cliente nao tem como saber se o cookie chegou: `document.cookie` nao
 * enxerga um cookie HttpOnly, e o servidor prefere o cookie de qualquer forma.
 */
export const readSessionToken = (): string | null => {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
};

const writeSessionToken = (token: string | null): void => {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* sem storage: sobra o cookie, que e o caminho preferido de qualquer jeito */
  }
};

/**
 * Tetos de espera, por natureza da chamada.
 *
 * Toda chamada precisa de um, e nao so por elegancia: uma conexao ENGOLIDA (o
 * pacote sai e nada volta, que e o que uma rede de hotel ou um captive portal
 * fazem) nao rejeita — ela pendura. Sem teto, apertar "Descer" congelava o jogo
 * ate o timeout do sistema operacional, que pode ser mais de um minuto, e a
 * promessa do fallback offline virava uma tela travada.
 *
 * O da liquidacao e muito maior porque do outro lado ha uma RE-SIMULACAO de ate
 * trinta minutos de jogo, e abortar cedo desistiria de uma carga ja conquistada.
 */
export const TIMEOUT_INTERACTIVE_MS = 6_000;
export const TIMEOUT_SETTLE_MS = 45_000;

const call = async <T>(
  serverUrl: string,
  path: string,
  init: RequestInit = {},
  timeoutMs = TIMEOUT_INTERACTIVE_MS,
): Promise<ApiResult<T>> => {
  try {
    const token = readSessionToken();
    const res = await fetch(`${httpBase(serverUrl)}${path}`, {
      ...init,
      credentials: 'include',
      // `AbortSignal.timeout` aborta o fetch e cai no `catch` abaixo, onde o
      // resultado ja e tratado como offline — o mesmo caminho de uma rede
      // ausente, que e exatamente o que uma conexao pendurada e na pratica.
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        ...(init.body ? { 'content-type': 'application/json' } : {}),
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...init.headers,
      },
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

export const openSession = async (
  serverUrl: string,
): Promise<ApiResult<{ profile: PublicProgressionProfile }>> => {
  const result = await call<{ profile: PublicProgressionProfile; token?: string }>(
    serverUrl,
    '/api/progression/session',
    { method: 'POST' },
  );
  // O token so vem quando a sessao NASCE. Confirmar uma sessao existente devolve
  // so o perfil, e o que ja estava guardado continua valendo.
  if (result.ok && result.value.token) writeSessionToken(result.value.token);
  return result;
};

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
  call(
    serverUrl,
    `/api/progression/runs/${encodeURIComponent(runId)}/settle`,
    { method: 'POST', body: JSON.stringify({ log }) },
    TIMEOUT_SETTLE_MS,
  );

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

/**
 * Pede o ticket, abrindo a sessao ANTES se ainda nao houver uma.
 *
 * Vive aqui, e nao no `main.ts`, porque e uma regra da CAMADA DE API: a sessao e
 * um cookie que so nasce num POST explicito, e todo endpoint autenticado depende
 * dele. Quem instalasse o jogo e apertasse "Descer" sem nunca abrir a Matriz —
 * o unico lugar que abria sessao — levava 401, caia em simulacao local em
 * silencio, e perdia a progressao da primeira run.
 *
 * A sessao NAO e criada no boot de proposito: o jogo abre offline (e o PWA
 * existe para isso), e uma chamada de rede obrigatoria na inicializacao
 * transformaria "sem rede" em "sem jogo".
 *
 * `unauthenticated` tambem cobre o perfil que sumiu do lado do servidor — store
 * em memoria reiniciado, cookie expirado —, e a retentativa cria um perfil novo
 * em vez de deixar o jogador presa em local para sempre.
 *
 * Devolve tambem o perfil, quando a sessao foi criada agora: quem chama precisa
 * dele para o cache e para a geracao do chassi, e uma segunda ida a rede so para
 * relê-lo seria desperdicio no caminho mais sensivel do jogo.
 */
export const requestRunTicketWithSession = async (
  serverUrl: string,
  seed?: number,
): Promise<{
  ticket: ApiResult<{ ticket: ProgressionRunTicket }>;
  openedProfile: PublicProgressionProfile | null;
}> => {
  const first = await requestRunTicket(serverUrl, seed);
  if (first.ok || first.error !== 'unauthenticated') {
    return { ticket: first, openedProfile: null };
  }
  const session = await openSession(serverUrl);
  if (!session.ok) return { ticket: first, openedProfile: null };
  // UMA retentativa. Um segundo 401 depois de a sessao ter sido criada nao e um
  // problema de sessao, e insistir viraria laco.
  return {
    ticket: await requestRunTicket(serverUrl, seed),
    openedProfile: session.value.profile,
  };
};
