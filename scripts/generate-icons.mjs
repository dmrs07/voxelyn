import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const root = process.cwd();
const sourceSvg = path.join(
  root,
  'node_modules',
  '@phosphor-icons',
  'core',
  'assets',
  'regular',
  'cube.svg'
);
const outputDir = path.join(root, 'packages', 'voxelforge-electron', 'assets');
const outputPng = path.join(outputDir, 'icon.png');

const run = async () => {
  const svgRaw = await fs.readFile(sourceSvg, 'utf8');
  const svg = svgRaw.replace('currentColor', '#8aa2ff');

  await fs.mkdir(outputDir, { recursive: true });

  await sharp(Buffer.from(svg))
    .resize(512, 512, { fit: 'contain' })
    .png()
    .toFile(outputPng);

  console.log(`Icon generated at ${outputPng}`);
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
