// Atlas de crostas de chao pre-renderizadas em voxel.
//
// Por que existe: o cenario inteiro ja e voxel — bloco, criatura, projetil,
// particula — mas o CHAO continuava sendo um losango de cor chapada por celula,
// e as tres materias que vivem nele (gas, poca, fogo) eram um `rgba()`
// translucido por cima. Era a ultima superficie plana do jogo, e a maior: ocupa
// mais pixels que todo o resto somado.
//
// O alpha era o problema de fundo. O contrato dos atlas e alpha binario (art
// bible §2), e uma nuvem translucida nao pertence a um mundo facetado — ela nao
// tem forma, so cor por cima de cor. A resposta voxel para "ver atraves" nao e
// transparencia: e OCUPACAO ESPARSA. O gas e feito de cubinhos separados por
// vazio, e o chao aparece pelos buracos. A materia continua opaca e continua
// tendo volume; o que rareia e a quantidade.
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
 * `frames` e a animacao ASSADA do tipo, e `frameMs` a duracao de cada quadro:
 * - o que nao se mexe (rocha nua, queimado) tem um quadro so e nao paga nada;
 * - o que esta vivo se mexe, e a velocidade diz O QUE ele e. Fogo lambe rapido,
 *   gas rola devagar. Uma velocidade unica para todos faria a poca ferver e o
 *   fogo arrastar.
 */
export const SURFACE_KINDS = [
  { name: 'bare', frames: 1, frameMs: 0 },
  { name: 'fungal', frames: 2, frameMs: 520 },
  { name: 'biofluid', frames: 4, frameMs: 260 },
  { name: 'gas', frames: 4, frameMs: 300 },
  { name: 'fire', frames: 4, frameMs: 110 },
  { name: 'scorched', frames: 1, frameMs: 0 },
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

/**
 * Laje de rocha sob toda crosta, com relevo de um voxel em parte das colunas.
 *
 * Ela existe em TODOS os tipos, inclusive sob o gas e sob a poca, porque o tile
 * e desenhado inteiro de uma vez. E o relevo e o que separa "chao voxel" de
 * "losango com textura": sem variacao de altura, oito por oito cubos do mesmo
 * tamanho voltam a ser uma superficie lisa, so que mais cara.
 */
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

/**
 * Percorre as colunas da grade entregando (cx, cy, x, y, topo da laje, hash).
 * Existe para os seis tipos nao repetirem o mesmo laco de bordas e de offset.
 */
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

/**
 * Modelo de um tipo num quadro de animacao.
 *
 * Duas leituras opostas de proposito, porque sao a mesma informacao que o
 * jogador precisa separar em menos de 200 ms (art bible §1):
 * - poca e LISA e continua — a altura nao varia, e o brilho corre por cima;
 * - fungo e IRREGULAR e opaco — cresce em tufos de altura desigual.
 * Se as duas tivessem o mesmo relevo, a unica diferenca seria matiz, e matiz e
 * exatamente o que se perde na penumbra em que o jogo se passa.
 */
const surfaceModel = (kind, variant, frame) => {
  if (kind === 'bare') return slab(variant, 'floor', 'rockDeep');
  if (kind === 'scorched') {
    const boxes = slab(variant, 'scorch', 'floor');
    // Cinza com brasa apagando: pouquissimas, e so onde a laje ja e alta, para
    // o queimado continuar sendo a coisa mais escura da tela.
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
      // Esporos acendem em quadros alternados. O deslocamento vem do hash da
      // coluna, entao o tapete PULSA em vez de piscar inteiro de uma vez.
      if ((h >>> 4) % 9 === (frame % 2) * 3) boxes.push(box(x, y, top + 1, 1, 1, 1, 'fungus'));
    });
    return boxes;
  }

  if (kind === 'biofluid') {
    const boxes = slab(variant, 'floor', 'rockDeep');
    overSlab(variant, 29, ({ cx, cy, x, y, h }) => {
      // Uma camada UNICA e num z UNICO, acima de qualquer saliencia da laje:
      // liquido assenta e nivela. Empilhar o brilho num voxel a mais, que foi a
      // primeira tentativa, devolvia relevo a poca e ela voltava a ler como
      // musgo — a diferenca entre poca e tapete de fungo e planura, nao matiz.
      // Por isso o brilho troca de MATERIAL no mesmo plano em vez de subir.
      const band = (cx + cy * 2 + frame) % 7;
      const lit = band === 0 || (band === 3 && h % 3 === 0);
      boxes.push(box(x, y, 2, 1, 1, 1, lit ? 'biolum' : 'fungusDeep'));
    });
    return boxes;
  }

  if (kind === 'gas') {
    const boxes = slab(variant, 'floor', 'rockDeep');
    overSlab(variant, 43, ({ cx, cy, x, y, h }) => {
      // Ocupacao esparsa: e ISTO que substitui o alpha. A nuvem e opaca cubinho
      // a cubinho, e o chao aparece pelos vaos entre eles.
      //
      // A densidade e a coisa mais delicada do arquivo. Perto da metade das
      // colunas, os cubos se encostam na projecao e a nuvem vira um TAPETE
      // verde: opaco, chapado, e sem nenhuma leitura de que ha ar ali. Em torno
      // de um quinto eles ficam separados o bastante para o chao aparecer entre
      // eles, que e o que faz o volume ler como gas.
      if ((cx * 3 + cy * 5 + frame * 2) % 11 > 1) return;
      // Espalhado em altura, e nao colado numa camada: o gas ocupa o AR sobre a
      // celula, e os motes que o cliente emite sobem a partir daqui.
      const z = 1 + ((h >>> 5) % 3) + (frame % 2);
      boxes.push(box(x, y, z, 1, 1, 1, 'acid'));
    });
    return boxes;
  }

  if (kind === 'fire') {
    // A chama queima o que esta embaixo: a laje ja e a cinza que vai sobrar
    // quando o fogo passar, e nao rocha limpa.
    const boxes = slab(variant, 'scorch', 'floor');
    overSlab(variant, 61, ({ cx, cy, x, y, h }) => {
      // Um terco das colunas, nao dois: com cobertura alta as linguas se fundem
      // num bloco de lava e o fogo perde a silhueta recortada que o identifica.
      const phase = (cx * 2 + cy * 3 + frame) % 7;
      if (phase > 1) return;
      // Lingua de altura variavel: a mesma coluna sobe e desce ao longo dos
      // quatro quadros, entao o fogo LAMBE em vez de piscar. Teto de 4 voxels
      // (8px) de proposito: a chama tem de ler como fogo NO CHAO, e passando da
      // metade da altura de parede ela vira uma coluna que esconde o que ha
      // atras — e o que ha atras, num jogo assim, e o que mata.
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
        // Os mesmos niveis assados do atlas de blocos, importados e nao
        // copiados: chao e parede tem de escurecer na MESMA escala, senao a
        // juncao entre os dois vira uma costura visivel a cada nivel de luz.
        for (let level = 0; level < LIGHT_LEVELS; level++) frames.push(dim(lit, lightFactor(level)));
      }
    }
  }
  return frames;
};

export const SURFACE_COLORS = COLORS;
