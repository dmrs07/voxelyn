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
import { RAMPS } from '../tools/voxel.mjs';
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

describe('modelo de gas', () => {
  const GROUND_TOP = 1; // topo da laje: base em z=0 e saliencia em z=1

  // O defeito original: `z = 1 + ...`, ou seja, comecando DENTRO do topo da
  // laje. A nuvem se espalhava rente ao chao e o jogador lia poca.
  it('paira, com ar visivel entre a nuvem e o chao', () => {
    everyFrame('gas', (boxes, where) => {
      const cloud = boxes.filter((b) => b.mat === 'sulfur');
      expect(cloud.length, where).toBeGreaterThan(0);
      for (const b of cloud) {
        expect(b.z, `${where}: cubo em z=${b.z}`).toBeGreaterThanOrEqual(GROUND_TOP + 2);
      }
    });
  });

  // A conta que importa nao e a fracao de colunas, e a AREA projetada: um cubo
  // ocupa 4x6 px e o losango da celula tem 256 px, entao um quinto das 64
  // colunas ja passa de 100% de cobertura e a nuvem vira um tapete opaco. Sem
  // vao entre os cubos nao ha leitura de volume — so uma superficie a mais.
  it('fica esparso o bastante para o chao aparecer entre os cubos', () => {
    everyFrame('gas', (boxes, where) => {
      const cloud = boxes.filter((b) => b.mat === 'sulfur').length;
      expect(cloud, where).toBeLessThanOrEqual(8);
      expect(cloud, where).toBeGreaterThanOrEqual(3);
    });
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
