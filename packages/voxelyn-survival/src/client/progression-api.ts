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

/**
 * `bad_server_url` nao vem do servidor: e um defeito NOSSO, e por isso tem nome
 * proprio.
 *
 * Ele existe por causa de um bug que passou por uma review inteira e chegou a
 * producao. Uma renomeacao deixou `openSession(query.url)` com `undefined` no
 * lugar da URL; `httpBase(undefined)` lancou dentro do mesmo `try` que trata
 * rede ausente, e a falha saiu como `offline`. Do lado de fora ficou
 * indistinguivel de um cabo desligado — a Matriz anunciava a Aurix como fora do
 * ar contra um servidor que respondia normalmente, e a unica pista estava num
 * DevTools que ninguem tinha motivo para abrir.
 *
 * Um erro de programacao nunca deve conseguir se disfarcar de condicao de rede.
 */
export type ApiResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: ProgressionErrorCode | 'offline' | 'bad_server_url'; status?: number };

const httpBase = (serverUrl: string): string =>
  serverUrl.replace(/^ws/, 'http').replace(/\/+$/, '');

const TOKEN_KEY_PREFIX = 'voxelyn.progression.token';

/**
 * A ORIGEM que emitiu um token, normalizada.
 *
 * O escopo por origem e obrigatorio, e a razao merece estar escrita: o cookie
 * tinha isso DE GRACA — o navegador nunca manda o cookie de um site para outro.
 * Ao trocar para um token em header, essa garantia sumiu, e reimplementa-la
 * passou a ser responsabilidade deste arquivo. A primeira versao nao o fez.
 *
 * O que isso permitia: o servidor e escolhivel por `?server=` e pelo campo do
 * menu. Um link apontando para um servidor hostil fazia o cliente ANEXAR o token
 * de producao na primeira chamada — e quem o recebesse poderia repeti-lo contra a
 * API real e assumir o perfil do jogador.
 *
 * Uma chave por origem tambem conserta o caso benigno: alternar entre dois
 * servidores confiaveis sobrescrevia o token do primeiro e orfanava aquele perfil
 * anonimo em qualquer navegador que bloqueie cookies de terceiros.
 */
const originOf = (serverUrl: string): string | null => {
  try {
    const url = new URL(httpBase(serverUrl));
    // Parseavel NAO e o mesmo que utilizavel, e a diferenca escapou na primeira
    // versao desta validacao: `ftp://host` devolve uma origem perfeitamente
    // truthy, e `file:///x` devolve a STRING "null", que tambem passa. Os dois
    // furavam a checagem, o `fetch` os recusava depois, e a recusa saia como
    // `offline` — de novo um endereco errado se passando por queda de rede.
    //
    // Depois do `httpBase` so restam dois esquemas legitimos. Qualquer outro e
    // configuracao invalida, e e assim que precisa ser anunciado.
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return url.origin;
  } catch {
    return null;
  }
};

const tokenKey = (origin: string): string => `${TOKEN_KEY_PREFIX}:${origin}`;

/**
 * O token guardado PARA AQUELE SERVIDOR.
 *
 * So e usado quando o cookie nao acompanha a requisicao — mas e enviado sempre,
 * porque o cliente nao tem como saber se o cookie chegou: `document.cookie` nao
 * enxerga um cookie HttpOnly, e o servidor prefere o cookie de qualquer forma.
 */
export const readSessionToken = (serverUrl: string): string | null => {
  const origin = originOf(serverUrl);
  if (!origin) return null;
  try {
    return localStorage.getItem(tokenKey(origin));
  } catch {
    return null;
  }
};

const writeSessionToken = (serverUrl: string, token: string | null): void => {
  const origin = originOf(serverUrl);
  if (!origin) return;
  try {
    if (token) localStorage.setItem(tokenKey(origin), token);
    else localStorage.removeItem(tokenKey(origin));
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

/**
 * Teto do PRIMEIRO contato com uma origem que ainda nao respondeu nada.
 *
 * Seis segundos e o teto certo para uma chamada interativa e o teto errado para
 * acordar um processo. Um host que hiberna por ociosidade — o padrao de quase
 * todo PaaS — leva de trinta a sessenta segundos para servir a primeira
 * requisicao, e com uma tentativa so o jogador nunca via a Aurix: o painel
 * anunciava "indisponivel" contra um servidor perfeitamente no ar, e a descida
 * saia sem ticket, jogando a run inteira em simulacao local sem render nada.
 *
 * Isto NAO e um teto maior para tudo. E uma segunda tentativa, uma unica vez por
 * origem por carregamento de pagina, so quando a primeira falhou por nao ter
 * chegado resposta nenhuma.
 */
export const TIMEOUT_WAKE_MS = 25_000;

/**
 * Origens cuja pergunta "tem alguem ai?" ja foi feita e PAGA.
 *
 * Duas coisas entram aqui, e as duas por serem a mesma: uma resposta HTTP de
 * qualquer status (401 e 429 servem — o que se guarda e "existe alguem
 * escutando", nao "deu certo"), e a propria tentativa longa no instante em que
 * ela e disparada.
 *
 * Registrar a TENTATIVA, e nao so a resposta, e o ponto. Marcar apenas o
 * sucesso deixava a origem genuinamente inalcancavel fora do conjunto para
 * sempre, e ai TODA chamada pagava 6s + 25s. Como `authorizeExpedition` espera
 * o ticket antes de comecar a run, cada descida offline travaria por meio
 * minuto — trocando um teto ruim por um pior, exatamente no caminho que a
 * mudanca queria proteger.
 */
const wakePaid = new Set<string>();

/**
 * O despertar EM ANDAMENTO de cada origem. Resolve com "acordou?".
 *
 * Sem isto, duas chamadas concorrentes contra a mesma origem fria se atrapalham:
 * a primeira a retomar marca `wakePaid` e sai esperando; a segunda ve a marca,
 * conclui que a tentativa ja foi gasta e anuncia queda na hora — mesmo que a
 * espera da primeira termine com o servidor de pe. Na Matriz isso e rotina, e
 * nao excecao: `refreshProfile` e `refreshCodex` se sobrepoem quando o painel
 * abre na aba dos Arquivos.
 *
 * As duas chamadas pedem caminhos diferentes, entao a RESPOSTA nao da para
 * compartilhar. O que da — e e o que importa — e o desfecho da pergunta "tem
 * alguem ai?": quem chega depois espera por ela e refaz o proprio pedido contra
 * uma origem que agora esta quente.
 */
const wakeInFlight = new Map<string, Promise<boolean>>();

const call = async <T>(
  serverUrl: string,
  path: string,
  init: RequestInit = {},
  timeoutMs = TIMEOUT_INTERACTIVE_MS,
): Promise<ApiResult<T>> => {
  // ANTES do try: uma URL impossivel nao pode cair no mesmo caminho que uma
  // rede ausente. Ver o comentario de `ApiResult`.
  const origin = originOf(serverUrl);
  if (!origin) return { ok: false, error: 'bad_server_url' };
  try {
    const token = readSessionToken(serverUrl);
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
    // Respondeu: a origem esta acordada, qualquer que tenha sido o status.
    wakePaid.add(origin);
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

/**
 * Uma chamada interativa que aceita pagar o despertar da origem — uma vez.
 *
 * A segunda tentativa so acontece com as duas condicoes juntas: a origem nunca
 * respondeu nesta pagina, e a primeira tentativa nao trouxe resposta nenhuma.
 * Um 429 ou um 500 nao repetem: o servidor esta acordado e ja disse o que tinha
 * a dizer, e insistir so gastaria o teto do limitador.
 */
const callAwake = async <T>(
  serverUrl: string,
  path: string,
  init: RequestInit = {},
): Promise<ApiResult<T>> => {
  const origin = originOf(serverUrl);
  const first = await call<T>(serverUrl, path, init, TIMEOUT_INTERACTIVE_MS);
  if (first.ok || first.error !== 'offline') return first;
  if (!origin) return first;

  // Ja ha alguem pagando a espera por esta origem: aproveitar o desfecho dela e
  // melhor que anunciar uma queda que talvez nem exista.
  const ongoing = wakeInFlight.get(origin);
  if (ongoing) {
    return (await ongoing) ? call<T>(serverUrl, path, init, TIMEOUT_INTERACTIVE_MS) : first;
  }

  // `wakePaid` e consultado DEPOIS da primeira tentativa: e ela quem acabou de
  // descobrir se ha alguem ali.
  if (wakePaid.has(origin)) return first;
  // ANTES de esperar, e nao depois: a tentativa esta gasta quer ela traga
  // resposta ou nao. Marcar so no sucesso faria a origem morta pagar os 25s
  // outra vez, e outra, e outra.
  wakePaid.add(origin);

  let announce: (awake: boolean) => void = () => undefined;
  wakeInFlight.set(
    origin,
    new Promise<boolean>((resolve) => {
      announce = resolve;
    }),
  );
  let awake = false;
  try {
    const retry = await call<T>(serverUrl, path, init, TIMEOUT_WAKE_MS);
    awake = retry.ok || retry.error !== 'offline';
    return retry;
  } finally {
    // No `finally` para que nenhum caminho de saida deixe quem espera pendurado.
    wakeInFlight.delete(origin);
    announce(awake);
  }
};

export const openSession = async (
  serverUrl: string,
): Promise<ApiResult<{ profile: PublicProgressionProfile }>> => {
  const result = await callAwake<{ profile: PublicProgressionProfile; token?: string }>(
    serverUrl,
    '/api/progression/session',
    { method: 'POST' },
  );
  // O token so vem quando a sessao NASCE. Confirmar uma sessao existente devolve
  // so o perfil, e o que ja estava guardado continua valendo.
  if (result.ok && result.value.token) writeSessionToken(serverUrl, result.value.token);
  return result;
};

export const fetchProfile = (
  serverUrl: string,
): Promise<ApiResult<{ profile: PublicProgressionProfile }>> =>
  callAwake(serverUrl, '/api/progression/profile');

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
  callAwake(serverUrl, '/api/progression/runs', {
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
  callAwake(serverUrl, `/api/progression/codex?lang=${encodeURIComponent(lang)}`);

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
