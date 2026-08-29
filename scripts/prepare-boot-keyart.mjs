// Deriva o fundo da tela de carregamento do Survival a partir da key art 4K.
//
// A key art master (`docs/art/splash/`) e um PNG de 2,5 MB por 3840x2160 — a
// entrega, feita para impressao e para a loja. O boot precisa de outra coisa:
// uma imagem que chegue RAPIDO num celular, atras de uma folha de UI escura,
// e que possa ficar fora do caminho critico sem nunca segurar o jogador.
//
// Por isso o asset do jogo e derivado, e nao a entrega:
//
// - FONTE: a versao SEM branding (`-clean`). A tipografia do boot e HTML na
//   fonte do sistema de design (localizada, responsiva, nitida em qualquer
//   densidade); o wordmark queimado no pixel brigaria com ela.
// - 1600 px de largura. Acima disso a imagem so ganha detalhe que a folha de
//   UI cobre; abaixo, a rocha comeca a chapar nas telas grandes.
// - WebP q90. Aqui a regra da trilha (lossless, sempre) NAO se aplica: ela
//   existe porque o master do compositor e a obra; este arquivo e uma
//   REDUCAO de uma obra que continua versionada intacta em docs/art/splash/.
//   PNG no mesmo tamanho custa 1,3 MB — sete vezes o peso por uma diferenca
//   que ninguem enxerga sob a vinheta e os 45% de opacidade do boot.
//
// Rodar:  pnpm keyart:boot
//
// O arquivo e OPCIONAL para o jogo: ausente, a tela de carregamento fica so
// com o leito escuro do design system e nada quebra (ver boot/boot-tasks.ts).

import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const root = process.cwd();
const source = path.join(
  root,
  'docs',
  'art',
  'splash',
  'voxelyn-survival-splash-3840x2160-clean.png',
);
const outputDir = path.join(root, 'packages', 'voxelyn-survival', 'public', 'boot');
const output = path.join(outputDir, 'keyart-1600.webp');

/** Largura do asset de boot, px. Ver o cabecalho para o porque deste numero. */
const WIDTH = 1600;
/** Qualidade WebP. 90 e o joelho da curva nesta arte: 82 ja bandeia o ceu. */
const QUALITY = 90;

const run = async () => {
  await mkdir(outputDir, { recursive: true });
  const info = await sharp(source)
    .resize(WIDTH, null, { kernel: 'lanczos3' })
    .webp({ quality: QUALITY, effort: 6 })
    .toFile(output);
  const kb = (info.size / 1024).toFixed(0);
  console.log(`key art de boot: ${info.width}x${info.height} · ${kb} KB · ${output}`);
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
