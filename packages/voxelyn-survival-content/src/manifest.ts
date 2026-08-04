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
  // Bestiario de assinatura: um por estrato (leva 3 do sistema de biomas).
  'enemy-resonant',
  'enemy-mud-lamprey',
  'enemy-bellows',
  'enemy-scoriac',
  'enemy-frost-wraith',
  // Fauna afinada por bioma: o bombardeiro que a Fenda e a Fornalha usam no
  // lugar do de esporos, e o Coveiro do Ferrifero.
  'enemy-sulfur-bomber',
  'enemy-undertaker',
] as const;

export const PLAYER_LAYER_SPRITE_IDS = [
  'layer-player-prospector-lower',
  'layer-player-prospector-upper',
  // A arma e camada propria porque precisa mudar de cor sozinha: o calor do cano
  // e uma mecanica da simulacao, e pinta-lo exige um atlas que nao carregue
  // nenhum pixel do corpo junto.
  'layer-player-prospector-gun',
] as const;

/**
 * Direcoes em que a ARMA fica ATRAS do tronco.
 *
 * Separar a arma numa camada custou a profundidade entre ela e o corpo: dentro
 * de um mesmo modelo o rasterizador ordena voxel a voxel pela chave do pintor,
 * mas entre dois atlas so existe a ordem em que o cliente desenha os dois. Com a
 * arma sempre por cima, o cravador aparecia colado no peito nas tres direcoes em
 * que ele esta do lado OPOSTO ao da camera — atravessando o chassi que deveria
 * escondê-lo.
 *
 * A lista nao e opiniao: ela e a maioria dos pixels disputados entre as duas
 * camadas na ordem de profundidade do modelo INTEIRO, e o teste do pacote de
 * conteudo recalcula isso a partir dos voxels a cada rodada. Mexeu na montagem
 * da arma ou na rotacao das direcoes, o teste diz qual direcao trocou de lado.
 *
 * `dr` fica de fora com folga pequena — nessa direcao a arma esta na quina do
 * corpo, meio a frente e meio atras, e nenhuma das duas ordens acerta tudo. Fora
 * dela o veredito e quase unanime (85% a 100% dos pixels).
 */
export const PLAYER_GUN_BEHIND_DIRS: readonly string[] = ['dl', 'ur', 'ul'];

/** A arma deste rumo e desenhada antes do tronco, para o chassi ocultá-la. */
export const gunBehindUpper = (facingX: number, facingY: number): boolean =>
  PLAYER_GUN_BEHIND_DIRS.includes(dirFromFacing(facingX, facingY));

export const FIRST_PACK_IDS = [
  ...CHARACTER_SPRITE_IDS,
  ...PLAYER_LAYER_SPRITE_IDS,
  'fx-projectile-bolt',
  'fx-impact-burst',
  'fx-seeker-drone',
] as const;

/**
 * Cores da paleta mestra que EMITEM luz.
 *
 * Fonte unica, consumida por dois lados que nao podem discordar. O rasterizador
 * usa para isentar essas cores da oclusao de ambiente — escurecer uma luz no
 * fundo de uma fresta apagaria justamente o ponto que o jogador usa para achar a
 * criatura no breu. O cliente usa para saber quais pixels do atlas recebem halo.
 *
 * Divergindo as duas listas, um material ficaria isento de sombra sem brilhar,
 * ou brilharia recebendo sombra — e nenhum dos dois erros apareceria em teste,
 * so no escuro.
 *
 * Ouro (`loot`) e branco (`player`) NAO estao aqui: sao materiais, nao fontes.
 * Casco, fivela, minerio e o baculo do Bispo sao de ouro, e um baculo que brilha
 * promete uma mecanica que nao existe. O que precisa mesmo emitir tem material
 * proprio — `amber` para brasa e `beam` para lampada acesa —, e e por eles que o
 * farol do Prospector acende sem arrastar todo o ouro do jogo junto.
 */
export const EMISSIVE_HEX = [
  '#59f2c2', // biolum
  '#7ab8ff', // electric
  '#ff7a2f', // fire
  '#a8e63c', // acid
  '#ffa63f', // amber
  '#ffe9b8', // beam
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

/**
 * Altura da BOCA DO CANO, em tiles de mundo.
 *
 * O tiro do jogador saia da mesma altura que o cuspe de um bicho rasteiro —
 * meio tile, na barriga do bot — e por isso nascia atravessando o proprio
 * chassi em vez de sair da arma. A altura de voo do estilhaco e puramente
 * visual (a colisao acontece no plano do chao), entao ela pode e deve ser a
 * altura de onde a peca esta montada no modelo.
 *
 * Um tile tem oito voxels de lado e a boca do cano esta montada a dez voxels do
 * chao. O teste do pacote de conteudo acha essa boca sozinho — e o voxel da arma
 * que troca de material quando o clarao acende — e recalcula a altura a partir
 * dela, entao mover o hardpoint no modelo cobra o numero aqui.
 */
export const PROSPECTOR_MUZZLE_HEIGHT_TILES = 10 / 8;

/**
 * Quadro de `attack` em que a arma CUSPE.
 *
 * O clarao existe em UM quadro do atlas — um clarao que durasse a animacao
 * inteira viraria lanterna — e e neste quadro que a luz do disparo bate no
 * corpo. Publicado aqui para o cliente acender a armadura exatamente enquanto o
 * cano acende, e nao por um cronometro proprio que sairia de fase com a arte.
 */
export const PROSPECTOR_MUZZLE_FLASH_FRAME = 1;
