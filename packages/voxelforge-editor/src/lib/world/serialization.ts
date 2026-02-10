import type { ViewMode } from '$lib/document/types';
import type { Vec3, WorldFile, WorldItem, WorldTransform } from './types';

const clampNumber = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;

const normalizeVec3 = (value: unknown, fallback: Vec3): Vec3 => {
  if (!Array.isArray(value) || value.length < 3) return fallback;
  return [
    clampNumber(value[0], fallback[0]),
    clampNumber(value[1], fallback[1]),
    clampNumber(value[2], fallback[2]),
  ];
};

const normalizeTransform = (value: unknown): WorldTransform => {
  const source = typeof value === 'object' && value !== null ? (value as Partial<WorldTransform>) : {};
  return {
    position: normalizeVec3(source.position, [0, 0, 0]),
    rotation: normalizeVec3(source.rotation, [0, 0, 0]),
    scale: normalizeVec3(source.scale, [1, 1, 1]),
  };
};

const isViewMode = (value: unknown): value is ViewMode => value === '2d' || value === 'iso' || value === '3d';

export const createDefaultWorldFile = (viewMode: ViewMode = '3d'): WorldFile => ({
  worldVersion: 1,
  viewMode,
  items: [],
  hero: {
    spawn: [0, 0, 0],
    collision: 'aabb',
  },
  composer: {
    snapEnabled: true,
    snapSize: 1,
    snapFromMeta: true,
    rotationStepDeg: 15,
    space: 'world',
  },
});

export const parseWorldFile = (raw: unknown): WorldFile => {
  if (!raw || typeof raw !== 'object') {
    return createDefaultWorldFile();
  }
  const input = raw as Record<string, unknown>;
  const base = createDefaultWorldFile(isViewMode(input.viewMode) ? input.viewMode : '3d');

  if (input.worldVersion !== 1) {
    return base;
  }

  const itemsRaw = Array.isArray(input.items) ? input.items : [];
  const items: WorldItem[] = itemsRaw
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null;
      const source = entry as Record<string, unknown>;
      const id = typeof source.id === 'string' && source.id.trim().length > 0 ? source.id : null;
      const type = source.type === 'scene' || source.type === 'asset' ? source.type : null;
      const sourceRef =
        typeof source.sourceRef === 'string' && source.sourceRef.trim().length > 0
          ? source.sourceRef.replace(/\\/g, '/')
          : null;
      if (!id || !type || !sourceRef) return null;
      return {
        id,
        type,
        sourceRef,
        transform: normalizeTransform(source.transform),
        meta: typeof source.meta === 'object' && source.meta !== null ? (source.meta as WorldItem['meta']) : {},
      };
    })
    .filter((entry): entry is WorldItem => Boolean(entry));

  const heroRaw = input.hero;
  const hero =
    typeof heroRaw === 'object' && heroRaw !== null
      ? {
          itemId: typeof (heroRaw as { itemId?: unknown }).itemId === 'string' ? (heroRaw as { itemId: string }).itemId : undefined,
          spawn: normalizeVec3((heroRaw as { spawn?: unknown }).spawn, base.hero.spawn),
          collision:
            (heroRaw as { collision?: unknown }).collision === 'off'
              ? 'off'
              : base.hero.collision,
        }
      : base.hero;

  const composerRaw = input.composer;
  const composer =
    typeof composerRaw === 'object' && composerRaw !== null
      ? {
          snapEnabled:
            typeof (composerRaw as { snapEnabled?: unknown }).snapEnabled === 'boolean'
              ? (composerRaw as { snapEnabled: boolean }).snapEnabled
              : base.composer.snapEnabled,
          snapSize: Math.max(0.01, clampNumber((composerRaw as { snapSize?: unknown }).snapSize, base.composer.snapSize)),
          snapFromMeta:
            typeof (composerRaw as { snapFromMeta?: unknown }).snapFromMeta === 'boolean'
              ? (composerRaw as { snapFromMeta: boolean }).snapFromMeta
              : base.composer.snapFromMeta,
          rotationStepDeg: Math.max(
            1,
            Math.min(360, Math.round(clampNumber((composerRaw as { rotationStepDeg?: unknown }).rotationStepDeg, base.composer.rotationStepDeg)))
          ),
          space: (composerRaw as { space?: unknown }).space === 'local' ? 'local' : 'world',
        }
      : base.composer;

  return {
    worldVersion: 1,
    viewMode: isViewMode(input.viewMode) ? input.viewMode : base.viewMode,
    items,
    hero,
    composer,
  };
};

export const serializeWorldFile = (world: WorldFile): string => JSON.stringify(world, null, 2);
