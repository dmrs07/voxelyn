import type { CharacterSpec } from './types.js';

const ENEMY_CLIPS = (attackMs: number, attackIntent: string): CharacterSpec['clips'] => ({
  idle: { frames: 6, durationMs: 1000, loop: true, intent: 'breathing idle stance' },
  walk: { frames: 8, durationMs: 760, loop: true, intent: 'walk cycle on ground' },
  attack: { frames: 8, durationMs: attackMs, loop: false, intent: attackIntent },
  hit: { frames: 4, durationMs: 220, loop: false, intent: 'recoil flinch' },
  die: { frames: 8, durationMs: 980, loop: false, intent: 'collapse and dissolve' },
});

export const CHARACTERS: CharacterSpec[] = [
  {
    id: 'excavator',
    runtimeArchetype: 'player',
    displayName: 'Excavator',
    conceptArtPath: 'assets/concepts/characters/excavator.png',
    basePrompt:
      'small white-and-yellow excavator robot, antenna with blue tip, blue-glowing chest core, holding a yellow heavy-duty hauling tube around the waist',
    styleNotes:
      'isometric 3/4 view, 3/4-down camera, foot-anchored, Diablo-style perspective, transparent background, crisp pixel art',
    size: 48,
    directions: ['DR', 'DL', 'UR', 'UL'],
    anchor: { x: 24, y: 43 },
    clips: {
      idle: { frames: 8, durationMs: 1100, loop: true, intent: 'subtle robotic idle, antenna sway' },
      walk: { frames: 12, durationMs: 720, loop: true, intent: 'walk cycle on ground' },
      attack: { frames: 10, durationMs: 360, loop: false, intent: 'tool swing forward attack' },
      cast: { frames: 10, durationMs: 600, loop: false, intent: 'channel energy from chest core' },
      hit: { frames: 4, durationMs: 220, loop: false, intent: 'recoil flinch' },
      die: { frames: 10, durationMs: 1100, loop: false, intent: 'fall apart and power down' },
    },
  },
  {
    id: 'striker',
    runtimeArchetype: 'stalker',
    displayName: 'Striker',
    conceptArtPath: 'assets/concepts/characters/striker.png',
    basePrompt: 'agile crimson reptilian humanoid with claws and a flame-blade right arm',
    styleNotes:
      'isometric 3/4 view, foot-anchored, Diablo-style perspective, transparent background, crisp pixel art',
    size: 48,
    directions: ['DR', 'DL', 'UR', 'UL'],
    anchor: { x: 24, y: 43 },
    clips: ENEMY_CLIPS(310, 'fast lunging slash with flame blade'),
  },
  {
    id: 'bruiser',
    runtimeArchetype: 'bruiser',
    displayName: 'Bruiser',
    conceptArtPath: 'assets/concepts/characters/bruiser.png',
    basePrompt: 'massive purple muscle hulk with stone helm and stone shoulder plates',
    styleNotes:
      'isometric 3/4 view, foot-anchored, Diablo-style perspective, transparent background, crisp pixel art',
    size: 48,
    directions: ['DR', 'DL', 'UR', 'UL'],
    anchor: { x: 24, y: 43 },
    clips: ENEMY_CLIPS(680, 'heavy two-fisted ground smash'),
  },
  {
    id: 'spitter',
    runtimeArchetype: 'spitter',
    displayName: 'Spitter',
    conceptArtPath: 'assets/concepts/characters/spitter.png',
    basePrompt: 'frail green amphibian humanoid with bulbous eyes and dripping mouth',
    styleNotes:
      'isometric 3/4 view, foot-anchored, Diablo-style perspective, transparent background, crisp pixel art',
    size: 48,
    directions: ['DR', 'DL', 'UR', 'UL'],
    anchor: { x: 24, y: 43 },
    clips: ENEMY_CLIPS(470, 'lean back and spit acid forward'),
  },
  {
    id: 'spore_bomber',
    runtimeArchetype: 'spore_bomber',
    displayName: 'Spore Bomber',
    conceptArtPath: 'assets/concepts/characters/spore_bomber.png',
    basePrompt:
      'bulbous purple-cloaked fungal creature cradling a glowing spore orb, single yellow eye',
    styleNotes:
      'isometric 3/4 view, foot-anchored, Diablo-style perspective, transparent background, crisp pixel art',
    size: 48,
    directions: ['DR', 'DL', 'UR', 'UL'],
    anchor: { x: 24, y: 43 },
    clips: ENEMY_CLIPS(580, 'inflate then hurl glowing spore orb'),
  },
  {
    id: 'guardian',
    runtimeArchetype: 'guardian',
    displayName: 'Guardian',
    conceptArtPath: 'assets/concepts/characters/guardian.png',
    basePrompt: 'tall purple-and-stone armored colossus with crystal core and clawed gauntlets',
    styleNotes:
      'isometric 3/4 view, foot-anchored, Diablo-style perspective, transparent background, crisp pixel art',
    size: 48,
    directions: ['DR', 'DL', 'UR', 'UL'],
    anchor: { x: 24, y: 43 },
    clips: ENEMY_CLIPS(750, 'shield bash with armored forearm'),
  },
];
