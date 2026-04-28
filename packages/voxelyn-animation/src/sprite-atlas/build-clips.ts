import { DIRECTIONS } from './direction.js';
import type { AtlasManifest, ClipId, LoadedAtlas, LoadedClip, LoadedFrame } from './types.js';

type DecodedImage = {
  width: number;
  height: number;
  pixels: Uint32Array;
};

const copyFrame = (
  decoded: DecodedImage,
  x: number,
  y: number,
  width: number,
  height: number
): LoadedFrame => {
  const pixels = new Uint32Array(width * height);
  for (let row = 0; row < height; row += 1) {
    const srcStart = (y + row) * decoded.width + x;
    const dstStart = row * width;
    pixels.set(decoded.pixels.subarray(srcStart, srcStart + width), dstStart);
  }
  return { width, height, pixels };
};

export const buildClipsFromAtlas = (
  manifest: AtlasManifest,
  decoded: DecodedImage
): LoadedAtlas['clips'] => {
  const clips: LoadedAtlas['clips'] = {};

  for (const clipId of Object.keys(manifest.clips) as ClipId[]) {
    const clip = manifest.clips[clipId]!;
    const framesByDir: LoadedClip['framesByDir'] = {
      DR: [],
      DL: [],
      UR: [],
      UL: [],
    };

    for (const direction of DIRECTIONS) {
      framesByDir[direction] = clip.dirs[direction].map((rect) =>
        copyFrame(decoded, rect.x, rect.y, rect.w, rect.h)
      );
    }

    clips[clipId] = {
      loop: clip.loop,
      durationMs: clip.durationMs,
      framesPerDirection: clip.framesPerDirection,
      framesByDir,
    };
  }

  return clips;
};
