// Presets de criacao de projeto: contrato de animacao da Art Bible e canvases
// canonicos (tools/validate.mjs CANONICAL). Para editar uma entidade existente
// o caminho certo e IMPORTAR o atlas real — ele traz anchor, hitbox e
// footprint assados; os presets servem para personagens novos.
import type { Project, SpriteAnimationDefinition } from './types';

// Ordem estavel de animacoes no atlas — espelho de ANIM_ORDER em
// packages/voxelyn-survival-content/tools/entities.mjs. O resolveFrame do jogo
// nao depende dessa ordem (usa frameMap), mas mante-la identica deixa os
// atlases do Studio byte-comparaveis aos do gerador.
export const ANIM_ORDER = [
  'idle',
  'walk',
  'attack',
  'special',
  'hit',
  'downed',
  'revive',
  'die',
  'fly',
  'burst',
] as const;

export const ALL_DIRS = ['dr', 'dl', 'ur', 'ul'] as const;

const LIVING: Record<string, SpriteAnimationDefinition> = {
  idle: { frames: 4, fps: 6, loop: true },
  walk: { frames: 6, fps: 10, loop: true },
  attack: { frames: 4, fps: 12, loop: false },
  hit: { frames: 2, fps: 12, loop: false },
  die: { frames: 5, fps: 10, loop: false },
};

export type Preset = {
  id: string;
  label: string;
  frameWidth: number;
  frameHeight: number;
  animations: Record<string, SpriteAnimationDefinition>;
  authoredDirs: string[];
  hint?: string;
};

export const PRESETS: Preset[] = [
  {
    id: 'humanoid',
    label: 'Humanoide (88×112, contrato do Prospector)',
    frameWidth: 88,
    frameHeight: 112,
    authoredDirs: [...ALL_DIRS],
    animations: {
      ...LIVING,
      downed: { frames: 4, fps: 6, loop: true },
      revive: { frames: 6, fps: 8, loop: false },
    },
  },
  {
    id: 'small',
    label: 'Criatura pequena (64×64)',
    frameWidth: 64,
    frameHeight: 64,
    authoredDirs: [...ALL_DIRS],
    animations: { ...LIVING },
  },
  {
    id: 'large',
    label: 'Criatura grande (96×136)',
    frameWidth: 96,
    frameHeight: 136,
    authoredDirs: [...ALL_DIRS],
    animations: { ...LIVING },
  },
  {
    id: 'boss',
    label: 'Chefe (112×128)',
    frameWidth: 112,
    frameHeight: 128,
    authoredDirs: [...ALL_DIRS],
    animations: {
      ...LIVING,
      special: { frames: 6, fps: 10, loop: false },
    },
  },
  {
    id: 'fx',
    label: 'FX (32×32, sem direcoes)',
    frameWidth: 32,
    frameHeight: 32,
    authoredDirs: ['dr'],
    animations: { burst: { frames: 6, fps: 15, loop: false } },
    hint: 'FX usam uma direcao unica e podem ocupar o frame inteiro.',
  },
  {
    id: 'custom',
    label: 'Personalizado…',
    frameWidth: 64,
    frameHeight: 64,
    authoredDirs: [...ALL_DIRS],
    animations: { ...LIVING },
  },
];

export const createProjectFromPreset = (
  preset: Preset,
  spriteId: string,
  name: string,
): Project => {
  const now = Date.now();
  return {
    key: `p${now.toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`,
    spriteId,
    name,
    version: 1,
    frameWidth: preset.frameWidth,
    frameHeight: preset.frameHeight,
    anchorX: Math.floor(preset.frameWidth / 2),
    anchorY: preset.frameHeight - 4,
    directions: 4,
    authoredDirs: [...preset.authoredDirs],
    flipPairs: {},
    hitbox: { w: 0.64, h: 0.6 },
    footprint: { w: 1, h: 1, offsetX: 0, offsetY: 0 },
    animations: structuredClone(preset.animations),
    frames: {},
    prompt: '',
    createdAt: now,
    updatedAt: now,
  };
};

/** Animacoes do projeto na ordem estavel do atlas (desconhecidas ao final). */
export const orderedAnims = (animations: Record<string, SpriteAnimationDefinition>): string[] => {
  const known = ANIM_ORDER.filter((a) => animations[a]);
  const extra = Object.keys(animations)
    .filter((a) => !(ANIM_ORDER as readonly string[]).includes(a))
    .sort();
  return [...known, ...extra];
};
