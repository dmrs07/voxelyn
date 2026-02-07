import type { DrawCommand, Surface2D } from '@voxelyn/core';

export type PixelSprite = {
  width: number;
  height: number;
  pixels: Uint32Array;
};

export type AnimationFacing = 'dr' | 'dl' | 'ur' | 'ul';

export type AnimationIntent = 'idle' | 'move' | 'attack' | 'cast' | 'hit' | 'die';

export type AnimationFrameGenerator = (params: {
  out: PixelSprite;
  clipId: string;
  tMs: number;
  localTMs: number;
  frameIndex: number;
  facing: AnimationFacing;
  seed: number;
}) => PixelSprite;

export type AnimationClip = {
  id: string;
  fps: number;
  loop: boolean;
  lengthMs: number;
  generator: AnimationFrameGenerator;
};

export type AnimationSet = {
  idle?: AnimationClip;
  walk?: AnimationClip;
  attack?: AnimationClip;
  cast?: AnimationClip;
  hit?: AnimationClip;
  die?: AnimationClip;
  aliases?: Record<string, AnimationClip>;
};

export type AnimationFrameRef = {
  clipId: string;
  frameIndex: number;
  sprite: PixelSprite;
  localTMs: number;
};

export type AnimationPlayer = {
  clips: Record<string, AnimationClip>;
  currentClipId: string;
  elapsedMs: number;
  totalMs: number;
  seed: number;
  lastFacing: AnimationFacing;
  frame: PixelSprite;
  lockUntilEnd: boolean;
};

export type ProceduralCharacterDef = {
  id: string;
  seed?: number;
  width?: number;
  height?: number;
  palette?: Record<string, number>;
  style?: 'player' | 'stalker' | 'bruiser' | 'spitter' | 'guardian' | 'spore_bomber';
};

export type ProceduralCharacter = {
  id: string;
  seed: number;
  width: number;
  height: number;
  palette: Record<string, number>;
  style: NonNullable<ProceduralCharacterDef['style']>;
  clips: AnimationSet;
};

export type AtlasSource =
  | {
      width: number;
      height: number;
      pixels: Uint32Array;
    }
  | {
      width: number;
      height: number;
      data: Uint8Array | Uint8ClampedArray;
    };

export type ImportedAnimationSet = {
  source: 'aseprite' | 'texturepacker';
  set: AnimationSet;
  clipMap: Record<string, AnimationClip>;
};

export type IsoDrawConfig = {
  tileW: number;
  tileH: number;
  zStep: number;
};

export type IsoCamera = {
  x: number;
  y: number;
  originX?: number;
  originY?: number;
};

export type AnimatedDrawTarget = CanvasRenderingContext2D | Surface2D;

export type AnimatedDrawOptions = {
  scale?: number;
  colorkey?: number;
  alpha?: number;
  anchorX?: number;
  anchorY?: number;
};

export type AnimatedDrawResult = {
  sx: number;
  sy: number;
};

export type AnimatedDrawCommand = DrawCommand;
