import { describe, expect, it } from 'vitest';
import { ambientOcclusionSteps, box, isLitCorner, renderVoxels } from '../tools/voxel.mjs';

/** Predicado de ocupacao a partir de uma lista de celulas solidas. */
const occupancy = (cells) => {
  const set = new Set(cells.map(([x, y, z]) => `${x},${y},${z}`));
  return (x, y, z) => set.has(`${x},${y},${z}`);
};

/** Uma parede continua ao longo de um eixo, para os casos de contato. */
const wall = (at) => {
  const cells = [];
  for (let a = -2; a <= 2; a++) for (let z = 0; z <= 3; z++) cells.push(at(a, z));
  return cells;
};

const raster = (model) => renderVoxels(model, 0, 64, 64, 32, 50);
const opaque = (g, i) => g.buf[i * 4 + 3] !== 0;
const samePixel = (a, b, i) =>
  a.buf[i * 4] === b.buf[i * 4] &&
  a.buf[i * 4 + 1] === b.buf[i * 4 + 1] &&
  a.buf[i * 4 + 2] === b.buf[i * 4 + 2] &&
  a.buf[i * 4 + 3] === b.buf[i * 4 + 3];

/**
 * Quantos pixels DO PROPRIO volume mudam quando um vizinho encosta nele.
 *
 * A comparacao ignora todo pixel que o vizinho consegue pintar sozinho — sem
 * isso o teste mediria o vizinho aparecendo na cena, que e obvio, em vez da
 * sombra que ele lanca no volume original, que e o ponto. O conjunto de pixels
 * do vizinho e o mesmo nas duas cenas: a ordem do pintor pode escondê-los, nunca
 * criar novos.
 */
const shadowedPixels = (volume, neighbour) => {
  const before = raster(volume);
  const after = raster([...volume, ...neighbour]);
  const painted = raster(neighbour);
  let changed = 0;
  for (let i = 0; i < before.w * before.h; i++) {
    if (opaque(painted, i)) continue;
    if (!samePixel(before, after, i)) changed++;
  }
  return changed;
};

/** Placa lisa e um pilar encostado nela, alto o bastante para lancar sombra. */
const PLATE = (mat) => [box(-3, -3, 0, 7, 7, 1, mat)];
const TOUCHING = [box(1, -1, 1, 2, 4, 3, 'rock')];

describe('oclusao de ambiente', () => {
  const nothing = () => false;

  it('nao escurece superficie aberta', () => {
    for (const face of ['top', 'left', 'right']) {
      expect(ambientOcclusionSteps(nothing, 0, 0, 0, face)).toBe(0);
    }
  });

  /**
   * O caso que a primeira tentativa errou. Uma parede subindo encostada ao lado
   * de um piso ocupa exatamente tres dos oito vizinhos da celula de ar sobre
   * ele. Com o corte em quatro, a sombra de contato ao pe de toda junta do jogo
   * simplesmente nunca acontecia — o passe rodava e nao mudava nada.
   */
  it('poe sombra de contato onde uma parede encosta no piso', () => {
    const isSolid = occupancy(wall((a, z) => [1, a, z + 1]));
    expect(ambientOcclusionSteps(isSolid, 0, 0, 0, 'top')).toBe(1);
  });

  it('aprofunda a sombra no fundo de uma fresta', () => {
    // Paredes dos DOIS lados: seis dos oito vizinhos ocupados.
    const isSolid = occupancy([
      ...wall((a, z) => [1, a, z + 1]),
      ...wall((a, z) => [-1, a, z + 1]),
    ]);
    expect(ambientOcclusionSteps(isSolid, 0, 0, 0, 'top')).toBe(2);
  });

  /**
   * O MAPEAMENTO DAS FACES, que e a suposicao mais facil de inverter em silencio
   * neste rasterizador — trocadas, as sombras cairiam no lado errado do corpo e
   * o modelo pareceria iluminado por baixo.
   *
   * A regra sai da projecao: um vizinho em +x cai em `sx + 2`, ou seja, sobre as
   * duas colunas da DIREITA do cubo; um vizinho em +y cai em `sx - 2`, sobre as
   * duas da ESQUERDA. Logo `right` responde a +x e `left` a +y — e nao ao
   * contrario.
   */
  it('liga `right` ao eixo +x e `left` ao eixo +y', () => {
    // Os quatro vizinhos de aresta da celula de ar a frente da face +x. Ficam
    // todos no plano dessa face e mal encostam no da face +y, entao a assimetria
    // do resultado so pode vir do mapeamento.
    const beyondX = occupancy([[1, 1, 0], [1, -1, 0], [1, 0, 1], [1, 0, -1]]);
    expect(ambientOcclusionSteps(beyondX, 0, 0, 0, 'right')).toBe(1);
    expect(ambientOcclusionSteps(beyondX, 0, 0, 0, 'left')).toBe(0);

    const beyondY = occupancy([[1, 1, 0], [-1, 1, 0], [0, 1, 1], [0, 1, -1]]);
    expect(ambientOcclusionSteps(beyondY, 0, 0, 0, 'left')).toBe(1);
    expect(ambientOcclusionSteps(beyondY, 0, 0, 0, 'right')).toBe(0);
  });

  it('conta as quinas, e nao so as arestas', () => {
    // Tres vizinhos de quina ja bastam. So com arestas, a quina interna de dois
    // volumes em L ficaria tao clara quanto a face aberta ao lado dela.
    const diagonals = occupancy([[1, 1, 1], [1, -1, 1], [-1, 1, 1]]);
    expect(ambientOcclusionSteps(diagonals, 0, 0, 0, 'top')).toBe(1);
  });

  /** A prova de que o passe chega ao PIXEL, e nao so a tabela de passos. */
  it('escurece o proprio volume quando um vizinho encosta nele', () => {
    expect(shadowedPixels(PLATE('sulfur'), TOUCHING)).toBeGreaterThan(0);
  });

  it('nao escurece nada quando o vizinho esta longe demais para tocar', () => {
    const far = [box(1, -1, 3, 2, 4, 3, 'rock')];
    expect(shadowedPixels(PLATE('sulfur'), far)).toBe(0);
  });

  /**
   * Visor, nucleo, brasa e corrente sao FONTE, e nao superficie. Escurece-los no
   * fundo de uma fresta apagaria justamente os pontos que o jogador usa para
   * localizar uma criatura no breu — e a fresta e onde eles costumam estar,
   * porque uma luz encaixada no corpo e o desenho normal deles.
   */
  it('nao escurece material emissivo', () => {
    // Mesma placa, mesmo pilar: so muda o material.
    expect(shadowedPixels(PLATE('sulfur'), TOUCHING)).toBeGreaterThan(0);
    expect(shadowedPixels(PLATE('biolum'), TOUCHING)).toBe(0);
  });
});

/**
 * O complemento da oclusao: a quina que a luz principal pega.
 *
 * Sem ele, uma superficie grande e plana continua sendo UM tom chapado do topo
 * ao fim, por mais bem sombreadas que estejam as juntas em volta — a sombra
 * costura volumes, mas nao devolve aresta viva a um volume sozinho.
 */
describe('realce de quina', () => {
  const solidAt = (cells) => {
    const set = new Set(cells.map(([x, y, z]) => `${x},${y},${z}`));
    return (x, y, z) => set.has(`${x},${y},${z}`);
  };

  it('acende so a quina virada para a luz', () => {
    // A key light vem do topo-esquerda. Na projecao, diminuir x ou y sobe na
    // tela: as duas direcoes viradas para a luz sao -x e -y.
    const alone = solidAt([[0, 0, 0]]);
    expect(isLitCorner(alone, 0, 0, 0)).toBe(true);
  });

  it('exige as DUAS ausencias, e nao uma', () => {
    // Com uma so, todo voxel da borda de toda superficie plana acenderia — o
    // resultado nao e bisel, e um contorno claro em volta de cada volume, que le
    // como adesivo recortado.
    expect(isLitCorner(solidAt([[0, 0, 0], [-1, 0, 0]]), 0, 0, 0)).toBe(false);
    expect(isLitCorner(solidAt([[0, 0, 0], [0, -1, 0]]), 0, 0, 0)).toBe(false);
  });

  it('nao acende face de topo coberta', () => {
    expect(isLitCorner(solidAt([[0, 0, 0], [0, 0, 1]]), 0, 0, 0)).toBe(false);
  });

  it('ignora vizinho do lado oposto a luz', () => {
    // +x e +y descem na tela: nao tem nada a ver com a quina iluminada.
    expect(isLitCorner(solidAt([[0, 0, 0], [1, 0, 0], [0, 1, 0]]), 0, 0, 0)).toBe(true);
  });

  it('leva o realce ate o raster', () => {
    // Um degrau de `rock` sobre uma placa: o topo do degrau tem quina exposta e
    // ganha `rockLight`, que nao aparece em lugar nenhum de uma placa lisa.
    const plate = [box(-3, -3, 0, 7, 7, 1, 'rockDeep')];
    const step = [box(-1, -1, 1, 3, 3, 1, 'rockDeep')];
    expect(shadowedPixels(plate, step)).toBeGreaterThan(0);
  });

  /**
   * Um degrau de `bone` NAO ganha realce: o proximo passo acima seria `player`,
   * um branco azulado, e uma quina de um voxel nesse contraste le como respingo.
   * Medido no Bispo, cujo manto inteiro e `bone` — as quinas viravam pontinhos
   * brancos espalhados pelos degraus, como neve.
   */
  it('nao acende as cores em que o degrau acima seria grande demais', () => {
    const isSolid = solidAt([[0, 0, 0]]);
    expect(isLitCorner(isSolid, 0, 0, 0)).toBe(true);

    const boneStep = [box(-1, -1, 1, 3, 3, 1, 'bone')];
    // A quina existe, mas `bone` e teto da escada de luz: o raster nao muda.
    expect(shadowedPixels([box(-3, -3, 0, 7, 7, 1, 'scorch')], boneStep)).toBe(0);
  });
});
