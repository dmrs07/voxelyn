// A ENTREGA COMPLETA, num comando.
//
//   pnpm --filter @voxelyn/survival-content render:splash:all
//
// Cada saida e um RENDER, nunca um recorte. A diferenca importa e o briefing e
// explicito sobre ela: "Nao distorca a camera para cada crop. Use composicao e
// enquadramento adequados."
//
// Recortar o master 16:9 para 16:10 ou para paisagem de celular jogaria fora
// justamente as bordas — as massas de rocha que fecham a composicao — ou
// deslocaria o branding para fora da area segura. Renderizando cada proporcao
// com a MESMA camera (mesma posicao, mesmo alvo, mesmo campo de visao
// VERTICAL), o enquadramento vertical fica identico e so a extensao horizontal
// muda, que e exatamente o que uma camera de verdade faz ao trocar de sensor. O
// branding acompanha porque esta em unidades de altura de quadro.
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const script = join(here, 'render-splash.mjs');
const out = 'artifacts/splash/guardian-core';
const repoRoot = resolve(here, '../../../..');

/**
 * As entregas. `samples` cai nas proporcoes secundarias porque elas existem para
 * conferir enquadramento em outro sensor, e nao para ampliacao — quatro amostras
 * por pixel num render que ninguem vai imprimir sao minutos gastos a toa.
 */
const OUTPUTS = [
  { width: 3840, height: 2160, samples: 4, passes: true, branding: true, note: 'master 4K 16:9' },
  { width: 1920, height: 1080, samples: 4, passes: false, branding: true, note: 'entrega 1080p 16:9' },
  { width: 1280, height: 720, samples: 2, passes: false, branding: false, note: 'preview na resolucao alvo do jogo (art bible: desktop 1280x720)' },
  { width: 2560, height: 1600, samples: 2, passes: false, branding: true, note: 'crop seguro 16:10' },
  { width: 2436, height: 1125, samples: 2, passes: false, branding: true, note: 'crop seguro paisagem de celular (19.5:9)' },
];

for (const o of OUTPUTS) {
  const args = [
    script,
    '--width', String(o.width),
    '--height', String(o.height),
    '--samples', String(o.samples),
    '--out', out,
  ];
  if (o.passes) args.push('--passes');
  if (o.branding) args.push('--branding');
  console.log(`\n=== ${o.width}x${o.height} — ${o.note}`);
  const r = spawnSync(process.execPath, args, { stdio: 'inherit' });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

// O COMPARATIVO fecha a entrega, e precisa estar aqui.
//
// Ele era gerado a mao depois do conjunto, e o README ja o listava entre as
// saidas do comando — ou seja, quem rodasse `render:splash:all` num diretorio
// limpo receberia uma entrega a menos do que a documentacao promete. A unica
// forma de a lista nao mentir e o comando produzir tudo o que ela diz.
//
// Ele depende da referencia versionada em `docs/art/splash/`; se ela nao estiver
// la, o conjunto ja renderizado continua valendo e so o comparativo e pulado —
// derrubar a entrega inteira por causa de um arquivo de briefing ausente seria
// desproporcional.
const reference = join(repoRoot, 'docs/art/splash/reference-ai-briefing.png');
console.log('\n=== comparativo com a referencia');
if (!existsSync(reference)) {
  console.log(`  pulado: referencia ausente em ${reference}`);
} else {
  const r = spawnSync(process.execPath, [join(here, 'compare.mjs')], { stdio: 'inherit' });
  if (r.status !== 0) process.exit(r.status ?? 1);
}
