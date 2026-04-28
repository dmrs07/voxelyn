export type AuthoredGrid = number[][];

export type AuthoredFacingSet = {
  DR: AuthoredGrid;
  DL: AuthoredGrid;
  UR: AuthoredGrid;
  UL: AuthoredGrid;
};

export type AuthoredFrame = {
  pose: string;
  dur: number;
  tx?: number;
  ty?: number;
  sx?: number;
  sy?: number;
  alpha?: number;
  tint?: number;
  tag?: string;
};

export type AuthoredState = {
  loop: boolean;
  frames: AuthoredFrame[];
};

export type AuthoredClipId = 'idle' | 'walk' | 'attack' | 'hit' | 'die';

export type AuthoredSpriteDef = {
  name: string;
  id: string;
  width: number;
  height: number;
  palette: number[];
  poses: Record<string, AuthoredGrid>;
  states: Record<AuthoredClipId, AuthoredState>;
};
