import type { AnimationFacing, AnimationIntent, AnimationPlayer, AnimationSet } from '../types.js';

export type AnimationRuntimeConfig = {
  set: AnimationSet;
  width: number;
  height: number;
  seed?: number;
  initialClipId?: string;
};

export type StepAnimationInput = {
  dtMs: number;
  intent: AnimationIntent;
  facing: AnimationFacing;
};

export type AnimationRuntimeState = AnimationPlayer;
