// Parser e voxelizador de STL, contra malhas sinteticas construidas no teste.
import { describe, expect, it } from 'vitest';
import { parseStl, voxelizeStl } from '../stl';
import { parseVoxelKey } from '../voxel';

/** Monta um STL BINARIO a partir de triangulos [ax,ay,az,bx,...,cz]. */
const binaryStl = (tris: number[][]): ArrayBuffer => {
  const buf = new ArrayBuffer(84 + tris.length * 50);
  const dv = new DataView(buf);
  dv.setUint32(80, tris.length, true);
  tris.forEach((tri, i) => {
    const base = 84 + i * 50 + 12;
    tri.forEach((v, j) => dv.setFloat32(base + j * 4, v, true));
  });
  return buf;
};

/** 12 triangulos de um cubo fechado [0..s]^3. */
const cubeTris = (s: number): number[][] => {
  const q = (a: number[], b: number[], c: number[], d: number[]): number[][] => [
    [...a, ...b, ...c],
    [...a, ...c, ...d],
  ];
  return [
    ...q([0, 0, 0], [s, 0, 0], [s, s, 0], [0, s, 0]), // baixo
    ...q([0, 0, s], [0, s, s], [s, s, s], [s, 0, s]), // topo
    ...q([0, 0, 0], [0, 0, s], [s, 0, s], [s, 0, 0]), // frente
    ...q([0, s, 0], [s, s, 0], [s, s, s], [0, s, s]), // tras
    ...q([0, 0, 0], [0, s, 0], [0, s, s], [0, 0, s]), // esquerda
    ...q([s, 0, 0], [s, 0, s], [s, s, s], [s, s, 0]), // direita
  ];
};

describe('parseStl', () => {
  it('parseia STL binario', () => {
    const tris = parseStl(binaryStl(cubeTris(2)));
    expect(tris.length).toBe(12 * 9);
    expect(Math.max(...tris)).toBe(2);
  });

  it('parseia STL ASCII', () => {
    const ascii = `solid cubo
facet normal 0 0 -1
  outer loop
    vertex 0 0 0
    vertex 1 0 0
    vertex 1 1 0
  endloop
endfacet
facet normal 0 0 -1
  outer loop
    vertex 0 0 0
    vertex 1 1 0
    vertex 0 1 0
  endloop
endfacet
endsolid cubo`;
    const tris = parseStl(new TextEncoder().encode(ascii).buffer as ArrayBuffer);
    expect(tris.length).toBe(2 * 9);
    expect(tris[3]).toBe(1); // bx do primeiro triangulo
  });

  it('rejeita arquivo que nao e STL', () => {
    expect(() => parseStl(new TextEncoder().encode('PNG lixo').buffer as ArrayBuffer)).toThrow();
  });
});

describe('voxelizeStl', () => {
  it('cubo fechado vira bloco solido na altura pedida', () => {
    const tris = parseStl(binaryStl(cubeTris(2)));
    const model = voxelizeStl(tris, { height: 8, material: 'rock' });
    // cubo de proporcao 1:1:1 escalado para 8 de altura → 8x8x8 solidos
    expect(Object.keys(model).length).toBe(8 * 8 * 8);
    expect(new Set(Object.values(model))).toEqual(new Set(['rock']));
    // chao em z=0, centrado em x/y
    let minZ = Infinity,
      minX = Infinity,
      maxX = -Infinity;
    for (const key of Object.keys(model)) {
      const [x, , z] = parseVoxelKey(key);
      minZ = Math.min(minZ, z);
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
    }
    expect(minZ).toBe(0);
    expect(maxX - minX + 1).toBe(8);
    expect(minX).toBeLessThan(0);
  });

  it('escala respeita proporcao (paralelepipedo 1x1x2)', () => {
    const tall = cubeTris(1).map((tri) => tri.map((v, i) => (i % 3 === 2 ? v * 2 : v)));
    const model = voxelizeStl(parseStl(binaryStl(tall)), { height: 8, material: 'loot' });
    // altura 8, base 4x4
    expect(Object.keys(model).length).toBe(4 * 4 * 8);
  });

  it('rejeita malha sem altura', () => {
    const flat = [[0, 0, 0, 1, 0, 0, 1, 1, 0]];
    expect(() => voxelizeStl(parseStl(binaryStl(flat)), { height: 8, material: 'rock' })).toThrow(
      /altura/,
    );
  });
});
