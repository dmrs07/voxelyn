// OS MARCOS GERACIONAIS, conferidos nos voxels e nos pixels.
//
// O que este arquivo trava: (1) o cliente e o gerador concordam sobre quais
// camadas existem; (2) nenhuma peca de geracao atravessa o corpo, o braco, a
// arma ou outra peca, em NENHUMA pose que as camadas assam — uma peca dentro
// do chassi e um pixel que aparece e some conforme a ordem do pintor; (3) o
// rasterizador com oclusor entrega, composto sobre o corpo, o mesmo desenho
// que o modelo inteiro daria numa rasterizacao so — que e a promessa que faz
// uma camada separada valer o que um atlas por geracao valeria.

import { describe, expect, it } from 'vitest';
import { renderVoxels, renderVoxelsOver } from '../tools/voxel.mjs';
import {
  FRAME_HEIGHT,
  FRAME_WIDTH,
  RENDER_ANCHOR_X,
  RENDER_ANCHOR_Y,
  WALK_SWING,
  prospectorParts,
} from '../tools/prospector.mjs';
import {
  GENERATION_ALLEGORIES,
  GENERATION_IDS,
  generationLayerId,
} from '../tools/prospector-generations.mjs';
import { GENERATION_LAYER_SPRITE_IDS, generationLayerSpriteIds } from '../src/manifest';

/** Toda pose que qualquer camada do Prospector assa, mais a inclinacao do dano. */
const POSES = [
  ...[0, 1].map((bob) => ({ bob })),
  ...WALK_SWING.map((swing) => ({ swing })),
  ...[0, 1, 2].map((kick) => ({ kick, flash: kick === 2 })),
  { lean: 1 },
];

/** Duas caixas autoradas se INTERPENETRAM (encostar nao conta). */
const overlaps = (a, b) =>
  a.x < b.x + b.w &&
  b.x < a.x + a.w &&
  a.y < b.y + b.d &&
  b.y < a.y + a.d &&
  a.z < b.z + b.h &&
  b.z < a.z + a.h;

const alpha = (g, x, y) => g.buf[(y * g.w + x) * 4 + 3];
const rgb = (g, x, y) => {
  const i = (y * g.w + x) * 4;
  return `${g.buf[i]},${g.buf[i + 1]},${g.buf[i + 2]}`;
};

describe('as camadas de geracao', () => {
  it('o cliente e o gerador nomeiam as mesmas camadas, na mesma ordem', () => {
    expect([...GENERATION_LAYER_SPRITE_IDS]).toEqual(GENERATION_IDS.map(generationLayerId));
    expect(generationLayerSpriteIds('G-00')).toEqual([]);
    expect(generationLayerSpriteIds('G-01')).toEqual(['layer-generation-g01']);
    expect(generationLayerSpriteIds('G-04')).toEqual([...GENERATION_LAYER_SPRITE_IDS]);
    expect(generationLayerSpriteIds('G-07')).toEqual([]);
    expect(generationLayerSpriteIds('')).toEqual([]);
  });

  it('nenhuma peca atravessa o corpo, a arma ou outra peca, em pose nenhuma', () => {
    for (const pose of POSES) {
      const parts = prospectorParts(pose);
      const body = [...parts.lower, ...parts.upper, ...parts.gun];
      const placed = [];
      for (const g of GENERATION_IDS) {
        for (const piece of GENERATION_ALLEGORIES[g](pose)) {
          for (const b of body) {
            expect(
              overlaps(piece, b),
              `${g} ${JSON.stringify(piece)} dentro do corpo em ${JSON.stringify(pose)}`,
            ).toBe(false);
          }
          for (const other of placed) {
            expect(
              overlaps(piece, other),
              `${g} ${JSON.stringify(piece)} dentro de outra peca`,
            ).toBe(false);
          }
          placed.push(piece);
        }
      }
    }
  });

  it('toda geracao aparece em toda direcao', () => {
    for (const g of GENERATION_IDS) {
      for (let dir = 0; dir < 4; dir++) {
        const layer = renderVoxelsOver(
          GENERATION_ALLEGORIES[g]({}),
          prospectorParts({}).upper,
          dir,
          FRAME_WIDTH,
          FRAME_HEIGHT,
          RENDER_ANCHOR_X,
          RENDER_ANCHOR_Y,
        );
        let visible = 0;
        for (let i = 3; i < layer.buf.length; i += 4) if (layer.buf[i]) visible++;
        expect(visible, `${g} na direcao ${dir}`).toBeGreaterThan(8);
      }
    }
  });

  /**
   * A promessa do rasterizador com oclusor, medida pixel a pixel.
   *
   * Para cada pixel que a peca SOZINHA pintaria: ou a camada o pinta, e entao
   * o modelo inteiro rasterizado de uma vez tem exatamente essa cor ali; ou a
   * camada o apagou, e entao o corpo sozinho e opaco nesse pixel — o corpo
   * esta na frente. Nada e apagado sem corpo na frente, e nada e pintado que o
   * modelo inteiro nao pintaria igual.
   */
  it('composta sobre o tronco, a camada e o modelo inteiro rasterizado de uma vez', () => {
    for (const pose of [{}, { bob: 1 }, { lean: 1 }]) {
      const upper = prospectorParts(pose).upper;
      for (const g of GENERATION_IDS) {
        const pieces = GENERATION_ALLEGORIES[g](pose);
        for (let dir = 0; dir < 4; dir++) {
          const args = [dir, FRAME_WIDTH, FRAME_HEIGHT, RENDER_ANCHOR_X, RENDER_ANCHOR_Y];
          const alone = renderVoxels(pieces, ...args);
          const layer = renderVoxelsOver(pieces, upper, ...args);
          const whole = renderVoxels([...upper, ...pieces], ...args);
          const bodyOnly = renderVoxels(upper, ...args);
          // Contadores, e nao um `expect` por pixel: sao meio milhao de
          // pixels por rodada, e uma asserção cada estoura o tempo do teste.
          let painted = 0;
          let erased = 0;
          const wrong = [];
          for (let y = 0; y < alone.h; y++) {
            for (let x = 0; x < alone.w; x++) {
              if (!alpha(alone, x, y)) {
                if (alpha(layer, x, y)) wrong.push(`fora da peca em ${x},${y}`);
                continue;
              }
              if (alpha(layer, x, y)) {
                painted++;
                if (rgb(whole, x, y) !== rgb(layer, x, y)) wrong.push(`cor diferente em ${x},${y}`);
              } else {
                erased++;
                if (alpha(bodyOnly, x, y) !== 255)
                  wrong.push(`apagou sem corpo na frente em ${x},${y}`);
              }
            }
          }
          expect(wrong, `${g}/${dir}`).toEqual([]);
          expect(painted + erased).toBeGreaterThan(0);
        }
      }
    }
  });

  it('em alguma direcao o corpo esconde parte de cada peca das costas', () => {
    // O berco duplo e o reator ficam nas COSTAS: de frente (dr/dl) o chassi
    // tem de comer parte deles. Se nenhum pixel fosse apagado, o oclusor nao
    // estaria fazendo nada.
    for (const g of ['G-03', 'G-04']) {
      const pieces = GENERATION_ALLEGORIES[g]({});
      const upper = prospectorParts({}).upper;
      let erased = 0;
      for (const dir of [0, 1]) {
        const args = [dir, FRAME_WIDTH, FRAME_HEIGHT, RENDER_ANCHOR_X, RENDER_ANCHOR_Y];
        const alone = renderVoxels(pieces, ...args);
        const layer = renderVoxelsOver(pieces, upper, ...args);
        for (let i = 3; i < alone.buf.length; i += 4) if (alone.buf[i] && !layer.buf[i]) erased++;
      }
      expect(erased, g).toBeGreaterThan(0);
    }
  });
});
