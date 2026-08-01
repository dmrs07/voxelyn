// Testes do MODELO das crostas de chao, antes de virar pixel.
//
// Por que em .mjs e fora de src/: o gerador e JavaScript puro (roda por `node`
// sem passo de build) e `tsconfig.json` compila `src/**/*` — um teste em
// TypeScript importando `tools/surfaces.mjs` quebraria `pnpm build` por falta
// de declaracoes. Aqui o teste alcanca o gerador sem arrastar o gerador para
// dentro do build.
//
// Por que existe: gas e poca sao as duas materias do chao que o jogador precisa
// separar em menos de 200 ms, e as duas falharam CALADAS. A poca ficou um voxel
// no ar sobre as colunas sem saliencia — uma placa verde flutuando — e o gas
// nascia na altura do proprio piso, se espalhava rente a ele e lia melhor como
// poca do que a propria poca. Os dois atlas continuaram gerando, validando a
// paleta e passando em todo teste que existia: os testes olhavam recorte de
// atlas, nunca geometria. Estes olham geometria.
import { describe, expect, it } from 'vitest';
import { surfaceModel, SURFACE_COLS, SURFACE_KINDS } from '../tools/surfaces.mjs';
import { DIR_UNROTATED, MODEL_SCALE, RAMPS, renderVoxels } from '../tools/voxel.mjs';
import { COLORS } from '../tools/lib.mjs';
import { VARIANTS } from '../tools/terrain.mjs';

const COLUMNS = SURFACE_COLS * SURFACE_COLS;

/** Percorre variante x quadro de um tipo. */
const everyFrame = (name, fn) => {
  const kind = SURFACE_KINDS.find((k) => k.name === name);
  expect(kind, name).toBeDefined();
  for (let variant = 0; variant < VARIANTS; variant++) {
    for (let frame = 0; frame < kind.frames; frame++) {
      fn(surfaceModel(name, variant, frame), `${name} v${variant} f${frame}`);
    }
  }
};

/** Conjunto de voxels ocupados, para perguntar o que ha embaixo de que. */
const occupancy = (boxes) => {
  const set = new Set();
  for (const b of boxes) {
    for (let dx = 0; dx < b.w; dx++)
      for (let dy = 0; dy < b.d; dy++)
        for (let dz = 0; dz < b.h; dz++) set.add(`${b.x + dx},${b.y + dy},${b.z + dz}`);
  }
  return set;
};

const isLiquid = (b) => b.mat === 'pool' || b.mat === 'biolum';

const voxelKey = (b) => `${b.x},${b.y},${b.z}`;

/** Voxels da nuvem, ja desdobrados: uma caixa de duas alturas conta por dois. */
const cloudVoxels = (boxes) => {
  const out = [];
  for (const b of boxes) {
    if (b.mat !== 'sulfur') continue;
    for (let dz = 0; dz < b.h; dz++) out.push({ x: b.x, y: b.y, z: b.z + dz });
  }
  return out;
};

/**
 * Area que a nuvem tapa, em % do losango da celula, pelo rasterizador REAL.
 *
 * Na grade fina (MODEL_SCALE), cada coluna autorada projeta 4*MODEL_SCALE px de
 * largura por 2*MODEL_SCALE de profundidade: o losango de uma celula tem
 * (8*8)*(16*4)/2 = 1024 px. Medir no rasterizador e nao por estimativa importa
 * porque a sobreposicao entre cubos vizinhos e justamente o que a conta por
 * contagem erra.
 */
const CELL_DIAMOND_PX = ((SURFACE_COLS * 4 * MODEL_SCALE) * (SURFACE_COLS * 2 * MODEL_SCALE)) / 2;
const cloudCoverage = (boxes) => {
  const g = renderVoxels(boxes.filter((b) => b.mat === 'sulfur'), DIR_UNROTATED, 128, 128, 64, 96);
  let px = 0;
  for (let i = 3; i < g.buf.length; i += 4) if (g.buf[i] !== 0) px++;
  return (100 * px) / CELL_DIAMOND_PX;
};


describe('modelo de gas', () => {
  const HAZE_FLOOR = 4; // piso da bruma: dois voxels de ar acima da laje
  const GAS_FRAMES = SURFACE_KINDS.find((k) => k.name === 'gas').frames;
  const cloudOf = (variant, frame) => cloudVoxels(surfaceModel('gas', variant, frame));
  /** Variantes que levantam penacho: as que passam da faixa da bruma. */
  const plumeVariants = () => {
    const out = [];
    for (let v = 0; v < VARIANTS; v++) {
      let tall = false;
      for (let f = 0; f < GAS_FRAMES; f++) if (cloudOf(v, f).some((b) => b.z > 5)) tall = true;
      if (tall) out.push(v);
    }
    return out;
  };

  // A regra mais importante do arquivo, e a unica que e de REGRA DE JOGO e nao
  // de estetica: gas machuca, e o jogo promete que a morte venha de decisao
  // arriscada e nunca do que nao dava para ver. Uma celula que fica vazia num
  // quadro do ciclo e um perigo que pisca para fora da tela.
  it('nunca deixa a celula sem materia em nenhum quadro', () => {
    everyFrame('gas', (boxes, where) => {
      expect(cloudVoxels(boxes).length, where).toBeGreaterThanOrEqual(5);
    });
  });

  // O defeito de origem: a nuvem nascia em z=1, a altura do proprio topo da
  // laje, e se deitava no chao — lia como poca, e melhor do que a poca lia.
  it('mantem a bruma no ar, com vao visivel ate o chao', () => {
    for (let v = 0; v < VARIANTS; v++) {
      if (plumeVariants().includes(v)) continue; // o penacho e enraizado de proposito
      for (let f = 0; f < GAS_FRAMES; f++) {
        for (const b of cloudOf(v, f)) {
          expect(b.z, `gas v${v} f${f} em z=${b.z}`).toBeGreaterThanOrEqual(HAZE_FLOOR);
        }
      }
    }
  });

  // Um atlas de tiles nao desenha UMA peca: desenha a mesma peca em toda celula
  // que a simulacao marcar. Penacho em todas elas fecha o campo numa parede
  // verde opaca — renderizado e conferido — e esconder o que esta atras e pior
  // do que feio num jogo que promete perigo visivel. Uma variante em tres.
  it('levanta penacho em parte das celulas, e nao em todas', () => {
    const tall = plumeVariants();
    expect(tall.length).toBe(1);
    expect(tall.length).toBeLessThan(VARIANTS);
  });

  // A silhueta da referencia e um PE fino que abre numa CABECA lobulada. Se a
  // largura nao crescer com a altura nao ha cabeca, e sem faixa alta estreita
  // nao ha pe: e so um amontoado alto.
  it('da ao penacho um pe estreito e uma cabeca larga', () => {
    const v = plumeVariants()[0];
    let sawShape = false;
    for (let f = 0; f < GAS_FRAMES; f++) {
      const cloud = cloudOf(v, f);
      const stem = new Set(cloud.filter((b) => b.z <= 5).map((b) => `${b.x},${b.y}`)).size;
      const head = new Set(cloud.filter((b) => b.z >= 7).map((b) => `${b.x},${b.y}`)).size;
      if (head > stem && stem > 0) sawShape = true;
    }
    expect(sawShape, 'nenhum quadro tem cabeca mais larga que o pe').toBe(true);
    // E ele tem de ser ALTO: a silhueta pedida e a altura.
    const span = Math.max(
      ...Array.from({ length: GAS_FRAMES }, (_, f) => {
        const zs = cloudOf(v, f).map((b) => b.z);
        return Math.max(...zs) - Math.min(...zs);
      })
    );
    expect(span).toBeGreaterThanOrEqual(6);
  });

  // Contar cubos mede a coisa errada: o que fecha o chao e a AREA PROJETADA, e
  // ela nao e proporcional a contagem — cubos agrupados se tapam uns aos
  // outros. Aqui a area sai do rasterizador de verdade. So vale para a bruma:
  // o penacho sobe ACIMA do proprio losango, entao a maior parte dos pixels
  // dele nao esta tapando o chao da celula, e a fracao passaria de 100% sem
  // querer dizer nada.
  it('nao deixa a bruma tapar o chao', () => {
    for (let v = 0; v < VARIANTS; v++) {
      if (plumeVariants().includes(v)) continue;
      for (let f = 0; f < GAS_FRAMES; f++) {
        const cov = cloudCoverage(surfaceModel('gas', v, f));
        expect(cov, `gas v${v} f${f}`).toBeLessThanOrEqual(55);
        expect(cov, `gas v${v} f${f}`).toBeGreaterThan(4);
      }
    }
  });

  // Decidir cada coluna independentemente das vizinhas so produz ruido
  // uniforme. A regra de resto que havia antes era o oposto do agrupamento: com
  // passo 3 e 5 sobre modulo 11, duas colunas vizinhas NUNCA caiam juntas na
  // selecao — agrupamento zero, medido.
  it('se agrupa, em vez de pontilhar o ar', () => {
    everyFrame('gas', (boxes, where) => {
      const cloud = cloudVoxels(boxes);
      const near = cloud.filter((a) =>
        cloud.some((b) => b !== a && Math.abs(a.x - b.x) + Math.abs(a.y - b.y) === 1)
      );
      expect(near.length, `${where}: nenhum cubo encosta em outro`).toBeGreaterThan(0);
    });
  });

  // Animacao boa preserva parte da massa para o olho acompanhar e muda o
  // bastante para sugerir deriva. Trocar tudo vira cintilacao — e era o que
  // acontecia: acumulando um passo de deriva por estagio, a sobreposicao entre
  // dois quadros chegava a ZERO e a celula inteira teleportava.
  it('deriva entre quadros sem piscar a celula inteira', () => {
    for (let v = 0; v < VARIANTS; v++) {
      const frames = Array.from(
        { length: GAS_FRAMES },
        (_, f) => new Set(cloudOf(v, f).map(voxelKey))
      );
      for (let f = 0; f < frames.length; f++) {
        const current = frames[f];
        const next = frames[(f + 1) % frames.length];
        const overlap = [...current].filter((k) => next.has(k)).length;
        expect(overlap, `gas v${v} f${f}`).toBeGreaterThan(0);
        expect(overlap, `gas v${v} f${f}`).toBeLessThan(current.size);
      }
    }
  });

  // O campo escolhe variantes pela posicao. Se todas tiverem a mesma forma, a
  // repeticao de tiles uniformiza a densidade e a nuvem vira padrao.
  it('muda a estrutura entre variantes', () => {
    for (let f = 0; f < GAS_FRAMES; f++) {
      const signatures = new Set();
      for (let v = 0; v < VARIANTS; v++) signatures.add(cloudOf(v, f).map(voxelKey).sort().join('|'));
      expect(signatures.size, `gas f${f}`).toBe(VARIANTS);
    }
  });

  // Enxofre e AMARELO. A paleta mestra nao tem amarelo puro, e o gas usava
  // `acid` — verde-limao, vizinho do fungo justamente no matiz. A rampa
  // `sulfur` resolve pelo topo quente sobre lateral esverdeada.
  it('tem topo quente, e nao mais um verde ao lado do fungo', () => {
    const [top] = RAMPS.sulfur;
    const [r, g, b] = COLORS[top];
    expect(r).toBeGreaterThan(g);
    expect(g).toBeGreaterThan(b);
  });
});

describe('modelo de poca', () => {
  // O defeito original: lamina num z fixo acima de toda saliencia. Como o topo
  // da laje e z=0 nas colunas sem saliencia, a poca pairava um voxel acima do
  // chao em tres quartos da celula — uma placa flutuando, que e o oposto de um
  // liquido.
  it('assenta no leito, sem voxel de ar embaixo', () => {
    everyFrame('biofluid', (boxes, where) => {
      const solid = occupancy(boxes.filter((b) => !isLiquid(b)));
      const liquid = boxes.filter(isLiquid);
      expect(liquid.length, where).toBeGreaterThan(0);
      for (const b of liquid) {
        expect(solid.has(`${b.x},${b.y},${b.z - 1}`), `${where}: lamina em ${b.x},${b.y}`).toBe(true);
      }
    });
  });

  // Liquido acha NIVEL. A lamina herdando o cascalho da laje comum sairia um
  // tapete rugoso da cor errada; e e a superficie unica que separa poca de
  // qualquer outra coisa no chao, ja que matiz sozinho se perde na penumbra.
  it('fica num nivel unico', () => {
    everyFrame('biofluid', (boxes, where) => {
      const levels = new Set(boxes.filter(isLiquid).map((b) => b.z + b.h - 1));
      expect([...levels], where).toHaveLength(1);
    });
  });

  // Uma lamina plana e sem interrupcao le como laje pintada de verde. Sao as
  // pedras atravessando a superficie que dizem "isto tem nivel" — e elas tem de
  // ser POUCAS: na densidade da laje comum voltam a ler como cascalho molhado.
  it('deixa pedra emergir da lamina, com parcimonia', () => {
    everyFrame('biofluid', (boxes, where) => {
      const level = boxes.filter(isLiquid)[0].z;
      const above = boxes.filter((b) => !isLiquid(b) && b.z + b.h - 1 > level);
      expect(above.length, where).toBeGreaterThan(0);
      expect(above.length, where).toBeLessThan(COLUMNS / 8);
    });
  });

  // Poca e fungo ocupam a mesma faixa de verdes e sao as duas coisas mais
  // comuns no chao: se a lamina usar a cor do tapete, o jogador pisa numa
  // achando que e a outra.
  it('nao usa a cor do tapete de fungo', () => {
    const carpet = surfaceModel('fungal', 0, 0).find((b) => b.z > 0).mat;
    everyFrame('biofluid', (boxes, where) => {
      const body = boxes.filter((b) => b.mat === 'pool');
      expect(body.length, where).toBeGreaterThan(COLUMNS / 2);
      for (const b of boxes.filter(isLiquid)) expect(b.mat, where).not.toBe(carpet);
    });
    // Ao menos um passo de valor abaixo do tapete: a poca le por PROFUNDIDADE,
    // nao por matiz — matiz e o que se perde na penumbra em que o jogo se passa.
    const sum = (name) => COLORS[RAMPS[name][0]].reduce((a, c) => a + c, 0);
    expect(sum('pool')).toBeLessThan(sum(carpet));
  });
});
