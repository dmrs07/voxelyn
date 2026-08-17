#!/usr/bin/env node
/**
 * Fecha uma entrada do devlog: confere que ela esta completa, marca como
 * publicada e reescreve o indice.
 *
 * "Publicada" aqui significa PRONTA E REGISTRADA no repositorio. A postagem no
 * Instagram continua sendo um ato humano — nao ha API de publicacao no fluxo,
 * e fingir que ha seria mentir no status.
 *
 * Uso:
 *   node scripts/devlog/publish.mjs --next
 *   node scripts/devlog/publish.mjs --entry 001 --at 2026-08-11
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { readSocial, renderCarousel } from './carousel.mjs';
import { devlogDir, entriesDir, socialDir } from './lib/paths.mjs';
import { nextEntry, readPlan, writePlan } from './plan.mjs';

function parseArgs(argv) {
  const args = { entry: null, next: false, at: null, force: false };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--next') args.next = true;
    else if (a === '--entry') args.entry = argv[++i];
    else if (a === '--at') args.at = argv[++i];
    else if (a === '--force') args.force = true;
  }
  return args;
}

/** Encontra o markdown da entrada pelo prefixo do id (o slug pode ser reescrito). */
function findEntryFile(id) {
  if (!existsSync(entriesDir)) return null;
  return readdirSync(entriesDir).find((f) => f.startsWith(`${id}-`) && f.endsWith('.md')) ?? null;
}

/**
 * Uma peca existe se esta em disco OU no CDN.
 *
 * Depois de `upload.mjs --prune` o arquivo local nao existe mais de proposito,
 * e exigir o disco faria toda publicacao seguinte abortar — a migracao para o
 * CDN travaria a tarefa diaria. O que importa e que a peca esteja em ALGUM
 * lugar de onde se possa servi-la.
 */
const present = (entry, relative) =>
  existsSync(resolve(devlogDir, relative)) || Boolean(entry.cdn?.[relative]);

/**
 * O que falta para a entrada estar pronta.
 *
 * Isto e a rede de seguranca da tarefa diaria: rodando sozinha as 9h, sem
 * ninguem olhando, o jeito de uma entrada quebrada virar "publicada" e nao
 * conferir.
 */
export function missingPieces(entry) {
  const missing = [];
  if (!entry.shots?.length) missing.push('screenshot (shoot.mjs)');
  for (const shot of entry.shots ?? [])
    if (!present(entry, `media/${shot.file}`)) missing.push(`media/${shot.file} sumiu`);

  if (!findEntryFile(entry.id)) missing.push(`entries/${entry.id}-*.md (a redacao)`);

  // A copy social e OBRIGATORIA, e nao um detalhe de acabamento.
  //
  // Sem ela o carousel.mjs ainda gera slides, derivados dos assuntos de
  // commit — um fallback que existe para testar o pipeline, nunca para
  // publicar. Se `publish` aceitasse esses arquivos, a etapa de redacao seria
  // silenciosamente pulada e o passo humano no Instagram chegaria sem legenda
  // e sem tags, com slides escritos em linguagem de commit.
  const social = resolve(socialDir, `${entry.id}.json`);
  if (!existsSync(social)) missing.push(`social/${entry.id}.json (a copy do Instagram)`);
  else {
    const copy = JSON.parse(readFileSync(social, 'utf8'));
    if (!copy.slides?.length) missing.push(`social/${entry.id}.json sem slides`);
    if (!copy.caption) missing.push(`social/${entry.id}.json sem legenda`);
  }

  if (!entry.carousel?.length) missing.push('carrossel (carousel.mjs)');
  for (const file of entry.carousel ?? [])
    if (!present(entry, `carousel/${file}`)) missing.push(`carousel/${file} sumiu`);

  return missing;
}

/** O H1 do post, sem o prefixo "NNN — ". */
function headline(file) {
  const match = /^#\s+(.+)$/m.exec(readFileSync(resolve(entriesDir, file), 'utf8'));
  return match ? match[1].replace(/^\d{3}\s*[—-]\s*/, '').trim() : null;
}

function buildIndex(plan) {
  const published = plan.entries.filter((e) => e.status === 'published');
  const lines = [
    '# Devlog do Voxelyn',
    '',
    'Um post por PR, em ordem cronologica. O texto conta o trabalho como ele foi feito;',
    'a imagem de cada entrada foi capturada construindo o commit daquele dia, nao o de hoje.',
    '',
    `${published.length} de ${plan.entries.length} entradas publicadas.`,
    '',
    '| # | Data | Entrada | PR |',
    '| --- | --- | --- | --- |',
  ];

  for (const e of published) {
    const file = findEntryFile(e.id);
    // O titulo do indice vem do H1 do proprio post, nao do assunto do commit:
    // "O chao parou de ser um bloco so" e o que foi publicado; o assunto do
    // commit e so a materia-prima de onde ele saiu.
    const title = file ? `[${headline(file) ?? e.title}](entries/${file})` : e.title;
    const pr = e.pr ? `[#${e.pr}](https://github.com/dmrs07/voxelyn/pull/${e.pr})` : '—';
    lines.push(`| ${e.id} | ${e.publishedAt ?? e.publishDate} | ${title} | ${pr} |`);
  }

  if (!published.length) lines.push('| — | — | _nada publicado ainda_ | — |');
  return `${lines.join('\n')}\n`;
}

/**
 * Recarimba a capa com a data em que a entrada SAIU.
 *
 * A ordem do pipeline e `carousel.mjs` e so depois `publish.mjs`, entao no
 * momento de desenhar os slides `publishedAt` ainda e null e a capa cai na
 * `publishDate` — a vaga que a entrada ocupa na fila da retrospectiva. Enquanto
 * a fila e publicada em ordem, as duas datas coincidem e ninguem nota. Publicar
 * FORA de ordem (curadoria) faz a capa anunciar uma data futura: a 111 esta
 * agendada para novembro e saiu em agosto.
 *
 * Redesenhar aqui e o unico ponto em que a data verdadeira ja existe. So roda
 * quando as duas divergem, entao a fila em ordem nao paga nada por isto.
 */
async function restampCarousel(entry) {
  if (entry.publishedAt === entry.publishDate) return [];
  const redone = [];
  const langs = [null, ...Object.keys(entry.carousels ?? {})];
  for (const lang of langs) {
    if (lang === null && !entry.carousel?.length) continue;
    const social = readSocial(entry.id, lang);
    const { files, pdf } = await renderCarousel(entry, social, {
      lang,
      dateLabel: entry.publishedAt,
    });
    if (lang) entry.carousels[lang] = { files, pdf };
    else entry.carousel = files;
    redone.push(lang ?? 'pt');
  }
  return redone;
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

  const missing = missingPieces(entry);
  if (missing.length && !args.force) {
    console.error(`entrada ${entry.id} incompleta:`);
    for (const m of missing) console.error(`  - falta ${m}`);
    console.error('\n(use --force para publicar assim mesmo)');
    process.exit(1);
  }

  entry.entryFile = findEntryFile(entry.id);
  entry.status = 'published';
  entry.publishedAt = args.at ?? new Date().toISOString().slice(0, 10);
  const redone = await restampCarousel(entry);
  writePlan(plan);

  writeFileSync(resolve(devlogDir, 'INDEX.md'), buildIndex(plan));

  console.log(`entrada ${entry.id} publicada em ${entry.publishedAt}: ${entry.title}`);
  if (redone.length)
    console.log(
      `capa recarimbada com ${entry.publishedAt} (agendada era ${entry.publishDate}): ${redone.join(', ')}`,
    );
  if (missing.length) console.log(`aviso: publicada com pendencias — ${missing.join('; ')}`);
  const next = nextEntry(plan);
  console.log(next ? `proxima: ${next.id} (${next.publishDate}) — ${next.title}` : 'fila vazia.');
  if (entry.carousel?.length)
    console.log(
      `\npara postar: docs/devlog/carousel/${entry.id}-*.png (${entry.carousel.length} slides)`,
    );
}

if (import.meta.url === `file://${process.argv[1]}`)
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
