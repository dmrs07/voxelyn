// Runtime contract for generated Voxelyn Survival sprite manifests.
export type SpriteAnimationDefinition = {
  frames: number;
  fps: number;
  loop: boolean;
};

export type SpriteFootprint = {
  /** Occupied width and height in logical isometric tiles. */
  w: number;
  h: number;
  /** Offset, in logical tiles, from the visual anchor to footprint center. */
  offsetX: number;
  offsetY: number;
};

export type SpriteManifestEntry = {
  id: string;
  version: number;
  atlas: string;
  frameWidth: number;
  /** Frames por linha do atlas. Ausente = linha unica (formato antigo). */
  columns?: number;
  frameHeight: number;
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
  /** dir -> anim -> starting column in the stable, single-row atlas. */
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

/** Map a world-space facing vector to one of the four authored isometric facings. */
export const dirFromFacing = (fx: number, fy: number): string => {
  const sdx = fx - fy;
  const sdy = fx + fy;
  const angle = Math.atan2(sdy, sdx);
  if (angle >= 0 && angle < Math.PI / 2) return 'dr';
  if (angle >= Math.PI / 2) return 'dl';
  if (angle < -Math.PI / 2) return 'ul';
  return 'ur';
};

export const resolveFrame = (
  manifest: SpriteManifestEntry,
  animation: string,
  direction: string,
  frame: number
): FrameRect => {
  const useAnim = manifest.animations[animation] ? animation : Object.keys(manifest.animations)[0];
  const flip = Boolean(manifest.flipPairs[direction]);
  const sourceDirection = flip ? manifest.flipPairs[direction] : direction;
  const dirMap = manifest.frameMap[sourceDirection] ?? manifest.frameMap[manifest.authoredDirs[0]];
  const start = dirMap[useAnim] ?? dirMap[Object.keys(dirMap)[0]] ?? 0;
  const count = manifest.animations[useAnim]?.frames ?? 1;
  const normalized = ((frame % count) + count) % count;
  // Atlas pode ter varias LINHAS: um sheet de linha unica estourava o limite de
  // 4096px de largura de textura (real em GPU mobile) assim que os frames
  // cresceram. `columns` diz quantos frames cabem por linha.
  const index = start + normalized;
  const columns = manifest.columns ?? Number.MAX_SAFE_INTEGER;
  return {
    sx: (index % columns) * manifest.frameWidth,
    sy: Math.floor(index / columns) * manifest.frameHeight,
    sw: manifest.frameWidth,
    sh: manifest.frameHeight,
    flip,
  };
};

export const frameAtTime = (
  manifest: SpriteManifestEntry,
  animation: string,
  elapsedMs: number
): number => {
  const def = manifest.animations[animation] ?? manifest.animations[Object.keys(manifest.animations)[0]];
  const index = Math.floor((Math.max(0, elapsedMs) / 1000) * def.fps);
  return def.loop ? index % def.frames : Math.min(index, def.frames - 1);
};

export const CHARACTER_SPRITE_IDS = [
  'player-prospector',
  'enemy-stalker',
  'enemy-spitter',
  'enemy-spore-bomber',
  'enemy-bruiser',
  'enemy-guardian',
  'enemy-bishop',
  'enemy-fungal-horse',
  'enemy-miner',
] as const;

export const PLAYER_LAYER_SPRITE_IDS = [
  'layer-player-prospector-lower',
  'layer-player-prospector-upper',
  // A arma e camada propria porque precisa mudar de cor sozinha: o calor do cano
  // e uma mecanica da simulacao, e pinta-lo exige um atlas que nao carregue
  // nenhum pixel do corpo junto.
  'layer-player-prospector-gun',
] as const;

export const FIRST_PACK_IDS = [
  ...CHARACTER_SPRITE_IDS,
  ...PLAYER_LAYER_SPRITE_IDS,
  'fx-projectile-bolt',
  'fx-impact-burst',
] as const;

/**
 * Distancia que o Prospector percorre num ciclo completo de caminhada, em tiles.
 *
 * Este e o CONTRATO entre a animacao e a simulacao, e existe porque as duas
 * vivem em pacotes que nao se enxergam: o pipeline de arte so depende de
 * `@voxelyn/core`, e inverter essa dependencia para ler `PLAYER_SPEED` acoplaria
 * a geracao de sprites ao balanceamento.
 *
 * O ciclo tem de durar exatamente o tempo que o personagem leva para cobrir esta
 * distancia. Fora disso o pe patina — para a frente se a animacao for lenta
 * demais, para tras se for rapida demais. O valor sai da passada AUTORADA no
 * gerador (`tools/prospector.mjs`), e ha um teste de cada lado: um conferindo
 * que o gerador continua autorando esta passada, e outro conferindo que o `fps`
 * assado no atlas casa com a velocidade real do jogador.
 */
export const PROSPECTOR_WALK_CYCLE_TILES = 1.5;
