// Chefes por ESTRATO e OCUPACAO — nunca mais por numero de setor.
//
// A regra antiga era posicional: Bispo no setor 2, Guardiao no setor 3,
// qualquer que fosse a geologia. Uma Catedral Prismatica terminava no mesmo
// Guardiao de basalto, e o Bispo aparecia em mapas onde o micelio era um
// enxerto plantado a forca para a luta dele existir.
//
// A regra nova le o MAPA:
//
// 1. Uma ocupacao forte substitui o chefe do estrato (a Matriz Micelial traz o
//    Bispo; a Cicatriz Aurix traz o Diamandis).
// 2. Sem ocupacao dominante, entra o chefe natural do estrato.
//
// E ha UM chefe por run, no setor FINAL da linhagem. Um chefe em cada setor
// fragmentaria toda descida em tres paradas obrigatorias; os setores anteriores
// continuam com a fauna de assinatura como identidade. O primeiro setor NUNCA
// tem chefe: e onde a run ensina, nao onde cobra.
//
// A tabela completa (a maioria ainda por implementar — ver IMPLEMENTED_BOSS):
//
//   Ocupacao  Contaminacao Micelial   -> Bispo
//   Ocupacao  Cicatriz Aurix          -> Diamandis
//   Estrato   Galerias de Basalto     -> Guardiao
//   Estrato   Catedral Prismatica     -> Arquicantor
//   Estrato   Aquifero Negro          -> Leviata do Lencol
//   Estrato   Fenda Sulfurosa         -> Pulmao-Matriz
//   Estrato   Fornalha Abissal        -> Coracao da Fornalha
//   Estrato   Sumidouros de Silica    -> Devorador Branco
//   Estrato   Cripta Glacial          -> Rainha da Geada
//   Estrato   Estrato Ferrifero       -> Magnetarca

import type { BossRuntime, EnemyArchetype } from './types.js';
import type { OccupationId, SectorBiome, StratumId } from './strata.js';

/**
 * O estado de encontro de um setor que ainda nao comecou.
 *
 * Uma fabrica e nao um literal compartilhado: `path` e `arenaBarrierCells` sao
 * arrays mutaveis, e um objeto congelado no modulo faria a descida do setor 2
 * herdar a rota do setor 1 — pior, faria duas salas de co-op escreverem no
 * mesmo array. `pathAt` nasce bem no passado para a primeira busca de rota
 * nunca parecer recente.
 */
export const emptyBossRuntime = (): BossRuntime => ({
  awake: false,
  phasesFired: 0,
  path: [],
  pathAt: -1000,
  arenaClosed: false,
  arenaBarrierCells: [],
  blastCells: [],
  modulesExposed: 0,
  modulesLost: 0,
  leapToX: 0,
  leapToY: 0,
  leapsLeft: 0,
});

/**
 * A identidade CONCEITUAL de cada chefe. Distinta de EnemyArchetype de
 * proposito: a tabela de chefes e completa desde ja (todo bioma sabe quem e o
 * dono), enquanto os arquetipos entram um a um. Manter os dois espacos
 * separados e o que permite que a selecao, os documentos e o codex falem do
 * Diamandis antes de o Diamandis lutar.
 */
export type BossId =
  | 'bishop'
  | 'guardian'
  | 'diamandis'
  | 'archcantor'
  | 'sheet_leviathan'
  | 'lung_matrix'
  | 'furnace_heart'
  | 'white_devourer'
  | 'frost_queen'
  | 'magnetarch';

/** Ocupacoes FORTES: quem tomou o mapa manda no encontro final. */
export const BOSS_OF_OCCUPATION: Partial<Record<OccupationId, BossId>> = {
  mycelial: 'bishop',
  aurix: 'diamandis',
};

/** O chefe natural de cada estrato, quando nenhuma ocupacao domina. */
export const BOSS_OF_STRATUM: Record<StratumId, BossId> = {
  basalt: 'guardian',
  prismatic: 'archcantor',
  aquifer: 'sheet_leviathan',
  sulfur: 'lung_matrix',
  furnace: 'furnace_heart',
  silica: 'white_devourer',
  glacial: 'frost_queen',
  ferric: 'magnetarch',
};

export type BossBiome = {
  stratum: StratumId;
  occupation: OccupationId;
  /**
   * Profundidade do setor (1..SECTOR_COUNT). Hoje nao muda a ESCOLHA — quem
   * escolhe e a dupla estrato x ocupacao — mas viaja na assinatura porque e o
   * eixo natural de tuning futuro (fase extra, vida, elite) e mudar a
   * assinatura depois cobraria de todo chamador.
   */
  depth?: number;
};

/** Prioridade: ocupacao forte primeiro; sem ela, o chefe do estrato. */
export const bossForBiome = ({ stratum, occupation }: BossBiome): BossId =>
  BOSS_OF_OCCUPATION[occupation] ?? BOSS_OF_STRATUM[stratum];

/**
 * Os chefes que JA EXISTEM como arquetipo de simulacao.
 *
 * A tabela esta COMPLETA: todo bioma tem o proprio dono, e o fallback no
 * Guardiao — que sustentou a selecao enquanto a lista era parcial — nao
 * responde mais por nenhuma linha. Ele continua no codigo porque `BossId` e um
 * espaco aberto: um chefe conceitual novo entra na tabela antes de ganhar
 * corpo, e ate la a camara dele nao pode ficar vazia.
 */
export const IMPLEMENTED_BOSS: Partial<Record<BossId, EnemyArchetype>> = {
  bishop: 'bishop',
  guardian: 'guardian',
  diamandis: 'diamandis',
  white_devourer: 'white_devourer',
  archcantor: 'archcantor',
  sheet_leviathan: 'sheet_leviathan',
  lung_matrix: 'lung_matrix',
  furnace_heart: 'furnace_heart',
  frost_queen: 'frost_queen',
  magnetarch: 'magnetarch',
};

/**
 * Os arquetipos que HOJE ocupam uma camara de chefe. DERIVADO de
 * `IMPLEMENTED_BOSS`, e nao uma segunda lista: toda vez que um chefe da tabela
 * ganhava corpo, quem enumerava `'guardian' || 'bishop'` a mao passava a
 * mentir em silencio — e quem enumerava eram os testes de alcancabilidade da
 * camara, ou seja, justamente a rede que devia pegar o chefe novo preso numa
 * parede.
 */
export const BOSS_ARCHETYPES: readonly EnemyArchetype[] = [
  ...new Set(Object.values(IMPLEMENTED_BOSS)),
];

export const isBossArchetype = (archetype: EnemyArchetype | 'prospector'): boolean =>
  BOSS_ARCHETYPES.includes(archetype as EnemyArchetype);

/** O arquetipo que a camara final do bioma recebe HOJE. */
export const bossArchetypeForBiome = (biome: SectorBiome): EnemyArchetype =>
  IMPLEMENTED_BOSS[bossForBiome(biome)] ?? 'guardian';
