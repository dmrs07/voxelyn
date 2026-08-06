import { describe, expect, it } from 'vitest';
import type { DamageCause, RunStats, RunSummary } from '@voxelyn/survival-sim';
import {
  clearAgentRunRecords,
  digestOf,
  listAgentRunRecords,
  recordAgentRun,
  type AgentRunRecord,
} from '../src/telemetry.js';
import { createAgentRun } from '../src/runs.js';

const stats = (overrides: Partial<RunStats> = {}): RunStats => ({
  shotsFired: 20,
  kills: {} as RunStats['kills'],
  damageTakenTenths: 300,
  damageDealtTenths: 500,
  solidsDestroyed: 0,
  salvageCompleted: 0,
  modulesAcquired: 0,
  purgeCellsUsed: 0,
  timesDowned: 0,
  revivesGiven: 0,
  oreCollected: 0,
  innocentsKilled: 0,
  discoveries: 0,
  ...overrides,
});

const summary = (overrides: Partial<RunSummary> = {}): RunSummary => ({
  seed: 1,
  phase: 'dead',
  ticks: 1000,
  contamination: 0.1,
  deathCause: { kind: 'enemy_contact', archetype: 'stalker', elite: false } as DamageCause,
  stats: stats(),
  cores: 0,
  sectorCount: 3,
  stars: 1,
  targetTicks: 2000,
  ...overrides,
});

let nextRunId = 0;
const record = (overrides: Partial<AgentRunRecord> = {}): AgentRunRecord => ({
  runId: `fixture-${nextRunId++}`,
  seed: 1,
  tag: 'default',
  summary: summary(),
  finalSector: 1,
  recordedAt: 0,
  ...overrides,
});

describe('digestOf', () => {
  it('is empty over an empty input', () => {
    const digest = digestOf([]);
    expect(digest.runs).toBe(0);
    expect(digest.starHistogram).toEqual([0, 0, 0, 0]);
    expect(digest.sectorReach).toEqual([]);
    expect(digest.deathCauses).toEqual([]);
    expect(digest.avgShotsPerKill).toBeNull();
  });

  it('counts outcomes, stars and death causes', () => {
    const digest = digestOf([
      record({
        summary: summary({ phase: 'dead', stars: 0, deathCause: { kind: 'fire' } }),
        finalSector: 2,
      }),
      record({
        summary: summary({ phase: 'dead', stars: 1, deathCause: { kind: 'fire' } }),
        finalSector: 1,
      }),
      record({
        summary: summary({ phase: 'extracted_with_core', stars: 3, deathCause: null }),
        finalSector: 3,
      }),
    ]);

    expect(digest.runs).toBe(3);
    expect(digest.outcomeCounts.dead).toBe(2);
    expect(digest.outcomeCounts.extracted_with_core).toBe(1);
    expect(digest.starHistogram).toEqual([1, 1, 0, 1]);
    expect(digest.deathCauses).toEqual([{ cause: 'fire', count: 2 }]);
  });

  it('builds a monotonic sector-reach funnel from the finished sector', () => {
    const digest = digestOf([
      record({ finalSector: 1 }),
      record({ finalSector: 2 }),
      record({ finalSector: 3 }),
    ]);
    // sector 1 reached by all three, sector 2 by two, sector 3 by one.
    expect(digest.sectorReach).toEqual([1, 2 / 3, 1 / 3]);
  });

  it('groups by tag without mixing counts', () => {
    const digest = digestOf([
      record({ tag: 'baseline' }),
      record({ tag: 'baseline' }),
      record({ tag: 'buffed-hp' }),
    ]);
    expect(digest.runsByTag).toEqual({ baseline: 2, 'buffed-hp': 1 });
  });

  it('treats a tag literally named "__proto__" as a plain key, not a prototype write', () => {
    const digest = digestOf([record({ tag: '__proto__' }), record({ tag: '__proto__' })]);
    expect(digest.runsByTag.__proto__).toBe(2);
    expect(Object.getPrototypeOf(digest.runsByTag)).toBe(Object.prototype);
  });

  it('computes shots-per-kill only when at least one kill happened', () => {
    const withKill = digestOf([
      record({
        summary: summary({
          stats: stats({ shotsFired: 10, kills: { stalker: 2 } as RunStats['kills'] }),
        }),
      }),
    ]);
    expect(withKill.avgShotsPerKill).toBe(5);

    const noKills = digestOf([record({ summary: summary({ stats: stats({ shotsFired: 10 }) }) })]);
    expect(noKills.avgShotsPerKill).toBeNull();
  });
});

describe('recordAgentRun', () => {
  const finishedRun = (seed: number) => {
    const run = createAgentRun(seed);
    run.state.phase = 'dead';
    run.state.summary = {
      seed,
      phase: 'dead',
      ticks: 500,
      contamination: 0,
      deathCause: { kind: 'unknown' },
      stats: stats(),
      cores: 0,
      sectorCount: 3,
      stars: 0,
      targetTicks: 2000,
    };
    return run;
  };

  it('returns null for a run that has not finished', () => {
    clearAgentRunRecords();
    const run = createAgentRun(999);
    expect(recordAgentRun(run, 'x')).toBeNull();
  });

  it('is idempotent: recording the same run twice keeps a single entry', () => {
    clearAgentRunRecords();
    const run = finishedRun(123);
    const first = recordAgentRun(run, 'baseline');
    const second = recordAgentRun(run, 'a-different-tag-does-not-matter');

    expect(first).not.toBeNull();
    expect(second).not.toBeNull();
    expect(second!.alreadyRecorded).toBe(true);
    // Mesmo registro: a segunda chamada nao pode mudar a tag nem duplicar.
    expect(second!.record).toBe(first!.record);
    expect(second!.record.tag).toBe('baseline');
    expect(listAgentRunRecords().filter((r) => r.runId === run.id)).toHaveLength(1);
    expect(digestOf(listAgentRunRecords().filter((r) => r.runId === run.id)).runs).toBe(1);
  });

  it('records two distinct runs as two entries', () => {
    clearAgentRunRecords();
    recordAgentRun(finishedRun(1), 'x');
    recordAgentRun(finishedRun(2), 'x');
    expect(listAgentRunRecords()).toHaveLength(2);
  });
});
