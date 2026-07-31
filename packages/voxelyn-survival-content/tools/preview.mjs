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
//   node tools/preview.mjs <id> "dr:idle,dr:attack" saida.png [escala]
//
// Uma linha por par direcao:animacao; uma coluna por quadro.
import { PNG } from 'pngjs';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../assets/atlases');
const [, , id, spec, outName, scaleArg] = process.argv;
const m = JSON.parse(readFileSync(resolve(DIR, `${id}.json`), 'utf8'));
const png = PNG.sync.read(readFileSync(resolve(DIR, m.atlas)));
const scale = Number(scaleArg || 4);

// spec: "dr:idle,dr:attack,ul:idle" -> uma linha por entrada, colunas = frames
const rows = spec.split(',').map((s) => {
  const [dir, anim] = s.split(':');
  const start = m.frameMap[dir][anim];
  const count = m.animations[anim].frames;
  return { dir, anim, start, count };
});
const cols = Math.max(...rows.map((r) => r.count));
const out = new PNG({ width: cols * m.frameWidth * scale, height: rows.length * m.frameHeight * scale });
out.data.fill(0);
// fundo escuro para enxergar a silhueta
for (let i = 0; i < out.width * out.height; i++) {
  out.data[i * 4] = 20; out.data[i * 4 + 1] = 24; out.data[i * 4 + 2] = 32; out.data[i * 4 + 3] = 255;
}
rows.forEach((r, ri) => {
  for (let f = 0; f < r.count; f++) {
    const idx = r.start + f;
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
