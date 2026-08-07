// Import de GLB. Os fixtures sao montados aqui, byte a byte, em vez de virem de
// um arquivo binario no repo: assim da para ver no proprio teste exatamente qual
// construcao do spec esta sendo cobrada, e um GLB gravado nao vira caixa-preta.
import { describe, expect, it } from 'vitest';
import { DEFAULT_ORIENTATION, orientTriangles, parseGlb } from '../glb';
import { fitFrames, fitTriangles, voxelizeTriangles } from '../stl';
import { voxelModelBounds } from '../voxel';

const pad4 = (n: number): number => (4 - (n % 4)) % 4;

/** Empacota um glTF JSON + binario no container GLB. */
const buildGlb = (gltf: object, bin: ArrayBuffer): ArrayBuffer => {
  const jsonBytes = new TextEncoder().encode(JSON.stringify(gltf));
  const jsonLen = jsonBytes.length + pad4(jsonBytes.length);
  const binLen = bin.byteLength + pad4(bin.byteLength);
  const total = 12 + 8 + jsonLen + 8 + binLen;
  const out = new ArrayBuffer(total);
  const dv = new DataView(out);
  const u8 = new Uint8Array(out);
  dv.setUint32(0, 0x46546c67, true); // 'glTF'
  dv.setUint32(4, 2, true);
  dv.setUint32(8, total, true);
  dv.setUint32(12, jsonLen, true);
  dv.setUint32(16, 0x4e4f534a, true); // JSON
  u8.set(jsonBytes, 20);
  u8.fill(0x20, 20 + jsonBytes.length, 20 + jsonLen); // JSON completa com espaco
  const binChunk = 20 + jsonLen;
  dv.setUint32(binChunk, binLen, true);
  dv.setUint32(binChunk + 4, 0x004e4942, true); // BIN
  u8.set(new Uint8Array(bin), binChunk + 8);
  return out;
};

const f32 = (values: number[]): ArrayBuffer => Float32Array.from(values).buffer;

const concat = (...parts: ArrayBuffer[]): ArrayBuffer => {
  const total = parts.reduce((n, p) => n + p.byteLength, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const p of parts) {
    out.set(new Uint8Array(p), o);
    o += p.byteLength;
  }
  return out.buffer;
};

/** Um triangulo solto, sem skin e sem animacao. */
const simpleGlb = (): ArrayBuffer => {
  const bin = f32([0, 0, 0, 1, 0, 0, 0, 2, 0]);
  return buildGlb(
    {
      asset: { version: '2.0' },
      scenes: [{ nodes: [0] }],
      nodes: [{ mesh: 0 }],
      meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }],
      accessors: [{ bufferView: 0, componentType: 5126, count: 3, type: 'VEC3' }],
      bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: bin.byteLength }],
      buffers: [{ byteLength: bin.byteLength }],
    },
    bin,
  );
};

/**
 * Um "braco": um quad preso a duas juntas, com uma animacao que gira a junta da
 * ponta 90 graus em torno de Z. E o minimo que exercita o caminho inteiro —
 * skin, bind inversa, hierarquia de nos e amostragem no tempo.
 */
const skinnedGlb = (): ArrayBuffer => {
  // 4 vertices ao longo de +X; os dois da ponta pertencem a junta 1
  const positions = f32([0, -0.5, 0, 0, 0.5, 0, 2, -0.5, 0, 2, 0.5, 0]);
  const joints = new Uint16Array([0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0]).buffer;
  const weights = f32([1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0]);
  const indices = new Uint16Array([0, 1, 2, 1, 3, 2]).buffer;
  // bind inversa: junta 0 na origem, junta 1 em x=2
  const ibm = f32([
    ...[1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
    ...[1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, -2, 0, 0, 1],
  ]);
  const times = f32([0, 1]);
  // quaternion: identidade -> 90 graus em Z
  const rots = f32([0, 0, 0, 1, 0, 0, Math.SQRT1_2, Math.SQRT1_2]);
  const bin = concat(positions, joints, weights, indices, ibm, times, rots);

  let off = 0;
  const view = (bytes: number): number => {
    const at = off;
    off += bytes;
    return at;
  };
  const vPos = view(positions.byteLength);
  const vJoints = view(joints.byteLength);
  const vWeights = view(weights.byteLength);
  const vIdx = view(indices.byteLength);
  const vIbm = view(ibm.byteLength);
  const vTimes = view(times.byteLength);
  const vRots = view(rots.byteLength);

  return buildGlb(
    {
      asset: { version: '2.0' },
      scenes: [{ nodes: [0, 1] }],
      nodes: [
        { mesh: 0, skin: 0 }, // 0: a malha
        { children: [2], name: 'juntaRaiz' }, // 1: junta 0 na origem
        { translation: [2, 0, 0], name: 'juntaPonta' }, // 2: junta 1
      ],
      meshes: [
        {
          primitives: [{ attributes: { POSITION: 0, JOINTS_0: 1, WEIGHTS_0: 2 }, indices: 3 }],
        },
      ],
      skins: [{ joints: [1, 2], inverseBindMatrices: 4 }],
      animations: [
        {
          name: 'dobra',
          channels: [{ sampler: 0, target: { node: 2, path: 'rotation' } }],
          samplers: [{ input: 5, output: 6, interpolation: 'LINEAR' }],
        },
      ],
      accessors: [
        { bufferView: 0, componentType: 5126, count: 4, type: 'VEC3' },
        { bufferView: 1, componentType: 5123, count: 4, type: 'VEC4' },
        { bufferView: 2, componentType: 5126, count: 4, type: 'VEC4' },
        { bufferView: 3, componentType: 5123, count: 6, type: 'SCALAR' },
        { bufferView: 4, componentType: 5126, count: 2, type: 'MAT4' },
        { bufferView: 5, componentType: 5126, count: 2, type: 'SCALAR' },
        { bufferView: 6, componentType: 5126, count: 2, type: 'VEC4' },
      ],
      bufferViews: [
        { buffer: 0, byteOffset: vPos, byteLength: positions.byteLength },
        { buffer: 0, byteOffset: vJoints, byteLength: joints.byteLength },
        { buffer: 0, byteOffset: vWeights, byteLength: weights.byteLength },
        { buffer: 0, byteOffset: vIdx, byteLength: indices.byteLength },
        { buffer: 0, byteOffset: vIbm, byteLength: ibm.byteLength },
        { buffer: 0, byteOffset: vTimes, byteLength: times.byteLength },
        { buffer: 0, byteOffset: vRots, byteLength: rots.byteLength },
      ],
      buffers: [{ byteLength: bin.byteLength }],
    },
    bin,
  );
};

describe('parseGlb — container', () => {
  it('le uma malha simples e conta os triangulos', () => {
    const scene = parseGlb(simpleGlb());
    expect(scene.triangleCount).toBe(1);
    expect(scene.vertexCount).toBe(3);
    expect(scene.animations).toEqual([]);
    expect(Array.from(scene.sample(null, 0))).toEqual([0, 0, 0, 1, 0, 0, 0, 2, 0]);
  });

  it('recusa arquivo que nao e GLB, com mensagem legivel', () => {
    expect(() => parseGlb(new ArrayBuffer(4))).toThrow(/nao e um GLB/);
    const notGlb = new ArrayBuffer(16);
    new DataView(notGlb).setUint32(0, 0x12345678, true);
    expect(() => parseGlb(notGlb)).toThrow(/nao e um GLB/);
  });

  it('recusa GLB que depende de arquivo externo', () => {
    const gltf = {
      asset: { version: '2.0' },
      nodes: [],
      buffers: [{ uri: 'cenario.bin', byteLength: 4 }],
    };
    expect(() => parseGlb(buildGlb(gltf, new ArrayBuffer(4)))).toThrow(/externo/);
  });

  it('recusa GLB sem triangulo nenhum', () => {
    const gltf = { asset: { version: '2.0' }, nodes: [], buffers: [{ byteLength: 4 }] };
    expect(() => parseGlb(buildGlb(gltf, new ArrayBuffer(4)))).toThrow(/sem malha/);
  });
});

describe('parseGlb — skin e animacao', () => {
  it('acha o clipe com nome e duracao', () => {
    const scene = parseGlb(skinnedGlb());
    expect(scene.animations).toEqual([{ name: 'dobra', duration: 1 }]);
    expect(scene.triangleCount).toBe(2);
  });

  it('na pose de repouso a malha fica onde foi modelada', () => {
    const tris = parseGlb(skinnedGlb()).sample(null, 0);
    const xs = [];
    for (let i = 0; i < tris.length; i += 3) xs.push(tris[i]);
    expect(Math.min(...xs)).toBeCloseTo(0, 5);
    expect(Math.max(...xs)).toBeCloseTo(2, 5);
  });

  it('o skin DEFORMA a malha ao longo do clipe', () => {
    const scene = parseGlb(skinnedGlb());
    const rest = scene.sample(0, 0);
    const bent = scene.sample(0, 1);
    // a base (junta 0) nao se mexe; a ponta (junta 1) gira 90 graus em Z
    expect(bent[0]).toBeCloseTo(rest[0], 5);
    expect(bent[1]).toBeCloseTo(rest[1], 5);
    let moved = 0;
    for (let i = 0; i < rest.length; i++) if (Math.abs(rest[i] - bent[i]) > 0.1) moved++;
    expect(moved).toBeGreaterThan(0);
    // o giro de 90 graus em Z leva o vertice de x=2,y=-0.5 para x=2.5,y=0
    const xs = [];
    for (let i = 0; i < bent.length; i += 3) xs.push(bent[i]);
    expect(Math.max(...xs)).toBeCloseTo(2.5, 4);
  });

  it('interpola no meio do caminho, sem pular direto para a chave', () => {
    const scene = parseGlb(skinnedGlb());
    const mid = scene.sample(0, 0.5);
    const end = scene.sample(0, 1);
    const xsMid: number[] = [];
    const xsEnd: number[] = [];
    for (let i = 0; i < mid.length; i += 3) {
      xsMid.push(mid[i]);
      xsEnd.push(end[i]);
    }
    expect(Math.max(...xsMid)).toBeGreaterThan(2);
    expect(Math.max(...xsMid)).toBeLessThan(Math.max(...xsEnd));
  });

  it('tempo fora do clipe grampeia na primeira e na ultima chave', () => {
    const scene = parseGlb(skinnedGlb());
    expect(Array.from(scene.sample(0, -5))).toEqual(Array.from(scene.sample(0, 0)));
    expect(Array.from(scene.sample(0, 99))).toEqual(Array.from(scene.sample(0, 1)));
  });

  it('e deterministico: mesma entrada, mesmos bytes de saida', () => {
    const a = parseGlb(skinnedGlb()).sample(0, 0.37);
    const b = parseGlb(skinnedGlb()).sample(0, 0.37);
    expect(Array.from(a)).toEqual(Array.from(b));
  });
});

describe('orientTriangles', () => {
  it('Y para cima vira Z para cima, e a frente do glTF vira -y', () => {
    // ponto 1 unidade "para cima" no glTF (+y) e 1 "para a frente" (+z)
    const out = orientTriangles(Float32Array.from([0, 1, 0, 0, 0, 1, 0, 0, 0]), {
      up: 'y',
      yaw: 0,
    });
    expect(Array.from(out.slice(0, 3))).toEqual([0, 0, 1]); // cima -> +z
    expect(Array.from(out.slice(3, 6))).toEqual([0, -1, 0]); // frente -> -y
  });

  it('Z para cima passa reto', () => {
    const tris = Float32Array.from([1, 2, 3]);
    expect(Array.from(orientTriangles(tris, { up: 'z', yaw: 0 }))).toEqual([1, 2, 3]);
  });

  it('yaw gira em torno do eixo vertical sem mexer na altura', () => {
    const out = orientTriangles(Float32Array.from([1, 0, 5]), { up: 'z', yaw: 90 });
    expect(Array.from(out)).toEqual([0, 1, 5]);
    const back = orientTriangles(Float32Array.from([1, 0, 5]), { up: 'z', yaw: 180 });
    expect(Array.from(back)).toEqual([-1, 0, 5]);
  });

  it('o padrao e o do glTF', () => {
    expect(DEFAULT_ORIENTATION).toEqual({ up: 'y', yaw: 0 });
  });
});

describe('GLB -> voxels', () => {
  /** Cubo de 1 unidade, com a animacao movendo o no inteiro para cima. */
  const movingCubeGlb = (): ArrayBuffer => {
    const v = [
      [0, 0, 0],
      [1, 0, 0],
      [1, 1, 0],
      [0, 1, 0],
      [0, 0, 1],
      [1, 0, 1],
      [1, 1, 1],
      [0, 1, 1],
    ];
    const faces = [
      [0, 2, 1],
      [0, 3, 2],
      [4, 5, 6],
      [4, 6, 7],
      [0, 1, 5],
      [0, 5, 4],
      [1, 2, 6],
      [1, 6, 5],
      [2, 3, 7],
      [2, 7, 6],
      [3, 0, 4],
      [3, 4, 7],
    ];
    const positions = f32(v.flat());
    const indices = new Uint16Array(faces.flat()).buffer;
    const times = f32([0, 1]);
    const trans = f32([0, 0, 0, 0, 3, 0]);
    const bin = concat(positions, indices, times, trans);
    return buildGlb(
      {
        asset: { version: '2.0' },
        scenes: [{ nodes: [0] }],
        nodes: [{ mesh: 0 }],
        meshes: [{ primitives: [{ attributes: { POSITION: 0 }, indices: 1 }] }],
        animations: [
          {
            name: 'sobe',
            channels: [{ sampler: 0, target: { node: 0, path: 'translation' } }],
            samplers: [{ input: 2, output: 3 }],
          },
        ],
        accessors: [
          { bufferView: 0, componentType: 5126, count: 8, type: 'VEC3' },
          { bufferView: 1, componentType: 5123, count: 36, type: 'SCALAR' },
          { bufferView: 2, componentType: 5126, count: 2, type: 'SCALAR' },
          { bufferView: 3, componentType: 5126, count: 2, type: 'VEC3' },
        ],
        bufferViews: [
          { buffer: 0, byteOffset: 0, byteLength: positions.byteLength },
          { buffer: 0, byteOffset: positions.byteLength, byteLength: indices.byteLength },
          {
            buffer: 0,
            byteOffset: positions.byteLength + indices.byteLength,
            byteLength: times.byteLength,
          },
          {
            buffer: 0,
            byteOffset: positions.byteLength + indices.byteLength + times.byteLength,
            byteLength: trans.byteLength,
          },
        ],
        buffers: [{ byteLength: bin.byteLength }],
      },
      bin,
    );
  };

  it('o cubo do GLB vira um bloco solido de voxels', () => {
    const scene = parseGlb(movingCubeGlb());
    const tris = orientTriangles(scene.sample(null, 0), DEFAULT_ORIENTATION);
    const model = voxelizeTriangles(tris, 'rock', fitTriangles(tris, 8));
    const b = voxelModelBounds(model)!;
    expect(b.maxZ - b.minZ).toBe(7);
    expect(Object.keys(model).length).toBe(8 * 8 * 8);
  });

  it('UM enquadramento para todos os frames: o bicho nao pula nem muda de tamanho', () => {
    const scene = parseGlb(movingCubeGlb());
    const frames = [0, 0.5, 1].map((t) => orientTriangles(scene.sample(0, t), DEFAULT_ORIENTATION));
    const fit = fitFrames(frames, 8);
    const models = frames.map((f) => voxelizeTriangles(f, 'rock', fit));

    // o cubo tem o MESMO tamanho nos tres frames...
    const sizes = models.map((m) => {
      const b = voxelModelBounds(m)!;
      return [b.maxX - b.minX, b.maxY - b.minY, b.maxZ - b.minZ].join('x');
    });
    expect(new Set(sizes).size).toBe(1);
    // ...e sobe ao longo do clipe, que e o movimento animado
    const minZ = models.map((m) => voxelModelBounds(m)!.minZ);
    expect(minZ[0]).toBeLessThan(minZ[1]);
    expect(minZ[1]).toBeLessThan(minZ[2]);
  });

  it('enquadrar cada frame sozinho perderia o movimento (o que fitFrames evita)', () => {
    const scene = parseGlb(movingCubeGlb());
    const models = [0, 1].map((t) => {
      const tris = orientTriangles(scene.sample(0, t), DEFAULT_ORIENTATION);
      return voxelizeTriangles(tris, 'rock', fitTriangles(tris, 8));
    });
    // enquadrado sozinho, todo frame cai no chao: a subida some
    expect(voxelModelBounds(models[0])!.minZ).toBe(voxelModelBounds(models[1])!.minZ);
  });
});
