export type ClipId = 'idle' | 'walk' | 'attack' | 'cast' | 'hit' | 'die';

export type RuntimeArchetype =
  | 'player'
  | 'stalker'
  | 'bruiser'
  | 'spitter'
  | 'guardian'
  | 'spore_bomber';

export type CharacterClipSpec = {
  frames: number;
  durationMs: number;
  loop: boolean;
  intent: string;
};

export type CharacterSpec = {
  id: string;
  runtimeArchetype: RuntimeArchetype;
  displayName: string;
  conceptArtPath: string;
  basePrompt: string;
  styleNotes: string;
  size: 48;
  directions: ['DR', 'DL', 'UR', 'UL'];
  anchor: { x: 24; y: 43 };
  clips: Partial<Record<ClipId, CharacterClipSpec>>;
};
