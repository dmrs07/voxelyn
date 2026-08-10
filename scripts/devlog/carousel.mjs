#!/usr/bin/env node
/**
 * Renderiza o carrossel do Instagram de uma entrada: PNGs 1080x1350 prontos
 * para postar, no visual do proprio jogo.
 *
 * A copy vem de docs/devlog/social/<id>.json (escrito na etapa de redacao).
 * Sem esse arquivo o carrossel ainda sai, derivado dos assuntos de commit —
 * util para testar o pipeline, mas nao e o post que se publica.
 *
 * Uso:
 *   node scripts/devlog/carousel.mjs --entry 001
 *   node scripts/devlog/carousel.mjs --next
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { chromium } from 'playwright';

import { carouselDir, chromiumExecutable, devlogDir } from './lib/paths.mjs';
import { SLIDE, buildSlides, slidesDocument } from './lib/slides.mjs';
import { nextEntry, readPlan, writePlan } from './plan.mjs';

export const socialDir = resolve(devlogDir, 'social');

function parseArgs(argv) {
  const args = { entry: null, next: false };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--next') args.next = true;
    else if (argv[i] === '--entry') args.entry = argv[++i];
  }
  return args;
}

export function readSocial(id) {
  const path = resolve(socialDir, `${id}.json`);
  if (!existsSync(path)) return {};
  return JSON.parse(readFileSync(path, 'utf8'));
}

export async function renderCarousel(entry, social) {
  const slides = buildSlides(entry, social);
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

    mkdirSync(carouselDir, { recursive: true });
    const files = [];
    for (let i = 0; i < slides.length; i += 1) {
      const el = await page.$(`[data-slide="${i + 1}"]`);
      const file = `${entry.id}-${String(i + 1).padStart(2, '0')}.png`;
      writeFileSync(resolve(carouselDir, file), await el.screenshot({ type: 'png' }));
      files.push(file);
    }
    return files;
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

  const social = readSocial(entry.id);
  if (!social.slides) console.log('aviso: sem copy em docs/devlog/social — usando os commits.');

  const files = await renderCarousel(entry, social);
  entry.carousel = files;
  writePlan(plan);

  console.log(`carrossel da entrada ${entry.id}: ${files.length} slides`);
  for (const f of files) console.log(`  docs/devlog/carousel/${f}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
