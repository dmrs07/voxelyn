// Deterministic atlas generator for Voxelyn Survival character and FX sprites.
// Stable filenames are intentional: versioning lives inside each manifest.
import { PNG } from 'pngjs';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { blitToAtlas, colorsUsed, fitSpriteToMargin, grid, isEmpty } from './lib.mjs';
import { ANIM_ORDER, ENTITY_SPECS } from './entities.mjs';
import { withFaceCapture } from './voxel.mjs';
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

/**
 * Divisor de resolucao do MAPA DE FACES.
 *
 * A mesma razao do halo de emissivo no cliente (`GLOW_SCALE`), e pelo mesmo
 * motivo: o dado e de BAIXA FREQUENCIA. O mapa nao carrega arte — carrega qual
 * das tres faces do cubo pintou cada pixel —, e uma face de voxel mede no
 * minimo 4x2 pixels na grade fina, entao ela sobrevive inteira a metade da
 * resolucao. O que se perde e um pixel de precisao NA FRONTEIRA entre duas
 * faces, e ali as duas recebem luz parecida de qualquer forma.
 *
 * O que se ganha nao e disco (o mapa tem tres cores e comprime a quase nada) —
 * e MEMORIA DE VIDEO. Os atlas do jogo ja somam 139 MB decodificados; um mapa
 * de faces em resolucao cheia por sprite dobraria isso num PWA que precisa
 * rodar em celular. Em meia resolucao ele custa um quarto.
 */
const NORMAL_SCALE = 2;

/**
 * Reduz um frame de faces a metade, por MAIORIA e nao por amostragem.
 *
 * Amostrar um pixel de cada quatro escolheria a face do canto superior
 * esquerdo do bloco, o que desloca sistematicamente toda fronteira meio pixel
 * para a mesma direcao — nas bordas de um corpo inteiro isso vira um viés
 * visivel de iluminacao. A maioria escolhe a face que de fato domina o bloco, e
 * empate resolve pela ordem topo > esquerda > direita, que e deterministica.
 *
 * Alpha zero so quando os QUATRO sao vazios: um pixel de silhueta perdido aqui
 * viraria um furo sem luz no meio do corpo.
 */
const halveFaces = (frame) => {
  const w = Math.ceil(frame.w / NORMAL_SCALE);
  const h = Math.ceil(frame.h / NORMAL_SCALE);
  const out = grid(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const votes = [0, 0, 0];
      for (let sy = 0; sy < NORMAL_SCALE; sy++) {
        for (let sx = 0; sx < NORMAL_SCALE; sx++) {
          const px = x * NORMAL_SCALE + sx;
          const py = y * NORMAL_SCALE + sy;
          if (px >= frame.w || py >= frame.h) continue;
          const i = (py * frame.w + px) * 4;
          if (frame.buf[i + 3] === 0) continue;
          // O canal aceso E a face: vermelho topo, verde esquerda, azul direita.
          if (frame.buf[i] > 0) votes[0]++;
          else if (frame.buf[i + 1] > 0) votes[1]++;
          else if (frame.buf[i + 2] > 0) votes[2]++;
        }
      }
      const total = votes[0] + votes[1] + votes[2];
      if (total === 0) continue;
      let best = 0;
      if (votes[1] > votes[best]) best = 1;
      if (votes[2] > votes[best]) best = 2;
      const o = (y * w + x) * 4;
      out.buf[o + best] = 255;
      out.buf[o + 3] = 255;
    }
  }
  return out;
};

/**
 * FX nao recebem luz do mundo: eles a EMITEM. Um mapa de faces para a chama do
 * ciclone seria peso de memoria para iluminar o que ja e a fonte.
 */
const wantsNormalMap = (spec) => !spec.id.startsWith('fx-');

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
  /**
   * Os MESMOS frames, pintados por face em vez de por material.
   *
   * Desenhados no mesmo laco e nao numa segunda varredura: qualquer estado que
   * o modelo carregue entre chamadas (e ha — animacoes derivam pose de `f`)
   * fica identico entre os dois, e a garantia de silhueta igual pixel a pixel
   * nasce de os dois virem do mesmo `spec.draw` com os mesmos argumentos.
   */
  const rawFaces = [];
  const withNormal = wantsNormalMap(spec);
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
        if (withNormal) rawFaces.push(withFaceCapture(() => spec.draw(dir, anim, f)));
        col++;
      }
    }
  }

  // Camadas que precisam se combinar podem fornecer frames completos apenas
  // como referência de alinhamento. A união é calculada sobre referência +
  // camada, mas somente os frames da camada são escritos no atlas final.
  const fitReference = typeof spec.fitReference === 'function' ? spec.fitReference() : [];

  // FX mantem o canvas autorado: seu movimento radial usa de proposito o frame
  // inteiro. Sheets de personagem preservam a margem de 2px da Art Bible. A
  // margem NAO escala com MODEL_SCALE: ela e uma guarda absoluta contra recorte
  // na borda do frame, nao uma medida de mundo — e a grade fina projeta ate 2px
  // alem do dobro em cada lado (as diagonais finas caem ENTRE as grossas),
  // entao dobrar a margem estouraria justamente os sprites mais apertados.
  const margin = 2;
  let frames;
  let faceFrames = [];
  try {
    if (spec.id.startsWith('fx-')) {
      frames = raw;
    } else {
      // Os frames de FACE entram no MESMO enquadramento, e nao num paralelo.
      //
      // `fitSpriteToMargin` deriva UM deslocamento da uniao das caixas de todos
      // os frames que recebe. Enquadrar os dois conjuntos separadamente daria o
      // mesmo numero hoje — as silhuetas sao identicas — e continuaria dando ate
      // o dia em que nao desse, por um pixel, num sprite so. Um mapa de faces
      // deslocado um pixel do sprite ilumina a face errada na borda de cada
      // volume, e o defeito apareceria como um contorno sujo que ninguem
      // associaria ao enquadramento. Passando juntos, o deslocamento e o mesmo
      // por construcao.
      const fitted = fitSpriteToMargin([...fitReference, ...raw, ...rawFaces], margin);
      frames = fitted.slice(fitReference.length, fitReference.length + raw.length);
      faceFrames = fitted.slice(fitReference.length + raw.length);
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

  // O ATLAS DE FACES, em meia resolucao e na mesma grade de frames do sprite:
  // mesma contagem de colunas, mesma ordem, so as dimensoes divididas. O
  // cliente recorta o frame com o mesmo `frameMap`, dividindo o retangulo pela
  // escala publicada no manifest.
  let normalBytes = 0;
  if (withNormal && faceFrames.length > 0) {
    const half = faceFrames.map(halveFaces);
    const normalAtlas = grid(
      columns * Math.ceil(spec.frameWidth / NORMAL_SCALE),
      rows * Math.ceil(spec.frameHeight / NORMAL_SCALE),
    );
    half.forEach((frame, i) => blitToAtlas(normalAtlas, frame, i % columns, Math.floor(i / columns)));
    const normalPng = new PNG({ width: normalAtlas.w, height: normalAtlas.h });
    normalPng.data = Buffer.from(normalAtlas.buf);
    const bytes = PNG.sync.write(normalPng, { colorType: 6, inputColorType: 6 });
    writeFileSync(resolve(OUT, `${spec.id}.normal.png`), bytes);
    normalBytes = bytes.byteLength;
  }

  const manifest = {
    id: spec.id,
    version: spec.version,
    atlas: `${spec.id}.png`,
    /**
     * O mapa de faces deste sprite, quando ha um. Ausente = o cliente cai na
     * iluminacao por silhueta, que continua correta, so menos informativa.
     */
    ...(normalBytes > 0
      ? { normalAtlas: `${spec.id}.normal.png`, normalScale: NORMAL_SCALE }
      : {}),
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
  return {
    id: spec.id,
    cols: totalCols,
    width: atlas.w,
    height: atlas.h,
    bytes: pngBytes.byteLength,
    normalBytes,
  };
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
    // 3: rocha por ESTRATO — seis peles novas da parede comum no fim da lista
    // (prismatica, aquifera, sulfurosa, fornalha, silica, glacial). Fragil,
    // minerio e cristal continuam universais: sao linguagem mecanica.
    // 4: a pele do Estrato FERRIFERO (rockFerric) entra no fim da lista.
    version: 4,
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
    // 5: segunda leva de estratos — fissura incandescente da Fornalha
    // (SURF_EMBER) e gelo da Cripta Glacial (SURF_ICE), no fim da lista.
    // 6: trilhos da operacao (SURF_RAIL 11 horizontal, SURF_RAIL_V 12
    // vertical) — a crosta da armadilha de carrinho.
    // 7: silica solta (SURF_SILT 13) e vidro (SURF_GLASS 14), os dois lados do
    // contra-jogo do Devorador Branco.
    version: 7,
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
    // 2: grade voxel subdividida (MODEL_SCALE) — frame dobrado.
    // 3: props DECORATIVOS volumetricos (decor:<kind>:<variante>) no fim da
    // lista — fumarolas, monolitos, a broca e demais pecas com massa deixam
    // o desenho de runtime e viram modelos rasterizados de verdade.
    // 4: PORTAIS por bioma (portal:<chave>, 10 chaves animadas) + o poco
    // SELADO da extracao de retorno (portal:sealed) no fim da lista; o
    // `descent` continua no atlas como fallback.
    version: 4,
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
