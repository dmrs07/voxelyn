import { describe, expect, it } from 'vitest';
import { lightLevelFor, resolveBlock, variantAt, type TerrainManifest } from './terrain';
import manifestJson from '../assets/atlases/terrain-blocks.json';

const manifest = manifestJson as unknown as TerrainManifest;

describe('atlas de terreno', () => {
  it('mantem todo frame dentro do atlas', () => {
    const width = manifest.columns * manifest.frameWidth;
    for (let kind = 0; kind < manifest.kinds.length; kind++) {
      for (let variant = 0; variant < manifest.variants; variant++) {
        for (let light = 0; light < manifest.lightLevels; light++) {
          const rect = resolveBlock(manifest, kind, variant, light);
          expect(rect.sx + rect.sw).toBeLessThanOrEqual(width);
        }
      }
    }
  });

  it('da um frame distinto a cada tipo, variante e nivel', () => {
    const seen = new Set<string>();
    for (let kind = 0; kind < manifest.kinds.length; kind++) {
      for (let variant = 0; variant < manifest.variants; variant++) {
        for (let light = 0; light < manifest.lightLevels; light++) {
          const r = resolveBlock(manifest, kind, variant, light);
          seen.add(`${r.sx},${r.sy}`);
        }
      }
    }
    expect(seen.size).toBe(manifest.kinds.length * manifest.variants * manifest.lightLevels);
  });

  it('prende tipo e nivel fora de faixa em vez de recortar fora da imagem', () => {
    const width = manifest.columns * manifest.frameWidth;
    for (const [kind, light] of [[-1, -5], [99, 99]] as Array<[number, number]>) {
      const rect = resolveBlock(manifest, kind, 0, light);
      expect(rect.sx).toBeGreaterThanOrEqual(0);
      expect(rect.sx + rect.sw).toBeLessThanOrEqual(width);
    }
  });

  // Sortear por frame faria a pedra cintilar; sortear por seed da run faria o
  // mesmo bloco mudar de cara ao sair e voltar da tela.
  it('escolhe a variante de forma estavel por posicao', () => {
    for (const [x, y] of [[0, 0], [3, -7], [128, 91], [-40, 12]]) {
      expect(variantAt(x, y, manifest.variants)).toBe(variantAt(x, y, manifest.variants));
    }
    const spread = new Set<number>();
    for (let x = 0; x < 40; x++) for (let y = 0; y < 40; y++) spread.add(variantAt(x, y, manifest.variants));
    expect(spread.size).toBe(manifest.variants);
  });

  it('mapeia brilho continuo para os niveis assados sem estourar', () => {
    for (const b of [-1, 0, 0.5, 1, 2]) {
      const level = lightLevelFor(manifest, b);
      expect(level).toBeGreaterThanOrEqual(0);
      expect(level).toBeLessThan(manifest.lightLevels);
    }
    expect(lightLevelFor(manifest, 0)).toBe(0);
    expect(lightLevelFor(manifest, 1)).toBe(manifest.lightLevels - 1);
  });
});
