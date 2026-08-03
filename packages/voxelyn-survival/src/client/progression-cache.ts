// Cache local do perfil autoritativo. NAO e fonte de verdade de nada.
//
// Ele existe por um motivo so: abrir a Matriz e ver a carteira imediatamente, em
// vez de um esqueleto de carregamento. No instante em que a resposta do servidor
// chega, ela SUBSTITUI o que estava aqui.
//
// ---------------------------------------------------------------------------
// O QUE ESTE CACHE NAO PODE FAZER
// ---------------------------------------------------------------------------
// - autorizar uma compra;
// - definir o tuning de uma run recompensada;
// - creditar recurso;
// - ser enviado ao servidor como estado.
//
// Editar `localStorage` aqui muda o que a tela mostra por alguns milissegundos e
// mais nada: a compra vai ao servidor com `expectedProfileVersion`, e o servidor
// compara contra o proprio registro. Um saldo inflado no cache produz um 409 ou
// um 402, nunca um protocolo.
//
// Esta e a diferenca entre "o cliente guarda uma copia" e "o cliente guarda a
// verdade", e ela e a razao de a feature inteira ter sido desenhada assim.

import type { PublicProgressionProfile } from '@voxelyn/survival-protocol';

const KEY = 'voxelyn.progression.cache';

export type CachedProgressionProfile = {
  cachedAt: number;
  profileVersion: number;
  profile: PublicProgressionProfile;
};

export const readCachedProfile = (): CachedProgressionProfile | null => {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return null;
    const cached = parsed as CachedProgressionProfile;
    // Validacao MINIMA, e nao completa: o objetivo e nao explodir ao desenhar, e
    // nao decidir se o dado e verdadeiro — essa pergunta nao se responde aqui.
    if (typeof cached.profile?.profileId !== 'string') return null;
    if (typeof cached.profile?.wallet?.ore !== 'number') return null;
    return cached;
  } catch {
    return null;
  }
};

export const writeCachedProfile = (profile: PublicProgressionProfile, nowMs: number): void => {
  try {
    const payload: CachedProgressionProfile = {
      cachedAt: nowMs,
      profileVersion: profile.profileVersion,
      profile,
    };
    localStorage.setItem(KEY, JSON.stringify(payload));
  } catch {
    /* sem storage: a Matriz abre com esqueleto e busca do servidor */
  }
};

export const clearCachedProfile = (): void => {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* nada a fazer */
  }
};

/** O cache esta velho o bastante para nem valer a pena mostrar? */
export const CACHE_STALE_MS = 24 * 60 * 60 * 1000;

export const isStale = (cached: CachedProgressionProfile, nowMs: number): boolean =>
  nowMs - cached.cachedAt > CACHE_STALE_MS;
