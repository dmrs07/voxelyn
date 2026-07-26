// Art Bible validator for generated sprite atlases.
import { PNG } from 'pngjs';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ALLOWED_HEX, COLORS } from './lib.mjs';
import { ANIM_ORDER } from './entities.mjs';
import { lightFactor } from './terrain.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIR = resolve(__dirname, '../assets/atlases');
const CANONICAL = {
  'player-prospector': [32, 40],
  'enemy-stalker': [32, 32],
  'enemy-spitter': [32, 32],
  'enemy-spore-bomber': [32, 32],
  'enemy-bruiser': [48, 56],
  'enemy-guardian': [48, 56],
  'fx-projectile-bolt': [16, 16],
  'fx-impact-burst': [16, 16],
};
const REQUIRED_LIVING = ['idle', 'walk', 'attack', 'hit', 'die'];
const MAX_ATLAS_WIDTH = 4096;
const MAX_PNG_BYTES = 512 * 1024;
const MAX_TOTAL_PNG_BYTES = 2.5 * 1024 * 1024;
const MAX_DECODED_BYTES = 24 * 1024 * 1024;

const toHex = (r, g, b) => `#${[r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('')}`;
const framePixels = (png, m, index) => {
  const pixels = [];
  const columns = m.columns ?? Number.MAX_SAFE_INTEGER;
  const x0 = (index % columns) * m.frameWidth;
  const y0 = Math.floor(index / columns) * m.frameHeight;
  for (let y = 0; y < m.frameHeight; y++) {
    for (let x = 0; x < m.frameWidth; x++) {
      const i = ((y0 + y) * png.width + x0 + x) * 4;
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
  const totalFrames = framesPerDir * m.authoredDirs.length;
  const columns = m.columns ?? totalFrames;
  const expectedW = Math.min(totalFrames, columns) * m.frameWidth;
  const expectedRows = Math.ceil(totalFrames / columns);
  const expectedH = expectedRows * m.frameHeight;

  const canonical = CANONICAL[id];
  if (canonical && (m.frameWidth !== canonical[0] || m.frameHeight !== canonical[1])) {
    errors.push(`${id}: canvas ${m.frameWidth}x${m.frameHeight} != canônico ${canonical[0]}x${canonical[1]}`);
  }
  if (png.width !== expectedW) errors.push(`${id}: largura ${png.width} != ${expectedW}`);
  if (png.height !== expectedH) errors.push(`${id}: altura ${png.height} != ${expectedH}`);
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

/**
 * O atlas de terreno tem regras proprias: os niveis de luz sao assados, entao as
 * cores NAO sao a paleta mestra pura — sao multiplos dela. O que precisa valer e
 * que toda cor derive de uma cor da paleta por um dos fatores de luz assados, e
 * que o atlas caiba na textura.
 */
export const validateTerrain = () => {
  const errors = [];
  const jsonPath = resolve(DIR, 'terrain-blocks.json');
  if (!existsSync(jsonPath)) return ['terrain-blocks: manifest ausente'];
  const m = JSON.parse(readFileSync(jsonPath, 'utf8'));
  const pngPath = resolve(DIR, m.atlas);
  if (!existsSync(pngPath)) return [`terrain-blocks: atlas ${m.atlas} ausente`];
  const png = PNG.sync.read(readFileSync(pngPath));

  const total = m.kinds.length * m.variants * m.lightLevels;
  const expectedW = Math.min(total, m.columns) * m.frameWidth;
  const expectedH = Math.ceil(total / m.columns) * m.frameHeight;
  if (png.width !== expectedW) errors.push(`terrain-blocks: largura ${png.width} != ${expectedW}`);
  if (png.height !== expectedH) errors.push(`terrain-blocks: altura ${png.height} != ${expectedH}`);
  if (png.width > MAX_ATLAS_WIDTH) errors.push(`terrain-blocks: largura ${png.width} excede ${MAX_ATLAS_WIDTH}`);
  if (statSync(pngPath).size > MAX_PNG_BYTES) errors.push('terrain-blocks: PNG excede 512 KiB');
  if (!(m.originX >= 0 && m.originX < m.frameWidth)) errors.push('terrain-blocks: originX fora do frame');
  if (!(m.originY >= 0 && m.originY < m.frameHeight)) errors.push('terrain-blocks: originY fora do frame');

  // Toda cor tem de ser uma cor da paleta mestra escurecida por um dos fatores
  // assados. Assim uma cor inventada a mao nao entra sem passar pelo gerador.
  const derived = new Set();
  for (let level = 0; level < m.lightLevels; level++) {
    // Importado do gerador, nao copiado: uma formula duplicada aqui deixaria a
    // validacao passar em silencio depois de mudarem os niveis de luz.
    const f = lightFactor(level);
    for (const [r, g, b] of Object.values(COLORS)) {
      derived.add(toHex(
        Math.max(0, Math.min(255, Math.round(r * f))),
        Math.max(0, Math.min(255, Math.round(g * f))),
        Math.max(0, Math.min(255, Math.round(b * f)))
      ));
    }
  }
  const seen = new Set();
  for (let i = 0; i < png.width * png.height; i++) {
    const alpha = png.data[i * 4 + 3];
    if (alpha !== 0 && alpha !== 255) { errors.push(`terrain-blocks: alpha parcial (${alpha})`); break; }
    if (alpha === 255) seen.add(toHex(png.data[i * 4], png.data[i * 4 + 1], png.data[i * 4 + 2]));
  }
  for (const hex of seen) if (!derived.has(hex)) errors.push(`terrain-blocks: cor ${hex} nao deriva da paleta mestra`);

  // Cada frame tem de ter conteudo: um bloco vazio vira buraco no cenario.
  for (let index = 0; index < total; index++) {
    const x0 = (index % m.columns) * m.frameWidth;
    const y0 = Math.floor(index / m.columns) * m.frameHeight;
    let opaque = 0;
    for (let y = 0; y < m.frameHeight && opaque === 0; y++) {
      for (let x = 0; x < m.frameWidth; x++) {
        if (png.data[((y0 + y) * png.width + x0 + x) * 4 + 3] !== 0) { opaque++; break; }
      }
    }
    if (opaque === 0) errors.push(`terrain-blocks: frame ${index} vazio`);
  }
  return [...new Set(errors)];
};

export const listIds = () => JSON.parse(readFileSync(resolve(DIR, 'index.json'), 'utf8')).ids;

if (import.meta.url === `file://${process.argv[1]}`) {
  const ids = listIds();
  let totalErrors = 0;
  let totalBytes = 0;
  let decodedBytes = 0;
  const terrainErrs = validateTerrain();
  totalErrors += terrainErrs.length;
  if (terrainErrs.length === 0) console.log('  OK terrain-blocks');
  else for (const e of terrainErrs) console.error(`  FAIL ${e}`);
  {
    const tp = resolve(DIR, 'terrain-blocks.png');
    if (existsSync(tp)) {
      totalBytes += statSync(tp).size;
      const tpng = PNG.sync.read(readFileSync(tp));
      decodedBytes += tpng.width * tpng.height * 4;
    }
  }
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
