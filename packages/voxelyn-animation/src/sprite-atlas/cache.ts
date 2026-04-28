import type { LoadedAtlas } from './types.js';

const loadedAtlases = new Map<string, LoadedAtlas>();
const inFlightLoads = new Map<string, Promise<LoadedAtlas>>();

export const getLoadedAtlas = (spriteId: string): LoadedAtlas | undefined =>
  loadedAtlases.get(spriteId);

export const setLoadedAtlas = (spriteId: string, atlas: LoadedAtlas): void => {
  loadedAtlases.set(spriteId, atlas);
};

export const getInFlightLoad = (spriteId: string): Promise<LoadedAtlas> | undefined =>
  inFlightLoads.get(spriteId);

export const setInFlightLoad = (spriteId: string, promise: Promise<LoadedAtlas>): void => {
  inFlightLoads.set(spriteId, promise);
};

export const clearInFlightLoad = (spriteId: string): void => {
  inFlightLoads.delete(spriteId);
};

export const clearAllLoadedAtlasesForTest = (): void => {
  loadedAtlases.clear();
  inFlightLoads.clear();
};
