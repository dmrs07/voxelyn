// Persistencia do ranking.
//
// Duas implementacoes atras de uma interface, e a escolha e por ambiente, nao
// por configuracao: com DATABASE_URL, Postgres; sem, memoria. O fallback nao e
// "modo degradado" — e o que faz `pnpm dev` e a suite de testes rodarem sem um
// banco por perto, que e a diferenca entre um teste que qualquer um roda e um
// que so roda na maquina de quem configurou o ambiente.
//
// O QUE ENTRA AQUI JA E VERDADE. Nenhuma entrada chega deste modulo vinda
// direto do cliente: runs de co-op sao gravadas pelo servidor que as simulou, e
// runs solo passam por `verifySoloRun`. Este arquivo guarda e ordena; ele nao
// julga.

import type { RunSummary } from '@voxelyn/survival-sim';

export type LeaderboardMode = 'solo' | 'coop';

export type LeaderboardEntry = {
  id: number;
  name: string;
  seed: number;
  stars: number;
  ticks: number;
  phase: string;
  mode: LeaderboardMode;
  kills: number;
  /**
   * Minerio da run. Desempata entre estrelas e tempo iguais.
   *
   * `not null default 0` no banco em vez de nulavel: bancos que ja existiam
   * ganham zero, que e a resposta correta — aquelas runs foram jogadas quando
   * minerio nao existia, e nao "com minerio desconhecido".
   */
  ore: number;
  createdAt: string;
};

export type SubmitInput = {
  name: string;
  mode: LeaderboardMode;
  summary: RunSummary;
  /** Digest do replay, para deduplicar reenvio. Null para runs de co-op. */
  digest: string | null;
};

export type LeaderboardQuery = {
  limit?: number;
  /** Restringe a uma seed, para o placar "desta descida". */
  seed?: number;
  mode?: LeaderboardMode;
};

export interface LeaderboardStore {
  /** Devolve a entrada gravada, ou null se ja existia (dedupe por digest). */
  submit(input: SubmitInput): Promise<LeaderboardEntry | null>;
  top(query: LeaderboardQuery): Promise<LeaderboardEntry[]>;
  close(): Promise<void>;
}

const totalKills = (summary: RunSummary): number =>
  Object.values(summary.stats.kills).reduce((a, b) => a + b, 0);

/** Only successful extractions are eligible for either leaderboard mode. */
export const isLeaderboardEligible = (summary: RunSummary): boolean =>
  summary.phase === 'extracted' || summary.phase === 'extracted_with_core';

/**
 * A ordenacao do ranking, num lugar so.
 *
 * Mais estrelas primeiro; entre nota igual, MENOS TEMPO. E a mesma escada das
 * estrelas — a terceira ja e "a segunda com pressa" —, entao ordenar por tempo
 * dentro da nota nao introduz um criterio novo, so continua o que a nota
 * comecou. Empate desempata pelo mais antigo: quem chegou primeiro fica na
 * frente, e o ranking nao se reordena sozinho quando ninguem melhorou nada.
 */
/**
 * Mais estrelas, menos tempo, mais MINERIO, e por fim quem chegou antes.
 *
 * O minerio entra DEPOIS do tempo, e nao antes, de proposito. Ele nao pode virar
 * um objetivo que compete com a corrida — a terceira estrela ja e "a segunda com
 * pressa", e minerar custa tempo. Como desempate ele so decide entre duas runs
 * que ja empataram no que o jogo cobra, e ai a pergunta "quem tirou mais do
 * Veio?" e a unica que sobra, alem de ser a que a ficcao faria.
 */
export const compareEntries = (a: LeaderboardEntry, b: LeaderboardEntry): number =>
  b.stars - a.stars || a.ticks - b.ticks || b.ore - a.ore || a.id - b.id;

export const DEFAULT_LIMIT = 25;
export const MAX_LIMIT = 100;

const clampLimit = (limit: number | undefined): number =>
  Math.max(1, Math.min(MAX_LIMIT, limit ?? DEFAULT_LIMIT));

// ---------------------------------------------------------------------------
// Memoria
// ---------------------------------------------------------------------------

export class MemoryLeaderboard implements LeaderboardStore {
  private readonly rows: LeaderboardEntry[] = [];
  private readonly digests = new Set<string>();
  private nextId = 1;

  async submit(input: SubmitInput): Promise<LeaderboardEntry | null> {
    if (!isLeaderboardEligible(input.summary)) return null;
    if (input.digest && this.digests.has(input.digest)) return null;
    if (input.digest) this.digests.add(input.digest);
    const entry: LeaderboardEntry = {
      id: this.nextId++,
      name: input.name,
      seed: input.summary.seed,
      stars: input.summary.stars,
      ticks: input.summary.ticks,
      phase: input.summary.phase,
      mode: input.mode,
      kills: totalKills(input.summary),
      ore: input.summary.stats.oreCollected,
      createdAt: new Date().toISOString(),
    };
    this.rows.push(entry);
    return entry;
  }

  async top(query: LeaderboardQuery): Promise<LeaderboardEntry[]> {
    return this.rows
      .filter(
        (r) =>
          r.phase !== 'dead' &&
          (query.seed === undefined || r.seed === query.seed) &&
          (query.mode === undefined || r.mode === query.mode),
      )
      .sort(compareEntries)
      .slice(0, clampLimit(query.limit));
  }

  async close(): Promise<void> {}
}

// ---------------------------------------------------------------------------
// Postgres
// ---------------------------------------------------------------------------

/**
 * Superficie minima do cliente `pg` que este modulo usa.
 *
 * Declarada a mao para que `pg` seja uma dependencia OPCIONAL de verdade: o
 * import e dinamico e so acontece quando ha DATABASE_URL, entao um ambiente sem
 * o pacote instalado continua subindo com o store de memoria em vez de morrer
 * no carregamento do modulo.
 */
type PgPool = {
  query: (text: string, values?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>;
  end: () => Promise<void>;
};

const SCHEMA = `
create table if not exists leaderboard_entries (
  id          bigserial primary key,
  name        text        not null,
  seed        bigint      not null,
  stars       smallint    not null,
  ticks       integer     not null,
  phase       text        not null,
  mode        text        not null,
  kills       integer     not null,
  ore         integer     not null default 0,
  digest      text        unique,
  created_at  timestamptz not null default now()
);
-- CREATE TABLE IF NOT EXISTS nao altera uma tabela que ja existe, e a que roda em
-- producao foi criada antes de o minerio existir. Sem esta linha o deploy subiria
-- limpo e o insert quebraria no primeiro placar enviado — o pior tipo de falha,
-- porque nada no boot a denuncia. ADD COLUMN IF NOT EXISTS mantem o boot
-- idempotente, que e o que permite o schema continuar morando aqui em vez de num
-- sistema de migracao que ainda nao se justifica.
alter table leaderboard_entries add column if not exists ore integer not null default 0;
-- Indices com nome NOVO, e nao os antigos.
--
-- CREATE INDEX IF NOT EXISTS olha o NOME, nao as colunas: reusar o nome antigo
-- deixaria o indice velho intacto em producao e silenciosamente fora de ordem
-- com o ORDER BY. O indice tem de casar com compareEntries — um que discorde
-- devolve as linhas certas na ordem errada.
create index if not exists leaderboard_rank_ore_idx
  on leaderboard_entries (stars desc, ticks asc, ore desc, id asc);
create index if not exists leaderboard_seed_ore_idx
  on leaderboard_entries (seed, stars desc, ticks asc, ore desc, id asc);
`;

const rowToEntry = (row: Record<string, unknown>): LeaderboardEntry => ({
  id: Number(row.id),
  name: String(row.name),
  // bigint volta do pg como STRING para nao perder precisao acima de 2^53.
  // Number() e seguro aqui porque a seed e uint32 por construcao.
  seed: Number(row.seed),
  stars: Number(row.stars),
  ticks: Number(row.ticks),
  phase: String(row.phase),
  mode: String(row.mode) as LeaderboardMode,
  kills: Number(row.kills),
  ore: Number(row.ore ?? 0),
  createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
});

export class PostgresLeaderboard implements LeaderboardStore {
  constructor(private readonly pool: PgPool) {}

  static async connect(databaseUrl: string): Promise<PostgresLeaderboard> {
    const pg = (await import('pg')) as unknown as {
      default?: { Pool: new (config: unknown) => PgPool };
      Pool?: new (config: unknown) => PgPool;
    };
    const Pool = pg.Pool ?? pg.default?.Pool;
    if (!Pool) throw new Error('pg: construtor Pool nao encontrado');
    const pool = new Pool({
      connectionString: databaseUrl,
      // Render exige TLS e usa certificado proprio na rede interna. O objetivo
      // aqui e cifrar o transporte, nao autenticar a CA — a conexao nao sai da
      // rede privada do provedor.
      ssl: databaseUrl.includes('localhost') ? undefined : { rejectUnauthorized: false },
      max: 4,
      idleTimeoutMillis: 30_000,
    });
    await pool.query(SCHEMA);
    return new PostgresLeaderboard(pool);
  }

  async submit(input: SubmitInput): Promise<LeaderboardEntry | null> {
    if (!isLeaderboardEligible(input.summary)) return null;
    // `on conflict do nothing` faz a deduplicacao no BANCO e nao na aplicacao:
    // duas instancias, ou dois POSTs simultaneos do mesmo cliente, correriam
    // entre o "ja existe?" e o insert. O indice unico e a unica barreira que
    // nao tem janela.
    const result = await this.pool.query(
      `insert into leaderboard_entries (name, seed, stars, ticks, phase, mode, kills, ore, digest)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       on conflict (digest) do nothing
       returning *`,
      [
        input.name,
        input.summary.seed,
        input.summary.stars,
        input.summary.ticks,
        input.summary.phase,
        input.mode,
        totalKills(input.summary),
        input.summary.stats.oreCollected,
        input.digest,
      ],
    );
    const row = result.rows[0];
    return row ? rowToEntry(row) : null;
  }

  async top(query: LeaderboardQuery): Promise<LeaderboardEntry[]> {
    // Hide legacy failed rows that may have been stored before eligibility was enforced.
    const conditions: string[] = [`phase <> 'dead'`];
    const values: unknown[] = [];
    if (query.seed !== undefined) {
      values.push(query.seed);
      conditions.push(`seed = $${values.length}`);
    }
    if (query.mode !== undefined) {
      values.push(query.mode);
      conditions.push(`mode = $${values.length}`);
    }
    values.push(clampLimit(query.limit));
    const where = conditions.length > 0 ? `where ${conditions.join(' and ')}` : '';
    const result = await this.pool.query(
      `select * from leaderboard_entries ${where}
       order by stars desc, ticks asc, ore desc, id asc
       limit $${values.length}`,
      values,
    );
    return result.rows.map(rowToEntry);
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}

/**
 * Escolhe o store pelo ambiente.
 *
 * Uma falha de conexao NAO derruba o servidor: o jogo funciona sem ranking, e
 * indisponibilidade de banco virando indisponibilidade de jogo seria trocar uma
 * funcionalidade acessoria pela principal. O chamador recebe o fallback e um
 * aviso no log.
 */
export const createLeaderboard = async (
  databaseUrl: string | undefined,
  log: (line: Record<string, unknown>) => void,
): Promise<LeaderboardStore> => {
  if (!databaseUrl) {
    log({ ev: 'leaderboard_memory', reason: 'DATABASE_URL ausente' });
    return new MemoryLeaderboard();
  }
  try {
    const store = await PostgresLeaderboard.connect(databaseUrl);
    log({ ev: 'leaderboard_postgres' });
    return store;
  } catch (err) {
    log({ ev: 'leaderboard_fallback', error: err instanceof Error ? err.message : String(err) });
    return new MemoryLeaderboard();
  }
};
