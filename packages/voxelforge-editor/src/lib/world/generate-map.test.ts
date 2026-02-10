import { describe, expect, it } from 'vitest';
import { generateMapArtifact } from './generate-map';
import { createDefaultWorldFile } from './serialization';

describe('generateMapArtifact', () => {
  it('includes resolved items and no errors when refs exist', async () => {
    const world = createDefaultWorldFile('3d');
    world.items.push({
      id: 'item_1',
      type: 'asset',
      sourceRef: 'assets/tree.obj',
      transform: { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
      meta: { width: 2, height: 5, depth: 2 },
    });

    const artifact = await generateMapArtifact(world, async () => true);

    expect(artifact.mapVersion).toBe(1);
    expect(artifact.items).toHaveLength(1);
    expect(artifact.items[0]?.exists).toBe(true);
    expect(artifact.errors).toEqual([]);
  });

  it('reports missing source refs while still generating artifact', async () => {
    const world = createDefaultWorldFile('iso');
    world.items.push({
      id: 'item_missing',
      type: 'scene',
      sourceRef: 'scenes/missing.scene.json',
      transform: { position: [10, 0, 2], rotation: [0, 45, 0], scale: [1, 1, 1] },
      meta: {},
    });

    const artifact = await generateMapArtifact(world, async (sourceRef) => sourceRef !== 'scenes/missing.scene.json');

    expect(artifact.viewMode).toBe('iso');
    expect(artifact.items[0]?.exists).toBe(false);
    expect(artifact.errors.length).toBe(1);
    expect(artifact.errors[0]).toContain('scenes/missing.scene.json');
  });
});
