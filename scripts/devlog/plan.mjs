#!/usr/bin/env node
/**
 * Gera (ou reconcilia) docs/devlog/plan.json — a fila do devlog retroativo.
 *
 * O plano e a UNICA fonte da verdade do pipeline: a captura le dele qual
 * commit construir, a redacao le dele qual PR contar, e a tarefa diaria le
 * dele qual entrada e a proxima. Regerar o plano NUNCA perde progresso: o
 * status de cada entrada e reconciliado pelo sha do commit de merge, entao
 * acrescentar PRs novos no fim nao mexe no que ja foi publicado.
 *
 * Uso:
 *   node scripts/devlog/plan.mjs                    # reconcilia com o historico
 *   node scripts/devlog/plan.mjs --start 2026-08-15 # (re)define o dia 1
 *   node scripts/devlog/plan.mjs --list             # so imprime a fila
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';

import { workUnits, touchedAreas, diffStat, appsPresentAt } from './lib/git.mjs';
import { devlogDir, planPath } from './lib/paths.mjs';
import { pickRecipes } from './lib/recipes.mjs';
import { APPS } from './lib/workspace.mjs';

/** Estados de uma entrada, em ordem de avanco. */
export const STATUS = ['pending', 'shot', 'written', 'published'];

function slugify(text) {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // marcas de acento soltas pelo NFD
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

function addDays(isoDate, days) {
  const d = new Date(`${isoDate}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function parseArgs(argv) {
  const args = { list: false, start: null };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--list') args.list = true;
    else if (argv[i] === '--start') args.start = argv[++i];
  }
  return args;
}

export function readPlan() {
  if (!existsSync(planPath)) return null;
  return JSON.parse(readFileSync(planPath, 'utf8'));
}

export function writePlan(plan) {
  mkdirSync(devlogDir, { recursive: true });
  writeFileSync(planPath, `${JSON.stringify(plan, null, 2)}\n`);
}

/** A proxima entrada a trabalhar: a primeira que ainda nao foi publicada. */
export function nextEntry(plan) {
  return plan.entries.find((e) => e.status !== 'published' && !e.skipped) ?? null;
}

/**
 * Campos que pertencem ao PROGRESSO de uma entrada, com o valor inicial.
 *
 * Esta lista existe como lista, e nao como um punhado de `old?.x ?? y` soltos,
 * porque a forma antiga falhava em silencio: quem acrescentasse um campo novo
 * — foi o que aconteceu com `cdn` e `carousels` — o veria ser APAGADO na
 * proxima reconciliacao, e a reconciliacao roda no comeco de toda tarefa
 * diaria. Com `--prune` ja executado, perder `cdn` significa capa do indice e
 * download do console apontando para arquivo que nao existe mais em lugar
 * nenhum.
 *
 * Regra: campo derivado do git (titulo, areas, stat) e RECALCULADO; campo que
 * registra trabalho feito entra aqui.
 */
const PROGRESS_FIELDS = {
  status: 'pending',
  skipped: false,
  shots: [],
  shotError: null,
  entryFile: null,
  carousel: [],
  carousels: {},
  cdn: {},
  live: [],
  publishedAt: null,
};

/** Copia o progresso da entrada anterior, com o inicial de cada campo ausente. */
function carryProgress(old) {
  const carried = {};
  for (const [field, initial] of Object.entries(PROGRESS_FIELDS)) {
    // structuredClone no inicial: sem ele, todas as entradas novas
    // compartilhariam o MESMO array e o mesmo objeto.
    carried[field] = old?.[field] ?? structuredClone(initial);
  }
  return carried;
}

function buildPlan(previous, startDate) {
  const units = workUnits('HEAD');
  // Reconciliacao por sha: o progresso pertence ao COMMIT, nao a posicao na
  // fila. Sem isso, um PR novo inserido no meio renumeraria tudo e o pipeline
  // republicaria entradas ja postadas.
  const bySha = new Map((previous?.entries ?? []).map((e) => [e.tip, e]));

  const entries = units.map((unit, index) => {
    const areas = touchedAreas(unit.commits);
    const stat = diffStat(unit.commits);
    const old = bySha.get(unit.tip);
    const id = String(index + 1).padStart(3, '0');

    return {
      id,
      pr: unit.pr,
      kind: unit.kind,
      title: unit.title,
      slug: slugify(unit.title),
      // O commit que a captura vai construir: o merge, ou seja, a main
      // exatamente como ficou depois deste trabalho entrar.
      tip: unit.tip,
      tipShort: unit.short,
      realDate: unit.date,
      publishDate: addDays(startDate, index),
      areas: areas.slice(0, 4),
      stat,
      commits: unit.commits.map((c) => ({ sha: c.short, subject: c.subject })),
      recipes: old?.recipes ?? pickRecipes(areas, unit.title, appsPresentAt(unit.tip, APPS)),
      ...carryProgress(old),
    };
  });

  return {
    version: 1,
    startDate,
    cadence: 'daily',
    entries,
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const previous = readPlan();

  if (args.list) {
    if (!previous) {
      console.error('plan.json ainda nao existe — rode sem --list primeiro.');
      process.exit(1);
    }
    for (const e of previous.entries) {
      const pr = e.pr ? `PR #${e.pr}` : 'direto';
      const mark = e.skipped ? 'x' : e.status === 'published' ? '*' : ' ';
      console.log(
        `${mark} ${e.id}  ${e.publishDate}  ${e.status.padEnd(9)} ${pr.padEnd(8)} ${e.title}`,
      );
    }
    const pending = previous.entries.filter((e) => e.status !== 'published' && !e.skipped).length;
    console.log(`\n${previous.entries.length} entradas, ${pending} pendentes.`);
    return;
  }

  const startDate =
    args.start ?? previous?.startDate ?? addDays(new Date().toISOString().slice(0, 10), 1);
  const plan = buildPlan(previous, startDate);
  writePlan(plan);

  const added = plan.entries.length - (previous?.entries.length ?? 0);
  console.log(
    `plan.json: ${plan.entries.length} entradas (${added >= 0 ? '+' : ''}${added}), dia 1 em ${startDate}.`,
  );
  const next = nextEntry(plan);
  if (next) console.log(`proxima: ${next.id} — ${next.title}`);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
