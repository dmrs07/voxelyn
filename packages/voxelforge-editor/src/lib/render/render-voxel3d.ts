import { createSurface2D, type Surface2D } from '@voxelyn/core';
import type { VoxelGrid3D } from '@voxelyn/core';
import type { Material } from '@voxelyn/core';
import type { VoxelBounds } from './voxel-grid';

type Vec3 = { x: number; y: number; z: number };

type RayCache = {
  width: number;
  height: number;
  fov: number;
  dirs: Float32Array;
};

let rayCache: RayCache | null = null;

export type VoxelRaycastSettings = {
  resolutionScale: number;
  maxSteps: number;
  step: number;
  fov: number;
  background: number;
  bounds?: VoxelBounds;
};

export type VoxelRaycastCamera = {
  position: Vec3;
  target: Vec3;
};

export type { VoxelBounds } from './voxel-grid';
export { buildVoxelGridFromDocument, buildVoxelGridFromDocumentWithBounds, computeVoxelBounds } from './voxel-grid';


const packColor = (r: number, g: number, b: number, a: number): number =>
  ((a & 0xff) << 24) | ((b & 0xff) << 16) | ((g & 0xff) << 8) | (r & 0xff);

const shadeColor = (color: number, brightness: number): number => {
  const r = Math.round((color & 0xff) * brightness);
  const g = Math.round(((color >> 8) & 0xff) * brightness);
  const b = Math.round(((color >> 16) & 0xff) * brightness);
  const a = (color >> 24) & 0xff;
  return packColor(r, g, b, a);
};

const normalize = (v: Vec3): Vec3 => {
  const len = Math.hypot(v.x, v.y, v.z) || 1;
  return { x: v.x / len, y: v.y / len, z: v.z / len };
};

const cross = (a: Vec3, b: Vec3): Vec3 => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
});

const sub = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });

const buildRayCache = (width: number, height: number, fov: number): RayCache => {
  const dirs = new Float32Array(width * height * 3);
  const aspect = width / height;
  const fovValue = Math.max(0.2, fov);
  let offset = 0;
  for (let py = 0; py < height; py += 1) {
    const v = (1 - 2 * (py + 0.5) / height) * fovValue;
    for (let px = 0; px < width; px += 1) {
      const u = (2 * (px + 0.5) / width - 1) * fovValue * aspect;
      dirs[offset++] = u;
      dirs[offset++] = v;
      dirs[offset++] = 0;
    }
  }
  return { width, height, fov: fovValue, dirs };
};


export const renderVoxelRaycast = (
  grid: VoxelGrid3D,
  palette: Material[],
  width: number,
  height: number,
  camera: VoxelRaycastCamera,
  settings: VoxelRaycastSettings,
  targetSurface?: Surface2D
): Surface2D => {
  const surface =
    targetSurface && targetSurface.width === width && targetSurface.height === height
      ? targetSurface
      : createSurface2D(width, height);

  const pixels = surface.pixels;
  const maxSteps = Math.max(1, settings.maxSteps | 0);
  const step = Math.max(0.1, settings.step);
  const fov = Math.max(0.2, settings.fov);
  const bg = settings.background >>> 0;
  const bounds = settings.bounds;

  if (bounds?.empty) {
    pixels.fill(bg);
    return surface;
  }

  if (!rayCache || rayCache.width !== width || rayCache.height !== height || rayCache.fov !== fov) {
    rayCache = buildRayCache(width, height, fov);
  }

  const forward = normalize(sub(camera.target, camera.position));
  const worldUp = { x: 0, y: 1, z: 0 };
  const right = normalize(cross(forward, worldUp));
  const up = normalize(cross(right, forward));
  const maxDist = maxSteps * step;
  const stepSize = step * 1.1;

  let rayOffset = 0;
  for (let py = 0; py < height; py += 1) {
    for (let px = 0; px < width; px += 1) {
      const u = rayCache.dirs[rayOffset++];
      const v = rayCache.dirs[rayOffset++];
      rayOffset++;
      const dirX = forward.x + right.x * u + up.x * v;
      const dirY = forward.y + right.y * u + up.y * v;
      const dirZ = forward.z + right.z * u + up.z * v;
      const invLen = 1 / (Math.hypot(dirX, dirY, dirZ) || 1);
      const nx = dirX * invLen;
      const ny = dirY * invLen;
      const nz = dirZ * invLen;

      let hitColor = bg;
      let startDist = 0;
      let endDist = maxDist;

      if (bounds) {
        const minX = bounds.minX;
        const minY = bounds.minY;
        const minZ = bounds.minZ;
        const maxX = bounds.maxX + 1;
        const maxY = bounds.maxY + 1;
        const maxZ = bounds.maxZ + 1;

        const ox = camera.position.x;
        const oy = camera.position.y;
        const oz = camera.position.z;

        const checkAxis = (o: number, d: number, min: number, max: number) => {
          if (Math.abs(d) < 1e-6) {
            if (o < min || o > max) return null;
            return [-Infinity, Infinity] as const;
          }
          const t1 = (min - o) / d;
          const t2 = (max - o) / d;
          return t1 < t2 ? ([t1, t2] as const) : ([t2, t1] as const);
        };

        const tx = checkAxis(ox, nx, minX, maxX);
        if (!tx) {
          pixels[py * width + px] = hitColor >>> 0;
          continue;
        }
        const ty = checkAxis(oy, ny, minY, maxY);
        if (!ty) {
          pixels[py * width + px] = hitColor >>> 0;
          continue;
        }
        const tz = checkAxis(oz, nz, minZ, maxZ);
        if (!tz) {
          pixels[py * width + px] = hitColor >>> 0;
          continue;
        }

        startDist = Math.max(tx[0], ty[0], tz[0]);
        endDist = Math.min(tx[1], ty[1], tz[1]);
        if (endDist < 0 || startDist > endDist) {
          pixels[py * width + px] = hitColor >>> 0;
          continue;
        }
        if (startDist < 0) startDist = 0;
        if (endDist > maxDist) endDist = maxDist;
      }

      let distance = startDist;
      for (let s = 0; s < maxSteps; s += 1) {
        if (distance > endDist) break;
        const rx = camera.position.x + nx * distance;
        const ry = camera.position.y + ny * distance;
        const rz = camera.position.z + nz * distance;
        const xi = rx | 0;
        const yi = ry | 0;
        const zi = rz | 0;
        if (xi < 0 || yi < 0 || zi < 0 || xi >= grid.width || yi >= grid.height || zi >= grid.depth) {
          distance += stepSize;
          continue;
        }

        const idx = (zi * grid.height + yi) * grid.width + xi;
        const cell = grid.data[idx] ?? 0;
        const mat = cell & 0xff;
        if (mat !== 0) {
          const base = palette[mat]?.color ?? bg;
          const falloff = 1 - Math.min(1, distance / maxDist);
          const brightness = 0.3 + 0.7 * falloff;
          hitColor = shadeColor(base, brightness);
          break;
        }
        distance += stepSize;
      }

      pixels[py * width + px] = hitColor >>> 0;
    }
  }

  return surface;
};
