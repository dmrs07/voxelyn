import { describe, expect, it } from 'vitest';
import {
  resolveSurface,
  surfaceFrameAt,
  surfaceFrameCount,
  surfaceOffsets,
  type SurfaceManifest,
} from './surfaces';
import { variantAt } from './terrain';
import manifestJson from '../assets/atlases/surface-tiles.json';

const manifest = manifestJson as unknown as SurfaceManifest;
const offsets = surfaceOffsets(manifest);
const width = manifest.columns * manifest.frameWidth;

const everyFrame = (fn: (kind: number, variant: number, frame: number, light: number) => void): void => {
  for (let kind = 0; kind < manifest.kinds.length; kind++) {
    for (let variant = 0; variant < manifest.variants; variant++) {
      for (let frame = 0; frame < manifest.kinds[kind].frames; frame++) {
        for (let light = 0; light < manifest.lightLevels; light++) fn(kind, variant, frame, light);
      }
    }
  }
};

describe('atlas de crostas de chao', () => {
  it('mantem todo frame dentro do atlas', () => {
    const height = Math.ceil(surfaceFrameCount(manifest) / manifest.columns) * manifest.frameHeight;
    everyFrame((kind, variant, frame, light) => {
      const rect = resolveSurface(manifest, offsets, kind, variant, frame, light);
      expect(rect.sx + rect.sw).toBeLessThanOrEqual(width);
      expect(rect.sy + rect.sh).toBeLessThanOrEqual(height);
    });
  });

  // Os tipos tem contagens de quadro DIFERENTES, entao o indice nao sai de uma
  // multiplicacao: se os deslocamentos errarem, um tipo cai em cima do vizinho e
  // o chao aparece com a cara de outro material — silenciosamente.
  it('da um recorte distinto a cada tipo, variante, quadro e nivel', () => {
    const seen = new Set<string>();
    everyFrame((kind, variant, frame, light) => {
      const r = resolveSurface(manifest, offsets, kind, variant, frame, light);
      seen.add(`${r.sx},${r.sy}`);
    });
    expect(seen.size).toBe(surfaceFrameCount(manifest));
  });

  it('conta os quadros de cada tipo a partir do fim do tipo anterior', () => {
    let expected = 0;
    manifest.kinds.forEach((kind, i) => {
      expect(offsets[i]).toBe(expected);
      expected += kind.frames * manifest.variants * manifest.lightLevels;
    });
    expect(expected).toBe(surfaceFrameCount(manifest));
  });

  it('prende argumento fora de faixa em vez de recortar fora da imagem', () => {
    for (const [kind, frame, light] of [[-3, -9, -5], [99, 99, 99]] as Array<[number, number, number]>) {
      const rect = resolveSurface(manifest, offsets, kind, 0, frame, light);
      expect(rect.sx).toBeGreaterThanOrEqual(0);
      expect(rect.sx + rect.sw).toBeLessThanOrEqual(width);
    }
  });

  it('cicla quadro e variante negativos em vez de sair do tipo', () => {
    const kind = manifest.kinds.findIndex((k) => k.frames > 1);
    expect(kind).toBeGreaterThanOrEqual(0);
    const frames = manifest.kinds[kind].frames;
    expect(resolveSurface(manifest, offsets, kind, -1, -1, 0)).toEqual(
      resolveSurface(manifest, offsets, kind, manifest.variants - 1, frames - 1, 0)
    );
  });

  describe('quadro de animacao', () => {
    const animated = manifest.kinds.findIndex((k) => k.frames > 1);
    const staticKind = manifest.kinds.findIndex((k) => k.frames === 1);

    it('mantem o tipo estatico sempre no quadro zero', () => {
      expect(staticKind).toBeGreaterThanOrEqual(0);
      for (const t of [0, 500, 12345, 999999]) {
        expect(surfaceFrameAt(manifest, staticKind, 4, 9, t)).toBe(0);
      }
    });

    it('avanca com o tempo e volta ao inicio', () => {
      const kind = manifest.kinds[animated];
      const seen = new Set<number>();
      for (let i = 0; i < kind.frames * 3; i++) {
        seen.add(surfaceFrameAt(manifest, animated, 0, 0, i * kind.frameMs));
      }
      expect(seen.size).toBe(kind.frames);
    });

    // Sem defasagem por posicao, um lago inteiro ondula em unissono e le como
    // uma textura piscando; e a fase tem de vir da POSICAO, senao a mesma celula
    // troca de fase ao sair e voltar da tela.
    it('defasa celulas vizinhas sem depender de sorteio', () => {
      const at = (x: number, y: number) => surfaceFrameAt(manifest, animated, x, y, 0);
      expect(at(7, 3)).toBe(at(7, 3));
      const spread = new Set<number>();
      for (let x = 0; x < 24; x++) for (let y = 0; y < 24; y++) spread.add(at(x, y));
      expect(spread.size).toBe(manifest.kinds[animated].frames);
    });
  });

  // Chao e parede escurecem na mesma escala e sorteiam a variante do mesmo jeito:
  // divergir em qualquer um dos dois deixa uma costura visivel na juncao.
  it('compartilha niveis de luz e variantes com o atlas de blocos', () => {
    expect(manifest.lightLevels).toBe(8);
    expect(manifest.variants).toBeGreaterThan(1);
    expect(variantAt(12, 5, manifest.variants)).toBe(variantAt(12, 5, manifest.variants));
  });
});
