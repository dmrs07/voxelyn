import type { Surface2D } from "../../core/surface2d";
import type { Palette } from "../../core/palette";
import type { VoxelGrid3D } from "./voxelGrid3d";

export type SliceAxis = "x" | "y" | "z";

export function renderSlices(
  grid: VoxelGrid3D,
  axis: SliceAxis,
  sliceIndex: number,
  surface: Surface2D,
  palette: Palette
): void {
  const w = surface.width;
  const h = surface.height;
  const sp = surface.pixels;

  if (axis === "z") {
    const z = Math.max(0, Math.min(grid.depth - 1, sliceIndex | 0));
    const sw = Math.min(grid.width, w);
    const sh = Math.min(grid.height, h);
    for (let y = 0; y < sh; y++) {
      for (let x = 0; x < sw; x++) {
        const i = (z * grid.height + y) * grid.width + x;
        const mat = grid.data[i] & 0xff;
        sp[y * w + x] = palette[mat] ?? 0;
      }
    }
    return;
  }

  if (axis === "y") {
    const y = Math.max(0, Math.min(grid.height - 1, sliceIndex | 0));
    const sw = Math.min(grid.width, w);
    const sd = Math.min(grid.depth, h);
    for (let z = 0; z < sd; z++) {
      for (let x = 0; x < sw; x++) {
        const i = (z * grid.height + y) * grid.width + x;
        const mat = grid.data[i] & 0xff;
        sp[z * w + x] = palette[mat] ?? 0;
      }
    }
    return;
  }

  const x = Math.max(0, Math.min(grid.width - 1, sliceIndex | 0));
  const sh = Math.min(grid.height, h);
  const sd = Math.min(grid.depth, w);
  for (let z = 0; z < sd; z++) {
    for (let y = 0; y < sh; y++) {
      const i = (z * grid.height + y) * grid.width + x;
      const mat = grid.data[i] & 0xff;
      sp[y * w + z] = palette[mat] ?? 0;
    }
  }
}
