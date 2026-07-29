// Telemetria de diversao.
//
// A pergunta que este modulo existe para responder e a que a spec chama de
// gate da Fase 1: "existe vontade clara de jogar de novo?". Ela nunca tinha
// sido medida — a secao 13 lista as metricas certas e nenhuma existia.
//
// ---------------------------------------------------------------------------
// A UNIDADE DE DIVERSAO E A SESSAO, NAO A RUN.
// ---------------------------------------------------------------------------
// Quase toda telemetria de jogo erra isso. Um jogador que morre cinco vezes
// seguidas e continua esta se divertindo; um que extrai uma vez e fecha a aba
// nao esta. Medir "taxa de vitoria" ou "duracao media de run" nao distingue os
// dois. Por isso os dois campos mais importantes daqui nao descrevem a run:
// `runIndex` e `msSincePreviousRun` descrevem a SESSAO em volta dela, e sao o
// que transforma runs soltas em comportamento.
//
// Do mesmo jeito, ABANDONO e MORTE nao sao a mesma coisa e nunca podem cair no
// mesmo balde: morrer e o jogo funcionando, fechar a aba no meio e o jogo
// perdendo alguem. Confundir os dois e o erro classico que faz um jogo dificil
// parecer saudavel enquanto sangra jogador.
//
// ---------------------------------------------------------------------------
// ESTE DADO NAO E VERIFICADO. E de propriedade em separado por isso.
// ---------------------------------------------------------------------------
// O ranking re-simula tudo (ver replay.ts). A telemetria NAO pode: ela precisa
// registrar mortes e abandonos, que sao a maioria das runs, e re-simular todas
// custaria mais CPU que o jogo inteiro. O dado aqui vem do cliente e um cliente
// modificado pode envenena-lo.
//
// Isso e aceitavel para diagnostico e inaceitavel para competicao — e por isso
// as duas coisas moram em TABELAS DIFERENTES. A separacao nao e organizacao, e
// uma barreira: ninguem consegue promover telemetria a placar por engano, e
// limpar o placar nao apaga o historico de analise.

export type RunOutcome = 'dead' | 'extracted' | 'extracted_with_core' | 'abandoned';

/**
 * Um evento de telemetria. Sem PII, sem identificador persistente.
 *
 * `session` vive em sessionStorage e morre com a aba de proposito: ele agrupa
 * runs de uma sentada, e nao rastreia uma pessoa entre visitas. Essa escolha
 * custa a metrica de retencao entre dias — que e a que menos importa agora — e
 * evita ter de pedir consentimento para o que hoje e diagnostico interno.
 */
export type TelemetryEvent = {
  session: string;
  /** 1-based dentro da sessao. */
  runIndex: number;
  /** Silencio entre o fim da run anterior e o inicio desta. Null na primeira. */
  msSincePreviousRun: number | null;
  outcome: RunOutcome;
  sector: number;
  ticks: number;
  stars: number;
  contamination: number;
  /** Apenas o `kind` da causa; nunca o objeto inteiro. */
  deathCause: string | null;
  kills: number;
  shots: number;
  damageTakenTenths: number;
  damageDealtTenths: number;
  salvageCompleted: number;
  modulesAcquired: number;
  discoveries: number;
  /** Preset grafico: melhor proxy barato de "que aparelho e esse". */
  quality: string | null;
};

/**
 * Janela que conta como "voltou na hora".
 *
 * Trinta segundos e o bastante para ler a tela de resultado e decidir; alem
 * disso a pessoa foi fazer outra coisa. E o numero que define a metrica
 * principal, entao ele fica visivel aqui em vez de enterrado numa consulta.
 */
export const IMMEDIATE_RESTART_MS = 30_000;

export type TelemetryDigest = {
  runs: number;
  sessions: number;
  /**
   * A METRICA. Fracao de runs terminadas que foram seguidas por outra dentro
   * de IMMEDIATE_RESTART_MS.
   */
  immediateRestartRate: number;
  /** Fracao de runs que terminaram por abandono (aba fechada no meio). */
  abandonRate: number;
  /** Quantas runs por sessao, em media. */
  runsPerSession: number;
  /** Distribuicao de estrelas: indice 0..3. Calibra TARGET_SECTOR_TICKS. */
  starHistogram: [number, number, number, number];
  /** Funil: fracao de runs que ALCANCOU cada setor. */
  sectorReach: number[];
  /** Causas de morte, da mais comum para a menos. */
  deathCauses: Array<{ cause: string; count: number }>;
  /** Tempo mediano de run, em ticks, por desfecho. */
  medianTicks: Record<RunOutcome, number | null>;
};

export interface TelemetryStore {
  record(event: TelemetryEvent): Promise<void>;
  digest(limit: number): Promise<TelemetryDigest>;
  close(): Promise<void>;
}

const median = (values: number[]): number | null => {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? Math.round((sorted[mid - 1] + sorted[mid]) / 2) : sorted[mid];
};

/**
 * Agrega uma lista de eventos. PURA, e exportada, porque e a unica logica
 * interessante do modulo e a que precisa de teste — os dois stores apenas a
 * alimentam com linhas.
 */
export const digestOf = (events: readonly TelemetryEvent[]): TelemetryDigest => {
  const sessions = new Set(events.map((e) => e.session));
  const starHistogram: [number, number, number, number] = [0, 0, 0, 0];
  const causes = new Map<string, number>();
  const byOutcome = new Map<RunOutcome, number[]>();
  const sectorCounts = new Map<number, number>();
  let abandoned = 0;
  let immediate = 0;
  let restartable = 0;

  for (const e of events) {
    if (e.outcome === 'abandoned') abandoned++;
    starHistogram[Math.max(0, Math.min(3, e.stars))]++;

    // Uma run so conta para a taxa de reinicio se houve uma run ANTES dela na
    // mesma sessao: a primeira nao pode ser um "voltou", e incluir todas
    // diluiria a metrica pelo numero de sessoes de uma run so.
    if (e.msSincePreviousRun !== null) {
      restartable++;
      if (e.msSincePreviousRun <= IMMEDIATE_RESTART_MS) immediate++;
    }

    if (e.deathCause) causes.set(e.deathCause, (causes.get(e.deathCause) ?? 0) + 1);

    const list = byOutcome.get(e.outcome) ?? [];
    list.push(e.ticks);
    byOutcome.set(e.outcome, list);

    // Funil: alcancar o setor N implica ter alcancado todos os anteriores.
    for (let s = 1; s <= e.sector; s++) sectorCounts.set(s, (sectorCounts.get(s) ?? 0) + 1);
  }

  const total = events.length;
  const maxSector = Math.max(0, ...sectorCounts.keys());
  const sectorReach: number[] = [];
  for (let s = 1; s <= maxSector; s++) {
    sectorReach.push(total > 0 ? (sectorCounts.get(s) ?? 0) / total : 0);
  }

  return {
    runs: total,
    sessions: sessions.size,
    immediateRestartRate: restartable > 0 ? immediate / restartable : 0,
    abandonRate: total > 0 ? abandoned / total : 0,
    runsPerSession: sessions.size > 0 ? total / sessions.size : 0,
    starHistogram,
    sectorReach,
    deathCauses: [...causes.entries()]
      .map(([cause, count]) => ({ cause, count }))
      .sort((a, b) => b.count - a.count),
    medianTicks: {
      dead: median(byOutcome.get('dead') ?? []),
      extracted: median(byOutcome.get('extracted') ?? []),
      extracted_with_core: median(byOutcome.get('extracted_with_core') ?? []),
      abandoned: median(byOutcome.get('abandoned') ?? []),
    },
  };
};

// ---------------------------------------------------------------------------
// Memoria
// ---------------------------------------------------------------------------

export class MemoryTelemetry implements TelemetryStore {
  private readonly events: TelemetryEvent[] = [];
  /** Teto para uma instancia sem banco nao crescer sem limite. */
  constructor(private readonly capacity = 20_000) {}

  async record(event: TelemetryEvent): Promise<void> {
    this.events.push(event);
    if (this.events.length > this.capacity) this.events.shift();
  }

  async digest(limit: number): Promise<TelemetryDigest> {
    return digestOf(this.events.slice(-limit));
  }

  async close(): Promise<void> {}
}

// ---------------------------------------------------------------------------
// Postgres
// ---------------------------------------------------------------------------

type PgPool = {
  query: (text: string, values?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>;
  end: () => Promise<void>;
};

const SCHEMA = `
create table if not exists telemetry_runs (
  id              bigserial primary key,
  session         text        not null,
  run_index       integer     not null,
  ms_since_prev   integer,
  outcome         text        not null,
  sector          smallint    not null,
  ticks           integer     not null,
  stars           smallint    not null,
  contamination   real        not null,
  death_cause     text,
  kills           integer     not null,
  shots           integer     not null,
  damage_taken    integer     not null,
  damage_dealt    integer     not null,
  salvage         integer     not null,
  modules         integer     not null,
  discoveries     integer     not null,
  quality         text,
  created_at      timestamptz not null default now()
);
-- A leitura e sempre "as N mais recentes": um indice por tempo serve todas as
-- consultas do digest sem varrer a tabela inteira quando ela crescer.
create index if not exists telemetry_recent_idx on telemetry_runs (created_at desc);
`;

const rowToEvent = (row: Record<string, unknown>): TelemetryEvent => ({
  session: String(row.session),
  runIndex: Number(row.run_index),
  msSincePreviousRun: row.ms_since_prev === null ? null : Number(row.ms_since_prev),
  outcome: String(row.outcome) as RunOutcome,
  sector: Number(row.sector),
  ticks: Number(row.ticks),
  stars: Number(row.stars),
  contamination: Number(row.contamination),
  deathCause: row.death_cause === null ? null : String(row.death_cause),
  kills: Number(row.kills),
  shots: Number(row.shots),
  damageTakenTenths: Number(row.damage_taken),
  damageDealtTenths: Number(row.damage_dealt),
  salvageCompleted: Number(row.salvage),
  modulesAcquired: Number(row.modules),
  discoveries: Number(row.discoveries),
  quality: row.quality === null ? null : String(row.quality),
});

export class PostgresTelemetry implements TelemetryStore {
  constructor(private readonly pool: PgPool) {}

  static async connect(databaseUrl: string): Promise<PostgresTelemetry> {
    const pg = (await import('pg')) as unknown as {
      default?: { Pool: new (config: unknown) => PgPool };
      Pool?: new (config: unknown) => PgPool;
    };
    const Pool = pg.Pool ?? pg.default?.Pool;
    if (!Pool) throw new Error('pg: construtor Pool nao encontrado');
    const pool = new Pool({
      connectionString: databaseUrl,
      ssl: databaseUrl.includes('localhost') ? undefined : { rejectUnauthorized: false },
      max: 2,
      idleTimeoutMillis: 30_000,
    });
    await pool.query(SCHEMA);
    return new PostgresTelemetry(pool);
  }

  async record(event: TelemetryEvent): Promise<void> {
    await this.pool.query(
      `insert into telemetry_runs
        (session, run_index, ms_since_prev, outcome, sector, ticks, stars, contamination,
         death_cause, kills, shots, damage_taken, damage_dealt, salvage, modules, discoveries, quality)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
      [
        event.session,
        event.runIndex,
        event.msSincePreviousRun,
        event.outcome,
        event.sector,
        event.ticks,
        event.stars,
        event.contamination,
        event.deathCause,
        event.kills,
        event.shots,
        event.damageTakenTenths,
        event.damageDealtTenths,
        event.salvageCompleted,
        event.modulesAcquired,
        event.discoveries,
        event.quality,
      ],
    );
  }

  async digest(limit: number): Promise<TelemetryDigest> {
    // Agrega em JS e nao em SQL de propósito: o digest e a MESMA funcao pura
    // usada pelo store de memoria, entao os dois caminhos nao podem divergir e
    // ha um so lugar para testar. O volume de um alpha cabe folgado nisso.
    const result = await this.pool.query(
      `select * from telemetry_runs order by created_at desc limit $1`,
      [limit],
    );
    return digestOf(result.rows.map(rowToEvent));
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}

export const createTelemetry = async (
  databaseUrl: string | undefined,
  log: (line: Record<string, unknown>) => void,
): Promise<TelemetryStore> => {
  if (!databaseUrl) {
    log({ ev: 'telemetry_memory', reason: 'DATABASE_URL ausente' });
    return new MemoryTelemetry();
  }
  try {
    const store = await PostgresTelemetry.connect(databaseUrl);
    log({ ev: 'telemetry_postgres' });
    return store;
  } catch (err) {
    log({ ev: 'telemetry_fallback', error: err instanceof Error ? err.message : String(err) });
    return new MemoryTelemetry();
  }
};
