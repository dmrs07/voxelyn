// COMPARATIVO: a referencia ao lado do render, na mesma altura.
//
//   node tools/splash/compare.mjs
//
// Existe porque o briefing pede o comparativo como entrega, e porque ele e a
// unica forma honesta de mostrar o que a splash herdou da referencia e o que
// ela deliberadamente NAO herdou.
//
// O que herdou: hierarquia visual (bot no terco inferior esquerdo, chefe ao
// centro, berco no terco superior direito), a diagonal que liga os tres, o
// branding no canto inferior direito, as massas escuras fechando as bordas e a
// estrutura de valor — sombras cobrindo cerca de 60% do quadro.
//
// O que nao herdou, e por que: a rocha. A referencia mostra basalto marrom
// neutro; o basalto do Voxelyn e azul-acinzentado ([46 58 77] na paleta mestra
// da art bible), e a paleta e fonte de verdade acima da referencia. O mesmo vale
// para a anatomia do Guardiao — a referencia desenha um visor em fenda com
// placas claras, o modelo canonico tem nucleo redondo difuso e sete torres — e
// para o traçado da Vein, que aqui segue as celulas de leyline que o worldgen
// gravou em vez de uma linha desenhada pelo chao.
import { PNG } from 'pngjs';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '../../../..');
const packageRoot = resolve(here, '../..');

/** Reamostragem por vizinho mais proximo. Nitida, e o suficiente para conferir. */
const scaleTo = (png, w, h) => {
  const out = new PNG({ width: w, height: h });
  for (let y = 0; y < h; y++) {
    const sy = Math.min(png.height - 1, Math.floor((y * png.height) / h));
    for (let x = 0; x < w; x++) {
      const sx = Math.min(png.width - 1, Math.floor((x * png.width) / w));
      const si = (sy * png.width + sx) * 4;
      const di = (y * w + x) * 4;
      out.data[di] = png.data[si];
      out.data[di + 1] = png.data[si + 1];
      out.data[di + 2] = png.data[si + 2];
      out.data[di + 3] = 255;
    }
  }
  return out;
};

const reference = PNG.sync.read(
  readFileSync(join(repoRoot, 'docs/art/splash/reference-ai-briefing.png'))
);
const render = PNG.sync.read(
  readFileSync(
    join(packageRoot, 'artifacts/splash/guardian-core/guardian-core-3840x2160-branded.png')
  )
);

const H = 900;
const GAP = 24;
const refW = Math.round((reference.width / reference.height) * H);
const renW = Math.round((render.width / render.height) * H);
const left = scaleTo(reference, refW, H);
const right = scaleTo(render, renW, H);

const out = new PNG({ width: refW + GAP + renW, height: H });
out.data.fill(0);
for (let y = 0; y < H; y++) {
  out.data.set(left.data.subarray(y * refW * 4, (y + 1) * refW * 4), (y * out.width) * 4);
  out.data.set(
    right.data.subarray(y * renW * 4, (y + 1) * renW * 4),
    (y * out.width + refW + GAP) * 4
  );
}

const dest = join(packageRoot, 'artifacts/splash/guardian-core/comparison-reference-vs-render.png');
writeFileSync(dest, PNG.sync.write(out));
console.log(`comparativo -> ${dest}  (${out.width}x${out.height})`);
console.log(`  esquerda: referencia da IA que serviu de briefing (${reference.width}x${reference.height})`);
console.log(`  direita:  render 3D da pipeline (${render.width}x${render.height})`);
