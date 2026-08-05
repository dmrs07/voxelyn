// A PROFUNDIDADE de uma run, e as tres perguntas que ela responde.
//
// Este arquivo existe porque a resposta a "quantos setores tem esta descida"
// deixou de ser uma constante e virou dado da run. Enquanto era `SECTOR_COUNT`,
// qualquer arquivo podia perguntar de qualquer lugar e ninguem precisava ter a
// run em maos; agora a pergunta so tem sentido contra uma configuracao
// congelada, e um lugar so tem de saber le-la.
//
// Ter UM lugar e o ponto inteiro. A alternativa — cada consumidor derivando o
// que precisa de `state.config.depth` — e como o `SECTOR_COUNT` se espalhou por
// cem chamadas: cada uma correta, o conjunto impossivel de mudar. As tres
// perguntas que o jogo faz de verdade sao:
//
//   1. este e o ultimo setor?                 -> isFinalSector / isRunFinalSector
//   2. ha Nucleo aqui, e ja foi recolhido?    -> hasCoreInSector / isCoreTaken
//   3. o selo deste setor ja cedeu?           -> descentUnlocked / coreUnlocked
//
// Tudo aqui e funcao PURA do estado: nenhuma consulta ao perfil, nenhuma RNG,
// nenhuma escrita fora dos dois `mark*`. E o que permite ao cliente responder
// as mesmas perguntas com o mesmo codigo.

import { MAX_LINEAGE_SECTORS } from './constants.js';
import { DEFAULT_RUN_DEPTH, type RunDepthConfig } from './progression.js';
import { bossForSector, sectorHoldsBoss } from './bosses.js';
import { sectorBiome } from './strata.js';
import type { SectorBossState, SurvivalState } from './types.js';

/** A profundidade congelada da run. Nunca reconsultada no perfil. */
export const runDepth = (state: SurvivalState): RunDepthConfig =>
  state.config.depth ?? DEFAULT_RUN_DEPTH;

export const runSectorCount = (state: SurvivalState): number => runDepth(state).sectorCount;

/**
 * O setor N e o ultimo de uma run de `sectorCount` setores?
 *
 * Recebe o total em vez de fecha-lo sobre uma constante — que era exatamente o
 * defeito da versao anterior. `>=` e nao `===` de proposito: um setor fora do
 * limite (estado corrompido, snapshot de outra versao) tem de ler como fim de
 * descida e nao como "ha mais Veio adiante", que travaria a run sem saida.
 */
export const isFinalSector = (sector: number, sectorCount: number): boolean =>
  sector >= sectorCount;

export const isRunFinalSector = (state: SurvivalState): boolean =>
  isFinalSector(state.sector, runSectorCount(state));

// ---------------------------------------------------------------------------
// NUCLEOS
// ---------------------------------------------------------------------------

/** Este setor tem pedestal? Lido da configuracao congelada, nunca sorteado. */
export const hasCoreInSector = (state: SurvivalState, sector: number): boolean =>
  runDepth(state).coreSectors.includes(sector);

export const hasCoreHere = (state: SurvivalState): boolean =>
  hasCoreInSector(state, state.sector);

/** O Nucleo do setor N ja saiu do pedestal? */
export const isCoreTaken = (state: SurvivalState, sector: number): boolean =>
  (state.coresTakenMask & coreBit(sector)) !== 0;

export const markCoreTaken = (state: SurvivalState, sector: number): void => {
  state.coresTakenMask |= coreBit(sector);
};

/**
 * Devolve o Nucleo do setor N ao pedestal.
 *
 * Acontece quando o portador cai: o Nucleo nao some com ele, fica recuperavel
 * — pelo parceiro no co-op, ou por uma segunda descida. Sem isto a morte do
 * portador tornaria o objetivo da run inalcancavel sem nenhum aviso.
 */
export const clearCoreTaken = (state: SurvivalState, sector: number): void => {
  state.coresTakenMask &= ~coreBit(sector);
};

/** Quantos Nucleos estao NA CARGA agora. */
export const countCoresTaken = (state: SurvivalState): number =>
  popcount(state.coresTakenMask);

/** Quantos Nucleos esta run pode render, no maximo. */
export const coresAvailable = (state: SurvivalState): number =>
  runDepth(state).coreSectors.length;

/**
 * O Nucleo MAIS FUNDO da run — o que sela o poco quando sai do pedestal.
 *
 * Enquanto havia um Nucleo so, "com o Nucleo na mao o poco selou" e "chegou ao
 * fundo" eram a mesma frase. Com dois deixaram de ser: pegar o intermediario e
 * uma decisao no meio da descida, e sela-lo ali prenderia o jogador acima da
 * metade da run que ele pagou para ver. Quem sela e este.
 */
export const deepestCoreSector = (state: SurvivalState): number => {
  const cores = runDepth(state).coreSectors;
  return cores.length === 0 ? runSectorCount(state) : Math.max(...cores);
};

/** A run entrou no caminho de VOLTA: o Nucleo do fundo ja esta com o time. */
export const runIsReturning = (state: SurvivalState): boolean =>
  isCoreTaken(state, deepestCoreSector(state));

// ---------------------------------------------------------------------------
// CHEFE DO SETOR E SELOS
// ---------------------------------------------------------------------------

/** O chefe que o setor N desta run deveria ter, resolvido do zero. */
export const resolveSectorBoss = (state: SurvivalState, sector: number): SectorBossState => {
  const depth = runDepth(state);
  const definition = bossForSector(
    sectorBiome(state.config.seed, sector),
    sector,
    depth.sectorCount,
    depth.coreSectors,
  );
  return {
    archetype: definition?.archetype ?? null,
    entityId: null,
    // Chefe abatido nao volta. A marca vive na mascara justamente porque o
    // setor e REGENERADO na subida: sem ela, quem matou o dono para descer o
    // encontrava inteiro na volta.
    defeated: sectorBossDefeated(state, sector),
  };
};

export const sectorBossDefeated = (state: SurvivalState, sector: number): boolean =>
  (state.bossesDownMask & coreBit(sector)) !== 0;

/**
 * O chefe do setor N caiu.
 *
 * Escreve a MASCARA (que sobrevive a regeneracao do setor na subida) e, quando
 * o setor e o atual, o estado generico junto. Os dois numa funcao so porque
 * eles sao a mesma verdade contada em duas escalas: separa-los foi o que
 * permitiu, na versao anterior, marcar a mascara e esquecer o portal.
 */
export const markSectorBossDown = (state: SurvivalState, sector: number): void => {
  state.bossesDownMask |= coreBit(sector);
  if (sector === state.sector) {
    state.sectorBoss.entityId = null;
    state.sectorBoss.defeated = true;
  }
};

/** Ha dono neste setor? Um setor sem dono nunca bloqueia nada. */
export const sectorHasBoss = (state: SurvivalState): boolean =>
  state.sectorBoss.archetype !== null;

/**
 * O poco/portal deste setor aceita interacao?
 *
 *   portalUnlocked = !sectorHasBoss || sectorBossDefeated
 *
 * A regra e so isto, e o que ela NAO diz importa tanto quanto o que diz: nao
 * exige limpar o setor, nao exige o Nucleo, nao inventa chefe onde nao ha. Um
 * setor sem dono continua descendo pela disponibilidade normal — a mesma de
 * antes desta mudanca.
 */
export const descentUnlocked = (state: SurvivalState): boolean =>
  !sectorHasBoss(state) || state.sectorBoss.defeated;

/**
 * O pedestal deste setor aceita a mao?
 *
 *   coreUnlocked = sectorHasCore && (!sectorHasBoss || sectorBossDefeated)
 *
 * Mesmo selo, mesmo dono: quando portal e Nucleo dividem o setor, a mesma morte
 * abre os dois. Antes dela o Nucleo continua VISIVEL — selado nao e escondido;
 * o jogador tem de ver o que o chefe esta guardando.
 */
export const coreUnlocked = (state: SurvivalState): boolean =>
  hasCoreHere(state) && descentUnlocked(state);

/** Este setor guarda alguma coisa, pela regra de posicao? */
export const sectorIsSealed = (state: SurvivalState, sector: number): boolean => {
  const depth = runDepth(state);
  return sectorHoldsBoss(sector, depth.sectorCount, depth.coreSectors);
};

const coreBit = (sector: number): number => {
  // Fora da faixa vira bit 0, que nenhum setor usa (os setores comecam em 1):
  // um indice invalido nunca pode acender por acidente a marca de outro setor.
  if (!Number.isInteger(sector) || sector < 1 || sector > MAX_LINEAGE_SECTORS) return 0;
  return 1 << sector;
};

const popcount = (mask: number): number => {
  let n = mask >>> 0;
  let count = 0;
  while (n !== 0) {
    n &= n - 1;
    count++;
  }
  return count;
};
