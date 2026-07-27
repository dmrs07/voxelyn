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
const gasVoxels = (boxes) => boxes.filter((b) => b.mat === 'sulfur');
const voxelKey = (b) => `${b.x},${b.y},${b.z}`;

describe('modelo de gas', () => {
  const GROUND_TOP = 1; // topo da laje: base em z=0 e saliencia em z=1

  // O defeito original: `z = 1 + ...`, ou seja, comecando DENTRO do topo da
  // laje. A nuvem se espalhava rente ao chao e o jogador lia poca.
  it('paira, com ar visivel entre a nuvem e o chao', () => {
    everyFrame('gas', (boxes, where) => {
      const cloud = gasVoxels(boxes);
      expect(cloud.length, where).toBeGreaterThan(0);
      for (const b of cloud) {
        expect(b.z, `${where}: cubo em z=${b.z}`).toBeGreaterThanOrEqual(GROUND_TOP + 3);
      }
    });
  });

  // A crosta e desenhada antes da fila de profundidade. Deixar a nuvem crescer
  // sem teto faria cubos altos passarem por tras de paredes que estao ao fundo.
  it('nao passa do teto visual seguro da crosta', () => {
    everyFrame('gas', (boxes, where) => {
      for (const b of gasVoxels(boxes)) {
        expect(b.z + b.h - 1, where).toBeLessThanOrEqual(6);
      }
    });
  });

  // A conta que importa nao e a fracao de colunas, e a AREA projetada. A massa
  // precisa formar volume sem fechar os vazios que deixam o piso aparecer.
  it('mantem massa esparsa e estavel em todos os quadros', () => {
    for (let variant = 0; variant < VARIANTS; variant++) {
      const counts = [];
      for (let frame = 0; frame < 4; frame++) {
        const count = gasVoxels(surfaceModel('gas', variant, frame)).length;
        counts.push(count);
        expect(count, `gas v${variant} f${frame}`).toBeGreaterThanOrEqual(8);
        expect(count, `gas v${variant} f${frame}`).toBeLessThanOrEqual(11);
      }
      expect(Math.max(...counts) - Math.min(...counts), `gas v${variant}`).toBeLessThanOrEqual(2);
    }
  });

  // Ponto independente vira ruido. Um sopro tem de possuir pelo menos uma coluna
  // vertical e um ombro lateral, para o olho agrupar voxels como uma massa.
  it('forma sopros com volume vertical em vez de pontos soltos', () => {
    everyFrame('gas', (boxes, where) => {
      const byColumn = new Map();
      for (const b of gasVoxels(boxes)) {
        const key = `${b.x},${b.y}`;
        const levels = byColumn.get(key) ?? new Set();
        levels.add(b.z);
        byColumn.set(key, levels);
      }
      const vertical = [...byColumn.values()].filter((levels) => levels.size >= 2);
      expect(vertical.length, where).toBeGreaterThanOrEqual(3);
      expect(byColumn.size, where).toBeGreaterThan(vertical.length);
    });
  });

  // Animacao boa preserva parte da massa para o olho acompanhar, mas muda o
  // bastante para sugerir respiracao e deriva. Trocar tudo vira cintilacao.
  it('deriva entre quadros sem piscar a nuvem inteira', () => {
    for (let variant = 0; variant < VARIANTS; variant++) {
      const frames = Array.from({ length: 4 }, (_, frame) =>
        new Set(gasVoxels(surfaceModel('gas', variant, frame)).map(voxelKey))
      );
      for (let frame = 0; frame < frames.length; frame++) {
        const current = frames[frame];
        const next = frames[(frame + 1) % frames.length];
        const overlap = [...current].filter((key) => next.has(key)).length;
        expect(overlap, `gas v${variant} f${frame}`).toBeGreaterThan(0);
        expect(overlap, `gas v${variant} f${frame}`).toBeLessThan(current.size);
      }
    }
  });

  // O campo escolhe variantes pela posicao. Se todas tiverem os mesmos centros,
  // a repeticao de tiles volta a uniformizar a densidade e a nuvem vira padrao.
  it('muda a estrutura entre variantes', () => {
    for (let frame = 0; frame < 4; frame++) {
      const signatures = new Set();
      for (let variant = 0; variant < VARIANTS; variant++) {
        signatures.add(gasVoxels(surfaceModel('gas', variant, frame)).map(voxelKey).sort().join('|'));
      }
      expect(signatures.size, `gas f${frame}`).toBe(VARIANTS);
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
