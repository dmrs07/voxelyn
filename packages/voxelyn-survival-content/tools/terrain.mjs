// Atlas de blocos de terreno pre-renderizados em voxel.
//
// Por que existe: o cliente desenhava cada bloco como TRES poligonos de cor
// chapada — topo, face esquerda, face direita. Ao lado de personagens
// facetados, o cenario virava papel de parede: nenhuma superficie, nenhuma
// variacao, e o mundo que o jogo diz ser feito de celulas parecia liso.
//
// Rasterizar o bloco em voxel a cada frame nao e opcao: uma tela cheia passa de
// 200 mil quads. Entao o bloco e pre-renderizado aqui, em variantes e em niveis
// de luz, e o cliente so faz um drawImage por bloco — MENOS trabalho por frame
// do que os tres fills de hoje.
//
// A geometria vem do mesmo @voxelyn/core que os personagens usam, entao bloco e
// criatura compartilham projecao, ordem do pintor e tamanho de voxel: um voxel
// de terreno tem exatamente o tamanho de um voxel de bicho.
import { box, renderVoxels, VOX } from './voxel.mjs';
import { COLORS, grid } from './lib.mjs';

// Um tile logico tem 32px de largura na tela; com 4px por voxel, sao 8 voxels
// na diagonal. A altura de parede de 14px equivale a 7 voxels de 2px.
export const BLOCK_COLS = 8;
export const BLOCK_HEIGHT = 7;

/** Niveis de luz assados no atlas, substituindo o sombreamento por face. */
export const LIGHT_LEVELS = 8;
// O piso nao pode ser tao baixo quanto o do sombreamento por face antigo: ali a
// cor era chapada e sobrevivia ao escurecimento, aqui as faces laterais ja
// nascem escuras pela rampa. Com piso em 0.28 as laterais sumiam no fundo e o
// bloco lia como uma placa flutuando, sem volume.
export const lightFactor = (level) => 0.46 + (level / (LIGHT_LEVELS - 1)) * 0.6;

/** Variantes por tipo: quebram a repeticao sem custar nada em runtime. */
export const VARIANTS = 3;

export const BLOCK_KINDS = ['rock', 'fragile', 'ore', 'crystal'];

const hash2 = (x, y, seed) => {
  let h = (x * 374761393) ^ (y * 668265263) ^ (seed * 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h ^ (h >>> 16)) >>> 0;
};

/**
 * Um bloco e uma coluna de voxels por celula da grade 8x8. O topo e irregular:
 * e essa irregularidade que faz a pedra ler como agregado e nao como uma tampa
 * lisa. As inclusoes (veios, cristais, ferrugem) so aparecem no voxel do topo,
 * onde a luz bate.
 */
const blockModel = (kind, variant) => {
  const boxes = [];
  const half = BLOCK_COLS / 2;
  for (let cx = 0; cx < BLOCK_COLS; cx++) {
    for (let cy = 0; cy < BLOCK_COLS; cy++) {
      const h = hash2(cx, cy, variant + 1);
      // -1, 0 ou +0: o topo desce um voxel em parte das colunas
      const drop = (h & 7) < 3 ? 1 : 0;
      const height = BLOCK_HEIGHT - drop;
      const x = cx - half;
      const y = cy - half;

      // Todos os tipos partilham o MESMO corpo de pedra: no mundo do jogo eles
      // sao a mesma rocha com inclusoes diferentes, e as inclusoes (ferrugem,
      // veio metalico, cristal) ja separam os quatro a distancia. Dar corpos
      // mais escuros aos tipos especiais so apagava as faces laterais.
      const base = 'rock';
      let cap = null;
      if (kind === 'fragile') {
        if ((h >>> 3) % 4 === 0) cap = 'rust'; // fragmentos soltos
      } else if (kind === 'ore') {
        if ((h >>> 3) % 4 === 0) cap = 'loot'; // veio metalico
        else if ((h >>> 5) % 5 === 0) cap = 'rust';
      } else if (kind === 'crystal') {
        if ((h >>> 3) % 5 === 0) cap = 'biolum';
      }

      if (cap) {
        boxes.push(box(x, y, 0, 1, 1, height - 1, base));
        boxes.push(box(x, y, height - 1, 1, 1, 1, cap));
      } else {
        boxes.push(box(x, y, 0, 1, 1, height, base));
      }

      // Cristal cresce ACIMA da superficie: e o unico bloco com silhueta
      // propria, para o jogador reconhecer de longe o que vale minerar.
      if (kind === 'crystal' && (h >>> 8) % 9 === 0) {
        boxes.push(box(x, y, height, 1, 1, 2, 'biolum'));
      }
    }
  }
  return boxes;
};

/** Multiplica o brilho de uma grade ja rasterizada. */
const dim = (g, f) => {
  const out = grid(g.w, g.h);
  for (let i = 0; i < g.w * g.h; i++) {
    const a = g.buf[i * 4 + 3];
    if (a === 0) continue;
    for (let k = 0; k < 3; k++) {
      out.buf[i * 4 + k] = Math.max(0, Math.min(255, Math.round(g.buf[i * 4 + k] * f)));
    }
    out.buf[i * 4 + 3] = 255;
  }
  return out;
};

/**
 * Renderiza todos os frames. Indice = ((kind * VARIANTS) + variant) * LIGHT_LEVELS + level.
 */
export const buildTerrainFrames = (frameW, frameH, anchorX, anchorY) => {
  const frames = [];
  for (const kind of BLOCK_KINDS) {
    for (let variant = 0; variant < VARIANTS; variant++) {
      const lit = renderVoxels(blockModel(kind, variant), 0, frameW, frameH, anchorX, anchorY);
      for (let level = 0; level < LIGHT_LEVELS; level++) frames.push(dim(lit, lightFactor(level)));
    }
  }
  return frames;
};

/** Extensao projetada de um bloco, para dimensionar o frame e a ancora. */
export const blockBounds = () => {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const kind of BLOCK_KINDS) {
    for (let variant = 0; variant < VARIANTS; variant++) {
      for (const b of blockModel(kind, variant)) {
        for (const [x, y, z] of [
          [b.x, b.y, b.z],
          [b.x, b.y, b.z + b.h - 1],
        ]) {
          const sx = (x - y) * (VOX.tileW / 2);
          const sy = (x + y) * (VOX.tileH / 2) - z * VOX.zStep;
          minX = Math.min(minX, sx);
          maxX = Math.max(maxX, sx + VOX.tileW - 1);
          minY = Math.min(minY, sy - 2);
          maxY = Math.max(maxY, sy + VOX.zStep - 1);
        }
      }
    }
  }
  return { minX, maxX, minY, maxY, w: maxX - minX + 1, h: maxY - minY + 1 };
};

export const TERRAIN_COLORS = COLORS;
