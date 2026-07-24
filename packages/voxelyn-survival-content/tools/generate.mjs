// Gerador de atlases de sprites. Desenha frames proceduralmente pela art bible,
// compoe cada entidade num atlas de linha unica e emite PNG + manifest JSON.
// Uso: node tools/generate.mjs
import { PNG } from 'pngjs';
import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { blitToAtlas, colorsUsed, grid, isEmpty } from './lib.mjs';
import { ANIM_ORDER, ENTITY_SPECS } from './entities.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, '../assets/atlases');

const orderedAnims = (spec) => ANIM_ORDER.filter((a) => spec.animations[a]);

const buildEntity = (spec) => {
  const anims = orderedAnims(spec);
  const framesPerDir = anims.reduce((sum, a) => sum + spec.animations[a].frames, 0);
  const totalCols = framesPerDir * spec.authoredDirs.length;

  const atlas = grid(totalCols * spec.frameWidth, spec.frameHeight);
  const frameMap = {};
  const palette = new Set();
  let col = 0;

  for (const dir of spec.authoredDirs) {
    frameMap[dir] = {};
    for (const anim of anims) {
      frameMap[dir][anim] = col;
      const def = spec.animations[anim];
      for (let f = 0; f < def.frames; f++) {
        const frame = spec.draw(dir, anim, f);
        if (frame.w !== spec.frameWidth || frame.h !== spec.frameHeight) {
          throw new Error(`${spec.id} ${dir}/${anim}/${f}: dimensao ${frame.w}x${frame.h} != ${spec.frameWidth}x${spec.frameHeight}`);
        }
        // frames intermediarios de morte podem esvaziar; os demais nao podem
        if (isEmpty(frame) && !(anim === 'die' && f >= def.frames - 1)) {
          throw new Error(`${spec.id} ${dir}/${anim}/${f}: frame vazio`);
        }
        for (const hex of colorsUsed(frame)) palette.add(hex);
        blitToAtlas(atlas, frame, col);
        col++;
      }
    }
  }

  const png = new PNG({ width: atlas.w, height: atlas.h });
  png.data = Buffer.from(atlas.buf);
  writeFileSync(resolve(OUT, `${spec.id}.png`), PNG.sync.write(png));

  const manifest = {
    id: spec.id,
    version: 1,
    atlas: `${spec.id}.png`,
    frameWidth: spec.frameWidth,
    frameHeight: spec.frameHeight,
    anchorX: spec.anchorX,
    anchorY: spec.anchorY,
    directions: spec.directions,
    authoredDirs: spec.authoredDirs,
    flipPairs: spec.flipPairs,
    hitbox: spec.hitbox,
    palette: 'veio-fungico.v01',
    paletteColors: [...palette].sort(),
    animations: spec.animations,
    frameMap,
    generation: {
      tool: 'procedural (tools/entities.mjs)',
      prompt: spec.prompt,
      seedOrRef: 'deterministic-code-v1',
    },
  };
  writeFileSync(resolve(OUT, `${spec.id}.json`), JSON.stringify(manifest, null, 2) + '\n');
  return { id: spec.id, cols: totalCols, size: `${atlas.w}x${atlas.h}` };
};

const results = ENTITY_SPECS.map(buildEntity);
const index = { version: 1, generated: '2026-07-24', ids: results.map((r) => r.id) };
writeFileSync(resolve(OUT, 'index.json'), JSON.stringify(index, null, 2) + '\n');
console.log('atlases gerados:');
for (const r of results) console.log(`  ${r.id.padEnd(22)} ${r.size} (${r.cols} frames)`);
