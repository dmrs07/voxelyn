import { describe, expect, it } from 'vitest';
import { createRun, emptyCommand, stepRun } from '@voxelyn/survival-sim';
import { decodeCommandLog, fromBase64 } from '@voxelyn/survival-protocol';
import {
  applyAction,
  createAgentRun,
  exportReplay,
  getAgentRun,
  listAgentRuns,
  MAX_ACTIVE_RUNS,
  MAX_TICKS_PER_ACT,
} from '../src/runs.js';

describe('createAgentRun', () => {
  it('starts a fresh solo run at tick 0', () => {
    const run = createAgentRun(1);
    expect(run.state.tick).toBe(0);
    expect(run.state.phase).toBe('running');
    expect(run.state.config.playerCount).toBe(1);
    expect(getAgentRun(run.id)).toBe(run);
  });
});

describe('applyAction', () => {
  it('repeats the same command for the requested number of ticks', () => {
    const run = createAgentRun(2);
    const result = applyAction(run, { move: { x: 1, y: 0 } }, 5);
    expect(result.ticksApplied).toBe(5);
    expect(result.events).toHaveLength(5);
    expect(run.state.tick).toBe(5);
    expect(run.commandLog).toHaveLength(5);
  });

  it('clamps ticks to the configured ceiling', () => {
    const run = createAgentRun(3);
    const result = applyAction(run, {}, MAX_TICKS_PER_ACT + 500);
    expect(result.ticksApplied).toBe(MAX_TICKS_PER_ACT);
  });

  it('stops early once the run leaves the running phase', () => {
    const run = createAgentRun(4);
    run.state.phase = 'dead';
    const result = applyAction(run, {}, 10);
    expect(result.ticksApplied).toBe(0);
    expect(result.finished).toBe(true);
  });

  it('is deterministic: same seed plus same actions reaches the same tile', () => {
    const runA = createAgentRun(42);
    const runB = createAgentRun(42);
    applyAction(runA, { move: { x: 0.7, y: 0.3 }, fire: true }, 30);
    applyAction(runB, { move: { x: 0.7, y: 0.3 }, fire: true }, 30);
    expect(runA.state.player.x).toBe(runB.state.player.x);
    expect(runA.state.player.y).toBe(runB.state.player.y);
    expect(runA.state.stats.shotsFired).toBe(runB.state.stats.shotsFired);
  });

  it('applies `choose` only on the first tick of the batch, never on the rest', () => {
    const run = createAgentRun(11);
    applyAction(run, { choose: 0 }, 5);
    expect(run.commandLog).toHaveLength(5);
    expect(run.commandLog[0].choose).toBe(0);
    for (let i = 1; i < run.commandLog.length; i++) {
      expect(run.commandLog[i].choose).toBeNull();
    }
  });
});

describe('exportReplay', () => {
  it('produces a log that re-simulates to the same tick and position', () => {
    const run = createAgentRun(7);
    applyAction(run, { move: { x: 1, y: 0.2 }, aim: { x: 1, y: 0 }, fire: true }, 40);

    const replay = exportReplay(run);
    expect(replay.seed).toBe(7);
    expect(replay.ticks).toBe(40);

    // Re-simula por fora, do jeito que o servidor real faria com o log exportado.
    const bytes = fromBase64(replay.log);
    expect(bytes).not.toBeNull();
    const commands = decodeCommandLog(bytes!, 10_000);
    expect(commands).not.toBeNull();
    expect(commands).toHaveLength(40);

    const resimulated = createRun({ seed: replay.seed, playerCount: 1 });
    for (const cmd of commands!) stepRun(resimulated, [cmd]);

    expect(resimulated.tick).toBe(run.state.tick);
    expect(resimulated.player.x).toBe(run.state.player.x);
    expect(resimulated.player.y).toBe(run.state.player.y);
  });

  it('exports an empty-command log for a run with no actions applied', () => {
    const run = createAgentRun(9);
    const replay = exportReplay(run);
    expect(replay.ticks).toBe(0);
    const bytes = fromBase64(replay.log);
    expect(bytes).not.toBeNull();
    expect(bytes!.length).toBe(0);
  });
});

describe('run capacity', () => {
  it('never keeps more than MAX_ACTIVE_RUNS runs alive, evicting finished ones first', () => {
    // Duas runs FINALIZADAS, criadas primeiro: devem ser as primeiras a cair
    // quando o teto for atingido, em vez das runs ainda em andamento abaixo.
    const finishedA = createAgentRun(90001);
    finishedA.state.phase = 'dead';
    const finishedB = createAgentRun(90002);
    finishedB.state.phase = 'dead';

    for (let i = 0; i < MAX_ACTIVE_RUNS; i++) createAgentRun(100000 + i);

    expect(listAgentRuns().length).toBeLessThanOrEqual(MAX_ACTIVE_RUNS);
    expect(getAgentRun(finishedA.id)).toBeUndefined();
    expect(getAgentRun(finishedB.id)).toBeUndefined();
  }, 20_000); // criar 500 mundos e o custo real de exercitar o teto de verdade.
});

// Sanity: emptyCommand nunca deveria mudar de forma sem que este arquivo quebre.
describe('emptyCommand shape', () => {
  it('matches the fields AgentAction relies on', () => {
    const cmd = emptyCommand();
    expect(cmd).toEqual({
      move: { x: 0, y: 0 },
      aim: { x: 0, y: 0 },
      fire: false,
      ability: false,
      dodge: false,
      interact: false,
      purge: false,
      choose: null,
    });
  });
});
