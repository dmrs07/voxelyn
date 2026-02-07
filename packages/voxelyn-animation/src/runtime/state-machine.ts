import type {
  AnimationClip,
  AnimationFacing,
  AnimationIntent,
  AnimationPlayer,
} from '../types.js';

const ONE_SHOT_INTENTS = new Set<AnimationIntent>(['attack', 'cast', 'hit', 'die']);

export const intentToClipId = (
  intent: AnimationIntent,
  clips: Record<string, AnimationClip>
): string => {
  if (intent === 'move') {
    if (clips.walk) return 'walk';
    return clips.idle ? 'idle' : Object.keys(clips)[0] ?? 'idle';
  }

  if (intent === 'idle') {
    return clips.idle ? 'idle' : Object.keys(clips)[0] ?? 'idle';
  }

  if (clips[intent]) return intent;
  if (intent === 'attack' && clips.cast) return 'cast';
  if (intent === 'cast' && clips.attack) return 'attack';
  if (intent === 'hit' && clips.attack) return 'attack';
  return clips.idle ? 'idle' : Object.keys(clips)[0] ?? 'idle';
};

export const shouldLockForIntent = (intent: AnimationIntent): boolean =>
  ONE_SHOT_INTENTS.has(intent);

export const canInterruptCurrent = (
  player: AnimationPlayer,
  nowIntent: AnimationIntent,
  clip: AnimationClip
): boolean => {
  if (!player.lockUntilEnd) return true;

  // Death stays terminal after it starts.
  if (player.currentClipId === 'die') {
    return false;
  }

  // If clip has ended, one-shot lock can be released.
  if (!clip.loop && player.elapsedMs >= clip.lengthMs) {
    return true;
  }

  // While one-shot clip is running, only die can interrupt.
  if (nowIntent === 'die') return true;
  return false;
};

export const normalizeFacing = (
  facing: AnimationFacing | undefined,
  fallback: AnimationFacing
): AnimationFacing => facing ?? fallback;
