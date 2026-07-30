// Memória espacial entre runs: o que ESTE cliente conserva de uma morte.
//
// A cápsula, a assinatura topológica e a projeção não moram mais aqui — moram no
// protocolo, porque agora atravessam a rede e têm três produtores. O que sobra
// neste arquivo é o que é genuinamente do cliente: `localStorage`, o portão da
// captura solo e a mesclagem entre a memória local e o pool comunitário.
//
// A fronteira que este arquivo continua defendendo: ecos são apresentação. Não
// colidem, não dão recurso, não entram no hash e não mudam a reprodução
// `seed + comandos`. No dia em que um eco alterar gameplay, ele deixa de
// pertencer a este caminho e passa a exigir manifesto autoritativo.

import type { RunSummary, SurvivalState } from '@voxelyn/survival-sim';
import {
  DEATH_ECHOES_PER_SECTOR,
  DEATH_ECHO_SHADOWS_PER_SECTOR,
  buildDeathEchoCapsule,
  parseDeathEchoCapsule,
  projectDeathEchoes,
  type DeathEchoCapsule,
  type DeathEchoTraceSample,
  type PlacedDeathEcho,
} from '@voxelyn/survival-protocol';

const KEY = 'voxelyn.death-echoes.v1';
const SCHEMA = 1;
export const DEATH_ECHO_HISTORY_LIMIT = 24;

export type {
  DeathEchoCapsule,
  DeathEchoTraceSample,
  PlacedDeathEcho,
} from '@voxelyn/survival-protocol';

export type DeathEchoRecords = {
  schema: number;
  nextSerial: number;
  /** Mais novo primeiro. */
  echoes: DeathEchoCapsule[];
};

export type ApplyDeathEchoOnceResult = {
  records: DeathEchoRecords;
  identity: string | null;
  applied: boolean;
  echo: DeathEchoCapsule | null;
};

export const emptyDeathEchoRecords = (): DeathEchoRecords => ({
  schema: SCHEMA,
  nextSerial: 1,
  echoes: [],
});

const finiteInt = (value: unknown, min: number, max: number): number | null => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  const integer = Math.floor(value);
  if (integer < min || integer > max) return null;
  return integer;
};

export const decodeDeathEchoRecords = (raw: string | null): DeathEchoRecords => {
  if (!raw) return emptyDeathEchoRecords();
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return emptyDeathEchoRecords();
    const data = parsed as { schema?: unknown; nextSerial?: unknown; echoes?: unknown };
    if (data.schema !== SCHEMA || !Array.isArray(data.echoes)) return emptyDeathEchoRecords();
    const echoes = data.echoes
      .map(parseDeathEchoCapsule)
      .filter((echo): echo is DeathEchoCapsule => echo !== null)
      .slice(0, DEATH_ECHO_HISTORY_LIMIT);
    const requestedSerial = finiteInt(data.nextSerial, 1, Number.MAX_SAFE_INTEGER);
    const nextSerial = requestedSerial ?? echoes.length + 1;
    return { schema: SCHEMA, nextSerial, echoes };
  } catch {
    return emptyDeathEchoRecords();
  }
};

export const loadDeathEchoRecords = (): DeathEchoRecords => {
  try {
    return decodeDeathEchoRecords(localStorage.getItem(KEY));
  } catch {
    return emptyDeathEchoRecords();
  }
};

export const saveDeathEchoRecords = (records: DeathEchoRecords): void => {
  try {
    localStorage.setItem(KEY, JSON.stringify(records));
  } catch {
    // O jogo continua sem memória espacial quando storage está bloqueado.
  }
};

export const deathEchoRunIdentity = (summary: RunSummary): string =>
  `${summary.seed}:${summary.phase}:${summary.ticks}`;

/**
 * A cápsula da própria morte, quando este cliente tem PROVA do que aconteceu.
 *
 * Solo apenas, e por um motivo de verdade narrativa e não de esforço: no co-op
 * `summary.deathCause` descreve a causa que encerrou a SALA, não a que matou este
 * Prospector. Casar a posição local com aquela causa fabricaria uma morte falsa.
 * O co-op é capturado pelo servidor, que tem as duas coisas associadas.
 */
export const captureDeathEcho = (
  state: SurvivalState,
  id: string,
  trace: readonly DeathEchoTraceSample[] = [],
): DeathEchoCapsule | null => {
  if (
    state.config.playerCount !== 1 ||
    state.phase !== 'dead' ||
    !state.summary ||
    !state.summary.deathCause
  ) return null;
  return buildDeathEchoCapsule(state, {
    id,
    x: state.player.x,
    y: state.player.y,
    facingX: state.player.facing.x,
    facingY: state.player.facing.y,
    cause: state.summary.deathCause,
    ticks: state.summary.ticks,
    trace,
  });
};

export const applyDeathEchoOnce = (
  records: DeathEchoRecords,
  state: SurvivalState,
  previousIdentity: string | null,
  trace: readonly DeathEchoTraceSample[] = [],
): ApplyDeathEchoOnceResult => {
  if (state.phase !== 'dead' || !state.summary) {
    return { records, identity: previousIdentity, applied: false, echo: null };
  }
  const identity = deathEchoRunIdentity(state.summary);
  if (identity === previousIdentity) return { records, identity, applied: false, echo: null };
  const echo = captureDeathEcho(state, `${identity}:${records.nextSerial}`, trace);
  if (!echo) return { records, identity, applied: false, echo: null };
  return {
    identity,
    applied: true,
    echo,
    records: {
      schema: SCHEMA,
      nextSerial: records.nextSerial + 1,
      echoes: [echo, ...records.echoes].slice(0, DEATH_ECHO_HISTORY_LIMIT),
    },
  };
};

/**
 * Teto total de corpos por setor: um interativo mais as sombras visuais.
 *
 * Vem da spec §7, e o número é pequeno de propósito. Encontrar um eco tem de
 * continuar parecendo uma ocorrência; um mapa que sempre tem quatro carcaças
 * ensina que carcaça é decoração.
 */
export const DEATH_ECHOES_VISIBLE_PER_SECTOR =
  DEATH_ECHOES_PER_SECTOR + DEATH_ECHO_SHADOWS_PER_SECTOR;

/**
 * A ordem em que os corpos disputam as células do setor.
 *
 * A memória local vem PRIMEIRO, sempre. A run em que o jogador morreu ontem diz
 * mais a ele do que a de um estranho, e é ela que tem de sobreviver quando só há
 * uma célula aceitável. O pool entra depois, preenchendo as sombras.
 *
 * Duplicatas por id são removidas porque o pool pode devolver a cápsula que este
 * mesmo cliente enviou — e o próprio corpo aparecendo duas vezes no mesmo mapa
 * leria como defeito.
 */
export const mergeDeathEchoSources = (
  local: readonly DeathEchoCapsule[],
  pool: readonly DeathEchoCapsule[],
): DeathEchoCapsule[] => {
  const seen = new Set<string>();
  const merged: DeathEchoCapsule[] = [];
  for (const echo of [...local, ...pool]) {
    if (seen.has(echo.id)) continue;
    seen.add(echo.id);
    merged.push(echo);
  }
  return merged;
};

export const projectSectorEchoes = (
  state: SurvivalState,
  local: readonly DeathEchoCapsule[],
  pool: readonly DeathEchoCapsule[],
  limit: number = DEATH_ECHOES_VISIBLE_PER_SECTOR,
): PlacedDeathEcho[] => projectDeathEchoes(state, mergeDeathEchoSources(local, pool), limit);
