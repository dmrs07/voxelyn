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

import type { EnemyArchetype } from './types.js';
import type { OccupationId, SectorBiome, StratumId } from './strata.js';

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
 * Os chefes que JA EXISTEM como arquetipo de simulacao. Os demais caem no
 * Guardiao — um fallback jogavel e honesto (ele e o chefe-base do jogo), que
 * some sozinho conforme cada linha da tabela ganhar corpo. Ordem recomendada
 * de implementacao: Diamandis (usa pecas que o jogo ja tem — pedra, parede,
 * calor, Coveiros), depois o Devorador Branco.
 */
export const IMPLEMENTED_BOSS: Partial<Record<BossId, EnemyArchetype>> = {
  bishop: 'bishop',
  guardian: 'guardian',
};

/** O arquetipo que a camara final do bioma recebe HOJE. */
export const bossArchetypeForBiome = (biome: SectorBiome): EnemyArchetype =>
  IMPLEMENTED_BOSS[bossForBiome(biome)] ?? 'guardian';
