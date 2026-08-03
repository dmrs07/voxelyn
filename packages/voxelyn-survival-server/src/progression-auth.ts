// Identidade do perfil de progressao.
//
// O repositorio nao tem autenticacao de jogador, e nenhum dos candidatos obvios
// serve: nome de exibicao e digitavel, IP muda, user-agent nao identifica, e um
// id escolhido pelo cliente e o mesmo que deixar o jogador escrever o proprio
// numero de conta. A resposta e uma SESSAO ANONIMA emitida pelo servidor.
//
//   profileId   128 bits de CSPRNG. Nao previsivel, nao enumeravel.
//   token       profileId.expiracao.hmac, assinado com PROGRESSION_SECRET.
//   transporte  cookie HttpOnly; Secure; SameSite=None em https (ver `cookieHeader`).
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
 * Segredo do ambiente, ou um efemero com AVISO no boot.
 *
 * Cair para efemero e melhor que recusar a subir: o jogo funciona, so as sessoes
 * nao sobrevivem a um restart. O que nao pode acontecer e isso ser silencioso —
 * em producao mal configurada, o sintoma seria "os jogadores perdem o perfil de
 * vez em quando", que e caro de diagnosticar e barato de anunciar.
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
