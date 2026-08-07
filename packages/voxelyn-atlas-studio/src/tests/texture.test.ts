// Aproximacao de cor -> material do jogo. A parte que decodifica imagem precisa
// do browser e fica de fora; o que estes testes cobram e a DECISAO — qual
// material representa cada cor, e como o teto de materiais e respeitado.
import { describe, expect, it } from 'vitest';
import {
  MATERIAL_CANDIDATES,
  READABLE_MATERIALS,
  colorDistance,
  luminance,
  materialCost,
  materialSwatch,
  nearestMaterial,
  normalizeExposure,
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
    for (const mat of READABLE_MATERIALS) {
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
    expect(['floor', 'rockDeep', 'pool']).toContain(nearestMaterial([10, 12, 18]));
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
    const q = quantizeToMaterials(cores, 1, { exposure: false });
    expect(q.used).toEqual(['ice']);
    expect(new Set(q.materials)).toEqual(new Set(['ice']));
  });

  it('quem nao coube e reabsorvido pelo mais proximo dos que ficaram', () => {
    // muito sangue, pouco `fire` (laranja) — com teto 1 o fogo vira sangue,
    // que e o vizinho quente, e nao um cinza qualquer
    const fogo = materialSwatch('fire') as Rgb;
    const q = quantizeToMaterials([...Array(50).fill(sangue), fogo, fogo], 1, {
      exposure: false,
    });
    expect(q.used).toEqual(['blood']);
    expect(q.materials.every((m) => m === 'blood')).toBe(true);
  });

  it('a paleta final sai ordenada do mais usado para o menos', () => {
    const cores: Rgb[] = [...Array(9).fill(gelo), ...Array(5).fill(sangue), acido];
    const q = quantizeToMaterials(cores, 3, { exposure: false });
    expect(q.used).toEqual(['ice', 'blood', 'acid']);
  });

  it('e deterministico e todo material escolhido tem rampa no rasterizador', () => {
    const cores: Rgb[] = [gelo, sangue, acido, luz];
    expect(quantizeToMaterials(cores, 3)).toEqual(quantizeToMaterials(cores, 3));
    for (const m of quantizeToMaterials(cores, 3).materials) expect(RAMPS[m]).toBeDefined();
  });
});

describe('READABLE_MATERIALS', () => {
  it('exclui a rampa chapada: sem contraste entre faces, o volume some', () => {
    expect(MATERIAL_CANDIDATES).toContain('scorch');
    expect(READABLE_MATERIALS).not.toContain('scorch');
    expect(new Set(RAMPS.scorch).size).toBe(1); // dark/dark/dark
  });

  it('todo material que sobrou tem pelo menos duas faces distintas', () => {
    for (const m of READABLE_MATERIALS) expect(new Set(RAMPS[m]).size, m).toBeGreaterThan(1);
  });

  it('nenhuma aproximacao devolve um material chapado', () => {
    for (const c of [
      [0, 0, 0],
      [8, 10, 14],
      [20, 24, 30],
      [12, 12, 12],
    ] as Rgb[]) {
      expect(nearestMaterial(c)).not.toBe('scorch');
    }
  });
});

describe('normalizeExposure', () => {
  /** Amostra escura como a que sai de um gerador 3D com luz na cena. */
  const escura: Rgb[] = [
    [10, 12, 16],
    [18, 22, 30],
    [26, 32, 44],
    [34, 42, 58],
    [42, 52, 72],
  ];

  it('lista vazia nao quebra', () => {
    expect(normalizeExposure([])).toEqual([]);
  });

  it('clareia uma amostra escura', () => {
    const antes = Math.max(...escura.map(luminance));
    const depois = Math.max(...normalizeExposure(escura).map(luminance));
    expect(depois).toBeGreaterThan(antes * 2);
  });

  it('preserva a ORDEM de brilho', () => {
    const depois = normalizeExposure(escura).map(luminance);
    for (let i = 1; i < depois.length; i++) expect(depois[i]).toBeGreaterThan(depois[i - 1]);
  });

  it('e GANHO, nao esticamento: a razao entre as cores atravessa intacta', () => {
    const depois = normalizeExposure(escura).map(luminance);
    const antes = escura.map(luminance);
    // Ganho puro: todo mundo multiplicado pelo MESMO numero. A folga de 5% e o
    // arredondamento para inteiro, que pesa mais nos valores baixos (10*3,67 =
    // 36,7 vira 37). Esticar contraste violaria isto por muito mais que 5%.
    const r0 = depois[0] / antes[0];
    for (let i = 1; i < depois.length; i++) {
      expect(Math.abs(depois[i] / antes[i] - r0) / r0, `cor ${i}`).toBeLessThan(0.05);
    }
  });

  it('preserva matiz mesmo quando o ganho estouraria o canal', () => {
    // ganho cheio levaria o azul a 392; cortar em 255 devolveria um azul
    // acinzentado. O ganho recua para a cor caber, e a razao fica exata.
    const [r, g, b] = normalizeExposure([[20, 40, 80]])[0];
    expect(g / r).toBeCloseTo(2, 1);
    expect(b / r).toBeCloseTo(4, 1);
    expect(Math.max(r, g, b)).toBeLessThanOrEqual(255);
  });

  it('amostra ja bem exposta passa intacta', () => {
    const boa: Rgb[] = [
      [180, 190, 200],
      [120, 60, 70],
      [60, 80, 100],
    ];
    expect(normalizeExposure(boa)).toEqual(boa);
  });

  it('nunca estoura o canal', () => {
    for (const c of normalizeExposure([
      [250, 250, 250],
      [10, 10, 10],
      [255, 200, 100],
    ])) {
      for (const v of c) expect(v).toBeLessThanOrEqual(255);
    }
  });

  it('usa percentil: um reflexo estourado nao define o ganho da malha inteira', () => {
    const comBrilho: Rgb[] = [[255, 255, 255], ...Array(40).fill([30, 34, 44] as Rgb)];
    const depois = normalizeExposure(comBrilho);
    // a massa escura FOI corrigida, apesar do texel branco na amostra
    expect(luminance(depois[5])).toBeGreaterThan(luminance(comBrilho[5]) * 2);
  });
});

describe('quantizeToMaterials com exposicao', () => {
  const escuraIce: Rgb[] = [
    [12, 15, 20],
    [20, 26, 36],
    [30, 38, 52],
    [44, 55, 74],
  ];

  it('sem corrigir, a amostra escura colapsa nos materiais quase pretos', () => {
    const q = quantizeToMaterials(escuraIce, 4, { exposure: false });
    expect(q.used.filter((m) => luminance(materialSwatch(m)) > 90).length).toBe(0);
  });

  it('corrigindo, a mesma amostra ganha material claro e volta a ler como volume', () => {
    const q = quantizeToMaterials(escuraIce, 4);
    expect(q.used.filter((m) => luminance(materialSwatch(m)) > 90).length).toBeGreaterThan(0);
    expect(q.used).not.toContain('scorch');
  });

  it('a correcao e o padrao', () => {
    expect(quantizeToMaterials(escuraIce, 4)).toEqual(
      quantizeToMaterials(escuraIce, 4, { exposure: true }),
    );
  });
});

describe('paleta escolhida pelo autor', () => {
  const escuras: Rgb[] = [
    [12, 15, 20],
    [30, 38, 52],
    [80, 95, 120],
    [150, 170, 200],
  ];
  const minha = ['ice', 'electric', 'rockDeep', 'glass'];

  it('todo material devolvido sai da lista do autor', () => {
    const q = quantizeToMaterials(escuras, 4, { palette: minha });
    for (const m of q.materials) expect(minha).toContain(m);
    for (const m of q.used) expect(minha).toContain(m);
  });

  it('respeita a lista mesmo quando a cor esta MUITO mais perto de outro', () => {
    // vermelho puro: `blood` seria o vizinho obvio, mas nao foi escolhido
    const q = quantizeToMaterials([[220, 30, 40]], 4, { palette: ['ice', 'acid'] });
    expect(q.materials[0]).not.toBe('blood');
    expect(['ice', 'acid']).toContain(q.materials[0]);
  });

  it('o teto de materiais nao se aplica: quem escolheu ja decidiu o tamanho', () => {
    const cores = [
      materialSwatch('ice'),
      materialSwatch('electric'),
      materialSwatch('rockDeep'),
      materialSwatch('glass'),
    ] as Rgb[];
    const q = quantizeToMaterials(cores, 2, { palette: minha, exposure: false });
    expect(new Set(q.materials).size).toBeGreaterThan(2);
  });

  it('`used` lista so o que foi realmente usado, do mais usado ao menos', () => {
    const cores: Rgb[] = [
      ...Array(10).fill(materialSwatch('rockDeep')),
      ...Array(3).fill(materialSwatch('glass')),
    ];
    const q = quantizeToMaterials(cores, 4, { palette: minha, exposure: false });
    expect(q.used[0]).toBe('rockDeep');
    expect(q.used).not.toContain('electric'); // marcado, mas nenhuma cor caiu nele
  });

  it('paleta de um material so pinta tudo com ele', () => {
    const q = quantizeToMaterials(escuras, 4, { palette: ['biolum'] });
    expect(new Set(q.materials)).toEqual(new Set(['biolum']));
  });

  it('paleta vazia volta para o modo automatico', () => {
    expect(quantizeToMaterials(escuras, 3, { palette: [] })).toEqual(
      quantizeToMaterials(escuras, 3),
    );
  });

  it('a correcao de exposicao continua valendo com paleta', () => {
    const muitoEscura: Rgb[] = [
      [4, 5, 7],
      [8, 10, 14],
      [14, 18, 24],
    ];
    const com = quantizeToMaterials(muitoEscura, 4, { palette: minha });
    const sem = quantizeToMaterials(muitoEscura, 4, { palette: minha, exposure: false });
    expect(com.used).not.toEqual(sem.used);
  });
});
