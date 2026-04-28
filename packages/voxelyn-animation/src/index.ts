export type {
  AnimatedDrawCommand,
  AnimatedDrawOptions,
  AnimatedDrawResult,
  AnimatedDrawTarget,
  AnimationClip,
  AnimationFacing,
  AnimationFrameGenerator,
  AnimationFrameRef,
  AnimationIntent,
  AnimationPlayer,
  AnimationSet,
  AtlasSource,
  ImportedAnimationSet,
  IsoCamera,
  IsoDrawConfig,
  PixelSprite,
  ProceduralCharacter,
  ProceduralCharacterDef,
} from './types.js';

export {
  createAnimationPlayer,
  resetAnimation,
  stepAnimation,
  type CreateAnimationPlayerConfig,
} from './runtime/player.js';

export {
  acquireFrame,
  createFramePool,
  releaseFrame,
  type FramePool,
} from './runtime/frame-pool.js';

export {
  createProceduralCharacter,
  renderProceduralFrame,
} from './procedural/character.js';

export {
  resolveClip,
  type ResolvedClip,
} from './procedural/clip-fallback.js';

export {
  importAseprite,
} from './importers/aseprite.js';

export {
  importTexturePacker,
} from './importers/texturepacker.js';

export {
  sliceAtlasFrame,
  type AtlasFrameRect,
} from './importers/atlas-slice.js';

export {
  drawAnimatedIso,
  makeAnimatedDrawKey,
} from './integration/iso.js';

export {
  decodeBrowserAtlas,
  loadAtlasFromUrl,
} from './adapters/browser-atlas.js';

export {
  SPRITE_BY_ARCHETYPE,
  type SpriteArchetypeKey,
} from './sprite-archetype-map.js';

export {
  loadCharacterAtlas,
  type LoadOptions,
} from './sprite-atlas/load.js';

export {
  preloadCharacterAtlases,
} from './sprite-atlas/preload.js';

export {
  clearAllLoadedAtlasesForTest,
  getLoadedAtlas,
  setLoadedAtlas,
} from './sprite-atlas/cache.js';

export {
  setBrowserFetcher,
  setFetcherForTest,
  type AtlasFetcher,
  type DecodedImage,
} from './sprite-atlas/fetcher.js';

export {
  AtlasDecodeError,
  AtlasLoadError,
  AtlasMissingError,
} from './sprite-atlas/errors.js';

export type {
  AtlasManifest,
  ClipId as AtlasClipId,
  ClipManifest,
  FrameRect,
  LoadedAtlas,
  LoadedClip,
  LoadedFrame,
} from './sprite-atlas/types.js';

export {
  DIRECTIONS,
  toEngineFacing,
  type Direction,
} from './sprite-atlas/direction.js';
