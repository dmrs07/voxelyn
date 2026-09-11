// O CENARIO DO BENCHMARK do Magnetarca — uma fonte só, para duas pontas.
//
// Isto NAO e jogo: e o andaime de medicao do encontro. Ele existe aqui, na API
// publica da simulacao, por um motivo estrutural — duas pontas precisam montar
// EXATAMENTE o mesmo estado, e elas rodam em mundos diferentes:
//
// - o bot mortal (`tools/magnetarch-bot.mjs`), em Node, que joga a partida e
//   grava o log de comandos;
// - o rig de captura (`bench.html` no cliente), no navegador, que reproduz
//   aquele log com o renderer de verdade para virar video.
//
// Se cada um montasse o cenario por conta propria, o log dessincronizaria no
// primeiro tick e o video mostraria uma partida que ninguem mediu. A simulacao e
// deterministica: mesmo estado inicial mais mesma sequencia de comandos da a
// mesma partida, e o "mesmo estado inicial" e o que este arquivo garante.
//
// DUAS ESCOLHAS DE MEDICAO ficam registradas aqui, e as duas sao limitacoes
// declaradas e nao resultados:
//
// 1. A FAUNA e opcional e vem desligada. O que se mede e o encontro, e um
//    Espreitador matando o agente responderia outra pergunta.
// 2. O AGENTE NASCE DENTRO DA FAIXA, com linha de visao para o chefe. Ele nao
//    tem busca de rota; largado na borda do campo ele ficaria encostado na
//    parede da camara, e o numero seria sobre o harness. A travessia ate a
//    camara nao e o que este benchmark responde.

import { MAGNETARCH_CRUSH_RANGE, MAGNETARCH_TETHER_RANGE, SOLID_NONE } from './constants.js';
import { hasLineOfSight } from './pathing.js';
import { createRun } from './run.js';
import { bossForSector } from './bosses.js';
import { runDepthForGeneration } from './progression.js';
import { sectorBiome } from './strata.js';
import type { Entity, SurvivalState } from './types.js';

/** A geracao e o setor em que o encontro do Magnetarca e o clímax da run. */
const BENCH_GENERATION = 'G-04' as const;
const BENCH_SECTOR = 7;

export type MagnetarchBench = {
  state: SurvivalState;
  boss: Entity;
  /** Chao aberto a ate 10 tiles do corpo: a "largura" da camara sorteada. */
  openness: number;
};

/** A seed entrega o Magnetarca no setor final? Funcao pura, sem gerar mundo. */
export const magnetarchBenchSeed = (seed: number): boolean => {
  const depth = runDepthForGeneration(BENCH_GENERATION);
  const def = bossForSector(
    (sector) => sectorBiome(seed, sector),
    BENCH_SECTOR,
    depth.sectorCount,
    depth.coreSectors,
  );
  return def?.archetype === 'magnetarch';
};

const walkable = (state: SurvivalState, x: number, y: number): boolean => {
  const cx = Math.floor(x);
  const cy = Math.floor(y);
  if (cx < 1 || cy < 1 || cx >= state.config.width - 1 || cy >= state.config.height - 1) {
    return false;
  }
  return state.solid[cy * state.config.width + cx] === SOLID_NONE;
};

/**
 * O estado inicial do benchmark, identico nas duas pontas.
 *
 * Devolve `null` quando a seed nao entrega o chefe ou quando a camara nao tem
 * vaga de chao com linha de visao na faixa — as duas sao respostas legitimas, e
 * quem chama simplesmente pula a seed.
 */
export const createMagnetarchBench = (
  seed: number,
  { fauna = false }: { fauna?: boolean } = {},
): MagnetarchBench | null => {
  const depth = runDepthForGeneration(BENCH_GENERATION);
  const state = createRun({ seed, sector: BENCH_SECTOR, depth });
  const boss = state.enemies.find((e) => e.archetype === 'magnetarch');
  if (!boss) return null;
  if (!fauna) state.enemies = state.enemies.filter((e) => e === boss);

  const mid = (MAGNETARCH_CRUSH_RANGE + MAGNETARCH_TETHER_RANGE) / 2;
  let placed = false;
  for (const ring of [mid, mid + 1.5, mid - 1.5, MAGNETARCH_CRUSH_RANGE + 1]) {
    for (let k = 0; k < 48 && !placed; k++) {
      const a = (k / 48) * Math.PI * 2;
      const x = boss.x + Math.cos(a) * ring;
      const y = boss.y + Math.sin(a) * ring;
      if (!walkable(state, x, y)) continue;
      if (!hasLineOfSight(state, x, y, boss.x, boss.y)) continue;
      state.player.x = x;
      state.player.y = y;
      placed = true;
    }
    if (placed) break;
  }
  if (!placed) return null;

  let openness = 0;
  const w = state.config.width;
  for (let y = Math.floor(boss.y) - 10; y <= Math.floor(boss.y) + 10; y++) {
    for (let x = Math.floor(boss.x) - 10; x <= Math.floor(boss.x) + 10; x++) {
      if (x < 1 || y < 1 || x >= w - 1 || y >= state.config.height - 1) continue;
      if (Math.hypot(x - boss.x, y - boss.y) > 10) continue;
      if (state.solid[y * w + x] === SOLID_NONE) openness++;
    }
  }

  return { state, boss, openness };
};
