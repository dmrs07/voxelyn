// Atlas de crostas de chao pre-renderizadas em voxel.
//
// Por que existe: o cenario inteiro ja e voxel — bloco, criatura, projetil,
// particula — mas o CHAO continuava sendo um losango de cor chapada por celula,
// e as materias que vivem nele eram um `rgba()` translucido por cima. Era a
// ultima superficie plana do jogo, e a maior: ocupa mais pixels que todo o resto
// somado.
//
// O alpha era o problema de fundo. O contrato dos atlas e alpha binario (art
// bible §2), e uma nuvem translucida nao pertence a um mundo facetado — ela nao
// tem forma, so cor por cima de cor. A resposta voxel para "ver atraves" nao e
// transparencia: e OCUPACAO ESPARSA. Gas e esporos sao cubinhos separados por
// vazio; o chao aparece pelos buracos e as duas materias continuam tendo volume.
//
// Cada tipo e um tile de chao COMPLETO, com o substrato de rocha embutido: o
// cliente faz UM drawImage por celula, no lugar de um fill de losango mais os
// remendos por cima. Nao ha custo novo por frame — ha menos.
import { box, DIR_UNROTATED, renderVoxels, VOX } from './voxel.mjs';
import { dim, LIGHT_LEVELS, lightFactor, VARIANTS } from './terrain.mjs';
import { COLORS } from './lib.mjs';

/**
 * A crosta usa a MESMA grade 8x8 de colunas do bloco: um voxel de chao tem
 * exatamente o tamanho de um voxel de parede, senao o piso e o bloco em cima
 * dele parecem feitos em escalas diferentes.
 */
export const SURFACE_COLS = 8;

/**
 * Tipos na ordem em que o cliente os indexa (espelha SURF_* da simulacao, com o
 * chao nu na frente porque SURF_NONE e 0).
 *
 * Os IDs 0..5 sao historicos e nao mudam. `spores` e `fungal-heated` entram no
 * fim para que diffs de chunks antigos nao passem a significar outra materia.
 */
export const SURFACE_KINDS = [
  { name: 'bare', frames: 1, frameMs: 0 },
  { name: 'fungal', frames: 2, frameMs: 520 },
  { name: 'biofluid', frames: 4, frameMs: 260 },
  { name: 'gas', frames: 4, frameMs: 300 },
  { name: 'fire', frames: 4, frameMs: 110 },
  { name: 'scorched', frames: 1, frameMs: 0 },
  { name: 'spores', frames: 4, frameMs: 360 },
  { name: 'fungal-heated', frames: 2, frameMs: 240 },
];

const hash3d = (x, y, z, seed) => {
  let h =
    Math.imul(x + 8, 374761393) ^
    Math.imul(y + 8, 668265263) ^
    Math.imul(z + 8, 2147483647) ^
    Math.imul(seed + 1, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h ^ (h >>> 16)) >>> 0;
};

/** Laje de rocha sob toda crosta, com relevo de um voxel em parte das colunas. */
const slab = (variant, mat, bumpMat) => {
  const boxes = [];
  const half = SURFACE_COLS / 2;
  for (let cx = 0; cx < SURFACE_COLS; cx++) {
    for (let cy = 0; cy < SURFACE_COLS; cy++) {
      const h = hash3d(cx, cy, 0, variant);
      const x = cx - half;
      const y = cy - half;
      // Cerca de um quinto das colunas sobe um voxel: cascalho, nao azulejo.
      const bump = (h & 7) < 2;
      boxes.push(box(x, y, 0, 1, 1, 1, (h >>> 3) % 7 === 0 ? bumpMat : mat));
      if (bump) boxes.push(box(x, y, 1, 1, 1, 1, bumpMat));
    }
  }
  return boxes;
};

/** Altura da laje numa coluna, para a materia de cima assentar sobre ela. */
const slabTop = (cx, cy, variant) => ((hash3d(cx, cy, 0, variant) & 7) < 2 ? 2 : 1);

/** Percorre as colunas da grade entregando posicao, topo da laje e hash. */
const overSlab = (variant, seed, fn) => {
  const half = SURFACE_COLS / 2;
  for (let cx = 0; cx < SURFACE_COLS; cx++) {
    for (let cy = 0; cy < SURFACE_COLS; cy++) {
      fn({
        cx,
        cy,
        x: cx - half,
        y: cy - half,
        top: slabTop(cx, cy, variant),
        h: hash3d(cx, cy, seed, variant),
      });
    }
  }
};

/** Modelo de um tipo num quadro de animacao. */
export const surfaceModel = (kind, variant, frame) => {
  if (kind === 'bare') return slab(variant, 'floor', 'rockDeep');

  if (kind === 'scorched') {
    const boxes = slab(variant, 'scorch', 'floor');
    // Cinza com brasa apagando: pouquissimas e so onde a laje ja e alta.
    overSlab(variant, 91, ({ x, y, top, h }) => {
      if (top === 2 && h % 11 === 0) boxes.push(box(x, y, top, 1, 1, 1, 'rust'));
    });
    return boxes;
  }

  if (kind === 'fungal') {
    const boxes = slab(variant, 'floor', 'rockDeep');
    overSlab(variant, 17, ({ x, y, top, h }) => {
      if (h % 8 === 0) return; // falhas no tapete: o chao aparece por baixo
      boxes.push(box(x, y, top, 1, 1, 1, 'fungusDeep'));
      // Pontos vivos pulsam devagar; a massa continua baixa, um tapete umido.
      if ((h >>> 4) % 9 === (frame % 2) * 3) boxes.push(box(x, y, top + 1, 1, 1, 1, 'fungus'));
    });
    return boxes;
  }

  if (kind === 'fungal-heated') {
    const boxes = slab(variant, 'floor', 'rockDeep');
    overSlab(variant, 109, ({ x, y, top, h }) => {
      if (h % 8 === 0) return;
      // Mesma silhueta do fungo, mas sem o verde vivo uniforme: a colonia esta
      // secando. Rust/scorch aparecem em ilhas, nunca como chama antecipada.
      const dry = ((h >>> 3) + frame) % 5 === 0;
      boxes.push(box(x, y, top, 1, 1, 1, dry ? 'rust' : 'fungusDeep'));
      if ((h >>> 6) % 13 === frame * 4) {
        boxes.push(box(x, y, top + 1, 1, 1, 1, dry ? 'rust' : 'fungus'));
      }
    });
    return boxes;
  }

  if (kind === 'biofluid') {
    // Liquido acha nivel. O leito e plano e poucas pedras claras emergem dele.
    const boxes = [];
    const half = SURFACE_COLS / 2;
    for (let cx = 0; cx < SURFACE_COLS; cx++) {
      for (let cy = 0; cy < SURFACE_COLS; cy++) {
        const x = cx - half;
        const y = cy - half;
        const h = hash3d(cx, cy, 29, variant);
        boxes.push(box(x, y, 0, 1, 1, 1, 'floor'));
        if ((h & 31) === 0) {
          boxes.push(box(x, y, 1, 1, 1, 2, 'rock'));
          continue;
        }
        // Reflexo em faixa horizontal na projecao, nao pontos aleatorios.
        const band = (cx + cy + frame * 2) % 8;
        boxes.push(box(x, y, 1, 1, 1, 1, band === 0 ? 'biolum' : 'pool'));
      }
    }
    return boxes;
  }

  if (kind === 'gas') {
    const boxes = slab(variant, 'floor', 'rockDeep');
    overSlab(variant, 43, ({ cx, cy, x, y, h }) => {
      // Gas sulfurico: poucos cubos amarelos, altos e separados por vazio.
      if ((cx * 3 + cy * 5 + frame * 2) % 13 !== 0) return;
      const z = 4 + ((h >>> 5) % 2) + (frame % 2);
      boxes.push(box(x, y, z, 1, 1, 1, 'sulfur'));
    });
    return boxes;
  }

  if (kind === 'spores') {
    const boxes = slab(variant, 'floor', 'rockDeep');
    overSlab(variant, 73, ({ cx, cy, x, y, h }) => {
      // Esporos sao graos organicos em suspensao, nao tapete e nao enxofre. A
      // nuvem fica mais baixa e lateral que o gas, com pequenos pares que o olho
      // agrupa como uma massa verde liberada pelo bomber.
      const phase = (cx * 5 + cy * 3 + frame * 2 + (h >>> 8)) % 17;
      if (phase > 1) return;
      const z = 3 + ((h >>> 5) % 3);
      boxes.push(box(x, y, z, 1, 1, 1, phase === 0 ? 'fungus' : 'fungusDeep'));
      if (phase === 0 && z < 6 && ((h >>> 3) & 1) === 0) {
        boxes.push(box(x, y, z + 1, 1, 1, 1, 'fungus'));
      }
    });
    return boxes;
  }

  if (kind === 'fire') {
    // A chama queima o que esta embaixo: a laje ja e a cinza que vai sobrar.
    const boxes = slab(variant, 'scorch', 'floor');
    overSlab(variant, 61, ({ cx, cy, x, y, h }) => {
      const phase = (cx * 2 + cy * 3 + frame) % 7;
      if (phase > 1) return;
      const core = h % 4 === 0;
      if (core) boxes.push(box(x, y, 1, 1, 1, 1, 'blood'));
      boxes.push(box(x, y, core ? 2 : 1, 1, 1, 1 + ((h >>> 6) % 3), 'fire'));
    });
    return boxes;
  }

  throw new Error(`tipo de superficie desconhecido: ${kind}`);
};

/** Extensao projetada de qualquer crosta, para dimensionar frame e ancora. */
export const surfaceBounds = () => {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const kind of SURFACE_KINDS) {
    for (let variant = 0; variant < VARIANTS; variant++) {
      for (let frame = 0; frame < kind.frames; frame++) {
        for (const b of surfaceModel(kind.name, variant, frame)) {
          for (const z of [b.z, b.z + b.h - 1]) {
            const sx = (b.x - b.y) * (VOX.tileW / 2);
            const sy = (b.x + b.y) * (VOX.tileH / 2) - z * VOX.zStep;
            minX = Math.min(minX, sx);
            maxX = Math.max(maxX, sx + VOX.tileW - 1);
            minY = Math.min(minY, sy - 2);
            maxY = Math.max(maxY, sy + VOX.zStep - 1);
          }
        }
      }
    }
  }
  return { minX, maxX, minY, maxY, w: maxX - minX + 1, h: maxY - minY + 1 };
};

/**
 * Renderiza todos os frames, na ordem em que `resolveSurface` os indexa:
 * tipos em sequencia, e dentro de cada tipo variante -> quadro -> nivel de luz.
 */
export const buildSurfaceFrames = (frameW, frameH, anchorX, anchorY) => {
  const frames = [];
  for (const kind of SURFACE_KINDS) {
    for (let variant = 0; variant < VARIANTS; variant++) {
      for (let frame = 0; frame < kind.frames; frame++) {
        const lit = renderVoxels(
          surfaceModel(kind.name, variant, frame),
          DIR_UNROTATED,
          frameW,
          frameH,
          anchorX,
          anchorY
        );
        // Chao e parede escurecem na mesma escala para nao abrir costura visual.
        for (let level = 0; level < LIGHT_LEVELS; level++) frames.push(dim(lit, lightFactor(level)));
      }
    }
  }
  return frames;
};

export const SURFACE_COLORS = COLORS;
