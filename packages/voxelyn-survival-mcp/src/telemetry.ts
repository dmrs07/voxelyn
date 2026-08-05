// Agregacao de telemetria das runs que o AGENTE jogou nesta sessao do
// servidor MCP.
//
// Deliberadamente separado do `TelemetryStore` de @voxelyn/survival-server:
// aquele mede diversao humana (sessao de browser, abandono por aba fechada,
// tempo entre runs) e nao existe motivo para arrastar `pg`/`ws` para um
// processo MCP local. Este modulo mede a MESMA familia de sinal — causa de
// morte, funil por setor, distribuicao de estrelas — mas sobre runs que um
// agente conduziu de proposito, tipicamente em lote, para comparar tuning ou
// achar onde o jogo mata demais. `tag` e o que permite separar lotes (ex.:
// "tuning-atual" vs "tuning-proposto") sem inventar sessao nenhuma.
import type { DamageCause, RunPhase, RunSummary } from '@voxelyn/survival-sim';
import type { AgentRun } from './runs.js';

export type AgentRunRecord = {
  seed: number;
  tag: string;
  summary: RunSummary;
  /** Setor em que a run TERMINOU — a run pode ter morrido antes do ultimo setor. */
  finalSector: number;
  recordedAt: number;
};

type Outcome = Exclude<RunPhase, 'running'>;

const records: AgentRunRecord[] = [];

/** Teto para a lista nao crescer sem limite numa sessao longa de agente. */
const MAX_RECORDS = 20_000;

const deathCauseKind = (cause: DamageCause | null): string | null => (cause ? cause.kind : null);

/**
 * Registra o resultado de uma run TERMINADA para o digest.
 *
 * Devolve `null` sem registrar nada quando a run ainda esta `running`: nao
 * ha sumario nesse estado (ver `finalizeRun` em run.ts), e registrar uma run
 * em andamento inflaria o digest com um resultado que ainda nao aconteceu.
 */
export const recordAgentRun = (run: AgentRun, tag = 'default'): AgentRunRecord | null => {
  const summary = run.state.summary;
  if (!summary) return null;
  const record: AgentRunRecord = {
    seed: run.seed,
    tag,
    summary,
    finalSector: run.state.sector,
    recordedAt: Date.now(),
  };
  records.push(record);
  if (records.length > MAX_RECORDS) records.shift();
  return record;
};

export const listAgentRunRecords = (): readonly AgentRunRecord[] => records;

export const clearAgentRunRecords = (): void => {
  records.length = 0;
};

const median = (values: number[]): number | null => {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? Math.round((sorted[mid - 1] + sorted[mid]) / 2) : sorted[mid];
};

export type TelemetryDigest = {
  runs: number;
  /** Quantas runs entraram no digest por tag, para comparar lotes/experimentos. */
  runsByTag: Record<string, number>;
  outcomeCounts: Record<Outcome, number>;
  /** indice 0..3 = quantas runs saíram com aquela contagem de estrelas. */
  starHistogram: [number, number, number, number];
  /** Fracao de runs que ALCANCOU cada setor (indice 0 = setor 1). */
  sectorReach: number[];
  /** Causas de morte (`DamageCause.kind`), da mais comum para a menos. */
  deathCauses: Array<{ cause: string; count: number }>;
  /** Tempo mediano de run, em ticks, por desfecho. */
  medianTicks: Record<Outcome, number | null>;
  /** Tiros por abate, media geral — proxy grosseiro de dificuldade de mira/TTK. */
  avgShotsPerKill: number | null;
  /** Dano medio recebido por run (decimos / 10). */
  avgDamageTaken: number;
};

/**
 * Agrega uma lista de registros. PURA e exportada por ser a unica logica que
 * vale testar isoladamente — `telemetry_digest` so filtra por tag e chama isto.
 */
export const digestOf = (input: readonly AgentRunRecord[]): TelemetryDigest => {
  const starHistogram: [number, number, number, number] = [0, 0, 0, 0];
  const causes = new Map<string, number>();
  const byOutcome = new Map<Outcome, number[]>();
  const sectorCounts = new Map<number, number>();
  const runsByTag: Record<string, number> = {};
  const outcomeCounts: Record<Outcome, number> = { dead: 0, extracted: 0, extracted_with_core: 0 };
  let totalShots = 0;
  let totalKills = 0;
  let totalDamageTaken = 0;

  for (const r of input) {
    runsByTag[r.tag] = (runsByTag[r.tag] ?? 0) + 1;
    const outcome = r.summary.phase as Outcome;
    outcomeCounts[outcome] = (outcomeCounts[outcome] ?? 0) + 1;
    starHistogram[Math.max(0, Math.min(3, r.summary.stars))]++;

    const cause = deathCauseKind(r.summary.deathCause);
    if (cause) causes.set(cause, (causes.get(cause) ?? 0) + 1);

    const list = byOutcome.get(outcome) ?? [];
    list.push(r.summary.ticks);
    byOutcome.set(outcome, list);

    // Funil: alcancar o setor N implica ter alcancado todos os anteriores.
    for (let s = 1; s <= r.finalSector; s++) sectorCounts.set(s, (sectorCounts.get(s) ?? 0) + 1);

    totalShots += r.summary.stats.shotsFired;
    totalKills += Object.values(r.summary.stats.kills).reduce((a, b) => a + b, 0);
    totalDamageTaken += r.summary.stats.damageTakenTenths / 10;
  }

  const total = input.length;
  const maxSector = Math.max(0, ...sectorCounts.keys());
  const sectorReach: number[] = [];
  for (let s = 1; s <= maxSector; s++) {
    sectorReach.push(total > 0 ? (sectorCounts.get(s) ?? 0) / total : 0);
  }

  return {
    runs: total,
    runsByTag,
    outcomeCounts,
    starHistogram,
    sectorReach,
    deathCauses: [...causes.entries()]
      .map(([cause, count]) => ({ cause, count }))
      .sort((a, b) => b.count - a.count),
    medianTicks: {
      dead: median(byOutcome.get('dead') ?? []),
      extracted: median(byOutcome.get('extracted') ?? []),
      extracted_with_core: median(byOutcome.get('extracted_with_core') ?? []),
    },
    avgShotsPerKill: totalKills > 0 ? totalShots / totalKills : null,
    avgDamageTaken: total > 0 ? totalDamageTaken / total : 0,
  };
};

export const telemetryDigest = (tag?: string): TelemetryDigest =>
  digestOf(tag ? records.filter((r) => r.tag === tag) : records);
