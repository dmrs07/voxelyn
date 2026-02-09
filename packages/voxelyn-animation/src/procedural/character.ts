import type {
  AnimationClip,
  AnimationFacing,
  AnimationSet,
  PixelSprite,
  ProceduralCharacter,
  ProceduralCharacterDef,
} from '../types.js';
import { proceduralPalette } from './palette.js';
import { drawEnemyFrame } from './characters/enemy-archetypes.js';
import { drawWarriorFrame } from './characters/warrior.js';

const CLIP_DEFS: Array<{ id: keyof Omit<AnimationSet, 'aliases'>; fps: number; loop: boolean; lengthMs: number }> = [
  { id: 'idle', fps: 8, loop: true, lengthMs: 560 },
  { id: 'walk', fps: 10, loop: true, lengthMs: 420 },
  { id: 'attack', fps: 12, loop: false, lengthMs: 280 },
  { id: 'cast', fps: 12, loop: false, lengthMs: 320 },
  { id: 'hit', fps: 16, loop: false, lengthMs: 160 },
  { id: 'die', fps: 10, loop: false, lengthMs: 620 },
];

const drawByStyle = (
  character: ProceduralCharacter,
  clipId: string,
  tMs: number,
  localTMs: number,
  facing: AnimationFacing,
  out: PixelSprite
): PixelSprite => {
  if (character.style === 'player') {
    return drawWarriorFrame(character, clipId, tMs, localTMs, facing, out);
  }
  return drawEnemyFrame(character, clipId, tMs, localTMs, facing, out);
};

const makeClip = (character: ProceduralCharacter, id: string, fps: number, loop: boolean, lengthMs: number): AnimationClip => ({
  id,
  fps,
  loop,
  lengthMs,
  generator: ({ out, tMs, localTMs, facing }) =>
    drawByStyle(character, id, tMs, localTMs, facing, out),
});

const isAnimationClip = (value: unknown): value is AnimationClip => {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as AnimationClip;
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.fps === 'number' &&
    typeof candidate.loop === 'boolean' &&
    typeof candidate.lengthMs === 'number' &&
    typeof candidate.generator === 'function'
  );
};

export const createProceduralCharacter = (def: ProceduralCharacterDef): ProceduralCharacter => {
  const width = def.width ?? 16;
  const height = def.height ?? 20;
  const character: ProceduralCharacter = {
    id: def.id,
    seed: def.seed ?? 1,
    width,
    height,
    palette: { ...proceduralPalette, ...(def.palette ?? {}) },
    style: def.style ?? 'player',
    clips: {},
  };

  const set: AnimationSet = {};
  for (const clipDef of CLIP_DEFS) {
    set[clipDef.id] = makeClip(character, clipDef.id, clipDef.fps, clipDef.loop, clipDef.lengthMs);
  }

  set.aliases = {
    move: set.walk!,
    idle: set.idle!,
  };

  character.clips = set;
  return character;
};

export const renderProceduralFrame = (
  character: ProceduralCharacter,
  clipId: string,
  tMs: number,
  facing: AnimationFacing,
  out: PixelSprite
): PixelSprite => {
  const direct = character.clips[clipId as keyof AnimationSet];
  const aliasClip = character.clips.aliases?.[clipId];
  const clip: AnimationClip | undefined =
    (isAnimationClip(direct) ? direct : undefined) ??
    aliasClip ??
    character.clips.idle;
  if (!clip) {
    throw new Error(`Clip invalido: ${clipId}`);
  }

  return clip.generator({
    out,
    clipId: clip.id,
    tMs,
    localTMs: clip.loop && clip.lengthMs > 0 ? tMs % clip.lengthMs : Math.min(tMs, clip.lengthMs),
    frameIndex: Math.floor((tMs / Math.max(1, Math.round(1000 / clip.fps))) % Math.max(1, Math.ceil(clip.lengthMs / Math.max(1, Math.round(1000 / clip.fps))))),
    facing,
    seed: character.seed,
  });
};
