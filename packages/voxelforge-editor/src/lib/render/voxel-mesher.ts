import type { EditorDocument } from '../document/types';
import type { Material } from '@voxelyn/core';
import { buildVoxelGridFromDocument, computeVoxelBounds, type VoxelBounds } from './voxel-grid';

type Vec3 = { x: number; y: number; z: number };

/**
 * Greedy-meshed voxel surface data for WebGL rendering.
 */
export type VoxelMesh = {
  positions: Float32Array;
  colors: Float32Array;
  indices: Uint32Array;
  bounds: VoxelBounds;
};

const unpackColor = (color: number) => ({
  r: (color & 0xff) / 255,
  g: ((color >> 8) & 0xff) / 255,
  b: ((color >> 16) & 0xff) / 255,
  a: ((color >> 24) & 0xff) / 255,
});

const shade = (color: number, normal: Vec3, lightDir: Vec3): [number, number, number, number] => {
  const base = unpackColor(color >>> 0);
  const dot = Math.max(0.2, normal.x * lightDir.x + normal.y * lightDir.y + normal.z * lightDir.z);
  return [base.r * dot, base.g * dot, base.b * dot, base.a];
};

/**
 * Builds a greedy mesh from the current document using the palette and light direction.
 * Note: Swaps Y and Z to convert from document coordinates (X,Y,Z where Z is vertical)
 * to 3D world coordinates (X,Y,Z where Y is vertical).
 */
export const buildGreedyMeshFromDocument = (
  doc: EditorDocument,
  palette: Material[],
  lightDir: Vec3 = { x: -0.4, y: 0.8, z: 0.3 }
): VoxelMesh => {
  const grid = buildVoxelGridFromDocument(doc);
  const bounds = computeVoxelBounds(grid);

  if (bounds.empty) {
    return { positions: new Float32Array(), colors: new Float32Array(), indices: new Uint32Array(), bounds };
  }

  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  let indexOffset = 0;

  // Swap height and depth for 3D rendering (Y becomes vertical)
  const dims = [grid.width, grid.depth, grid.height];

  const voxelAt = (x: number, y: number, z: number): number => {
    // Map from 3D coords (x, y=vertical, z=depth) back to grid coords (x, y, z)
    const gx = x;
    const gy = z; // grid Y = 3D Z
    const gz = y; // grid Z = 3D Y (vertical)
    if (gx < 0 || gy < 0 || gz < 0 || gx >= grid.width || gy >= grid.height || gz >= grid.depth) return 0;
    return grid.data[(gz * grid.height + gy) * grid.width + gx] ?? 0;
  };

  const addQuad = (
    origin: [number, number, number],
    du: [number, number, number],
    dv: [number, number, number],
    normal: Vec3,
    materialId: number
  ) => {
    const color = palette[materialId]?.color ?? 0;
    const [r, g, b, a] = shade(color, normal, lightDir);

    const p0 = origin;
    const p1: [number, number, number] = [origin[0] + du[0], origin[1] + du[1], origin[2] + du[2]];
    const p2: [number, number, number] = [
      origin[0] + du[0] + dv[0],
      origin[1] + du[1] + dv[1],
      origin[2] + du[2] + dv[2],
    ];
    const p3: [number, number, number] = [origin[0] + dv[0], origin[1] + dv[1], origin[2] + dv[2]];

    positions.push(...p0, ...p1, ...p2, ...p3);
    for (let i = 0; i < 4; i += 1) {
      colors.push(r, g, b, a);
    }

    indices.push(indexOffset, indexOffset + 1, indexOffset + 2, indexOffset, indexOffset + 2, indexOffset + 3);
    indexOffset += 4;
  };

  for (let axis = 0; axis < 3; axis += 1) {
    const u = (axis + 1) % 3;
    const v = (axis + 2) % 3;
    const mask = new Int32Array(dims[u] * dims[v]);
    const x = [0, 0, 0];
    const q = [0, 0, 0];
    q[axis] = 1;

    for (x[axis] = -1; x[axis] < dims[axis]; x[axis] += 1) {
      let n = 0;
      for (x[v] = 0; x[v] < dims[v]; x[v] += 1) {
        for (x[u] = 0; x[u] < dims[u]; x[u] += 1) {
          const a = x[axis] >= 0 ? voxelAt(x[0], x[1], x[2]) : 0;
          const b = x[axis] < dims[axis] - 1 ? voxelAt(x[0] + q[0], x[1] + q[1], x[2] + q[2]) : 0;
          if ((a & 0xff) !== 0 && (b & 0xff) === 0) {
            mask[n++] = a & 0xff;
          } else if ((b & 0xff) !== 0 && (a & 0xff) === 0) {
            mask[n++] = -(b & 0xff);
          } else {
            mask[n++] = 0;
          }
        }
      }

      n = 0;
      for (let j = 0; j < dims[v]; j += 1) {
        for (let i = 0; i < dims[u]; ) {
          const c = mask[n];
          if (c === 0) {
            i += 1;
            n += 1;
            continue;
          }

          let w = 1;
          while (i + w < dims[u] && mask[n + w] === c) w += 1;

          let h = 1;
          let done = false;
          while (j + h < dims[v]) {
            for (let k = 0; k < w; k += 1) {
              if (mask[n + k + h * dims[u]] !== c) {
                done = true;
                break;
              }
            }
            if (done) break;
            h += 1;
          }

          const du: [number, number, number] = [0, 0, 0];
          const dv: [number, number, number] = [0, 0, 0];
          du[u] = w;
          dv[v] = h;

          const back = c < 0;
          const materialId = Math.abs(c);
          const origin: [number, number, number] = [x[0], x[1], x[2]];
          origin[axis] = x[axis] + 1;
          origin[u] = i;
          origin[v] = j;

          const normal: Vec3 = { x: 0, y: 0, z: 0 };
          if (axis === 0) normal.x = back ? -1 : 1;
          if (axis === 1) normal.y = back ? -1 : 1;
          if (axis === 2) normal.z = back ? -1 : 1;

          if (back) {
            const tmp: [number, number, number] = [du[0], du[1], du[2]];
            du[0] = dv[0];
            du[1] = dv[1];
            du[2] = dv[2];
            dv[0] = tmp[0];
            dv[1] = tmp[1];
            dv[2] = tmp[2];
          }

          addQuad(origin, du, dv, normal, materialId);

          for (let yOffset = 0; yOffset < h; yOffset += 1) {
            for (let x2 = 0; x2 < w; x2 += 1) {
              mask[n + x2 + yOffset * dims[u]] = 0;
            }
          }

          i += w;
          n += w;
        }
      }
    }
  }

  return {
    positions: new Float32Array(positions),
    colors: new Float32Array(colors),
    indices: new Uint32Array(indices),
    bounds,
  };
};
