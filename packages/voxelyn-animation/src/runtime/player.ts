import type {
  AnimationClip,
  AnimationFacing,
  AnimationFrameRef,
  AnimationIntent,
  AnimationPlayer,
  AnimationSet,
} from '../types.js';
import { acquireFrame, createFramePool, type FramePool } from './frame-pool.js';
import {
  canInterruptCurrent,
  intentToClipId,
  normalizeFacing,
  shouldLockForIntent,
} from './state-machine.js';

const DEFAULT_FACING: AnimationFacing = 'dr';

export type CreateAnimationPlayerConfig = {
  set: AnimationSet;
  width: number;
  height: number;
  seed?: number;
  initialClipId?: string;
  framePool?: FramePool;
};

const resolveClipMap = (set: AnimationSet): Record<string, AnimationClip> => {
  const out: Record<string, AnimationClip> = {};
  if (set.idle) out.idle = set.idle;
  if (set.walk) out.walk = set.walk;
  if (set.attack) out.attack = set.attack;
  if (set.cast) out.cast = set.cast;
  if (set.hit) out.hit = set.hit;
  if (set.die) out.die = set.die;
  if (set.aliases) {
    for (const [key, clip] of Object.entries(set.aliases)) {
      out[key] = clip;
    }
  }

  if (Object.keys(out).length === 0) {
    throw new Error('AnimationSet vazio: pelo menos um clip e necessario');
  }
  return out;
};

const DEFAULT_POOL = createFramePool();

export const createAnimationPlayer = (config: CreateAnimationPlayerConfig): AnimationPlayer => {
  const clips = resolveClipMap(config.set);
  const firstClipId = config.initialClipId && clips[config.initialClipId]
    ? config.initialClipId
    : (clips.idle ? 'idle' : Object.keys(clips)[0] ?? 'idle');

  const pool = config.framePool ?? DEFAULT_POOL;
  const frame = acquireFrame(pool, config.width, config.height);

  return {
    clips,
    currentClipId: firstClipId,
    elapsedMs: 0,
    totalMs: 0,
    seed: config.seed ?? 1,
    lastFacing: DEFAULT_FACING,
    frame,
    lockUntilEnd: false,
  };
};

const switchClip = (player: AnimationPlayer, nextClipId: string, lock: boolean): void => {
  if (!player.clips[nextClipId]) return;
  if (player.currentClipId === nextClipId) return;
  player.currentClipId = nextClipId;
  player.elapsedMs = 0;
  player.lockUntilEnd = lock;
};

const resolveCurrentClip = (player: AnimationPlayer): AnimationClip => {
  const clip = player.clips[player.currentClipId];
  if (clip) return clip;
  const fallback = player.clips.idle ?? player.clips[Object.keys(player.clips)[0] ?? ''];
  if (!fallback) {
    throw new Error('AnimationPlayer sem clips validos');
  }
  return fallback;
};

export const stepAnimation = (
  player: AnimationPlayer,
  dtMs: number,
  intent: AnimationIntent,
  facing: AnimationFacing
): AnimationFrameRef => {
  const safeDt = Number.isFinite(dtMs) ? Math.max(0, dtMs) : 0;
  player.totalMs += safeDt;
  player.lastFacing = normalizeFacing(facing, player.lastFacing);

  let clip = resolveCurrentClip(player);
  const desiredClipId = intentToClipId(intent, player.clips);

  if (desiredClipId !== player.currentClipId && canInterruptCurrent(player, intent, clip)) {
    switchClip(player, desiredClipId, shouldLockForIntent(intent));
    clip = resolveCurrentClip(player);
  }

  player.elapsedMs += safeDt;

  if (!clip.loop && player.elapsedMs >= clip.lengthMs) {
    if (player.currentClipId === 'die') {
      player.elapsedMs = clip.lengthMs;
      player.lockUntilEnd = true;
    } else {
      player.lockUntilEnd = false;
      const postClipId = desiredClipId !== player.currentClipId
        ? desiredClipId
        : (player.clips.idle ? 'idle' : player.currentClipId);
      if (postClipId !== player.currentClipId && player.clips[postClipId]) {
        switchClip(player, postClipId, false);
        clip = resolveCurrentClip(player);
      } else {
        player.elapsedMs = Math.min(player.elapsedMs, clip.lengthMs);
      }
    }
  }

  const frameDurationMs = Math.max(1, Math.round(1000 / Math.max(1, clip.fps)));
  const localMs = clip.loop
    ? (clip.lengthMs > 0 ? player.elapsedMs % clip.lengthMs : 0)
    : Math.max(0, Math.min(player.elapsedMs, Math.max(0, clip.lengthMs - 1)));
  const frameIndex = Math.max(0, Math.floor(localMs / frameDurationMs));

  player.frame.pixels.fill(0);
  clip.generator({
    out: player.frame,
    clipId: clip.id,
    tMs: player.totalMs,
    localTMs: localMs,
    frameIndex,
    facing: player.lastFacing,
    seed: player.seed,
  });

  return {
    clipId: clip.id,
    frameIndex,
    sprite: player.frame,
    localTMs: localMs,
  };
};

export const resetAnimation = (player: AnimationPlayer, clipId?: string): void => {
  const nextClipId = clipId && player.clips[clipId]
    ? clipId
    : (player.clips.idle ? 'idle' : Object.keys(player.clips)[0] ?? player.currentClipId);
  player.currentClipId = nextClipId;
  player.elapsedMs = 0;
  player.totalMs = 0;
  player.lockUntilEnd = false;
};
