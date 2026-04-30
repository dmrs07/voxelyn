import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { CharacterSpec, ClipId } from './config/types.js';
import {
  GPT_CUTTER_SHEETS,
  GPT_SHEETS,
  LOCAL_SPRITESHEETGEN_SHEETS,
  type GptCutterSheetSpec,
  type GptSheetClipLayout,
  type GptSheetSpec,
} from './config/gpt-sheets.js';
import type { Direction } from './generate.js';
import { PNG, type RawFramesByClip } from './pack-atlas.js';

type Cell = { col: number; row: number };
type Bounds = { minX: number; minY: number; maxX: number; maxY: number };
type Window = { x0: number; x1: number };

type PngImage = {
  width: number;
  height: number;
  data: Uint8Array;
};

export type GptSheetFrames = {
  raw: RawFramesByClip;
  source: 'gpt-sheet' | 'spritesheetgen' | 'spritesheet-v2';
  sheet: GptSheetSpec | GptCutterSheetSpec | VoxelynSpritesheetSpec;
  sheetPath: string;
  frameWidth?: number;
  frameHeight?: number;
  anchor?: { x: number; y: number };
};

const DIRECTIONS: Direction[] = ['DR', 'DL', 'UR', 'UL'];
const FRAME = 48;
const columnWindowCache = new WeakMap<PngImage, Window[]>();

const isBackgroundPixel = (data: Uint8Array, offset: number): boolean => {
  const a = data[offset + 3] ?? 255;
  if (a === 0) return true;
  const r = data[offset] ?? 0;
  const g = data[offset + 1] ?? 0;
  const b = data[offset + 2] ?? 0;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return min >= 185 && max - min <= 28;
};

const isForegroundPixel = (data: Uint8Array, offset: number): boolean =>
  !isBackgroundPixel(data, offset);

const floodClearCellBackground = (image: PngImage): void => {
  const visited = new Uint8Array(image.width * image.height);
  const queue: number[] = [];
  const enqueue = (x: number, y: number): void => {
    if (x < 0 || y < 0 || x >= image.width || y >= image.height) return;
    const index = y * image.width + x;
    if (visited[index]) return;
    const offset = index * 4;
    if (!isBackgroundPixel(image.data, offset)) return;
    visited[index] = 1;
    queue.push(index);
  };

  for (let x = 0; x < image.width; x += 1) {
    enqueue(x, 0);
    enqueue(x, image.height - 1);
  }
  for (let y = 0; y < image.height; y += 1) {
    enqueue(0, y);
    enqueue(image.width - 1, y);
  }

  for (let head = 0; head < queue.length; head += 1) {
    const index = queue[head]!;
    image.data[index * 4 + 3] = 0;
    const x = index % image.width;
    const y = Math.floor(index / image.width);
    enqueue(x + 1, y);
    enqueue(x - 1, y);
    enqueue(x, y + 1);
    enqueue(x, y - 1);
  }
};

const extractCell = (sheet: PngImage, config: GptSheetSpec, cell: Cell): PngImage => {
  const windows = detectColumnWindows(sheet, config);
  const window = windows[Math.min(cell.col, Math.max(0, windows.length - 1))];
  const bounds = window ? detectObjectInWindow(sheet, config, cell.row, window) : null;
  if (!bounds) return new PNG({ width: config.grid.cellWidth, height: config.grid.cellHeight });

  const out = new PNG({
    width: bounds.maxX - bounds.minX + 1,
    height: bounds.maxY - bounds.minY + 1,
  });
  out.data.fill(0);

  for (let y = 0; y < out.height; y += 1) {
    const srcOffset = ((bounds.minY + y) * sheet.width + bounds.minX) * 4;
    const dstOffset = y * out.width * 4;
    out.data.set(sheet.data.subarray(srcOffset, srcOffset + out.width * 4), dstOffset);
  }
  floodClearCellBackground(out);
  return out;
};

const extractRect = (
  sheet: PngImage,
  rect: { x: number; y: number; w: number; h: number },
): PngImage => {
  const out = new PNG({ width: rect.w, height: rect.h });
  out.data.fill(0);
  for (let y = 0; y < rect.h; y += 1) {
    const srcOffset = ((rect.y + y) * sheet.width + rect.x) * 4;
    const dstOffset = y * rect.w * 4;
    out.data.set(sheet.data.subarray(srcOffset, srcOffset + rect.w * 4), dstOffset);
  }
  return out;
};

const detectRunsInRow = (
  sheet: PngImage,
  config: GptSheetSpec,
  row: number,
): { start: number; end: number }[] => {
  const y0 = row * config.grid.cellHeight;
  const y1 = Math.min(sheet.height, y0 + config.grid.cellHeight);
  const runs: { start: number; end: number }[] = [];
  let inRun = false;
  let start = 0;

  for (let x = 0; x < sheet.width; x += 1) {
    let foregroundCount = 0;
    for (let y = y0; y < y1; y += 1) {
      if (isForegroundPixel(sheet.data, (y * sheet.width + x) * 4)) foregroundCount += 1;
    }
    const hasForeground = foregroundCount > 3;
    if (hasForeground && !inRun) {
      start = x;
      inRun = true;
    }
    if ((!hasForeground || x === sheet.width - 1) && inRun) {
      runs.push({ start, end: Math.max(start, x - 1) });
      inRun = false;
    }
  }
  return runs;
};

const mergeRuns = (
  runs: { start: number; end: number }[],
  maxGap: number,
): { start: number; end: number }[] => {
  const merged: { start: number; end: number }[] = [];
  for (const run of runs) {
    const prev = merged[merged.length - 1];
    if (prev && run.start - prev.end <= maxGap) {
      prev.end = run.end;
    } else {
      merged.push({ ...run });
    }
  }
  return merged;
};

const median = (values: number[]): number => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? 128;
};

const detectColumnWindows = (sheet: PngImage, config: GptSheetSpec): Window[] => {
  const cached = columnWindowCache.get(sheet);
  if (cached) return cached;

  let centers: number[] = [];
  for (let row = 0; row < config.grid.rows; row += 1) {
    const runs = mergeRuns(detectRunsInRow(sheet, config, row), 8);
    const usable = runs.filter((run) => run.end - run.start + 1 <= config.grid.cellWidth);
    if (usable.length >= 6 && usable.length <= config.grid.cols) {
      centers = usable.map((run) => (run.start + run.end + 1) / 2);
      break;
    }
  }

  if (centers.length === 0) {
    centers = Array.from(
      { length: config.grid.cols },
      (_, index) => config.grid.cellWidth / 2 + index * config.grid.cellWidth,
    );
  }

  const step = median(centers.slice(1).map((center, index) => center - centers[index]!));
  while (centers.length < config.grid.cols) {
    centers.push(centers[centers.length - 1]! + step);
  }
  centers = centers.slice(0, config.grid.cols);
  const windows = centers.map((center, index) => {
    const prevMid = index === 0 ? center - step / 2 : (centers[index - 1]! + center) / 2;
    const nextMid =
      index === centers.length - 1 ? center + step / 2 : (center + centers[index + 1]!) / 2;
    return {
      x0: Math.max(0, Math.floor(prevMid)),
      x1: Math.min(sheet.width - 1, Math.ceil(nextMid)),
    };
  });

  columnWindowCache.set(sheet, windows);
  return windows;
};

const detectObjectInWindow = (
  sheet: PngImage,
  config: GptSheetSpec,
  row: number,
  window: Window,
): Bounds | null => {
  const y0 = row * config.grid.cellHeight;
  const y1 = Math.min(sheet.height, y0 + config.grid.cellHeight);
  let minX = sheet.width;
  let minY = y1;
  let maxX = -1;
  let maxY = y0;

  for (let y = y0; y < y1; y += 1) {
    for (let x = window.x0; x <= window.x1; x += 1) {
      if (!isForegroundPixel(sheet.data, (y * sheet.width + x) * 4)) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }

  if (maxX < 0) return null;
  const padding = 4;
  return {
    minX: Math.max(window.x0, minX - padding),
    minY: Math.max(0, minY - padding),
    maxX: Math.min(window.x1, maxX + padding),
    maxY: Math.min(sheet.height - 1, maxY + padding),
  };
};

const boundsOf = (
  image: PngImage,
): { minX: number; minY: number; maxX: number; maxY: number } | null => {
  let minX = image.width;
  let minY = image.height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      const alpha = image.data[(y * image.width + x) * 4 + 3] ?? 0;
      if (alpha <= 8) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  return maxX >= 0 ? { minX, minY, maxX, maxY } : null;
};

const fitCellToFrame = (cell: PngImage): Uint8Array => {
  const out = new Uint8Array(FRAME * FRAME * 4);
  const bounds = boundsOf(cell);
  if (!bounds) return out;

  const margin = 1;
  const anchorX = 24;
  const anchorY = 43;
  const srcW = bounds.maxX - bounds.minX + 1;
  const srcH = bounds.maxY - bounds.minY + 1;
  const srcAnchorX = (bounds.minX + bounds.maxX + 1) / 2;
  const srcAnchorY = bounds.maxY + 1;
  const scale = Math.min(
    (FRAME - margin * 2) / srcW,
    (anchorY - margin) / Math.max(1, srcAnchorY - bounds.minY),
  );
  const safeScale = Number.isFinite(scale) && scale > 0 ? scale : 1;
  const dstW = Math.max(1, Math.round(srcW * safeScale));
  const dstH = Math.max(1, Math.round(srcH * safeScale));
  let dstX0 = Math.round(anchorX - (srcAnchorX - bounds.minX) * safeScale);
  let dstY0 = Math.round(anchorY - (srcAnchorY - bounds.minY) * safeScale);
  dstX0 = Math.max(margin, Math.min(FRAME - margin - dstW, dstX0));
  dstY0 = Math.max(margin, Math.min(FRAME - margin - dstH, dstY0));

  for (let dy = 0; dy < dstH; dy += 1) {
    const srcY = bounds.minY + Math.min(srcH - 1, Math.floor((dy * srcH) / dstH));
    const outY = dstY0 + dy;
    if (outY < 0 || outY >= FRAME) continue;
    for (let dx = 0; dx < dstW; dx += 1) {
      const srcX = bounds.minX + Math.min(srcW - 1, Math.floor((dx * srcW) / dstW));
      const outX = dstX0 + dx;
      if (outX < 0 || outX >= FRAME) continue;
      const srcOffset = (srcY * cell.width + srcX) * 4;
      const alpha = cell.data[srcOffset + 3] ?? 0;
      if (alpha <= 8) continue;
      const dstOffset = (outY * FRAME + outX) * 4;
      out[dstOffset] = cell.data[srcOffset] ?? 0;
      out[dstOffset + 1] = cell.data[srcOffset + 1] ?? 0;
      out[dstOffset + 2] = cell.data[srcOffset + 2] ?? 0;
      out[dstOffset + 3] = alpha;
    }
  }
  return out;
};

const flipFrameX = (frame: Uint8Array): Uint8Array => {
  const out = new Uint8Array(frame.byteLength);
  for (let y = 0; y < FRAME; y += 1) {
    for (let x = 0; x < FRAME; x += 1) {
      const src = (y * FRAME + x) * 4;
      const dst = (y * FRAME + (FRAME - 1 - x)) * 4;
      out.set(frame.subarray(src, src + 4), dst);
    }
  }
  return out;
};

const expandCells = (layout: GptSheetClipLayout['down']): Cell[] => {
  const cells: Cell[] = [];
  for (const range of layout) {
    const from = range.from ?? 0;
    const to = range.to ?? 7;
    for (let col = from; col <= to; col += 1) {
      cells.push({ col, row: range.row });
    }
  }
  return cells;
};

const sampleCells = (cells: Cell[], targetCount: number): Cell[] => {
  if (cells.length === 0) throw new Error('GPT sheet clip layout has no cells');
  if (cells.length === targetCount) return cells;
  return Array.from({ length: targetCount }, (_, index) => {
    const sourceIndex = Math.min(
      cells.length - 1,
      Math.floor((index * cells.length) / targetCount),
    );
    return cells[sourceIndex]!;
  });
};

const sampleIndexes = (indexes: number[], targetCount: number): number[] => {
  if (indexes.length === 0) throw new Error('GPT cutter clip layout has no frames');
  if (indexes.length === targetCount) return indexes;
  return Array.from({ length: targetCount }, (_, index) => {
    const sourceIndex = Math.min(
      indexes.length - 1,
      Math.floor((index * indexes.length) / targetCount),
    );
    return indexes[sourceIndex]!;
  });
};

const readFrames = (
  sheetImage: PngImage,
  sheet: GptSheetSpec,
  cells: Cell[],
  targetCount: number,
): Uint8Array[] =>
  sampleCells(cells, targetCount).map((cell) =>
    fitCellToFrame(extractCell(sheetImage, sheet, cell)),
  );

type SpriteSheetGenFrame = {
  frame: { x: number; y: number; w: number; h: number };
};

type VoxelynSpritesheetSpec = {
  imagePath: string;
  jsonPath: string;
  schema: 'voxelyn.spritesheet.v2';
};

type VoxelynSpritesheetFrame = SpriteSheetGenFrame & {
  meta?: {
    clip?: string;
    direction?: Direction;
    frameInClip?: number;
    anchor?: { x: number; y: number };
  };
};

type VoxelynSpritesheetJson = {
  frames: Record<string, VoxelynSpritesheetFrame>;
  animations?: Record<string, string[]>;
  expandedAnimations?: Record<string, string[]>;
  meta?: {
    schema?: string;
    defaultAnchor?: { x: number; y: number };
  };
};

const readCutterFrames = (
  sheetImage: PngImage,
  frames: SpriteSheetGenFrame[],
  indexes: number[],
  targetCount: number,
): Uint8Array[] =>
  sampleIndexes(indexes, targetCount).map((frameIndex) => {
    const frame = frames[frameIndex];
    if (!frame)
      throw new Error(`GPT cutter sheet missing frame_${String(frameIndex).padStart(3, '0')}`);
    return fitCellToFrame(extractRect(sheetImage, frame.frame));
  });

const copyRectRgba = (
  sheet: PngImage,
  rect: { x: number; y: number; w: number; h: number },
  target?: {
    width: number;
    height: number;
    sourceAnchor?: { x: number; y: number };
    targetAnchor?: { x: number; y: number };
  },
): Uint8Array => {
  const outWidth = target?.width ?? rect.w;
  const outHeight = target?.height ?? rect.h;
  const out = new Uint8Array(outWidth * outHeight * 4);
  const dstX0 =
    target?.sourceAnchor && target.targetAnchor
      ? Math.round(target.targetAnchor.x - target.sourceAnchor.x)
      : 0;
  const dstY0 =
    target?.sourceAnchor && target.targetAnchor
      ? Math.round(target.targetAnchor.y - target.sourceAnchor.y)
      : 0;

  if (rect.x < 0 || rect.y < 0 || rect.x + rect.w > sheet.width || rect.y + rect.h > sheet.height) {
    throw new Error(`spritesheet-v2 frame rect out of image bounds`);
  }

  for (let y = 0; y < rect.h; y += 1) {
    const outY = dstY0 + y;
    if (outY < 0 || outY >= outHeight) continue;
    for (let x = 0; x < rect.w; x += 1) {
      const outX = dstX0 + x;
      if (outX < 0 || outX >= outWidth) continue;
      const srcOffset = ((rect.y + y) * sheet.width + rect.x + x) * 4;
      const dstOffset = (outY * outWidth + outX) * 4;
      out.set(sheet.data.subarray(srcOffset, srcOffset + 4), dstOffset);
    }
  }
  return out;
};

const sampleItems = <T>(items: T[], targetCount: number, label: string): T[] => {
  if (items.length === 0) throw new Error(`${label} has no frames`);
  if (items.length === targetCount) return items;
  return Array.from({ length: targetCount }, (_, index) => {
    const sourceIndex = Math.min(
      items.length - 1,
      Math.floor((index * items.length) / targetCount),
    );
    return items[sourceIndex]!;
  });
};

const animationNamesFor = (
  parsed: VoxelynSpritesheetJson,
  clipId: ClipId,
  direction: Direction,
  targetCount: number,
): string[] => {
  const sourceClip = clipId === 'cast' ? 'attack' : clipId;
  const candidates = [
    `${sourceClip}_${direction}_${targetCount}f`,
    `${sourceClip}_${direction}_8f`,
    `${sourceClip}_${direction}_4f`,
  ];
  for (const key of candidates) {
    const names = parsed.expandedAnimations?.[key];
    if (names?.length) return sampleItems(names, targetCount, key);
  }

  const key = `${sourceClip}_${direction}`;
  const names = parsed.animations?.[key];
  if (names?.length) return sampleItems(names, targetCount, key);

  throw new Error(`spritesheet-v2 missing animation '${key}'`);
};

const readVoxelynSpritesheetFrames = async (
  cwd: string,
  spec: CharacterSpec,
): Promise<GptSheetFrames | null> => {
  const sheet: VoxelynSpritesheetSpec = {
    imagePath: `assets/sprites/characters/${spec.id}/${spec.id}.png`,
    jsonPath: `assets/sprites/characters/${spec.id}/${spec.id}.spritesheet.json`,
    schema: 'voxelyn.spritesheet.v2',
  };
  const sheetPath = path.join(cwd, sheet.imagePath);
  const jsonPath = path.join(cwd, sheet.jsonPath);
  const [bytes, rawJson] = await Promise.all([
    readFile(sheetPath).catch(() => null),
    readFile(jsonPath, 'utf8').catch(() => null),
  ]);
  if (!bytes || !rawJson) return null;

  const image = PNG.sync.read(Buffer.from(bytes));
  const parsed = JSON.parse(rawJson) as VoxelynSpritesheetJson;
  if (parsed.meta?.schema !== 'voxelyn.spritesheet.v2') {
    throw new Error(
      `${spec.id} spritesheet has unexpected schema '${parsed.meta?.schema ?? 'unknown'}'`,
    );
  }

  const firstFrame = Object.values(parsed.frames)[0];
  if (!firstFrame) throw new Error(`${spec.id} spritesheet-v2 has no frames`);
  const frameWidth = Math.max(...Object.values(parsed.frames).map((frame) => frame.frame.w));
  const frameHeight = Math.max(...Object.values(parsed.frames).map((frame) => frame.frame.h));
  const anchor = parsed.meta?.defaultAnchor ?? firstFrame.meta?.anchor ?? spec.anchor;
  const raw: RawFramesByClip = {};

  for (const [clipId, clipSpec] of Object.entries(spec.clips) as [
    ClipId,
    NonNullable<CharacterSpec['clips'][ClipId]>,
  ][]) {
    raw[clipId] = { DR: [], DL: [], UR: [], UL: [] };
    for (const direction of DIRECTIONS) {
      const names = animationNamesFor(parsed, clipId, direction, clipSpec.frames);
      raw[clipId]![direction] = names.map((name) => {
        const frame = parsed.frames[name];
        if (!frame) throw new Error(`${spec.id} spritesheet-v2 missing frame '${name}'`);
        return copyRectRgba(image, frame.frame, {
          width: frameWidth,
          height: frameHeight,
          sourceAnchor: frame.meta?.anchor ?? anchor,
          targetAnchor: anchor,
        });
      });
    }
  }

  return {
    raw,
    source: 'spritesheet-v2',
    sheet,
    sheetPath,
    frameWidth,
    frameHeight,
    anchor,
  };
};

const readCutterSheetFrames = async (
  cwd: string,
  spec: CharacterSpec,
  sheet: GptCutterSheetSpec,
  source: GptSheetFrames['source'],
): Promise<GptSheetFrames | null> => {
  const sheetPath = path.join(cwd, sheet.imagePath);
  const jsonPath = path.join(cwd, sheet.jsonPath);
  const [bytes, rawJson] = await Promise.all([
    readFile(sheetPath).catch(() => null),
    readFile(jsonPath, 'utf8').catch(() => null),
  ]);
  if (!bytes || !rawJson) return null;

  const image = PNG.sync.read(Buffer.from(bytes));
  const parsed = JSON.parse(rawJson) as { frames: Record<string, SpriteSheetGenFrame> };
  const cutterFrames = Object.entries(parsed.frames)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, frame]) => frame);
  const raw: RawFramesByClip = {};

  for (const [clipId, clipSpec] of Object.entries(spec.clips) as [
    ClipId,
    NonNullable<CharacterSpec['clips'][ClipId]>,
  ][]) {
    const layout = sheet.clips[clipId];
    if (!layout) throw new Error(`${spec.id} GPT cutter sheet missing layout for clip '${clipId}'`);
    const down = readCutterFrames(image, cutterFrames, layout.down, clipSpec.frames);
    const up = readCutterFrames(image, cutterFrames, layout.up ?? layout.down, clipSpec.frames);
    raw[clipId] = {
      DR: down,
      DL: down.map(flipFrameX),
      UR: up,
      UL: up.map(flipFrameX),
    };
  }

  return { raw, source, sheet, sheetPath };
};

const readGptCutterSheetFrames = async (
  cwd: string,
  spec: CharacterSpec,
): Promise<GptSheetFrames | null> => {
  const localSheet = LOCAL_SPRITESHEETGEN_SHEETS[spec.id];
  if (localSheet) {
    const local = await readCutterSheetFrames(cwd, spec, localSheet, 'spritesheetgen');
    if (local) return local;
  }

  const sheet = GPT_CUTTER_SHEETS[spec.id];
  if (!sheet) return null;
  return readCutterSheetFrames(cwd, spec, sheet, 'gpt-sheet');
};

export const readGptSheetFrames = async (
  cwd: string,
  spec: CharacterSpec,
): Promise<GptSheetFrames | null> => {
  const voxelynSheet = await readVoxelynSpritesheetFrames(cwd, spec);
  if (voxelynSheet) return voxelynSheet;

  const cutter = await readGptCutterSheetFrames(cwd, spec);
  if (cutter) return cutter;

  const sheet = GPT_SHEETS[spec.id];
  if (!sheet) return null;

  const sheetPath = path.join(cwd, sheet.path);
  const bytes = await readFile(sheetPath).catch(() => null);
  if (!bytes) return null;

  const image = PNG.sync.read(Buffer.from(bytes));
  const expectedWidth = sheet.grid.cols * sheet.grid.cellWidth;
  const expectedHeight = sheet.grid.rows * sheet.grid.cellHeight;
  if (image.width !== expectedWidth || image.height !== expectedHeight) {
    throw new Error(
      `${spec.id} GPT sheet is ${image.width}x${image.height}, expected ${expectedWidth}x${expectedHeight}`,
    );
  }

  const raw: RawFramesByClip = {};
  for (const [clipId, clipSpec] of Object.entries(spec.clips) as [
    ClipId,
    NonNullable<CharacterSpec['clips'][ClipId]>,
  ][]) {
    const layout = sheet.clips[clipId];
    if (!layout) throw new Error(`${spec.id} GPT sheet missing layout for clip '${clipId}'`);
    const down = readFrames(image, sheet, expandCells(layout.down), clipSpec.frames);
    const up = readFrames(image, sheet, expandCells(layout.up), clipSpec.frames);
    raw[clipId] = {
      DR: down,
      DL: down.map(flipFrameX),
      UR: up,
      UL: up.map(flipFrameX),
    };
  }

  for (const clip of Object.keys(raw) as ClipId[]) {
    const byDir = raw[clip]!;
    for (const direction of DIRECTIONS) {
      if (!byDir[direction]) throw new Error(`${spec.id} ${clip}.${direction} missing`);
    }
  }

  return { raw, source: 'gpt-sheet', sheet, sheetPath };
};
