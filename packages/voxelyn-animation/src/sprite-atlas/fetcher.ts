import type { AtlasSource } from '../types.js';
import type { AtlasManifest } from './types.js';
import { rgbaBytesToPackedPixels } from './decode.js';

export type DecodedImage = {
  width: number;
  height: number;
  pixels: Uint32Array;
};

export type AtlasFetcher = {
  fetchManifest(spriteId: string, baseUrl: string): Promise<AtlasManifest>;
  fetchAndDecodePng(spriteId: string, baseUrl: string): Promise<DecodedImage>;
};

let currentFetcher: AtlasFetcher | undefined;

const normalizeBaseUrl = (baseUrl: string): string => baseUrl.replace(/\/$/, '');

const sourceToDecoded = (source: AtlasSource): DecodedImage => {
  if ('pixels' in source) {
    return {
      width: source.width,
      height: source.height,
      pixels: source.pixels,
    };
  }
  return {
    width: source.width,
    height: source.height,
    pixels: rgbaBytesToPackedPixels(source.data),
  };
};

const browserFetcher: AtlasFetcher = {
  async fetchManifest(spriteId, baseUrl) {
    const root = normalizeBaseUrl(baseUrl);
    const response = await fetch(`${root}/${spriteId}/${spriteId}.atlas.json`);
    if (!response.ok) {
      throw new Error(`manifest fetch failed: ${response.status}`);
    }
    return (await response.json()) as AtlasManifest;
  },
  async fetchAndDecodePng(spriteId, baseUrl) {
    const { loadAtlasFromUrl } = await import('../adapters/browser-atlas.js');
    const root = normalizeBaseUrl(baseUrl);
    return sourceToDecoded(await loadAtlasFromUrl(`${root}/${spriteId}/${spriteId}.atlas.png`));
  },
};

export const setBrowserFetcher = (): void => {
  currentFetcher = browserFetcher;
};

export const setFetcherForTest = (fetcher: AtlasFetcher | undefined): void => {
  currentFetcher = fetcher;
};

export const resolveFetcher = (): AtlasFetcher => {
  if (!currentFetcher) {
    throw new Error(
      'No AtlasFetcher installed. Call setBrowserFetcher() at boot or setFetcherForTest() in tests.'
    );
  }
  return currentFetcher;
};
