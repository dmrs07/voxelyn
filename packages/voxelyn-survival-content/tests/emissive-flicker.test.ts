import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';
import { CHARACTER_SPRITE_IDS, type SpriteManifestEntry } from '../src/manifest';

const __dirname = dirname(fileURLToPath(import.meta.url));
const load = (id: string) => ({
  manifest: JSON.parse(
    readFileSync(resolve(__dirname, `../assets/atlases/${id}.json`), 'utf8'),
  ) as SpriteManifestEntry & { frameMap: Record<string, Record<string, number>> },
  png: PNG.sync.read(readFileSync(resolve(__dirname, `../assets/atlases/${id}.png`))),
});

/** Quantos pixels de uma cor exata existem num frame. */
const countColor = (
  png: PNG,
  manifest: { frameWidth: number; frameHeight: number; columns: number },
  column: number,
  [r, g, b]: readonly [number, number, number],
): number => {
  const { frameWidth: w, frameHeight: h, columns } = manifest;
  const ox = (column % columns) * w;
  const oy = Math.floor(column / columns) * h;
  let n = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = ((oy + y) * png.width + (ox + x)) * 4;
      if (png.data[i] === r && png.data[i + 1] === g && png.data[i + 2] === b) n++;
    }
  }
  return n;
};

/**
 * Cores EMISSIVAS: as que existem para brilhar num corpo escuro. Sao elas que
 * dominam a leitura de um sprite, e por isso sao as unicas em que uma oscilacao
 * por frame vira estroboscopio em vez de detalhe.
 */
const EMISSIVE = [
  ['biolum', [89, 242, 194]],
  ['acid', [168, 230, 60]],
  ['electric', [122, 184, 255]],
  ['fire', [255, 122, 47]],
] as const;

/**
 * Um ponto emissivo pode APAGAR — o que ele nao pode e apagar e acender de novo
 * varias vezes por ciclo.
 *
 * O Miner nasceu com a optica alternando `biolum`/`fungus` por paridade de frame,
 * porque a ficha de conceito pede "optics flicker". Medido no atlas, isso era 6
 * pixels de biolum contra ZERO em frames alternados — 3 Hz no `idle`, 5 Hz no
 * `walk`, no aglomerado mais claro de um corpo inteiramente escuro. O bicho lia
 * como se o sprite estivesse falhando.
 *
 * Um voxel de 1x1x1 na projecao isometrica nao e um pixel: sao ~6. Ligar e
 * desligar um aglomerado desses a cada quadro nao e detalhe, e o assunto
 * principal do quadro.
 *
 * A METRICA e transicoes, nao fracao apagada. Foi a primeira coisa que tentei
 * medir e estava errada: o `special` do Bruiser apaga 3 de 8 frames e passa longe
 * de estroboscopico, porque os 3 sao SEGUIDOS — uma queda unica, que le como o
 * golpe carregando. Contar o total apagado reprovava esse, que esta certo, e
 * aprovaria um 6,0,6,0,6,0 se fosse mais curto, que esta errado.
 *
 * Duas transicoes no ciclo (apaga uma vez, acende uma vez) e uma lampada velha
 * falhando. Quatro ou mais e pisca-pisca. Olhar o sprite nao pega a diferenca —
 * foi assim que o Miner passou; contar pixel pega.
 */
const MAX_TRANSITIONS = 2;

describe('pontos emissivos guttering, nunca estroboscopicos', () => {
  for (const id of CHARACTER_SPRITE_IDS) {
    it(id, () => {
      const { manifest, png } = load(id);
      const dir = manifest.authoredDirs[0];
      for (const [anim, def] of Object.entries(manifest.animations)) {
        if (def.frames < 3) continue; // ciclo curto demais para haver flicker
        // `die` desmonta o corpo de proposito: a luz apagar ali e o ponto.
        if (anim === 'die') continue;
        const base = manifest.frameMap[dir][anim];
        for (const [name, rgb] of EMISSIVE) {
          const perFrame = Array.from({ length: def.frames }, (_, f) =>
            countColor(png, manifest, base + f, rgb),
          );
          if (perFrame.every((n) => n === 0)) continue; // esta cor nao existe aqui
          // Ciclico: o ultimo frame emenda no primeiro, e um ciclo que apaga no
          // fim e acende no inicio pisca igual.
          let transitions = 0;
          for (let f = 0; f < perFrame.length; f++) {
            const a = perFrame[f] > 0;
            const b = perFrame[(f + 1) % perFrame.length] > 0;
            if (a !== b) transitions++;
          }
          expect(
            transitions,
            `${id}/${anim}: ${name} liga/desliga ${transitions}x por ciclo (${perFrame.join(',')})`,
          ).toBeLessThanOrEqual(MAX_TRANSITIONS);
        }
      }
    });
  }
});
