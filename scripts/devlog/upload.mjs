#!/usr/bin/env node
/**
 * Sobe os binarios de uma entrada para o Cloudinary e grava as URLs no plano.
 *
 * O motivo e peso: cada entrada carrega ~1,3 MB de PNG, e as 107 dariam ~140 MB
 * versionados num repositorio de codigo. O git guarda para sempre cada versao
 * de cada binario — recapturar uma entrada duplicaria o peso em vez de
 * substitui-lo.
 *
 * A partir daqui o plano guarda, por entrada, um mapa `cdn` de caminho
 * relativo para URL publica. Quem exibe (o servico, o carrossel, o markdown)
 * PREFERE a URL e cai no arquivo local quando ela nao existe — entao subir e
 * incremental e nada quebra no meio do caminho.
 *
 * Credenciais vem do ambiente, nunca de arquivo versionado:
 *   CLOUDINARY_URL=cloudinary://<key>:<secret>@<cloud>
 *   (ou CLOUDINARY_CLOUD_NAME + CLOUDINARY_API_KEY + CLOUDINARY_API_SECRET)
 *
 * Uso:
 *   node scripts/devlog/upload.mjs --entry 001
 *   node scripts/devlog/upload.mjs --all
 *   node scripts/devlog/upload.mjs --all --prune   # tira do disco o que subiu
 */
import { existsSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { CloudinaryError, credentialsFromEnv, publicIdFor, uploadFile } from './lib/cloudinary.mjs';
import { devlogDir, entriesDir } from './lib/paths.mjs';
import { nextEntry, readPlan, writePlan } from './plan.mjs';

function parseArgs(argv) {
  const args = { entry: null, all: false, next: false, prune: false, force: false };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--all') args.all = true;
    else if (a === '--next') args.next = true;
    else if (a === '--prune') args.prune = true;
    else if (a === '--force') args.force = true;
    else if (a === '--entry') args.entry = argv[++i];
  }
  return args;
}

/**
 * Todos os binarios que uma entrada tem em disco.
 *
 * Sai do PLANO e nao de um `readdir` solto: o plano sabe quais arquivos
 * pertencem a esta entrada, e varrer o diretorio arrastaria os vizinhos.
 */
export const assetsOf = (entry) => {
  const paths = [];
  for (const shot of entry.shots ?? []) paths.push(`media/${shot.file}`);
  for (const file of entry.carousel ?? []) paths.push(`carousel/${file}`);
  for (const [lang, pack] of Object.entries(entry.carousels ?? {})) {
    for (const file of pack.files ?? []) paths.push(`carousel/${lang}/${file}`);
    if (pack.pdf) paths.push(`carousel/${lang}/${pack.pdf}`);
  }
  return paths.filter((p) => existsSync(resolve(devlogDir, p)));
};

/**
 * Reescreve as imagens do post para a URL publica.
 *
 * Sem isto, tirar os PNGs do git quebraria a renderizacao do markdown no
 * proprio GitHub: o servico reescreveria o caminho, mas quem abre
 * `docs/devlog/entries/001-*.md` no navegador veria imagem quebrada.
 */
const rewritePost = (id, cdn) => {
  if (!existsSync(entriesDir)) return false;
  const file = readdirSync(entriesDir).find((f) => f.startsWith(`${id}-`) && f.endsWith('.md'));
  if (!file) return false;

  const path = resolve(entriesDir, file);
  const before = readFileSync(path, 'utf8');
  const after = before.replace(/\.\.\/(media|carousel)\/([^\s)]+)/g, (whole, folder, rest) => {
    const url = cdn[`${folder}/${rest}`];
    return url ?? whole;
  });
  if (after === before) return false;
  writeFileSync(path, after);
  return true;
};

/**
 * Confirma que a URL responde ANTES de o arquivo local sumir.
 *
 * O `--prune` apaga o unico outro lugar onde a imagem existe. Confiar na
 * resposta do upload sem conferir a entrega e como apagar o original porque a
 * copiadora nao reclamou.
 */
const reachable = async (url) => {
  try {
    const res = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(20_000) });
    return res.ok;
  } catch {
    return false;
  }
};

async function uploadEntry(entry, credentials, args, log) {
  const assets = assetsOf(entry);
  if (!assets.length) {
    log(`  ${entry.id}: nenhum binario em disco`);
    return { uploaded: 0, pruned: 0 };
  }

  const cdn = { ...(entry.cdn ?? {}) };
  let uploaded = 0;

  for (const relative of assets) {
    if (cdn[relative] && !args.force) continue;
    const result = await uploadFile(
      resolve(devlogDir, relative),
      publicIdFor(relative),
      credentials,
    );
    cdn[relative] = result.url;
    uploaded += 1;
    log(`  ${relative} -> ${result.url} (${(result.bytes / 1024).toFixed(0)} KB)`);
  }

  entry.cdn = cdn;
  if (rewritePost(entry.id, cdn)) log(`  post reescrito para as URLs do CDN`);

  let pruned = 0;
  if (args.prune) {
    for (const relative of assets) {
      const url = cdn[relative];
      if (!url || !(await reachable(url))) {
        log(`  MANTIDO em disco (url nao respondeu): ${relative}`);
        continue;
      }
      rmSync(resolve(devlogDir, relative), { force: true });
      pruned += 1;
    }
  }
  return { uploaded, pruned };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const plan = readPlan();
  if (!plan) {
    console.error('plan.json nao existe — rode `node scripts/devlog/plan.mjs` primeiro.');
    process.exit(1);
  }

  let credentials;
  try {
    credentials = credentialsFromEnv();
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
  if (!credentials) {
    console.error(
      'credenciais do Cloudinary ausentes. Defina CLOUDINARY_URL, ou as tres:\n' +
        '  CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET',
    );
    process.exit(1);
  }

  const targets = args.all
    ? plan.entries.filter((e) => assetsOf(e).length)
    : [
        args.next
          ? nextEntry(plan)
          : plan.entries.find((e) => e.id === args.entry?.padStart(3, '0')),
      ].filter(Boolean);

  if (!targets.length) {
    console.error('nada a subir — use --entry NNN, --next ou --all.');
    process.exit(1);
  }

  console.log(`cloud ${credentials.cloudName}, ${targets.length} entrada(s)`);
  let uploaded = 0;
  let pruned = 0;
  const failures = [];

  for (const entry of targets) {
    console.log(`entrada ${entry.id} — ${entry.title}`);
    try {
      const result = await uploadEntry(entry, credentials, args, (m) => console.log(m));
      uploaded += result.uploaded;
      pruned += result.pruned;
    } catch (err) {
      // Uma entrada que falha nao derruba o lote: as que ja subiram tem a URL
      // gravada, e reexecutar retoma exatamente de onde parou.
      const reason = err instanceof CloudinaryError ? err.message : String(err);
      console.error(`  FALHOU: ${reason}`);
      failures.push(`${entry.id}: ${reason}`);
    }
    // Grava a cada entrada, e nao no fim: uma queda no meio de 107 entradas
    // nao pode perder o registro do que ja subiu.
    writePlan(plan);
  }

  console.log(
    `\n${uploaded} arquivo(s) no CDN${args.prune ? `, ${pruned} removido(s) do disco` : ''}.`,
  );
  if (failures.length) {
    console.error(`${failures.length} falha(s):`);
    for (const f of failures) console.error(`  ${f}`);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
