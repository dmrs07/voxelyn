import type { AtlasSource, ImportedAnimationSet } from '../types.js';
import { sliceAtlasFrame, type AtlasFrameRect } from './atlas-slice.js';
import { assembleImportedSet, createClipFromFrames, isOneShotClipId, normalizeClipName } from './common.js';

type AsepriteFrameRecord = {
  frame: AtlasFrameRect;
  duration?: number;
};

type AsepriteTag = {
  name: string;
  from: number;
  to: number;
  direction?: 'forward' | 'reverse' | 'pingpong';
};

const normalizedFrameRecords = (json: unknown): AsepriteFrameRecord[] => {
  if (!json || typeof json !== 'object') {
    throw new Error('JSON Aseprite invalido');
  }
  const root = json as { frames?: unknown };
  const frames = root.frames;

  if (Array.isArray(frames)) {
    const out: AsepriteFrameRecord[] = [];
    for (const entry of frames) {
      if (!entry || typeof entry !== 'object') throw new Error('Frame Aseprite invalido');
      const frame = (entry as { frame?: AtlasFrameRect }).frame;
      if (!frame) throw new Error('Frame Aseprite sem campo frame');
      out.push({
        frame,
        duration: (entry as { duration?: number }).duration,
      });
    }
    return out;
  }

  if (frames && typeof frames === 'object') {
    const entries = Object.entries(frames as Record<string, AsepriteFrameRecord>);
    entries.sort(([a], [b]) => a.localeCompare(b));
    return entries.map(([, value]) => {
      if (!value || !value.frame) throw new Error('Frame Aseprite invalido em objeto');
      return value;
    });
  }

  throw new Error('JSON Aseprite sem frames');
};

const expandTagIndices = (tag: AsepriteTag): number[] => {
  if (tag.to < tag.from) {
    const out: number[] = [];
    for (let i = tag.from; i >= tag.to; i -= 1) out.push(i);
    return out;
  }

  const base: number[] = [];
  for (let i = tag.from; i <= tag.to; i += 1) base.push(i);
  if (tag.direction === 'reverse') return [...base].reverse();
  if (tag.direction === 'pingpong' && base.length > 1) {
    return [...base, ...base.slice(1, -1).reverse()];
  }
  return base;
};

export const importAseprite = (json: unknown, atlas: AtlasSource): ImportedAnimationSet => {
  const records = normalizedFrameRecords(json);
  const frames = records.map((record) => sliceAtlasFrame(atlas, record.frame));
  const durations = records.map((record) => Math.max(1, record.duration ?? 100));

  const root = json as {
    meta?: { frameTags?: AsepriteTag[] };
  };

  const tags = root.meta?.frameTags ?? [];
  const clips: Record<string, ReturnType<typeof createClipFromFrames>> = {};

  if (tags.length === 0) {
    clips.idle = createClipFromFrames('idle', frames, durations, true);
    return assembleImportedSet('aseprite', clips);
  }

  for (const tag of tags) {
    const clipId = normalizeClipName(tag.name);
    const indices = expandTagIndices(tag);
    if (indices.length === 0) continue;

    const clipFrames = indices.map((i) => {
      const frame = frames[i];
      if (!frame) throw new Error(`Tag ${tag.name} referencia frame inexistente: ${i}`);
      return frame;
    });
    const clipDurations = indices.map((i) => durations[i] ?? 100);
    const loop = !isOneShotClipId(clipId) && tag.direction !== 'reverse';
    clips[clipId] = createClipFromFrames(clipId, clipFrames, clipDurations, loop);
  }

  if (!clips.idle) {
    clips.idle = clips.walk ?? clips.attack ?? createClipFromFrames('idle', frames, durations, true);
  }

  return assembleImportedSet('aseprite', clips);
};
