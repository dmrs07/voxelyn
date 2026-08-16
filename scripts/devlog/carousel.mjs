#!/usr/bin/env node
/**
 * Renderiza o carrossel de uma entrada: PNGs 1080x1350 prontos para postar, no
 * visual do proprio jogo.
 *
 * A copy vem de docs/devlog/social/<id>.json (escrito na etapa de redacao).
 * Sem esse arquivo o carrossel ainda sai, derivado dos assuntos de commit —
 * util para testar o pipeline, mas nao e o post que se publica.
 *
 * `--lang en` le <id>.en.json e escreve em carousel/en/, junto com um PDF: o
 * carrossel do LinkedIn e um "documento", nao uma sequencia de imagens, e o
 * upload de PDF e a unica forma de conseguir aquele formato la.
 *
 * Uso:
 *   node scripts/devlog/carousel.mjs --entry 001
 *   node scripts/devlog/carousel.mjs --entry 001 --lang en
 *   node scripts/devlog/carousel.mjs --next
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';

import { chromium } from 'playwright';

import { carouselDir, chromiumExecutable, repoRoot, socialDir } from './lib/paths.mjs';
import { SLIDE, buildSlides, slidesDocument } from './lib/slides.mjs';
import { nextEntry, readPlan, writePlan } from './plan.mjs';

function parseArgs(argv) {
  const args = { entry: null, next: false, lang: null };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--next') args.next = true;
    else if (argv[i] === '--entry') args.entry = argv[++i];
    else if (argv[i] === '--lang') args.lang = argv[++i];
  }
  return args;
}

/** Nome do arquivo de copy: `001.json` para o padrao, `001.en.json` por idioma. */
export function socialPath(id, lang) {
  return resolve(socialDir, lang ? `${id}.${lang}.json` : `${id}.json`);
}

export function readSocial(id, lang = null) {
  const path = socialPath(id, lang);
  if (!existsSync(path)) return {};
  return JSON.parse(readFileSync(path, 'utf8'));
}

export async function renderCarousel(entry, social, { lang = null, dateLabel = null } = {}) {
  const slides = buildSlides(entry, social, { lang, dateLabel });
  const outDir = lang ? resolve(carouselDir, lang) : carouselDir;
  const browser = await chromium.launch({ executablePath: chromiumExecutable() });
  try {
    const page = await browser.newPage({
      viewport: { width: SLIDE.width, height: SLIDE.height },
      // 1080x1350 ja e a resolucao final do Instagram: ampliar aqui so
      // produziria um arquivo maior que a plataforma reamostra de volta.
      deviceScaleFactor: 1,
    });
    await page.setContent(slidesDocument(slides), { waitUntil: 'load' });
    // As fontes estao embutidas em base64, mas o decode ainda e assincrono:
    // capturar antes dele renderiza o fallback do sistema.
    await page.evaluate(() => document.fonts.ready);

    mkdirSync(outDir, { recursive: true });
    const files = [];
    for (let i = 0; i < slides.length; i += 1) {
      const el = await page.$(`[data-slide="${i + 1}"]`);
      const file = `${entry.id}-${String(i + 1).padStart(2, '0')}.png`;
      writeFileSync(resolve(outDir, file), await el.screenshot({ type: 'png' }));
      files.push(file);
    }

    // O PDF sai da MESMA pagina, entao o documento e as imagens soltas nunca
    // divergem: e um segundo formato do mesmo render, nao uma segunda montagem.
    //
    // So no caminho por idioma, que e o do LinkedIn. O Instagram consome
    // imagem, entao um PDF em portugues seria um arquivo que ninguem abre —
    // e um binario a mais para versionar ou subir.
    let pdf = null;
    if (lang) {
      pdf = `${entry.id}.pdf`;
      writeFileSync(
        resolve(outDir, pdf),
        await page.pdf({
          width: `${SLIDE.width}px`,
          height: `${SLIDE.height}px`,
          printBackground: true,
          pageRanges: `1-${slides.length}`,
        }),
      );
    }

    return { files, pdf };
  } finally {
    await browser.close();
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
  if (!entry.shots?.length) {
    console.error(`entrada ${entry.id} ainda nao tem screenshot — rode shoot.mjs antes.`);
    process.exit(1);
  }

  const social = readSocial(entry.id, args.lang);
  if (!social.slides)
    console.log(
      `aviso: sem copy em ${relative(repoRoot, socialPath(entry.id, args.lang))} — usando os commits.`,
    );

  const { files, pdf } = await renderCarousel(entry, social, { lang: args.lang });
  // Cada idioma guarda o proprio registro: `carousel` continua sendo o do
  // Instagram em portugues, que e o que `publish.mjs` exige.
  if (args.lang) entry.carousels = { ...(entry.carousels ?? {}), [args.lang]: { files, pdf } };
  else entry.carousel = files;
  writePlan(plan);

  const dir = args.lang ? `docs/devlog/carousel/${args.lang}` : 'docs/devlog/carousel';
  console.log(
    `carrossel da entrada ${entry.id}${args.lang ? ` (${args.lang})` : ''}: ${files.length} slides`,
  );
  for (const f of files) console.log(`  ${dir}/${f}`);
  if (pdf) console.log(`  ${dir}/${pdf}  <- documento para o LinkedIn`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
