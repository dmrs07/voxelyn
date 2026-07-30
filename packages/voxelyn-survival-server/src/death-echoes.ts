// Persistência do pool de Ecos do Veio.
//
// Duas implementações atrás de uma interface, escolhidas pelo AMBIENTE e não por
// configuração — o mesmo desenho do ranking, e pela mesma razão: com
// DATABASE_URL, Postgres; sem, memória. O fallback é o que faz `pnpm dev` e a
// suíte rodarem sem um banco por perto.
//
// A TABELA FICA SEPARADA DO LEADERBOARD E DA TELEMETRIA, de propósito. O
// repositório já distingue dado competitivo verificado de dado diagnóstico não
// verificado, e um eco com recompensa não pode nascer de telemetria arbitrária.
// Misturar as três numa tabela só apagaria essa fronteira no dia em que a Etapa 4
// fizer um eco valer uma carga de módulo.
//
// O QUE ENTRA AQUI JÁ É VERDADE. Nenhuma cápsula chega deste módulo vinda direto
// de um cliente: co-op é capturado pelo servidor que simulou a morte, e solo
// passa por `verifySoloDeath`, que re-simula o log. Este arquivo guarda, amostra
// e expira; ele não julga.

import {
  parseDeathEchoCapsule,
  type DeathEchoCapsule,
  type DeathEchoTrace,
} from '@voxelyn/survival-protocol';

export type DeathEchoOriginKind = 'coop' | 'solo';

export type DeathEchoRecordInput = {
  capsule: DeathEchoCapsule;
  origin: DeathEchoOriginKind;
  /**
   * Identidade da RUN de origem, para deduplicar.
   *
   * No solo é o digest canônico do log — o mesmo do leaderboard —, então reenviar
   * a mesma run não multiplica o corpo dela no pool. No co-op é derivado de sala,
   * setor, tick e slot, que identifica uma morte específica de forma estável.
   */
  sourceDigest: string;
};

export type DeathEchoSampleQuery = {
  sector: number;
  /**
   * Restringe à seed do contrato coletivo.
   *
   * É o que faz o contrato funcionar: cápsulas da mesma seed voltam à coordenada
   * real no cliente, porque a projeção reconhece seed, dimensões e versões.
   */
  seed?: number;
  limit?: number;
};

export interface DeathEchoStore {
  /** Devolve false quando a run de origem já estava no pool. */
  record(input: DeathEchoRecordInput): Promise<boolean>;
  sample(query: DeathEchoSampleQuery): Promise<DeathEchoCapsule[]>;
  close(): Promise<void>;
}

/**
 * Quantas vezes um eco pode ser manifestado antes de sair do pool.
 *
 * A spec pede que ecos expirem, e o motivo é o oposto de economia de espaço: uma
 * cápsula que reaparece indefinidamente deixa de ser uma ocorrência e vira
 * mobília. Contar manifestações — e não idade — faz o eco raro sobreviver mais
 * tempo que o eco que já foi visto por todo mundo.
 */
export const DEATH_ECHO_MAX_MANIFESTS = 40;

/**
 * Mortes curtas demais não entram no pool.
 *
 * 15 segundos a 20 Hz. Quem morreu nos primeiros segundos não tem história: a
 * carcaça apareceria no começo de outro mapa dizendo apenas "alguém entrou e
 * morreu", que é a única lição que o jogo não precisa ensinar.
 */
export const DEATH_ECHO_MIN_TICKS = 15 * 20;

export const DEATH_ECHO_SAMPLE_DEFAULT = 8;
export const DEATH_ECHO_SAMPLE_MAX = 24;

const clampLimit = (limit: number | undefined): number =>
  Math.max(1, Math.min(DEATH_ECHO_SAMPLE_MAX, limit ?? DEATH_ECHO_SAMPLE_DEFAULT));

/** A cápsula é elegível ao pool comunitário? */
export const isDeathEchoEligible = (capsule: DeathEchoCapsule): boolean =>
  capsule.ticks >= DEATH_ECHO_MIN_TICKS;

type Row = {
  id: number;
  capsule: DeathEchoCapsule;
  origin: DeathEchoOriginKind;
  timesManifested: number;
};

/**
 * Ordem da amostra: MENOS manifestado primeiro.
 *
 * Não é aleatória de propósito. Aleatório concentraria exposição por azar —
 * algumas cápsulas apareceriam dez vezes enquanto outras nunca — e tornaria a
 * amostra irreprodutível em teste. Menos manifestado primeiro espalha a exposição
 * sozinho e caminha naturalmente para a expiração.
 */
const compareRows = (a: Row, b: Row): number =>
  a.timesManifested - b.timesManifested || a.id - b.id;

// ---------------------------------------------------------------------------
// Memoria
// ---------------------------------------------------------------------------

export class MemoryDeathEchoStore implements DeathEchoStore {
  private readonly rows: Row[] = [];
  private readonly digests = new Set<string>();
  private nextId = 1;

  async record(input: DeathEchoRecordInput): Promise<boolean> {
    if (!isDeathEchoEligible(input.capsule)) return false;
    if (this.digests.has(input.sourceDigest)) return false;
    this.digests.add(input.sourceDigest);
    this.rows.push({
      id: this.nextId++,
      capsule: input.capsule,
      origin: input.origin,
      timesManifested: 0,
    });
    return true;
  }

  async sample(query: DeathEchoSampleQuery): Promise<DeathEchoCapsule[]> {
    const eligible = this.rows
      .filter(
        (row) =>
          row.capsule.sector === query.sector &&
          row.timesManifested < DEATH_ECHO_MAX_MANIFESTS &&
          (query.seed === undefined || row.capsule.sourceSeed === (query.seed >>> 0)),
      )
      .sort(compareRows)
      .slice(0, clampLimit(query.limit));
    for (const row of eligible) row.timesManifested += 1;
    return eligible.map((row) => row.capsule);
  }

  async close(): Promise<void> {}

  /** Apenas para regressão e diagnóstico; não faz parte do protocolo HTTP. */
  size(): number {
    return this.rows.length;
  }
}

// ---------------------------------------------------------------------------
// Postgres
// ---------------------------------------------------------------------------

type PgPool = {
  query: (text: string, values?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>;
  end: () => Promise<void>;
};

/**
 * Colunas explícitas em vez da assinatura topológica opaca que a spec esboçava.
 *
 * O esboço previa um `topology_signature` empacotado. Colunas separadas custam o
 * mesmo e permitem responder no console do banco perguntas que a operação de
 * verdade faz — "em que profundidade as pessoas morrem?", "quantas mortes em
 * biofluido?" — sem decodificar um inteiro à mão.
 *
 * `seed`, dimensões, célula e direção NÃO são opcionais: sem elas a cápsula não
 * pode ser reconstruída, e sem seed o contrato coletivo perde a coordenada real,
 * que é a razão de ele existir.
 */
const SCHEMA = `
create table if not exists death_echoes (
  id                bigserial primary key,
  source_digest     text        not null unique,
  origin            text        not null,
  echo_id           text        not null,
  seed              bigint      not null,
  simulation_version integer    not null,
  content_version   integer     not null,
  sector            smallint    not null,
  source_width      integer     not null,
  source_height     integer     not null,
  source_x          integer     not null,
  source_y          integer     not null,
  progress_q        smallint    not null,
  openness          smallint    not null,
  surface           smallint    not null,
  near_ore          boolean     not null,
  facing_x          real        not null,
  facing_y          real        not null,
  death_cause       jsonb       not null,
  final_trace       jsonb,
  ticks             integer     not null,
  times_manifested  integer     not null default 0,
  created_at        timestamptz not null default now()
);
-- A amostra pergunta sempre a mesma coisa: setor, ainda não expirado, menos
-- manifestado primeiro. O indice tem de casar com compareRows — um que discorde
-- devolve as linhas certas na ordem errada.
create index if not exists death_echo_sector_idx
  on death_echoes (sector, times_manifested asc, id asc);
create index if not exists death_echo_contract_idx
  on death_echoes (seed, sector, times_manifested asc, id asc);
`;

const rowToCapsule = (row: Record<string, unknown>): DeathEchoCapsule | null => {
  const trace = row.final_trace;
  return parseDeathEchoCapsule({
    id: String(row.echo_id),
    // bigint volta do pg como STRING para nao perder precisao acima de 2^53.
    // Number() e seguro aqui porque a seed e uint32 por construcao.
    sourceSeed: Number(row.seed),
    sourceSimulationVersion: Number(row.simulation_version),
    sourceContentVersion: Number(row.content_version),
    sector: Number(row.sector),
    sourceWidth: Number(row.source_width),
    sourceHeight: Number(row.source_height),
    sourceX: Number(row.source_x),
    sourceY: Number(row.source_y),
    progressQ: Number(row.progress_q),
    openness: Number(row.openness),
    surface: Number(row.surface),
    nearOre: row.near_ore === true,
    facingX: Number(row.facing_x),
    facingY: Number(row.facing_y),
    cause: row.death_cause,
    ticks: Number(row.ticks),
    ...(trace === null || trace === undefined ? {} : { finalTrace: trace as DeathEchoTrace }),
  });
};

export class PostgresDeathEchoStore implements DeathEchoStore {
  constructor(private readonly pool: PgPool) {}

  static async connect(databaseUrl: string): Promise<PostgresDeathEchoStore> {
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
    return new PostgresDeathEchoStore(pool);
  }

  async record(input: DeathEchoRecordInput): Promise<boolean> {
    if (!isDeathEchoEligible(input.capsule)) return false;
    const c = input.capsule;
    // `on conflict do nothing` deduplica no BANCO e nao na aplicacao: duas
    // instancias, ou dois POSTs simultaneos do mesmo cliente, correriam entre o
    // "ja existe?" e o insert. O indice unico e a unica barreira sem janela.
    const result = await this.pool.query(
      `insert into death_echoes (
         source_digest, origin, echo_id, seed, simulation_version, content_version,
         sector, source_width, source_height, source_x, source_y,
         progress_q, openness, surface, near_ore, facing_x, facing_y,
         death_cause, final_trace, ticks
       ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
       on conflict (source_digest) do nothing
       returning id`,
      [
        input.sourceDigest,
        input.origin,
        c.id,
        c.sourceSeed,
        c.sourceSimulationVersion,
        c.sourceContentVersion,
        c.sector,
        c.sourceWidth,
        c.sourceHeight,
        c.sourceX,
        c.sourceY,
        c.progressQ,
        c.openness,
        c.surface,
        c.nearOre,
        c.facingX,
        c.facingY,
        JSON.stringify(c.cause),
        c.finalTrace ? JSON.stringify(c.finalTrace) : null,
        c.ticks,
      ],
    );
    return result.rows.length > 0;
  }

  async sample(query: DeathEchoSampleQuery): Promise<DeathEchoCapsule[]> {
    const values: unknown[] = [query.sector, DEATH_ECHO_MAX_MANIFESTS];
    let where = 'sector = $1 and times_manifested < $2';
    if (query.seed !== undefined) {
      values.push(query.seed >>> 0);
      where += ` and seed = $${values.length}`;
    }
    values.push(clampLimit(query.limit));
    // UPDATE ... RETURNING em vez de SELECT e depois UPDATE: manifestar é parte
    // de amostrar, e separar em dois comandos abriria uma janela em que duas
    // requisições simultâneas devolvem a mesma cápsula sem contar as duas vezes.
    const result = await this.pool.query(
      `update death_echoes set times_manifested = times_manifested + 1
       where id in (
         select id from death_echoes where ${where}
         order by times_manifested asc, id asc
         limit $${values.length}
       )
       returning *`,
      values,
    );
    return result.rows
      .map(rowToCapsule)
      .filter((capsule): capsule is DeathEchoCapsule => capsule !== null);
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}

/**
 * Escolhe o store pelo ambiente.
 *
 * Uma falha de conexão NÃO derruba o servidor, pela mesma razão do ranking: o
 * jogo funciona sem pool, e indisponibilidade de banco virando indisponibilidade
 * de jogo seria trocar a funcionalidade principal por uma acessória.
 */
export const createDeathEchoStore = async (
  databaseUrl: string | undefined,
  log: (line: Record<string, unknown>) => void,
): Promise<DeathEchoStore> => {
  if (!databaseUrl) {
    log({ ev: 'death_echoes_memory', reason: 'DATABASE_URL ausente' });
    return new MemoryDeathEchoStore();
  }
  try {
    const store = await PostgresDeathEchoStore.connect(databaseUrl);
    log({ ev: 'death_echoes_postgres' });
    return store;
  } catch (err) {
    log({ ev: 'death_echoes_fallback', error: err instanceof Error ? err.message : String(err) });
    return new MemoryDeathEchoStore();
  }
};
