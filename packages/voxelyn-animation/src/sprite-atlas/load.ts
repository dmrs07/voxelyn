import { buildClipsFromAtlas } from './build-clips.js';
import {
  clearInFlightLoad,
  getInFlightLoad,
  getLoadedAtlas,
  setInFlightLoad,
  setLoadedAtlas,
} from './cache.js';
import { AtlasLoadError } from './errors.js';
import { resolveFetcher } from './fetcher.js';
import type { LoadedAtlas } from './types.js';
import { validateManifest } from './validate.js';

export type LoadOptions = {
  strict?: boolean;
};

const loadAtlasUncached = async (
  spriteId: string,
  baseUrl: string,
  _opts: LoadOptions
): Promise<LoadedAtlas> => {
  const fetcher = resolveFetcher();
  let manifest;
  try {
    manifest = await fetcher.fetchManifest(spriteId, baseUrl);
  } catch (error) {
    throw new AtlasLoadError(spriteId, (error as Error).message);
  }

  let decoded;
  try {
    decoded = await fetcher.fetchAndDecodePng(spriteId, baseUrl);
  } catch (error) {
    throw new AtlasLoadError(spriteId, (error as Error).message);
  }

  validateManifest(spriteId, manifest, decoded.width, decoded.height);
  const atlas: LoadedAtlas = {
    manifest,
    clips: buildClipsFromAtlas(manifest, decoded),
  };
  setLoadedAtlas(spriteId, atlas);
  return atlas;
};

export const loadCharacterAtlas = async (
  spriteId: string,
  baseUrl: string,
  opts: LoadOptions = {}
): Promise<LoadedAtlas> => {
  const cached = getLoadedAtlas(spriteId);
  if (cached) return cached;

  const inFlight = getInFlightLoad(spriteId);
  if (inFlight) return inFlight;

  const promise = loadAtlasUncached(spriteId, baseUrl, opts).finally(() => {
    clearInFlightLoad(spriteId);
  });
  setInFlightLoad(spriteId, promise);
  return promise;
};
