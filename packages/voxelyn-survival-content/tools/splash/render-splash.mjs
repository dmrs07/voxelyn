// O COMANDO. Monta a cena, renderiza e escreve tudo.
//
//   node tools/splash/render-splash.mjs --width 3840 --height 2160 \
//        --out artifacts/splash/guardian-core --passes
//
// Tudo que define a imagem vem de `preset.mjs`; os argumentos so escolhem
// resolucao, destino e quais passes escrever. Isso e proposital: um argumento
// que mudasse a camera ou a seed tiraria a imagem do preset e a reprodutibilidade
// junto.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Worker } from 'node:worker_threads';
import { cpus } from 'node:os';

import { createRun } from '@voxelyn/survival-sim';
import { PRESET } from './preset.mjs';
import { makeWindow, buildScene, dressProps, stageEncounter, GROUND } from './scene.mjs';
import { createCamera, tileToVoxel, projectPoint } from './camera.mjs';
import { buildLights } from './lights.mjs';
import { chargeVein } from './vein.mjs';
import { veinAxis } from './scout-seed.mjs';
import { createBuffers, renderBand } from './render.mjs';
import { renderBrandingLayer, composite } from './branding.mjs';
import {
  compose,
  writePng,
  grayPass,
  colorPass,
  normalPass,
  objectPass,
} from './post.mjs';
import { VOXELS_PER_TILE } from './geometry.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(here, '../..');

const parseArgs = (argv) => {
  const args = { width: 1920, height: 1080, out: 'artifacts/splash/guardian-core', passes: false, samples: null, workers: null };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--width') args.width = Number(argv[++i]);
    else if (a === '--height') args.height = Number(argv[++i]);
    else if (a === '--out') args.out = argv[++i];
    else if (a === '--passes') args.passes = true;
    else if (a === '--samples') args.samples = Number(argv[++i]);
    else if (a === '--workers') args.workers = Number(argv[++i]);
    else if (a === '--no-post') args.noPost = true;
    else if (a === '--branding') args.branding = true;
  }
  return args;
};

/**
 * Constroi mundo, cena, luzes e camera. Separado do render porque as duas
 * resolucoes de entrega (4K e 1080p) e o preview em resolucao de jogo precisam
 * da MESMA cena — reconstruir mudaria nada, mas custaria os segundos da
 * voxelizacao tres vezes.
 */
export const buildAll = () => {
  const { runSeed, sector, width, height } = PRESET.world;
  // A MESMA chamada que o jogo faz para comecar uma run.
  const state = createRun({ seed: runSeed, sector, width, height, playerCount: 1 });

  const win = makeWindow(
    PRESET.window.x0,
    PRESET.window.y0,
    PRESET.window.x1,
    PRESET.window.y1,
    PRESET.window.depthTiles
  );

  const staging = stageEncounter(state, {
    prospector: PRESET.staging.prospector,
    prospectorTurns: PRESET.staging.prospectorTurns,
    guardian: PRESET.staging.guardian,
    guardianTurns: PRESET.staging.guardianTurns,
  });

  const built = buildScene(state, win, staging);
  const propPlacements = dressProps(built.scene, win, PRESET.props);

  // A Vein acesa pelo sistema real da simulacao.
  //
  // `veinAxis` foi escrito contra o `GeneratedWorld` do gerador, que chama a
  // lista de `leylines`; o estado vivo chama a mesma coisa de `leylineSegments`
  // (e acrescenta os relogios de cada trecho, que aqui nao interessam). O
  // adaptador de uma linha e melhor que dois nomes para a mesma geometria.
  const axis = veinAxis({ leylines: state.leylineSegments, corePos: state.corePos });
  const segment = state.leylineSegments?.[axis.index] ?? { cells: [] };
  const charge = chargeVein(state, segment);

  // A camera e construida ANTES das luzes porque o fill mora na posicao dela —
  // ver o item 4 de `buildLights`. A resolucao nao afeta posicao nem direcao,
  // entao uma camera de referencia serve para as duas resolucoes de entrega.
  const refCam = buildCamera(win, 1920, 1080);
  const lights = buildLights(state, win, charge.cells, PRESET.propLights, refCam.position);

  return {
    state,
    win,
    staging,
    scene: built.scene,
    placements: [...built.placements, ...propPlacements],
    charge,
    segment,
    lights,
  };
};

export const buildCamera = (win, width, height) => {
  const c = PRESET.camera;
  return createCamera({
    position: tileToVoxel(win, c.position.x, c.position.y, c.position.z),
    target: tileToVoxel(win, c.target.x, c.target.y, c.target.z),
    fovY: c.fovY,
    roll: c.roll,
    width,
    height,
  });
};

/** Render paralelo: cada processo preenche faixas de linhas dos mesmos buffers. */
const renderParallel = async (sceneData, cam, lights, buffers, samples, workerCount) => {
  const bands = [];
  const rows = Math.ceil(buffers.height / (workerCount * 4));
  for (let y = 0; y < buffers.height; y += rows) {
    bands.push([y, Math.min(buffers.height, y + rows)]);
  }
  let next = 0;
  const workerPath = join(here, 'worker.mjs');

  await Promise.all(
    Array.from({ length: workerCount }, () =>
      new Promise((resolveWorker, rejectWorker) => {
        const worker = new Worker(workerPath, {
          workerData: { sceneData, cam, lights, buffers, samples },
        });
        const feed = () => {
          if (next >= bands.length) {
            worker.postMessage({ done: true });
            return;
          }
          const band = bands[next++];
          worker.postMessage({ band });
        };
        worker.on('message', (msg) => {
          if (msg === 'ready' || msg === 'band') feed();
          else if (msg === 'finished') worker.terminate().then(resolveWorker, rejectWorker);
        });
        worker.on('error', rejectWorker);
      })
    )
  );
};

const main = async () => {
  const args = parseArgs(process.argv);
  const outDir = resolve(packageRoot, args.out);
  mkdirSync(outDir, { recursive: true });

  const t0 = Date.now();
  process.stdout.write('montando cena a partir do worldgen... ');
  const built = buildAll();
  console.log(
    `${((Date.now() - t0) / 1000).toFixed(1)}s  ` +
      `(${built.win.width}x${built.win.height}x${built.win.depth} voxels, ` +
      `${built.charge.cells.length} celulas de Vein carregadas, ` +
      `${built.lights.points.length} luzes)`
  );

  const cam = buildCamera(built.win, args.width, args.height);
  const buffers = createBuffers(args.width, args.height);
  const samples = args.samples ?? PRESET.samples;
  const workerCount = args.workers ?? Math.max(1, Math.min(cpus().length, 16));

  const t1 = Date.now();
  process.stdout.write(
    `renderizando ${args.width}x${args.height} @ ${samples}spp em ${workerCount} processos... `
  );
  // Os buffers e a cena viajam como SharedArrayBuffer para os processos
  // escreverem no MESMO destino; copiar 8,3 milhoes de pixels x 8 passes de volta
  // por mensagem custaria mais que o proprio render.
  const shared = toShared(built.scene, buffers);
  await renderParallel(shared.scene, cam, built.lights, shared.buffers, samples, workerCount);
  console.log(`${((Date.now() - t1) / 1000).toFixed(1)}s`);

  const stem = `${PRESET.id}-${args.width}x${args.height}`;
  const rgba = compose(shared.buffers, PRESET.post);
  writePng(join(outDir, `${stem}-beauty.png`), rgba, args.width, args.height);
  console.log(`  beauty  -> ${stem}-beauty.png`);

  if (args.passes) {
    const { width, height } = shared.buffers;
    const raw = compose(shared.buffers, { ...PRESET.post, exposure: 1, bloom: { ...PRESET.post.bloom, strength: 0 }, vignette: 0, grade: { lift: 0, shadowTint: [1, 1, 1], midTint: [1, 1, 1], saturation: 1, contrast: 1 } }, { skipBloom: true });
    writePng(join(outDir, `${stem}-raw.png`), raw, width, height);
    writePng(join(outDir, `${stem}-albedo.png`), colorPass(shared.buffers.albedo, width, height), width, height);
    writePng(join(outDir, `${stem}-emissive.png`), colorPass(shared.buffers.emissive, width, height), width, height);
    writePng(join(outDir, `${stem}-normal.png`), normalPass(shared.buffers.normal, width, height), width, height);
    writePng(join(outDir, `${stem}-object.png`), objectPass(shared.buffers.objectId, width, height), width, height);
    const far = maxFinite(shared.buffers.depth);
    writePng(
      join(outDir, `${stem}-depth.png`),
      grayPass(shared.buffers.depth, width, height, (v) => 1 - Math.min(1, v / far)),
      width,
      height
    );
    writePng(join(outDir, `${stem}-ao.png`), grayPass(shared.buffers.ao, width, height, (v) => v), width, height);
    writePng(join(outDir, `${stem}-shadow.png`), grayPass(shared.buffers.shadow, width, height, (v) => v), width, height);
    console.log('  passes  -> raw, albedo, emissive, normal, object, depth, ao, shadow');
  }

  if (args.branding) {
    const layer = await renderBrandingLayer({ width: args.width, height: args.height });
    const branded = composite(rgba, layer, args.width, args.height);
    writePng(join(outDir, `${stem}-branded.png`), branded, args.width, args.height);
    console.log(`  branding-> ${stem}-branded.png`);
  }

  writeFileSync(
    join(outDir, `${stem}-manifest.json`),
    `${JSON.stringify(describe(built, cam, args, samples), null, 2)}\n`
  );
  console.log(`  manifest-> ${stem}-manifest.json`);
};

const maxFinite = (arr) => {
  let m = 0;
  for (let i = 0; i < arr.length; i++) if (Number.isFinite(arr[i]) && arr[i] > m && arr[i] < 1e9) m = arr[i];
  return m || 1;
};

/**
 * Reempacota cena e buffers em memoria COMPARTILHADA.
 *
 * Sem isto cada processo receberia uma copia da cena (dezenas de megabytes) e
 * devolveria uma copia dos passes. Com isto todos leem a mesma grade e escrevem
 * em linhas disjuntas do mesmo destino — sem trava, porque duas faixas nunca
 * tocam o mesmo pixel.
 */
const toShared = (scene, buffers) => {
  const share = (typed) => {
    const sab = new SharedArrayBuffer(typed.byteLength);
    const view = new typed.constructor(sab);
    view.set(typed);
    return view;
  };
  return {
    scene: {
      width: scene.width,
      height: scene.height,
      depth: scene.depth,
      bw: scene.bw,
      bh: scene.bh,
      bd: scene.bd,
      mat: share(scene.mat),
      obj: share(scene.obj),
      brick: share(scene.brick),
    },
    buffers: {
      width: buffers.width,
      height: buffers.height,
      beauty: share(buffers.beauty),
      albedo: share(buffers.albedo),
      normal: share(buffers.normal),
      depth: share(buffers.depth),
      emissive: share(buffers.emissive),
      ao: share(buffers.ao),
      shadow: share(buffers.shadow),
      objectId: share(buffers.objectId),
    },
  };
};

/** O registro de tudo que produziu a imagem. Vira o manifest de assets. */
const describe = (built, cam, args, samples) => {
  const project = (tx, ty, tz) => {
    const p = projectPoint(cam, tileToVoxel(built.win, tx, ty, tz));
    return p ? { x: Math.round(p.x), y: Math.round(p.y), depthVoxels: Math.round(p.depth) } : null;
  };
  return {
    preset: PRESET.id,
    resolution: { width: args.width, height: args.height, samples },
    world: {
      ...PRESET.world,
      stratum: built.state.stratum,
      occupation: built.state.occupation,
      lineage: built.state.lineage,
      corePos: built.state.corePos,
      entry: built.state.entry,
      hallCenters: built.state.hallCenters,
      leylineSegments: built.state.leylineSegments?.length ?? 0,
    },
    window: PRESET.window,
    camera: {
      ...PRESET.camera,
      positionVoxels: cam.position,
      targetVoxels: cam.target,
      forward: cam.forward,
      right: cam.right,
      up: cam.up,
    },
    screen: {
      prospector: project(PRESET.staging.prospector.x, PRESET.staging.prospector.y, 1),
      guardian: project(PRESET.staging.guardian.x, PRESET.staging.guardian.y, 1),
      core: project(built.state.corePos.x, built.state.corePos.y, 1.4),
    },
    vein: {
      chargedCells: built.charge.cells.length,
      source: built.charge.source,
      simEvents: built.charge.events.map((e) => e.kind ?? e.type ?? 'discharge'),
      segmentCells: built.segment.cells.length,
    },
    lights: built.lights.points.map((l) => ({ tag: l.tag, intensity: l.intensity, radius: l.radius })),
    placements: built.placements,
    post: PRESET.post,
    groundVoxel: GROUND,
    voxelsPerTile: VOXELS_PER_TILE,
  };
};

if (process.argv[1]?.endsWith('render-splash.mjs')) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
