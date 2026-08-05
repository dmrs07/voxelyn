import {
  dirFromFacing,
  gunBehindUpper,
  PROSPECTOR_MUZZLE_FLASH_FRAME,
  frameAtTime,
  resolveFrame,
  lightLevelFor,
  resolveBlock,
  resolveSurface,
  surfaceFrameAt,
  surfaceOffsets,
  variantAt,
  type SpriteManifestEntry,
  type SurfaceManifest,
  propFrameAt,
  propKindIndex,
  propOffsets,
  resolveProp,
  type PropManifest,
  type TerrainManifest,
  EMISSIVE_HEX,
} from '@voxelyn/survival-content';

import playerManifest from '@voxelyn/survival-content/assets/atlases/player-prospector.json';
import playerLowerManifest from '@voxelyn/survival-content/assets/atlases/layer-player-prospector-lower.json';
import playerUpperManifest from '@voxelyn/survival-content/assets/atlases/layer-player-prospector-upper.json';
import playerGunManifest from '@voxelyn/survival-content/assets/atlases/layer-player-prospector-gun.json';
import stalkerManifest from '@voxelyn/survival-content/assets/atlases/enemy-stalker.json';
import spitterManifest from '@voxelyn/survival-content/assets/atlases/enemy-spitter.json';
import bomberManifest from '@voxelyn/survival-content/assets/atlases/enemy-spore-bomber.json';
import bruiserManifest from '@voxelyn/survival-content/assets/atlases/enemy-bruiser.json';
import guardianManifest from '@voxelyn/survival-content/assets/atlases/enemy-guardian.json';
import bishopManifest from '@voxelyn/survival-content/assets/atlases/enemy-bishop.json';
import horseManifest from '@voxelyn/survival-content/assets/atlases/enemy-fungal-horse.json';
import minerManifest from '@voxelyn/survival-content/assets/atlases/enemy-miner.json';
import resonantManifest from '@voxelyn/survival-content/assets/atlases/enemy-resonant.json';
import lampreyManifest from '@voxelyn/survival-content/assets/atlases/enemy-mud-lamprey.json';
import bellowsManifest from '@voxelyn/survival-content/assets/atlases/enemy-bellows.json';
import scoriacManifest from '@voxelyn/survival-content/assets/atlases/enemy-scoriac.json';
import wraithManifest from '@voxelyn/survival-content/assets/atlases/enemy-frost-wraith.json';
import sulfurBomberManifest from '@voxelyn/survival-content/assets/atlases/enemy-sulfur-bomber.json';
import undertakerManifest from '@voxelyn/survival-content/assets/atlases/enemy-undertaker.json';
import diamandisManifest from '@voxelyn/survival-content/assets/atlases/enemy-diamandis.json';
import devourerManifest from '@voxelyn/survival-content/assets/atlases/enemy-white-devourer.json';
import archcantorManifest from '@voxelyn/survival-content/assets/atlases/enemy-archcantor.json';
import leviathanManifest from '@voxelyn/survival-content/assets/atlases/enemy-sheet-leviathan.json';
import lungMatrixManifest from '@voxelyn/survival-content/assets/atlases/enemy-lung-matrix.json';
import furnaceHeartManifest from '@voxelyn/survival-content/assets/atlases/enemy-furnace-heart.json';
import frostQueenManifest from '@voxelyn/survival-content/assets/atlases/enemy-frost-queen.json';
import magnetarchManifest from '@voxelyn/survival-content/assets/atlases/enemy-magnetarch.json';
import boltManifest from '@voxelyn/survival-content/assets/atlases/fx-projectile-bolt.json';
import impactManifest from '@voxelyn/survival-content/assets/atlases/fx-impact-burst.json';
import droneManifest from '@voxelyn/survival-content/assets/atlases/fx-seeker-drone.json';
import cycloneManifest from '@voxelyn/survival-content/assets/atlases/fx-fire-cyclone.json';
import terrainManifest from '@voxelyn/survival-content/assets/atlases/terrain-blocks.json';
import surfaceManifest from '@voxelyn/survival-content/assets/atlases/surface-tiles.json';
import propManifest from '@voxelyn/survival-content/assets/atlases/world-props.json';

import playerUrl from '@voxelyn/survival-content/assets/atlases/player-prospector.png?url';
import playerLowerUrl from '@voxelyn/survival-content/assets/atlases/layer-player-prospector-lower.png?url';
import playerUpperUrl from '@voxelyn/survival-content/assets/atlases/layer-player-prospector-upper.png?url';
import playerGunUrl from '@voxelyn/survival-content/assets/atlases/layer-player-prospector-gun.png?url';
import stalkerUrl from '@voxelyn/survival-content/assets/atlases/enemy-stalker.png?url';
import spitterUrl from '@voxelyn/survival-content/assets/atlases/enemy-spitter.png?url';
import bomberUrl from '@voxelyn/survival-content/assets/atlases/enemy-spore-bomber.png?url';
import bruiserUrl from '@voxelyn/survival-content/assets/atlases/enemy-bruiser.png?url';
import guardianUrl from '@voxelyn/survival-content/assets/atlases/enemy-guardian.png?url';
import bishopUrl from '@voxelyn/survival-content/assets/atlases/enemy-bishop.png?url';
import horseUrl from '@voxelyn/survival-content/assets/atlases/enemy-fungal-horse.png?url';
import minerUrl from '@voxelyn/survival-content/assets/atlases/enemy-miner.png?url';
import resonantUrl from '@voxelyn/survival-content/assets/atlases/enemy-resonant.png?url';
import lampreyUrl from '@voxelyn/survival-content/assets/atlases/enemy-mud-lamprey.png?url';
import bellowsUrl from '@voxelyn/survival-content/assets/atlases/enemy-bellows.png?url';
import scoriacUrl from '@voxelyn/survival-content/assets/atlases/enemy-scoriac.png?url';
import wraithUrl from '@voxelyn/survival-content/assets/atlases/enemy-frost-wraith.png?url';
import sulfurBomberUrl from '@voxelyn/survival-content/assets/atlases/enemy-sulfur-bomber.png?url';
import undertakerUrl from '@voxelyn/survival-content/assets/atlases/enemy-undertaker.png?url';
import diamandisUrl from '@voxelyn/survival-content/assets/atlases/enemy-diamandis.png?url';
import devourerUrl from '@voxelyn/survival-content/assets/atlases/enemy-white-devourer.png?url';
import archcantorUrl from '@voxelyn/survival-content/assets/atlases/enemy-archcantor.png?url';
import leviathanUrl from '@voxelyn/survival-content/assets/atlases/enemy-sheet-leviathan.png?url';
import lungMatrixUrl from '@voxelyn/survival-content/assets/atlases/enemy-lung-matrix.png?url';
import furnaceHeartUrl from '@voxelyn/survival-content/assets/atlases/enemy-furnace-heart.png?url';
import frostQueenUrl from '@voxelyn/survival-content/assets/atlases/enemy-frost-queen.png?url';
import magnetarchUrl from '@voxelyn/survival-content/assets/atlases/enemy-magnetarch.png?url';
import boltUrl from '@voxelyn/survival-content/assets/atlases/fx-projectile-bolt.png?url';
import impactUrl from '@voxelyn/survival-content/assets/atlases/fx-impact-burst.png?url';
import droneUrl from '@voxelyn/survival-content/assets/atlases/fx-seeker-drone.png?url';
import cycloneUrl from '@voxelyn/survival-content/assets/atlases/fx-fire-cyclone.png?url';
import terrainUrl from '@voxelyn/survival-content/assets/atlases/terrain-blocks.png?url';
import surfaceUrl from '@voxelyn/survival-content/assets/atlases/surface-tiles.png?url';
import propUrl from '@voxelyn/survival-content/assets/atlases/world-props.png?url';

export type SpriteAnimationLayer = {
  animation: string;
  elapsedMs: number;
  facingX: number;
  facingY: number;
};

export type LayeredPlayerAnimation = {
  kind: 'layered-player';
  lower: SpriteAnimationLayer;
  upper: SpriteAnimationLayer;
  /** Intensidade normalizada de 0 a 1; desloca o tronco contra a mira. */
  recoil: number;
  /**
   * Calor do cano, de 0 (frio) a 1 (no limite). Vem da simulacao, nao de uma
   * contagem de tiros do cliente: o mesmo numero que trava o gatilho e que
   * machuca o Prospector e o que pinta o metal.
   */
  heat: number;
  /** Gatilho travado pelo superaquecimento: o cano esta incandescente e esfriando. */
  overheated: boolean;
};

export type SpriteAnimationSelection = string | LayeredPlayerAnimation;

type Tint = { color: string; alpha: number };
type Loaded = {
  manifest: SpriteManifestEntry;
  image: HTMLImageElement;
  ready: boolean;
  failed: boolean;
  /** Halo: so os pixels emissivos do atlas, em meia resolucao. Ver `emissiveMask`. */
  glow: HTMLCanvasElement | null;
};

/**
 * Divisor de resolucao da mascara de halo.
 *
 * Meia resolucao nao e economia cega, e a forma certa do dado: o halo E borrado.
 * Guardar a mascara em resolucao cheia gastaria quatro vezes a memoria para
 * depois jogar a nitidez fora no desenho — e a ampliacao de volta, com
 * suavizacao ligada, e exatamente o borrao que se quer, de graca e sem filtro
 * por quadro.
 */
const GLOW_SCALE = 2;
/** Quanto o halo transborda a silhueta, em pixels de atlas. */
const GLOW_SPREAD = 2;
const GLOW_ALPHA = 0.55;

/**
 * Opacidade do halo, dada a opacidade que o desenho ja herdou.
 *
 * ESCALA, nunca substitui. Quem chama ja atenuou o sprite por um motivo — o
 * parceiro obedecendo a luz da caverna, o eco de morte se apagando, a oferta do
 * poco translucida — e um halo em opacidade fixa acende o visor sobre um corpo
 * que quase nao esta la. No eco de morte era mais que feio: ele reserva a luz
 * que atravessa o escuro para o farol proprio, e o halo do sprite furava a
 * regra.
 */
export const glowAlpha = (inherited: number): number => inherited * GLOW_ALPHA;

/**
 * Apaga tudo que NAO emite luz, no lugar, e devolve quantos pixels sobraram.
 *
 * Comparacao EXATA contra a paleta mestra, e nao por proximidade: os atlas de
 * personagem sao validados com alpha binario e cores exatas da paleta, entao um
 * limiar de aproximacao so criaria falso positivo em cima de uma garantia que ja
 * existe. (Terreno e chao ficam de fora do halo justamente por nao terem essa
 * garantia — as cores deles sao multiplicadas por niveis de luz assados, e um
 * cristal a meia luz nao bate com nenhum hex da paleta.)
 *
 * Separada do canvas de proposito: e a unica parte com decisao, e assim ela e
 * testavel sem DOM.
 */
export const keepEmissivePixels = (
  rgba: Uint8ClampedArray,
  emissive: readonly string[]
): number => {
  const wanted = new Set(emissive.map((hex) => parseInt(hex.slice(1), 16)));
  let kept = 0;
  for (let i = 0; i < rgba.length; i += 4) {
    const key = (rgba[i] << 16) | (rgba[i + 1] << 8) | rgba[i + 2];
    if (rgba[i + 3] !== 0 && wanted.has(key)) {
      kept++;
      continue;
    }
    rgba[i + 3] = 0;
  }
  return kept;
};

/**
 * Quantos pixels de ATLAS cabem num pixel logico do mundo.
 *
 * A grade voxel do gerador foi subdividida (MODEL_SCALE=2 no pipeline de
 * conteudo): todo atlas — entidades, terreno, crostas, props e FX — tem o dobro
 * da resolucao para o MESMO tamanho de mundo. O cliente converte na hora de
 * desenhar: um sprite/bloco e desenhado com `zoom / ATLAS_SCALE`, entao no zoom
 * tipico de 2x cada pixel de atlas cai em exatamente 1 pixel de tela — o dobro
 * de detalhe visivel, sem mudar o tamanho de nada em jogo.
 */
export const ATLAS_SCALE = 2;

/**
 * Mascara com os pixels emissivos de um atlas, em meia resolucao.
 *
 * Devolve `null` quando nao ha um unico pixel emissivo, e ai o desenho pula o
 * halo inteiro em vez de compor uma imagem vazia por criatura por quadro.
 */
export const emissiveMask = (
  source: CanvasImageSource,
  width: number,
  height: number,
  emissive: readonly string[]
): HTMLCanvasElement | null => {
  if (width <= 0 || height <= 0) return null;
  const full = document.createElement('canvas');
  full.width = width;
  full.height = height;
  const fctx = full.getContext('2d', { willReadFrequently: true });
  if (!fctx) return null;
  fctx.imageSmoothingEnabled = false;
  fctx.drawImage(source, 0, 0);

  const frame = fctx.getImageData(0, 0, width, height);
  if (keepEmissivePixels(frame.data, emissive) === 0) return null;
  fctx.putImageData(frame, 0, 0);

  const half = document.createElement('canvas');
  half.width = Math.max(1, Math.floor(width / GLOW_SCALE));
  half.height = Math.max(1, Math.floor(height / GLOW_SCALE));
  const hctx = half.getContext('2d');
  if (!hctx) return null;
  hctx.imageSmoothingEnabled = true;
  hctx.drawImage(full, 0, 0, half.width, half.height);
  return half;
};

const SOURCES: Array<{ manifest: SpriteManifestEntry; url: string }> = [
  { manifest: playerManifest as unknown as SpriteManifestEntry, url: playerUrl },
  { manifest: playerLowerManifest as unknown as SpriteManifestEntry, url: playerLowerUrl },
  { manifest: playerUpperManifest as unknown as SpriteManifestEntry, url: playerUpperUrl },
  { manifest: playerGunManifest as unknown as SpriteManifestEntry, url: playerGunUrl },
  { manifest: stalkerManifest as unknown as SpriteManifestEntry, url: stalkerUrl },
  { manifest: spitterManifest as unknown as SpriteManifestEntry, url: spitterUrl },
  { manifest: bomberManifest as unknown as SpriteManifestEntry, url: bomberUrl },
  { manifest: bruiserManifest as unknown as SpriteManifestEntry, url: bruiserUrl },
  { manifest: guardianManifest as unknown as SpriteManifestEntry, url: guardianUrl },
  { manifest: bishopManifest as unknown as SpriteManifestEntry, url: bishopUrl },
  { manifest: horseManifest as unknown as SpriteManifestEntry, url: horseUrl },
  { manifest: minerManifest as unknown as SpriteManifestEntry, url: minerUrl },
  { manifest: resonantManifest as unknown as SpriteManifestEntry, url: resonantUrl },
  { manifest: lampreyManifest as unknown as SpriteManifestEntry, url: lampreyUrl },
  { manifest: bellowsManifest as unknown as SpriteManifestEntry, url: bellowsUrl },
  { manifest: scoriacManifest as unknown as SpriteManifestEntry, url: scoriacUrl },
  { manifest: wraithManifest as unknown as SpriteManifestEntry, url: wraithUrl },
  { manifest: sulfurBomberManifest as unknown as SpriteManifestEntry, url: sulfurBomberUrl },
  { manifest: undertakerManifest as unknown as SpriteManifestEntry, url: undertakerUrl },
  { manifest: diamandisManifest as unknown as SpriteManifestEntry, url: diamandisUrl },
  { manifest: devourerManifest as unknown as SpriteManifestEntry, url: devourerUrl },
  { manifest: archcantorManifest as unknown as SpriteManifestEntry, url: archcantorUrl },
  { manifest: leviathanManifest as unknown as SpriteManifestEntry, url: leviathanUrl },
  { manifest: lungMatrixManifest as unknown as SpriteManifestEntry, url: lungMatrixUrl },
  { manifest: furnaceHeartManifest as unknown as SpriteManifestEntry, url: furnaceHeartUrl },
  { manifest: frostQueenManifest as unknown as SpriteManifestEntry, url: frostQueenUrl },
  { manifest: magnetarchManifest as unknown as SpriteManifestEntry, url: magnetarchUrl },
  { manifest: boltManifest as unknown as SpriteManifestEntry, url: boltUrl },
  { manifest: impactManifest as unknown as SpriteManifestEntry, url: impactUrl },
  { manifest: droneManifest as unknown as SpriteManifestEntry, url: droneUrl },
  { manifest: cycloneManifest as unknown as SpriteManifestEntry, url: cycloneUrl },
];

/**
 * Arquetipo da simulacao -> atlas. Exportado por causa do TESTE, e o teste
 * existe por causa de uma falha real: oito chefes chegaram ao jogo sem entrada
 * aqui, e como `spriteForArchetype` devolve `null` para chave desconhecida e o
 * renderer tem recuo para tudo, ninguem foi avisado — eles simplesmente
 * apareciam no setor final como um losango de cor. Nada quebrava, e por isso o
 * defeito sobreviveu a varias rodadas de teste verde.
 */
export const ARCHETYPE_SPRITE: Record<string, string> = {
  prospector: 'player-prospector',
  stalker: 'enemy-stalker',
  spitter: 'enemy-spitter',
  bomber: 'enemy-spore-bomber',
  bruiser: 'enemy-bruiser',
  guardian: 'enemy-guardian',
  bishop: 'enemy-bishop',
  fungal_horse: 'enemy-fungal-horse',
  miner: 'enemy-miner',
  resonant: 'enemy-resonant',
  mud_lamprey: 'enemy-mud-lamprey',
  bellows: 'enemy-bellows',
  scoriac: 'enemy-scoriac',
  frost_wraith: 'enemy-frost-wraith',
  sulfur_bomber: 'enemy-sulfur-bomber',
  undertaker: 'enemy-undertaker',
  // Chefes: a chave e o `EnemyArchetype` da simulacao, e o valor o atlas. Ate
  // estes oito existirem, o cliente nao achava entrada nenhuma para eles e caia
  // no losango de recuo — um chefe de setor final desenhado como um bloco de cor.
  diamandis: 'enemy-diamandis',
  white_devourer: 'enemy-white-devourer',
  archcantor: 'enemy-archcantor',
  sheet_leviathan: 'enemy-sheet-leviathan',
  lung_matrix: 'enemy-lung-matrix',
  furnace_heart: 'enemy-furnace-heart',
  frost_queen: 'enemy-frost-queen',
  magnetarch: 'enemy-magnetarch',
};

/**
 * Banco de blocos de terreno. Separado do SpriteBank porque o eixo de variacao e
 * outro: aqui nao ha animacao nem direcao, so tipo, variante de superficie e
 * nivel de luz — tudo pre-renderizado.
 */
export class TerrainBank {
  private readonly manifest = terrainManifest as unknown as TerrainManifest;
  private readonly image = new Image();
  private ready = false;

  load(): void {
    this.image.onload = () => { this.ready = true; };
    this.image.onerror = () => {
      console.warn('[terrain] atlas failed to load; using flat blocks');
    };
    this.image.src = terrainUrl;
  }

  get kinds(): string[] { return this.manifest.kinds; }
  get variants(): number { return this.manifest.variants; }

  /**
   * Desenha um bloco com o centro do tile em (sx, sy) no plano do chao.
   *
   * A ancora vem do manifest (originX/originY), entao mexer no modelo voxel nao
   * desalinha o terreno: o gerador recalcula e o cliente segue junto.
   */
  draw(
    ctx: CanvasRenderingContext2D,
    kindIndex: number,
    x: number,
    y: number,
    brightness: number,
    screenX: number,
    screenY: number,
    zoom: number
  ): boolean {
    if (!this.ready) return false;
    const m = this.manifest;
    const rect = resolveBlock(m, kindIndex, variantAt(x, y, m.variants), lightLevelFor(m, brightness));
    // O atlas esta na grade fina: pixels de atlas viram tela por `s`, nao por
    // `zoom`. A origem do modelo cai meio voxel AUTORADO adiante do centro do
    // tile nos dois eixos — na projecao 2:1 isso e 1px logico para baixo, que
    // na grade fina sao ATLAS_SCALE pixels de atlas.
    const s = zoom / ATLAS_SCALE;
    const dx = screenX - m.originX * s;
    const dy = screenY + ATLAS_SCALE * s - m.originY * s;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.image, rect.sx, rect.sy, rect.sw, rect.sh,
      dx, dy, m.frameWidth * s, m.frameHeight * s);
    return true;
  }
}

/**
 * Banco de crostas de chao. Irmao do TerrainBank e separado dele pelo mesmo
 * motivo que ele e separado do SpriteBank: o eixo de variacao e outro. Aqui ha
 * quadro de animacao, e o numero de quadros muda por tipo.
 *
 * O que este banco substitui: um `fill` de losango de cor chapada por celula,
 * mais um segundo losango com `rgba()` por cima quando havia gas ou fogo. Uma
 * chamada de `drawImage` no lugar de duas de path — o chao voxel custa MENOS
 * por frame que o chao chapado que ele substitui.
 */
export class SurfaceBank {
  private readonly manifest = surfaceManifest as unknown as SurfaceManifest;
  private readonly offsets = surfaceOffsets(surfaceManifest as unknown as SurfaceManifest);
  private readonly image = new Image();
  private ready = false;

  load(): void {
    this.image.onload = () => { this.ready = true; };
    this.image.onerror = () => {
      console.warn('[surfaces] atlas failed to load; using flat floor');
    };
    this.image.src = surfaceUrl;
  }

  get kinds(): string[] { return this.manifest.kinds.map((k) => k.name); }

  /**
   * Desenha a crosta de uma celula com o centro do tile em (sx, sy).
   *
   * A ancora e IDENTICA a do bloco de terreno de proposito: os dois modelos sao
   * autorados no mesmo espaco, com a origem no voxel (0,0,0), entao repetir a
   * conta faz a camada z=0 do chao cair exatamente onde cai a base da parede.
   * Qualquer ajuste proprio aqui abriria uma costura de um pixel entre o piso e
   * o bloco em cima dele — visivel, e em toda celula da borda de toda sala.
   */
  draw(
    ctx: CanvasRenderingContext2D,
    kindIndex: number,
    x: number,
    y: number,
    brightness: number,
    nowMs: number,
    screenX: number,
    screenY: number,
    zoom: number
  ): boolean {
    if (!this.ready) return false;
    const m = this.manifest;
    const rect = resolveSurface(
      m,
      this.offsets,
      kindIndex,
      variantAt(x, y, m.variants),
      surfaceFrameAt(m, kindIndex, x, y, nowMs),
      lightLevelFor(m, brightness)
    );
    // Mesma conversao de grade fina do bloco: a ancora e identica de proposito.
    const s = zoom / ATLAS_SCALE;
    const dx = screenX - m.originX * s;
    const dy = screenY + ATLAS_SCALE * s - m.originY * s;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.image, rect.sx, rect.sy, rect.sw, rect.sh,
      dx, dy, m.frameWidth * s, m.frameHeight * s);
    return true;
  }
}

/**
 * Banco de objetos de mundo: Nucleo e plataforma de extracao.
 *
 * Separado do banco de chao porque o eixo de variacao e outro — nao ha variante
 * nem nivel de luz, so o quadro de animacao — e porque estas pecas sao
 * desenhadas ACIMA do chao, na fila ordenada por profundidade, e nao no passo
 * de piso.
 */
export class PropBank {
  private readonly manifest = propManifest as unknown as PropManifest;
  private readonly offsets = propOffsets(propManifest as unknown as PropManifest);
  private readonly image = new Image();
  private ready = false;

  load(): void {
    this.image.onload = () => { this.ready = true; };
    this.image.onerror = () => {
      console.warn('[props] atlas failed to load; using flat markers');
    };
    this.image.src = propUrl;
  }

  indexOf(name: string): number {
    return propKindIndex(this.manifest, name);
  }

  /**
   * Desenha uma peca com a BASE no centro do tile (sx, sy).
   *
   * Mesma conta de ancora do chao e do bloco: os tres modelos sao autorados no
   * mesmo espaco com a origem no voxel (0,0,0). Repetir a conta e o que faz o
   * pedestal assentar exatamente sobre o piso, sem costura nem flutuacao.
   */
  draw(
    ctx: CanvasRenderingContext2D,
    name: string,
    nowMs: number,
    screenX: number,
    screenY: number,
    zoom: number
  ): boolean {
    if (!this.ready) return false;
    const kindIndex = this.indexOf(name);
    if (kindIndex < 0) return false;
    const m = this.manifest;
    const rect = resolveProp(m, this.offsets, kindIndex, propFrameAt(m, kindIndex, nowMs));
    // Mesma conversao de grade fina do bloco e do chao: mesma ancora, de
    // proposito, para o pedestal assentar sem costura.
    const s = zoom / ATLAS_SCALE;
    const dx = screenX - m.originX * s;
    const dy = screenY + ATLAS_SCALE * s - m.originY * s;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.image, rect.sx, rect.sy, rect.sw, rect.sh,
      dx, dy, m.frameWidth * s, m.frameHeight * s);
    return true;
  }
}

const PLAYER_LOWER_ID = 'layer-player-prospector-lower';
const PLAYER_UPPER_ID = 'layer-player-prospector-upper';
const PLAYER_GUN_ID = 'layer-player-prospector-gun';
// Em pixels de ATLAS (grade fina): -2 aqui sao os mesmos -1 logicos de antes
// da subdivisao.
const WALK_HIP_BOB = [0, -2, -2, 0, 0, -2];

/**
 * Rampa de calor do cano, em cores da paleta mestra.
 *
 * Metal quente nao passa de frio a branco de uma vez: rubesce primeiro, abre em
 * laranja e so entao clareia. As paradas abaixo sao exatamente essa ordem, e sao
 * as MESMAS cores do fogo do mundo — o cano quente pertence a mesma fisica que a
 * chama no chao, e nao a um efeito de interface.
 */
const HEAT_RAMP: readonly (readonly [number, readonly [number, number, number]])[] = [
  [0.00, [0xd9, 0x3b, 0x4c]], // blood: o primeiro rubor
  [0.55, [0xff, 0x7a, 0x2f]], // fire
  [1.00, [0xff, 0xd1, 0x66]], // loot
];
/** Branco-quente: so o superaquecimento chega aqui. */
const INCANDESCENT: readonly [number, number, number] = [0xe8, 0xf1, 0xff];

/**
 * Luz do disparo batendo no corpo.
 *
 * Mesmo dourado (`loot`) do voxel que acende na boca do cano — e a MESMA luz, e
 * dar a ela outra cor faria o corpo parecer iluminado por uma segunda fonte que
 * nao existe na cena.
 *
 * Alpha baixo de proposito: o tint e chapado, e um clarao forte apagaria as
 * faces do chassi por um quadro, trocando "a luz bateu nele" por "ele piscou".
 */
const MUZZLE_LIGHT: Tint = { color: 'rgb(255, 209, 102)', alpha: 0.26 };

/**
 * Abaixo disto o cano fica com a propria cor.
 *
 * Existe porque calor residual e permanente: o decaimento por tick nunca chega a
 * zero enquanto o jogador atira de vez em quando, e sem um piso o Prospector
 * andaria com a arma eternamente rosada. O primeiro rubor tem de significar
 * "voce esta gastando o cano", nao "o cano existe".
 */
const HEAT_VISIBLE_AT = 0.18;
/**
 * Teto de opacidade fora do superaquecimento.
 *
 * O tint e chapado: em alpha 1 o cano perde as tres faces e vira um borrao de
 * uma cor so. Guardar o alpha 1 para o superaquecimento e o que faz ele LER como
 * um estado diferente, e nao como mais um passo da mesma rampa.
 */
const HEAT_MAX_ALPHA = 0.88;

const mixChannel = (a: number, b: number, t: number): number => Math.round(a + (b - a) * t);
const rgb = (c: readonly [number, number, number]): string => `rgb(${c[0]}, ${c[1]}, ${c[2]})`;

/**
 * Cor e opacidade do cano para um dado calor. Pura: o mesmo calor pinta o mesmo
 * metal em qualquer maquina, e o teste pode conferir a rampa sem um canvas.
 */
export const gunHeatTint = (heat: number, overheated: boolean): Tint | undefined => {
  const t = Math.max(0, Math.min(1, heat));
  // Superaquecido, o cano nao mede mais nada: esta no branco, e a partir daqui
  // o unico movimento e para baixo. Nao pulsa — piscar aqui competiria com o
  // tremor do corpo, que e o sinal que diz ao jogador que o gatilho travou.
  if (overheated) return { color: rgb(INCANDESCENT), alpha: 1 };
  if (t < HEAT_VISIBLE_AT) return undefined;

  const eased = (t - HEAT_VISIBLE_AT) / (1 - HEAT_VISIBLE_AT);
  let color = HEAT_RAMP[HEAT_RAMP.length - 1][1];
  for (let i = 1; i < HEAT_RAMP.length; i++) {
    const [stopAt, stopColor] = HEAT_RAMP[i];
    if (eased > stopAt) continue;
    const [prevAt, prevColor] = HEAT_RAMP[i - 1];
    const span = stopAt - prevAt || 1;
    const k = (eased - prevAt) / span;
    color = [
      mixChannel(prevColor[0], stopColor[0], k),
      mixChannel(prevColor[1], stopColor[1], k),
      mixChannel(prevColor[2], stopColor[2], k),
    ];
    break;
  }
  return { color: rgb(color), alpha: HEAT_MAX_ALPHA * (0.35 + eased * 0.65) };
};

export const recoilScreenOffset = (
  facingX: number,
  facingY: number,
  recoil: number,
  zoom: number
): { x: number; y: number } => {
  const worldLength = Math.hypot(facingX, facingY) || 1;
  const screenX = (facingX - facingY) / worldLength;
  const screenY = (facingX + facingY) / (worldLength * 2);
  const screenLength = Math.hypot(screenX, screenY) || 1;
  // 4.5 pixels de atlas na grade fina = os mesmos 2.25 logicos de sempre.
  const distance = Math.max(0, Math.min(1, recoil)) * 4.5 * zoom;
  return {
    x: -(screenX / screenLength) * distance,
    y: -(screenY / screenLength) * distance,
  };
};

export class SpriteBank {
  private readonly byId = new Map<string, Loaded>();
  private tintBuffer: HTMLCanvasElement | null = null;
  /**
   * Halo ligado. Vem do preset de qualidade e nao de uma constante: e o unico
   * efeito desta classe que e puro enfeite, entao e o primeiro a sair quando o
   * aparelho nao esta dando conta.
   */
  bloom = true;

  load(): void {
    for (const { manifest, url } of SOURCES) {
      const image = new Image();
      const entry: Loaded = { manifest, image, ready: false, failed: false, glow: null };
      image.onload = () => {
        entry.ready = true;
        // A mascara e construida UMA vez, no load, e nunca por quadro. Ler pixel
        // de um atlas de meio milhao deles em tempo de jogo seria travar o
        // quadro; aqui acontece atras da tela de carregamento.
        try {
          entry.glow = emissiveMask(image, image.naturalWidth, image.naturalHeight, EMISSIVE_HEX);
        } catch {
          // Canvas bloqueado (contexto perdido, aba em segundo plano no load):
          // o jogo segue sem halo, que e cosmetico.
          entry.glow = null;
        }
      };
      image.onerror = () => {
        entry.failed = true;
        console.warn(`[sprites] atlas failed to load; using fallback: ${manifest.id}`);
      };
      image.src = url;
      this.byId.set(manifest.id, entry);
    }
  }

  get(id: string): Loaded | null {
    const entry = this.byId.get(id);
    return entry && entry.ready ? entry : null;
  }

  manifestForArchetype(archetype: string): SpriteManifestEntry | null {
    const id = ARCHETYPE_SPRITE[archetype];
    return id ? this.byId.get(id)?.manifest ?? null : null;
  }

  spriteForArchetype(archetype: string): Loaded | null {
    const id = ARCHETYPE_SPRITE[archetype];
    return id ? this.get(id) : null;
  }

  drawEntity(
    ctx: CanvasRenderingContext2D,
    archetype: string,
    animation: SpriteAnimationSelection,
    facingX: number,
    facingY: number,
    elapsedMs: number,
    footX: number,
    footY: number,
    zoom: number,
    tint?: Tint
  ): boolean {
    if (typeof animation !== 'string' && archetype === 'prospector') {
      if (this.drawLayeredPlayer(ctx, animation, footX, footY, zoom, tint)) return true;
      // Os atlas de camada ainda podem estar carregando. O atlas completo mantém
      // o personagem visível e usa a ação do tronco como fallback temporário.
      facingX = animation.upper.facingX;
      facingY = animation.upper.facingY;
      elapsedMs = animation.upper.elapsedMs;
      animation = animation.upper.animation;
    }

    if (typeof animation !== 'string') animation = animation.upper.animation;
    const loaded = this.spriteForArchetype(archetype);
    if (!loaded) return false;
    this.drawLoadedFrame(ctx, loaded, animation, facingX, facingY, elapsedMs, footX, footY, zoom, tint);
    return true;
  }

  /**
   * Um atlas de FX ancorado no MUNDO, por id.
   *
   * Distinto de `drawEntity` porque um efeito nao tem arquetipo, nao tem
   * direcao e nao tem estado de animacao proprio: ele cicla pelo relogio. Os
   * FX antigos (bolt, impacto, drone) sao desenhados em runtime pelo
   * `projectiles.ts`; este caminho existe para o ciclone, que ocupa uma coluna
   * inteira de chao e precisa de arte autoral.
   *
   * Devolve `false` enquanto o atlas nao carregou, para o chamador ter recuo —
   * um perigo invisivel e pior que um perigo feio.
   */
  drawFx(
    ctx: CanvasRenderingContext2D,
    id: string,
    animation: string,
    elapsedMs: number,
    x: number,
    y: number,
    zoom: number,
    tint?: Tint
  ): boolean {
    const loaded = this.get(id);
    if (!loaded || !loaded.ready) return false;
    this.drawLoadedFrame(ctx, loaded, animation, 0, 1, elapsedMs, x, y, zoom, tint);
    return true;
  }

  private drawLayeredPlayer(
    ctx: CanvasRenderingContext2D,
    animation: LayeredPlayerAnimation,
    footX: number,
    footY: number,
    zoom: number,
    tint?: Tint
  ): boolean {
    const lower = this.get(PLAYER_LOWER_ID);
    const upper = this.get(PLAYER_UPPER_ID);
    // A arma vive numa camada propria e o tronco nao a desenha mais. Sem os tres
    // atlas o Prospector sairia desarmado, entao a composicao inteira cede a vez
    // para o sheet completo em vez de entregar meio personagem.
    const gun = this.get(PLAYER_GUN_ID);
    if (!lower || !upper || !gun) return false;

    // LUZ DO DISPARO na armadura.
    //
    // O clarao ja existia como tres voxels acesos na boca do cano, e parava ali:
    // uma fonte de luz a um palmo de um chassi de latao nao acendia um pixel
    // dele. Aqui o corpo inteiro recebe o mesmo dourado do clarao enquanto ele
    // dura — pernas junto, porque a luz desce.
    //
    // O quadro vem do ATLAS, e nao de um cronometro proprio: `frameAtTime` diz
    // qual quadro de `attack` esta na tela agora, e a arte diz qual deles cospe.
    // Qualquer relogio paralelo sairia de fase com o desenho do cano no dia em
    // que o `fps` da animacao mudasse.
    const firing = animation.upper.animation === 'attack';
    const muzzleLit =
      firing &&
      frameAtTime(gun.manifest, 'attack', animation.upper.elapsedMs) === PROSPECTOR_MUZZLE_FLASH_FRAME;
    // Enquanto acende, a luz manda no corpo: ela e mais forte que o tint frio que
    // separa um parceiro do outro, e dura um quadro.
    const bodyTint = muzzleLit ? MUZZLE_LIGHT : tint;

    this.drawLoadedFrame(
      ctx,
      lower,
      animation.lower.animation,
      animation.lower.facingX,
      animation.lower.facingY,
      animation.lower.elapsedMs,
      footX,
      footY,
      zoom,
      bodyTint
    );

    const lowerFrame = frameAtTime(lower.manifest, animation.lower.animation, animation.lower.elapsedMs);
    const hipBob = animation.lower.animation === 'walk'
      ? WALK_HIP_BOB[lowerFrame % WALK_HIP_BOB.length] * zoom
      : 0;
    const recoil = recoilScreenOffset(
      animation.upper.facingX,
      animation.upper.facingY,
      animation.recoil,
      zoom
    );

    const upperX = footX + recoil.x;
    const upperY = footY + hipBob + recoil.y;
    const drawUpper = (): void => {
      this.drawLoadedFrame(
        ctx,
        upper,
        animation.upper.animation,
        animation.upper.facingX,
        animation.upper.facingY,
        animation.upper.elapsedMs,
        upperX,
        upperY,
        zoom,
        bodyTint
      );
    };

    // A arma acompanha o tronco quadro a quadro e recebe o MESMO deslocamento de
    // coice: ela e a peca que recua, e resolver o coice so no tronco faria o cano
    // deslizar para dentro do peito no disparo.
    //
    // O calor tem prioridade sobre o tint de aliado. O tint frio do parceiro
    // existe para separar dois Prospectors iguais na tela; o calor conta um
    // estado que machuca, e nenhum deles precisa ser lido ao mesmo tempo — o
    // parceiro remoto nao transmite calor, entao na pratica os dois nunca
    // disputam o mesmo cano.
    const drawGun = (): void => {
      this.drawLoadedFrame(
        ctx,
        gun,
        animation.upper.animation,
        animation.upper.facingX,
        animation.upper.facingY,
        animation.upper.elapsedMs,
        upperX,
        upperY,
        zoom,
        gunHeatTint(animation.heat, animation.overheated) ?? tint
      );
    };

    // Profundidade entre tronco e arma. Dentro de um modelo so, o rasterizador
    // resolveria isso voxel a voxel; entre dois atlas o unico controle e a ORDEM
    // das duas chamadas, e a arma por cima em toda direcao a fazia flutuar sobre
    // o peito nos rumos em que o chassi deveria comê-la.
    if (gunBehindUpper(animation.upper.facingX, animation.upper.facingY)) {
      drawGun();
      drawUpper();
    } else {
      drawUpper();
      drawGun();
    }
    return true;
  }

  private drawLoadedFrame(
    ctx: CanvasRenderingContext2D,
    loaded: Loaded,
    animation: string,
    facingX: number,
    facingY: number,
    elapsedMs: number,
    footX: number,
    footY: number,
    zoom: number,
    tint?: Tint
  ): void {
    const { manifest, image } = loaded;
    const fallbackAnimation = animation === 'special' && !manifest.animations.special ? 'attack' : animation;
    const useAnimation = manifest.animations[fallbackAnimation] ? fallbackAnimation : 'idle';
    const direction = manifest.directions > 1 ? dirFromFacing(facingX, facingY) : manifest.authoredDirs[0];
    const frame = frameAtTime(manifest, useAnimation, elapsedMs);
    const rect = resolveFrame(manifest, useAnimation, direction, frame);
    const dw = manifest.frameWidth * zoom;
    const dh = manifest.frameHeight * zoom;
    const dx = footX - manifest.anchorX * zoom;
    const dy = footY - manifest.anchorY * zoom;

    let source: CanvasImageSource = image;
    let sx = rect.sx;
    let sy = rect.sy;
    if (tint && tint.alpha > 0) {
      source = this.tintedFrame(image, rect, manifest.frameWidth, manifest.frameHeight, tint);
      sx = 0;
      sy = 0;
    }

    ctx.save();
    ctx.imageSmoothingEnabled = false;
    if (rect.flip) {
      ctx.translate(footX, 0);
      ctx.scale(-1, 1);
      ctx.translate(-footX, 0);
      const flippedX = footX - (manifest.frameWidth - manifest.anchorX) * zoom;
      ctx.drawImage(source, sx, sy, rect.sw, rect.sh, flippedX, dy, dw, dh);
      this.drawGlow(ctx, loaded, rect, flippedX, dy, dw, dh, zoom);
    } else {
      ctx.drawImage(source, sx, sy, rect.sw, rect.sh, dx, dy, dw, dh);
      this.drawGlow(ctx, loaded, rect, dx, dy, dw, dh, zoom);
    }
    ctx.restore();
  }

  /**
   * Halo aditivo sobre os pixels emissivos do quadro.
   *
   * UM drawImage, sem filtro e sem leitura de pixel: a mascara ja esta pronta
   * desde o load, e o borrao sai da ampliacao dela de meia resolucao de volta ao
   * tamanho do sprite, com suavizacao ligada. Cresce alguns pixels alem da
   * silhueta para o brilho transbordar a peca, que e o que separa "uma luz" de
   * "um pixel claro".
   *
   * Sai DENTRO do `save/restore` do desenho principal, e logo depois dele, para
   * herdar o mesmo espelhamento — sem isso o halo do visor de um sprite virado
   * ficaria do lado oposto da cabeca.
   */
  private drawGlow(
    ctx: CanvasRenderingContext2D,
    loaded: Loaded,
    rect: { sx: number; sy: number; sw: number; sh: number },
    dx: number,
    dy: number,
    dw: number,
    dh: number,
    zoom: number
  ): void {
    const glow = loaded.glow;
    if (!this.bloom || !glow) return;
    const inherited = ctx.globalAlpha;
    if (inherited <= 0) return;
    const grow = GLOW_SPREAD * zoom;
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = glowAlpha(inherited);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(
      glow,
      rect.sx / GLOW_SCALE, rect.sy / GLOW_SCALE, rect.sw / GLOW_SCALE, rect.sh / GLOW_SCALE,
      dx - grow, dy - grow, dw + grow * 2, dh + grow * 2
    );
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = inherited;
    ctx.imageSmoothingEnabled = false;
  }

  private tintedFrame(
    image: CanvasImageSource,
    rect: { sx: number; sy: number; sw: number; sh: number },
    width: number,
    height: number,
    tint: Tint
  ): HTMLCanvasElement {
    if (!this.tintBuffer) this.tintBuffer = document.createElement('canvas');
    const buffer = this.tintBuffer;
    if (buffer.width !== width || buffer.height !== height) {
      buffer.width = width;
      buffer.height = height;
    }
    const bctx = buffer.getContext('2d');
    if (!bctx) return buffer;
    bctx.globalCompositeOperation = 'source-over';
    bctx.globalAlpha = 1;
    bctx.clearRect(0, 0, width, height);
    bctx.imageSmoothingEnabled = false;
    bctx.drawImage(image, rect.sx, rect.sy, rect.sw, rect.sh, 0, 0, width, height);
    bctx.globalCompositeOperation = 'source-atop';
    bctx.globalAlpha = tint.alpha;
    bctx.fillStyle = tint.color;
    bctx.fillRect(0, 0, width, height);
    bctx.globalCompositeOperation = 'source-over';
    bctx.globalAlpha = 1;
    return buffer;
  }

  // `drawBolt` e `drawImpact` moravam aqui e ninguem os chamava: o tiro em jogo
  // e desenhado como voxels reais (ProjectileView) e o impacto por particulas,
  // desde a troca documentada em projectiles.ts. Os atlas fx-* continuam no
  // banco — viewer, precache e validador dependem deles — mas a API de desenho
  // morta saiu junto do redesign nativo dos FX na grade fina.
}

const MOVEMENT_HOLD_MS = 120;

export type EntityAnimState = {
  anim: string;
  animStartMs: number;
  lastX: number;
  lastY: number;
  lastHp: number;
  hitUntilMs: number;
  movingUntilMs: number;
  moveFacingX: number;
  moveFacingY: number;
};

export const deriveAnim = (
  previous: EntityAnimState | undefined,
  x: number,
  y: number,
  hp: number,
  alive: boolean,
  nowMs: number
): EntityAnimState => {
  const state: EntityAnimState = previous ?? {
    anim: 'idle',
    animStartMs: nowMs,
    lastX: x,
    lastY: y,
    lastHp: hp,
    hitUntilMs: 0,
    movingUntilMs: 0,
    moveFacingX: 0,
    moveFacingY: 0,
  };
  const dx = x - state.lastX;
  const dy = y - state.lastY;
  const distance = Math.hypot(dx, dy);
  const moved = distance > 0.004;
  if (moved) {
    state.movingUntilMs = nowMs + MOVEMENT_HOLD_MS;
    state.moveFacingX = dx / distance;
    state.moveFacingY = dy / distance;
  }
  const moving = moved || nowMs < state.movingUntilMs;
  const tookDamage = hp < state.lastHp - 0.01;
  if (tookDamage) state.hitUntilMs = nowMs + 180;
  const next = !alive ? 'die' : nowMs < state.hitUntilMs ? 'hit' : moving ? 'walk' : 'idle';
  if (next !== state.anim) {
    state.anim = next;
    state.animStartMs = nowMs;
  }
  state.lastX = x;
  state.lastY = y;
  state.lastHp = hp;
  return state;
};
