import type { GeneratedMapArtifact, WorldFile } from './types';

export type SourceExistsFn = (sourceRef: string) => Promise<boolean>;

export const generateMapArtifact = async (
  world: WorldFile,
  sourceExists: SourceExistsFn,
): Promise<GeneratedMapArtifact> => {
  const errors: string[] = [];
  const items: GeneratedMapArtifact['items'] = [];

  for (const item of world.items) {
    const exists = await sourceExists(item.sourceRef);
    if (!exists) {
      errors.push(`Missing source reference: ${item.sourceRef} (item: ${item.id})`);
    }
    items.push({
      id: item.id,
      type: item.type,
      sourceRef: item.sourceRef,
      transform: item.transform,
      meta: item.meta,
      exists,
    });
  }

  return {
    mapVersion: 1,
    generatedAt: new Date().toISOString(),
    sourceWorld: 'worlds/default.world.json',
    viewMode: world.viewMode,
    hero: world.hero,
    items,
    errors,
  };
};
