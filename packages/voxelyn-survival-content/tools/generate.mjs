// Deterministic atlas generator for Voxelyn Survival character and FX sprites.
// Stable filenames are intentional: versioning lives inside each manifest.
import { PNG } from 'pngjs';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { blitToAtlas, colorsUsed, fitSpriteToMargin, grid, isEmpty } from './lib.mjs';
import { ANIM_ORDER, ENTITY_SPECS } from './entities.mjs';
import {
  BLOCK_KINDS,
  LIGHT_LEVELS,
  VARIANTS,
  blockBounds,
  buildTerrainFrames,
} from './terrain.mjs';
import { SURFACE_KINDS, buildSurfaceFrames, surfaceBounds } from './surfaces.mjs';
import { PROP_KINDS, buildPropFrames, propBounds } from './props.mjs';
import { PLAYER_LAYER_SPECS } from './player-layers.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, '../assets/atlases');
mkdirSync(OUT, { recursive: true });

const MAX_TEXTURE = 4096;

const orderedAnims = (spec) => ANIM_ORDER.filter((a) => spec.animations[a]);

const buildEntity = (spec) => {
  const anims = orderedAnims(spec);
  const framesPerDir = anims.reduce((sum, a) => sum + spec.animations[a].frames, 0);
  const totalCols = framesPerDir * spec.authoredDirs.length;
  // Teto de largura de textura (4096) e real em GPU mobile: acima disso o
  // atlas simplesmente nao carrega no aparelho. Quando os frames nao cabem numa
  // linha, o sheet passa a ter varias — cortar frames de animacao para caber
  // seria degradar o jogo por causa de empacotamento.
  const columns = Math.min(totalCols, Math.floor(MAX_TEXTURE / spec.frameWidth));
  const rows = Math.ceil(totalCols / columns);
  const atlas = grid(columns * spec.frameWidth, rows * spec.frameHeight);
  const frameMap = {};
  const palette = new Set();
  let col = 0;

  // Os frames sao desenhados primeiro e enquadrados DEPOIS, todos juntos: o
  // deslocamento tem de ser o mesmo para o sprite inteiro, senao cada pose e
  // recentralizada por conta propria e a animacao se desfaz (ver
  // fitSpriteToMargin).
  const raw = [];
  for (const dir of spec.authoredDirs) {
    frameMap[dir] = {};
    for (const anim of anims) {
      frameMap[dir][anim] = col;
      const def = spec.animations[anim];
      for (let f = 0; f < def.frames; f++) {
        const rawFrame = spec.draw(dir, anim, f);
        if (rawFrame.w !== spec.frameWidth || rawFrame.h !== spec.frameHeight) {
          throw new Error(`${spec.id} ${dir}/${anim}/${f}: ${rawFrame.w}x${rawFrame.h} != ${spec.frameWidth}x${spec.frameHeight}`);
        }
        if (isEmpty(rawFrame)) throw new Error(`${spec.id} ${dir}/${anim}/${f}: frame vazio`);
        raw.push(rawFrame);
        col++;
      }
    }
  }

  // Camadas que precisam se combinar podem fornecer frames completos apenas
  // como referência de alinhamento. A união é calculada sobre referência +
  // camada, mas somente os frames da camada são escritos no atlas final.
  const fitReference = typeof spec.fitReference === 'function' ? spec.fitReference() : [];

  // FX mantem o canvas autorado: seu movimento radial usa de proposito os 16x16
  // inteiros. Sheets de personagem preservam a margem de 2px da Art Bible.
  let frames;
  try {
    if (spec.id.startsWith('fx-')) {
      frames = raw;
    } else if (fitReference.length > 0) {
      frames = fitSpriteToMargin([...fitReference, ...raw], 2).slice(fitReference.length);
    } else {
      frames = fitSpriteToMargin(raw, 2);
    }
  } catch (err) {
    throw new Error(`${spec.id}: ${err.message}`);
  }
  frames.forEach((frame, i) => {
    for (const hex of colorsUsed(frame)) palette.add(hex);
    blitToAtlas(atlas, frame, i % columns, Math.floor(i / columns));
  });

  const png = new PNG({ width: atlas.w, height: atlas.h });
  png.data = Buffer.from(atlas.buf);
  const pngBytes = PNG.sync.write(png, { colorType: 6, inputColorType: 6 });
  writeFileSync(resolve(OUT, `${spec.id}.png`), pngBytes);

  const manifest = {
    id: spec.id,
    version: spec.version,
    atlas: `${spec.id}.png`,
    frameWidth: spec.frameWidth,
    frameHeight: spec.frameHeight,
    columns,
    anchorX: spec.anchorX,
    anchorY: spec.anchorY,
    directions: spec.directions,
    authoredDirs: spec.authoredDirs,
    flipPairs: spec.flipPairs,
    hitbox: spec.hitbox,
    footprint: spec.footprint,
    palette: 'veio-fungico.v01',
    paletteColors: [...palette].sort(),
    animations: spec.animations,
    frameMap,
    generation: {
      tool: 'procedural voxel raster (tools/entities.mjs)',
      prompt: spec.prompt,
      seedOrRef: 'deterministic-code-v2',
    },
  };
  writeFileSync(resolve(OUT, `${spec.id}.json`), `${JSON.stringify(manifest, null, 2)}\n`);
  return { id: spec.id, cols: totalCols, width: atlas.w, height: atlas.h, bytes: pngBytes.byteLength };
};

/**
 * Atlas de blocos de terreno. Sem animacao e sem direcao: o que varia e o tipo,
 * a variante de superficie e o nivel de luz, tudo assado. O cliente escolhe o
 * frame por indice e faz UM drawImage, em vez dos tres fills de poligono que
 * deixavam o cenario chapado ao lado de personagens facetados.
 */
const buildTerrain = () => {
  const bounds = blockBounds();
  const frameWidth = bounds.w;
  const frameHeight = bounds.h;
  const frames = buildTerrainFrames(frameWidth, frameHeight, -bounds.minX, -bounds.minY);
  const columns = Math.min(frames.length, Math.floor(MAX_TEXTURE / frameWidth));
  const rows = Math.ceil(frames.length / columns);
  const atlas = grid(columns * frameWidth, rows * frameHeight);
  const palette = new Set();
  frames.forEach((frame, i) => {
    if (isEmpty(frame)) throw new Error(`terrain-blocks: frame ${i} vazio`);
    for (const hex of colorsUsed(frame)) palette.add(hex);
    blitToAtlas(atlas, frame, i % columns, Math.floor(i / columns));
  });

  const png = new PNG({ width: atlas.w, height: atlas.h });
  png.data = Buffer.from(atlas.buf);
  const pngBytes = PNG.sync.write(png, { colorType: 6, inputColorType: 6 });
  writeFileSync(resolve(OUT, 'terrain-blocks.png'), pngBytes);

  const manifest = {
    id: 'terrain-blocks',
    version: 1,
    atlas: 'terrain-blocks.png',
    frameWidth,
    frameHeight,
    columns,
    // Pixel do frame onde cai a origem do modelo (voxel 0,0,0). O cliente
    // ancora o blit por aqui, entao mudar o modelo nao desalinha o terreno.
    originX: -bounds.minX,
    originY: -bounds.minY,
    kinds: BLOCK_KINDS,
    variants: VARIANTS,
    lightLevels: LIGHT_LEVELS,
    paletteColors: [...palette].sort(),
    generation: { tool: 'procedural voxel raster (tools/terrain.mjs)', seedOrRef: 'deterministic-code-v1' },
  };
  writeFileSync(resolve(OUT, 'terrain-blocks.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  return { id: 'terrain-blocks', cols: frames.length, width: atlas.w, height: atlas.h, bytes: pngBytes.byteLength };
};

/**
 * Atlas de crostas de chao. Mesmo formato do terreno com um eixo a mais — o
 * quadro de animacao — e com o numero de quadros variando POR TIPO, entao o
 * indice do primeiro frame de cada tipo nao sai de uma multiplicacao: e a soma
 * dos tipos anteriores, que o runtime recalcula em `surfaceOffsets`.
 */
const buildSurfaces = () => {
  const bounds = surfaceBounds();
  const frameWidth = bounds.w;
  const frameHeight = bounds.h;
  const frames = buildSurfaceFrames(frameWidth, frameHeight, -bounds.minX, -bounds.minY);
  const columns = Math.min(frames.length, Math.floor(MAX_TEXTURE / frameWidth));
  const rows = Math.ceil(frames.length / columns);
  const atlas = grid(columns * frameWidth, rows * frameHeight);
  const palette = new Set();
  frames.forEach((frame, i) => {
    if (isEmpty(frame)) throw new Error(`surface-tiles: frame ${i} vazio`);
    for (const hex of colorsUsed(frame)) palette.add(hex);
    blitToAtlas(atlas, frame, i % columns, Math.floor(i / columns));
  });

  const png = new PNG({ width: atlas.w, height: atlas.h });
  png.data = Buffer.from(atlas.buf);
  const pngBytes = PNG.sync.write(png, { colorType: 6, inputColorType: 6 });
  writeFileSync(resolve(OUT, 'surface-tiles.png'), pngBytes);

  const manifest = {
    id: 'surface-tiles',
    version: 1,
    atlas: 'surface-tiles.png',
    frameWidth,
    frameHeight,
    columns,
    originX: -bounds.minX,
    originY: -bounds.minY,
    kinds: SURFACE_KINDS,
    variants: VARIANTS,
    lightLevels: LIGHT_LEVELS,
    paletteColors: [...palette].sort(),
    generation: { tool: 'procedural voxel raster (tools/surfaces.mjs)', seedOrRef: 'deterministic-code-v1' },
  };
  writeFileSync(resolve(OUT, 'surface-tiles.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  return { id: 'surface-tiles', cols: frames.length, width: atlas.w, height: atlas.h, bytes: pngBytes.byteLength };
};

const results = [...ENTITY_SPECS, ...PLAYER_LAYER_SPECS].map(buildEntity);
// O terreno fica FORA do index de sprites: nao tem animacao, direcao nem
// frameMap, e o validador de sprites tentaria le-lo como personagem.
const terrainResult = buildTerrain();
/**
 * Atlas de objetos de mundo (Nucleo, plataforma de extracao).
 *
 * Sem variantes e sem niveis de luz: sao pecas UNICAS no mapa e emitem a
 * propria luz. Variar por posicao nao faria sentido — so ha uma de cada — e
 * escurecer com a luz do ambiente esconderia justamente o objetivo da run no
 * canto escuro onde a geracao costuma po-lo.
 */
const buildProps = () => {
  const bounds = propBounds();
  const frameWidth = bounds.w + 4;
  const frameHeight = bounds.h + 4;
  const frames = buildPropFrames(frameWidth, frameHeight, -bounds.minX + 2, -bounds.minY + 2);
  const columns = Math.min(frames.length, Math.floor(MAX_TEXTURE / frameWidth));
  const rows = Math.ceil(frames.length / columns);
  const atlas = grid(columns * frameWidth, rows * frameHeight);
  const palette = new Set();
  frames.forEach((frame, i) => {
    if (isEmpty(frame)) throw new Error(`world-props: frame ${i} vazio`);
    for (const hex of colorsUsed(frame)) palette.add(hex);
    blitToAtlas(atlas, frame, i % columns, Math.floor(i / columns));
  });

  const png = new PNG({ width: atlas.w, height: atlas.h });
  png.data = Buffer.from(atlas.buf);
  const pngBytes = PNG.sync.write(png, { colorType: 6, inputColorType: 6 });
  writeFileSync(resolve(OUT, 'world-props.png'), pngBytes);

  const manifest = {
    id: 'world-props',
    version: 1,
    atlas: 'world-props.png',
    frameWidth,
    frameHeight,
    columns,
    originX: -bounds.minX + 2,
    originY: -bounds.minY + 2,
    kinds: PROP_KINDS,
    paletteColors: [...palette].sort(),
    generation: { tool: 'procedural voxel raster (tools/props.mjs)', seedOrRef: 'deterministic-code-v1' },
  };
  writeFileSync(resolve(OUT, 'world-props.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  return { id: 'world-props', cols: frames.length, width: atlas.w, height: atlas.h, bytes: pngBytes.byteLength };
};

const surfaceResult = buildSurfaces();
const propResult = buildProps();
const index = {
  version: 3,
  generated: 'deterministic-code-v3-layered-player',
  ids: results.map((r) => r.id),
};
writeFileSync(resolve(OUT, 'index.json'), `${JSON.stringify(index, null, 2)}\n`);
console.log('atlases gerados:');
for (const r of [...results, terrainResult, surfaceResult, propResult]) console.log(`  ${r.id.padEnd(32)} ${r.width}x${r.height} (${r.cols} frames, ${r.bytes} bytes)`);
