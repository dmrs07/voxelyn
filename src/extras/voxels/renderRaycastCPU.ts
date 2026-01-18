import type { Surface2D } from "../../core/surface2d";
import type { Palette } from "../../core/palette";
import type { VoxelGrid3D } from "./voxelGrid3d";

export type RaycastCamera = {
  originX: number;
  originY: number;
  originZ: number;
  dirX: number;
  dirY: number;
  dirZ: number;
  step: number;
};

export function renderRaycastCPU(
  grid: VoxelGrid3D,
  camera: RaycastCamera,
  surface: Surface2D,
  palette: Palette,
  maxSteps = 64
): void {
  const w = surface.width | 0;
  const h = surface.height | 0;
  const sp = surface.pixels;
  const step = camera.step > 0 ? camera.step : 1;

  for (let py = 0; py < h; py++) {
    for (let px = 0; px < w; px++) {
      let x = camera.originX + (px - w * 0.5) * camera.dirX;
      let y = camera.originY + (py - h * 0.5) * camera.dirY;
      let z = camera.originZ;
      let hit = 0;
      for (let s = 0; s < maxSteps; s++) {
        const xi = x | 0;
        const yi = y | 0;
        const zi = z | 0;
        if (
          xi < 0 ||
          yi < 0 ||
          zi < 0 ||
          xi >= grid.width ||
          yi >= grid.height ||
          zi >= grid.depth
        ) {
          x += camera.dirX * step;
          y += camera.dirY * step;
          z += camera.dirZ * step;
          continue;
        }
        const idx = (zi * grid.height + yi) * grid.width + xi;
        const mat = grid.data[idx] & 0xff;
        if (mat !== 0) {
          hit = mat;
          break;
        }
        x += camera.dirX * step;
        y += camera.dirY * step;
        z += camera.dirZ * step;
      }
      sp[py * w + px] = palette[hit] ?? 0;
    }
  }
}
