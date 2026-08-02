// A arena do chefe com o sotaque do estrato.
//
// A camara do chefe era a ultima sala importante que saia igual em todo bioma —
// a mesma clareira lisa na Catedral, na Cripta e na Fornalha — e e onde o
// jogador passa mais tempo olhando para o chao.
//
// O que estes testes cobram, em ordem de gravidade:
// 1. NADA FICA PRESO. O carimbo roda DEPOIS das provas de alcancabilidade da
//    geracao, entao ele paga a propria: poco e chefe continuam alcancaveis a
//    partir da entrada, em toda linhagem e nos dois setores de chefe.
// 2. O CORPO DO CHEFE CABE. O Guardiao ocupa quase 1,5 tile; a moldura nao
//    pode invadir o 3x3 dele nem o pedestal do poco.
// 3. IDENTIDADE. Cada estrato deixa a propria marca — e o basalto historico
//    continua sem marca nenhuma.
import { describe, expect, it } from 'vitest';
import {
  BISHOP_SECTOR,
  SECTOR_COUNT,
  SOLID_CRYSTAL,
  SOLID_FRAGILE,
  SOLID_NONE,
  SURF_EMBER,
  SURF_ICE,
  SURF_WATER,
} from '../src/constants';
import { SOLID_ROCK } from '../src/constants';
import { createRun } from '../src/run';
import { floodOpen, stampBossArena } from '../src/worldgen';
import { lineageOf } from '../src/strata';
import type { SurvivalState } from '../src/types';

const seedWithLineage = (lineage: string): number => {
  for (let seed = 1; seed < 4096; seed++) if (lineageOf(seed) === lineage) return seed;
  throw new Error(`nenhuma seed pequena com linhagem ${lineage}`);
};

const LINEAGES = ['hydric', 'mineral', 'industrial', 'thermal', 'arid', 'cryo'];

/** Onde o chefe daquele setor esta (Bispo ou Guardiao ocupam o mesmo ponto). */
const bossOf = (state: SurvivalState): { x: number; y: number } => {
  const boss = state.enemies.find((e) => e.archetype === 'bishop' || e.archetype === 'guardian');
  expect(boss, 'setor de chefe sem chefe').toBeDefined();
  return { x: Math.floor(boss!.x), y: Math.floor(boss!.y) };
};

describe('arena do chefe por estrato', () => {
  it('poco e chefe continuam ALCANCAVEIS a partir da entrada', () => {
    // A prova que a moldura tem de pagar. Ela e carimbada depois das
    // validacoes da geracao, entao um pilar num estrangulamento poderia
    // isolar a camara — e o proprio carimbo se desfaz quando isso acontece.
    for (const lineage of LINEAGES) {
      const seed = seedWithLineage(lineage);
      for (const sector of [BISHOP_SECTOR, SECTOR_COUNT]) {
        const state = createRun({ seed, sector });
        const w = state.config.width;
        const reach = floodOpen(state.solid, w, state.config.height, state.entry.x, state.entry.y);
        const boss = bossOf(state);
        expect(
          reach.has(state.corePos.y * w + state.corePos.x),
          `${lineage} s${sector}: poco isolado`,
        ).toBe(true);
        expect(reach.has(boss.y * w + boss.x), `${lineage} s${sector}: chefe isolado`).toBe(true);
      }
    }
  });

  it('o corpo do chefe CABE: o 3x3 dele e o pedestal ficam livres', () => {
    for (const lineage of LINEAGES) {
      const seed = seedWithLineage(lineage);
      for (const sector of [BISHOP_SECTOR, SECTOR_COUNT]) {
        const state = createRun({ seed, sector });
        const w = state.config.width;
        const boss = bossOf(state);
        for (const [cx, cy] of [[boss.x, boss.y], [state.corePos.x, state.corePos.y]]) {
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              expect(
                state.solid[(cy + dy) * w + cx + dx],
                `${lineage} s${sector}: ${cx + dx},${cy + dy} bloqueado`,
              ).toBe(SOLID_NONE);
            }
          }
        }
      }
    }
  });

  it('cada estrato deixa a PROPRIA marca na camara', () => {
    // Amostra por linhagem: o que a arena daquele bioma deposita em volta do
    // chefe. Conta na janela da camara (raio 7 = o mesmo do cerco).
    const marks: Array<{ lineage: string; sector: number; find: (s: SurvivalState, i: number) => boolean }> = [
      // Catedral Prismatica: pilares de cristal.
      { lineage: 'mineral', sector: BISHOP_SECTOR, find: (s, i) => s.solid[i] === SOLID_CRYSTAL },
      // Aquifero Negro: a orla e agua.
      { lineage: 'hydric', sector: BISHOP_SECTOR, find: (s, i) => s.surface[i] === SURF_WATER },
      // Cripta Glacial: a arena escorrega.
      { lineage: 'cryo', sector: SECTOR_COUNT, find: (s, i) => s.surface[i] === SURF_ICE },
      // Fornalha/Ferrifero: brasa na orla.
      { lineage: 'industrial', sector: SECTOR_COUNT, find: (s, i) => s.surface[i] === SURF_EMBER },
      // Fenda Sulfurosa: paredes porosas.
      { lineage: 'thermal', sector: BISHOP_SECTOR, find: (s, i) => s.solid[i] === SOLID_FRAGILE },
    ];
    for (const m of marks) {
      const state = createRun({ seed: seedWithLineage(m.lineage), sector: m.sector });
      const w = state.config.width;
      const boss = bossOf(state);
      let found = 0;
      for (let dy = -7; dy <= 7; dy++) {
        for (let dx = -7; dx <= 7; dx++) {
          const x = boss.x + dx;
          const y = boss.y + dy;
          if (x < 0 || y < 0 || x >= w || y >= state.config.height) continue;
          if (m.find(state, y * w + x)) found++;
        }
      }
      expect(found, `${m.lineage} s${m.sector}: a camara nao tem a marca do estrato`).toBeGreaterThan(0);
    }
  });

  it('a moldura SE DESFAZ quando fecharia o unico corredor', () => {
    // Nas seeds reais este ramo nunca dispara: as camaras que a geracao abre
    // sao largas demais para um anel esparso de 8 celulas fechar. Uma rede de
    // seguranca que nunca e exercitada nao e uma rede — entao aqui ela e armada
    // a mao, com a camara ligada ao mundo por UM corredor que passa exatamente
    // por uma celula de eixo do anel.
    const W = 40;
    const H = 40;
    const boss = { x: 12, y: 20 };
    const core = { x: 10, y: 20 };
    const entry = { x: 24, y: 20 };

    /** Camara de raio 3 + corredor a leste, com `lanes` faixas de largura. */
    const build = (lanes: number) => {
      const solid = new Uint8Array(W * H).fill(SOLID_ROCK);
      for (let dy = -3; dy <= 3; dy++) {
        for (let dx = -3; dx <= 3; dx++) solid[(boss.y + dy) * W + boss.x + dx] = SOLID_NONE;
      }
      for (let lane = 0; lane < lanes; lane++) {
        for (let x = boss.x + 3; x <= entry.x; x++) solid[(boss.y + lane) * W + x] = SOLID_NONE;
      }
      return solid;
    };
    // (16,20) e o eixo leste do anel 4 — e o gargalo por onde o corredor passa.
    const choke = boss.y * W + boss.x + 4;

    // Uma faixa: o pilar de cristal do ramo `radial` tapa o gargalo. O carimbo
    // percebe e some POR INTEIRO.
    const sealed = build(1);
    stampBossArena(sealed, new Uint8Array(W * H), W, H, boss, core, entry, 'radial');
    expect(sealed[choke], 'o gargalo foi tapado: a moldura tinha de ter sumido').toBe(SOLID_NONE);
    expect(
      floodOpen(sealed, W, H, entry.x, entry.y).has(boss.y * W + boss.x),
      'chefe isolado apos o carimbo',
    ).toBe(true);

    // Controle: com duas faixas o gargalo deixa de ser gargalo, e ai o pilar
    // FICA. Sem este par, um carimbo que nunca escreve nada passaria no teste
    // de cima sem fazer nada.
    const open = build(2);
    stampBossArena(open, new Uint8Array(W * H), W, H, boss, core, entry, 'radial');
    expect(open[choke], 'sem gargalo, o pilar tinha de ficar').toBe(SOLID_CRYSTAL);
  });

  it('a moldura NAO importa materia de outro estrato', () => {
    // O reverso do teste anterior, e o que de fato quebra se alguem copiar um
    // ramo de `stampBossArena` para outro e esquecer de trocar o material: a
    // Fenda ganhando gelo, a Cripta ganhando brasa. Os dois estratos abaixo
    // tem blob de agua/gelo/brasa ZERADO no perfil (fora o proprio gelo da
    // Cripta), entao qualquer aparicao dessas superficies na camara so pode
    // ter vindo do carimbo.
    const foreign: Array<{ lineage: string; sector: number; banned: number[] }> = [
      // Fenda Sulfurosa: `lungs` so abre parede porosa — nao pinta chao nenhum.
      { lineage: 'thermal', sector: BISHOP_SECTOR, banned: [SURF_WATER, SURF_ICE, SURF_EMBER] },
      // Cripta Glacial: gelo e dela; brasa e agua nao.
      { lineage: 'cryo', sector: SECTOR_COUNT, banned: [SURF_EMBER, SURF_WATER] },
    ];
    for (const f of foreign) {
      const state = createRun({ seed: seedWithLineage(f.lineage), sector: f.sector });
      const w = state.config.width;
      const boss = bossOf(state);
      for (let dy = -7; dy <= 7; dy++) {
        for (let dx = -7; dx <= 7; dx++) {
          const x = boss.x + dx;
          const y = boss.y + dy;
          if (x < 0 || y < 0 || x >= w || y >= state.config.height) continue;
          expect(
            f.banned.includes(state.surface[y * w + x]),
            `${f.lineage} s${f.sector}: materia estrangeira em ${x},${y}`,
          ).toBe(false);
        }
      }
    }
  });
});
