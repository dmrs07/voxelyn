// Prepara a marca do desenvolvedor para a tela de abertura do Survival.
//
// A tela de identidade e a PRIMEIRA coisa que o jogador ve, e ela e preta. Um
// logo entregue como o artista exportou — 1024x1024 com fundo branco chapado —
// apareceria ali como um retangulo branco no meio do vazio. Este script faz as
// tres coisas que faltam entre o arquivo do artista e o arquivo do jogo:
//
//   1. RECORTA O FUNDO POR INUNDACAO, a partir das bordas. E diferente de
//      "apagar o branco": a inundacao so alcanca o branco CONECTADO a moldura,
//      entao o branco de dentro do desenho (os olhos, os dentes) sobrevive
//      intacto. Um limiar simples comeria os dois.
//   2. APARA a moldura vazia. O logo vinha ocupando menos da metade do quadro,
//      e o CSS dimensiona pela caixa da imagem: sem aparar, a marca apareceria
//      pequena no centro de um retangulo transparente enorme.
//   3. REDUZ para 512 px e empacota em WebP. Sao ~2x o tamanho maximo de
//      exibicao (a marca desenha com ate 240 px), o que cobre 2 dppx nativo e
//      3 dppx com uma reducao imperceptivel neste tipo de arte.
//
// Rodar:  pnpm ident:prepare
//
// A fonte fica versionada em `docs/art/ident/`, e o resultado em
// `packages/voxelyn-survival/public/ident/`. O arquivo e OPCIONAL para o jogo:
// ausente, a fase de identidade dura zero e a abertura comeca na tela de
// carregamento (ver `src/client/boot/developer-ident.ts`).

import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const root = process.cwd();
const source = path.join(root, 'docs', 'art', 'ident', 'developer-mark-source.png');
const outputDir = path.join(root, 'packages', 'voxelyn-survival', 'public', 'ident');
const output = path.join(outputDir, 'developer-mark.webp');

/** Lado do asset, px. ~2x o maximo de exibicao (240 px) — cobre 2 dppx. */
const SIZE = 512;
/** Acima disto um pixel conta como fundo. Alto porque o fundo e branco puro. */
const WHITE = 236;
/** Suavidade da borda: a faixa (WHITE-FEATHER..WHITE) vira alfa parcial. */
const FEATHER = 40;

/**
 * Torna transparente o fundo conectado as bordas.
 *
 * O alfa e proporcional a quao branco o pixel era, e nao 0 ou 255: um pixel de
 * borda meio branco vira meio transparente, que e o que evita a franja branca
 * classica de um recorte por limiar duro.
 */
const keyBackground = ({ data, width, height, channels }) => {
  const isBackground = (i) => data[i] >= WHITE && data[i + 1] >= WHITE && data[i + 2] >= WHITE;

  const flooded = new Uint8Array(width * height);
  const stack = [];
  for (let x = 0; x < width; x += 1) stack.push(x, x + (height - 1) * width);
  for (let y = 0; y < height; y += 1) stack.push(y * width, width - 1 + y * width);

  while (stack.length > 0) {
    const pixel = stack.pop();
    if (flooded[pixel]) continue;
    if (!isBackground(pixel * channels)) continue;
    flooded[pixel] = 1;
    const x = pixel % width;
    const y = (pixel - x) / width;
    if (x > 0) stack.push(pixel - 1);
    if (x < width - 1) stack.push(pixel + 1);
    if (y > 0) stack.push(pixel - width);
    if (y < height - 1) stack.push(pixel + width);
  }

  let cleared = 0;
  for (let pixel = 0; pixel < width * height; pixel += 1) {
    if (!flooded[pixel]) continue;
    const i = pixel * channels;
    const luma = (data[i] + data[i + 1] + data[i + 2]) / 3;
    data[i + 3] = Math.max(0, Math.min(255, Math.round((WHITE - luma) * (255 / FEATHER))));
    if (data[i + 3] === 0) cleared += 1;
  }
  return cleared;
};

const run = async () => {
  await mkdir(outputDir, { recursive: true });

  const raw = await sharp(source).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const cleared = keyBackground({ ...raw.info, data: raw.data });

  const keyed = await sharp(raw.data, { raw: raw.info }).png().toBuffer();
  const info = await sharp(keyed)
    // `threshold: 1` apara pelo ALFA: o recorte acima ja zerou o fundo, e um
    // limiar maior comecaria a comer o contorno preto do desenho.
    .trim({ threshold: 1 })
    .resize({
      width: SIZE,
      height: SIZE,
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
      kernel: 'lanczos3',
    })
    .webp({ quality: 92, alphaQuality: 100, effort: 6 })
    .toFile(output);

  const kb = (info.size / 1024).toFixed(0);
  console.log(`marca do desenvolvedor: ${info.width}x${info.height} · ${kb} KB · ${output}`);
  console.log(`fundo recortado: ${cleared.toLocaleString('pt-BR')} px`);
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
