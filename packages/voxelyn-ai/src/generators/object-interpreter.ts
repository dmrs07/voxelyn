/**
 * @voxelyn/ai - Object Interpreter
 *
 * Interprets ObjectBlueprint structures from AI and builds voxel data.
 * Supports primitive shapes: box, cylinder, sphere, slope, arch, cone, pyramid, torus.
 */

import type { ObjectBlueprint, Primitive, PrimitiveType } from '../types';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Result of building voxels from a blueprint.
 */
export type VoxelBuildResult = {
  /** 3D voxel data as flat array [x + y*width + z*width*height]. */
  data: Uint16Array;
  /** Dimensions. */
  width: number;
  height: number;
  depth: number;
  /** Materials used (id -> count). */
  materialUsage: Map<number, number>;
  /** Build warnings for oversized/scaled blueprints. */
  warnings?: string[];
};

/**
 * Options for voxel building.
 */
export type BuildOptions = {
  /** Material ID mapping (name -> id). */
  materialMapping?: Record<string, number>;
  /** Default material ID for unmapped materials. */
  defaultMaterial?: number;
  /** Padding around the object. */
  padding?: number;
  /** Scale multiplier applied to blueprint bounds, positions, and sizes. */
  scale?: number;
  /** Upper safety limit for dimensions after scaling. */
  maxDimension?: number;
};

// ============================================================================
// PRIMITIVE BUILDERS
// ============================================================================

type VoxelSetter = (x: number, y: number, z: number, material: number, subtract: boolean) => void;

/**
 * Build a box/rectangular prism.
 */
function buildBox(
  p: Primitive,
  setVoxel: VoxelSetter,
  materialId: number
): void {
  const [px, py, pz] = p.position;
  const [w, h, d] = p.size;
  const subtract = p.subtract ?? false;

  for (let z = 0; z < d; z++) {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        setVoxel(px + x, py + y, pz + z, materialId, subtract);
      }
    }
  }
}

/**
 * Build a cylinder (vertical axis).
 */
function buildCylinder(
  p: Primitive,
  setVoxel: VoxelSetter,
  materialId: number
): void {
  const [px, py, pz] = p.position;
  const [diameter, height, _] = p.size;
  const radius = diameter / 2;
  const centerX = radius;
  const centerZ = radius;
  const subtract = p.subtract ?? false;

  for (let y = 0; y < height; y++) {
    for (let z = 0; z < diameter; z++) {
      for (let x = 0; x < diameter; x++) {
        const dx = x + 0.5 - centerX;
        const dz = z + 0.5 - centerZ;
        if (dx * dx + dz * dz <= radius * radius) {
          setVoxel(px + x, py + y, pz + z, materialId, subtract);
        }
      }
    }
  }
}

/**
 * Build a sphere/ellipsoid.
 */
function buildSphere(
  p: Primitive,
  setVoxel: VoxelSetter,
  materialId: number
): void {
  const [px, py, pz] = p.position;
  const [dx, dy, dz] = p.size;
  const rx = dx / 2;
  const ry = dy / 2;
  const rz = dz / 2;
  const subtract = p.subtract ?? false;

  for (let z = 0; z < dz; z++) {
    for (let y = 0; y < dy; y++) {
      for (let x = 0; x < dx; x++) {
        const nx = (x + 0.5 - rx) / rx;
        const ny = (y + 0.5 - ry) / ry;
        const nz = (z + 0.5 - rz) / rz;
        if (nx * nx + ny * ny + nz * nz <= 1) {
          setVoxel(px + x, py + y, pz + z, materialId, subtract);
        }
      }
    }
  }
}

/**
 * Build a slope/ramp (inclines in +Y as +X increases by default).
 */
function buildSlope(
  p: Primitive,
  setVoxel: VoxelSetter,
  materialId: number
): void {
  const [px, py, pz] = p.position;
  const [w, h, d] = p.size;
  const rotation = p.rotation ?? [0, 0, 0];
  const subtract = p.subtract ?? false;

  for (let z = 0; z < d; z++) {
    for (let x = 0; x < w; x++) {
      // Height at this x position (slope rises with x)
      const slopeHeight = Math.floor((x / w) * h) + 1;

      for (let y = 0; y < slopeHeight; y++) {
        // Apply rotation (simplified: only Y-axis rotation in 90° steps)
        let fx = x, fz = z;
        const ry = rotation[1] ?? 0;

        switch (ry % 4) {
          case 1: // 90°
            fx = z;
            fz = w - 1 - x;
            break;
          case 2: // 180°
            fx = w - 1 - x;
            fz = d - 1 - z;
            break;
          case 3: // 270°
            fx = d - 1 - z;
            fz = x;
            break;
        }

        setVoxel(px + fx, py + y, pz + fz, materialId, subtract);
      }
    }
  }
}

/**
 * Build an arch (semicircular opening).
 */
function buildArch(
  p: Primitive,
  setVoxel: VoxelSetter,
  materialId: number
): void {
  const [px, py, pz] = p.position;
  const [w, h, d] = p.size;
  const subtract = p.subtract ?? false;

  const centerX = w / 2;
  const radius = w / 2;

  for (let z = 0; z < d; z++) {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        // Arch: fill except for semicircular cutout at bottom
        const dx = x + 0.5 - centerX;
        const archY = y;

        // Inside the arch opening?
        const insideArch = archY < radius && (dx * dx + archY * archY) < radius * radius;

        if (!insideArch) {
          setVoxel(px + x, py + y, pz + z, materialId, subtract);
        }
      }
    }
  }
}

/**
 * Build a cone (point at top).
 */
function buildCone(
  p: Primitive,
  setVoxel: VoxelSetter,
  materialId: number
): void {
  const [px, py, pz] = p.position;
  const [baseDiameter, height, _] = p.size;
  const baseRadius = baseDiameter / 2;
  const subtract = p.subtract ?? false;

  for (let y = 0; y < height; y++) {
    // Radius decreases as y increases
    const currentRadius = baseRadius * (1 - y / height);

    for (let z = 0; z < baseDiameter; z++) {
      for (let x = 0; x < baseDiameter; x++) {
        const dx = x + 0.5 - baseRadius;
        const dz = z + 0.5 - baseRadius;
        if (dx * dx + dz * dz <= currentRadius * currentRadius) {
          setVoxel(px + x, py + y, pz + z, materialId, subtract);
        }
      }
    }
  }
}

/**
 * Build a pyramid (4-sided, point at top).
 */
function buildPyramid(
  p: Primitive,
  setVoxel: VoxelSetter,
  materialId: number
): void {
  const [px, py, pz] = p.position;
  const [baseW, height, baseD] = p.size;
  const subtract = p.subtract ?? false;

  for (let y = 0; y < height; y++) {
    // Base shrinks as y increases
    const t = y / height;
    const currentW = Math.ceil(baseW * (1 - t));
    const currentD = Math.ceil(baseD * (1 - t));
    const offsetX = Math.floor((baseW - currentW) / 2);
    const offsetZ = Math.floor((baseD - currentD) / 2);

    for (let z = 0; z < currentD; z++) {
      for (let x = 0; x < currentW; x++) {
        setVoxel(px + offsetX + x, py + y, pz + offsetZ + z, materialId, subtract);
      }
    }
  }
}

/**
 * Build a torus (donut shape, horizontal).
 */
function buildTorus(
  p: Primitive,
  setVoxel: VoxelSetter,
  materialId: number
): void {
  const [px, py, pz] = p.position;
  const [outerDiameter, thickness, _] = p.size;
  const majorRadius = outerDiameter / 2 - thickness / 2;
  const minorRadius = thickness / 2;
  const subtract = p.subtract ?? false;

  const centerX = outerDiameter / 2;
  const centerZ = outerDiameter / 2;
  const centerY = thickness / 2;

  for (let z = 0; z < outerDiameter; z++) {
    for (let y = 0; y < thickness; y++) {
      for (let x = 0; x < outerDiameter; x++) {
        const dx = x + 0.5 - centerX;
        const dz = z + 0.5 - centerZ;
        const dy = y + 0.5 - centerY;

        // Distance from center of torus tube
        const distFromAxis = Math.sqrt(dx * dx + dz * dz);
        const distFromRing = distFromAxis - majorRadius;
        const distFromTube = Math.sqrt(distFromRing * distFromRing + dy * dy);

        if (distFromTube <= minorRadius) {
          setVoxel(px + x, py + y, pz + z, materialId, subtract);
        }
      }
    }
  }
}

// ============================================================================
// PRIMITIVE DISPATCHER
// ============================================================================

const PRIMITIVE_BUILDERS: Record<PrimitiveType, (p: Primitive, set: VoxelSetter, mat: number) => void> = {
  box: buildBox,
  cylinder: buildCylinder,
  sphere: buildSphere,
  slope: buildSlope,
  arch: buildArch,
  cone: buildCone,
  pyramid: buildPyramid,
  torus: buildTorus,
};

// ============================================================================
// MAIN BUILDER
// ============================================================================

/**
 * Build voxel data from an AI-generated object blueprint.
 *
 * @param blueprint - ObjectBlueprint from Gemini prediction
 * @param options - Build options (material mapping, padding)
 * @returns VoxelBuildResult with 3D voxel data
 *
 * @example
 * ```ts
 * const result = await client.predictObjectBlueprint('small wooden house');
 * if (result.success) {
 *   const voxels = buildVoxelsFromBlueprint(result.data, {
 *     materialMapping: { wood: 6, stone: 1 }
 *   });
 *   // voxels.data is Uint16Array ready for rendering
 * }
 * ```
 */
export function buildVoxelsFromBlueprint(
  blueprint: ObjectBlueprint,
  options: BuildOptions = {}
): VoxelBuildResult {
  const {
    materialMapping = {},
    defaultMaterial = 1,
    padding = 0,
    scale = 1,
    maxDimension = 1024,
  } = options;
  const warnings: string[] = [];
  const safeScale = Number.isFinite(scale) ? Math.max(0.1, Math.min(8, scale)) : 1;

  if (safeScale !== scale) {
    warnings.push(`Scale ${scale} clamped to ${safeScale} for safety.`);
  }

  // Merge blueprint mapping with provided mapping
  const fullMapping: Record<string, number> = {
    ...blueprint.materialMapping,
    ...materialMapping,
  };

  const scaleSize = (value: number): number => {
    const scaled = Math.round(value * safeScale);
    return Math.max(1, Math.min(maxDimension, scaled));
  };

  const scalePosition = (value: number): number => {
    const scaled = Math.round(value * safeScale);
    return Math.max(0, Math.min(maxDimension - 1, scaled));
  };

  const scaledPrimitives: Primitive[] = blueprint.primitives.map((primitive) => ({
    ...primitive,
    position: [
      scalePosition(primitive.position[0]),
      scalePosition(primitive.position[1]),
      scalePosition(primitive.position[2]),
    ],
    size: [
      scaleSize(primitive.size[0]),
      scaleSize(primitive.size[1]),
      scaleSize(primitive.size[2]),
    ],
  }));

  // Calculate bounds with padding
  const [bw, bh, bd] = blueprint.bounds;
  const width = Math.max(1, Math.min(maxDimension, scaleSize(bw))) + padding * 2;
  const height = Math.max(1, Math.min(maxDimension, scaleSize(bh))) + padding * 2;
  const depth = Math.max(1, Math.min(maxDimension, scaleSize(bd))) + padding * 2;
  const totalVoxels = width * height * depth;
  if (totalVoxels > 8_000_000) {
    warnings.push(`Scaled blueprint is large (${totalVoxels} voxels). Generation may be slow.`);
  }

  // Create voxel array (0 = air)
  const data = new Uint16Array(width * height * depth);
  const materialUsage = new Map<number, number>();

  // Helper to set voxel with bounds checking
  const setVoxel: VoxelSetter = (x, y, z, material, subtract) => {
    const vx = x + padding;
    const vy = y + padding;
    const vz = z + padding;

    if (vx < 0 || vx >= width || vy < 0 || vy >= height || vz < 0 || vz >= depth) {
      return;
    }

    const idx = vx + vy * width + vz * width * height;

    if (subtract) {
      // Carve: set to air (0)
      data[idx] = 0;
    } else {
      data[idx] = material;
      materialUsage.set(material, (materialUsage.get(material) ?? 0) + 1);
    }
  };

  // Resolve material ID from name or number
  const resolveMaterial = (mat: number | string): number => {
    if (typeof mat === 'number') {
      return mat;
    }
    const lower = mat.toLowerCase();
    return fullMapping[lower] ?? fullMapping[mat] ?? defaultMaterial;
  };

  // Process primitives in order (later primitives override earlier)
  for (const primitive of scaledPrimitives) {
    const materialId = resolveMaterial(primitive.material);
    const builder = PRIMITIVE_BUILDERS[primitive.type];

    if (builder) {
      builder(primitive, setVoxel, materialId);
    } else {
      console.warn(`[voxelyn-ai] Unknown primitive type: ${primitive.type}, using box`);
      buildBox(primitive, setVoxel, materialId);
    }
  }

  return {
    data,
    width,
    height,
    depth,
    materialUsage,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

/**
 * Estimate voxel count without building (for previews).
 */
export function estimateVoxelCount(blueprint: ObjectBlueprint): number {
  let total = 0;

  for (const p of blueprint.primitives) {
    const [w, h, d] = p.size;
    const volume = w * h * d;

    // Rough multipliers for non-box shapes
    switch (p.type) {
      case 'box':
        total += volume;
        break;
      case 'cylinder':
        total += volume * 0.785; // π/4
        break;
      case 'sphere':
        total += volume * 0.524; // π/6
        break;
      case 'cone':
      case 'pyramid':
        total += volume * 0.333; // 1/3
        break;
      case 'arch':
        total += volume * 0.7;
        break;
      case 'torus':
        total += volume * 0.4;
        break;
      default:
        total += volume * 0.5;
    }
  }

  return Math.round(total);
}

/**
 * Get a 2D slice of the voxel data (for preview).
 */
export function getVoxelSlice(
  result: VoxelBuildResult,
  axis: 'x' | 'y' | 'z',
  position: number
): Uint16Array {
  const { data, width, height, depth } = result;

  switch (axis) {
    case 'y': {
      // Horizontal slice at y
      const slice = new Uint16Array(width * depth);
      const y = Math.min(position, height - 1);
      for (let z = 0; z < depth; z++) {
        for (let x = 0; x < width; x++) {
          slice[z * width + x] = data[x + y * width + z * width * height] ?? 0;
        }
      }
      return slice;
    }
    case 'x': {
      // Vertical slice at x
      const slice = new Uint16Array(depth * height);
      const x = Math.min(position, width - 1);
      for (let z = 0; z < depth; z++) {
        for (let y = 0; y < height; y++) {
          slice[z * height + y] = data[x + y * width + z * width * height] ?? 0;
        }
      }
      return slice;
    }
    case 'z': {
      // Vertical slice at z
      const slice = new Uint16Array(width * height);
      const z = Math.min(position, depth - 1);
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          slice[y * width + x] = data[x + y * width + z * width * height] ?? 0;
        }
      }
      return slice;
    }
  }
}
