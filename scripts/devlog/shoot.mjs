#!/usr/bin/env node
/**
 * Captura as screenshots de UMA entrada do devlog construindo o commit da
 * epoca.
 *
 * O caminho e literal: worktree no merge daquele PR, instala, `vite build`,
 * serve o dist e dirige um Chromium ate o quadro que a receita pede. A imagem
 * que sai e o jogo COMO ELE ERA naquele dia — nao o de hoje fingindo ser.
 *
 * Uso:
 *   node scripts/devlog/shoot.mjs --next          # a proxima entrada da fila
 *   node scripts/devlog/shoot.mjs --entry 012
 *   node scripts/devlog/shoot.mjs --entry 012 --recipe solo --keep --debug
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import { capture, serveStatic } from './lib/capture.mjs';
import { snapshotLive } from './lib/live.mjs';
import { mediaDir } from './lib/paths.mjs';
import { recipes } from './lib/recipes.mjs';
import {
  APPS,
  appExistsAt,
  build,
  install,
  prepareWorktree,
  removeWorktree,
} from './lib/workspace.mjs';
import { nextEntry, readPlan, writePlan } from './plan.mjs';

function parseArgs(argv) {
  const args = { entry: null, next: false, recipe: null, keep: false, debug: false };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--next') args.next = true;
    else if (a === '--entry') args.entry = argv[++i];
    else if (a === '--recipe') args.recipe = argv[++i];
    else if (a === '--keep') args.keep = true;
    else if (a === '--debug') args.debug = true;
  }
  return args;
}

const log = (msg) => console.log(msg);

async function shootRecipe(name, entry, site, { debug }) {
  const recipe = recipes[name];
  const found = [site.root, ...site.fallbacks].some((base) =>
    existsSync(resolve(base, recipe.page)),
  );
  if (!found) {
    // arena.html e sprites.html nasceram no meio do historico: num commit
    // anterior a pagina simplesmente nao esta no bundle.
    throw Object.assign(new Error(`${recipe.page} nao existe neste build`), { soft: true });
  }

  const server = await serveStatic(site.root, site.fallbacks);
  try {
    log(`  dirigindo receita "${name}" (${recipe.label})`);
    const { png, errors } = await capture(recipe, { port: server.port, debug, log });
    if (errors.length) log(`  aviso: ${errors.length} erro(s) de pagina — 1o: ${errors[0]}`);

    mkdirSync(mediaDir, { recursive: true });
    const file = `${entry.id}-${name}.png`;
    writeFileSync(resolve(mediaDir, file), png);
    log(`  -> docs/devlog/media/${file} (${(png.length / 1024).toFixed(0)} KB)`);
    return { recipe: name, file, label: recipe.label, bytes: png.length };
  } finally {
    await server.close();
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const plan = readPlan();
  if (!plan) {
    console.error('plan.json nao existe — rode `node scripts/devlog/plan.mjs` primeiro.');
    process.exit(1);
  }

  const entry = args.next
    ? nextEntry(plan)
    : plan.entries.find((e) => e.id === args.entry?.padStart(3, '0'));
  if (!entry) {
    console.error(args.next ? 'nada pendente na fila.' : `entrada ${args.entry} nao existe.`);
    process.exit(1);
  }

  const wanted = args.recipe ? [args.recipe] : entry.recipes;
  log(`entrada ${entry.id} — ${entry.title}`);
  log(`commit ${entry.tipShort} (${entry.realDate}), receitas: ${wanted.join(', ')}`);

  const dir = prepareWorktree(entry.tip);
  log(`worktree em ${dir}`);

  const built = new Map(); // app -> dist, para nao instalar duas vezes
  const shots = [];
  const live = [];
  const problems = [];

  try {
    for (const name of wanted) {
      const recipe = recipes[name];
      if (!recipe) {
        problems.push(`receita desconhecida: ${name}`);
        continue;
      }
      try {
        if (!built.has(recipe.app)) {
          if (!appExistsAt(dir, recipe.app)) {
            throw Object.assign(
              new Error(`${APPS[recipe.app].dir} ainda nao existia neste commit`),
              { soft: true },
            );
          }
          install(dir, recipe.app, (m) => log(`  ${m}`));
          built.set(
            recipe.app,
            build(dir, recipe.app, (m) => log(`  ${m}`)),
          );
        }
        const site = built.get(recipe.app);
        shots.push(await shootRecipe(name, entry, site, args));

        // O build ja esta aqui e ja foi dirigido; guardar o site custa uma
        // copia de arquivos. Falhar nisto NAO derruba a captura — a
        // screenshot ja saiu, e o embed e um extra.
        if (recipe.live) {
          try {
            live.push(snapshotLive(site, recipe, entry.id, name, log));
          } catch (err) {
            log(`  sem embed para ${name}: ${err.message.split('\n')[0]}`);
          }
        }
      } catch (err) {
        const line = `${name}: ${err.message.split('\n')[0]}`;
        // "soft" e ausencia esperada (app/pagina que ainda nao nasceu), nao
        // defeito. Uma receita opcional que falha tambem nao derruba a
        // entrada — o que derruba e terminar sem imagem nenhuma.
        if (err.soft || recipe.optional) log(`  pulando ${line}`);
        else log(`  FALHOU ${line}`);
        problems.push(line);
      }
    }
  } finally {
    if (args.keep) log(`worktree preservada (--keep): ${dir}`);
    else removeWorktree(entry.tip);
  }

  // Merge por receita, nunca substituicao: reexecutar so `--recipe solo` para
  // ajustar um quadro nao pode apagar o registro da arena capturada antes.
  const byRecipe = new Map((entry.shots ?? []).map((s) => [s.recipe, s]));
  for (const shot of shots) byRecipe.set(shot.recipe, shot);
  entry.shots = [...byRecipe.values()];
  // Mesma regra de merge das screenshots: reexecutar uma receita so nao pode
  // apagar o embed que outra ja produziu.
  const liveByRecipe = new Map((entry.live ?? []).map((l) => [l.recipe, l]));
  for (const snapshot of live) liveByRecipe.set(snapshot.recipe, snapshot);
  entry.live = [...liveByRecipe.values()];
  entry.shotError = entry.shots.length ? null : (problems[0] ?? 'nenhuma receita produziu imagem');
  if (shots.length && entry.status === 'pending') entry.status = 'shot';
  writePlan(plan);

  if (!shots.length) {
    console.error(`\nnenhuma screenshot para a entrada ${entry.id}: ${entry.shotError}`);
    process.exit(1);
  }
  log(`\n${shots.length} screenshot(s) para a entrada ${entry.id}.`);
  if (problems.length) log(`pendencias: ${problems.join('; ')}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
