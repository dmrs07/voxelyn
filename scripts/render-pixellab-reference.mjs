import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const sharp = require('sharp');
const { PNG } = require('pngjs');

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataPath = path.join(root, 'docs/concept-art/sprite-data-authored-v2.js');
const outDir = path.join(root, 'docs/concept-art/pixellab-reference');

const characters = [
  { id: 'excavator', sourceName: 'Excavator', label: 'Excavator', concept: 'assets/concepts/characters/excavator.png' },
  { id: 'striker', sourceName: 'Stalker', label: 'Striker', concept: 'assets/concepts/characters/striker.png' },
  { id: 'bruiser', sourceName: 'Bruiser', label: 'Bruiser', concept: 'assets/concepts/characters/bruiser.png' },
  { id: 'spitter', sourceName: 'Spitter', label: 'Spitter', concept: 'assets/concepts/characters/spitter.png' },
  { id: 'spore_bomber', sourceName: 'Spore Bomber', label: 'Spore Bomber', concept: 'assets/concepts/characters/spore_bomber.png' },
  { id: 'guardian', sourceName: 'Guardian', label: 'Guardian', concept: 'assets/concepts/characters/guardian.png' },
];

const facings = ['DR', 'DL', 'UR', 'UL'];
const showcasePoses = ['idle_a', 'walk_a', 'atk_strike', 'hit'];

const escapeXml = (value) =>
  String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');

const loadSprites = async () => {
  const source = await readFile(dataPath, 'utf8');
  const sandbox = { window: {} };
  vm.runInNewContext(source, sandbox, { filename: dataPath });
  return sandbox.window.VOXELYN_SPRITES_V2;
};

const colorToRgba = (color) => {
  if (!color || color === 'transparent') return [0, 0, 0, 0];
  const hex = color.replace('#', '');
  return [
    Number.parseInt(hex.slice(0, 2), 16),
    Number.parseInt(hex.slice(2, 4), 16),
    Number.parseInt(hex.slice(4, 6), 16),
    255,
  ];
};

const drawGridInto = (png, grid, palette, offsetX, offsetY, scale) => {
  for (let y = 0; y < grid.length; y += 1) {
    const row = grid[y];
    for (let x = 0; x < row.length; x += 1) {
      const color = colorToRgba(palette[Number(row[x])]);
      if (color[3] === 0) continue;
      for (let sy = 0; sy < scale; sy += 1) {
        for (let sx = 0; sx < scale; sx += 1) {
          const px = offsetX + x * scale + sx;
          const py = offsetY + y * scale + sy;
          if (px < 0 || py < 0 || px >= png.width || py >= png.height) continue;
          const index = (py * png.width + px) * 4;
          png.data[index] = color[0];
          png.data[index + 1] = color[1];
          png.data[index + 2] = color[2];
          png.data[index + 3] = color[3];
        }
      }
    }
  }
};

const renderPose = (sprite, facing, pose, scale) => {
  const frameSize = 48;
  const png = new PNG({ width: frameSize * scale, height: frameSize * scale });
  png.data.fill(0);
  const grid = sprite.poses[`${facing}:${pose}`] ?? sprite.poses[`DR:${pose}`] ?? sprite.poses[`${facing}:idle_a`];
  if (!grid) return PNG.sync.write(png);

  const gridWidth = grid[0].length;
  const gridHeight = grid.length;
  const anchorX = 24;
  const anchorY = 43;
  const offsetX = Math.round((anchorX - gridWidth / 2) * scale);
  const offsetY = Math.round((anchorY - gridHeight) * scale);
  drawGridInto(png, grid, sprite.palette, offsetX, offsetY, scale);
  return PNG.sync.write(png);
};

const svgText = ({ width, height, text, x, y, size, weight = 700, fill = '#172033', letterSpacing = 0 }) => Buffer.from(`
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
  <style>
    text { font-family: Inter, Arial, sans-serif; dominant-baseline: hanging; }
  </style>
  <text x="${x}" y="${y}" font-size="${size}" font-weight="${weight}" fill="${fill}" letter-spacing="${letterSpacing}">${escapeXml(text)}</text>
</svg>`);

const makeBase = (width, height, background) =>
  sharp({
    create: {
      width,
      height,
      channels: 4,
      background,
    },
  });

const renderSpriteOnly = async (sprite, id) => {
  const scale = 4;
  const width = 960;
  const height = 384;
  const composites = [];

  for (let i = 0; i < facings.length; i += 1) {
    composites.push({
      input: renderPose(sprite, facings[i], 'idle_a', scale),
      left: 64 + i * 216,
      top: 24,
    });
  }

  for (let i = 0; i < showcasePoses.length; i += 1) {
    composites.push({
      input: renderPose(sprite, 'DR', showcasePoses[i], scale),
      left: 64 + i * 216,
      top: 192,
    });
  }

  const output = await makeBase(width, height, { r: 0, g: 0, b: 0, alpha: 0 })
    .composite(composites)
    .png()
    .toBuffer();

  await writeFile(path.join(outDir, `${id}-sprite-only-v1.png`), output);
};

const renderAnnotatedReference = async (sprite, character) => {
  const width = 1280;
  const height = 760;
  const scale = 4;
  const conceptBuffer = await sharp(path.join(root, character.concept))
    .resize(330, 330, { fit: 'contain', background: { r: 246, g: 247, b: 242, alpha: 1 } })
    .png()
    .toBuffer();

  const composites = [
    { input: svgText({ width, height, text: `VOXELYN ${character.label.toUpperCase()}`, x: 56, y: 42, size: 42 }), left: 0, top: 0 },
    { input: svgText({ width, height, text: 'concept + 48px isometric sprite read', x: 60, y: 92, size: 18, weight: 500, fill: '#667085' }), left: 0, top: 0 },
    { input: conceptBuffer, left: 58, top: 170 },
    { input: svgText({ width, height, text: 'CONCEPT', x: 64, y: 520, size: 16, weight: 800, fill: '#667085', letterSpacing: 2 }), left: 0, top: 0 },
  ];

  for (let i = 0; i < facings.length; i += 1) {
    composites.push({
      input: renderPose(sprite, facings[i], 'idle_a', scale),
      left: 465 + i * 185,
      top: 145,
    });
    composites.push({
      input: svgText({ width, height, text: facings[i], x: 535 + i * 185, y: 352, size: 18, weight: 800, fill: '#667085', letterSpacing: 2 }),
      left: 0,
      top: 0,
    });
  }

  for (let i = 0; i < showcasePoses.length; i += 1) {
    composites.push({
      input: renderPose(sprite, 'DR', showcasePoses[i], scale),
      left: 465 + i * 185,
      top: 430,
    });
  }

  composites.push({
    input: svgText({ width, height, text: 'IDLE / WALK / ATTACK / HIT', x: 500, y: 636, size: 16, weight: 800, fill: '#667085', letterSpacing: 2 }),
    left: 0,
    top: 0,
  });

  const output = await makeBase(width, height, { r: 246, g: 247, b: 242, alpha: 1 })
    .composite(composites)
    .png()
    .toBuffer();

  await writeFile(path.join(outDir, `${character.id}-reference-v1.png`), output);
};

const renderCombinedSheet = async (spritesByName) => {
  const width = 1600;
  const rowHeight = 300;
  const height = rowHeight * characters.length + 120;
  const composites = [
    { input: svgText({ width, height, text: 'VOXELYN PIXELLAB SPRITE REFERENCES', x: 56, y: 36, size: 38 }), left: 0, top: 0 },
  ];

  for (let row = 0; row < characters.length; row += 1) {
    const character = characters[row];
    const sprite = spritesByName.get(character.sourceName);
    const y = 110 + row * rowHeight;
    const conceptBuffer = await sharp(path.join(root, character.concept))
      .resize(190, 190, { fit: 'contain', background: { r: 246, g: 247, b: 242, alpha: 1 } })
      .png()
      .toBuffer();
    composites.push({ input: svgText({ width, height, text: character.label, x: 58, y: y + 20, size: 28 }), left: 0, top: 0 });
    composites.push({ input: conceptBuffer, left: 60, top: y + 70 });

    for (let i = 0; i < facings.length; i += 1) {
      composites.push({
        input: renderPose(sprite, facings[i], 'idle_a', 4),
        left: 330 + i * 205,
        top: y + 32,
      });
    }
    for (let i = 0; i < showcasePoses.length; i += 1) {
      composites.push({
        input: renderPose(sprite, 'DR', showcasePoses[i], 3),
        left: 1160 + i * 95,
        top: y + 60,
      });
    }
  }

  const output = await makeBase(width, height, { r: 246, g: 247, b: 242, alpha: 1 })
    .composite(composites)
    .png()
    .toBuffer();

  await writeFile(path.join(outDir, 'voxelyn-pixellab-reference-sheet-v1.png'), output);
};

const run = async () => {
  await mkdir(outDir, { recursive: true });
  const sprites = await loadSprites();
  const spritesByName = new Map(sprites.map((sprite) => [sprite.name, sprite]));

  for (const character of characters) {
    const sprite = spritesByName.get(character.sourceName);
    if (!sprite) throw new Error(`Missing authored sprite data for ${character.sourceName}`);
    await renderSpriteOnly(sprite, character.id);
    await renderAnnotatedReference(sprite, character);
  }

  await renderCombinedSheet(spritesByName);
  console.log(`Wrote PixelLab references to ${path.relative(root, outDir)}`);
};

run().catch((error) => {
  console.error(error.stack ?? String(error));
  process.exit(1);
});
