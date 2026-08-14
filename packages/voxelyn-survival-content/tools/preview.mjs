// Folha de contato de um atlas gerado, ampliada, para conferir o desenho SEM
// abrir o jogo.
//
// Existe porque autorar um modelo voxel as cegas nao funciona: a leitura de uma
// silhueta na projecao 2:1 nao sai do codigo, sai do resultado. O erro que este
// arquivo pegou primeiro foi estrutural e ninguem teria visto lendo o gerador —
// a face de topo de todo material `rust` e cor de osso, entao um tronco
// horizontal grande projeta um plano claro do tamanho do bicho, e o Corcel lia
// como uma mesa. O sintoma so aparece ampliado e sobre fundo escuro.
//
//   node tools/preview.mjs <id> "dr:idle,dr:attack" saida.png [escala] [flags]
//
// Uma linha por par direcao:animacao; uma coluna por quadro.
//
// Um terceiro campo fixa um unico quadro daquela animacao — `dr:idle:0` e o
// quadro-chave da pose, sem os intermediarios. Com `--strip` as entradas
// deixam de ser linhas e entram lado a lado numa faixa unica, que e o formato
// de folha de personagem: a mesma pose vista nas quatro direcoes, ou quatro
// poses distintas na mesma direcao, comparaveis de relance.
//
// `--over <id>[@r,g,b,a]` empilha outro atlas por cima, quadro a quadro, com um
// tint chapado opcional. O Prospector nao mora mais num sheet so: pernas, tronco
// e ARMA sao tres atlas que o cliente compoe em tempo de execucao, e a arma
// ainda recebe a cor do calor do cano. Conferir a arma no sheet monolitico
// mostra um bloco escuro do tamanho de um punho perdido no chassi; o mesmo
// quadro com o tint de calor por cima mostra o que o jogador de fato ve.
// Quando a camada empilhada nao tem a animacao pedida — a arma nao anda, ela e
// carregada — cai para `idle`, que e exatamente o que o cliente desenha quando
// as pernas caminham e o tronco nao.
import { PNG } from 'pngjs';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../assets/atlases');
const argv = process.argv.slice(2);
const strip = argv.includes('--strip');
const overs = argv.filter((a) => a.startsWith('--over=')).map((a) => a.slice('--over='.length));
const [id, spec, outName, scaleArg] = argv.filter((a) => !a.startsWith('--'));
const scale = Number(scaleArg || 4);

const load = (atlasId) => {
  const manifest = JSON.parse(readFileSync(resolve(DIR, `${atlasId}.json`), 'utf8'));
  return { manifest, png: PNG.sync.read(readFileSync(resolve(DIR, manifest.atlas))) };
};

// `<id>@r,g,b,a` -> camada com tint chapado; sem o `@`, a camada sai como esta.
const layers = [{ ...load(id) }, ...overs.map((arg) => {
  const [overId, tintArg] = arg.split('@');
  const layer = load(overId);
  if (!tintArg) return layer;
  const [r, g, b, a] = tintArg.split(',').map(Number);
  return { ...layer, tint: { r, g, b, a } };
})];
const base = layers[0].manifest;

// spec: "dr:idle,dr:attack,ul:idle" -> uma linha por entrada, colunas = frames
// spec: "dr:idle:0" -> so o quadro 0 daquela animacao
let rows = spec.split(',').map((s) => {
  const [dir, anim, frame] = s.split(':');
  const count = frame === undefined ? base.animations[anim].frames : 1;
  const first = frame === undefined ? 0 : Number(frame);
  return Array.from({ length: count }, (_, f) => ({ dir, anim, frame: first + f }));
});
// --strip: uma faixa horizontal com todas as entradas em sequencia
if (strip) rows = [rows.flat()];
const cols = Math.max(...rows.map((r) => r.length));

// O indice do quadro e resolvido POR CAMADA: os tres atlas do Prospector tem
// contagens e ordens proprias, e reaproveitar o indice do sheet base colaria a
// arma no quadro errado.
const frameIndex = (manifest, cell) => {
  const anim = manifest.animations[cell.anim] ? cell.anim : 'idle';
  const start = manifest.frameMap[cell.dir]?.[anim];
  if (start === undefined) return undefined;
  return start + (cell.frame % manifest.animations[anim].frames);
};

const out = new PNG({ width: cols * base.frameWidth * scale, height: rows.length * base.frameHeight * scale });
// fundo escuro para enxergar a silhueta
for (let i = 0; i < out.width * out.height; i++) {
  out.data[i * 4] = 20; out.data[i * 4 + 1] = 24; out.data[i * 4 + 2] = 32; out.data[i * 4 + 3] = 255;
}
const mix = (a, b, t) => Math.round(a + (b - a) * t);
rows.forEach((r, ri) => {
  r.forEach((cell, f) => {
    for (const { manifest, png, tint } of layers) {
      const idx = frameIndex(manifest, cell);
      if (idx === undefined) continue;
      const x0 = (idx % manifest.columns) * manifest.frameWidth;
      const y0 = Math.floor(idx / manifest.columns) * manifest.frameHeight;
      for (let y = 0; y < manifest.frameHeight; y++) {
        for (let x = 0; x < manifest.frameWidth; x++) {
          const si = ((y0 + y) * png.width + x0 + x) * 4;
          if (png.data[si + 3] === 0) continue;
          const rgb = tint
            ? [mix(png.data[si], tint.r, tint.a), mix(png.data[si + 1], tint.g, tint.a), mix(png.data[si + 2], tint.b, tint.a)]
            : [png.data[si], png.data[si + 1], png.data[si + 2]];
          for (let sy = 0; sy < scale; sy++) {
            for (let sx = 0; sx < scale; sx++) {
              const tx = (f * base.frameWidth + x) * scale + sx;
              const ty = (ri * base.frameHeight + y) * scale + sy;
              const ti = (ty * out.width + tx) * 4;
              out.data[ti] = rgb[0];
              out.data[ti + 1] = rgb[1];
              out.data[ti + 2] = rgb[2];
              out.data[ti + 3] = 255;
            }
          }
        }
      }
    }
  });
});
writeFileSync(outName, PNG.sync.write(out));
console.log(`${outName} ${out.width}x${out.height}`);
