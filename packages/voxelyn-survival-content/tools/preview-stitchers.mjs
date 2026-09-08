// Reproducible art review from the actual voxel models, with integer zoom.
// node tools/preview-stitchers.mjs [output directory]
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { STITCHER_SPECS } from './stitchers.mjs';

const out = resolve(process.argv[2] || '../../docs/media/costureiros');
mkdirSync(out, { recursive: true });
const label = (text, width, size = 20, color = '#d5cdba') => ({
  input: Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="42"><text x="12" y="28" font-family="DejaVu Sans,sans-serif" font-size="${size}" fill="${color}">${text}</text></svg>`,
  ),
});
const raster = async (frame, zoom, silhouette) => {
  const pixels = Buffer.from(frame.buf);
  if (silhouette)
    for (let i = 0; i < pixels.length; i += 4)
      if (pixels[i + 3]) {
        pixels[i] = silhouette[0];
        pixels[i + 1] = silhouette[1];
        pixels[i + 2] = silhouette[2];
      }
  return sharp(pixels, { raw: { width: frame.w, height: frame.h, channels: 4 } })
    .resize(frame.w * zoom, frame.h * zoom, { kernel: 'nearest' })
    .png()
    .toBuffer();
};

const [worker, queen] = STITCHER_SPECS;
const board = [];
board.push({
  ...label('COSTUREIROS / modelos voxel em desenvolvimento', 1400, 28),
  left: 24,
  top: 15,
});
board.push({
  ...label('Costureiro: quatro rumos, membros de fixar e puxar', 1400, 18),
  left: 24,
  top: 62,
});
for (let i = 0; i < worker.authoredDirs.length; i++) {
  board.push({
    input: await raster(worker.draw(worker.authoredDirs[i], 'idle', 0), 2),
    left: 42 + i * 342,
    top: 102,
  });
  board.push({
    ...label(worker.authoredDirs[i].toUpperCase(), 200, 16),
    left: 95 + i * 342,
    top: 307,
  });
}
board.push({
  ...label(
    'Cerzideira: oito rumos / diagonais com camera girada, sem reamostrar o modelo',
    1400,
    19,
  ),
  left: 24,
  top: 362,
});
for (let i = 0; i < queen.authoredDirs.length; i++) {
  const x = 20 + (i % 4) * 345;
  const y = 410 + Math.floor(i / 4) * 395;
  board.push({
    input: await raster(queen.draw(queen.authoredDirs[i], 'idle', 0), 2),
    left: x,
    top: y,
  });
  board.push({
    ...label(queen.authoredDirs[i].toUpperCase(), 320, 16),
    left: x + 122,
    top: y + 345,
  });
}
await sharp({ create: { width: 1400, height: 1210, channels: 4, background: '#111720' } })
  .composite(board)
  .png()
  .toFile(resolve(out, '01-criaturas-oito-rumos.png'));

const silhouette = [];
for (const [i, spec] of STITCHER_SPECS.slice(0, 2).entries())
  for (const [j, light] of [false, true].entries()) {
    const x = i * 550;
    const y = j * 405;
    silhouette.push({
      input: await sharp({
        create: { width: 550, height: 405, channels: 4, background: light ? '#e9e3d7' : '#111720' },
      })
        .png()
        .toBuffer(),
      left: x,
      top: y,
    });
    silhouette.push({
      input: await raster(spec.draw('dr', 'idle', 0), 2, light ? [20, 25, 34] : [225, 219, 207]),
      left: x + Math.round((550 - spec.frameWidth * 2) / 2),
      top: y + 25,
    });
    silhouette.push({
      ...label(i ? 'Cerzideira' : 'Costureiro', 500, 20, light ? '#141922' : '#e1dbcf'),
      left: x + 150,
      top: y + 360,
    });
  }
await sharp({ create: { width: 1100, height: 810, channels: 4, background: '#111720' } })
  .composite(silhouette)
  .png()
  .toFile(resolve(out, '02-silhuetas.png'));
console.log(out);

const { blockModel } = await import('./terrain.mjs');
const { surfaceModel } = await import('./surfaces.mjs');
const { renderVoxels, DIR_UNROTATED } = await import('./voxel.mjs');
const materials = [];
materials.push({
  ...label('COSTUREIROS / materias e gesto de costura', 1400, 28),
  left: 24,
  top: 15,
});
for (const [i, kind] of [
  'sutureAnchor',
  'sutureCracked',
  'stitchedRock',
  'mineral-silk',
].entries()) {
  const boxes = i === 3 ? surfaceModel(kind, 0, 0) : blockModel(kind, 0);
  const frame = renderVoxels(boxes, DIR_UNROTATED, 128, 128, 64, 88);
  materials.push({ input: await raster(frame, 2), left: 42 + i * 340, top: 65 });
  materials.push({
    ...label(['Ancora intacta', 'Ancora rachada', 'Rocha costurada', 'Seda mineral'][i], 330, 19),
    left: 42 + i * 340,
    top: 320,
  });
}
for (let i = 0; i < 4; i++) {
  materials.push({
    input: await raster(queen.draw('dr', 'special', i + 1), 2),
    left: 20 + i * 345,
    top: 405,
  });
  materials.push({
    ...label(['Fixar', 'Agulhar', 'Puxar', 'Tensionar'][i], 330, 19),
    left: 90 + i * 345,
    top: 665,
  });
}
await sharp({ create: { width: 1400, height: 740, channels: 4, background: '#111720' } })
  .composite(materials)
  .png()
  .toFile(resolve(out, '03-materiais-e-costura.png'));
