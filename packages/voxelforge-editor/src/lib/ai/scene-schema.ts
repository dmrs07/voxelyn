import type { TerrainGenSpec } from '@voxelyn/core';

export const terrainGenSpecSchema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: 'voxelforge.ai.terrainGenSpec',
  title: 'TerrainGenSpec',
  type: 'object',
  required: ['version', 'size', 'biomes', 'noise', 'heightCurves', 'layers'],
  additionalProperties: false,
  properties: {
    version: { type: 'number', const: 1 },
    name: { type: 'string' },
    seed: { type: 'number' },
    size: {
      type: 'object',
      required: ['width', 'height'],
      additionalProperties: false,
      properties: {
        width: { type: 'number', minimum: 1 },
        height: { type: 'number', minimum: 1 },
      },
    },
    biomes: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'object',
        required: ['id', 'label', 'color', 'materialIds'],
        additionalProperties: false,
        properties: {
          id: { type: 'string' },
          label: { type: 'string' },
          color: { type: 'string' },
          materialIds: { type: 'array', items: { type: 'string' }, minItems: 1 },
          heightRange: {
            type: 'array',
            minItems: 2,
            maxItems: 2,
            items: { type: 'number' },
          },
          moistureRange: {
            type: 'array',
            minItems: 2,
            maxItems: 2,
            items: { type: 'number' },
          },
        },
      },
    },
    noise: {
      type: 'object',
      required: ['baseFrequency', 'octaves', 'lacunarity', 'gain', 'warp', 'detailStrength'],
      additionalProperties: false,
      properties: {
        baseFrequency: { type: 'number', minimum: 0 },
        octaves: { type: 'number', minimum: 1 },
        lacunarity: { type: 'number', minimum: 1 },
        gain: { type: 'number', minimum: 0 },
        warp: { type: 'number', minimum: 0 },
        detailStrength: { type: 'number', minimum: 0 },
      },
    },
    heightCurves: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'object',
        required: ['id', 'points'],
        additionalProperties: false,
        properties: {
          id: { type: 'string' },
          points: {
            type: 'array',
            minItems: 2,
            items: {
              type: 'object',
              required: ['x', 'y'],
              additionalProperties: false,
              properties: {
                x: { type: 'number' },
                y: { type: 'number' },
              },
            },
          },
        },
      },
    },
    layers: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'object',
        required: ['id', 'biomeId', 'materialId', 'minHeight', 'maxHeight'],
        additionalProperties: false,
        properties: {
          id: { type: 'string' },
          biomeId: { type: 'string' },
          materialId: { type: 'string' },
          minHeight: { type: 'number' },
          maxHeight: { type: 'number' },
          slopeLimit: { type: 'number' },
        },
      },
    },
    images: {
      type: 'object',
      additionalProperties: false,
      properties: {
        heightmap: { type: 'string' },
        biomeMask: { type: 'string' },
        detailNoise: { type: 'string' },
      },
    },
  },
} as const;

export type TerrainSpecValidation =
  | { ok: true }
  | { ok: false; errors: string[] };

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

export const validateTerrainGenSpec = (spec: TerrainGenSpec): TerrainSpecValidation => {
  const errors: string[] = [];

  if (spec.version !== 1) {
    errors.push('version must be 1');
  }

  if (!isFiniteNumber(spec.size.width) || spec.size.width <= 0) {
    errors.push('size.width must be a positive number');
  }

  if (!isFiniteNumber(spec.size.height) || spec.size.height <= 0) {
    errors.push('size.height must be a positive number');
  }

  if (!spec.biomes.length) {
    errors.push('biomes must have at least one entry');
  }

  for (const biome of spec.biomes) {
    if (!biome.id || !biome.label) {
      errors.push('biome entries require id and label');
    }
    if (!biome.materialIds?.length) {
      errors.push(`biome ${biome.id || 'unknown'} must define materialIds`);
    }
  }

  const noise = spec.noise;
  if (!isFiniteNumber(noise.baseFrequency) || noise.baseFrequency <= 0) {
    errors.push('noise.baseFrequency must be > 0');
  }
  if (!isFiniteNumber(noise.octaves) || noise.octaves < 1) {
    errors.push('noise.octaves must be >= 1');
  }
  if (!isFiniteNumber(noise.lacunarity) || noise.lacunarity < 1) {
    errors.push('noise.lacunarity must be >= 1');
  }
  if (!isFiniteNumber(noise.gain) || noise.gain <= 0) {
    errors.push('noise.gain must be > 0');
  }
  if (!isFiniteNumber(noise.detailStrength) || noise.detailStrength < 0) {
    errors.push('noise.detailStrength must be >= 0');
  }

  if (!spec.heightCurves.length) {
    errors.push('heightCurves must have at least one entry');
  }
  for (const curve of spec.heightCurves) {
    if (!curve.id || curve.points.length < 2) {
      errors.push('each height curve must have an id and at least 2 points');
      continue;
    }
    for (const point of curve.points) {
      if (!isFiniteNumber(point.x) || !isFiniteNumber(point.y)) {
        errors.push(`height curve ${curve.id} has invalid point values`);
        break;
      }
    }
  }

  if (!spec.layers.length) {
    errors.push('layers must have at least one entry');
  }

  const biomeIds = new Set(spec.biomes.map((biome) => biome.id));
  for (const layer of spec.layers) {
    if (!layer.id || !layer.materialId) {
      errors.push('layers require id and materialId');
    }
    if (!biomeIds.has(layer.biomeId)) {
      errors.push(`layer ${layer.id || 'unknown'} references unknown biomeId`);
    }
    if (!isFiniteNumber(layer.minHeight) || !isFiniteNumber(layer.maxHeight)) {
      errors.push(`layer ${layer.id || 'unknown'} must define minHeight and maxHeight`);
    } else if (layer.minHeight > layer.maxHeight) {
      errors.push(`layer ${layer.id || 'unknown'} minHeight cannot exceed maxHeight`);
    }
  }

  if (spec.images) {
    for (const key of Object.keys(spec.images)) {
      const value = spec.images[key as keyof typeof spec.images];
      if (value !== undefined && typeof value !== 'string') {
        errors.push(`images.${key} must be a string if provided`);
      }
    }
  }

  return errors.length ? { ok: false, errors } : { ok: true };
};

export const createDefaultTerrainGenSpec = (width: number, height: number): TerrainGenSpec => ({
  version: 1,
  name: 'Default Terrain',
  size: { width, height },
  seed: 1337,
  biomes: [
    {
      id: 'ocean',
      label: 'Ocean',
      color: '#1b4f99',
      materialIds: ['Water', 'Sand'],
      heightRange: [0, 0.3],
    },
    {
      id: 'shore',
      label: 'Shore',
      color: '#c2b280',
      materialIds: ['Sand', 'Dirt'],
      heightRange: [0.3, 0.45],
    },
    {
      id: 'lowlands',
      label: 'Lowlands',
      color: '#3a7d44',
      materialIds: ['Grass', 'Dirt'],
      heightRange: [0.45, 0.7],
    },
    {
      id: 'highlands',
      label: 'Highlands',
      color: '#7f7f7f',
      materialIds: ['Stone', 'Grass'],
      heightRange: [0.7, 1],
    },
  ],
  noise: {
    baseFrequency: 0.035,
    octaves: 4,
    lacunarity: 2,
    gain: 0.5,
    warp: 0.2,
    detailStrength: 0.08,
  },
  heightCurves: [
    {
      id: 'continentalness',
      points: [
        { x: 0, y: 0 },
        { x: 0.5, y: 0.6 },
        { x: 1, y: 1 },
      ],
    },
  ],
  layers: [
    {
      id: 'ocean-water',
      biomeId: 'ocean',
      materialId: 'Water',
      minHeight: 0,
      maxHeight: 0.28,
    },
    {
      id: 'ocean-sand',
      biomeId: 'ocean',
      materialId: 'Sand',
      minHeight: 0.28,
      maxHeight: 0.35,
    },
    {
      id: 'shore-sand',
      biomeId: 'shore',
      materialId: 'Sand',
      minHeight: 0.3,
      maxHeight: 0.5,
    },
    {
      id: 'lowlands-grass',
      biomeId: 'lowlands',
      materialId: 'Grass',
      minHeight: 0.45,
      maxHeight: 0.7,
    },
    {
      id: 'highlands-stone',
      biomeId: 'highlands',
      materialId: 'Stone',
      minHeight: 0.7,
      maxHeight: 1,
    },
  ],
});
