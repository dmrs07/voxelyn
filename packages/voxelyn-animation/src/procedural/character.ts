import type {
  AnimationClip,
  AnimationFacing,
  AnimationSet,
  PixelSprite,
  ProceduralCharacter,
  ProceduralCharacterDef,
} from '../types.js';
import { getLoadedAtlas } from '../sprite-atlas/cache.js';
import { AtlasMissingError } from '../sprite-atlas/errors.js';
import { proceduralPalette } from './palette.js';
import { drawEnemyFrame } from './characters/enemy-archetypes.js';
import { drawWarriorFrame } from './characters/warrior.js';
import {
  AUTHORED_SPRITES,
  authoredStateIsLoop,
  authoredStateLengthMs,
  drawAuthoredFrame,
} from './characters/authored/index.js';
import type { AuthoredClipId, AuthoredSpriteDef } from './characters/authored/index.js';
import { buildPixelLabCharacter } from './pixellab-character.js';

const CLIP_DEFS: Array<{ id: keyof Omit<AnimationSet, 'aliases'>; fps: number; loop: boolean; lengthMs: number }> = [
  { id: 'idle', fps: 8, loop: true, lengthMs: 560 },
  { id: 'walk', fps: 10, loop: true, lengthMs: 420 },
  { id: 'attack', fps: 12, loop: false, lengthMs: 280 },
  { id: 'cast', fps: 12, loop: false, lengthMs: 320 },
  { id: 'hit', fps: 16, loop: false, lengthMs: 160 },
  { id: 'die', fps: 10, loop: false, lengthMs: 620 },
];

const AUTHORED_CLIP_FPS: Record<AuthoredClipId, number> = {
  idle: 8,
  walk: 10,
  attack: 14,
  hit: 12,
  die: 8,
};

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

const makeProceduralClip = (
  character: ProceduralCharacter,
  id: string,
  fps: number,
  loop: boolean,
  lengthMs: number
): AnimationClip => ({
  id,
  fps,
  loop,
  lengthMs,
  generator: ({ out, tMs, localTMs, facing }) =>
    drawByStyle(character, id, tMs, localTMs, facing, out),
});

const makeAuthoredClip = (
  def: AuthoredSpriteDef,
  clipId: AuthoredClipId
): AnimationClip => {
  const lengthMs = authoredStateLengthMs(def, clipId);
  const loop = authoredStateIsLoop(def, clipId);
  const fps = AUTHORED_CLIP_FPS[clipId];
  return {
    id: clipId,
    fps,
    loop,
    lengthMs,
    generator: ({ out, tMs, localTMs, facing }) =>
      drawAuthoredFrame(def, clipId, tMs, localTMs, facing, out),
  };
};

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

const buildAuthoredSet = (
  character: ProceduralCharacter,
  def: AuthoredSpriteDef
): AnimationSet => {
  const set: AnimationSet = {
    idle: makeAuthoredClip(def, 'idle'),
    walk: makeAuthoredClip(def, 'walk'),
    attack: makeAuthoredClip(def, 'attack'),
    hit: makeAuthoredClip(def, 'hit'),
    die: makeAuthoredClip(def, 'die'),
    // Authored packs don't define 'cast' — reuse procedural cast as a compatibility stub.
    cast: makeProceduralClip(character, 'cast', 12, false, 320),
  };
  set.aliases = {
    move: set.walk!,
    idle: set.idle!,
  };
  return set;
};

const buildProceduralSet = (character: ProceduralCharacter): AnimationSet => {
  const set: AnimationSet = {};
  for (const clipDef of CLIP_DEFS) {
    set[clipDef.id] = makeProceduralClip(character, clipDef.id, clipDef.fps, clipDef.loop, clipDef.lengthMs);
  }
  set.aliases = {
    move: set.walk!,
    idle: set.idle!,
  };
  return set;
};

const missingAtlasWarnings = new Set<string>();

const isProduction = (): boolean =>
  (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env
    ?.NODE_ENV === 'production';

const warnMissingAtlasOnce = (spriteId: string): void => {
  if (missingAtlasWarnings.has(spriteId)) return;
  missingAtlasWarnings.add(spriteId);
  console.warn(`[voxelyn-animation] atlas '${spriteId}' not preloaded; falling back.`);
};

export const createProceduralCharacter = (def: ProceduralCharacterDef): ProceduralCharacter => {
  if (def.source === 'pixellab') {
    const atlas = getLoadedAtlas(def.spriteId);
    if (atlas) return buildPixelLabCharacter(def, atlas);
    if (!isProduction()) {
      throw new AtlasMissingError(def.spriteId);
    }
    warnMissingAtlasOnce(def.spriteId);
  }

  const style = def.style ?? 'player';
  const useAuthored = def.source === 'pixellab' ? false : def.useAuthored;
  const authored = useAuthored ? AUTHORED_SPRITES[style] : undefined;

  const width = def.width ?? (authored ? authored.width : 16);
  const height = def.height ?? (authored ? authored.height : 20);
  const anchor = authored
    ? { x: Math.floor(width / 2), y: 29 }
    : { x: Math.floor(width / 2), y: height };

  const character: ProceduralCharacter = {
    id: def.id,
    seed: def.seed ?? 1,
    width,
    height,
    anchor,
    palette: { ...proceduralPalette, ...(def.palette ?? {}) },
    style,
    clips: {},
  };

  character.clips = authored
    ? buildAuthoredSet(character, authored)
    : buildProceduralSet(character);

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
