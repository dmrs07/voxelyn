// MORFOLOGIA DE BORDA: a silhueta do contorno da caverna, por estrato.
//
// A regua de qualidade dos biomas diz que trocar a paleta inteira por cinza
// nao pode apagar a identidade do estrato. As peles de rocha do atlas dao a
// TEXTURA; a gramatica espacial da a FORMA dos saloes; isto aqui da o
// CONTORNO — o detalhe que a parede faz exatamente onde encontra o vazio:
// pontas frias na Catedral, labio dissolvido no Aquifero, degraus laminados
// na Silica, crosta na Fenda, dentes de fuligem na Fornalha, orla de geada
// na Cripta. O basalto, como sempre, e a referencia: nenhum enfeite.
//
// Regras que esta camada obedece (as mesmas da decoracao):
// - SO a rocha comum recebe morfologia. Fragil, minerio e cristal sao
//   linguagem MECANICA e ficam visualmente universais — o jogador le "isso
//   quebra/da minerio/conduz" antes de ler "estou na Catedral".
// - So o CONTORNO: parede sem vizinho aberto visivel nao ganha nada. O
//   detalhe existe para desenhar a fronteira entre o cheio e o vazio.
// - Familias de cor da decoracao (frias e terrosas). Nada de biolum
//   reativo, ouro de loot ou vermelho de projetil: enfeite nao mente.
// - Deterministico por CELULA: o mesmo bloco mostra o mesmo detalhe em
//   qualquer maquina e em qualquer quadro — a variacao vem do indice da
//   celula, nunca de Math.random.
import { drawVoxel, type FaceRamp } from './voxel-draw';
import { DECOR_RAMPS } from './decor-draw';
import { PIPE_MOUTH, type StratumId } from '@voxelyn/survival-sim';

const { ROCK_DEEP, BONE, RUST, MIST, SULFUR_DULL, CHAR } = DECOR_RAMPS;

/** Um voxel de detalhe, em px pre-zoom, relativo a ancora do bloco (sx, sy). */
export type EdgeVoxel = { dx: number; dy: number; size: number; ramp: FaceRamp };

const EMPTY: readonly EdgeVoxel[] = [];

const h32 = (v: number): number => {
  let x = Math.imul(v ^ 0x9e3779b9, 0x85ebca6b);
  x ^= x >>> 13;
  return (Math.imul(x, 0xc2b2ae35) ^ (x >>> 16)) >>> 0;
};

/**
 * Cache por (estrato, variante, exposicao). A lista e recomputada por quadro
 * para CADA parede visivel; sem o cache seriam milhares de arrays por
 * segundo em celular. Dezesseis variantes por estrato bastam para a parede
 * nao parecer carimbada.
 */
const cache = new Map<string, readonly EdgeVoxel[]>();

const build = (
  stratum: StratumId,
  v: number,
  right: boolean,
  left: boolean,
): readonly EdgeVoxel[] => {
  // Jitter deterministico da variante: desloca e espelha, nunca inventa.
  const j = ((v >>> 4) & 3) - 1.5; // -1.5..1.5
  const flip = (v & 1) === 0 ? 1 : -1;
  const out: EdgeVoxel[] = [];

  switch (stratum) {
    case 'basalt':
      // A referencia e a ausencia: o basalto e a parede "normal" contra a
      // qual todos os outros contornos leem como sotaque.
      return EMPTY;
    case 'prismatic':
      // Pontas no rim do topo — a familia FRIA, nunca o biolum do cristal
      // reativo: a parede parece crescida, nao carregada.
      out.push({ dx: flip * (4 + j), dy: -16, size: 3, ramp: MIST });
      out.push({ dx: -flip * (6 - j), dy: -14.2, size: 2.2, ramp: MIST });
      break;
    case 'aquifer':
      // Labio dissolvido: a agua arredondou o rim; um pingo mineral pende
      // logo abaixo dele.
      out.push({ dx: flip * (2 + j), dy: -15, size: 2.8, ramp: BONE });
      out.push({ dx: -flip * 4, dy: -12.6, size: 2, ramp: BONE });
      break;
    case 'silica':
      // Degraus LAMINADOS na face exposta: a silhueta escalonada da
      // sedimentar — cada banda e uma prateleira que sobressai.
      if (right) {
        out.push({ dx: 8, dy: -4.6, size: 4, ramp: BONE });
        out.push({ dx: 6.4, dy: -9, size: 3, ramp: RUST });
      }
      if (left) {
        out.push({ dx: -8, dy: -4.6, size: 4, ramp: RUST });
        out.push({ dx: -6.4, dy: -9, size: 3, ramp: BONE });
      }
      break;
    case 'sulfur':
      // Crosta porosa acumulada no rim — terrosa e APAGADA, sem o verde
      // vivo do gas.
      out.push({ dx: flip * (3 + j), dy: -14.6, size: 2.8, ramp: SULFUR_DULL });
      out.push({ dx: -flip * (5 - j), dy: -13.2, size: 2.2, ramp: RUST });
      break;
    case 'furnace':
      // Dentes de fuligem: o rim queimado quebrou irregular.
      out.push({ dx: flip * (3 + j), dy: -16.4, size: 2.6, ramp: CHAR });
      out.push({ dx: -flip * 3, dy: -15, size: 2.2, ramp: ROCK_DEEP });
      break;
    case 'glacial':
      // Orla de geada no rim do topo: opaca, sem cintilar.
      out.push({ dx: -6 + j, dy: -13.8, size: 2.4, ramp: MIST });
      out.push({ dx: flip * 1.5, dy: -15.8, size: 2, ramp: MIST });
      out.push({ dx: 6 - j, dy: -13.2, size: 2.2, ramp: MIST });
      break;
    case 'ferric':
      // Rebarba de oxido: o veio da parede continua no rim, em farpas.
      out.push({ dx: flip * (3 + j), dy: -15.4, size: 2.6, ramp: RUST });
      out.push({ dx: -flip * (4 - j), dy: -13.6, size: 2, ramp: ROCK_DEEP });
      break;
  }
  return out;
};

/**
 * O detalhe de contorno de uma parede de rocha comum — ou lista vazia.
 *
 * `right`/`left` dizem quais faces do bloco estao EXPOSTAS a celula aberta
 * (+x e a face direita na projecao; +y, a esquerda). Sem exposicao nenhuma
 * nao ha contorno, e ha um portao de densidade (~60% das celulas) para a
 * parede respirar em vez de parecer papel de parede.
 */
export const edgeDetailVoxels = (
  stratum: StratumId,
  cellIndex: number,
  right: boolean,
  left: boolean,
): readonly EdgeVoxel[] => {
  if (!right && !left) return EMPTY;
  if (stratum === 'basalt') return EMPTY;
  const v = h32(cellIndex);
  if ((v >>> 2) % 5 >= 3) return EMPTY;
  const key = `${stratum}:${v & 15}:${right ? 1 : 0}${left ? 1 : 0}`;
  let list = cache.get(key);
  if (!list) {
    list = build(stratum, v, right, left);
    cache.set(key, list);
  }
  return list;
};

/**
 * Desenha o detalhe na parede. A luz e a da parede (`b`): no escuro nao ha
 * enfeite — a fronteira que o jogador nao ve nao precisa de sotaque.
 */
export const drawWallEdgeDetail = (
  ctx: CanvasRenderingContext2D,
  stratum: StratumId,
  cellIndex: number,
  right: boolean,
  left: boolean,
  sx: number,
  sy: number,
  z: number,
  b: number,
): void => {
  if (b <= 0.25) return;
  const list = edgeDetailVoxels(stratum, cellIndex, right, left);
  if (list.length === 0) return;
  const prev = ctx.globalAlpha;
  ctx.globalAlpha = prev * Math.min(1, 0.3 + b * 0.7);
  for (const vox of list) {
    drawVoxel(ctx, sx + vox.dx * z, sy + vox.dy * z, vox.size * z, vox.ramp);
  }
  ctx.globalAlpha = prev;
};

/**
 * A AGUA JORRANDO DO DUTO, e so enquanto o lencol sobe.
 *
 * Os canos ficam mudos a run inteira — sao parede com uma historia. O unico
 * momento em que fazem alguma coisa e o Diluvio do Leviata, e ai eles sao a
 * CAUSA visivel dele: a inundacao entra pelas paredes, e nao brota do meio da
 * sala. Sem este jato a mesma mecanica leria como um filtro azul que alguem
 * ligou na tela.
 *
 * O rumo do jato e o rumo da boca (`PIPE_MOUTH`), projetado na isometrica: um
 * duto virado para o norte despeja para cima e para a esquerda na tela, e um
 * jato que ignorasse a projecao apontaria para dentro da rocha.
 *
 * `front` negativo e "o Diluvio nunca aconteceu", e nesse caso nada e
 * desenhado — que e o estado de 99% das runs.
 */
export const drawPipeSpill = (
  ctx: CanvasRenderingContext2D,
  solid: number,
  front: number,
  nowMs: number,
  sx: number,
  sy: number,
  z: number,
): void => {
  if (front < 0) return;
  const mouth = PIPE_MOUTH[solid];
  if (!mouth) return;
  const [mx, my] = mouth;
  // Do tile para a tela: a isometrica do jogo mistura os dois eixos, entao um
  // passo de celula vira meia largura em x e meia altura em y.
  // A geometria do tile, repetida aqui em vez de importada de `render.ts`: este
  // modulo e importado POR ele, e puxar de volta fecharia um ciclo.
  const HALF_W = 16;
  const HALF_H = 8;
  const dirX = (mx - my) * HALF_W;
  const dirY = (mx + my) * HALF_H;
  const prev = ctx.globalAlpha;
  // Tres jorros defasados: a boca cospe em pulsos, e nao num fio continuo.
  for (let k = 0; k < 3; k++) {
    const phase = ((nowMs / 240 + k / 3) % 1);
    const reach = 0.25 + phase * 0.95;
    ctx.globalAlpha = prev * (0.55 - phase * 0.45);
    ctx.fillStyle = k === 0 ? '#9ec4e1' : '#5e7f9c';
    const px = sx + dirX * reach * z;
    const py = sy + dirY * reach * z - 6.3 * z;
    const size = (3.2 - phase * 1.4) * z;
    ctx.fillRect(px - size / 2, py - size / 2, size, size);
  }
  ctx.globalAlpha = prev;
};
