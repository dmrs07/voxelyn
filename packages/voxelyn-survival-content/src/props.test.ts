import { describe, expect, it } from 'vitest';
import {
  propFrameAt,
  propFrameCount,
  propKindIndex,
  propOffsets,
  resolveProp,
  type PropManifest,
} from './props';
import manifestJson from '../assets/atlases/world-props.json';

const manifest = manifestJson as unknown as PropManifest;
const offsets = propOffsets(manifest);

describe('atlas de objetos de mundo', () => {
  it('declara todos os objetivos e estados de salvamento pedidos pelo cliente', () => {
    for (const name of ['core', 'coreTaken', 'descent', 'extraction', 'salvageTerminalIdle', 'salvageTerminalScanning', 'salvageTerminalComplete', 'salvageCache', 'salvageCacheOpened']) {
      expect(propKindIndex(manifest, name), name).toBeGreaterThanOrEqual(0);
    }
    expect(propKindIndex(manifest, 'inexistente')).toBe(-1);
  });

  // Classes II/III do cofre: ANEXADAS ao fim da lista — os indices historicos
  // (salvageCache=7, salvageCacheOpened=8) nao podem se mover, ou um atlas
  // antigo em cache vestiria cada prop com a arte do vizinho.
  it('declara as classes de cofre sem mover os indices historicos', () => {
    expect(propKindIndex(manifest, 'salvageCache')).toBe(7);
    expect(propKindIndex(manifest, 'salvageCacheOpened')).toBe(8);
    for (const name of ['salvageCacheT2', 'salvageCacheT2Opened', 'salvageCacheT3', 'salvageCacheT3Opened']) {
      expect(propKindIndex(manifest, name), name).toBeGreaterThan(8);
    }
  });

  it('da um recorte distinto a cada tipo e quadro, todos dentro do atlas', () => {
    const width = manifest.columns * manifest.frameWidth;
    const seen = new Set<string>();
    manifest.kinds.forEach((kind, k) => {
      for (let f = 0; f < kind.frames; f++) {
        const rect = resolveProp(manifest, offsets, k, f);
        expect(rect.sx + rect.sw, `${kind.name}/${f}`).toBeLessThanOrEqual(width);
        seen.add(`${rect.sx},${rect.sy}`);
      }
    });
    expect(seen.size).toBe(propFrameCount(manifest));
  });

  // Um indice fora da faixa nao daria erro: daria um drawImage de uma regiao
  // vizinha, e o Nucleo apareceria com a cara de outra peca.
  it('prende tipo e quadro fora de faixa dentro do atlas', () => {
    const width = manifest.columns * manifest.frameWidth;
    for (const [k, f] of [[-3, -7], [99, 99]] as Array<[number, number]>) {
      const rect = resolveProp(manifest, offsets, k, f);
      expect(rect.sx).toBeGreaterThanOrEqual(0);
      expect(rect.sx + rect.sw).toBeLessThanOrEqual(width);
      expect(rect.sy).toBeGreaterThanOrEqual(0);
    }
  });

  it('percorre a animacao do nucleo e volta ao inicio', () => {
    const k = propKindIndex(manifest, 'core');
    const kind = manifest.kinds[k];
    expect(kind.frames).toBeGreaterThan(1);
    const seen = new Set<number>();
    for (let i = 0; i < kind.frames; i++) seen.add(propFrameAt(manifest, k, i * kind.frameMs));
    expect(seen.size).toBe(kind.frames);
    // Ciclo fechado: o quadro seguinte ao ultimo e o primeiro de novo.
    expect(propFrameAt(manifest, k, kind.frames * kind.frameMs)).toBe(propFrameAt(manifest, k, 0));
  });

  it('percorre todos os estagios da descida antes de reiniciar o elevador', () => {
    const k = propKindIndex(manifest, 'descent');
    const kind = manifest.kinds[k];
    expect(kind.frames).toBe(6);
    const seen = new Set<number>();
    for (let i = 0; i < kind.frames; i++) seen.add(propFrameAt(manifest, k, i * kind.frameMs));
    expect(seen.size).toBe(kind.frames);
    expect(propFrameAt(manifest, k, kind.frames * kind.frameMs)).toBe(0);
  });

  it('mantem o objeto estatico no quadro zero em qualquer instante', () => {
    const k = propKindIndex(manifest, 'coreTaken');
    for (const t of [0, 1234, 99999]) expect(propFrameAt(manifest, k, t)).toBe(0);
  });

  // O pulso do Nucleo vem do relogio, sem defasagem por posicao: ha uma peca so
  // e os dois jogadores de uma sala precisam ve-la pulsando junto.
  it('nao defasa o pulso entre clientes', () => {
    const k = propKindIndex(manifest, 'core');
    for (const t of [0, 500, 1900, 12345]) {
      expect(propFrameAt(manifest, k, t)).toBe(propFrameAt(manifest, k, t));
    }
    expect(propFrameAt(manifest, k, -100)).toBe(0);
  });

  it('anuncia frameMs para todo tipo que anima', () => {
    for (const kind of manifest.kinds) {
      if (kind.frames > 1) expect(kind.frameMs, kind.name).toBeGreaterThan(0);
    }
  });
});
