// Persistencia da progressao: perfis, tickets, ledger e liquidacoes.
//
// Segue o padrao que o leaderboard estabeleceu — duas implementacoes atras de
// uma interface, escolhidas pelo AMBIENTE e nao por configuracao: com
// DATABASE_URL, Postgres; sem, memoria. O fallback nao e modo degradado, e o que
// faz `pnpm dev` e a suite rodarem sem um banco por perto.
//
// A diferenca em relacao ao leaderboard e a atomicidade. Um placar duplicado e
// uma linha a mais numa lista; um credito duplicado e minerio que nunca existiu.
// Por isso tudo o que muda saldo passa por UMA operacao que ou grava o conjunto
// inteiro (liquidacao + ledger + carteira + estatisticas + versao) ou nao grava
// nada.
//
// ---------------------------------------------------------------------------
// AS TRES GARANTIAS
// ---------------------------------------------------------------------------
// 1. IDEMPOTENCIA PERSISTENTE. `unique (profile_id, run_id)` no banco, e nao um
//    Set em memoria: duas instancias, ou dois POSTs simultaneos do mesmo
//    cliente, correriam entre o "ja liquidou?" e o insert. O indice unico e a
//    unica barreira sem janela.
// 2. LEDGER. Nao guardamos dois numeros mutaveis sem historico. Todo delta vira
//    linha, com o saldo resultante, e o saldo materializado existe so para
//    leitura rapida — reconstruivel a qualquer momento.
// 3. CONCORRENCIA OTIMISTA. `profileVersion` no `where` da atualizacao. Duas
//    compras simultaneas: uma grava, a outra encontra zero linhas e vira 409.
//    Nunca as duas.

import {
  applySettlement,
  decidePurchase,
  newProfile,
  publicProfile,
  rewardFor,
  sanitizeProfile,
  type ProgressionLedgerEntry,
  type RunReward,
  type StoredProfile,
} from './progression.js';
import type { ProgressionErrorCode, ProgressionRunTicket } from '@voxelyn/survival-protocol';
import type { LoreFragmentId, RunPhase, UpgradeId } from '@voxelyn/survival-sim';

export type SettleInput = {
  profileId: string;
  runId: string;
  phase: RunPhase;
  cargoOre: number;
  seed: number;
  simulationVersion: number;
  durationTicks: number;
  now: string;
  idFactory: () => string;
};

export type SettleOutput = {
  /** `false` quando o runId ja tinha sido liquidado: nada foi creditado agora. */
  fresh: boolean;
  reward: RunReward;
  phase: RunPhase;
  cargoOre: number;
  durationTicks: number;
  profile: StoredProfile;
};

export type PurchaseInput = {
  profileId: string;
  upgradeId: UpgradeId;
  expectedProfileVersion: number;
  idempotencyKey: string;
  now: string;
  idFactory: () => string;
};

export type PurchaseOutput =
  | { ok: false; error: ProgressionErrorCode }
  | {
      ok: true;
      replayed: boolean;
      profile: StoredProfile;
      upgradeId: UpgradeId;
      oreSpent: number;
      coresSpent: number;
      loreFragmentId: LoreFragmentId;
    };

export interface ProgressionStore {
  createProfile(profileId: string, now: string): Promise<StoredProfile>;
  getProfile(profileId: string): Promise<StoredProfile | null>;
  saveTicket(ticket: ProgressionRunTicket): Promise<void>;
  getTicket(runId: string): Promise<ProgressionRunTicket | null>;
  settleRun(input: SettleInput): Promise<SettleOutput | { error: ProgressionErrorCode }>;
  purchase(input: PurchaseInput): Promise<PurchaseOutput>;
  ledger(profileId: string): Promise<ProgressionLedgerEntry[]>;
  close(): Promise<void>;
}

// ---------------------------------------------------------------------------
// Memoria
// ---------------------------------------------------------------------------

type SettledRun = {
  reward: RunReward;
  phase: RunPhase;
  cargoOre: number;
  durationTicks: number;
};

/**
 * Store em memoria.
 *
 * Atomico pela mesma razao que o de Postgres: nada e publicado antes de a
 * decisao inteira estar pronta. Os `Map` sao escritos no fim, juntos — uma falha
 * no meio da decisao sai por `return` sem ter tocado em nada.
 *
 * A limitacao esta declarada e nao escondida: o saldo nao sobrevive a um
 * restart. Em desenvolvimento isso e o certo; em producao sem DATABASE_URL, o
 * log de boot diz exatamente isso.
 */
export class MemoryProgressionStore implements ProgressionStore {
  private readonly profiles = new Map<string, StoredProfile>();
  private readonly tickets = new Map<string, ProgressionRunTicket>();
  private readonly settled = new Map<string, SettledRun>();
  private readonly purchases = new Map<string, PurchaseOutput>();
  private readonly ledgers = new Map<string, ProgressionLedgerEntry[]>();

  async createProfile(profileId: string, now: string): Promise<StoredProfile> {
    const profile = newProfile(profileId, now);
    this.profiles.set(profileId, profile);
    return profile;
  }

  async getProfile(profileId: string): Promise<StoredProfile | null> {
    const found = this.profiles.get(profileId);
    return found ? sanitizeProfile(found) : null;
  }

  async saveTicket(ticket: ProgressionRunTicket): Promise<void> {
    this.tickets.set(ticket.runId, ticket);
  }

  async getTicket(runId: string): Promise<ProgressionRunTicket | null> {
    return this.tickets.get(runId) ?? null;
  }

  private appendLedger(entry: ProgressionLedgerEntry): void {
    const list = this.ledgers.get(entry.profileId) ?? [];
    list.push(entry);
    this.ledgers.set(entry.profileId, list);
  }

  async settleRun(input: SettleInput): Promise<SettleOutput | { error: ProgressionErrorCode }> {
    const profile = this.profiles.get(input.profileId);
    if (!profile) return { error: 'unauthenticated' };

    const key = `${input.profileId}:${input.runId}`;
    const previous = this.settled.get(key);
    if (previous) {
      // Reenvio: devolve o que foi persistido, sem creditar de novo. A rede pode
      // ter caido depois do POST, e recusar aqui puniria o jogador por isso.
      return { fresh: false, ...previous, profile: sanitizeProfile(profile) };
    }

    const reward = rewardFor(input.phase, input.cargoOre);
    const next = applySettlement(profile, input.phase, reward, input.now);

    this.settled.set(key, {
      reward,
      phase: input.phase,
      cargoOre: input.cargoOre,
      durationTicks: input.durationTicks,
    });
    this.profiles.set(input.profileId, next);
    this.appendLedger({
      id: input.idFactory(),
      profileId: input.profileId,
      type: 'run_settlement',
      runId: input.runId,
      oreDelta: reward.ore,
      coreDelta: reward.cores,
      balanceAfter: { ...next.wallet },
      metadata: {
        phase: input.phase,
        seed: input.seed,
        simulationVersion: input.simulationVersion,
        durationTicks: input.durationTicks,
      },
      createdAt: input.now,
    });

    return {
      fresh: true,
      reward,
      phase: input.phase,
      cargoOre: input.cargoOre,
      durationTicks: input.durationTicks,
      profile: sanitizeProfile(next),
    };
  }

  async purchase(input: PurchaseInput): Promise<PurchaseOutput> {
    const idempotencyKey = `${input.profileId}:${input.idempotencyKey}`;
    const replayed = this.purchases.get(idempotencyKey);
    if (replayed) {
      // A MESMA resposta, e nao uma nova compra. Um retry de rede nao pode
      // custar um segundo protocolo.
      return replayed.ok ? { ...replayed, replayed: true } : replayed;
    }

    const profile = this.profiles.get(input.profileId);
    if (!profile) return { ok: false, error: 'unauthenticated' };
    if (profile.profileVersion !== input.expectedProfileVersion) {
      // NAO grava o conflito na tabela de idempotencia: o jogador vai reler o
      // perfil e decidir de novo, e a mesma chave pode ser reusada nessa decisao.
      return { ok: false, error: 'profile_version_conflict' };
    }

    const decision = decidePurchase(sanitizeProfile(profile), input.upgradeId, input.now);
    if (!decision.ok) return { ok: false, error: decision.error };

    this.profiles.set(input.profileId, decision.profile);
    this.appendLedger({
      id: input.idFactory(),
      profileId: input.profileId,
      type: 'upgrade_purchase',
      purchaseId: input.idempotencyKey,
      upgradeId: decision.upgradeId,
      oreDelta: -decision.oreSpent,
      coreDelta: -decision.coresSpent,
      balanceAfter: { ...decision.profile.wallet },
      metadata: { unlockedLoreFragmentId: decision.loreFragmentId },
      createdAt: input.now,
    });

    const output: PurchaseOutput = {
      ok: true,
      replayed: false,
      profile: decision.profile,
      upgradeId: decision.upgradeId,
      oreSpent: decision.oreSpent,
      coresSpent: decision.coresSpent,
      loreFragmentId: decision.loreFragmentId,
    };
    this.purchases.set(idempotencyKey, output);
    return output;
  }

  async ledger(profileId: string): Promise<ProgressionLedgerEntry[]> {
    return [...(this.ledgers.get(profileId) ?? [])];
  }

  async close(): Promise<void> {}
}

// ---------------------------------------------------------------------------
// Postgres
// ---------------------------------------------------------------------------

type PgClient = {
  query: (text: string, values?: unknown[]) => Promise<{ rows: Record<string, unknown>[]; rowCount?: number | null }>;
  release: () => void;
};

/**
 * Superficie minima do `pg` que este modulo usa.
 *
 * `connect` entra aqui — e nao so `query`, como no leaderboard — porque a
 * progressao precisa de TRANSACAO de verdade. Sem checkout de cliente nao ha
 * BEGIN/COMMIT, e sem BEGIN/COMMIT a liquidacao poderia gravar o credito e
 * perder o ledger.
 */
type PgPool = {
  query: (text: string, values?: unknown[]) => Promise<{ rows: Record<string, unknown>[]; rowCount?: number | null }>;
  connect: () => Promise<PgClient>;
  end: () => Promise<void>;
};

const SCHEMA = `
create table if not exists progression_profiles (
  profile_id      text primary key,
  schema_version  integer     not null default 1,
  profile_version bigint      not null default 1,
  ore             bigint      not null default 0,
  cores           bigint      not null default 0,
  purchased       jsonb       not null default '[]'::jsonb,
  unlocked_lore   jsonb       not null default '[]'::jsonb,
  statistics      jsonb       not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  -- Saldo negativo e um bug de aplicacao; a restricao existe para que ele nunca
  -- vire dado. Um erro no INSERT e recuperavel, um saldo negativo persistido nao.
  constraint progression_wallet_non_negative check (ore >= 0 and cores >= 0)
);

create table if not exists progression_tickets (
  run_id           text primary key,
  profile_id       text        not null,
  seed             bigint      not null,
  mode             text        not null,
  tuning           jsonb       not null,
  tuning_hash      text        not null,
  profile_version  bigint      not null,
  protocol_version integer     not null,
  sim_version      integer     not null,
  issued_at        timestamptz not null,
  expires_at       timestamptz not null,
  nonce            text        not null
);
create index if not exists progression_tickets_profile_idx on progression_tickets (profile_id);

create table if not exists progression_settled_runs (
  id             bigserial primary key,
  profile_id     text        not null,
  run_id         text        not null,
  phase          text        not null,
  cargo_ore      integer     not null,
  ore_credited   integer     not null,
  cores_credited integer     not null,
  ore_lost       integer     not null,
  duration_ticks integer     not null,
  created_at     timestamptz not null default now(),
  -- A barreira sem janela. Ver o cabecalho deste arquivo.
  unique (profile_id, run_id)
);

create table if not exists progression_purchases (
  id              bigserial primary key,
  profile_id      text        not null,
  idempotency_key text        not null,
  upgrade_id      text        not null,
  ore_spent       integer     not null,
  cores_spent     integer     not null,
  lore_fragment   text        not null,
  created_at      timestamptz not null default now(),
  unique (profile_id, idempotency_key)
);

create table if not exists progression_ledger (
  id            bigserial primary key,
  entry_id      text        not null,
  profile_id    text        not null,
  type          text        not null,
  reference     text        not null,
  ore_delta     integer     not null,
  core_delta    integer     not null,
  ore_after     bigint      not null,
  cores_after   bigint      not null,
  metadata      jsonb       not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);
create index if not exists progression_ledger_profile_idx on progression_ledger (profile_id, id);
`;

const rowToProfile = (row: Record<string, unknown>): StoredProfile =>
  sanitizeProfile({
    profileId: String(row.profile_id),
    schemaVersion: Number(row.schema_version ?? 1),
    profileVersion: Number(row.profile_version ?? 1),
    wallet: { ore: Number(row.ore ?? 0), cores: Number(row.cores ?? 0) },
    purchasedUpgradeIds: (row.purchased as UpgradeId[]) ?? [],
    unlockedLoreFragmentIds: (row.unlocked_lore as LoreFragmentId[]) ?? [],
    statistics: (row.statistics as StoredProfile['statistics']) ?? {
      oreHomologated: 0,
      oreLost: 0,
      coresRecovered: 0,
      successfulReturns: 0,
      failedExpeditions: 0,
      upgradesPurchased: 0,
    },
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  });

export class PostgresProgressionStore implements ProgressionStore {
  constructor(private readonly pool: PgPool) {}

  static async connect(databaseUrl: string): Promise<PostgresProgressionStore> {
    const pg = (await import('pg')) as unknown as {
      default?: { Pool: new (config: unknown) => PgPool };
      Pool?: new (config: unknown) => PgPool;
    };
    const Pool = pg.Pool ?? pg.default?.Pool;
    if (!Pool) throw new Error('pg: construtor Pool nao encontrado');
    const pool = new Pool({
      connectionString: databaseUrl,
      ssl: databaseUrl.includes('localhost') ? undefined : { rejectUnauthorized: false },
      max: 4,
      idleTimeoutMillis: 30_000,
    });
    await pool.query(SCHEMA);
    return new PostgresProgressionStore(pool);
  }

  /** BEGIN/COMMIT com rollback garantido. Nenhuma escrita parcial sobrevive. */
  private async transaction<T>(fn: (client: PgClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      const result = await fn(client);
      await client.query('commit');
      return result;
    } catch (err) {
      await client.query('rollback').catch(() => undefined);
      throw err;
    } finally {
      client.release();
    }
  }

  async createProfile(profileId: string, now: string): Promise<StoredProfile> {
    const profile = newProfile(profileId, now);
    await this.pool.query(
      `insert into progression_profiles
         (profile_id, schema_version, profile_version, ore, cores, purchased, unlocked_lore, statistics, created_at, updated_at)
       values ($1, $2, $3, 0, 0, $4::jsonb, $5::jsonb, $6::jsonb, $7, $7)
       on conflict (profile_id) do nothing`,
      [
        profile.profileId,
        profile.schemaVersion,
        profile.profileVersion,
        JSON.stringify(profile.purchasedUpgradeIds),
        JSON.stringify(profile.unlockedLoreFragmentIds),
        JSON.stringify(profile.statistics),
        now,
      ],
    );
    return profile;
  }

  async getProfile(profileId: string): Promise<StoredProfile | null> {
    const result = await this.pool.query(
      'select * from progression_profiles where profile_id = $1',
      [profileId],
    );
    const row = result.rows[0];
    return row ? rowToProfile(row) : null;
  }

  async saveTicket(ticket: ProgressionRunTicket): Promise<void> {
    await this.pool.query(
      `insert into progression_tickets
         (run_id, profile_id, seed, mode, tuning, tuning_hash, profile_version, protocol_version, sim_version, issued_at, expires_at, nonce)
       values ($1,$2,$3,$4,$5::jsonb,$6,$7,$8,$9,$10,$11,$12)
       on conflict (run_id) do nothing`,
      [
        ticket.runId,
        ticket.profileId,
        ticket.seed,
        ticket.mode,
        JSON.stringify(ticket.tuning),
        ticket.tuningHash,
        ticket.progressionProfileVersion,
        ticket.protocolVersion,
        ticket.simulationVersion,
        ticket.issuedAt,
        ticket.expiresAt,
        ticket.nonce,
      ],
    );
  }

  async getTicket(runId: string): Promise<ProgressionRunTicket | null> {
    const result = await this.pool.query('select * from progression_tickets where run_id = $1', [
      runId,
    ]);
    const row = result.rows[0];
    if (!row) return null;
    return {
      runId: String(row.run_id),
      profileId: String(row.profile_id),
      seed: Number(row.seed),
      mode: String(row.mode) as ProgressionRunTicket['mode'],
      playerCount: 1,
      tuning: row.tuning as ProgressionRunTicket['tuning'],
      tuningHash: String(row.tuning_hash),
      progressionProfileVersion: Number(row.profile_version),
      protocolVersion: Number(row.protocol_version),
      simulationVersion: Number(row.sim_version),
      issuedAt: new Date(String(row.issued_at)).toISOString(),
      expiresAt: new Date(String(row.expires_at)).toISOString(),
      nonce: String(row.nonce),
    };
  }

  async settleRun(input: SettleInput): Promise<SettleOutput | { error: ProgressionErrorCode }> {
    return this.transaction(async (client) => {
      // `for update` serializa duas liquidacoes do mesmo perfil. Sem ele, duas
      // runs terminando junto leriam o mesmo saldo e uma sobrescreveria a outra.
      const profileRows = await client.query(
        'select * from progression_profiles where profile_id = $1 for update',
        [input.profileId],
      );
      const row = profileRows.rows[0];
      if (!row) return { error: 'unauthenticated' as ProgressionErrorCode };
      const profile = rowToProfile(row);

      const existing = await client.query(
        'select * from progression_settled_runs where profile_id = $1 and run_id = $2',
        [input.profileId, input.runId],
      );
      const previous = existing.rows[0];
      if (previous) {
        return {
          fresh: false,
          reward: {
            ore: Number(previous.ore_credited),
            cores: Number(previous.cores_credited),
            lost: Number(previous.ore_lost),
          },
          phase: String(previous.phase) as RunPhase,
          cargoOre: Number(previous.cargo_ore),
          durationTicks: Number(previous.duration_ticks),
          profile,
        };
      }

      const reward = rewardFor(input.phase, input.cargoOre);
      const next = applySettlement(profile, input.phase, reward, input.now);

      await client.query(
        `insert into progression_settled_runs
           (profile_id, run_id, phase, cargo_ore, ore_credited, cores_credited, ore_lost, duration_ticks)
         values ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [
          input.profileId,
          input.runId,
          input.phase,
          input.cargoOre,
          reward.ore,
          reward.cores,
          reward.lost,
          input.durationTicks,
        ],
      );
      await client.query(
        `update progression_profiles
            set profile_version = $2, ore = $3, cores = $4, statistics = $5::jsonb, updated_at = $6
          where profile_id = $1`,
        [
          input.profileId,
          next.profileVersion,
          next.wallet.ore,
          next.wallet.cores,
          JSON.stringify(next.statistics),
          input.now,
        ],
      );
      await client.query(
        `insert into progression_ledger
           (entry_id, profile_id, type, reference, ore_delta, core_delta, ore_after, cores_after, metadata, created_at)
         values ($1,$2,'run_settlement',$3,$4,$5,$6,$7,$8::jsonb,$9)`,
        [
          input.idFactory(),
          input.profileId,
          input.runId,
          reward.ore,
          reward.cores,
          next.wallet.ore,
          next.wallet.cores,
          JSON.stringify({
            phase: input.phase,
            seed: input.seed,
            simulationVersion: input.simulationVersion,
            durationTicks: input.durationTicks,
          }),
          input.now,
        ],
      );

      return {
        fresh: true,
        reward,
        phase: input.phase,
        cargoOre: input.cargoOre,
        durationTicks: input.durationTicks,
        profile: next,
      };
    });
  }

  async purchase(input: PurchaseInput): Promise<PurchaseOutput> {
    return this.transaction(async (client) => {
      const profileRows = await client.query(
        'select * from progression_profiles where profile_id = $1 for update',
        [input.profileId],
      );
      const row = profileRows.rows[0];
      if (!row) return { ok: false, error: 'unauthenticated' as ProgressionErrorCode };
      const profile = rowToProfile(row);

      const replay = await client.query(
        'select * from progression_purchases where profile_id = $1 and idempotency_key = $2',
        [input.profileId, input.idempotencyKey],
      );
      const previous = replay.rows[0];
      if (previous) {
        return {
          ok: true,
          replayed: true,
          profile,
          upgradeId: String(previous.upgrade_id),
          oreSpent: Number(previous.ore_spent),
          coresSpent: Number(previous.cores_spent),
          loreFragmentId: String(previous.lore_fragment),
        };
      }

      if (profile.profileVersion !== input.expectedProfileVersion) {
        return { ok: false, error: 'profile_version_conflict' as ProgressionErrorCode };
      }

      const decision = decidePurchase(profile, input.upgradeId, input.now);
      if (!decision.ok) return { ok: false, error: decision.error };

      await client.query(
        `insert into progression_purchases
           (profile_id, idempotency_key, upgrade_id, ore_spent, cores_spent, lore_fragment)
         values ($1,$2,$3,$4,$5,$6)`,
        [
          input.profileId,
          input.idempotencyKey,
          decision.upgradeId,
          decision.oreSpent,
          decision.coresSpent,
          decision.loreFragmentId,
        ],
      );
      // `and profile_version = $N` fecha a corrida que o `for update` ja cobre
      // dentro desta instancia — e cobre tambem duas instancias contra o mesmo
      // banco, onde o lock de linha de uma nao existe para a outra.
      const updated = await client.query(
        `update progression_profiles
            set profile_version = $2, ore = $3, cores = $4, purchased = $5::jsonb,
                unlocked_lore = $6::jsonb, statistics = $7::jsonb, updated_at = $8
          where profile_id = $1 and profile_version = $9`,
        [
          input.profileId,
          decision.profile.profileVersion,
          decision.profile.wallet.ore,
          decision.profile.wallet.cores,
          JSON.stringify(decision.profile.purchasedUpgradeIds),
          JSON.stringify(decision.profile.unlockedLoreFragmentIds),
          JSON.stringify(decision.profile.statistics),
          input.now,
          input.expectedProfileVersion,
        ],
      );
      if (!updated.rowCount) {
        return { ok: false, error: 'profile_version_conflict' as ProgressionErrorCode };
      }
      await client.query(
        `insert into progression_ledger
           (entry_id, profile_id, type, reference, ore_delta, core_delta, ore_after, cores_after, metadata, created_at)
         values ($1,$2,'upgrade_purchase',$3,$4,$5,$6,$7,$8::jsonb,$9)`,
        [
          input.idFactory(),
          input.profileId,
          input.idempotencyKey,
          -decision.oreSpent,
          -decision.coresSpent,
          decision.profile.wallet.ore,
          decision.profile.wallet.cores,
          JSON.stringify({ unlockedLoreFragmentId: decision.loreFragmentId }),
          input.now,
        ],
      );

      return {
        ok: true,
        replayed: false,
        profile: decision.profile,
        upgradeId: decision.upgradeId,
        oreSpent: decision.oreSpent,
        coresSpent: decision.coresSpent,
        loreFragmentId: decision.loreFragmentId,
      };
    });
  }

  async ledger(profileId: string): Promise<ProgressionLedgerEntry[]> {
    const result = await this.pool.query(
      'select * from progression_ledger where profile_id = $1 order by id asc',
      [profileId],
    );
    return result.rows.map((row) => {
      const base = {
        id: String(row.entry_id),
        profileId: String(row.profile_id),
        oreDelta: Number(row.ore_delta),
        coreDelta: Number(row.core_delta),
        balanceAfter: { ore: Number(row.ore_after), cores: Number(row.cores_after) },
        createdAt: String(row.created_at),
      };
      const metadata = (row.metadata ?? {}) as Record<string, unknown>;
      if (String(row.type) === 'upgrade_purchase') {
        return {
          ...base,
          type: 'upgrade_purchase' as const,
          purchaseId: String(row.reference),
          upgradeId: String(metadata.upgradeId ?? ''),
          metadata: { unlockedLoreFragmentId: String(metadata.unlockedLoreFragmentId ?? '') },
        };
      }
      return {
        ...base,
        type: 'run_settlement' as const,
        runId: String(row.reference),
        metadata: {
          phase: String(metadata.phase ?? 'dead') as RunPhase,
          seed: Number(metadata.seed ?? 0),
          simulationVersion: Number(metadata.simulationVersion ?? 0),
          durationTicks: Number(metadata.durationTicks ?? 0),
        },
      };
    });
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}

/**
 * Escolhe o store pelo ambiente.
 *
 * Falha de conexao NAO derruba o servidor — mesma regra do leaderboard. Mas aqui
 * o log e mais grave e diz por que: sem banco, o saldo do jogador nao sobrevive
 * a um restart, e isso precisa aparecer no boot em vez de virar suporte.
 */
export const createProgressionStore = async (
  databaseUrl: string | undefined,
  log: (line: Record<string, unknown>) => void,
): Promise<ProgressionStore> => {
  if (!databaseUrl) {
    log({ ev: 'progression_memory', reason: 'DATABASE_URL ausente; saldo nao persiste' });
    return new MemoryProgressionStore();
  }
  try {
    const store = await PostgresProgressionStore.connect(databaseUrl);
    log({ ev: 'progression_postgres' });
    return store;
  } catch (err) {
    log({
      ev: 'progression_fallback',
      reason: 'saldo nao persiste entre reinicios',
      error: err instanceof Error ? err.message : String(err),
    });
    return new MemoryProgressionStore();
  }
};

export { publicProfile };
