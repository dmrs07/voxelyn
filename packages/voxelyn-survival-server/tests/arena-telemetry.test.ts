import { describe, expect, it } from 'vitest';
import { MemoryArenaTelemetry, digestOf, type ArenaTelemetryEvent } from '../src/arena-telemetry';
import { sanitizeArenaEvent } from '../src/arena-telemetry-http';
import { MemoryTelemetry, digestOf as campaignDigestOf } from '../src/telemetry';
import { sanitizeEvent } from '../src/telemetry-http';

const event = (overrides: Partial<ArenaTelemetryEvent> = {}): ArenaTelemetryEvent => ({
  boss: 'guardian',
  seed: 3,
  generation: 'G-04',
  sector: 7,
  startingHp: 100,
  ability: 'pulse',
  modules: [],
  tuningHash: 'abc123',
  outcome: 'boss_killed',
  ticks: 4000,
  hpRemaining: 40,
  damageDealtTenths: 5000,
  damageTakenTenths: 600,
  shots: 200,
  kills: 3,
  deathCause: null,
  ...overrides,
});

describe('digestOf (arena)', () => {
  it('is empty over an empty input', () => {
    const digest = digestOf([]);
    expect(digest.runs).toBe(0);
    expect(digest.byBoss).toEqual({});
    expect(digest.byLoadout).toEqual({});
  });

  it('groups outcomes and computes median time-to-kill per boss', () => {
    const digest = digestOf([
      event({ boss: 'guardian', outcome: 'boss_killed', ticks: 1000 }),
      event({ boss: 'guardian', outcome: 'boss_killed', ticks: 3000 }),
      event({ boss: 'guardian', outcome: 'player_dead' }),
      event({ boss: 'bishop', outcome: 'abandoned' }),
    ]);

    expect(digest.runs).toBe(4);
    expect(digest.byBoss.guardian.runs).toBe(3);
    expect(digest.byBoss.guardian.outcomeCounts).toEqual({
      boss_killed: 2,
      player_dead: 1,
      abandoned: 0,
    });
    expect(digest.byBoss.guardian.medianTicksToKill).toBe(2000);
    expect(digest.byBoss.bishop.outcomeCounts.abandoned).toBe(1);
    expect(digest.byBoss.bishop.medianTicksToKill).toBeNull();
  });

  it('groups by loadout independently of the order modules were checked', () => {
    const digest = digestOf([
      event({ ability: 'seeker', modules: ['piercing', 'explosive'] }),
      event({ ability: 'seeker', modules: ['explosive', 'piercing'] }),
      event({ ability: 'pulse', modules: [] }),
    ]);
    const loadouts = digest.byLoadout.guardian;
    expect(loadouts['seeker+explosive,piercing'].runs).toBe(2);
    expect(loadouts['pulse+'].runs).toBe(1);
  });

  it('treats a boss literally named "__proto__" as a plain key', () => {
    const digest = digestOf([event({ boss: '__proto__' })]);
    expect(digest.byBoss.__proto__.runs).toBe(1);
    expect(Object.getPrototypeOf(digest.byBoss)).toBe(Object.prototype);
  });
});

describe('MemoryArenaTelemetry', () => {
  it('records and digests events', async () => {
    const store = new MemoryArenaTelemetry();
    await store.record(event({ boss: 'guardian' }));
    await store.record(event({ boss: 'bishop', outcome: 'player_dead' }));
    const digest = await store.digest(100);
    expect(digest.runs).toBe(2);
    expect(digest.byBoss.guardian).toBeDefined();
    expect(digest.byBoss.bishop).toBeDefined();
  });

  it('caps at its configured capacity, dropping the oldest event first', async () => {
    const store = new MemoryArenaTelemetry(2);
    await store.record(event({ seed: 1 }));
    await store.record(event({ seed: 2 }));
    await store.record(event({ seed: 3 }));
    const digest = await store.digest(100);
    expect(digest.runs).toBe(2);
  });
});

describe('sanitizeArenaEvent', () => {
  it('accepts a well-formed event', () => {
    const parsed = sanitizeArenaEvent(event());
    expect(parsed).not.toBeNull();
    expect(parsed?.boss).toBe('guardian');
  });

  it('rejects an event with no boss', () => {
    expect(sanitizeArenaEvent({ ...event(), boss: '' })).toBeNull();
    expect(sanitizeArenaEvent({})).toBeNull();
    expect(sanitizeArenaEvent(null)).toBeNull();
  });

  it('clamps out-of-range numeric fields instead of rejecting the event', () => {
    const parsed = sanitizeArenaEvent({ ...event(), ticks: -5, shots: 1e12 });
    expect(parsed).not.toBeNull();
    expect(parsed!.ticks).toBe(0);
    expect(parsed!.shots).toBe(1_000_000);
  });

  it('falls back to "abandoned" for an unrecognized outcome', () => {
    const parsed = sanitizeArenaEvent({ ...event(), outcome: 'something_else' });
    expect(parsed?.outcome).toBe('abandoned');
  });

  it('bounds the modules list instead of trusting an arbitrarily long array', () => {
    const parsed = sanitizeArenaEvent({
      ...event(),
      modules: Array.from({ length: 50 }, (_, i) => `m${i}`),
    });
    expect(parsed!.modules.length).toBeLessThanOrEqual(12);
  });
});

describe('isolation from campaign telemetry', () => {
  it('recording arena events never affects an independent campaign store', async () => {
    const arenaStore = new MemoryArenaTelemetry();
    const campaignStore = new MemoryTelemetry();

    await arenaStore.record(event());
    await arenaStore.record(event({ boss: 'bishop', outcome: 'player_dead' }));

    // Dois stores independentes: gravar na Arena nunca toca o de campanha,
    // porque nao ha caminho de codigo nenhum entre os dois.
    const campaignDigest = await campaignStore.digest(100);
    expect(campaignDigest.runs).toBe(0);
    expect(campaignDigestOf([])).toEqual(campaignDigest);
  });

  it("an arena-shaped payload is REJECTED by the campaign's sanitizer, not silently accepted", () => {
    // Prova mais forte que "os stores sao objetos diferentes": mesmo que
    // trafego de arena batesse por engano em `/telemetry`, o sanitizador de
    // campanha exige `session` (string >= 4 chars) — campo que um evento de
    // arena nunca carrega — e recusa o evento inteiro em vez de aceita-lo
    // com um campo vazio.
    const arenaShaped = event();
    expect(sanitizeEvent(arenaShaped, null)).toBeNull();
  });
});
