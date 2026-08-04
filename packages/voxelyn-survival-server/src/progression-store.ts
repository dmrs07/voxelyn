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
  decideMarkRead,
  decidePurchase,
  newProfile,
  publicProfile,
  rewardFor,
  sanitizeProfile,
  type ProgressionLedgerEntry,
  type RunReward,
  type SettlementFacts,
  type StoredProfile,
} from './progression.js';
import type { ProgressionErrorCode, ProgressionRunTicket } from '@voxelyn/survival-protocol';
import type { EnemyArchetype, LoreFragmentId, RunPhase, UpgradeId } from '@voxelyn/survival-sim';

export type SettleInput = {
  profileId: string;
  runId: string;
  phase: RunPhase;
  cargoOre: number;
  /** Abates por arquetipo, do REPLAY. E o que torna um Ativo conhecido. */
  kills: Partial<Record<EnemyArchetype, number>>;
  /** Bitmask DISCOVERY_* do replay. */
  discoveries: number;
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

export type MarkReadOutput =
  | { ok: false; error: ProgressionErrorCode }
  | { ok: true; readLoreFragmentIds: LoreFragmentId[] };

export interface ProgressionStore {
  createProfile(profileId: string, now: string): Promise<StoredProfile>;
  getProfile(profileId: string): Promise<StoredProfile | null>;
  saveTicket(ticket: ProgressionRunTicket): Promise<void>;
  getTicket(runId: string): Promise<ProgressionRunTicket | null>;
  settleRun(input: SettleInput): Promise<SettleOutput | { error: ProgressionErrorCode }>;
  purchase(input: PurchaseInput): Promise<PurchaseOutput>;
  /** Idempotente; nao sobe profileVersion (ver `decideMarkRead`). */
  markLoreRead(profileId: string, fragmentId: LoreFragmentId, now: string): Promise<MarkReadOutput>;
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
    const facts: SettlementFacts = { kills: input.kills, discoveries: input.discoveries };
    const next = applySettlement(profile, input.phase, reward, input.now, facts);

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

  async markLoreRead(
    profileId: string,
    fragmentId: LoreFragmentId,
    now: string,
  ): Promise<MarkReadOutput> {
    const profile = this.profiles.get(profileId);
    if (!profile) return { ok: false, error: 'unauthenticated' };
    const decision = decideMarkRead(sanitizeProfile(profile), fragmentId, now);
    if (!decision.ok) return decision;
    if (decision.changed) this.profiles.set(profileId, decision.profile);
    return { ok: true, readLoreFragmentIds: [...decision.profile.readLoreFragmentIds] };
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
  query: (
    text: string,
    values?: unknown[],
  ) => Promise<{ rows: Record<string, unknown>[]; rowCount?: number | null }>;
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
  query: (
    text: string,
    values?: unknown[],
  ) => Promise<{ rows: Record<string, unknown>[]; rowCount?: number | null }>;
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

-- Colunas narrativas chegaram DEPOIS da primeira versao da tabela: o
-- "create if not exists" acima nao altera uma tabela existente, entao a
-- migracao e explicita. Defaults vazios = a progressao narrativa de um perfil
-- antigo comeca a contar da proxima run liquidada (nada e importado do
-- Registro local do navegador — ver spec 2026-08-04).
alter table progression_profiles add column if not exists known_assets jsonb not null default '[]'::jsonb;
alter table progression_profiles add column if not exists asset_kills jsonb not null default '{}'::jsonb;
alter table progression_profiles add column if not exists discoveries bigint not null default 0;
alter table progression_profiles add column if not exists read_lore jsonb not null default '[]'::jsonb;

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
-- A varredura de retencao filtra por expiracao; sem este indice ela seria um
-- seq scan na tabela que mais cresce do schema.
create index if not exists progression_tickets_expiry_idx on progression_tickets (expires_at);

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
    knownArchetypes: (row.known_assets as EnemyArchetype[]) ?? [],
    assetKills: (row.asset_kills as Partial<Record<EnemyArchetype, number>>) ?? {},
    discoveries: Number(row.discoveries ?? 0),
    readLoreFragmentIds: (row.read_lore as LoreFragmentId[]) ?? [],
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

/**
 * Recusa de negocio que precisa DESFAZER a transacao.
 *
 * Nao e excecao de erro: e o unico jeito de sair de dentro de um BEGIN sem
 * commitar o que ja foi escrito ate ali. Quem chama a converte de volta num
 * codigo de erro comum.
 */
class AbortTransaction extends Error {
  constructor(readonly code: ProgressionErrorCode) {
    super(code);
    this.name = 'AbortTransaction';
  }
}

/**
 * Quanto tempo um ticket ja expirado ainda fica guardado.
 *
 * O TTL do ticket e de 90 minutos; a retencao e de sete dias. A folga nao e
 * medo — e o que mantem o registro disponivel para auditar uma liquidacao
 * contestada depois do fim de semana, que e quando alguem repara.
 *
 * Sem ela a tabela crescia PARA SEMPRE: toda run autorizada insere uma linha com
 * o tuning inteiro, nada apagava, e o proprio TTL nao remove nada — ele so faz o
 * ticket ser recusado.
 */
export const TICKET_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

/** Intervalo minimo entre duas varreduras. Uma por hora basta e nao pesa. */
const TICKET_SWEEP_INTERVAL_MS = 60 * 60 * 1000;

export class PostgresProgressionStore implements ProgressionStore {
  private nextTicketSweepAt = 0;

  constructor(private readonly pool: PgPool) {}

  /**
   * Apaga tickets vencidos ha mais de `TICKET_RETENTION_MS`.
   *
   * Presa a emissao de ticket em vez de um cron: o unico momento em que a tabela
   * cresce e este, e um servico que so tem uma instancia nao precisa de agendador
   * para uma limpeza que pode acontecer atrasada sem consequencia.
   *
   * NAO apaga na liquidacao, e essa e a parte que importa. O caminho idempotente
   * — reenviar o mesmo `runId` depois de uma queda — le o TICKET para conferir
   * dono e validade antes de devolver o resultado ja persistido. Apagar ali
   * trocaria "aqui esta o que ja foi creditado" por um 404.
   *
   * Falha em silencio de proposito: limpeza que derruba a emissao de ticket
   * seria pior que a tabela grande.
   */
  private sweepExpiredTickets(nowMs: number): void {
    if (nowMs < this.nextTicketSweepAt) return;
    this.nextTicketSweepAt = nowMs + TICKET_SWEEP_INTERVAL_MS;
    void this.pool
      .query('delete from progression_tickets where expires_at < $1', [
        new Date(nowMs - TICKET_RETENTION_MS).toISOString(),
      ])
      .catch(() => undefined);
  }

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

  /**
   * BEGIN/COMMIT com rollback garantido. Nenhuma escrita parcial sobrevive.
   *
   * ATENCAO ao contrato: um `return` normal COMMITA. Uma recusa de negocio que
   * devolvesse `{ ok: false }` depois de ja ter inserido alguma linha commitaria
   * essa linha — e foi exatamente o que aconteceu com a compra: o registro de
   * idempotencia entrava antes da checagem de versao, e um 409 deixava para tras
   * uma chave envenenada. O retry seguinte encontrava a chave, respondia
   * `replayed: true`, e o jogador via um protocolo que nunca foi debitado nem
   * concedido.
   *
   * Por isso toda recusa de dentro de uma transacao passa por `AbortTransaction`:
   * ela sai pelo `catch`, o rollback acontece, e o codigo de erro chega intacto a
   * quem chamou.
   */
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
    this.sweepExpiredTickets(Date.parse(ticket.issuedAt) || Date.now());
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
    return this.runOrAbort<SettleOutput | { error: ProgressionErrorCode }>(
      (code) => ({ error: code }),
      async (client) => {
        // `for update` serializa duas liquidacoes do mesmo perfil. Sem ele, duas
        // runs terminando junto leriam o mesmo saldo e uma sobrescreveria a outra.
        const profileRows = await client.query(
          'select * from progression_profiles where profile_id = $1 for update',
          [input.profileId],
        );
        const row = profileRows.rows[0];
        if (!row) throw new AbortTransaction('unauthenticated');
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
        const next = applySettlement(profile, input.phase, reward, input.now, {
          kills: input.kills,
          discoveries: input.discoveries,
        });

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
        // Recompensa, estatisticas, Ativos, Descobertas e documentos novos
        // gravam JUNTOS: e a mesma transacao do insert acima, entao repetir a
        // liquidacao nao desbloqueia nem conta nada duas vezes. `read_lore`
        // fica de fora de proposito — so `markLoreRead` escreve nela, para uma
        // leitura concorrente nunca ser sobrescrita por uma liquidacao.
        await client.query(
          `update progression_profiles
            set profile_version = $2, ore = $3, cores = $4, statistics = $5::jsonb,
                known_assets = $6::jsonb, asset_kills = $7::jsonb, discoveries = $8,
                unlocked_lore = $9::jsonb, updated_at = $10
          where profile_id = $1`,
          [
            input.profileId,
            next.profileVersion,
            next.wallet.ore,
            next.wallet.cores,
            JSON.stringify(next.statistics),
            JSON.stringify(next.knownArchetypes),
            JSON.stringify(next.assetKills),
            next.discoveries,
            JSON.stringify(next.unlockedLoreFragmentIds),
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
      },
    );
  }

  /** Roda numa transacao e converte `AbortTransaction` no erro de negocio. */
  private async runOrAbort<T>(
    onAbort: (code: ProgressionErrorCode) => T,
    fn: (client: PgClient) => Promise<T>,
  ): Promise<T> {
    try {
      return await this.transaction(fn);
    } catch (err) {
      if (err instanceof AbortTransaction) return onAbort(err.code);
      throw err;
    }
  }

  async purchase(input: PurchaseInput): Promise<PurchaseOutput> {
    return this.runOrAbort<PurchaseOutput>(
      (code) => ({ ok: false, error: code }),
      async (client) => {
        const profileRows = await client.query(
          'select * from progression_profiles where profile_id = $1 for update',
          [input.profileId],
        );
        const row = profileRows.rows[0];
        if (!row) throw new AbortTransaction('unauthenticated');
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
          throw new AbortTransaction('profile_version_conflict');
        }

        const decision = decidePurchase(profile, input.upgradeId, input.now);
        if (!decision.ok) throw new AbortTransaction(decision.error);

        // O PERFIL PRIMEIRO, e a chave de idempotencia depois.
        //
        // A ordem inversa era o bug: a chave entrava, a atualizacao de versao
        // falhava por corrida, e a recusa commitava a chave sozinha. Gravando o
        // perfil primeiro, a corrida e detectada antes de existir qualquer
        // registro de compra — e o `AbortTransaction` desfaz o que houver.
        //
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
        if (!updated.rowCount) throw new AbortTransaction('profile_version_conflict');
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
            // `upgradeId` TEM de estar aqui: `ledger()` o le de `metadata`, e sem
            // ele toda compra persistida voltava com `upgradeId: ''` — um ledger de
            // auditoria incapaz de dizer qual protocolo causou cada debito, que e
            // a unica pergunta que se faz a ele.
            JSON.stringify({
              upgradeId: decision.upgradeId,
              unlockedLoreFragmentId: decision.loreFragmentId,
            }),
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
      },
    );
  }

  async markLoreRead(
    profileId: string,
    fragmentId: LoreFragmentId,
    now: string,
  ): Promise<MarkReadOutput> {
    return this.runOrAbort<MarkReadOutput>(
      (code) => ({ ok: false, error: code }),
      async (client) => {
        const rows = await client.query(
          'select * from progression_profiles where profile_id = $1 for update',
          [profileId],
        );
        const row = rows.rows[0];
        if (!row) throw new AbortTransaction('unauthenticated');
        const decision = decideMarkRead(rowToProfile(row), fragmentId, now);
        if (!decision.ok) throw new AbortTransaction(decision.error);
        if (decision.changed) {
          // SO a coluna de leitura, sem `profile_version` no where nem no set:
          // a lista so cresce e a uniao e idempotente, entao nao ha corrida a
          // proteger — e uma compra concorrente nao pode virar 409 porque o
          // jogador abriu um documento.
          await client.query(
            `update progression_profiles set read_lore = $2::jsonb, updated_at = $3
            where profile_id = $1`,
            [profileId, JSON.stringify(decision.profile.readLoreFragmentIds), now],
          );
        }
        return { ok: true, readLoreFragmentIds: [...decision.profile.readLoreFragmentIds] };
      },
    );
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
