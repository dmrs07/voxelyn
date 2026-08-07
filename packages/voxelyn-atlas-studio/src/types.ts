// Tipos do projeto do editor e do manifest de sprite.
// O manifest e ESPELHO do contrato em
// packages/voxelyn-survival-content/src/manifest.ts (SpriteManifestEntry):
// o que o Studio exporta e exatamente o que o SpriteBank do jogo carrega.
import type { PartOverrides } from './pose';

export type SpriteAnimationDefinition = {
  frames: number;
  fps: number;
  loop: boolean;
};

export type SpriteFootprint = {
  w: number;
  h: number;
  offsetX: number;
  offsetY: number;
};

export type SpriteManifestEntry = {
  id: string;
  version: number;
  atlas: string;
  frameWidth: number;
  frameHeight: number;
  columns?: number;
  anchorX: number;
  anchorY: number;
  directions: number;
  authoredDirs: string[];
  flipPairs: Record<string, string>;
  hitbox: { w: number; h: number };
  footprint: SpriteFootprint;
  palette: string;
  paletteColors: string[];
  animations: Record<string, SpriteAnimationDefinition>;
  frameMap: Record<string, Record<string, number>>;
  generation?: { tool: string; prompt: string; seedOrRef?: string };
};

/** Buffer RGBA de um frame; mesma forma do `grid` do gerador. */
export type Grid = { w: number; h: number; buf: Uint8Array };

/** Chave estavel de um frame dentro do projeto. */
export const frameKey = (dir: string, anim: string, index: number): string =>
  `${dir}/${anim}/${index}`;

export type Project = {
  /** id interno do editor (nao e o id do sprite). */
  key: string;
  /** id do sprite no jogo, ex.: `player-prospector`. */
  spriteId: string;
  name: string;
  version: number;
  frameWidth: number;
  frameHeight: number;
  anchorX: number;
  anchorY: number;
  directions: number;
  authoredDirs: string[];
  flipPairs: Record<string, string>;
  hitbox: { w: number; h: number };
  footprint: SpriteFootprint;
  animations: Record<string, SpriteAnimationDefinition>;
  /** frameKey -> RGBA (frameWidth*frameHeight*4). */
  frames: Record<string, Uint8Array>;
  /**
   * Modo de autoria. `pixel` desenha os frames direto; `voxel` monta um modelo
   * 3D por (animacao, frame) e ASSA os frames das quatro direcoes por rotacao
   * — o mesmo contrato do pipeline oficial. Ausente = pixel (projetos antigos).
   */
  mode?: 'pixel' | 'voxel';
  /** `${anim}/${frame}` -> modelo voxel (chave "x,y,z" -> material). */
  models?: Record<string, Record<string, string>>;
  /**
   * Correcoes do autor sobre a segmentacao automatica em partes (renomear um
   * membro, ou dizer que ele e corpo e nao deve se mexer). A segmentacao e
   * geometrica e acerta a maioria dos bichos; quando erra, quem manda e o
   * autor — e a IA passa a citar os nomes que ele escolheu.
   */
  partOverrides?: PartOverrides;
  prompt: string;
  createdAt: number;
  updatedAt: number;
};

/** Chave do modelo voxel de um frame (o modelo vale para as 4 direcoes). */
export const modelKey = (anim: string, index: number): string => `${anim}/${index}`;

export type ValidationIssue = {
  level: 'error' | 'warn';
  message: string;
};
