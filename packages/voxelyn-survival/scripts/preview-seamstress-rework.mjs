// Review board from real simulation state, atlas frames and appendSutureDraws.
// This is an annotated cutaway, not a browser screenshot.
import { build } from 'esbuild';
import sharp from 'sharp';
import { readFile, writeFile, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const out = resolve(process.argv[2] ?? resolve(root, 'docs/media/cerzideira-rework'));
const useFire = true;
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
const frames = [],
  events = [];
const make = () =>
  engine.createArenaRun({
    boss: 'seamstress',
    maxHp: 200,
    ability: 'pulse',
    modules: [],
    stabilisers: false,
  });
const state = make();
const queen = state.enemies.find((e) => e.archetype === 'seamstress');
let first = null;
let broodSeen = false,
  workerSeen = false;
const capture = (s, label, description) =>
  frames.push({ state: structuredClone(s), label, description });
for (let i = 0; i < 500 && frames.length < 5; i++) {
  const result = engine.stepRun(state, [engine.emptyCommand()]);
  events.push(...result.events.map((e) => ({ tick: state.tick, ...e })));
  if (!first && queen.action?.silkFlight)
    first = { ...queen.action, silkFlight: { ...queen.action.silkFlight } };
  if (first) {
    if (state.tick === first.startedAt + 10)
      capture(
        state,
        'PREPARO / APOIO FIXO',
        'O fio claro pode ser cortado. O circulo marca o golpe.',
      );
    if (state.tick === Math.floor((first.releaseAt + first.silkFlight.landAt) / 2))
      capture(
        state,
        'VOO / PERNAS RECOLHIDAS',
        'O corpo passa sobre a rocha. A sombra acompanha o chao.',
      );
    if (state.tick === first.silkFlight.impactAt)
      capture(state, 'GOLPE / TERCEIRO QUADRO', 'A agulhada, o dano e o som usam este mesmo tick.');
  }
  const airborne = (e) =>
    e.action?.silkFlight &&
    state.tick > e.action.releaseAt + 2 &&
    state.tick < e.action.silkFlight.landAt - 1;
  if (!broodSeen && state.enemies.some((e) => e.archetype === 'seamstress_brood' && airborne(e))) {
    capture(
      state,
      'CRIAS / SALTOS CURTOS',
      'A ninhada entra depois das duas primeiras investidas.',
    );
    broodSeen = true;
  }
  if (!workerSeen && state.enemies.some((e) => e.archetype === 'stitcher' && airborne(e))) {
    capture(
      state,
      'COSTUREIRO / SALTO LONGO',
      'Um Costureiro e tres crias: quatro auxiliares no maximo.',
    );
    workerSeen = true;
  }
}
const cut = make(),
  cutQueen = cut.enemies.find((e) => e.archetype === 'seamstress');
while (cut.tick < first.releaseAt + 6) engine.stepRun(cut, [engine.emptyCommand()]);
const anchor = engine.suturePoint(cut, cutQueen.action.silkFlight.anchor);
const dx = anchor.x - cutQueen.x,
  dy = anchor.y - cutQueen.y,
  len = Math.hypot(dx, dy);
const mid = { x: (anchor.x + cutQueen.x) / 2, y: (anchor.y + cutQueen.y) / 2 };
engine.hitSutures(
  cut,
  { x: mid.x - dy / len, y: mid.y + dx / len },
  { x: mid.x + dy / len, y: mid.y - dx / len },
  [],
);
frames.splice(3, 0, {
  state: structuredClone(cut),
  label: 'CORTE / ABDOME EXPOSTO',
  description: 'Queda segura e 1,8 s para atacar; sem chicote ou carga.',
});
if (frames.length !== 6) throw new Error(`Expected six encounter beats, got ${frames.length}`);
const atlasDir = resolve(root, 'packages/voxelyn-survival-content/assets/atlases');
const terrain = JSON.parse(await readFile(resolve(atlasDir, 'terrain-blocks.json'), 'utf8'));
const surfaces = JSON.parse(await readFile(resolve(atlasDir, 'surface-tiles.json'), 'utf8'));
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
  globalAlpha = 1;
  save() {
    this.stack.push([this.strokeStyle, this.fillStyle, this.lineWidth, this.globalAlpha]);
  }
  restore() {
    [this.strokeStyle, this.fillStyle, this.lineWidth, this.globalAlpha] = this.stack.pop();
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
      `<path d="${this.path}" fill="none" stroke="${this.strokeStyle}" stroke-width="${this.lineWidth}" opacity="${this.globalAlpha}"/>`,
    );
  }
  fill() {
    this.output.push(
      `<path d="${this.path}" fill="${this.fillStyle}" opacity="${this.globalAlpha}"/>`,
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
  const q = frame.state.enemies.find((e) => e.archetype === 'seamstress');
  const center = { x: (q.x + frame.state.player.x) / 2, y: (q.y + frame.state.player.y) / 2 };
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
      if (useFire && !solid) {
        const surface = frame.state.surface[y * w + x];
        const kind =
          surface === engine.SURF_FIRE ? 4 : surface === engine.SURF_MINERAL_SILK ? 20 : -1;
        if (kind >= 0) {
          const offset = surfaces.kinds
            .slice(0, kind)
            .reduce((sum, k) => sum + k.frames * surfaces.variants * surfaces.lightLevels, 0);
          const animation = surfaces.kinds[kind];
          const phase = animation.frameMs
            ? Math.floor((frame.state.tick * 50) / animation.frameMs) % animation.frames
            : 0;
          const key = await sprite(
            'surface-tiles',
            offset + phase * surfaces.lightLevels + 5,
            surfaces,
          );
          ctx.output.push(
            `<use href="#${key}" x="${sx - surfaces.originX * 0.5}" y="${sy - surfaces.originY * 0.5}"/>`,
          );
        }
      }
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
          : e.archetype === 'seamstress_brood'
            ? 'enemy-seamstress-brood'
            : 'enemy-stitcher';
    const manifest = JSON.parse(await readFile(resolve(atlasDir, id + '.json'), 'utf8'));
    const f = e.action?.silkFlight;
    const animation =
      e.stunnedUntil > frame.state.tick
        ? 'downed'
        : f
          ? frame.state.tick >= f.landAt
            ? 'attack'
            : frame.state.tick >= e.action.releaseAt
              ? 'fly'
              : e.archetype === 'seamstress'
                ? 'special'
                : 'burst'
          : e.action?.kind === 'stitch'
            ? 'special'
            : 'idle';
    const anim = manifest.animations[animation] ? animation : 'idle';
    const dirs = manifest.authoredDirs;
    const vectors = {
      r: [1, 0],
      dr: [Math.SQRT1_2, Math.SQRT1_2],
      d: [0, 1],
      dl: [-Math.SQRT1_2, Math.SQRT1_2],
      l: [-1, 0],
      ul: [-Math.SQRT1_2, -Math.SQRT1_2],
      u: [0, -1],
      ur: [Math.SQRT1_2, -Math.SQRT1_2],
    };
    const facing = e.action?.direction ?? e.facing;
    const dir = dirs.reduce((a, b) =>
      vectors[b][0] * facing.x + vectors[b][1] * facing.y >
      vectors[a][0] * facing.x + vectors[a][1] * facing.y
        ? b
        : a,
    );
    const elapsed =
      anim === 'attack' && f
        ? (frame.state.tick - f.impactAt + engine.SILK_STRIKE_OFFSET) * 50
        : e.action
          ? (frame.state.tick - e.action.startedAt) * 50
          : 0;
    const def = manifest.animations[anim];
    const index =
      manifest.frameMap[dir][anim] +
      Math.min(def.frames - 1, Math.max(0, Math.floor((elapsed / 1000) * def.fps)));
    const key = await sprite(id, index, manifest);
    const [sx, sy] = project(e.x, e.y);
    const lift = engine.silkLift(e, frame.state.tick);
    items.push({
      depth: e.x + e.y - 0.2,
      draw: () =>
        ctx.output.push(
          `<ellipse cx="${sx}" cy="${sy}" rx="${e.radius * 22}" ry="${e.radius * 11}" fill="#080c12"/>`,
        ),
    });
    items.push({
      depth: e.x + e.y + (lift > 0 ? 3 : 0),
      draw: () =>
        ctx.output.push(
          `<use href="#${key}" x="${sx - manifest.anchorX * 0.5}" y="${sy - manifest.anchorY * 0.5 - lift}"/>`,
        ),
    });
  }
  engine.appendSutureDraws(ctx, frame.state, items, project, 1, (x, y) =>
    Math.abs(x - center.x) <= 7 && Math.abs(y - center.y) <= 7 ? 1 : 0,
  );
  items.sort((a, b) => a.depth - b.depth).forEach((item) => item.draw());
  boards.push(ctx.output.join(''));

  boards.push(
    `<text x="${ox + 20}" y="${oy + 412}" class="small">${frame.description}</text><text x="${ox + 20}" y="${oy + 435}" class="tiny">tick ${frame.state.tick} · sutura ${q.action?.kind ?? (q.stunnedUntil > frame.state.tick ? 'exposta' : 'caca')}</text>`,
  );
}
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1376" height="1580"><style>text{font-family:DejaVu Sans,sans-serif;fill:#ddd5c6}.label{font-size:18px}.small{font-size:15px}.tiny{font-size:13px;fill:#95a5b6}</style><defs>${[...defs.values()].join('')}</defs><rect width="1376" height="1580" fill="#0d131c"/><text x="28" y="44" font-size="28">CERZIDEIRA / um fio, um golpe, uma resposta</text><text x="28" y="78" class="small">Ensaio da simulação · seed 36 · atlas e desenho de suturas reais · cenário em corte</text>${boards.join('')}<text x="28" y="1560" class="tiny">Prévia de mecânica, sem captura de navegador. Simulacao real; paredes frontais em corte para leitura.</text></svg>`;
const filename = '01-ciclo-da-cerzideira';
await sharp(Buffer.from(svg))
  .png()
  .toFile(resolve(out, filename + '.png'));
await writeFile(
  resolve(out, 'simulation-events.json'),
  JSON.stringify({ seed: 36, sector: 7, events }, null, 2) + '\n',
);
const metrics = [];
// Os dois ultimos sao as RESPOSTAS que a luta promete: cortar o fio e atacar
// na janela; sair da marca quando o aviso aparece. Sem eles o arquivo medida
// regressao de auxiliares e terreno, nao a luta.
for (const scenario of [
  'idle',
  'stationary_shoot',
  'circle_shoot',
  'cut_every_tether',
  'cut_and_shoot',
  'dodge_mark_shoot',
]) {
  const s = engine.createArenaRun({
    boss: 'seamstress',
    maxHp: 100,
    ability: 'seeker',
    modules: ['piercing'],
    stabilisers: false,
  });
  const q = s.enemies.find((e) => e.archetype === 'seamstress');
  let cuts = 0,
    impacts = 0,
    blockedGroundTicks = 0,
    maxHelpers = 0;
  for (let n = 0; n < 1800 && q.alive && s.player.alive && s.player.hp > 0; n++) {
    const cmd = engine.emptyCommand();
    const dx = q.x - s.player.x,
      dy = q.y - s.player.y,
      distance = Math.hypot(dx, dy) || 1;
    cmd.aim = { x: dx / distance, y: dy / distance };
    cmd.fire = /shoot/.test(scenario);
    if (scenario === 'circle_shoot') cmd.move = { x: -dy / distance, y: dx / distance };
    if (scenario === 'dodge_mark_shoot') {
      // Parado atirando; ao ver a marca da agulhada, sai dela em linha reta.
      const f = q.action?.silkFlight;
      if (f && f.anchor !== undefined && s.tick < f.impactAt) {
        const hit = engine.silkStrike(q);
        const ax = s.player.x - hit.x,
          ay = s.player.y - hit.y,
          away = Math.hypot(ax, ay) || 1;
        if (away < hit.radius + s.player.radius + 1.5) cmd.move = { x: ax / away, y: ay / away };
      }
    }
    if (/^cut/.test(scenario) && engine.silkSupported(q, s.tick)) {
      const anchor = engine.suturePoint(s, q.action.silkFlight.anchor);
      const dx = anchor.x - q.x,
        dy = anchor.y - q.y,
        len = Math.hypot(dx, dy) || 1;
      const mid = { x: (anchor.x + q.x) / 2, y: (anchor.y + q.y) / 2 };
      engine.hitSutures(
        s,
        { x: mid.x - dy / len, y: mid.y + dx / len },
        { x: mid.x + dy / len, y: mid.y - dx / len },
        [],
      );
      cuts++;
    }
    const { events } = engine.stepRun(s, [cmd]);
    impacts += events.filter((e) => e.t === 'boss_attack' && e.ability === 'tether').length;
    maxHelpers = Math.max(
      maxHelpers,
      s.enemies.filter((e) => e.alive && e.summonerId === q.id).length,
    );
    if (!q.action?.silkFlight && !engine.silkCanLand(s, q, q.x, q.y)) blockedGroundTicks++;
  }
  metrics.push({
    scenario,
    seconds: s.tick / 20,
    playerHp: s.player.hp,
    queenHp: Math.round(q.hp),
    lunges: q.silk.lunges,
    impacts,
    cuts,
    maxHelpers,
    blockedGroundTicks,
  });
}
await writeFile(
  resolve(out, 'playtest-results.json'),
  JSON.stringify({ seed: 36, sector: 7, automated: true, metrics }, null, 2) + '\n',
);
console.log(JSON.stringify(metrics));
await rm(temp, { recursive: true, force: true });
console.log(resolve(out, filename + '.png'));
