// A descida: o que acontece quando o jogador alcanca o poco.
//
// Este arquivo existe porque a run tinha 96x96 tiles fixos, um bioma e uma
// topologia. As seeds mudavam o desenho e nada mais: nao havia profundidade,
// nao havia aposta crescente, e a fantasia declarada — "um prospector DESCENDO
// no Veio" — nunca acontecia. O jogador entrava, andava no plano e saia.
//
// A correcao nao e mais conteudo, e ESTRUTURA. Uma run agora sao tres mundos
// encadeados, e a pergunta "exploro mais ou desco agora" existe duas vezes
// antes do Guardiao.
//
// A decisao de implementacao que rege o arquivo: descer REESCREVE o estado no
// lugar em vez de criar um `SurvivalState` novo.
//
// Criar um novo era o caminho obvio e estava errado por dois motivos, nesta
// ordem de gravidade. Primeiro, o servidor guarda a referencia do estado da
// sala e a distribui: trocar o objeto obrigaria a rastrear a troca em todo
// lugar que segura uma referencia, e a primeira que ficasse velha viraria uma
// sala fantasma. Segundo, a maior parte do estado ATRAVESSA a descida —
// modulos, frascos, vida, contaminacao, contadores, os proprios jogadores — e
// um construtor novo os recriaria zerados, obrigando a copiar de volta campo a
// campo. Escrever o que muda e menor e diz o que realmente acontece.

import {
  BISHOP_SECTOR,
  CHUNK,
  CONTAMINATION_CARRYOVER,
  HORSE_SPAWN_CHANCE,
  MAX_ENEMIES,
  MINER_ORE_SEARCH,
  MINER_PER_SECTOR,
  RUN_SEED_MIX,
  SECTOR_COUNT,
  SOLID_NONE,
  SOLID_ORE,
} from './constants.js';
import { emptyResonance } from './abilities.js';
import { spawnEnemy } from './entities.js';
import { generateWorld } from './worldgen.js';
import type { EnemyArchetype, SemanticEvent, SurvivalState } from './types.js';

/**
 * Seed do setor N a partir da seed da run.
 *
 * Derivada e nao sorteada: a run inteira tem de ser reproduzivel a partir de um
 * unico numero. E disso que dependem a seed compartilhavel, o replay e a
 * verificacao do leaderboard — se o segundo setor viesse do relogio, duas
 * pessoas com a "mesma seed" jogariam mapas diferentes a partir do minuto
 * quatro.
 */
export const sectorSeed = (runSeed: number, sector: number): number =>
  (Math.imul(runSeed ^ (sector * 0x9e3779b9), 0x85ebca6b) ^ (sector * 0x27d4eb2f)) >>> 0;

/** O ultimo setor e o unico com nucleo e Guardiao. */
export const isFinalSector = (sector: number): boolean => sector >= SECTOR_COUNT;

/**
 * Mistura de inimigos do setor.
 *
 * A composicao endurece com a profundidade em vez de so aumentar a contagem:
 * mais bruisers e bombers, menos stalkers soltos. Subir o numero de bichos
 * iguais alonga a luta; trocar QUAIS bichos muda o problema.
 */
const SECTOR_MIX: readonly EnemyArchetype[][] = [
  ['stalker', 'stalker', 'spitter', 'stalker', 'bomber', 'spitter', 'stalker', 'bomber'],
  ['stalker', 'spitter', 'bruiser', 'stalker', 'bomber', 'spitter', 'bruiser', 'stalker'],
  [
    'stalker',
    'stalker',
    'spitter',
    'bruiser',
    'stalker',
    'spitter',
    'bomber',
    'bruiser',
    'bomber',
    'stalker',
  ],
];

/** Popula inimigos e o Guardiao (se houver) do setor. */
export const populateSector = (
  state: SurvivalState,
  spawns: readonly { x: number; y: number }[],
  guardian: { x: number; y: number },
): void => {
  const mix = SECTOR_MIX[Math.min(state.sector, SECTOR_MIX.length) - 1];
  // Um elite por setor, no meio da lista: cedo demais e o jogador ainda nao tem
  // com o que responder, tarde demais e ele ja passou pelo setor.
  const eliteIndex = Math.floor(spawns.length / 2);
  const bossHere = state.sector === BISHOP_SECTOR || isFinalSector(state.sector);
  const budget = Math.min(spawns.length, MAX_ENEMIES - (bossHere ? 1 : 0));

  // O Cavalo OCUPA a vaga do elite em vez de somar um inimigo.
  //
  // Somar seria inflar a contagem do setor num sorteio, e a densidade e a coisa
  // que menos deveria variar por sorte: o mesmo mapa ficaria facil ou apertado
  // sem nada visivel explicando a diferenca. Ocupando a vaga, o que o sorteio
  // decide e QUAL e a ameaca de destaque daquele setor — um bicho reforcado ou
  // um cavalo que redesenha o chao — e nao quantas existem.
  //
  // A tirada vem de `state.rng`, o mesmo gerador da run: o setor 2 da seed X tem
  // cavalo para todo mundo que jogar a seed X, senao o replay do leaderboard
  // divergiria do que o jogador viveu.
  const horseHere = state.rng.nextFloat01() < HORSE_SPAWN_CHANCE;
  for (let i = 0; i < budget; i++) {
    if (i === eliteIndex && horseHere) {
      // Nao entra como `elite`: elite acende o fungo sob os proprios pes, e o
      // cavalo ficaria cercado do fogo que so a investida dele devia acender.
      spawnEnemy(state, 'fungal_horse', spawns[i].x, spawns[i].y, false);
      continue;
    }
    spawnEnemy(state, mix[i % mix.length], spawns[i].x, spawns[i].y, i === eliteIndex);
  }

  // O Bispo ocupa o mesmo ponto que o Guardiao ocuparia — a camara que a geracao
  // reserva para um chefe. Nao ha sala nova: o setor 2 ja tinha o espaco vazio, e
  // o que faltava era alguem la dentro.
  if (state.sector === BISHOP_SECTOR) {
    spawnEnemy(state, 'bishop', guardian.x, guardian.y, false);
  }
  if (isFinalSector(state.sector)) {
    spawnEnemy(state, 'guardian', guardian.x, guardian.y, false);
  }
  populateMiners(state, spawns);
};

/**
 * Mineradores nascem PERTO DE MINERIO, e nao em pontos de spawn de inimigo.
 *
 * O lugar e a caracterizacao: eles ainda estao trabalhando o veio, decadas
 * depois de a grade que os mandou ter parado de responder. Espalha-los pelos mesmos
 * pontos que os bichos os transformaria em mais um inimigo que por acaso nao
 * ataca — o encontro so significa alguma coisa acontecendo ONDE voce foi buscar
 * o que eles ja estavam tirando.
 *
 * A varredura anda pelos pontos de spawn em ordem fixa e procura minerio na
 * vizinhanca de cada um, com a ordem de iteracao como desempate. Deterministica
 * pelo mesmo motivo de sempre: as duas maquinas de uma sala de co-op precisam
 * colocar os mineradores nas MESMAS celulas.
 */
const populateMiners = (state: SurvivalState, spawns: readonly { x: number; y: number }[]): void => {
  const w = state.config.width;
  let placed = 0;
  // Uma celula so recebe UM minerador.
  //
  // Duas janelas de busca vizinhas enxergam o mesmo veio e, varrendo na mesma
  // ordem fixa, escolhem a mesma celula ao lado dele — no setor 1 com semente 9
  // os dois nasciam exatamente em `78.5,82.5`. Empilhados, eles desenham e andam
  // como um corpo so, e o jogador so descobre o segundo quando o primeiro morre e
  // sobra vida onde nao devia haver mais nada. A reserva e um `Set` local e nao um
  // campo de estado: ela vale durante a povoacao e nao existe depois dela.
  const taken = new Set<number>();
  for (const enemy of state.enemies) {
    if (enemy.alive) taken.add(Math.floor(enemy.y) * w + Math.floor(enemy.x));
  }
  for (const spawn of spawns) {
    if (placed >= MINER_PER_SECTOR || state.enemies.length >= MAX_ENEMIES) return;
    let found: { x: number; y: number } | null = null;
    for (let dy = -MINER_ORE_SEARCH; dy <= MINER_ORE_SEARCH && !found; dy++) {
      for (let dx = -MINER_ORE_SEARCH; dx <= MINER_ORE_SEARCH && !found; dx++) {
        const x = spawn.x + dx;
        const y = spawn.y + dy;
        if (x < 1 || y < 1 || x >= w - 1 || y >= state.config.height - 1) continue;
        if (state.solid[y * w + x] !== SOLID_ORE) continue;
        // O veio e solido: ele fica ao LADO dele, num chao livre, nao dentro.
        for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const fx = x + ox;
          const fy = y + oy;
          const i = fy * w + fx;
          if (state.solid[i] !== SOLID_NONE) continue;
          if (taken.has(i)) continue;
          found = { x: fx, y: fy };
          break;
        }
      }
    }
    if (!found) continue;
    taken.add(found.y * w + found.x);
    spawnEnemy(state, 'miner', found.x, found.y, false);
    placed++;
  }
};

/**
 * Troca o mundo pelo do proximo setor, preservando os jogadores.
 *
 * Nao verifica se ha proximo setor: quem chama decide, porque no ultimo o
 * mesmo ponto significa outra coisa (o nucleo) e o caminho e completamente
 * diferente.
 */
export const descend = (state: SurvivalState, events: SemanticEvent[]): void => {
  const width = state.config.width;
  const height = state.config.height;
  state.sector += 1;
  state.sectorStartedAt = state.tick;

  // Mesma mistura de createRun: o setor 2 gerado ao descer tem de ser IDENTICO
  // ao setor 2 construido por `createRun({ sector: 2 })`, senao um cliente que
  // reconstroi o mundo ao reconectar veria outro mapa.
  const world = generateWorld(
    sectorSeed((state.config.seed ^ RUN_SEED_MIX) >>> 0, state.sector),
    width,
    height,
  );

  state.solid = world.solid;
  state.surface = world.surface;
  state.surfaceTimer = new Uint16Array(width * height);
  state.entry = world.entry;
  state.corePos = world.corePos;

  // TODA versao de chunk avanca. O cliente online detecta mundo novo por
  // divergencia de versao; sem o incremento global, chunks que por acaso
  // tivessem o mesmo conteudo ficariam marcados como atuais e o jogador veria
  // pedacos do setor ANTERIOR costurados no novo.
  for (let i = 0; i < state.chunkVersion.length; i++) state.chunkVersion[i] += 1;

  state.enemies = [];
  state.projectiles = [];
  state.charges = [];
  state.reactionQueue = [];
  state.vents = world.ventPositions.map((p) => ({ x: p.x, y: p.y, nextEmitAt: 0 }));
  state.salvageSites = world.salvageSites.map((site) => ({
    ...site,
    terminalState: 'inactive' as const,
    scanEndsAt: 0,
    cacheRevealed: false,
    cacheOpened: false,
    openedBySlot: null,
  }));

  // Os Ecos do poco ficaram no mapa antigo, e a ressonancia descrevia o setor que
  // acabou de ser trocado. Levar qualquer um dos dois adiante faria o poco do
  // setor 2 oferecer o estilo com que o jogador atravessou o setor 1.
  state.wellOffers = [];
  for (const extra of state.playerExtras) extra.resonance = emptyResonance();

  state.guardianAwake = false;
  state.guardianSummoned = false;
  state.arenaClosed = false;
  state.arenaBarrierCells = [];
  state.guardianPath = [];
  state.guardianPathAt = -1000;
  state.leftEntryZone = false;

  // A contaminacao NAO zera. Descer alivia, nunca absolve: comecar limpo faria
  // do poco um botao de reset e destruiria a pressao que da sentido a decisao
  // de explorar mais antes de descer.
  state.contamination = Math.min(1, state.contamination * CONTAMINATION_CARRYOVER);
  state.contaminationWaves = 0;

  const offsets = [
    { x: 0.5, y: 0.5 },
    { x: 1.5, y: 0.5 },
  ];
  for (let slot = 0; slot < state.players.length; slot++) {
    const player = state.players[slot];
    const extra = state.playerExtras[slot];
    const offset = offsets[slot] ?? offsets[0];
    player.x = world.entry.x + offset.x;
    player.y = world.entry.y + offset.y;
    player.vx = 0;
    player.vy = 0;
    player.stunnedUntil = 0;
    player.alertedUntil = 0;
    player.action = undefined;
    // Quem chegou abatido no poco desce de pe. O parceiro ja pagou o resgate ao
    // arrasta-lo ate aqui, e manter o abatido do outro lado significaria
    // sangrar num mapa que ele nem viu.
    if (extra.downed && player.alive) {
      extra.downed = false;
      player.hp = Math.max(player.hp, Math.floor(player.maxHp * 0.35));
    }
    extra.heat = 0;
    extra.overheatedUntil = 0;
    extra.dodgeUntil = 0;
    extra.iframesUntil = 0;
    extra.pendingModuleChoice = null;
  }

  populateSector(state, world.enemySpawns, world.guardianSpawn);
  events.push({ t: 'sector_entered', sector: state.sector, final: isFinalSector(state.sector) });
};

/** Celula do poco/nucleo esta livre? Usado so por testes e diagnostico. */
export const descentPointOpen = (state: SurvivalState): boolean =>
  state.solid[state.corePos.y * state.config.width + state.corePos.x] === SOLID_NONE;

/** Chunks por linha; util a quem itera versoes de chunk. */
export const chunksPerRow = (width: number): number => Math.ceil(width / CHUNK);
