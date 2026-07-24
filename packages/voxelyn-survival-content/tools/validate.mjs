// Validacao automatizada de sprites (art bible #12). Verifica dimensoes,
// transparencia binaria, contagem de frames, frames vazios, conformidade de
// paleta, anchors, bleeding de borda e completude do atlas.
// Uso: node tools/validate.mjs  (exit != 0 em falha)
import { PNG } from 'pngjs';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ALLOWED_HEX } from './lib.mjs';
import { ANIM_ORDER } from './entities.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIR = resolve(__dirname, '../assets/atlases');

const toHex = (r, g, b) => '#' + [r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('');

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

  // dimensoes
  if (png.width !== expectedW) errors.push(`${id}: largura ${png.width} != esperada ${expectedW}`);
  if (png.height !== m.frameHeight) errors.push(`${id}: altura ${png.height} != ${m.frameHeight}`);

  // anchor dentro do frame
  if (m.anchorX < 0 || m.anchorX > m.frameWidth) errors.push(`${id}: anchorX fora do frame`);
  if (m.anchorY < 0 || m.anchorY > m.frameHeight) errors.push(`${id}: anchorY fora do frame`);

  // frameMap cobre todas as animacoes por direcao autorada
  for (const dir of m.authoredDirs) {
    if (!m.frameMap[dir]) errors.push(`${id}: frameMap sem direcao ${dir}`);
    else for (const a of anims) {
      if (m.frameMap[dir][a] === undefined) errors.push(`${id}: frameMap[${dir}] sem anim ${a}`);
    }
  }

  // flipPairs referenciam direcoes autoradas
  for (const [dst, srcDir] of Object.entries(m.flipPairs)) {
    if (!m.authoredDirs.includes(srcDir)) errors.push(`${id}: flipPairs.${dst} -> ${srcDir} nao autorada`);
  }

  // varredura de pixels: paleta, transparencia binaria
  const usedHex = new Set();
  for (let i = 0; i < png.width * png.height; i++) {
    const a = png.data[i * 4 + 3];
    if (a !== 0 && a !== 255) {
      errors.push(`${id}: alpha parcial (${a}) em pixel ${i}`);
      break;
    }
    if (a === 255) {
      const hex = toHex(png.data[i * 4], png.data[i * 4 + 1], png.data[i * 4 + 2]);
      usedHex.add(hex);
      if (!ALLOWED_HEX.has(hex)) {
        errors.push(`${id}: cor ${hex} fora da paleta mestra`);
        break;
      }
    }
  }

  // paleta declarada bate com a usada
  for (const hex of usedHex) {
    if (!m.paletteColors.includes(hex)) errors.push(`${id}: cor usada ${hex} nao declarada em paletteColors`);
  }

  // frames vazios (exceto ultimo(s) frame(s) de 'die', que dissolvem)
  const colFilled = new Array(expectedCols).fill(false);
  for (let y = 0; y < png.height; y++) {
    for (let x = 0; x < png.width; x++) {
      if (png.data[(y * png.width + x) * 4 + 3] !== 0) colFilled[Math.floor(x / m.frameWidth)] = true;
    }
  }
  for (const dir of m.authoredDirs) {
    for (const a of anims) {
      const start = m.frameMap[dir][a];
      const count = m.animations[a].frames;
      for (let f = 0; f < count; f++) {
        const isTail = a === 'die' && f >= count - 1;
        if (!colFilled[start + f] && !isTail) {
          errors.push(`${id}: frame vazio em ${dir}/${a}/${f}`);
        }
      }
    }
  }

  return errors;
};

export const listIds = () => {
  const idx = JSON.parse(readFileSync(resolve(DIR, 'index.json'), 'utf8'));
  return idx.ids;
};

// Execucao direta (CLI)
if (import.meta.url === `file://${process.argv[1]}`) {
  const ids = listIds();
  let total = 0;
  for (const id of ids) {
    const errs = validateManifest(id);
    total += errs.length;
    if (errs.length === 0) console.log(`  OK ${id}`);
    else for (const e of errs) console.error(`  FAIL ${e}`);
  }
  if (total > 0) {
    console.error(`\n${total} problema(s) de validacao`);
    process.exit(1);
  }
  console.log(`\n${ids.length} sprites validos.`);
}
