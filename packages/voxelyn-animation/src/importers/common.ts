import type { AnimationClip, AnimationSet, ImportedAnimationSet, PixelSprite } from '../types.js';

export const normalizeClipName = (name: string): string => {
  const n = name.toLowerCase();
  if (n.includes('idle')) return 'idle';
  if (n.includes('walk') || n.includes('run') || n.includes('move')) return 'walk';
  if (n.includes('attack') || n.includes('strike') || n.includes('swing')) return 'attack';
  if (n.includes('cast') || n.includes('spell') || n.includes('magic')) return 'cast';
  if (n.includes('hit') || n.includes('hurt') || n.includes('damage')) return 'hit';
  if (n.includes('die') || n.includes('death') || n.includes('dead')) return 'die';
  return n;
};

const copyFrameInto = (out: PixelSprite, src: PixelSprite): PixelSprite => {
  if (out.width !== src.width || out.height !== src.height) {
    throw new Error('Frame importado com dimensoes inconsistentes');
  }
  out.pixels.set(src.pixels);
  return out;
};

const makeDurationTable = (durations: number[]): number[] => {
  let total = 0;
  const table: number[] = [];
  for (const d of durations) {
    total += Math.max(1, d | 0);
    table.push(total);
  }
  return table;
};

const pickFrameIndexByTime = (localMs: number, cumulative: number[]): number => {
  for (let i = 0; i < cumulative.length; i += 1) {
    if (localMs < cumulative[i]!) return i;
  }
  return Math.max(0, cumulative.length - 1);
};

export const createClipFromFrames = (
  id: string,
  frames: PixelSprite[],
  durationsMs: number[],
  loop: boolean
): AnimationClip => {
  if (frames.length === 0) {
    throw new Error(`Clip ${id} sem frames`);
  }
  if (durationsMs.length !== frames.length) {
    throw new Error(`Clip ${id} com duracoes inconsistentes`);
  }

  const cumulative = makeDurationTable(durationsMs);
  const totalMs = cumulative[cumulative.length - 1] ?? 100;
  const avgFrameMs = Math.max(1, Math.round(totalMs / frames.length));
  const fps = Math.max(1, Math.round(1000 / avgFrameMs));

  return {
    id,
    fps,
    loop,
    lengthMs: totalMs,
    generator: ({ out, localTMs }) => {
      const t = loop ? localTMs % totalMs : Math.min(localTMs, Math.max(0, totalMs - 1));
      const index = pickFrameIndexByTime(t, cumulative);
      const frame = frames[index] ?? frames[0]!;
      return copyFrameInto(out, frame);
    },
  };
};

export const assembleImportedSet = (
  source: ImportedAnimationSet['source'],
  clips: Record<string, AnimationClip>
): ImportedAnimationSet => {
  const set: AnimationSet = {
    idle: clips.idle,
    walk: clips.walk,
    attack: clips.attack,
    cast: clips.cast,
    hit: clips.hit,
    die: clips.die,
    aliases: { ...clips },
  };

  if (!set.idle) {
    const first = clips[Object.keys(clips)[0] ?? ''];
    if (first) set.idle = first;
  }

  return {
    source,
    set,
    clipMap: clips,
  };
};

export const isOneShotClipId = (id: string): boolean => id === 'attack' || id === 'cast' || id === 'hit' || id === 'die';
