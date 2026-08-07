// Aproximacao de cor -> material do jogo. A parte que decodifica imagem precisa
// do browser e fica de fora; o que estes testes cobram e a DECISAO — qual
// material representa cada cor, e como o teto de materiais e respeitado.
import { describe, expect, it } from 'vitest';
import {
  MATERIAL_CANDIDATES,
  colorDistance,
  materialCost,
  materialSwatch,
  nearestMaterial,
  quantizeToMaterials,
  type Rgb,
} from '../texture';
import { COLORS } from '../palette';
import { RAMPS } from '../voxel';

describe('materialSwatch', () => {
  it('e a face de TOPO da rampa — a que domina na vista isometrica', () => {
    for (const mat of MATERIAL_CANDIDATES) {
      expect(materialSwatch(mat), mat).toEqual(COLORS[RAMPS[mat][0]]);
    }
  });

  it('material inexistente nao quebra a comparacao', () => {
    expect(materialSwatch('nao-existe')).toEqual([255, 255, 255]);
  });
});

describe('colorDistance', () => {
  it('e zero para a mesma cor e cresce com a diferenca', () => {
    expect(colorDistance([10, 20, 30], [10, 20, 30])).toBe(0);
    const perto = colorDistance([10, 20, 30], [12, 22, 32]);
    const longe = colorDistance([10, 20, 30], [200, 200, 200]);
    expect(perto).toBeLessThan(longe);
  });

  it('pesa mais o verde que o azul — sem isso azul-escuro colapsa em preto', () => {
    const dVerde = colorDistance([0, 0, 0], [0, 40, 0]);
    const dAzul = colorDistance([0, 0, 0], [0, 0, 40]);
    expect(dVerde).toBeGreaterThan(dAzul);
  });
});

describe('nearestMaterial', () => {
  it('a cor exata de um material devolve um material com a MESMA face de topo', () => {
    // "o mesmo material" seria forte demais: `loot` e `sulfur` sao os dois
    // dourados por cima e diferem so nas laterais, entao qualquer um dos dois e
    // resposta certa para um dourado puro. O que nao pode variar e o topo.
    for (const mat of MATERIAL_CANDIDATES) {
      const escolhido = nearestMaterial(materialSwatch(mat) as Rgb);
      expect(RAMPS[escolhido][0], `${mat} -> ${escolhido}`).toBe(RAMPS[mat][0]);
    }
  });

  it('o TOPO decide sozinho — lateral parecida nao rouba a escolha', () => {
    // Regressao: com topo e laterais SOMADOS, a cor exata de `bone` caia em
    // `silt`, que erra o topo e acerta as duas laterais. Comparar em ordem
    // (topo, depois laterais) e o que impede isso.
    const [topBone] = materialCost(materialSwatch('bone') as Rgb, 'bone');
    const [topSilt] = materialCost(materialSwatch('bone') as Rgb, 'silt');
    expect(topBone).toBe(0);
    expect(topSilt).toBeGreaterThan(0);
    expect(RAMPS[nearestMaterial(materialSwatch('bone') as Rgb)][0]).toBe('bone');
  });

  it('as laterais desempatam quando dois materiais tem o mesmo topo', () => {
    // `loot` e `sulfur` sao os dois dourados por cima: o topo empata em zero e
    // quem decide sao as laterais (acido/fungo do enxofre contra latao/rocha).
    const ouro = materialSwatch('loot') as Rgb;
    const [topLoot, ladoLoot] = materialCost(ouro, 'loot');
    const [topSulfur, ladoSulfur] = materialCost(ouro, 'sulfur');
    expect(topLoot).toBe(topSulfur);
    expect(ladoSulfur).toBeLessThan(ladoLoot);
    expect(nearestMaterial(ouro)).toBe('sulfur');
  });

  it('acha a familia certa para cores fora da paleta', () => {
    // vermelho vivo -> a rampa de sangue; azul-claro -> a eletrica
    expect(nearestMaterial([230, 40, 60])).toBe('blood');
    expect(nearestMaterial([120, 190, 255])).toBe('electric');
    // quase preto -> um dos materiais de rocha escura, nunca um emissivo
    expect(['scorch', 'floor', 'rockDeep', 'pool']).toContain(nearestMaterial([10, 12, 18]));
  });

  it('respeita a lista de permitidos', () => {
    const so = ['blood', 'acid'];
    expect(so).toContain(nearestMaterial([120, 190, 255], so));
    expect(so).toContain(nearestMaterial([10, 12, 18], so));
  });
});

describe('quantizeToMaterials', () => {
  const gelo = materialSwatch('ice') as Rgb;
  const sangue = materialSwatch('blood') as Rgb;
  const acido = materialSwatch('acid') as Rgb;
  const luz = materialSwatch('lamp') as Rgb;

  it('lista vazia devolve vazio, sem lancar', () => {
    expect(quantizeToMaterials([])).toEqual({ materials: [], used: [] });
  });

  it('devolve um material por cor, na mesma ordem', () => {
    const q = quantizeToMaterials([gelo, sangue, acido], 6);
    expect(q.materials.length).toBe(3);
    expect(q.materials[0]).toBe('ice');
    expect(q.materials[1]).toBe('blood');
    expect(q.materials[2]).toBe('acid');
  });

  it('nunca passa do teto de materiais pedido', () => {
    const cores = [gelo, sangue, acido, luz, materialSwatch('rust') as Rgb];
    for (const teto of [1, 2, 3, 4]) {
      const q = quantizeToMaterials(cores, teto);
      expect(new Set(q.materials).size, `teto ${teto}`).toBeLessThanOrEqual(teto);
      expect(q.used.length).toBeLessThanOrEqual(teto);
    }
  });

  it('o corte e por AREA: o material que cobre o bicho sobrevive ao respingo', () => {
    // 100 triangulos de gelo e um unico de acido
    const cores: Rgb[] = [...Array(100).fill(gelo), acido];
    const q = quantizeToMaterials(cores, 1);
    expect(q.used).toEqual(['ice']);
    expect(new Set(q.materials)).toEqual(new Set(['ice']));
  });

  it('quem nao coube e reabsorvido pelo mais proximo dos que ficaram', () => {
    // muito sangue, pouco `fire` (laranja) — com teto 1 o fogo vira sangue,
    // que e o vizinho quente, e nao um cinza qualquer
    const fogo = materialSwatch('fire') as Rgb;
    const q = quantizeToMaterials([...Array(50).fill(sangue), fogo, fogo], 1);
    expect(q.used).toEqual(['blood']);
    expect(q.materials.every((m) => m === 'blood')).toBe(true);
  });

  it('a paleta final sai ordenada do mais usado para o menos', () => {
    const cores: Rgb[] = [...Array(9).fill(gelo), ...Array(5).fill(sangue), acido];
    const q = quantizeToMaterials(cores, 3);
    expect(q.used).toEqual(['ice', 'blood', 'acid']);
  });

  it('e deterministico e todo material escolhido tem rampa no rasterizador', () => {
    const cores: Rgb[] = [gelo, sangue, acido, luz];
    expect(quantizeToMaterials(cores, 3)).toEqual(quantizeToMaterials(cores, 3));
    for (const m of quantizeToMaterials(cores, 3).materials) expect(RAMPS[m]).toBeDefined();
  });
});
