// Deterministic atlas generator for Voxelyn Survival character and FX sprites.
// Stable filenames are intentional: versioning lives inside each manifest.
import { PNG } from 'pngjs';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { blitToAtlas, colorsUsed, fitToMargin, grid, isEmpty } from './lib.mjs';
import { ANIM_ORDER, ENTITY_SPECS } from './entities.mjs';

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
        // FX keep their authored canvas because their radial motion intentionally
        // uses the full 16x16 area. Character sheets must preserve the Art Bible's
        // two-pixel safe margin in every pose.
        const frame = spec.id.startsWith('fx-') ? rawFrame : fitToMargin(rawFrame, 2);
        if (isEmpty(frame)) throw new Error(`${spec.id} ${dir}/${anim}/${f}: frame vazio`);
        for (const hex of colorsUsed(frame)) palette.add(hex);
        blitToAtlas(atlas, frame, col % columns, Math.floor(col / columns));
        col++;
      }
    }
  }

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

const results = ENTITY_SPECS.map(buildEntity);
const index = {
  version: 2,
  generated: 'deterministic-code-v2',
  ids: results.map((r) => r.id),
};
writeFileSync(resolve(OUT, 'index.json'), `${JSON.stringify(index, null, 2)}\n`);
console.log('atlases gerados:');
for (const r of results) console.log(`  ${r.id.padEnd(24)} ${r.width}x${r.height} (${r.cols} frames, ${r.bytes} bytes)`);
