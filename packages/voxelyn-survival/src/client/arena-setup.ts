// Constroi o SurvivalState de uma arena de chefe isolada, a partir das
// condicoes escolhidas na tela de setup (HP, eco/habilidade, modulos).
//
// Nao existe um segundo motor aqui: `createRun` com `sector`/`depth` ja
// reconstroi o setor inteiro do zero — trash, terreno, sitios de salvage e o
// chefe junto —, exatamente como um cliente que reconecta no meio de uma
// expedicao faz. O trabalho desta ferramenta e apontar para o (seed, setor)
// certo (ver `arena-catalog.ts`) e aplicar por cima, ANTES do primeiro tick, as
// condicoes que o testador escolheu — a mesma liberdade que `resimulateRun` do
// servidor usa para re-simular contra um tuning e uma profundidade dados.
//
// E entao RECORTAR. O setor inteiro era o que a ferramenta entregava, e era
// deliberado: a arena e o lugar real, e nao uma caixa branca. Na pratica isso
// custava exatamente o que ela prometia poupar — atravessar meio mapa ate o
// chefe, limpar fauna que nao tem nada a ver com a luta, e ver a Supernova
// acertar um stalker que apareceu por conta propria. `carveArena` deixa de pe a
// camara e as galerias que saem dela, e mais nada.
import {
  CONTAMINATION_WAVES,
  DEFAULT_PLAYER_TUNING,
  SOLID_NONE,
  SOLID_ROCK,
  isPipe,
  PIPE_MOUTH,
  SURF_NONE,
  createRun,
  grantOrRechargeModule,
  type AbilityId,
  type ModuleId,
  type SurvivalState,
} from '@voxelyn/survival-sim';
import { ARENA_CATALOG, type ArenaBossId } from './arena-catalog';

export type ArenaConditions = {
  boss: ArenaBossId;
  maxHp: number;
  ability: AbilityId;
  modules: readonly ModuleId[];
};

/** Faixa de HP que a tela de setup oferece. Fora disso nao ha teste util: */
export const ARENA_MIN_HP = 20;
export const ARENA_MAX_HP = 500;

export const clampArenaHp = (hp: number): number =>
  Math.round(
    Math.max(
      ARENA_MIN_HP,
      Math.min(ARENA_MAX_HP, Number.isFinite(hp) ? hp : DEFAULT_PLAYER_TUNING.maxHp),
    ),
  );

/**
 * O RAIO DA ARENA, em passos de caminhada a partir do chefe.
 *
 * Passos e nao tiles: a medida atravessa os vaos, entao o que sobra e o espaco
 * REALMENTE alcancavel em volta dele — a camara e as galerias que saem dela —,
 * e nao um quadrado carimbado por cima da rocha.
 *
 * Vinte e dois cobre a maior ameaca do elenco com folga: a varredura do Coracao
 * alcanca 15, o canto do Arquicantor 14 e os arcos do Devorador saem de 11. Uma
 * arena menor que o golpe transformaria "esquivar" em "nao ter para onde ir", e
 * o teste passaria a medir a moldura em vez da luta.
 */
export const ARENA_KEEP_RADIUS = 22;
/**
 * A que distancia do chefe o testador comeca.
 *
 * Nove passos: dentro do aggro de todo mundo (o menor da lista e 10) e fora do
 * corpo a corpo. A luta comeca porque o testador esta la, e nao depois de uma
 * caminhada procurando o chefe — que e o tempo que esta ferramenta existe para
 * economizar.
 */
const ARENA_PLAYER_GAP = 9;

/**
 * Reduz o setor a ARENA DO CHEFE e as adjacencias seguras, sem mobs.
 *
 * A ferramenta nascia montando o setor INTEIRO — mesmo terreno, mesmo trash,
 * mesmos sitios de salvage — e isso era deliberado: a arena e o lugar real, e
 * nao uma caixa branca. Na pratica testar chefe assim custa o que a ferramenta
 * prometia poupar: atravessar meio mapa, limpar dois Espectros e um Coveiro que
 * nao tem nada a ver com a luta, e descobrir no meio do encontro que a
 * Supernova acertou um stalker que apareceu por conta propria.
 *
 * O recorte responde a isso sem inventar um segundo gerador: o mundo continua
 * sendo o que a seed produziu, e o que muda e quanto dele fica de pe.
 *
 * - Uma busca em largura A PARTIR DO CHEFE marca tudo o que se alcanca a pe
 *   dentro do raio. O resto do chao vira rocha — nao ha teleporte para o nada,
 *   nao ha corredor que leve a lugar nenhum, e a fronteira e parede de verdade.
 * - Todo inimigo que nao e o chefe sai de campo. Os que ele INVOCA continuam
 *   nascendo normalmente: a matilha do Guardiao, os Escoriaceos do Coracao, os
 *   Coveiros do Diamandis e os Espectros da Rainha sao a luta, e nao ruido.
 * - As ondas de contaminacao ficam desarmadas. Elas repovoam o setor sozinhas
 *   conforme o relogio da run sobe, e sem isto uma luta longa terminaria com
 *   stalkers nascendo no meio dela — exatamente o que o recorte tirou.
 *
 * O que NAO muda: o terreno do bioma, as reacoes de materia e o proprio chefe.
 * A arena continua sendo o Aquifero, a Fornalha ou a Catedral, com a agua, a
 * brasa e os cristais que a seed pos ali.
 */
export const carveArena = (state: SurvivalState, bossArchetype: string): void => {
  const boss = state.enemies.find((e) => e.alive && e.archetype === bossArchetype);
  if (!boss) return;
  const w = state.config.width;
  const h = state.config.height;

  const dist = new Int32Array(w * h).fill(-1);
  const start = Math.floor(boss.y) * w + Math.floor(boss.x);
  if (state.solid[start] !== SOLID_NONE) return;
  dist[start] = 0;
  const queue = [start];
  for (let head = 0; head < queue.length; head++) {
    const cell = queue[head];
    if (dist[cell] >= ARENA_KEEP_RADIUS) continue;
    const cx = cell % w;
    const cy = (cell - cx) / w;
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      const x = cx + dx;
      const y = cy + dy;
      if (x < 1 || y < 1 || x >= w - 1 || y >= h - 1) continue;
      const i = y * w + x;
      if (state.solid[i] !== SOLID_NONE || dist[i] >= 0) continue;
      dist[i] = dist[cell] + 1;
      queue.push(i);
    }
  }

  // Fora da arena vira rocha. A superficie sai junto: uma poca ou um tapete de
  // fungo trancado dentro do macico nao seria visto por ninguem, mas continuaria
  // reagindo — fogo se propagando por dentro da parede e o tipo de fantasma que
  // custa uma tarde para achar.
  for (let i = 0; i < state.solid.length; i++) {
    if (dist[i] >= 0) continue;
    // Os DUTOS: some com os de fora, fica com os que despejam AQUI.
    //
    // A pergunta certa e sobre a BOCA, e nao sobre o corpo do cano. A busca so
    // anda em vao, entao a distancia da propria celula de um duto e sempre -1 —
    // testar por ela apagava todos, inclusive os que fazem parede com a arena, e
    // o Diluvio voltava a brotar do corpo do chefe. Um duto soterrado no macico
    // sai porque ja estaria mudo e continuaria sendo desenhado: cenario
    // prometendo uma coisa que nao vai acontecer.
    if (isPipe(state.solid[i])) {
      const [dx, dy] = PIPE_MOUTH[state.solid[i]];
      const mouth = (Math.floor(i / w) + dy) * w + (i % w) + dx;
      if (mouth >= 0 && mouth < dist.length && dist[mouth] >= 0) continue;
      state.solid[i] = SOLID_ROCK;
      continue;
    }
    if (state.solid[i] === SOLID_NONE) {
      state.solid[i] = SOLID_ROCK;
      state.surface[i] = SURF_NONE;
      state.surfaceTimer[i] = 0;
    }
  }
  for (let c = 0; c < state.chunkVersion.length; c++) state.chunkVersion[c]++;

  // Sem mobs: so o dono da sala. O que ele invocar depois e a luta.
  state.enemies = state.enemies.filter((e) => e === boss);
  // Cenario que so faria sentido no setor inteiro. Os respiradouros e os
  // trilhos que sobraram DENTRO da arena ficam: eles sao o chao do bioma, e o
  // chao do bioma e metade do que se esta testando.
  state.vents = state.vents.filter((v) => dist[v.y * w + v.x] >= 0);
  state.railTracks = state.railTracks.filter((t) => dist[t.y * w + t.x] >= 0);
  state.salvageSites = [];
  state.wellOffers = [];
  // As ondas de contaminacao ja nasceram gastas: `stepContamination` so dispara
  // a onda `w` enquanto `contaminationWaves <= w`.
  state.contaminationWaves = CONTAMINATION_WAVES.length;

  // O testador entra na arena, e nao na entrada do setor — que quase sempre
  // ficou do lado de fora da parede nova.
  let spawn = start;
  let best = Infinity;
  for (let i = 0; i < dist.length; i++) {
    if (dist[i] < 0) continue;
    const gap = Math.abs(dist[i] - ARENA_PLAYER_GAP);
    if (gap < best) {
      best = gap;
      spawn = i;
    }
  }
  for (const player of state.players) {
    player.x = (spawn % w) + 0.5;
    player.y = Math.floor(spawn / w) + 0.5;
  }
  state.entry = { x: spawn % w, y: Math.floor(spawn / w) };
};

export const createArenaRun = (conditions: ArenaConditions): SurvivalState => {
  const entry = ARENA_CATALOG[conditions.boss];
  const tuning = { ...DEFAULT_PLAYER_TUNING, maxHp: clampArenaHp(conditions.maxHp) };
  const state = createRun({
    seed: entry.seed,
    sector: entry.sector,
    tuning,
    depth: {
      generation: entry.generation,
      sectorCount: entry.sectorCount,
      coreSectors: entry.coreSectors,
    },
  });

  // Aplicado DEPOIS de `createRun` e ANTES do primeiro `stepRun`: o mesmo
  // ponto em que um teste de chefe (`arena-chefe.test.ts`) monta a condicao
  // que quer examinar, e nao um estado que a simulacao jamais produziria
  // sozinha por progressao normal — esta ferramenta existe justamente para
  // pular a progressao.
  state.player.hp = tuning.maxHp;
  state.playerExtra.ability = conditions.ability;
  for (const moduleId of conditions.modules) {
    grantOrRechargeModule(state.playerExtra, moduleId, state.tick);
  }

  // O recorte vem por ULTIMO, e depende de o chefe ja estar em campo: quem
  // define o centro da arena e o corpo dele, e nao um ponto do mapa.
  carveArena(state, state.sectorBoss.archetype ?? conditions.boss);

  return state;
};
