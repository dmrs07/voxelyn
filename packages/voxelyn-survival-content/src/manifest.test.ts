import { describe, expect, it } from 'vitest';
import { CHARACTER_SPRITE_IDS, dirFromFacing, resolveFrame, type SpriteManifestEntry } from './manifest';
import index from '../assets/atlases/index.json';
import player from '../assets/atlases/player-prospector.json';
import stalker from '../assets/atlases/enemy-stalker.json';
import spitter from '../assets/atlases/enemy-spitter.json';
import bomber from '../assets/atlases/enemy-spore-bomber.json';
import bruiser from '../assets/atlases/enemy-bruiser.json';
import guardian from '../assets/atlases/enemy-guardian.json';

const manifests = [player, stalker, spitter, bomber, bruiser, guardian] as unknown as SpriteManifestEntry[];
describe('voxel character manifests', () => {
  it('indexes all six characters', () => {
    for (const id of CHARACTER_SPRITE_IDS) expect(index.ids).toContain(id);
  });
  it('resolves every animation in all four directions', () => {
    for (const manifest of manifests) {
      expect(manifest.authoredDirs).toEqual(['dr', 'dl', 'ur', 'ul']);
      for (const direction of manifest.authoredDirs) {
        for (const animation of Object.keys(manifest.animations)) {
          expect(resolveFrame(manifest, animation, direction, 0).sw).toBe(manifest.frameWidth);
        }
      }
    }
  });
  it('maps cardinal vectors to four distinct isometric facings', () => {
    expect(new Set([[1, 0], [0, 1], [-1, 0], [0, -1]].map(([x, y]) => dirFromFacing(x, y))).size).toBe(4);
  });
});
