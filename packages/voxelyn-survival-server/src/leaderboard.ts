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

import { compareRunScore, type RunSummary } from '@voxelyn/survival-sim';

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
   * Nucleos que sairam do Veio nesta run. O CRITERIO PRIMARIO da pontuacao.
   *
   * Nao e derivavel de `phase`: `extracted_with_core` diz que houve ao menos um,
   * e uma descida de G-03/G-04 pode trazer dois. Enquanto o placar ordenava por
   * estrelas, as duas runs empatavam — e a segunda tinha cumprido o dobro.
   */
  cores: number;
  /**
   * Quantos setores esta run atravessou. A CLASSE do livro em que ela compete.
   *
   * Fica na linha, e nao e reconsultado do perfil: uma run de tres setores
   * gravada hoje continua sendo de tres setores depois de o jogador chegar a
   * G-04. A profundidade de uma run e um fato dela, nao do dono.
   */
  sectorCount: number;
  /**
   * Minerio da run. NAO entra na pontuacao — ver `compareEntries`.
   *
   * `not null default 0` no banco em vez de nulavel: bancos que ja existiam
   * ganham zero, que e a resposta correta — aquelas runs foram jogadas quando
   * minerio nao existia, e nao "com minerio desconhecido".
   */
  ore: number;
  createdAt: string;
};

/** Um livro: uma classe de run e quantas expedicoes ja entraram nele. */
export type LeaderboardClass = {
  sectorCount: number;
  entries: number;
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
  /**
   * A CLASSE do livro: quantos setores a run atravessou.
   *
   * Ausente devolve TODAS as classes misturadas, e por isso nenhum caminho de
   * leitura do jogo a omite — ver `createLeaderboardHandler`, que sempre
   * resolve uma classe antes de consultar. O filtro e opcional na assinatura
   * porque a auditoria (um operador olhando o banco inteiro) e um leitor
   * legitimo; ele nao e opcional no jogo.
   */
  sectorCount?: number;
};

export interface LeaderboardStore {
  /** Devolve a entrada gravada, ou null se ja existia (dedupe por digest). */
  submit(input: SubmitInput): Promise<LeaderboardEntry | null>;
  top(query: LeaderboardQuery): Promise<LeaderboardEntry[]>;
  /**
   * Os livros que EXISTEM, do mais raso ao mais fundo.
   *
   * Derivado do que foi gravado, e nunca da tabela de geracoes: um seletor
   * montado a partir de `SECTORS_BY_GENERATION` ofereceria quatro livros vazios
   * no dia do deploy, e um livro vazio que o jogador abre e uma promessa que o
   * placar nao cumpriu.
   */
  classes(query: Omit<LeaderboardQuery, 'limit' | 'sectorCount'>): Promise<LeaderboardClass[]>;
  close(): Promise<void>;
}

/**
 * A classe de uma run que nao declarou profundidade.
 *
 * Tres, e nao "desconhecida": toda run gravada antes desta mudanca foi uma
 * descida de tres setores — era a unica que existia. Chamar de desconhecida
 * criaria um livro fantasma para o historico inteiro do jogo.
 */
export const LEGACY_SECTOR_COUNT = 3;

const totalKills = (summary: RunSummary): number =>
  Object.values(summary.stats.kills).reduce((a, b) => a + b, 0);

/** Only successful extractions are eligible for either leaderboard mode. */
export const isLeaderboardEligible = (summary: RunSummary): boolean =>
  summary.phase === 'extracted' || summary.phase === 'extracted_with_core';

/**
 * A ordenacao do ranking, num lugar so — e esse lugar delega.
 *
 * `compareRunScore` mora na SIMULACAO, junto de quem constroi o sumario, e nao
 * aqui: a pontuacao e uma regra do jogo, nao do banco. Duas implementacoes da
 * mesma ordem — uma em TypeScript, outra no `order by` do Postgres — ja sao uma
 * a mais do que o seguro; uma terceira, divergente da sim, era o jeito de a tela
 * de resultado e o livro discordarem sobre quem ganhou.
 *
 * Nucleos, tempo, e por fim quem chegou antes. Estrelas NAO ordenam mais: uma
 * run de dois Nucleos fora do tempo-alvo vale duas estrelas e cumpriu o dobro
 * de uma de tres estrelas com um Nucleo so — ordenar pela nota punia a descida
 * mais fundo. As estrelas continuam sendo a leitura da run; elas so deixaram de
 * ser a posicao dela.
 *
 * O minerio saiu junto. Ele era desempate, mas desempate tambem e criterio: era
 * uma quarta pergunta que o livro fazia e o briefing nao.
 *
 * `a.id - b.id` no fim mantem quem chegou primeiro na frente, e e o que impede
 * o ranking de se reordenar sozinho quando ninguem melhorou nada.
 */
export const compareEntries = (a: LeaderboardEntry, b: LeaderboardEntry): number =>
  compareRunScore(a, b) || a.id - b.id;

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
      cores: input.summary.cores,
      sectorCount: input.summary.sectorCount,
      ore: input.summary.stats.oreCollected,
      createdAt: new Date().toISOString(),
    };
    this.rows.push(entry);
    return entry;
  }

  async top(query: LeaderboardQuery): Promise<LeaderboardEntry[]> {
    return this.rows
      .filter((r) => this.visible(r, query))
      .sort(compareEntries)
      .slice(0, clampLimit(query.limit));
  }

  async classes(
    query: Omit<LeaderboardQuery, 'limit' | 'sectorCount'>,
  ): Promise<LeaderboardClass[]> {
    const counted = new Map<number, number>();
    for (const row of this.rows) {
      if (!this.visible(row, query)) continue;
      counted.set(row.sectorCount, (counted.get(row.sectorCount) ?? 0) + 1);
    }
    return [...counted.entries()]
      .map(([sectorCount, entries]) => ({ sectorCount, entries }))
      .sort((a, b) => a.sectorCount - b.sectorCount);
  }

  private visible(row: LeaderboardEntry, query: LeaderboardQuery): boolean {
    return (
      row.phase !== 'dead' &&
      (query.seed === undefined || row.seed === query.seed) &&
      (query.mode === undefined || row.mode === query.mode) &&
      (query.sectorCount === undefined || row.sectorCount === query.sectorCount)
    );
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
  cores       smallint    not null default 0,
  sector_count smallint   not null default ${LEGACY_SECTOR_COUNT},
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
-- A classe do livro. Toda linha que existia foi uma descida de tres setores —
-- era a unica que o jogo tinha —, entao o default preenche o passado com a
-- verdade em vez de com zero.
alter table leaderboard_entries
  add column if not exists sector_count smallint not null default ${LEGACY_SECTOR_COUNT};
-- Nucleos: a coluna nasce NULAVEL de proposito.
--
-- Um "default 0" direto gravaria zero Nucleo em toda run antiga que extraiu COM
-- Nucleo, e essas runs cairiam para o fim do livro na primeira leitura depois do
-- deploy — o historico inteiro rebaixado por uma coluna nova. Nascer nula deixa
-- o UPDATE abaixo dizer o que aquelas runs de fato trouxeram (a fase e a prova:
-- "extracted_with_core" era um Nucleo, porque um era o maximo que existia), e so
-- entao a coluna vira NOT NULL para as proximas.
alter table leaderboard_entries add column if not exists cores smallint;
update leaderboard_entries
   set cores = case when phase = 'extracted_with_core' then 1 else 0 end
 where cores is null;
alter table leaderboard_entries alter column cores set default 0;
alter table leaderboard_entries alter column cores set not null;
-- Indices com nome NOVO, e nao os antigos.
--
-- CREATE INDEX IF NOT EXISTS olha o NOME, nao as colunas: reusar o nome antigo
-- deixaria o indice velho intacto em producao e silenciosamente fora de ordem
-- com o ORDER BY. O indice tem de casar com compareEntries — um que discorde
-- devolve as linhas certas na ordem errada.
--
-- "sector_count" vem PRIMEIRO nos dois: toda leitura do jogo filtra por classe
-- antes de ordenar, e um indice que so ordena obrigaria o banco a varrer os
-- livros das outras profundidades para descartar linha a linha.
create index if not exists leaderboard_rank_class_idx
  on leaderboard_entries (sector_count, cores desc, ticks asc, id asc);
create index if not exists leaderboard_seed_class_idx
  on leaderboard_entries (sector_count, seed, cores desc, ticks asc, id asc);
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
  cores: Number(row.cores ?? 0),
  sectorCount: Number(row.sector_count ?? LEGACY_SECTOR_COUNT),
  ore: Number(row.ore ?? 0),
  createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
});

/**
 * O WHERE compartilhado por `top` e `classes`.
 *
 * Compartilhado porque as duas consultas TEM de enxergar o mesmo conjunto: um
 * seletor que conta livros com um filtro e uma lista que os abre com outro
 * ofereceria uma aba que abre vazia. `phase <> 'dead'` esconde derrotas legadas,
 * gravadas antes de a elegibilidade ser exigida no submit.
 */
const filterOf = (query: LeaderboardQuery): { where: string; values: unknown[] } => {
  const conditions: string[] = [`phase <> 'dead'`];
  const values: unknown[] = [];
  const eq = (column: string, value: unknown): void => {
    if (value === undefined) return;
    values.push(value);
    conditions.push(`${column} = $${values.length}`);
  };
  eq('seed', query.seed);
  eq('mode', query.mode);
  eq('sector_count', query.sectorCount);
  return { where: `where ${conditions.join(' and ')}`, values };
};

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
      `insert into leaderboard_entries
         (name, seed, stars, ticks, phase, mode, kills, ore, cores, sector_count, digest)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
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
        input.summary.cores,
        input.summary.sectorCount,
        input.digest,
      ],
    );
    const row = result.rows[0];
    return row ? rowToEntry(row) : null;
  }

  async top(query: LeaderboardQuery): Promise<LeaderboardEntry[]> {
    const { where, values } = filterOf(query);
    values.push(clampLimit(query.limit));
    const result = await this.pool.query(
      `select * from leaderboard_entries ${where}
       order by cores desc, ticks asc, id asc
       limit $${values.length}`,
      values,
    );
    return result.rows.map(rowToEntry);
  }

  async classes(
    query: Omit<LeaderboardQuery, 'limit' | 'sectorCount'>,
  ): Promise<LeaderboardClass[]> {
    const { where, values } = filterOf(query);
    const result = await this.pool.query(
      `select sector_count, count(*) as entries from leaderboard_entries ${where}
       group by sector_count
       order by sector_count asc`,
      values,
    );
    return result.rows.map((row) => ({
      sectorCount: Number(row.sector_count ?? LEGACY_SECTOR_COUNT),
      // `count(*)` volta do pg como string: e um bigint.
      entries: Number(row.entries),
    }));
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
