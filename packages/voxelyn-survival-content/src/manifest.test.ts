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
  it('inclui o telegraph especial do Bruiser com espaco vertical para a pedra', () => {
    const manifest = bruiser as unknown as SpriteManifestEntry;
    expect(manifest.animations.special).toMatchObject({ frames: 8, loop: false });
    expect(manifest.frameHeight).toBeGreaterThan(56);
  });

  it('maps cardinal vectors to four distinct isometric facings', () => {
    expect(new Set([[1, 0], [0, 1], [-1, 0], [0, -1]].map(([x, y]) => dirFromFacing(x, y))).size).toBe(4);
  });

  // O guardiao tem frames suficientes para estourar o teto de 4096px de largura
  // de textura, entao seu atlas tem DUAS linhas. Antes de `columns`, resolveFrame
  // devolvia sy=0 sempre e sx crescia para fora da imagem: os frames da segunda
  // linha eram recortados de area vazia e a entidade sumia em pleno ataque.
  it('resolves frames that live on the second atlas row', () => {
    const manifest = guardian as unknown as SpriteManifestEntry;
    const totalFrames =
      manifest.authoredDirs.length *
      Object.values(manifest.animations).reduce((sum, def) => sum + def.frames, 0);
    expect(manifest.columns).toBeLessThan(totalFrames); // ou seja: mais de uma linha
    // 'ul'/'attack' vive alem da primeira linha em qualquer canvas que o
    // guardiao ja teve. O bug historico devolvia sy=0 com sx alem da imagem;
    // o que o teste fixa e a PROPRIEDADE, nao a coordenada: o recorte desce de
    // linha e continua dentro da largura real do atlas.
    const columns = manifest.columns ?? totalFrames;
    const first = resolveFrame(manifest, 'attack', 'ul', 0);
    const second = resolveFrame(manifest, 'attack', 'ul', 1);
    for (const rect of [first, second]) {
      expect(rect.sy).toBeGreaterThanOrEqual(manifest.frameHeight);
      expect(rect.sy % manifest.frameHeight).toBe(0);
      expect(rect.sx + rect.sw).toBeLessThanOrEqual(columns * manifest.frameWidth);
    }
    // E continuam sendo quadros consecutivos, nao o mesmo recorte duas vezes.
    expect(second.sx !== first.sx || second.sy !== first.sy).toBe(true);
  });

  it('keeps every frame inside its atlas width', () => {
    for (const manifest of manifests) {
      const width = (manifest.columns ?? Number.MAX_SAFE_INTEGER) * manifest.frameWidth;
      for (const direction of manifest.authoredDirs) {
        for (const [animation, def] of Object.entries(manifest.animations)) {
          for (let frame = 0; frame < def.frames; frame++) {
            const rect = resolveFrame(manifest, animation, direction, frame);
            expect(rect.sx + rect.sw).toBeLessThanOrEqual(width);
          }
        }
      }
    }
  });
});
