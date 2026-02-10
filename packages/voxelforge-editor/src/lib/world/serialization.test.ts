import { describe, expect, it } from 'vitest';
import { createDefaultWorldFile, parseWorldFile, serializeWorldFile } from './serialization';

describe('world serialization', () => {
  it('creates defaults and keeps required fields', () => {
    const world = createDefaultWorldFile('iso');
    expect(world.worldVersion).toBe(1);
    expect(world.viewMode).toBe('iso');
    expect(world.items).toEqual([]);
    expect(world.hero.spawn).toEqual([0, 0, 0]);
    expect(world.composer.snapEnabled).toBe(true);
  });

  it('falls back to default on invalid worldVersion', () => {
    const parsed = parseWorldFile({
      worldVersion: 2,
      viewMode: '3d',
      items: [
        {
          id: 'bad',
          type: 'asset',
          sourceRef: 'assets/thing.json',
          transform: { position: [1, 2, 3], rotation: [0, 0, 0], scale: [1, 1, 1] },
          meta: {},
        },
      ],
    });

    expect(parsed.worldVersion).toBe(1);
    expect(parsed.items.length).toBe(0);
    expect(parsed.viewMode).toBe('3d');
  });

  it('round-trips parse/serialize with valid payload', () => {
    const source = {
      worldVersion: 1,
      viewMode: '2d',
      items: [
        {
          id: 'item_1',
          type: 'scene',
          sourceRef: 'scenes/a.scene.json',
          transform: { position: [2, 3, 4], rotation: [0, 15, 30], scale: [1, 1, 1] },
          meta: { width: 8, height: 3, depth: 2 },
        },
      ],
      hero: {
        itemId: 'item_1',
        spawn: [2, 3, 4],
        collision: 'off',
      },
      composer: {
        snapEnabled: false,
        snapSize: 2,
        snapFromMeta: false,
        rotationStepDeg: 30,
        space: 'local',
      },
    };

    const parsed = parseWorldFile(source);
    const roundTrip = parseWorldFile(JSON.parse(serializeWorldFile(parsed)));

    expect(roundTrip).toEqual(parsed);
    expect(roundTrip.items[0]?.sourceRef).toBe('scenes/a.scene.json');
    expect(roundTrip.composer.space).toBe('local');
  });
});
