import type { ViewMode } from '$lib/document/types';

export type Vec3 = [number, number, number];

export type WorldTransform = {
  position: Vec3;
  rotation: Vec3;
  scale: Vec3;
};

export type WorldItemType = 'scene' | 'asset';

export type WorldItem = {
  id: string;
  type: WorldItemType;
  sourceRef: string;
  transform: WorldTransform;
  meta: {
    width?: number;
    height?: number;
    depth?: number;
    [key: string]: unknown;
  };
};

export type WorldHero = {
  itemId?: string;
  spawn: Vec3;
  collision: 'aabb' | 'off';
};

export type WorldComposerSettings = {
  snapEnabled: boolean;
  snapSize: number;
  snapFromMeta: boolean;
  rotationStepDeg: number;
  space: 'world' | 'local';
};

export type WorldFile = {
  worldVersion: 1;
  viewMode: ViewMode;
  items: WorldItem[];
  hero: WorldHero;
  composer: WorldComposerSettings;
};

export type GeneratedMapArtifact = {
  mapVersion: 1;
  generatedAt: string;
  sourceWorld: string;
  viewMode: ViewMode;
  hero: WorldHero;
  items: Array<{
    id: string;
    type: WorldItemType;
    sourceRef: string;
    transform: WorldTransform;
    meta: WorldItem['meta'];
    exists: boolean;
  }>;
  errors: string[];
};
