import type { AtlasSource, ImportedAnimationSet } from '../types.js';
import { sliceAtlasFrame, type AtlasFrameRect } from './atlas-slice.js';
import { assembleImportedSet, createClipFromFrames, isOneShotClipId, normalizeClipName } from './common.js';

type TexturePackerFrame = {
  frame: AtlasFrameRect;
  duration?: number;
};

const toBaseName = (name: string): string => {
  const slash = name.lastIndexOf('/');
  const file = slash >= 0 ? name.slice(slash + 1) : name;
  const dot = file.lastIndexOf('.');
  return dot >= 0 ? file.slice(0, dot) : file;
};

const parseClipAndOrder = (name: string): { clipId: string; order: number } => {
  const base = toBaseName(name);
  const match = base.match(/^(.*?)(?:[_-]?(\d+))?$/);
  const raw = (match?.[1] ?? base).replace(/[_-]+$/g, '');
  const clipId = normalizeClipName(raw);
  const order = Number.parseInt(match?.[2] ?? '0', 10);
  return { clipId, order: Number.isFinite(order) ? order : 0 };
};

export const importTexturePacker = (json: unknown, atlas: AtlasSource): ImportedAnimationSet => {
  if (!json || typeof json !== 'object') {
    throw new Error('JSON TexturePacker invalido');
  }

  const framesRaw = (json as { frames?: unknown }).frames;
  if (!framesRaw || typeof framesRaw !== 'object' || Array.isArray(framesRaw)) {
    throw new Error('TexturePacker exige frames como objeto');
  }

  const groups = new Map<string, Array<{ order: number; frame: ReturnType<typeof sliceAtlasFrame>; duration: number }>>();

  for (const [name, entry] of Object.entries(framesRaw as Record<string, TexturePackerFrame>)) {
    if (!entry || !entry.frame) {
      throw new Error(`Frame TexturePacker invalido: ${name}`);
    }

    const { clipId, order } = parseClipAndOrder(name);
    const sliced = sliceAtlasFrame(atlas, entry.frame);
    const bucket = groups.get(clipId);
    const item = {
      order,
      frame: sliced,
      duration: Math.max(1, entry.duration ?? 100),
    };

    if (bucket) {
      bucket.push(item);
    } else {
      groups.set(clipId, [item]);
    }
  }

  const clips: Record<string, ReturnType<typeof createClipFromFrames>> = {};

  for (const [clipId, items] of groups.entries()) {
    items.sort((a, b) => a.order - b.order);
    const frames = items.map((it) => it.frame);
    const durations = items.map((it) => it.duration);
    clips[clipId] = createClipFromFrames(clipId, frames, durations, !isOneShotClipId(clipId));
  }

  if (!clips.idle) {
    clips.idle = clips.walk ?? clips.attack ?? clips.cast ?? clips.hit ?? clips.die;
  }

  if (!clips.idle) {
    throw new Error('TexturePacker nao produziu nenhum clip utilizavel');
  }

  return assembleImportedSet('texturepacker', clips);
};
