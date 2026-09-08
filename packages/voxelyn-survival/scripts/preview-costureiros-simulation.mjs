// Review board from real simulation state, atlas frames and appendSutureDraws.
// This is an annotated cutaway, not a browser screenshot.
import { build } from 'esbuild';
import sharp from 'sharp';
import { readFile, writeFile, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const out = resolve(process.argv[2] ?? resolve(root, 'docs/media/costureiros'));
await mkdir(out, { recursive: true });
const temp = await mkdtemp(resolve(tmpdir(), 'costureiros-review-'));
const entry = resolve(temp, 'engine.mjs');
await build({
  stdin: {
    contents: `export { createArenaRun } from './packages/voxelyn-survival/src/client/arena-setup.ts'; export { appendSutureDraws } from './packages/voxelyn-survival/src/client/suture-presentation.ts'; export * from './packages/voxelyn-survival-sim/src/index.ts';`,
    resolveDir: root,
  },
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: entry,
  alias: {
    '@voxelyn/survival-sim': resolve(root, 'packages/voxelyn-survival-sim/src/index.ts'),
    '@voxelyn/core': resolve(root, 'packages/voxelyn-core/src/index.ts'),
  },
});
const engine = await import(pathToFileURL(entry).href);
const state = engine.createArenaRun({
  boss: 'seamstress',
  maxHp: 200,
  ability: 'pulse',
  modules: [],
  stabilisers: false,
});
const queen = state.enemies.find((e) => e.archetype === 'seamstress');
const suture = state.sutures
  .filter((s) => s.kind === 'roof')
  .sort((a, b) => {
    const pa = engine.suturePoint(state, a.cells[0]),
      pb = engine.suturePoint(state, b.cells[0]);
    return Math.hypot(pa.x - queen.x, pa.y - queen.y) - Math.hypot(pb.x - queen.x, pb.y - queen.y);
  })[0];
if (!suture) throw new Error('Arena sem carga suspensa');
const center = engine.suturePoint(state, suture.cells[Math.floor(suture.cells.length / 2)]);
state.tick = 100;
queen.mood = suture.id + 1;
// Controlled positions expose the interaction clearly; terrain and recipe are unchanged.
queen.x = center.x + 2;
queen.y = center.y - 2;
state.player.x = center.x + 2;
state.player.y = center.y + 2;
const frames = [];
const events = [];
for (const [label, tick] of [
  ['AMARRA SOB CARGA', 100],
  ['CORTE / AVISO', 100],
  ['CHICOTE / 0,8 s', 116],
  ['QUEDA / 1,6 s', 132],
]) {
  if (frames.length === 1) engine.cutSuture(state, suture, events, 0);
  state.tick = tick;
  engine.stepSutures(state, events);
  frames.push({ state: structuredClone(state), label });
}
const atlasDir = resolve(root, 'packages/voxelyn-survival-content/assets/atlases');
const terrain = JSON.parse(await readFile(resolve(atlasDir, 'terrain-blocks.json'), 'utf8'));
const defs = new Map();
const sprite = async (id, index, m, scale = 0.5) => {
  const key = id + '-' + index;
  if (!defs.has(key)) {
    const png = await sharp(resolve(atlasDir, id + '.png'))
      .extract({
        left: (index % m.columns) * m.frameWidth,
        top: Math.floor(index / m.columns) * m.frameHeight,
        width: m.frameWidth,
        height: m.frameHeight,
      })
      .resize(Math.round(m.frameWidth * scale), Math.round(m.frameHeight * scale), {
        kernel: 'nearest',
      })
      .png()
      .toBuffer();
    defs.set(
      key,
      `<image id="${key}" width="${Math.round(m.frameWidth * scale)}" height="${Math.round(m.frameHeight * scale)}" href="data:image/png;base64,${png.toString('base64')}"/>`,
    );
  }
  return key;
};
class ReviewCanvas {
  output = [];
  path = '';
  stack = [];
  strokeStyle = '#fff';
  fillStyle = '#fff';
  lineWidth = 1;
  save() {
    this.stack.push([this.strokeStyle, this.fillStyle, this.lineWidth]);
  }
  restore() {
    [this.strokeStyle, this.fillStyle, this.lineWidth] = this.stack.pop();
  }
  beginPath() {
    this.path = '';
  }
  moveTo(x, y) {
    this.path += `M${x},${y}`;
  }
  lineTo(x, y) {
    this.path += `L${x},${y}`;
  }
  closePath() {
    this.path += 'Z';
  }
  stroke() {
    this.output.push(
      `<path d="${this.path}" fill="none" stroke="${this.strokeStyle}" stroke-width="${this.lineWidth}"/>`,
    );
  }
  fillRect(x, y, width, height) {
    this.output.push(
      `<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="${this.fillStyle}"/>`,
    );
  }
}
const boards = [];
const w = state.config.width;
for (const [n, frame] of frames.entries()) {
  const ox = 28 + (n % 2) * 660,
    oy = 110 + Math.floor(n / 2) * 480;
  const project = (x, y) => [
    ox + 320 + (x - center.x - y + center.y) * 16,
    oy + 205 + (x - center.x + y - center.y) * 8,
  ];
  const ctx = new ReviewCanvas(),
    items = [];
  boards.push(
    `<rect x="${ox}" y="${oy}" width="640" height="454" rx="8" fill="#151d26"/><text x="${ox + 20}" y="${oy + 32}" class="label">0${n + 1} / ${frame.label}</text>`,
  );
  for (let y = Math.floor(center.y) - 7; y <= Math.floor(center.y) + 7; y++)
    for (let x = Math.floor(center.x) - 7; x <= Math.floor(center.x) + 7; x++) {
      if (x < 1 || y < 1 || x >= w - 1 || y >= state.config.height - 1) continue;
      const [sx, sy] = project(x + 0.5, y + 0.5),
        solid = frame.state.solid[y * w + x];
      ctx.output.push(
        `<path d="M${sx},${sy - 8}l16,8 -16,8 -16,-8Z" fill="${solid ? '#17202c' : '#202d37'}" stroke="#283540" stroke-width=".4"/>`,
      );
      // Front walls are cut away to expose cable height and floor warnings.
      if (solid && (x + y < center.x + center.y + 1 || solid >= 15)) {
        const kind = solid === 15 ? 17 : solid === 16 ? 18 : solid === 17 ? 19 : 0;
        const index = kind * 3 * 8 + 5;
        const key = await sprite('terrain-blocks', index, terrain);
        items.push({
          depth: x + y + 1,
          draw: () =>
            ctx.output.push(
              `<use href="#${key}" x="${sx - terrain.originX * 0.5}" y="${sy - terrain.originY * 0.5}"/>`,
            ),
        });
      }
    }
  for (const e of [frame.state.player, ...frame.state.enemies]) {
    if (!e.alive || Math.hypot(e.x - center.x, e.y - center.y) > 8) continue;
    const id =
      e === frame.state.player
        ? 'player-prospector'
        : e.archetype === 'seamstress'
          ? 'enemy-seamstress'
          : 'enemy-stitcher';
    const manifest = JSON.parse(await readFile(resolve(atlasDir, id + '.json'), 'utf8'));
    const animation =
      e.archetype === 'seamstress' && e.stunnedUntil > frame.state.tick ? 'hit' : 'idle';
    const index = manifest.frameMap.dr[animation];
    const key = await sprite(id, index, manifest);
    const [sx, sy] = project(e.x, e.y);
    const lift = e.archetype === 'seamstress' && e.mood ? 4 : 0;
    items.push({
      depth: e.x + e.y,
      draw: () =>
        ctx.output.push(
          `<ellipse cx="${sx}" cy="${sy}" rx="14" ry="7" fill="#080c12"/><use href="#${key}" x="${sx - manifest.anchorX * 0.5}" y="${sy - manifest.anchorY * 0.5 - lift}"/>`,
        ),
    });
  }
  engine.appendSutureDraws(ctx, frame.state, items, project, 1, (x, y) =>
    Math.abs(x - center.x) <= 7 && Math.abs(y - center.y) <= 7 ? 1 : 0,
  );
  items.sort((a, b) => a.depth - b.depth).forEach((item) => item.draw());
  boards.push(ctx.output.join(''));
  const desc = [
    'A carga pende do fio. O corpo da Cerzideira usa uma amarra.',
    'O corte derruba a Cerzideira; marcas indicam chicote e queda.',
    'O fio chicoteia. As cruzes continuam avisando a queda da massa.',
    'A carga cai. A Cerzideira continua exposta até completar 3 s.',
  ][n];
  boards.push(
    `<text x="${ox + 20}" y="${oy + 412}" class="small">${desc}</text><text x="${ox + 20}" y="${oy + 435}" class="tiny">tick ${frame.state.tick} · sutura ${frame.state.sutures.find((s) => s.id === suture.id).phase}</text>`,
  );
}
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1376" height="1100"><style>text{font-family:DejaVu Sans,sans-serif;fill:#ddd5c6}.label{font-size:18px}.small{font-size:15px}.tiny{font-size:13px;fill:#95a5b6}</style><defs>${[...defs.values()].join('')}</defs><rect width="1376" height="1100" fill="#0d131c"/><text x="28" y="44" font-size="28">COSTUREIROS / cortar muda o combate</text><text x="28" y="78" class="small">Ensaio da simulação · seed 36 · atlas e desenho de suturas reais · cenário em corte</text>${boards.join('')}<text x="28" y="1080" class="tiny">Prévia de mecânica, sem captura de navegador. Perigos também atingem criaturas. Posições controladas para leitura.</text></svg>`;
await sharp(Buffer.from(svg)).png().toFile(resolve(out, '04-corte-chicote-queda.png'));
await writeFile(
  resolve(out, '04-simulation-events.json'),
  JSON.stringify({ seed: 36, sector: 7, sutureId: suture.id, events }, null, 2) + '\n',
);
await rm(temp, { recursive: true, force: true });
console.log(resolve(out, '04-corte-chicote-queda.png'));
