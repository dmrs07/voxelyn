// O pool comunitário, do lado do cliente.
//
// Duas operações, e as duas falham em silêncio de propósito: o solo funciona
// offline — o PWA existe para isso — e um pool indisponível não pode virar erro na
// tela nem impedir a descida. Sem rede, o jogador vê apenas os próprios restos,
// que é exatamente a Etapa 1.
//
// O que este arquivo NÃO faz: não confia no servidor. Toda cápsula que chega passa
// por `parseDeathEchoCapsule`, o mesmo portão do `localStorage` e do POST, porque
// um pool é editável por quem o hospeda.

import {
  parseDeathEchoCapsule,
  parseDeathEchoContract,
  type DeathEchoCapsule,
  type DeathEchoContract,
} from '@voxelyn/survival-protocol';

/** Teto de cápsulas aceitas numa resposta, antes de qualquer projeção. */
export const DEATH_ECHO_POOL_MAX = 24;

const httpBase = (serverUrl: string): string =>
  serverUrl.replace(/^ws/, 'http').replace(/\/+$/, '');

export type DeathEchoPoolQuery = {
  /** Setor pedido. O pool é consultado por setor porque a projeção é por setor. */
  sector: number;
  /**
   * Restringe à seed do contrato coletivo.
   *
   * É o que faz as coordenadas voltarem a ser reais: cápsulas da MESMA seed
   * projetam como `exact`, e a run vira o mesmo chão que os outros pisaram.
   */
  seed?: number;
  limit?: number;
};

/**
 * Busca uma amostra do pool.
 *
 * Devolve lista vazia em qualquer falha — rede, status, corpo inválido. O
 * chamador não precisa distinguir: em todos os casos a run segue com a memória
 * local, que é um estado normal do jogo e não um erro.
 */
export const fetchDeathEchoPool = async (
  serverUrl: string,
  query: DeathEchoPoolQuery,
): Promise<DeathEchoCapsule[]> => {
  const params = new URLSearchParams({ sector: String(query.sector) });
  if (query.seed !== undefined) params.set('seed', String(query.seed >>> 0));
  params.set('limit', String(Math.min(DEATH_ECHO_POOL_MAX, query.limit ?? DEATH_ECHO_POOL_MAX)));
  try {
    const res = await fetch(`${httpBase(serverUrl)}/echoes?${params.toString()}`);
    if (!res.ok) return [];
    const body = (await res.json()) as { echoes?: unknown };
    if (!Array.isArray(body.echoes)) return [];
    return body.echoes
      .map(parseDeathEchoCapsule)
      .filter((echo): echo is DeathEchoCapsule => echo !== null)
      .slice(0, DEATH_ECHO_POOL_MAX);
  } catch {
    return [];
  }
};

/** O contrato coletivo vigente, ou null quando não há servidor alcançável. */
export const fetchDeathEchoContract = async (
  serverUrl: string,
): Promise<DeathEchoContract | null> => {
  try {
    const res = await fetch(`${httpBase(serverUrl)}/echoes/contract`);
    if (!res.ok) return null;
    const body = (await res.json()) as { contract?: unknown };
    return parseDeathEchoContract(body.contract);
  } catch {
    return null;
  }
};

export type DeathEchoSubmitOutcome =
  | { ok: true; accepted: boolean }
  | { ok: false; reason: string };

/**
 * Publica a própria morte para o pool.
 *
 * Manda a SEED e o LOG DE COMANDOS, nunca a cápsula. É a mesma regra do
 * leaderboard e pela mesma razão: não existe campo para mentir. O servidor
 * re-simula, descobre sozinho onde e de que o Prospector morreu, e constrói a
 * cápsula com a própria topologia. Uma cápsula enviada pronta seria uma
 * afirmação do cliente sobre o mundo — e o pool inteiro perderia o direito de
 * um dia conceder qualquer coisa.
 */
export const submitDeathEcho = async (
  serverUrl: string,
  seed: number,
  logBase64: string,
): Promise<DeathEchoSubmitOutcome> => {
  if (!logBase64) return { ok: false, reason: 'sem gravação' };
  try {
    const res = await fetch(`${httpBase(serverUrl)}/echoes`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ seed: seed >>> 0, log: logBase64 }),
    });
    if (!res.ok) return { ok: false, reason: `servidor respondeu ${res.status}` };
    const body = (await res.json()) as { accepted?: unknown };
    return { ok: true, accepted: body.accepted === true };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : 'falha de rede' };
  }
};
