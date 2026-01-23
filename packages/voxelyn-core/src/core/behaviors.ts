/**
 * Material Behavior System
 * Programmable behaviors for custom materials
 */

import type { Material } from './palette';

// ============================================================================
// BEHAVIOR TYPES
// ============================================================================

/**
 * Behavior callback that modifies material properties based on context.
 * Used for dynamic material effects (burning, melting, growing, etc.)
 */
export type MaterialBehavior = (
  material: Material,
  context: BehaviorContext
) => Partial<Material>;

/**
 * Context provided to behavior callbacks.
 */
export type BehaviorContext = {
  x: number;
  y: number;
  z?: number;
  time: number; // Milliseconds since behavior started
  temperature?: number; // Local temperature
  pressure?: number; // Local pressure
  density?: number; // Local density
  humidity?: number; // Local humidity
  adjacentMaterials?: number[]; // Material IDs of adjacent cells
  /**
   * Volumetric neighbor sampler for 3D behaviors.
   * Use for local diffusion, reactions, or flow rules.
   */
  getNeighbors?: (query?: NeighborQuery) => NeighborSample[];
  iteration?: number; // Physics iteration count
};

export type NeighborQuery = {
  radius?: number;
  includeCenter?: boolean;
  mode?: 'moore' | 'von-neumann';
};

export type NeighborSample = {
  x: number;
  y: number;
  z: number;
  materialId: number;
  temperature?: number;
  pressure?: number;
  density?: number;
};

export type NeighborSampler = (x: number, y: number, z: number) => NeighborSample | null;

export type BehaviorContext3DOptions = {
  x: number;
  y: number;
  z: number;
  time: number;
  sampler: NeighborSampler;
  temperature?: number;
  pressure?: number;
  density?: number;
  humidity?: number;
  iteration?: number;
};

/**
 * Helper to construct a 3D behavior context with volumetric neighbors.
 */
export function createBehaviorContext3D(options: BehaviorContext3DOptions): BehaviorContext {
  const getNeighbors = (query: NeighborQuery = {}): NeighborSample[] => {
    const radius = Math.max(1, Math.floor(query.radius ?? 1));
    const includeCenter = query.includeCenter ?? false;
    const mode = query.mode ?? 'moore';
    const out: NeighborSample[] = [];

    for (let dz = -radius; dz <= radius; dz++) {
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          if (!includeCenter && dx === 0 && dy === 0 && dz === 0) continue;
          if (mode === 'von-neumann' && Math.abs(dx) + Math.abs(dy) + Math.abs(dz) > radius) continue;
          const sample = options.sampler(options.x + dx, options.y + dy, options.z + dz);
          if (sample) out.push(sample);
        }
      }
    }

    return out;
  };

  return {
    x: options.x,
    y: options.y,
    z: options.z,
    time: options.time,
    temperature: options.temperature,
    pressure: options.pressure,
    density: options.density,
    humidity: options.humidity,
    getNeighbors,
    iteration: options.iteration,
  };
}

/**
 * Predefined material behavior templates
 */
export const MaterialBehaviors = {
  /**
   * Burning/combustion behavior
   */
  burning: (_intensity: number = 1): MaterialBehavior => {
    return (material, context) => {
      const burnEffect = Math.sin(context.time * 0.01) * 0.2 + 0.8;
      return {
        color: Math.floor(material.color * burnEffect) >>> 0,
      };
    };
  },

  /**
   * Melting behavior - transitions material toward liquid state
   */
  melting: (
    meltTemp: number = 800,
    _liquidMaterial?: Material
  ): MaterialBehavior => {
    return (material, context) => {
      const temp = context.temperature ?? 0;
      if (temp > meltTemp) {
        const meltProgress = Math.min(1, (temp - meltTemp) / 400);
        return {
          isLiquid: meltProgress > 0.8,
          friction: material.friction * (1 - meltProgress * 0.5),
          density: material.density * (1 - meltProgress * 0.2),
        };
      }
      return {};
    };
  },

  /**
   * Growing behavior - expands and changes properties over time
   */
  growing: (growthRate: number = 0.1): MaterialBehavior => {
    return (material, context) => {
      const growth = Math.min(1, (context.time / 1000) * growthRate);
      return {
        density: material.density * (0.5 + growth * 0.5),
        flammable: growth > 0.5 ? material.flammable : false,
      };
    };
  },

  /**
   * Crystallization behavior - forms patterns over time
   */
  crystallizing: (rate: number = 1): MaterialBehavior => {
    return (material, context) => {
      const phase = (context.time * rate * 0.001) % 1;
      const brightness = 0.8 + Math.sin(phase * Math.PI * 2) * 0.2;
      return {
        color: Math.floor(material.color * brightness) >>> 0,
      };
    };
  },

  /**
   * Flowing behavior - spreads to adjacent cells (liquid-like)
   */
  flowing: (_flowForce: number = 0.5): MaterialBehavior => {
    return (material, _context) => {
      return {
        isLiquid: true,
        friction: material.friction * 0.1,
        density: material.density * 0.5,
      };
    };
  },

  /**
   * Dispersing behavior - spreads as gas
   */
  dispersing: (dispersalRate: number = 0.8): MaterialBehavior => {
    return (material, context) => {
      const dispersal = Math.max(0, 1 - (context.time / 1000) * dispersalRate);
      return {
        isGaseous: dispersal > 0.1,
        density: material.density * dispersal,
      };
    };
  },

  /**
   * Corroding behavior - slowly disappears over time
   */
  corroding: (corrosionRate: number = 0.5): MaterialBehavior => {
    return (material, context) => {
      const remaining = Math.max(0, 1 - (context.time / 1000) * corrosionRate);
      return {
        density: material.density * remaining,
        isTransparent: remaining < 0.5 ? true : material.isTransparent,
      };
    };
  },

  /**
   * Solidifying behavior - becomes harder over time
   */
  solidifying: (solidifyTime: number = 5000): MaterialBehavior => {
    return (material, context) => {
      const solidification = Math.min(1, context.time / solidifyTime);
      return {
        isLiquid: solidification < 0.5 ? material.isLiquid : false,
        density: material.density * (0.5 + solidification * 0.5),
        friction: material.friction * (0.5 + solidification * 0.5),
      };
    };
  },

  /**
   * Temperature-sensitive color change
   */
  thermochromic: (colors: number[]): MaterialBehavior => {
    return (material, context) => {
      const temp = Math.max(0, Math.min(1, (context.temperature ?? 300) / 1000));
      const colorIndex = Math.floor(temp * (colors.length - 1));
      return {
        color: colors[colorIndex],
      };
    };
  },

  /**
   * Reactive behavior - changes when adjacent to specific materials
   */
  reactive: (triggerMaterialIds: number[], result: Partial<Material>): MaterialBehavior => {
    return (material, context) => {
      const adjacent = context.adjacentMaterials ?? [];
      const hasReactant = triggerMaterialIds.some(id => adjacent.includes(id));
      return hasReactant ? result : {};
    };
  },
};

/**
 * Material behavior registry for tracking active behaviors.
 */
export class MaterialBehaviorRegistry {
  private behaviors: Map<string, MaterialBehavior[]> = new Map();

  /**
   * Register a behavior for a material type by ID
   */
  register(materialId: number, behavior: MaterialBehavior): void {
    const key = `mat_${materialId}`;
    if (!this.behaviors.has(key)) {
      this.behaviors.set(key, []);
    }
    this.behaviors.get(key)!.push(behavior);
  }

  /**
   * Apply all registered behaviors to a material
   */
  apply(material: Material, context: BehaviorContext): Material {
    const key = `mat_${material.id}`;
    const behaviorList = this.behaviors.get(key);

    if (!behaviorList || behaviorList.length === 0) {
      return material;
    }

    let modified = { ...material };
    for (const behavior of behaviorList) {
      const changes = behavior(modified, context);
      modified = { ...modified, ...changes };
    }

    return modified;
  }

  /**
   * Clear all behaviors
   */
  clear(): void {
    this.behaviors.clear();
  }

  /**
   * Get behavior count for a material
   */
  getBehaviorCount(materialId: number): number {
    const key = `mat_${materialId}`;
    return this.behaviors.get(key)?.length ?? 0;
  }
}

// ============================================================================
// CUSTOM MATERIAL FACTORY
// ============================================================================

/**
 * Configuration for creating a custom material
 */
export type CustomMaterialConfig = {
  id: number;
  name: string;
  color: number;
  density?: number;
  friction?: number;
  isLiquid?: boolean;
  isGas?: boolean;
  isGaseous?: boolean;
  isTransparent?: boolean;
  flammable?: boolean;
  isoHeight?: number;
  behaviors?: MaterialBehavior[];
  description?: string;
  category?: 'solid' | 'liquid' | 'gas' | 'exotic';
};

/**
 * Create a custom material with behaviors
 */
export function createCustomMaterial(config: CustomMaterialConfig): Material & { behaviors?: MaterialBehavior[] } {
  const material: Material & { behaviors?: MaterialBehavior[] } = {
    id: config.id,
    name: config.name,
    color: config.color,
    density: config.density ?? 50,
    friction: config.friction ?? 0.5,
    isLiquid: config.isLiquid ?? false,
    isGas: config.isGas ?? false,
    isGaseous: config.isGaseous ?? false,
    isTransparent: config.isTransparent ?? false,
    flammable: config.flammable ?? false,
    isoHeight: config.isoHeight,
    behaviors: config.behaviors,
  };
  return material;
}

/**
 * Preset custom materials with behaviors
 */
export const PresetCustomMaterials = {
  /**
   * Lava with burning and flowing behavior
   */
  lava: (id: number = 10): Material => {
    return createCustomMaterial({
      id,
      name: 'Lava',
      color: 0xFF6400FF, // Orange-red
      density: 60,
      friction: 0.1,
      isLiquid: true,
      flammable: true,
      category: 'liquid',
      behaviors: [
        MaterialBehaviors.burning(1.5),
        MaterialBehaviors.flowing(0.8),
      ],
    });
  },

  /**
   * Plant/foliage with growth behavior
   */
  plant: (id: number = 11): Material => {
    return createCustomMaterial({
      id,
      name: 'Plant',
      color: 0x228B22FF, // Forest green
      density: 40,
      friction: 0.6,
      flammable: true,
      isoHeight: 8,
      category: 'solid',
      behaviors: [
        MaterialBehaviors.growing(0.15),
      ],
    });
  },

  /**
   * Ice with melting behavior
   */
  ice: (id: number = 12): Material => {
    return createCustomMaterial({
      id,
      name: 'Ice',
      color: 0x87CEFAFF, // Sky blue
      density: 80,
      friction: 0.3,
      isTransparent: true,
      category: 'solid',
      behaviors: [
        MaterialBehaviors.melting(273, undefined), // Melts at ~0°C
      ],
    });
  },

  /**
   * Steam/gas with dispersing behavior
   */
  steam: (id: number = 13): Material => {
    return createCustomMaterial({
      id,
      name: 'Steam',
      color: 0xF0F8FFAA, // Alice blue, translucent
      density: 5,
      friction: 0.05,
      isGaseous: true,
      isTransparent: true,
      category: 'gas',
      behaviors: [
        MaterialBehaviors.dispersing(0.5),
      ],
    });
  },

  /**
   * Crystal with crystallizing behavior
   */
  crystal: (id: number = 14): Material => {
    return createCustomMaterial({
      id,
      name: 'Crystal',
      color: 0x9370DBFF, // Medium purple
      density: 90,
      friction: 0.7,
      isTransparent: true,
      isoHeight: 12,
      category: 'solid',
      behaviors: [
        MaterialBehaviors.crystallizing(2),
      ],
    });
  },

  /**
   * Acid with corroding behavior
   */
  acid: (id: number = 15): Material => {
    return createCustomMaterial({
      id,
      name: 'Acid',
      color: 0x00FF00BB, // Bright green, translucent
      density: 55,
      friction: 0.1,
      isLiquid: true,
      isTransparent: true,
      category: 'liquid',
      behaviors: [
        MaterialBehaviors.corroding(0.3),
        MaterialBehaviors.flowing(0.6),
      ],
    });
  },

  /**
   * Molten rock with solidifying behavior
   */
  magma: (id: number = 16): Material => {
    return createCustomMaterial({
      id,
      name: 'Magma',
      color: 0xFF4500FF, // Orange-red
      density: 70,
      friction: 0.15,
      isLiquid: true,
      flammable: true,
      category: 'liquid',
      behaviors: [
        MaterialBehaviors.solidifying(8000),
        MaterialBehaviors.flowing(0.5),
        MaterialBehaviors.burning(1.2),
      ],
    });
  },
};

/**
 * Create material with thermochromic (heat-sensitive color) behavior
 */
export function createThermochromicMaterial(
  id: number,
  name: string,
  colorGradient: number[],
  baseProps?: Partial<Material>
): Material {
  const defaultColor = colorGradient[0] ?? 0xffffffff;
  return createCustomMaterial({
    id,
    name,
    color: defaultColor,
    density: 50,
    friction: 0.5,
    ...baseProps,
    behaviors: [
      MaterialBehaviors.thermochromic(colorGradient),
    ],
  }) as Material;
}

/**
 * Create reactive material that changes when near other materials
 */
export function createReactiveMaterial(
  id: number,
  name: string,
  baseColor: number,
  triggerMaterialIds: number[],
  resultProps: Partial<Material>,
  baseProps?: Partial<Material>
): Material {
  return createCustomMaterial({
    id,
    name,
    color: baseColor,
    density: 50,
    friction: 0.5,
    ...baseProps,
    behaviors: [
      MaterialBehaviors.reactive(triggerMaterialIds, resultProps),
    ],
  }) as Material;
}

