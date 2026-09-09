import { SOLID_NONE, SURF_FIRE } from './constants.js';
import { bodyBlocked, startAction } from './entities.js';
import { hasLineOfSight } from './pathing.js';
import { approach, suturePoint } from './sutures.js';
import { seamstressFrenzied } from './seamstress.js';
import { canRestoreWebSupport, restoreWebSupport, webSupportMaxHp } from './web-supports.js';
import type { Entity, SemanticEvent, SurvivalState, WebRepairJob } from './types.js';

export const WEB_STRAND_REPAIR_TICKS = 40;
export const WEB_SUPPORT_REPAIR_TICKS = 60;
const REPAIR_RECOVERY = 6;

const motherOf = (state: SurvivalState, worker: Entity): Entity | undefined =>
  state.enemies.find((e) => e.alive && e.id === worker.summonerId && seamstressFrenzied(e));
const sameJob = (a: WebRepairJob, b: WebRepairJob): boolean =>
  a.kind === b.kind && a.target === b.target;
const targetCell = (state: SurvivalState, job: WebRepairJob): number =>
  job.kind === 'support' ? job.target : (state.sutures.find((s) => s.id === job.target)?.a ?? -1);

const needsRepair = (state: SurvivalState, mother: Entity, job: WebRepairJob): boolean => {
  if (job.kind === 'support') {
    const support = mother.silk?.supports?.find((s) => s.cell === job.target);
    return (
      !!support && support.hp < webSupportMaxHp(support) && canRestoreWebSupport(state, support)
    );
  }
  const strand = state.sutures.find((s) => s.id === job.target && s.kind === 'web');
  return (
    !!strand &&
    strand.phase === 'loose' &&
    !strand.cells.some((c) => state.surface[c] === SURF_FIRE) &&
    !mother.silk?.supports?.some((s) => s.hp === 0 && (s.cell === strand.a || s.cell === strand.b))
  );
};

const canWorkFrom = (state: SurvivalState, worker: Entity, cell: number): boolean => {
  const p = suturePoint(state, cell);
  const d = Math.hypot(worker.x - p.x, worker.y - p.y);
  if (d >= 1.45) return false;
  // Aim at the exposed face of a solid anchor, not through its solid center.
  const inset = state.solid[cell] === SOLID_NONE ? 0 : 0.75 / (d || 1);
  return hasLineOfSight(
    state,
    worker.x,
    worker.y,
    p.x + (worker.x - p.x) * inset,
    p.y + (worker.y - p.y) * inset,
  );
};

/** One bounded walking search for all jobs. Inaccessible damage must not stall the worker. */
const reachableFloor = (state: SurvivalState, worker: Entity): Map<number, number> => {
  const w = state.config.width,
    h = state.config.height;
  const start = Math.floor(worker.y) * w + Math.floor(worker.x);
  const distance = new Map<number, number>([[start, 0]]),
    queue = [start];
  for (let n = 0; n < queue.length && n < 2048; n++) {
    const at = queue[n],
      x = at % w,
      y = Math.floor(at / w);
    for (const [nx, ny] of [
      [x - 1, y],
      [x + 1, y],
      [x, y - 1],
      [x, y + 1],
    ]) {
      const next = ny * w + nx;
      if (
        nx < 1 ||
        ny < 1 ||
        nx >= w - 1 ||
        ny >= h - 1 ||
        distance.has(next) ||
        bodyBlocked(state, worker, nx + 0.5, ny + 0.5)
      )
        continue;
      distance.set(next, distance.get(at)! + 1);
      queue.push(next);
    }
  }
  return distance;
};

export const webRepairFirst = (
  state: SurvivalState,
  worker: Entity,
  dt: number,
  events: SemanticEvent[],
): boolean => {
  const mother = motherOf(state, worker);
  if (!mother || worker.archetype !== 'stitcher') return false;
  const reachable = reachableFloor(state, worker);
  let job = worker.webRepair;
  if (!job || !needsRepair(state, mother, job) || !reachable.has(job.at)) {
    worker.webRepair = undefined;
    const candidates: Array<{ job: WebRepairJob; priority: number; distance: number }> = [];
    const jobs: Array<{ kind: WebRepairJob['kind']; target: number; priority: number }> = [
      ...(mother.silk?.supports ?? []).map((s) => ({
        kind: 'support' as const,
        target: s.cell,
        priority: s.hp === 0 ? 0 : 2,
      })),
      ...state.sutures
        .filter((s) => s.kind === 'web')
        .map((s) => ({
          kind: 'strand' as const,
          target: s.id,
          priority: 1,
        })),
    ];
    for (const spec of jobs) {
      const pending = { kind: spec.kind, target: spec.target, at: -1 };
      if (!needsRepair(state, mother, pending)) continue;
      if (
        state.enemies.some(
          (e) =>
            e !== worker &&
            e.alive &&
            e.stunnedUntil <= state.tick &&
            e.summonerId === worker.summonerId &&
            e.webRepair &&
            sameJob(e.webRepair, pending),
        )
      )
        continue;
      const cell = targetCell(state, pending),
        w = state.config.width;
      const cx = cell % w,
        cy = Math.floor(cell / w);
      for (let y = cy - 1; y <= cy + 1; y++)
        for (let x = cx - 1; x <= cx + 1; x++) {
          const at = y * w + x,
            distance = reachable.get(at);
          if (
            x < 1 ||
            x >= w - 1 ||
            y < 1 ||
            y >= state.config.height - 1 ||
            distance === undefined ||
            !canWorkFrom(state, { ...worker, x: x + 0.5, y: y + 0.5 }, cell)
          )
            continue;
          candidates.push({ job: { ...pending, at }, priority: spec.priority, distance });
        }
    }
    candidates.sort(
      (a, b) =>
        a.priority - b.priority ||
        a.distance - b.distance ||
        a.job.target - b.job.target ||
        a.job.at - b.job.at,
    );
    job = candidates[0]?.job;
    worker.webRepair = job;
  }
  if (!job) return false;
  const cell = targetCell(state, job),
    p = suturePoint(state, cell);
  if (canWorkFrom(state, worker, cell)) {
    const d = Math.hypot(p.x - worker.x, p.y - worker.y) || 1;
    const duration = job.kind === 'support' ? WEB_SUPPORT_REPAIR_TICKS : WEB_STRAND_REPAIR_TICKS;
    startAction(
      state,
      worker,
      'stitch',
      { x: (p.x - worker.x) / d, y: (p.y - worker.y) / d },
      duration,
      REPAIR_RECOVERY,
      events,
      job.target,
    );
    worker.vx = worker.vy = 0;
    worker.nextActionAt = state.tick + duration + REPAIR_RECOVERY;
  } else approach(state, worker, suturePoint(state, job.at), dt, 3.2);
  return true;
};

export const webRepairProgress = (state: SurvivalState, worker: Entity): number | null => {
  const action = worker.action;
  if (
    !worker.alive ||
    worker.stunnedUntil > state.tick ||
    !worker.webRepair ||
    action?.kind !== 'stitch' ||
    action.target !== worker.webRepair.target
  )
    return null;
  return Math.max(
    0,
    Math.min(1, (state.tick - action.startedAt) / Math.max(1, action.releaseAt - action.startedAt)),
  );
};

/** Checked before action release: stun, displacement or an invalid job cancels the channel. */
export const maintainWebRepair = (
  state: SurvivalState,
  worker: Entity,
  events: SemanticEvent[],
): void => {
  const job = worker.webRepair;
  if (!job) return;
  const mother = motherOf(state, worker);
  if (
    mother &&
    worker.stunnedUntil <= state.tick &&
    needsRepair(state, mother, job) &&
    (worker.action?.kind !== 'stitch' || canWorkFrom(state, worker, targetCell(state, job)))
  )
    return;
  worker.webRepair = undefined;
  if (worker.action?.kind === 'stitch') {
    worker.action = undefined;
    events.push({ t: 'action_end', entity: worker.id });
  }
  worker.nextActionAt = Math.min(worker.nextActionAt, state.tick);
};

export const finishWebRepair = (
  state: SurvivalState,
  worker: Entity,
  events: SemanticEvent[],
): void => {
  const job = worker.webRepair,
    mother = motherOf(state, worker);
  worker.webRepair = undefined;
  if (
    !job ||
    !mother ||
    !needsRepair(state, mother, job) ||
    !canWorkFrom(state, worker, targetCell(state, job))
  )
    return;
  if (job.kind === 'support') {
    const support = mother.silk!.supports!.find((s) => s.cell === job.target)!;
    if (restoreWebSupport(state, support))
      events.push({ t: 'chip', ...suturePoint(state, support.cell) });
  } else {
    const strand = state.sutures.find((s) => s.id === job.target)!;
    strand.tension = 100;
    strand.phase = 'taut';
    events.push({ t: 'suture', phase: 'sew', id: strand.id, ...suturePoint(state, strand.a) });
    events.push({ t: 'suture', phase: 'taut', id: strand.id, ...suturePoint(state, strand.a) });
  }
};
