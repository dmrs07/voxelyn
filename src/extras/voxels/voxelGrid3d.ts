export type VoxelGrid3D = {
  width: number;
  height: number;
  depth: number;
  data: Uint16Array;
};

export type VoxelGrid3DCreateOptions = {
  data?: Uint16Array;
};

export function createVoxelGrid3D(
  width: number,
  height: number,
  depth: number,
  options: VoxelGrid3DCreateOptions = {}
): VoxelGrid3D {
  const size = width * height * depth;
  const data = options.data ?? new Uint16Array(size);
  if (data.length < size) {
    throw new Error("data length is smaller than width*height*depth");
  }
  return { width, height, depth, data };
}

export function index3D(
  grid: VoxelGrid3D,
  x: number,
  y: number,
  z: number
): number {
  return (z * grid.height + y) * grid.width + x;
}

export function inBounds3D(
  grid: VoxelGrid3D,
  x: number,
  y: number,
  z: number
): boolean {
  return (
    x >= 0 &&
    y >= 0 &&
    z >= 0 &&
    x < grid.width &&
    y < grid.height &&
    z < grid.depth
  );
}

export function getVoxel(
  grid: VoxelGrid3D,
  x: number,
  y: number,
  z: number
): number {
  if (!inBounds3D(grid, x, y, z)) return 0;
  return grid.data[index3D(grid, x, y, z)] ?? 0;
}

export function setVoxel(
  grid: VoxelGrid3D,
  x: number,
  y: number,
  z: number,
  val: number
): void {
  if (!inBounds3D(grid, x, y, z)) return;
  grid.data[index3D(grid, x, y, z)] = val & 0xffff;
}
