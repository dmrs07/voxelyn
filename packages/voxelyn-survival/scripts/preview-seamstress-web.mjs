// Prancha de revisao da SEGUNDA FASE da Cerzideira, a partir de estados reais
// da simulacao, dos atlas publicados e das funcoes de desenho do cliente.
// Nao e captura de navegador: e um corte anotado da arena.
import { build } from 'esbuild';
import sharp from 'sharp';
import { readFile, writeFile, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const out = resolve(process.argv[2] ?? resolve(root, 'docs/media/cerzideira-rework'));
await mkdir(out, { recursive: true });
const temp = await mkdtemp(resolve(tmpdir(), 'cerzideira-web-'));
const entry = resolve(temp, 'engine.mjs');
await build({
  stdin: {
    contents: `export { createArenaRun } from './packages/voxelyn-survival/src/client/arena-setup.ts'; export { appendSutureDraws } from './packages/voxelyn-survival/src/client/suture-presentation.ts'; export { drawSeamstressEyes, drawCocoon } from './packages/voxelyn-survival/src/client/web-presentation.ts'; export { stunEntity } from './packages/voxelyn-survival-sim/src/entities.ts'; export * from './packages/voxelyn-survival-sim/src/index.ts';`,
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
const state = engine.createArenaRun({
  boss: 'seamstress',
  maxHp: 200,
  ability: 'pulse',
  modules: [],
  stabilisers: false,
});
const queen = state.enemies.find((e) => e.archetype === 'seamstress');
state.playerExtra.iframesUntil = 1e9;
const capture = (label, description, focus) =>
  frames.push({ state: structuredClone(state), label, description, focus });
const step = () => {
  const result = engine.stepRun(state, [engine.emptyCommand()]);
  events.push(...result.events.map((e) => ({ tick: state.tick, ...e })));
};
// Acorda e cai para a metade: a subida comeca no proximo tick.
for (let i = 0; i < 30; i++) step();
queen.hp = queen.maxHp * 0.45;
const S = engine;
while (queen.silk.stage !== S.SEAMSTRESS_STAGE_ASCENDING) step();
for (let i = 0; i < 12; i++) step();
capture('SUBIDA / FIO VERTICAL', 'Ela larga o ataque, prende-se ao fio e sobe ate sair da tela.');
while (queen.silk.stage !== S.SEAMSTRESS_STAGE_ALOFT) step();
const web = () => state.sutures.filter((s) => s.kind === 'web');
while (web().filter((s) => s.phase === 'taut').length < Math.ceil(web().length * 0.55)) step();
capture(
  'TEIA / ESPIRAL SE FORMANDO',
  'Fio a fio, raios primeiro. As faixas claras sao onde o Prospector anda devagar.',
);
while (queen.silk.stage !== S.SEAMSTRESS_STAGE_FRENZY) step();
for (let i = 0; i < 6; i++) step();
capture(
  'RETORNO / OLHOS VERMELHOS',
  'Desce no centro da teia em frenesi, com a leva de crias e Costureiros.',
);
// Passagem aberta: dois fios cortados perto do jogador, que fica no vao.
const intact = web().filter((s) => s.phase === 'taut');
const byPlayer = intact
  .map((s) => ({ s, p: engine.suturePoint(state, s.cells[Math.floor(s.cells.length / 2)]) }))
  .sort(
    (a, b) =>
      Math.hypot(a.p.x - state.player.x, a.p.y - state.player.y) -
      Math.hypot(b.p.x - state.player.x, b.p.y - state.player.y),
  );
for (const { s } of byPlayer.slice(0, 2)) engine.cutSuture(state, s, [], 0);
const gap = byPlayer[0].p;
state.player.x = gap.x;
state.player.y = gap.y;
capture(
  'PASSAGEM ABERTA / FIOS CORTADOS',
  'Os fios rompidos ficam pontilhados; a faixa pegajosa deles some no mesmo tick.',
);
// Um Costureiro refazendo: espera ate um auxiliar estar costurando um fio da teia.
queen.nextActionAt = state.tick + 100000;
queen.silk.broodAt = state.tick + 100000;
for (const e of state.enemies)
  if (e.summonerId === queen.id && e.archetype !== 'stitcher') e.nextActionAt = state.tick + 100000;
state.player.x = gap.x + 6;
state.player.y = gap.y + 6;
let mender = null;
for (let i = 0; i < 400 && !mender; i++) {
  step();
  mender = state.enemies.find(
    (e) =>
      e.alive &&
      e.archetype === 'stitcher' &&
      e.summonerId === queen.id &&
      e.action?.kind === 'stitch' &&
      e.webRepair?.kind === 'strand' &&
      state.tick >= e.action.releaseAt - 4 &&
      web().some((s) => s.id === e.action.target),
  );
}
if (!mender) throw new Error('nenhum Costureiro chegou a costurar um fio da teia');
capture(
  'COSTUREIRO / RECONSTRUINDO UM FIO',
  'Barra sobre a cabeca: 2 s para refazer o fio. Interromper deixa a passagem aberta.',
);
// A leva do frenesi em acao.
queen.nextActionAt = state.tick;
for (const e of state.enemies) if (e.summonerId === queen.id) e.nextActionAt = state.tick;
state.player.x = queen.silk.x + 5;
state.player.y = queen.silk.y + 2;
for (let i = 0; i < 400 && !queen.action?.silkFlight; i++) step();
for (let i = 0; i < 4; i++) step();
capture(
  'FRENESI / PUXADA CURTA',
  'Preparo de 12 ticks, crias saltando: os avisos continuam no chao.',
);
// Um apoio destruido, recuperado pelos mesmos operarios e pela mesma IA.
queen.action = undefined;
queen.nextActionAt = queen.silk.broodAt = state.tick + 100000;
for (const e of state.enemies)
  if (e.summonerId === queen.id && e.archetype !== 'stitcher') {
    e.action = undefined;
    e.nextActionAt = state.tick + 100000;
  }
const workers = state.enemies.filter(
  (e) => e.alive && e.archetype === 'stitcher' && e.summonerId === queen.id,
);
const damagedAnchor = queen.silk.supports
  .filter((s) => s.kind === 'anchor' && s.hp > 0)
  .sort((a, b) => {
    const distance = (s) => {
      const p = engine.suturePoint(state, s.cell);
      return Math.min(...workers.map((e) => Math.hypot(e.x - p.x, e.y - p.y)));
    };
    return distance(a) - distance(b) || a.cell - b.cell;
  })[0];
if (!damagedAnchor) throw new Error('nenhuma ancora para o ensaio de reconstrucao');
for (let n = 0; n < engine.WEB_ANCHOR_HP; n++)
  engine.breakSolid(
    state,
    damagedAnchor.cell % state.config.width,
    Math.floor(damagedAnchor.cell / state.config.width),
    [],
  );
let anchorMender;
for (let n = 0; n < 600 && !anchorMender; n++) {
  step();
  anchorMender = workers.find(
    (e) =>
      e.webRepair?.kind === 'support' &&
      e.webRepair.target === damagedAnchor.cell &&
      engine.webRepairProgress(state, e) >= 0.5,
  );
}
if (!anchorMender)
  throw new Error(
    'nenhum Costureiro iniciou a reconstrucao da ancora: ' +
      JSON.stringify({
        tick: state.tick,
        phase: state.phase,
        anchor: damagedAnchor,
        solid: state.solid[damagedAnchor.cell],
        workers: workers.map((e) => ({
          id: e.id,
          x: e.x,
          y: e.y,
          alive: e.alive,
          action: e.action,
          job: e.webRepair,
          next: e.nextActionAt,
        })),
      }),
  );
const focus = { x: anchorMender.x, y: anchorMender.y };
capture(
  'ANCORA / RECONSTRUCAO',
  'Barra em 50%: a ancora so volta ao final dos 3 s de trabalho.',
  focus,
);
engine.stunEntity(state, anchorMender, 60);
step();
capture(
  'INTERRUPCAO / PASSAGEM MANTIDA',
  'Atordoamento cancela a barra. A ancora permanece destruida.',
  focus,
);
// A REDE: abaixo de 20% ela carrega e arremessa; o jogador parado e encapsulado.
anchorMender.stunnedUntil = state.tick;
queen.hp = queen.maxHp * 0.15;
queen.rangedReadyAt = 0;
queen.nextActionAt = state.tick;
for (const e of state.enemies) if (e.summonerId === queen.id) e.nextActionAt = state.tick + 100000;
{
  const dx = state.player.x - queen.x,
    dy = state.player.y - queen.y,
    d = Math.hypot(dx, dy) || 1;
  const clear = engine.silkLanding(
    state,
    state.player,
    { x: queen.x + (dx / d) * 5, y: queen.y + (dy / d) * 5 },
    3,
  );
  if (clear) {
    state.player.x = clear.x;
    state.player.y = clear.y;
  }
}
state.playerExtra.iframesUntil = 0;
for (let i = 0; i < 600 && !(state.playerExtra.cocoonUntil > state.tick); i++) step();
if (!(state.playerExtra.cocoonUntil > state.tick))
  throw new Error('a rede nao encapsulou o jogador');
for (let i = 0; i < 6; i++) step();
capture('REDE / CASULO', 'Abaixo de 20%: a rede fecha 3 s de casulo imune; depois, 10% do passo.');
if (frames.length !== 9) throw new Error(`Expected nine beats, got ${frames.length}`);

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
  globalAlpha = 1;
  dash = [];
  canvas = { width: 640, height: 454 };
  save() {
    this.stack.push([
      this.strokeStyle,
      this.fillStyle,
      this.lineWidth,
      this.globalAlpha,
      this.dash,
    ]);
  }
  restore() {
    [this.strokeStyle, this.fillStyle, this.lineWidth, this.globalAlpha, this.dash] =
      this.stack.pop();
  }
  setLineDash(d) {
    this.dash = d;
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
    const dash = this.dash.length ? ` stroke-dasharray="${this.dash.join(' ')}"` : '';
    this.output.push(
      `<path d="${this.path}" fill="none" stroke="${this.strokeStyle}" stroke-width="${this.lineWidth}" opacity="${this.globalAlpha}"${dash}/>`,
    );
  }
  fill() {
    this.output.push(
      `<path d="${this.path}" fill="${this.fillStyle}" opacity="${this.globalAlpha}"/>`,
    );
  }
  fillRect(x, y, width, height) {
    this.output.push(
      `<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="${this.fillStyle}" opacity="${this.globalAlpha}"/>`,
    );
  }
}
const boards = [];
const w = state.config.width;
for (const [n, frame] of frames.entries()) {
  const q = frame.state.enemies.find((e) => e.archetype === 'seamstress');
  const center =
    frame.focus ??
    (q.silk.stage === S.SEAMSTRESS_STAGE_ALOFT
      ? { x: q.silk.x, y: q.silk.y }
      : { x: (q.x + frame.state.player.x) / 2, y: (q.y + frame.state.player.y) / 2 });
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
  const R = 9;
  for (let y = Math.floor(center.y) - R; y <= Math.floor(center.y) + R; y++)
    for (let x = Math.floor(center.x) - R; x <= Math.floor(center.x) + R; x++) {
      if (x < 1 || y < 1 || x >= w - 1 || y >= state.config.height - 1) continue;
      const [sx, sy] = project(x + 0.5, y + 0.5),
        solid = frame.state.solid[y * w + x];
      ctx.output.push(
        `<path d="M${sx},${sy - 8}l16,8 -16,8 -16,-8Z" fill="${solid ? '#17202c' : '#202d37'}" stroke="#283540" stroke-width=".4"/>`,
      );
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
    if (!e.alive || Math.hypot(e.x - center.x, e.y - center.y) > R) continue;
    if (e.archetype === 'seamstress' && engine.seamstressHidden(e)) continue;
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
    const stage = e.silk?.stage ?? 0;
    const animation =
      stage === S.SEAMSTRESS_STAGE_ASCENDING || stage === S.SEAMSTRESS_STAGE_DESCENDING
        ? 'fly'
        : e.stunnedUntil > frame.state.tick
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
          `<ellipse cx="${sx}" cy="${sy}" rx="${e.radius * 22 * Math.max(0.15, 1 - lift / 100)}" ry="${e.radius * 11 * Math.max(0.15, 1 - lift / 100)}" fill="#080c12"/>`,
        ),
    });
    items.push({
      depth: e.x + e.y + (lift > 0 ? 3 : 0),
      draw: () => {
        ctx.output.push(
          `<use href="#${key}" x="${sx - manifest.anchorX * 0.5}" y="${sy - manifest.anchorY * 0.5 - lift}"/>`,
        );
        if (e.archetype === 'seamstress' && engine.seamstressFrenzied(e)) {
          const [hx, hy] = project(e.x + e.facing.x * 0.75, e.y + e.facing.y * 0.75);
          engine.drawSeamstressEyes(ctx, hx, hy - 21 - lift, e.facing.x, 1, 0);
        }
        if (e === frame.state.player) {
          const ex = frame.state.playerExtras[0];
          if (ex.cocoonUntil > frame.state.tick) engine.drawCocoon(ctx, sx, sy - 6, 11, 1, 0, true);
          else if (ex.webbedUntil > frame.state.tick)
            engine.drawCocoon(ctx, sx, sy - 6, 11, 1, 0, false);
        }
      },
    });
  }
  engine.appendSutureDraws(ctx, frame.state, items, project, 1, (x, y) =>
    Math.abs(x - center.x) <= R && Math.abs(y - center.y) <= R ? 1 : 0,
  );
  items.sort((a, b) => a.depth - b.depth).forEach((item) => item.draw());
  boards.push(`<g clip-path="url(#clip${n})">${ctx.output.join('')}</g>`);
  boards.push(
    `<clipPath id="clip${n}"><rect x="${ox}" y="${oy}" width="640" height="454" rx="8"/></clipPath>`,
  );
  boards.push(
    `<text x="${ox + 20}" y="${oy + 412}" class="small">${frame.description}</text><text x="${ox + 20}" y="${oy + 435}" class="tiny">tick ${frame.state.tick} · etapa ${q.silk.stage} · fios ${frame.state.sutures.filter((s) => s.kind === 'web' && s.phase === 'taut').length}/${frame.state.sutures.filter((s) => s.kind === 'web').length} · auxiliares ${frame.state.enemies.filter((e) => e.alive && e.summonerId === q.id).length}</text>`,
  );
}
const height = 140 + Math.ceil(frames.length / 2) * 480;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1376" height="${height}"><style>text{font-family:DejaVu Sans,sans-serif;fill:#ddd5c6}.label{font-size:18px}.small{font-size:15px}.tiny{font-size:13px;fill:#95a5b6}</style><defs>${[...defs.values()].join('')}</defs><rect width="1376" height="${height}" fill="#0d131c"/><text x="28" y="44" font-size="28">CERZIDEIRA / segunda fase: sobe, tece, desce em frenesi</text><text x="28" y="78" class="small">Ensaio da simulação · seed 36 · atlas e desenho da teia reais · cenário em corte</text>${boards.join('')}<text x="28" y="${height - 20}" class="tiny">Prévia de mecânica, sem captura de navegador. Simulacao real; paredes frontais em corte para leitura.</text></svg>`;
const filename = '02-segunda-fase-teia';
await sharp(Buffer.from(svg))
  .png()
  .toFile(resolve(out, filename + '.png'));
await writeFile(
  resolve(out, 'second-phase-events.json'),
  JSON.stringify(
    {
      seed: 36,
      sector: 7,
      frames: frames.map((frame) => ({
        label: frame.label,
        tick: frame.state.tick,
        repairs: frame.state.enemies
          .filter((e) => e.alive && e.webRepair)
          .map((e) => ({
            worker: e.id,
            ...e.webRepair,
            progress: engine.webRepairProgress(frame.state, e),
          })),
      })),
      events: events.filter(
        (e) =>
          e.t === 'boss_state' || e.t === 'boss_phase' || (e.t === 'suture' && e.phase !== 'sew'),
      ),
    },
    null,
    2,
  ) + '\n',
);
await rm(temp, { recursive: true, force: true });
console.log(resolve(out, filename + '.png'));
