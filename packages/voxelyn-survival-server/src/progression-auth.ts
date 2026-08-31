// Identidade do perfil de progressao.
//
// O repositorio nao tem autenticacao de jogador, e nenhum dos candidatos obvios
// serve: nome de exibicao e digitavel, IP muda, user-agent nao identifica, e um
// id escolhido pelo cliente e o mesmo que deixar o jogador escrever o proprio
// numero de conta. A resposta e uma SESSAO ANONIMA emitida pelo servidor.
//
//   profileId   128 bits de CSPRNG. Nao previsivel, nao enumeravel.
//   token       profileId.expiracao.hmac, assinado com PROGRESSION_SECRET.
//   transporte  cookie HttpOnly quando ele funciona, e `Authorization: Bearer`
//               quando nao (ver abaixo).
//
// ---------------------------------------------------------------------------
// POR QUE EXISTEM DOIS TRANSPORTES
// ---------------------------------------------------------------------------
// O cookie sozinho seria melhor: `HttpOnly` mantem o token fora do alcance de
// qualquer JavaScript, inclusive do JavaScript injetado.
//
// So que no deploy real o cliente e a API sao SITES DIFERENTES, e ai o cookie e
// de terceiros. `SameSite=None` autoriza o envio cross-site, mas nao contorna o
// BLOQUEIO de cookies de terceiros — Safari bloqueia por padrao, e ali o cookie
// simplesmente nao chega. O sintoma seria o pior possivel: toda expedicao virando
// simulacao local sem recompensa, em silencio, num alvo de PWA declarado.
//
// Entao o mesmo token tambem viaja num header, e o cliente o guarda. O custo esta
// declarado: um XSS no cliente consegue ler o token e assumir aquele perfil de
// progressao. E um custo aceitavel aqui e nao seria em outro lugar — o que ele
// protege e um saldo de jogo, nao dinheiro nem identidade —, e a alternativa era
// a feature nao funcionar para uma parte dos jogadores.
//
// O cookie continua sendo tentado PRIMEIRO onde funciona: quem estiver em
// mesma origem, ou com cookies de terceiros liberados, nunca expoe o token ao JS.
//
// O segredo nunca sai do servidor, e o cliente nunca ve nada alem de um opaco
// que ele so pode devolver inteiro. Adulterar um byte muda o HMAC, e a
// comparacao e em tempo constante.
//
// ---------------------------------------------------------------------------
// O QUE ISTO NAO RESOLVE, E ESTA DECLARADO
// ---------------------------------------------------------------------------
// Uma sessao anonima e presa a um navegador. Trocar de aparelho comeca do zero,
// e limpar cookies perde o perfil. Isso e uma limitacao real, nao um descuido: a
// alternativa (aceitar um id do cliente para "recuperar" o perfil) devolveria a
// autoridade para o lado errado no exato ponto que a arquitetura protege.
//
// A estrutura fica pronta para conta de verdade — `profileId` e opaco e nao
// carrega significado —, mas MERGE AUTOMATICO de saldos nao esta implementado e
// nao deve ser sem uma politica de identidade explicita.

import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export const SESSION_COOKIE = 'aurix_profile';
const BEARER_PREFIX = 'Bearer ';

/** Le um cookie do header bruto. Tolerante: valor ausente vira undefined. */
export const readCookie = (header: string | undefined, name: string): string | undefined => {
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq < 0) continue;
    if (part.slice(0, eq).trim() !== name) continue;
    return part.slice(eq + 1).trim();
  }
  return undefined;
};

/**
 * O token da requisicao: cookie primeiro, header depois.
 *
 * A ordem e a politica. Onde o cookie chega, ele e a credencial — e o token nunca
 * precisou passar por JavaScript nenhum.
 */
export const readSessionToken = (
  cookieHeader: string | undefined,
  authorizationHeader: string | undefined,
): string | undefined => {
  const cookie = readCookie(cookieHeader, SESSION_COOKIE);
  if (cookie) return cookie;
  if (typeof authorizationHeader !== 'string') return undefined;
  if (!authorizationHeader.startsWith(BEARER_PREFIX)) return undefined;
  const token = authorizationHeader.slice(BEARER_PREFIX.length).trim();
  return token.length > 0 ? token : undefined;
};
export const SESSION_TTL_MS = 365 * 24 * 60 * 60 * 1000;

export type SessionAuth = {
  newProfileId: () => string;
  issue: (profileId: string, nowMs: number) => string;
  /** Devolve o profileId de um token valido e nao expirado, ou null. */
  verify: (token: string | undefined, nowMs: number) => string | null;
  cookieHeader: (token: string, secure: boolean) => string;
};

const base64url = (buf: Buffer): string => buf.toString('base64url');

/**
 * Persistir perfil com segredo EFEMERO e uma contradicao, e ela ja custou caro.
 *
 * Sem `DATABASE_URL` o efemero e correto: nao ha o que preservar, e um segredo
 * obrigatorio so atrapalharia `pnpm dev`. COM ele, os dois juntos significam
 * "grave o perfil para sempre e jogue a chave fora": o `profileId` sao 128 bits
 * de CSPRNG, nada mais indexa aquela linha, e a cada reinicio o token deixa de
 * verificar. O jogador nao perde a carteira — ele perde o ENDERECO dela, e a
 * linha fica no banco sem ninguem que a alcance.
 *
 * Aconteceu em producao: um deploy comum devolveu a arvore de protocolos em
 * branco, e o `progression_secret_ephemeral` no log tinha sido escrito em todo
 * boot anterior sem ninguem ler. O aviso estava certo e nao bastou — e por isso
 * esta funcao LANCA em vez de avisar.
 *
 * Lancar aqui e mais seguro que subir. O health check do Render nao passa, o
 * deploy e revertido, e a instancia ANTIGA continua no ar com o segredo que os
 * jogadores ainda tem no navegador. O modo de falha vira "o deploy nao entrou",
 * que se conserta em um minuto, em vez de "todo mundo perdeu o perfil", que nao
 * se conserta.
 */
export const assertProgressionSecretIsStable = (
  databaseUrl: string | undefined,
  provided: string | undefined,
): void => {
  if (!databaseUrl) return;
  if (provided && provided.length >= 16) return;
  throw new Error(
    provided
      ? 'PROGRESSION_SECRET tem menos de 16 caracteres e ha DATABASE_URL: ' +
        'um segredo fraco assina sessoes que guardam perfil persistido.'
      : 'PROGRESSION_SECRET ausente e ha DATABASE_URL: o servidor gravaria perfis ' +
        'que nenhum token conseguiria reabrir depois do proximo reinicio. ' +
        'Defina um valor estavel (32 bytes aleatorios) antes de subir.',
  );
};

/**
 * Segredo do ambiente, ou um efemero com AVISO no boot.
 *
 * O efemero sobrevive para o caminho em que ele e a resposta certa: sem
 * `DATABASE_URL`, nada e persistido e um segredo obrigatorio so atrapalharia
 * `pnpm dev`. Onde ele destruiria dado, quem barra e
 * `assertProgressionSecretIsStable`, antes de o servidor sequer abrir a porta.
 */
export const resolveProgressionSecret = (
  provided: string | undefined,
  log: (line: Record<string, unknown>) => void,
): string => {
  if (provided && provided.length >= 16) return provided;
  if (provided) log({ ev: 'progression_secret_weak', reason: 'menos de 16 caracteres' });
  log({
    ev: 'progression_secret_ephemeral',
    reason: 'PROGRESSION_SECRET ausente; sessoes nao sobrevivem a reinicio',
  });
  return base64url(randomBytes(32));
};

export const createSessionAuth = (secret: string): SessionAuth => {
  const sign = (payload: string): string =>
    base64url(createHmac('sha256', secret).update(payload).digest());

  return {
    newProfileId: () => base64url(randomBytes(16)),

    issue: (profileId, nowMs) => {
      const payload = `${profileId}.${nowMs + SESSION_TTL_MS}`;
      return `${payload}.${sign(payload)}`;
    },

    verify: (token, nowMs) => {
      if (typeof token !== 'string') return null;
      const parts = token.split('.');
      if (parts.length !== 3) return null;
      const [profileId, expiryRaw, mac] = parts;
      if (!profileId || !expiryRaw || !mac) return null;

      const expected = sign(`${profileId}.${expiryRaw}`);
      // Comprimento diferente sai antes: `timingSafeEqual` LANCA em buffers de
      // tamanhos diferentes, e um throw aqui viraria 500 num token malformado —
      // que e exatamente o que um atacante manda primeiro.
      if (expected.length !== mac.length) return null;
      if (!timingSafeEqual(Buffer.from(expected), Buffer.from(mac))) return null;

      const expiry = Number(expiryRaw);
      if (!Number.isFinite(expiry) || expiry <= nowMs) return null;
      return profileId;
    },

    cookieHeader: (token, secure) =>
      [
        `${SESSION_COOKIE}=${token}`,
        'HttpOnly',
        'Path=/api/progression',
        `Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`,
        // ---------------------------------------------------------------
        // SameSite: None em producao, Lax em desenvolvimento
        // ---------------------------------------------------------------
        // O cliente e o servidor sao ORIGENS DIFERENTES no deploy real — Static
        // Site e Web Service no Render, e a URL do servidor ainda pode ser
        // trocada por `?server=` ou `VITE_SERVER_URL`. Com `SameSite=Lax` o
        // navegador nao envia o cookie num `fetch` para outro site: a sessao era
        // criada com sucesso e TODA chamada seguinte — perfil, ticket,
        // liquidacao, compra — voltava 401.
        //
        // `SameSite=None` exige `Secure`, e os dois so podem ser emitidos sobre
        // https. Em http local isso nao existe, e ali `Lax` funciona porque o
        // desenvolvimento e mesma origem (ou localhost, que os navegadores
        // tratam como contexto seguro para outros fins, mas nao para este).
        secure ? 'SameSite=None' : 'SameSite=Lax',
        secure ? 'Secure' : '',
      ]
        .filter(Boolean)
        .join('; '),
  };
};
