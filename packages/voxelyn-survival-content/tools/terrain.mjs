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

// A ordem espelha os valores de SOLID_* da simulacao, incluindo os estados
// intermediarios: o jogador precisa VER o material a caminho de ceder, senao
// corrosao e rachadura viram morte invisivel.
export const BLOCK_KINDS = [
  'rock',
  'fragile',
  'ore',
  'crystal',
  'fragileWeak',
  'oreSpent',
  'crystalDull',
  'oreChipped',
];

const hash2 = (x, y, seed) => {
  let h = (x * 374761393) ^ (y * 668265263) ^ (seed * 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h ^ (h >>> 16)) >>> 0;
};

const hash3d = (x, y, z, seed) => {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(z, 2147483647) ^ Math.imul(seed, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h ^ (h >>> 16)) >>> 0;
};

/**
 * Material de UM voxel do bloco.
 *
 * A primeira versao decidia material por COLUNA e so no voxel do topo, entao as
 * faces laterais saiam em cor unica: uma tampa texturizada sobre uma parede
 * lisa. Um bloco de verdade e o mesmo material por dentro e por fora, e o veio
 * que aparece no topo tem de continuar descendo pela lateral.
 *
 * Aqui a textura e VOLUMETRICA: o material depende de (x, y, z), entao qualquer
 * face que o bloco exponha — topo, lateral, ou a face nova aberta quando o
 * vizinho e destruido — mostra a mesma pedra malhada.
 */
const voxelMaterial = (cx, cy, cz, kind, variant, top) => {
  const h = hash3d(cx, cy, cz, variant + 1);
  // Malha de pedra: manchas mais escuras espalhadas pelo volume inteiro.
  const base = h % 5 === 0 ? 'rockDeep' : 'rock';
  const surface = cz === top;
  if (kind === 'fragile') {
    // Rocha rachada: ferrugem aflora em manchas, mais densa perto da superficie.
    if ((h >>> 3) % (surface ? 4 : 7) === 0) return 'rust';
  } else if (kind === 'fragileWeak') {
    // Corroido: a ferrugem toma conta e a materia apodrece. Le como "prestes a
    // cair" pela densidade, sem precisar de contorno nem de piscar.
    if ((h >>> 3) % (surface ? 2 : 3) === 0) return 'rust';
    if ((h >>> 6) % 4 === 0) return 'fungusDeep';
  } else if (kind === 'ore') {
    // O veio ATRAVESSA o bloco em vez de ficar pintado no topo.
    if ((h >>> 3) % (surface ? 4 : 6) === 0) return 'loot';
    if ((h >>> 6) % 6 === 0) return 'rust';
  } else if (kind === 'oreChipped') {
    // Metade do veio ja saiu: o metal rareia e sobra a marca de onde estava.
    if ((h >>> 3) % (surface ? 9 : 12) === 0) return 'loot';
    if ((h >>> 6) % 5 === 0) return 'rust';
  } else if (kind === 'oreSpent') {
    // Esgotado ou contaminado: so a cicatriz, nenhum metal.
    if ((h >>> 6) % 4 === 0) return 'rockDeep';
  } else if (kind === 'crystal') {
    if ((h >>> 3) % (surface ? 5 : 8) === 0) return 'biolum';
  } else if (kind === 'crystalDull') {
    // Opaco: mesma FORMA de cristal, nenhuma luz. A silhueta continua dizendo
    // "aqui havia cristal", que e a informacao que o jogador precisa.
    if ((h >>> 3) % (surface ? 5 : 8) === 0) return 'fungusDeep';
  }
  return base;
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
      //
      // A coluna vira uma sequencia de voxels com material proprio, e trechos
      // vizinhos do mesmo material sao fundidos numa caixa so — a textura fica
      // volumetrica sem multiplicar o numero de caixas a rasterizar.
      let runMat = null;
      let runStart = 0;
      for (let cz = 0; cz < height; cz++) {
        const mat = voxelMaterial(cx, cy, cz, kind, variant, height - 1);
        if (mat !== runMat) {
          if (runMat) boxes.push(box(x, y, runStart, 1, 1, cz - runStart, runMat));
          runMat = mat;
          runStart = cz;
        }
      }
      boxes.push(box(x, y, runStart, 1, 1, height - runStart, runMat));

      // Cristal cresce ACIMA da superficie: e o unico bloco com silhueta
      // propria, para o jogador reconhecer de longe o que vale minerar.
      if ((kind === 'crystal' || kind === 'crystalDull') && (h >>> 8) % 9 === 0) {
        boxes.push(box(x, y, height, 1, 1, 2, kind === 'crystal' ? 'biolum' : 'fungusDeep'));
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
