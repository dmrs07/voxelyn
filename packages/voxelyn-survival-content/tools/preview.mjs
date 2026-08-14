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
//   node tools/preview.mjs <id> "dr:idle,dr:attack" saida.png [escala] [--strip]
//
// Uma linha por par direcao:animacao; uma coluna por quadro.
//
// Um terceiro campo fixa um unico quadro daquela animacao — `dr:idle:0` e o
// quadro-chave da pose, sem os intermediarios. Com `--strip` as entradas
// deixam de ser linhas e entram lado a lado numa faixa unica, que e o formato
// de folha de personagem: a mesma pose vista nas quatro direcoes, ou quatro
// poses distintas na mesma direcao, comparaveis de relance.
import { PNG } from 'pngjs';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../assets/atlases');
const argv = process.argv.slice(2);
const strip = argv.includes('--strip');
const [id, spec, outName, scaleArg] = argv.filter((a) => !a.startsWith('--'));
const m = JSON.parse(readFileSync(resolve(DIR, `${id}.json`), 'utf8'));
const png = PNG.sync.read(readFileSync(resolve(DIR, m.atlas)));
const scale = Number(scaleArg || 4);

// spec: "dr:idle,dr:attack,ul:idle" -> uma linha por entrada, colunas = frames
// spec: "dr:idle:0" -> so o quadro 0 daquela animacao
let rows = spec.split(',').map((s) => {
  const [dir, anim, frame] = s.split(':');
  const start = m.frameMap[dir][anim];
  if (frame !== undefined) return { dir, anim, start: start + Number(frame), count: 1 };
  return { dir, anim, start, count: m.animations[anim].frames };
});
// --strip: uma faixa horizontal com todas as entradas em sequencia
if (strip) rows = [{ cells: rows.flatMap((r) => Array.from({ length: r.count }, (_, f) => r.start + f)) }];
rows = rows.map((r) => r.cells ?? Array.from({ length: r.count }, (_, f) => r.start + f));
const cols = Math.max(...rows.map((r) => r.length));
const out = new PNG({ width: cols * m.frameWidth * scale, height: rows.length * m.frameHeight * scale });
out.data.fill(0);
// fundo escuro para enxergar a silhueta
for (let i = 0; i < out.width * out.height; i++) {
  out.data[i * 4] = 20; out.data[i * 4 + 1] = 24; out.data[i * 4 + 2] = 32; out.data[i * 4 + 3] = 255;
}
rows.forEach((r, ri) => {
  for (let f = 0; f < r.length; f++) {
    const idx = r[f];
    const x0 = (idx % m.columns) * m.frameWidth;
    const y0 = Math.floor(idx / m.columns) * m.frameHeight;
    for (let y = 0; y < m.frameHeight; y++) {
      for (let x = 0; x < m.frameWidth; x++) {
        const si = ((y0 + y) * png.width + x0 + x) * 4;
        if (png.data[si + 3] === 0) continue;
        for (let sy = 0; sy < scale; sy++) {
          for (let sx = 0; sx < scale; sx++) {
            const tx = (f * m.frameWidth + x) * scale + sx;
            const ty = (ri * m.frameHeight + y) * scale + sy;
            const ti = (ty * out.width + tx) * 4;
            out.data[ti] = png.data[si];
            out.data[ti + 1] = png.data[si + 1];
            out.data[ti + 2] = png.data[si + 2];
            out.data[ti + 3] = 255;
          }
        }
      }
    }
  }
});
writeFileSync(outName, PNG.sync.write(out));
console.log(`${outName} ${out.width}x${out.height}`);
