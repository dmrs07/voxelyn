import { loadCharacterAtlas, type LoadOptions } from './load.js';

export const preloadCharacterAtlases = async (
  ids: readonly string[],
  baseUrl: string,
  opts: LoadOptions = {}
): Promise<void> => {
  if (opts.strict) {
    await Promise.all(ids.map((id) => loadCharacterAtlas(id, baseUrl, opts)));
    return;
  }

  const results = await Promise.allSettled(ids.map((id) => loadCharacterAtlas(id, baseUrl, opts)));
  const warnedIds = new Set<string>();
  for (let i = 0; i < results.length; i += 1) {
    const result = results[i]!;
    if (result.status === 'rejected') {
      const id = ids[i]!;
      if (!warnedIds.has(id)) {
        warnedIds.add(id);
        console.warn(`[voxelyn-animation] atlas '${id}' preload failed:`, result.reason);
      }
    }
  }
};
