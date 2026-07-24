// Contrato de manifest de sprites (docs/art/voxelyn-survival-art-bible.md #9).
// Os manifests em JSON (assets/atlases/*.json) sao a fonte da verdade do layout;
// este modulo fornece os tipos e o resolvedor de frames.

export type SpriteAnimationDefinition = {
  frames: number;
  fps: number;
  loop: boolean;
};

export type SpriteManifestEntry = {
  id: string;
  version: number;
  atlas: string;
  frameWidth: number;
  frameHeight: number;
  anchorX: number;
  anchorY: number;
  directions: number;
  authoredDirs: string[];
  flipPairs: Record<string, string>;
  hitbox: { w: number; h: number };
  palette: string;
  paletteColors: string[];
  animations: Record<string, SpriteAnimationDefinition>;
  /** dir -> anim -> coluna inicial no atlas (linha unica). */
  frameMap: Record<string, Record<string, number>>;
  generation?: { tool: string; prompt: string; seedOrRef?: string };
};

export type FrameRect = {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
  flip: boolean;
};

/**
 * Direcao 4-way a partir de um vetor de facing (mundo). Retorna dr/dl/ur/ul.
 * Converte para espaco de tela iso (sdx = x-y, sdy = x+y) e classifica por
 * setor angular de 90deg centrado em cada direcao autorada:
 *   world +x -> dr, world +y -> dl, world -y -> ur, world -x -> ul.
 */
export const dirFromFacing = (fx: number, fy: number): string => {
  const sdx = fx - fy;
  const sdy = fx + fy;
  const a = Math.atan2(sdy, sdx); // -PI..PI
  if (a >= 0 && a < Math.PI / 2) return 'dr';
  if (a >= Math.PI / 2) return 'dl';
  if (a < -Math.PI / 2) return 'ul';
  return 'ur';
};

/** Resolve o retangulo-fonte de um frame no atlas, aplicando flip quando necessario. */
export const resolveFrame = (
  m: SpriteManifestEntry,
  anim: string,
  dir: string,
  frame: number
): FrameRect => {
  const useAnim = m.animations[anim] ? anim : Object.keys(m.animations)[0];
  const flip = Boolean(m.flipPairs[dir]);
  const srcDir = flip ? m.flipPairs[dir] : dir;
  const dirMap = m.frameMap[srcDir] ?? m.frameMap[m.authoredDirs[0]];
  const start = dirMap[useAnim] ?? dirMap[Object.keys(dirMap)[0]] ?? 0;
  const count = m.animations[useAnim]?.frames ?? 1;
  const f = ((frame % count) + count) % count;
  const col = start + f;
  return { sx: col * m.frameWidth, sy: 0, sw: m.frameWidth, sh: m.frameHeight, flip };
};

/** Frame atual em funcao do tempo (ms), respeitando fps e loop. */
export const frameAtTime = (
  m: SpriteManifestEntry,
  anim: string,
  elapsedMs: number
): number => {
  const def = m.animations[anim] ?? m.animations[Object.keys(m.animations)[0]];
  const idx = Math.floor((elapsedMs / 1000) * def.fps);
  return def.loop ? idx % def.frames : Math.min(idx, def.frames - 1);
};

export const FIRST_PACK_IDS = [
  'player-prospector',
  'enemy-stalker',
  'enemy-spitter',
  'fx-projectile-bolt',
  'fx-impact-burst',
] as const;
