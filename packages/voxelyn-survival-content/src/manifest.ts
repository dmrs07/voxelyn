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
  /**
   * MAPA DE FACES deste sprite, quando ha um: a normal por pixel, na mesma
   * grade de frames do atlas de arte.
   *
   * Vermelho e a face de topo, verde a da esquerda (+y do mundo) e azul a da
   * direita (+x) — exatamente um canal aceso por pixel. E o que permite a luz
   * do mundo bater no lado certo de um corpo em vez de banhar a silhueta
   * inteira com uma cor so.
   *
   * Opcional porque nem todo sprite tem: os FX EMITEM luz e nao a recebem, e um
   * mapa para eles seria memoria gasta para iluminar o que ja brilha. Ausente =
   * o cliente ilumina por silhueta, que continua correto.
   */
  normalAtlas?: string;
  /** Divisor de resolucao do mapa de faces (o atlas de arte dividido por ele). */
  normalScale?: number;
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
  // Chefes. O Guardiao e o Bispo ja estavam acima porque nasceram antes do
  // sistema de biomas; estes oito completam a tabela de `bossForBiome` — um
  // dono por estrato, mais o da ocupacao Aurix. Ate aqui eles desenhavam pelo
  // recuo do cliente, ou seja, chegavam ao setor final como um losango de cor.
  'enemy-diamandis',
  'enemy-white-devourer',
  // O CORPO do Devorador, uma peca por quadro.
  //
  // O prefixo `part-` e a razao de ele nao ser `enemy-`, e nao e cosmetica: a
  // validacao cobra de todo `enemy-`/`player-` o conjunto de animacoes de uma
  // CRIATURA (walk, attack, hit, die), e este atlas nao tem nenhuma delas nem
  // deveria. Ele nao e um bicho — sao os dez aneis que o cliente pendura no
  // rastro da cabeca (ver `devourer-spine.ts`), a simulacao nao tem entidade
  // nenhuma para eles, e a colisao continua sendo so a da cabeca. Os quadros
  // sao POSTOS na fila, do mais grosso ao mais fino, e nao instantes.
  'part-white-devourer-coil',
  // A NINHADA do Devorador. Mesmo prefixo e mesma razao: nao e um bicho com
  // repertorio, e uma peca com variantes. Os quadros sao (variante x fase) e o
  // cliente escolhe os dois eixos — a variante pelo id do filhote, a fase pelo
  // relogio.
  'part-devourer-brood',
  'enemy-archcantor',
  'enemy-sheet-leviathan',
  'enemy-lung-matrix',
  'enemy-furnace-heart',
  'enemy-frost-queen',
  'enemy-magnetarch',
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

/**
 * As camadas de MODULO, uma por peca acoplavel a arma.
 *
 * Sao atlas de camada como os tres do corpo: mesmo quadro, mesma ancora, mesmas
 * animacoes da arma. O cliente empilha os que o jogador tem instalados sobre o
 * Cravador — ou troca a arma inteira pela Minigun, que e a unica com a tag
 * `weapon` e por isso a unica que SUBSTITUI em vez de somar.
 *
 * A lista e literal em vez de derivada de `ModuleId` porque este pacote nao
 * depende da simulacao (ele so precisa de `@voxelyn/core`, e inverter isso
 * acoplaria o pipeline de arte ao balanceamento). Quem cobre a divergencia e um
 * teste do CLIENTE, que conhece os dois lados e exige um atlas por modulo.
 */
export const MODULE_LAYER_SPRITE_IDS = [
  'layer-module-piercing',
  'layer-module-explosive',
  'layer-module-conductive',
  'layer-module-return-disc',
  'layer-module-ricochet',
  'layer-module-siphon',
  'layer-module-minigun',
] as const;

/** O atlas de camada de um modulo, a partir do `ModuleId` da simulacao. */
export const moduleLayerSpriteId = (moduleId: string): string =>
  `layer-module-${moduleId.replace(/_/g, '-')}`;

export const FIRST_PACK_IDS = [
  ...MODULE_LAYER_SPRITE_IDS,
  ...CHARACTER_SPRITE_IDS,
  ...PLAYER_LAYER_SPRITE_IDS,
  'fx-projectile-bolt',
  'fx-impact-burst',
  'fx-seeker-drone',
  'fx-fire-cyclone',
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
 * ONDE FICA A BOCA DO CANO, em tiles de mundo, por arma montada.
 *
 * Tres numeros e nao um, e o que estava faltando eram os outros dois. A arma do
 * Prospector e montada no ombro DIREITO — nao no eixo do corpo —, e o tiro
 * nascia no centro do bot: um terco de tile ao lado da boca que visivelmente o
 * cuspia. A altura sozinha resolvia so a metade vertical do problema (o
 * estilhaco saia da barriga), e a metade lateral seguiu aberta ate agora.
 *
 * As tres medidas saem do CENTRO do voxel que acende no clarao, que e o voxel
 * que cospe. O teste do pacote acha esse voxel sozinho — e o unico que troca de
 * material entre `flash: false` e `flash: true` — e recalcula os tres numeros a
 * partir dele, entao mover o hardpoint no modelo cobra os valores aqui.
 *
 * POR ARMA porque a Minigun nao e o Cravador com outra pintura: ela substitui a
 * camada da arma e a boca dela fica quase um terco de tile mais a frente e mais
 * alta. Com um numero unico, trocar de arma deixava o tiro nascendo atras dos
 * canos — e era pior justamente na arma que dispara dezesseis vezes por
 * segundo, onde o erro aparece dezesseis vezes mais.
 *
 * Um tile tem oito voxels autorados; os denominadores estao a vista de
 * proposito, para o numero continuar legivel como posicao no modelo.
 */
export type MuzzleOffsetTiles = {
  /** Tiles a FRENTE do centro do bot, no eixo da mira. */
  forward: number;
  /**
   * Tiles a DIREITA da mira.
   *
   * Sempre positivo: a arma vive no ombro direito, e o bot vira o corpo para
   * onde mira — entao a boca esta sempre do mesmo lado da linha de tiro.
   */
  lateral: number;
  /** Tiles ACIMA do chao. */
  height: number;
};

export const PROSPECTOR_MUZZLES: Record<'bolt' | 'minigun', MuzzleOffsetTiles> = {
  bolt: { forward: 3.5 / 8, lateral: 3.5 / 8, height: 10.5 / 8 },
  minigun: { forward: 6 / 8, lateral: 4 / 8, height: 11 / 8 },
};

/**
 * Altura da boca do Cravador. Mantida por nome porque ela e o padrao de tudo o
 * que sai do jogador sem ser bala de Minigun — inclusive o drone, que nao tem
 * boca nenhuma e so precisa de uma altitude de cruzeiro coerente com a arma.
 */
export const PROSPECTOR_MUZZLE_HEIGHT_TILES = PROSPECTOR_MUZZLES.bolt.height;

/**
 * Quadro de `attack` em que a arma CUSPE.
 *
 * O clarao existe em UM quadro do atlas — um clarao que durasse a animacao
 * inteira viraria lanterna — e e neste quadro que a luz do disparo bate no
 * corpo. Publicado aqui para o cliente acender a armadura exatamente enquanto o
 * cano acende, e nao por um cronometro proprio que sairia de fase com a arte.
 */
export const PROSPECTOR_MUZZLE_FLASH_FRAME = 1;
