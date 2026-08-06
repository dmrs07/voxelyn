// Telemetria da ARENA DE CHEFES — separada de propósito de `telemetry.ts`.
//
// A telemetria de campanha mede DIVERSAO (sessao, abandono, vontade de
// reiniciar): a unidade dela e a sessao de jogo, e os campos que ela produz
// (`runIndex`, `msSincePreviousRun`) nao significam nada para uma run de
// arena, que nao tem sessao — e uma luta isolada contra um chefe escolhido,
// com HP/eco/modulos escolhidos. Misturar as duas tabelas contaminaria o
// funil de setor e a taxa de abandono da campanha com runs que nunca foram
// uma expedicao de verdade.
//
// A pergunta que ESTE modulo responde e outra: para ESTE chefe, com ESTE
// loadout, quantas tentativas terminam em vitoria? Quanto tempo leva? Quanto
// dano o chefe realmente causa? E o insumo de balanceamento por encontro, nao
// por sessao — por isso vive em tabela, store e digest proprios.

export type ArenaOutcome = 'boss_killed' | 'player_dead' | 'abandoned';

export type ArenaTelemetryEvent = {
  boss: string;
  seed: number;
  generation: string;
  sector: number;
  startingHp: number;
  ability: string;
  /** Loadout normalizado: ordem alfabetica, para duas submissoes do MESMO
   *  conjunto de modulos caírem no mesmo balde independente da ordem em que
   *  o testador marcou as caixas. */
  modules: string[];
  /** Hash do tuning efetivo (ver `hashPlayerTuning` em @voxelyn/survival-sim):
   *  o que impede comparar uma run de HP 100 com uma de HP 400 como se
   *  fossem o mesmo experimento. */
  tuningHash: string;
  outcome: ArenaOutcome;
  ticks: number;
  hpRemaining: number;
  damageDealtTenths: number;
  damageTakenTenths: number;
  shots: number;
  kills: number;
  deathCause: string | null;
};

export type ArenaBossDigest = {
  runs: number;
  outcomeCounts: Record<ArenaOutcome, number>;
  /** Mediana de ticks ate a queda, so sobre runs `boss_killed`. */
  medianTicksToKill: number | null;
  /** Mediana de HP restante ao vencer — proxy grosseiro de "quao apertada" a luta foi. */
  medianHpRemainingOnKill: number | null;
};

export type ArenaTelemetryDigest = {
  runs: number;
  outcomeCounts: Record<ArenaOutcome, number>;
  /** Por chefe: `ARENA_CATALOG` id (ex.: "guardian", "lung_matrix"). */
  byBoss: Record<string, ArenaBossDigest>;
  /** Por loadout (`ability` + modulos ordenados), dentro de CADA chefe. */
  byLoadout: Record<string, Record<string, ArenaBossDigest>>;
};

export interface ArenaTelemetryStore {
  record(event: ArenaTelemetryEvent): Promise<void>;
  digest(limit: number): Promise<ArenaTelemetryDigest>;
  close(): Promise<void>;
}

const OUTCOMES: readonly ArenaOutcome[] = ['boss_killed', 'player_dead', 'abandoned'];
const emptyOutcomeCounts = (): Record<ArenaOutcome, number> => ({
  boss_killed: 0,
  player_dead: 0,
  abandoned: 0,
});

const median = (values: number[]): number | null => {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? Math.round((sorted[mid - 1] + sorted[mid]) / 2) : sorted[mid];
};

/**
 * Chave de agrupamento por loadout. PRECISA incluir `tuningHash` (e, de forma
 * legivel, `startingHp`): sem eles, uma luta com HP 100 e outra com HP 400 —
 * o mesmo eco, os mesmos modulos — cairiam no MESMO balde, e o digest
 * compararia dois experimentos diferentes como se fossem um so. E exatamente
 * o que este campo existe para impedir (ver o comentario de `tuningHash` em
 * `ArenaTelemetryEvent`).
 */
const loadoutKey = (event: ArenaTelemetryEvent): string =>
  `${event.ability}+${[...event.modules].sort().join(',')}+hp${event.startingHp}+${event.tuningHash}`;

const emptyBucket = (): {
  outcomeCounts: Record<ArenaOutcome, number>;
  ticksToKill: number[];
  hpRemainingOnKill: number[];
} => ({ outcomeCounts: emptyOutcomeCounts(), ticksToKill: [], hpRemainingOnKill: [] });

const finalizeBucket = (b: ReturnType<typeof emptyBucket>): ArenaBossDigest => ({
  runs: OUTCOMES.reduce((sum, o) => sum + b.outcomeCounts[o], 0),
  outcomeCounts: b.outcomeCounts,
  medianTicksToKill: median(b.ticksToKill),
  medianHpRemainingOnKill: median(b.hpRemainingOnKill),
});

/**
 * Agrega uma lista de eventos. PURA e exportada pela mesma razao de
 * `digestOf` em telemetry.ts: e a unica logica que vale testar isoladamente.
 */
export const digestOf = (events: readonly ArenaTelemetryEvent[]): ArenaTelemetryDigest => {
  const outcomeCounts = emptyOutcomeCounts();
  // Map em vez de `{}` por chefe/loadout: um `boss` ou `ability` vindo do
  // corpo da requisicao e string ARBITRARIA — `__proto__` como nome de chefe
  // nao pode reescrever o prototipo do objeto de saida.
  const byBoss = new Map<string, ReturnType<typeof emptyBucket>>();
  const byLoadout = new Map<string, Map<string, ReturnType<typeof emptyBucket>>>();

  for (const e of events) {
    outcomeCounts[e.outcome]++;

    const bossBucket = byBoss.get(e.boss) ?? emptyBucket();
    bossBucket.outcomeCounts[e.outcome]++;
    if (e.outcome === 'boss_killed') {
      bossBucket.ticksToKill.push(e.ticks);
      bossBucket.hpRemainingOnKill.push(e.hpRemaining);
    }
    byBoss.set(e.boss, bossBucket);

    const loadouts = byLoadout.get(e.boss) ?? new Map<string, ReturnType<typeof emptyBucket>>();
    const key = loadoutKey(e);
    const loadoutBucket = loadouts.get(key) ?? emptyBucket();
    loadoutBucket.outcomeCounts[e.outcome]++;
    if (e.outcome === 'boss_killed') {
      loadoutBucket.ticksToKill.push(e.ticks);
      loadoutBucket.hpRemainingOnKill.push(e.hpRemaining);
    }
    loadouts.set(key, loadoutBucket);
    byLoadout.set(e.boss, loadouts);
  }

  return {
    runs: events.length,
    outcomeCounts,
    byBoss: Object.fromEntries(
      [...byBoss.entries()].map(([boss, bucket]) => [boss, finalizeBucket(bucket)]),
    ),
    byLoadout: Object.fromEntries(
      [...byLoadout.entries()].map(([boss, loadouts]) => [
        boss,
        Object.fromEntries(
          [...loadouts.entries()].map(([key, bucket]) => [key, finalizeBucket(bucket)]),
        ),
      ]),
    ),
  };
};

// ---------------------------------------------------------------------------
// Memoria
// ---------------------------------------------------------------------------

export class MemoryArenaTelemetry implements ArenaTelemetryStore {
  private readonly events: ArenaTelemetryEvent[] = [];
  constructor(private readonly capacity = 20_000) {}

  async record(event: ArenaTelemetryEvent): Promise<void> {
    this.events.push(event);
    if (this.events.length > this.capacity) this.events.shift();
  }

  async digest(limit: number): Promise<ArenaTelemetryDigest> {
    return digestOf(this.events.slice(-limit));
  }

  async close(): Promise<void> {}
}

// ---------------------------------------------------------------------------
// Postgres — tabela PROPRIA (`arena_runs`), nunca `telemetry_runs`.
// ---------------------------------------------------------------------------

type PgPool = {
  query: (text: string, values?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>;
  end: () => Promise<void>;
};

const SCHEMA = `
create table if not exists arena_runs (
  id                  bigserial primary key,
  boss                text        not null,
  seed                bigint      not null,
  generation          text        not null,
  sector              smallint    not null,
  starting_hp         integer     not null,
  ability             text        not null,
  modules             text        not null,
  tuning_hash         text        not null,
  outcome             text        not null,
  ticks               integer     not null,
  hp_remaining        integer     not null,
  damage_dealt        integer     not null,
  damage_taken        integer     not null,
  shots               integer     not null,
  kills               integer     not null,
  death_cause         text,
  created_at          timestamptz not null default now()
);
create index if not exists arena_runs_recent_idx on arena_runs (created_at desc);
create index if not exists arena_runs_boss_idx on arena_runs (boss);
`;

const rowToEvent = (row: Record<string, unknown>): ArenaTelemetryEvent => ({
  boss: String(row.boss),
  seed: Number(row.seed),
  generation: String(row.generation),
  sector: Number(row.sector),
  startingHp: Number(row.starting_hp),
  ability: String(row.ability),
  modules: String(row.modules).length > 0 ? String(row.modules).split(',') : [],
  tuningHash: String(row.tuning_hash),
  outcome: String(row.outcome) as ArenaOutcome,
  ticks: Number(row.ticks),
  hpRemaining: Number(row.hp_remaining),
  damageDealtTenths: Number(row.damage_dealt),
  damageTakenTenths: Number(row.damage_taken),
  shots: Number(row.shots),
  kills: Number(row.kills),
  deathCause: row.death_cause === null ? null : String(row.death_cause),
});

export class PostgresArenaTelemetry implements ArenaTelemetryStore {
  constructor(private readonly pool: PgPool) {}

  static async connect(databaseUrl: string): Promise<PostgresArenaTelemetry> {
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
    return new PostgresArenaTelemetry(pool);
  }

  async record(event: ArenaTelemetryEvent): Promise<void> {
    await this.pool.query(
      `insert into arena_runs
        (boss, seed, generation, sector, starting_hp, ability, modules, tuning_hash,
         outcome, ticks, hp_remaining, damage_dealt, damage_taken, shots, kills, death_cause)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
      [
        event.boss,
        event.seed,
        event.generation,
        event.sector,
        event.startingHp,
        event.ability,
        event.modules.join(','),
        event.tuningHash,
        event.outcome,
        event.ticks,
        event.hpRemaining,
        event.damageDealtTenths,
        event.damageTakenTenths,
        event.shots,
        event.kills,
        event.deathCause,
      ],
    );
  }

  async digest(limit: number): Promise<ArenaTelemetryDigest> {
    // Agrega em JS, como `telemetry.ts`: mesma funcao pura serve os dois
    // stores, entao os dois caminhos nao podem divergir.
    const result = await this.pool.query(
      `select * from arena_runs order by created_at desc limit $1`,
      [limit],
    );
    return digestOf(result.rows.map(rowToEvent));
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}

export const createArenaTelemetry = async (
  databaseUrl: string | undefined,
  log: (line: Record<string, unknown>) => void,
): Promise<ArenaTelemetryStore> => {
  if (!databaseUrl) {
    log({ ev: 'arena_telemetry_memory', reason: 'DATABASE_URL ausente' });
    return new MemoryArenaTelemetry();
  }
  try {
    const store = await PostgresArenaTelemetry.connect(databaseUrl);
    log({ ev: 'arena_telemetry_postgres' });
    return store;
  } catch (err) {
    log({
      ev: 'arena_telemetry_fallback',
      error: err instanceof Error ? err.message : String(err),
    });
    return new MemoryArenaTelemetry();
  }
};
