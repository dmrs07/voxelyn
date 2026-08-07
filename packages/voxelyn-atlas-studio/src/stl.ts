// Importacao de STL: parser (binario e ASCII) + voxelizacao por varredura de
// paridade — tudo puro, sem canvas, testavel em Node.
//
// A voxelizacao transforma a malha para o espaco de voxels (Z do STL = altura,
// mesma convencao do modelo do jogo), e para cada linha (y,z) da grade projeta
// os triangulos no plano YZ: o ponto (yc,zc) dentro do triangulo 2D da uma
// intersecao em X por interpolacao baricentrica. Ordenadas as intersecoes,
// os centros de voxel entre pares consecutivos estao DENTRO do solido
// (paridade). Funciona para malhas fechadas — que e o que um STL de impressao
// 3D quase sempre e; malhas abertas degradam graciosamente (pares impares sao
// descartados).
import type { VoxelModel } from './voxel';
import { voxelKey } from './voxel';

/** Triangulos como 9 floats por face (Ax,Ay,Az,Bx,...,Cz). */
export type StlTriangles = Float32Array;

const ASCII_VERTEX = /vertex\s+([-+0-9.eE]+)\s+([-+0-9.eE]+)\s+([-+0-9.eE]+)/g;

export const parseStl = (buffer: ArrayBuffer): StlTriangles => {
  // binario: 80 bytes de header + uint32 de contagem + 50 bytes por triangulo.
  // O check e pelo TAMANHO, nao pelo header: ha binarios que comecam com
  // "solid" e quebrariam uma deteccao por texto.
  if (buffer.byteLength >= 84) {
    const dv = new DataView(buffer);
    const count = dv.getUint32(80, true);
    if (84 + count * 50 === buffer.byteLength) {
      const out = new Float32Array(count * 9);
      for (let i = 0; i < count; i++) {
        const base = 84 + i * 50 + 12; // pula a normal
        for (let v = 0; v < 9; v++) {
          out[i * 9 + v] = dv.getFloat32(base + v * 4, true);
        }
      }
      return out;
    }
  }
  // ASCII
  const text = new TextDecoder().decode(buffer);
  if (!/solid/i.test(text.slice(0, 512))) throw new Error('arquivo nao parece um STL');
  const verts: number[] = [];
  for (const m of text.matchAll(ASCII_VERTEX)) {
    verts.push(Number(m[1]), Number(m[2]), Number(m[3]));
  }
  if (verts.length === 0 || verts.length % 9 !== 0) {
    throw new Error(`STL ASCII com ${verts.length / 3} vertices — esperado multiplo de 3`);
  }
  return new Float32Array(verts);
};

export type VoxelizeOptions = {
  /** altura alvo do modelo, em voxels finos (eixo Z do STL) */
  height: number;
  /** material da paleta aplicado a todos os voxels */
  material: string;
  /** alcance maximo em x/y a partir da origem (celulas fora sao descartadas) */
  range?: number;
};

/** Teto de voxels do resultado — acima disso o modelo nao e utilizavel no jogo. */
const MAX_VOXELS = 150_000;

// Deslocamento sub-celula do ponto de amostragem: evita que a linha de
// varredura passe exatamente por arestas/vertices da malha (o caso degenerado
// da paridade), sem mudar de celula.
const JITTER = 1e-3;

/**
 * Enquadramento: escala e origem usadas para levar a malha ao espaco de voxels.
 *
 * Existe separado porque uma ANIMACAO precisa que TODOS os frames usem o mesmo:
 * enquadrar cada frame por conta propria faria o bicho crescer, encolher e
 * pular de lugar a cada pose, ja que os limites da malha mudam quando ela se
 * mexe. Um enquadramento so, tirado da uniao dos frames, resolve.
 */
export type VoxelFit = {
  scale: number;
  centerX: number;
  centerY: number;
  minZ: number;
  spanX: number;
  spanY: number;
  height: number;
};

export const fitTriangles = (tris: StlTriangles, height: number): VoxelFit => {
  if (tris.length === 0) throw new Error('malha sem triangulos');
  if (height < 2) throw new Error('altura minima: 2 voxels');
  let minX = Infinity,
    maxX = -Infinity,
    minY = Infinity,
    maxY = -Infinity,
    minZ = Infinity,
    maxZ = -Infinity;
  for (let i = 0; i < tris.length; i += 3) {
    minX = Math.min(minX, tris[i]);
    maxX = Math.max(maxX, tris[i]);
    minY = Math.min(minY, tris[i + 1]);
    maxY = Math.max(maxY, tris[i + 1]);
    minZ = Math.min(minZ, tris[i + 2]);
    maxZ = Math.max(maxZ, tris[i + 2]);
  }
  const extentZ = maxZ - minZ;
  if (!(extentZ > 0)) throw new Error('malha sem altura no eixo Z');
  const scale = height / extentZ;
  return {
    scale,
    centerX: (minX + maxX) / 2,
    centerY: (minY + maxY) / 2,
    minZ,
    spanX: (maxX - minX) * scale,
    spanY: (maxY - minY) * scale,
    height,
  };
};

/** Enquadramento que cabe em TODOS os frames de uma animacao. */
export const fitFrames = (frames: StlTriangles[], height: number): VoxelFit => {
  let total = 0;
  for (const f of frames) total += f.length;
  const all = new Float32Array(total);
  let o = 0;
  for (const f of frames) {
    all.set(f, o);
    o += f.length;
  }
  return fitTriangles(all, height);
};

export const voxelizeStl = (tris: StlTriangles, opts: VoxelizeOptions): VoxelModel =>
  voxelizeTriangles(tris, opts.material, fitTriangles(tris, opts.height), opts.range);

/**
 * Material de cada voxel. Uma string pinta tudo igual (fluxo do STL, que nao tem
 * cor); uma funcao recebe o INDICE DO TRIANGULO que gerou aquela superficie — e
 * assim que a cor da textura de um GLB chega ao voxel.
 */
export type MaterialSource = string | ((triangle: number) => string);

export const voxelizeTriangles = (
  tris: StlTriangles,
  material: MaterialSource,
  fit: VoxelFit,
  rangeOpt?: number,
): VoxelModel => {
  const matOf = typeof material === 'string' ? () => material : material;
  const { scale, centerX, centerY, minZ, spanX, spanY, height } = fit;
  const range = rangeOpt ?? 48;
  if (tris.length === 0) throw new Error('malha sem triangulos');

  // malha transformada para o espaco de voxels: origem entre os pes, chao em 0
  const t = new Float32Array(tris.length);
  for (let i = 0; i < tris.length; i += 3) {
    t[i] = (tris[i] - centerX) * scale;
    t[i + 1] = (tris[i + 1] - centerY) * scale;
    t[i + 2] = (tris[i + 2] - minZ) * scale;
  }

  if ((spanX + 1) * (spanY + 1) * (height + 1) > MAX_VOXELS * 4) {
    throw new Error(
      `modelo voxelizado ficaria com ~${Math.round(spanX)}×${Math.round(spanY)}×${height} celulas — reduza a altura`,
    );
  }

  const triCount = t.length / 9;
  // buckets por faixa de z: cada linha de varredura so olha os triangulos que
  // cruzam a sua altura — e o que torna viavel voxelizar malha grande no celular
  const zBuckets: number[][] = Array.from({ length: height + 1 }, () => []);
  const yMinOf = new Float32Array(triCount);
  const yMaxOf = new Float32Array(triCount);
  for (let ti = 0; ti < triCount; ti++) {
    const o = ti * 9;
    const z0 = Math.min(t[o + 2], t[o + 5], t[o + 8]);
    const z1 = Math.max(t[o + 2], t[o + 5], t[o + 8]);
    yMinOf[ti] = Math.min(t[o + 1], t[o + 4], t[o + 7]);
    yMaxOf[ti] = Math.max(t[o + 1], t[o + 4], t[o + 7]);
    const from = Math.max(0, Math.floor(z0 - 0.5));
    const to = Math.min(height, Math.ceil(z1 + 0.5));
    for (let iz = from; iz <= to; iz++) zBuckets[iz].push(ti);
  }

  const model: VoxelModel = {};
  let count = 0;
  const iyMin = Math.max(-range, Math.floor(-spanY / 2) - 1);
  const iyMax = Math.min(range, Math.ceil(spanY / 2) + 1);
  const xs: number[] = [];
  const tris_: number[] = [];
  const order: number[] = [];
  const sortedX: number[] = [];
  const sortedT: number[] = [];

  for (let iz = 0; iz < height; iz++) {
    const zc = iz + 0.5 + JITTER;
    const bucket = zBuckets[Math.min(height, Math.max(0, iz))];
    for (let iy = iyMin; iy <= iyMax; iy++) {
      const yc = iy + 0.5 + JITTER;
      xs.length = 0;
      tris_.length = 0;
      for (const ti of bucket) {
        if (yc < yMinOf[ti] || yc > yMaxOf[ti]) continue;
        const o = ti * 9;
        // baricentrica de (yc,zc) na projecao YZ do triangulo
        const ay = t[o + 1],
          az = t[o + 2],
          by = t[o + 4],
          bz = t[o + 5],
          cy = t[o + 7],
          cz = t[o + 8];
        const denom = (by - ay) * (cz - az) - (cy - ay) * (bz - az);
        if (Math.abs(denom) < 1e-12) continue; // triangulo paralelo ao eixo X
        const u = ((yc - ay) * (cz - az) - (cy - ay) * (zc - az)) / denom;
        const v = ((by - ay) * (zc - az) - (yc - ay) * (bz - az)) / denom;
        const w = 1 - u - v;
        if (u < -1e-9 || v < -1e-9 || w < -1e-9) continue;
        xs.push(w * t[o] + u * t[o + 3] + v * t[o + 6]);
        tris_.push(ti);
      }
      if (xs.length < 2) continue;
      // ordena X e o triangulo de cada travessia JUNTOS: e o triangulo que diz
      // de que material aquela superficie e
      order.length = 0;
      for (let i = 0; i < xs.length; i++) order.push(i);
      order.sort((a, b) => xs[a] - xs[b]);
      sortedX.length = 0;
      sortedT.length = 0;
      for (const i of order) {
        sortedX.push(xs[i]);
        sortedT.push(tris_[i]);
      }
      xs.length = 0;
      for (const v of sortedX) xs.push(v);
      // Dedupe: uma face plana quadrada vem triangulada em DUAS metades, e um
      // ponto dentro dela pode acertar as duas — a mesma superficie contaria
      // duas vezes e inverteria a paridade dali em diante.
      let n = 0;
      for (let i = 0; i < xs.length; i++) {
        if (n === 0 || xs[i] - xs[n - 1] > 1e-6) {
          sortedT[n] = sortedT[i];
          xs[n++] = xs[i];
        }
      }
      xs.length = n;
      sortedT.length = n;
      const pairs = Math.floor(xs.length / 2);
      for (let p = 0; p < pairs; p++) {
        const x0 = xs[p * 2];
        const x1 = xs[p * 2 + 1];
        const from = Math.max(-range, Math.ceil(x0 - 0.5));
        const to = Math.min(range, Math.floor(x1 - 0.5));
        // o voxel herda o material da SUPERFICIE MAIS PROXIMA das duas que
        // fecham o vao: so a casca aparece na tela, e e ela que tem de estar
        // com a cor certa
        const matA = matOf(sortedT[p * 2]);
        const matB = matOf(sortedT[p * 2 + 1]);
        for (let ix = from; ix <= to; ix++) {
          const key = voxelKey(ix, iy, iz);
          if (!(key in model)) {
            model[key] = ix + 0.5 - x0 <= x1 - (ix + 0.5) ? matA : matB;
            count++;
            if (count > MAX_VOXELS) throw new Error('modelo com voxels demais — reduza a altura');
          }
        }
      }
    }
  }
  if (count === 0) throw new Error('voxelizacao nao produziu nenhum voxel (malha aberta demais?)');
  return model;
};
