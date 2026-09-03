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
// E a POSICAO decide se ha chefe, nunca quem ele e: ver `sectorHoldsBoss`. Um
// chefe em cada setor fragmentaria a descida numa fila de paradas obrigatorias,
// entao so o ultimo setor e os setores de NUCLEO tem dono — os demais continuam
// com a fauna de assinatura como identidade. O primeiro setor NUNCA tem chefe:
// e onde a run ensina, nao onde cobra.
//
// Numa run de tres setores isso da exatamente o que sempre deu: um chefe, no
// terceiro. E de G-03 em diante da dois, porque de G-03 em diante ha dois
// Nucleos, e um Nucleo sem selo nao e um objetivo.
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
  collapseCells: [],
  modulesExposed: 0,
  modulesLost: 0,
  leapToX: 0,
  leapToY: 0,
  leapsLeft: 0,
  // -1 pelo mesmo motivo que `delugeAt`: zero e um tick legitimo, e uma camara
  // que nascesse com `mawOpenedAt = 0` comecaria com a boca do Devorador ja
  // aberta e ja puxando — num tick em que ele ainda esta por baixo da areia.
  mawOpenedAt: -1,
  // -1 e "o Diluvio nunca aconteceu", e tem de ser negativo e nao zero: zero e
  // um tick legitimo, e um encontro que comecasse com `delugeAt = 0` nasceria
  // com o setor ja submerso.
  delugeAt: -1,
  delugeX: 0,
  delugeY: 0,
  leviathanShockAt: -1,
  leviathanShockRecoverAt: -1,
  leviathanShockSeq: 0,
  protectiveBubbles: [],
  frostArmored: -1,
  archcantorSilent: false,
  // Quatro assentos VAZIOS, e nao quatro ids inventados: nenhuma entidade tem
  // id 0 (`nextEntityId` nasce em `playerCount + 1`), entao zero e um "assento
  // sem dono" que nao pode colidir com ninguem. Um array proprio por encontro
  // pelo mesmo motivo de `path`: um literal congelado no modulo faria o coro do
  // setor 5 herdar os guardas mortos do setor 3.
  choir: [0, 0, 0, 0],
  choirRotation: 0,
  choirPattern: 0,
  // Zero e "a danca ainda nao comecou". Quem a inicia e a formacao inicial, e
  // e ela que carimba o primeiro prazo — sem isso o primeiro tick acordado ja
  // giraria a formacao antes de ela existir.
  choirRotateAt: 0,
  choirRecruitAt: 0,
  drillObstructedAt: -1,
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
   * Profundidade do setor (1..MAX_LINEAGE_SECTORS). Hoje nao muda a ESCOLHA — quem
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

/**
 * O arquetipo que a camara do bioma recebe HOJE, ou `null`.
 *
 * `null` e uma resposta legitima e nao um erro: a tabela conceitual de chefes
 * (`BossId`) e um espaco aberto, e um chefe novo entra nela antes de ganhar
 * corpo. Ate la a camara dele fica VAZIA — nao ocupada pelo Guardiao.
 *
 * O fallback universal no Guardiao saiu de proposito. Ele era invisivel: uma
 * linha da tabela sem arquetipo passava a rodar como Galerias de Basalto em
 * todo bioma que a herdasse, e o defeito aparecia como "por que a Catedral tem
 * um Guardiao" meses depois. Com `null`, o portal do setor simplesmente segue a
 * regra normal de disponibilidade e nada finge estar implementado.
 */
export const bossArchetypeForBiome = (biome: SectorBiome): EnemyArchetype | null =>
  IMPLEMENTED_BOSS[bossForBiome(biome)] ?? null;

/** De onde veio a autoridade do chefe deste setor. */
export type SectorBossSource = 'stratum' | 'occupation' | 'lineage' | 'special';

export type SectorBossDefinition = {
  /** A identidade conceitual — existe mesmo quando o corpo ainda nao existe. */
  boss: BossId;
  /** O corpo que vai nascer na camara. `null` = conceito sem arquetipo ainda. */
  archetype: EnemyArchetype | null;
  source: SectorBossSource;
};

/**
 * Este setor GUARDA alguma coisa? — a regra de posicao, sem olhar o bioma.
 *
 * Duas linhas, e as duas dizem a mesma coisa por dois motivos diferentes:
 *
 * - o ULTIMO setor da run tem chefe porque e o fundo, e o fundo e onde a
 *   descida cobra o que prometeu;
 * - um setor de NUCLEO tem chefe porque o Nucleo esta selado, e o selo precisa
 *   de um dono. Um pedestal que qualquer um alcanca nao e um objetivo, e uma
 *   parada.
 *
 * O setor 1 nunca tem chefe, e a excecao vem antes das duas: e onde a run
 * ensina, nao onde ela cobra. (Nenhuma geracao poe Nucleo no setor 1, entao a
 * guarda e redundante hoje — ela existe para continuar verdadeira se alguem
 * mudar a tabela de Nucleos.)
 *
 * Consequencia por geracao, que e o desenho inteiro numa tabela:
 *
 *   G-00/G-01  3 setores  chefe no 3               (identico ao historico)
 *   G-02       4 setores  chefe no 4
 *   G-03       5 setores  chefes no 3 e no 5
 *   G-04       7 setores  chefes no 3 e no 7
 */
export const sectorHoldsBoss = (
  sector: number,
  sectorCount: number,
  coreSectors: readonly number[],
): boolean => {
  if (sector <= 1) return false;
  if (sector > sectorCount) return false;
  return sector === sectorCount || coreSectors.includes(sector);
};

/**
 * O chefe do setor N de uma run, resolvido de forma DETERMINISTICA.
 *
 * Puro em (linhagem, posicao, profundidade congelada): nao consome RNG, nao
 * olha o estado e nao depende de o jogador ja ter estado la. E o que permite ao
 * cliente que reconecta no setor 6 saber quem mora ali antes do primeiro tick,
 * e ao replay reproduzir a mesma camara.
 *
 * Recebe `biomeAt` e nao um bioma solto porque a resolucao e da RUN INTEIRA, e
 * nao de um setor isolado: com dois setores de chefe, quem mora num deles
 * depende de quem mora no outro (ver `UM CHEFE POR RUN` abaixo).
 *
 * A ESCOLHA base continua sendo `bossForBiome` — ocupacao forte primeiro,
 * depois o dono do estrato. A posicao decide SE ha chefe; o bioma decide QUEM.
 */
export const bossForSector = (
  biomeAt: (sector: number) => SectorBiome,
  sector: number,
  sectorCount: number,
  coreSectors: readonly number[],
): SectorBossDefinition | null => {
  if (!sectorHoldsBoss(sector, sectorCount, coreSectors)) return null;

  const biome = biomeAt(sector);
  const primary = bossForBiome(biome);
  const source: SectorBossSource = BOSS_OF_OCCUPATION[biome.occupation] ? 'occupation' : 'stratum';

  // ---------------------------------------------------------------------
  // UM CHEFE POR RUN
  // ---------------------------------------------------------------------
  // O setor MAIS FUNDO fica com o dono do proprio bioma, sempre. Ele e o
  // climax da descida e nao cede nada a ninguem.
  const deepest = deepestBossSector(sectorCount, coreSectors);
  if (sector >= deepest) return { boss: primary, archetype: archetypeOf(primary), source };

  // Um setor de chefe RASO que repetiria o dono do fundo cede o posto.
  //
  // Sem esta regra, 38% das runs de G-04 enfrentavam o MESMO chefe duas vezes,
  // e em algumas linhagens quase metade: o setor 3 e o setor 7 costumam ser o
  // mesmo estrato (uma linhagem arida e silica do meio ao fim — e o que a faz
  // arida), e duas intrusoes Aurix produzem dois Diamandis. Repetir o encontro
  // mais caro da run e a forma mais barata de gastar a profundidade que a
  // geracao acabou de autorizar.
  const deepBoss = bossForBiome(biomeAt(deepest));
  if (primary !== deepBoss) return { boss: primary, archetype: archetypeOf(primary), source };

  for (const alternate of alternatesFor(biome)) {
    if (alternate === deepBoss) continue;
    // `special` e a marca de que este dono nao saiu da leitura normal do mapa:
    // ele esta aqui porque o fundo ja tinha o dono natural. Sem a marca, uma
    // Catedral com Bispo no setor 3 leria como defeito de tabela.
    return { boss: alternate, archetype: archetypeOf(alternate), source: 'special' };
  }

  // Inalcancavel com as tabelas atuais (ha sempre um alternado diferente), e
  // por isso NAO ha invencao aqui: repetir o dono e melhor que servir um chefe
  // que o bioma nao explica.
  return { boss: primary, archetype: archetypeOf(primary), source };
};

/** O setor de chefe mais fundo da run — o que nunca cede o posto. */
const deepestBossSector = (sectorCount: number, coreSectors: readonly number[]): number => {
  let deepest = 0;
  for (let sector = 1; sector <= sectorCount; sector++) {
    if (sectorHoldsBoss(sector, sectorCount, coreSectors)) deepest = sector;
  }
  return deepest;
};

/**
 * Para quem o setor raso cede, em ordem de preferencia.
 *
 * - Com OCUPACAO forte, o alternado e o chefe do ESTRATO: a cicatriz cede ao
 *   veio. E o caso mais legivel — as duas camadas do bioma ja estao ali, e o
 *   fundo fica com a de cima.
 * - SEM ocupacao, o estrato ja e a unica leitura natural e ela esta tomada.
 *   Ai a camara do Nucleo intermediario e uma camara TOMADA: a Matriz ou a
 *   Aurix chegaram nela primeiro, que e a mesma gramatica das intrusoes e
 *   explica por que aquele pedestal especificamente esta selado.
 *
 * O terreno NAO muda por causa disto: `sectorBiome` continua puro em
 * (seed, setor), e o que se escolhe aqui e o ocupante da camara. Um Bispo traz
 * o proprio bolso micelial ao nascer (ver populateSector), que e exatamente o
 * quanto de mundo o encontro precisa.
 */
const alternatesFor = (biome: SectorBiome): readonly BossId[] => {
  const occupied = BOSS_OF_OCCUPATION[biome.occupation];
  if (occupied) return [BOSS_OF_STRATUM[biome.stratum]];
  return [BOSS_OF_OCCUPATION.mycelial as BossId, BOSS_OF_OCCUPATION.aurix as BossId];
};

const archetypeOf = (boss: BossId): EnemyArchetype | null => IMPLEMENTED_BOSS[boss] ?? null;
