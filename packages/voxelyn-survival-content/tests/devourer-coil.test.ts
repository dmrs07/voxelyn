// O anel do corpo do Devorador nao e uma criatura: sao dez PECAS penduradas no
// rastro da cabeca, desenhadas uma atras da outra. Por isso ele erra em
// silencio — um anel deslocado ou num rumo errado nao quebra nada, so faz o
// corpo nao ser mais o mesmo bicho da cabeca.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
// @ts-expect-error - ferramenta JS sem tipos
import { fitShift } from '../tools/lib.mjs';
import {
  DEVOURER_COIL_FRAME,
  DEVOURER_COIL_RANKS,
  ENTITY_SPECS,
  // @ts-expect-error - ferramenta JS sem tipos
} from '../tools/entities.mjs';

type Grid = { w: number; h: number; buf: Uint8ClampedArray };
type Spec = {
  id: string;
  frameWidth: number;
  frameHeight: number;
  anchorX: number;
  anchorY: number;
  directions: number;
  authoredDirs: string[];
  draw: (dir: string, anim: string, f: number) => Grid;
};

const ATLASES = resolve(dirname(fileURLToPath(import.meta.url)), '../assets/atlases');

const specOf = (id: string): Spec => {
  const spec = (ENTITY_SPECS as Spec[]).find((s) => s.id === id);
  if (!spec) throw new Error(`spec ausente: ${id}`);
  return spec;
};

const manifestOf = (id: string) =>
  JSON.parse(readFileSync(resolve(ATLASES, `${id}.json`), 'utf8')) as Spec;

describe('o anel do corpo do Devorador', () => {
  const spec = specOf('part-white-devourer-coil');

  it('tem os MESMOS oito rumos da cabeca', () => {
    // O defeito que este teste fecha: a cabeca passou a oito rumos e o anel
    // ficou em quatro. Num salto diagonal a cabeca mostrava o rumo certo e os
    // dez aneis atras dela caiam no vizinho mais proximo dos quatro autorados —
    // o corpo torcia atras da cabeca. Em METADE dos saltos, porque os quatro
    // rumos que faltavam sao exatamente as diagonais do mundo.
    const cabeca = manifestOf('enemy-white-devourer');
    const anel = manifestOf('part-white-devourer-coil');
    expect(anel.directions).toBe(cabeca.directions);
    expect(anel.authoredDirs).toEqual(cabeca.authoredDirs);
  });

  it('publica a ancora que o ENQUADRAMENTO deixou, e nao a da rasterizacao', () => {
    // As duas ancoras nao sao o mesmo numero, e confundi-las custa um pixel no
    // corpo inteiro.
    //
    // `renderVoxels` poe a origem do modelo (o centro do tubo, ao nivel do
    // chao) na ancora que recebe — `DEVOURER_COIL_FRAME`. Depois disso
    // `fitSpriteToMargin` recentraliza a uniao de TODOS os quadros dentro do
    // frame, e a ancora publicada tem de acompanhar esse deslocamento.
    //
    // O deslocamento sai da uniao, entao ele muda quando se acrescenta rumo ou
    // se mexe na largura: era -1,-2 aqui e -2,-2 com quatro rumos em 64 px.
    // Carregar o numero antigo por engano poe a fila de dez aneis um pixel fora
    // da linha da cabeca, em todos os rumos — e nada mais reclama.
    const quadros: Grid[] = [];
    for (const dir of spec.authoredDirs) {
      for (let f = 0; f < DEVOURER_COIL_RANKS; f++) quadros.push(spec.draw(dir, 'idle', f));
    }
    const { dx, dy } = fitShift(quadros, 2) as { dx: number; dy: number };
    const anel = manifestOf('part-white-devourer-coil');
    expect(anel.anchorX, 'ancora x').toBe(DEVOURER_COIL_FRAME.ax + dx);
    expect(anel.anchorY, 'ancora y').toBe(DEVOURER_COIL_FRAME.ay + dy);
  });

  it('desce o mesmo tanto abaixo da ancora nos OITO rumos', () => {
    // A linha da areia e uma so. Se um rumo descesse mais que os outros, o
    // recorte do mergulho — que o cliente calcula por `frameHeight - anchorY`,
    // igual para todos — deixaria um coto de anel boiando naquele rumo.
    const anel = manifestOf('part-white-devourer-coil');
    const descidas = spec.authoredDirs.map((dir) => {
      const g = spec.draw(dir, 'idle', 0);
      let maxY = -1;
      for (let y = 0; y < g.h; y++) {
        for (let x = 0; x < g.w; x++) if (g.buf[(y * g.w + x) * 4 + 3] !== 0) maxY = y;
      }
      return maxY - DEVOURER_COIL_FRAME.ay;
    });
    expect(new Set(descidas).size, `descidas ${descidas.join(',')}`).toBe(1);
    expect(anel.frameHeight - anel.anchorY).toBe(11);
  });
});
