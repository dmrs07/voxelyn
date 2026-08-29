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
import { box, DIR_UNROTATED, MODEL_SCALE, modelBounds, renderVoxels } from './voxel.mjs';
import { COLORS, grid } from './lib.mjs';

// Um tile logico tem 8 unidades AUTORADAS na diagonal e 7 de parede — isso nao
// mudou. Com a grade subdividida (MODEL_SCALE), cada unidade vira 2 voxels
// finos: o bloco e construido coluna a coluna FINA, entao malha, veios e o
// serrilhado do topo ganham o dobro de frequencia, e o frame dobra em pixels.
export const BLOCK_COLS = 8;
export const BLOCK_HEIGHT = 7;
const FINE_COLS = BLOCK_COLS * MODEL_SCALE;
const FINE_HEIGHT = BLOCK_HEIGHT * MODEL_SCALE;

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
  // -----------------------------------------------------------------------
  // ROCHA POR ESTRATO. Entram no fim: os oito indices historicos nao mudam.
  //
  // So a rocha COMUM ganha pele por bioma. Fragil, minerio e cristal ficam
  // universais de proposito — sao linguagem MECANICA (o que cede, o que rende,
  // o que conduz), e o jogador precisa reconhece-los identicos em qualquer
  // estrato. A parede comum e o unico solido que e so lugar, entao e o unico
  // que pode dizer ONDE voce esta.
  // -----------------------------------------------------------------------
  'rockPrismatic',
  'rockAquifer',
  'rockSulfur',
  'rockFurnace',
  'rockSilica',
  'rockGlacial',
  'rockFerric',
  // -----------------------------------------------------------------------
  // LEYLINE. Linguagem MECANICA (conduz por segmento), entao e universal como
  // minerio e cristal — a mesma pele em todo estrato. A veia eletrica e uma
  // FAIXA continua atravessando o bloco na diagonal do corpo: blocos vizinhos
  // encadeiam a faixa e a linha le como linha, nao como salpico. Sem 'loot' e
  // sem agulhas de cristal: ela nao rende nada e nao pode fingir que rende.
  // A juncao e o mesmo condutor com o NUCLEO denso: o ponto onde a rede
  // articula, mais claro que qualquer trecho de linha.
  // -----------------------------------------------------------------------
  'leyline',
  'leylineNode',
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
  } else if (kind === 'rockPrismatic') {
    // Catedral: a rocha e atravessada por graos de cristal vivo. Mais densos
    // que o cristal-recurso NUNCA — o veio minerauvel continua inconfundivel.
    if ((h >>> 3) % (surface ? 9 : 12) === 0) return 'electric';
    if ((h >>> 6) % 10 === 0) return 'ice';
  } else if (kind === 'rockAquifer') {
    // Aquifero: pedra ENCHARCADA. Corpo mais escuro, escorrimentos de limo e
    // gotas de condensacao palida.
    if (h % 3 === 0) return 'rockDeep';
    if ((h >>> 3) % (surface ? 6 : 10) === 0) return 'fungusDeep';
    if ((h >>> 6) % 14 === 0) return 'ice';
  } else if (kind === 'rockSulfur') {
    // Fenda: rocha esbranquicada corroida de dentro para fora, com bolsoes de
    // crosta sulfurosa aflorando.
    if (h % 3 !== 0) return 'bone';
    if ((h >>> 3) % (surface ? 5 : 8) === 0) return 'loot';
    if ((h >>> 6) % 9 === 0) return 'acid';
  } else if (kind === 'rockFurnace') {
    // Fornalha: basalto quase negro rachado por veios de calor. As fissuras
    // sao FINAS e volumetricas — descem pela lateral como no minerio.
    if (h % 4 === 0) return 'scorch';
    if ((h >>> 3) % (surface ? 8 : 11) === 0) return 'fire';
    if ((h >>> 6) % 13 === 0) return 'blood';
  } else if (kind === 'rockSilica') {
    // Sumidouros: arenito palido em CAMADAS — o material muda por faixa de
    // altura, entao a lateral do bloco mostra a estratificacao.
    const band = Math.floor(cz / 3) % 3;
    if (band === 1 && (h & 3) !== 0) return 'bone';
    if (band === 2 && (h & 7) === 0) return 'rust';
    if ((h >>> 6) % 11 === 0) return 'bone';
  } else if (kind === 'rockGlacial') {
    // Cripta: rocha com CAPA de gelo — os voxels do topo congelam, e placas de
    // geada descem pelas faces.
    if (cz >= top - 2) return 'ice';
    if ((h >>> 3) % 9 === 0) return 'ice';
    if ((h >>> 6) % 12 === 0) return 'ice';
  } else if (kind === 'rockFerric') {
    // Ferrifero: pedra escura riscada de OXIDO em bandas horizontais — a
    // ferrugem segue a camada, como o minerio do estrato. Sem 'loot': o ouro
    // metalico e exclusivo do veio minerauvel, e a parede comum do lugar mais
    // rico do Veio nao pode fingir que rende.
    const band = Math.floor(cz / 2) % 3;
    if (h % 3 === 0) return 'rockDeep';
    if (band === 0 && (h >>> 3) % (surface ? 4 : 6) === 0) return 'rust';
    if ((h >>> 6) % 12 === 0) return 'scorch';
  } else if (kind === 'leyline' || kind === 'leylineNode') {
    // A VEIA: uma faixa eletrica continua na diagonal do corpo, a meia altura.
    // E funcao da POSICAO (cx+cy), nao do hash: blocos vizinhos emendam a
    // faixa um no outro e o tracado do worldgen vira uma linha legivel na
    // parede. O resto do corpo e mais escuro que rocha comum — o condutor
    // vive dentro de pedra morta, e o contraste e o que faz a veia saltar.
    const alongBand = ((cx + cy) >> 1) % 6 === 0;
    const midHeight = cz >= 2 && cz <= top - 2;
    if (kind === 'leylineNode') {
      // O nucleo da juncao: um miolo denso que toma o centro do bloco. Mais
      // eletrico que qualquer trecho de linha — e o ponto onde a rede
      // articula, e o olho precisa achar juncoes para ler os segmentos.
      const cxo = cx - FINE_COLS / 2;
      const cyo = cy - FINE_COLS / 2;
      if (cxo * cxo + cyo * cyo <= 16 && midHeight) return 'electric';
      if (alongBand && midHeight) return 'electric';
      if (h % 4 === 0) return 'rockDeep';
      return base;
    }
    if (alongBand && midHeight && (h & 3) !== 0) return 'electric';
    if ((h >>> 6) % 9 === 0) return 'ice';
    if (h % 3 === 0) return 'rockDeep';
  }
  return base;
};

/**
 * Um bloco e uma coluna de voxels por celula da grade FINA 16x16. O topo e
 * irregular em dois degraus de meio-passo: e essa irregularidade que faz a
 * pedra ler como agregado e nao como uma tampa lisa. A malha e as inclusoes
 * (veios, cristais, ferrugem) sao sorteadas por voxel FINO, entao a textura
 * volumetrica tem o dobro da frequencia da grade autorada.
 */
export const blockModel = (kind, variant) => {
  const boxes = [];
  const F = MODEL_SCALE;
  const half = BLOCK_COLS / 2;
  for (let cx = 0; cx < FINE_COLS; cx++) {
    for (let cy = 0; cy < FINE_COLS; cy++) {
      const h = hash2(cx, cy, variant + 1);
      // topo serrilhado: desce 0, 1 ou 2 voxels finos por coluna
      const drop = (h & 7) < 2 ? 2 : (h & 7) < 4 ? 1 : 0;
      const height = FINE_HEIGHT - drop;
      const x = cx / F - half;
      const y = cy / F - half;

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
          if (runMat) boxes.push(box(x, y, runStart / F, 1 / F, 1 / F, (cz - runStart) / F, runMat));
          runMat = mat;
          runStart = cz;
        }
      }
      boxes.push(box(x, y, runStart / F, 1 / F, 1 / F, (height - runStart) / F, runMat));

      // Cristal cresce ACIMA da superficie: e o unico bloco com silhueta
      // propria, para o jogador reconhecer de longe o que vale minerar. Na
      // grade fina as agulhas tem metade da largura e o dobro da contagem por
      // area — mesma presenca, grao mais fino.
      if ((kind === 'crystal' || kind === 'crystalDull') && (h >>> 8) % 9 === 0) {
        boxes.push(box(x, y, height / F, 1 / F, 1 / F, 2, kind === 'crystal' ? 'biolum' : 'fungusDeep'));
      }
    }
  }
  return boxes;
};

/** Multiplica o brilho de uma grade ja rasterizada. */
export const dim = (g, f) => {
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
      // Sem rotacao: `blockBounds()` mede o modelo cru, entao rasterizar
      // rotacionado deslocava o bloco 2px para a direita do que o manifest
      // declarava — a coluna da ponta era cortada pela borda do frame e o bloco
      // nao assentava sobre o proprio tile.
      const lit = renderVoxels(blockModel(kind, variant), DIR_UNROTATED, frameW, frameH, anchorX, anchorY);
      for (let level = 0; level < LIGHT_LEVELS; level++) frames.push(dim(lit, lightFactor(level)));
    }
  }
  return frames;
};

/**
 * Extensao projetada de um bloco, para dimensionar o frame e a ancora. Medida
 * por modelBounds — a MESMA grade fina que o rasterizador pinta — em vez de
 * projetar a coordenada autorada a mao, que mentiria por um fator de
 * MODEL_SCALE.
 */
export const blockBounds = () => {
  let acc;
  for (const kind of BLOCK_KINDS) {
    for (let variant = 0; variant < VARIANTS; variant++) {
      acc = modelBounds(blockModel(kind, variant), acc);
    }
  }
  return acc;
};

export const TERRAIN_COLORS = COLORS;
