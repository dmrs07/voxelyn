// Art Bible validator for generated sprite atlases.
import { PNG } from 'pngjs';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ALLOWED_HEX } from './lib.mjs';
import { ANIM_ORDER } from './entities.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIR = resolve(__dirname, '../assets/atlases');
const CANONICAL = {
  'player-prospector': [24, 32],
  'enemy-stalker': [24, 24],
  'enemy-spitter': [24, 24],
  'enemy-spore-bomber': [24, 24],
  'enemy-bruiser': [40, 48],
  'enemy-guardian': [40, 48],
  'fx-projectile-bolt': [16, 16],
  'fx-impact-burst': [16, 16],
};
const REQUIRED_LIVING = ['idle', 'walk', 'attack', 'hit', 'die'];
const MAX_ATLAS_WIDTH = 4096;
const MAX_PNG_BYTES = 512 * 1024;
const MAX_TOTAL_PNG_BYTES = 2.5 * 1024 * 1024;
const MAX_DECODED_BYTES = 24 * 1024 * 1024;

const toHex = (r, g, b) => `#${[r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('')}`;
const framePixels = (png, m, col) => {
  const pixels = [];
  const x0 = col * m.frameWidth;
  for (let y = 0; y < m.frameHeight; y++) {
    for (let x = 0; x < m.frameWidth; x++) {
      const i = (y * png.width + x0 + x) * 4;
      pixels.push([x, y, png.data[i], png.data[i + 1], png.data[i + 2], png.data[i + 3]]);
    }
  }
  return pixels;
};

export const validateManifest = (id) => {
  const errors = [];
  const jsonPath = resolve(DIR, `${id}.json`);
  if (!existsSync(jsonPath)) return [`${id}: manifest ausente`];
  const m = JSON.parse(readFileSync(jsonPath, 'utf8'));
  const pngPath = resolve(DIR, m.atlas);
  if (!existsSync(pngPath)) return [`${id}: atlas ${m.atlas} ausente`];
  const png = PNG.sync.read(readFileSync(pngPath));
  const anims = ANIM_ORDER.filter((a) => m.animations[a]);
  const framesPerDir = anims.reduce((s, a) => s + m.animations[a].frames, 0);
  const expectedCols = framesPerDir * m.authoredDirs.length;
  const expectedW = expectedCols * m.frameWidth;

  const canonical = CANONICAL[id];
  if (canonical && (m.frameWidth !== canonical[0] || m.frameHeight !== canonical[1])) {
    errors.push(`${id}: canvas ${m.frameWidth}x${m.frameHeight} != canônico ${canonical[0]}x${canonical[1]}`);
  }
  if (png.width !== expectedW) errors.push(`${id}: largura ${png.width} != ${expectedW}`);
  if (png.height !== m.frameHeight) errors.push(`${id}: altura ${png.height} != ${m.frameHeight}`);
  if (png.width > MAX_ATLAS_WIDTH) errors.push(`${id}: largura ${png.width} excede ${MAX_ATLAS_WIDTH}`);
  if (statSync(pngPath).size > MAX_PNG_BYTES) errors.push(`${id}: PNG excede 512 KiB`);
  if (!(m.anchorX >= 0 && m.anchorX < m.frameWidth)) errors.push(`${id}: anchorX fora do frame`);
  if (!(m.anchorY >= 0 && m.anchorY < m.frameHeight)) errors.push(`${id}: anchorY fora do frame`);
  if (!m.footprint || !['w', 'h', 'offsetX', 'offsetY'].every((k) => Number.isFinite(m.footprint[k]))) {
    errors.push(`${id}: footprint inválido`);
  } else if (m.footprint.w < 0 || m.footprint.h < 0) errors.push(`${id}: footprint negativo`);

  if (id.startsWith('player-') || id.startsWith('enemy-')) {
    for (const a of REQUIRED_LIVING) if (!m.animations[a]) errors.push(`${id}: animação obrigatória ausente: ${a}`);
    if (m.directions !== 4) errors.push(`${id}: entidade viva deve declarar 4 direções`);
    for (const dir of ['dr', 'dl', 'ur', 'ul']) {
      if (!m.authoredDirs.includes(dir) && !m.flipPairs[dir]) errors.push(`${id}: direção ${dir} não resolvível`);
    }
  }

  for (const dir of m.authoredDirs) {
    if (!m.frameMap[dir]) errors.push(`${id}: frameMap sem ${dir}`);
    else for (const a of anims) if (m.frameMap[dir][a] === undefined) errors.push(`${id}: frameMap[${dir}] sem ${a}`);
  }
  for (const [dst, src] of Object.entries(m.flipPairs)) {
    if (!m.authoredDirs.includes(src)) errors.push(`${id}: flipPairs.${dst} -> ${src} não autorada`);
  }

  const atlasColors = new Set();
  for (let i = 0; i < png.width * png.height; i++) {
    const alpha = png.data[i * 4 + 3];
    // Current engine contract is binary alpha for every atlas. Any translucent cloud
    // must live in a separate runtime FX system rather than the entity sheet.
    if (alpha !== 0 && alpha !== 255) {
      errors.push(`${id}: alpha parcial (${alpha}) no pixel ${i}`);
      break;
    }
    if (alpha === 255) {
      const hex = toHex(png.data[i * 4], png.data[i * 4 + 1], png.data[i * 4 + 2]);
      atlasColors.add(hex);
      if (!ALLOWED_HEX.has(hex)) errors.push(`${id}: cor ${hex} fora da paleta mestra`);
    }
  }
  if (atlasColors.size > 16) errors.push(`${id}: usa ${atlasColors.size} cores; máximo é 16 incluindo outline`);
  for (const hex of atlasColors) if (!m.paletteColors.includes(hex)) errors.push(`${id}: cor ${hex} não declarada`);
  for (const hex of m.paletteColors) if (!atlasColors.has(hex)) errors.push(`${id}: cor declarada ${hex} não usada`);

  for (const dir of m.authoredDirs) {
    for (const anim of anims) {
      const start = m.frameMap[dir][anim];
      const count = m.animations[anim].frames;
      let previousBox = null;
      for (let f = 0; f < count; f++) {
        const pixels = framePixels(png, m, start + f);
        const opaque = pixels.filter((p) => p[5] !== 0);
        if (opaque.length === 0) {
          errors.push(`${id}: frame vazio em ${dir}/${anim}/${f}`);
          continue;
        }
        const xs = opaque.map((p) => p[0]);
        const ys = opaque.map((p) => p[1]);
        const box = { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
        if (box.minX === 0 || box.maxX === m.frameWidth - 1 || box.minY === 0 || box.maxY === m.frameHeight - 1) {
          errors.push(`${id}: conteúdo toca borda em ${dir}/${anim}/${f}`);
        }
        if (previousBox && ['idle', 'walk', 'hit'].includes(anim)) {
          const cx = (box.minX + box.maxX) / 2;
          const pcx = (previousBox.minX + previousBox.maxX) / 2;
          if (Math.abs(cx - pcx) > 3) errors.push(`${id}: jitter horizontal >3px em ${dir}/${anim}/${f}`);
        }
        previousBox = box;
      }
    }
  }
  return [...new Set(errors)];
};

export const listIds = () => JSON.parse(readFileSync(resolve(DIR, 'index.json'), 'utf8')).ids;

if (import.meta.url === `file://${process.argv[1]}`) {
  const ids = listIds();
  let totalErrors = 0;
  let totalBytes = 0;
  let decodedBytes = 0;
  for (const id of ids) {
    const errs = validateManifest(id);
    totalErrors += errs.length;
    const m = JSON.parse(readFileSync(resolve(DIR, `${id}.json`), 'utf8'));
    const pngPath = resolve(DIR, m.atlas);
    if (existsSync(pngPath)) {
      totalBytes += statSync(pngPath).size;
      const png = PNG.sync.read(readFileSync(pngPath));
      decodedBytes += png.width * png.height * 4;
    }
    if (errs.length === 0) console.log(`  OK ${id}`);
    else for (const e of errs) console.error(`  FAIL ${e}`);
  }
  if (totalBytes > MAX_TOTAL_PNG_BYTES) {
    console.error(`  FAIL total PNG ${totalBytes} > ${MAX_TOTAL_PNG_BYTES}`);
    totalErrors++;
  }
  if (decodedBytes > MAX_DECODED_BYTES) {
    console.error(`  FAIL memória decodificada ${decodedBytes} > ${MAX_DECODED_BYTES}`);
    totalErrors++;
  }
  console.log(`\nPNG total: ${totalBytes} bytes; memória RGBA: ${decodedBytes} bytes`);
  if (totalErrors) process.exit(1);
  console.log(`${ids.length} sprites válidos.`);
}
