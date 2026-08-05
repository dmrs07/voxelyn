// Contadores da run e o resultado congelado que sai dela.
//
// Tudo aqui e DESCRITIVO: nada realimenta a simulacao. Ainda assim vive na sim,
// e nao no cliente, por duas razoes que se reforcam:
//
// 1. Um cliente que conta os proprios abates conta o que quiser. O leaderboard
//    depende de que estes numeros venham de quem simula.
// 2. Reconstruir contagem a partir de eventos e adivinhacao com cara de
//    precisao. `hit` nao diz se o alvo morreu; `death` nao diz de quem foi o
//    golpe; nenhum dos dois sobrevive a uma reconexao no meio da run.

import {
  DISCOVERY_BISHOP_FELLED,
  DISCOVERY_CORE_TAKEN,
  DISCOVERY_GUARDIAN_FELLED,
  DISCOVERY_HORSE_FELLED,
  type DamageCause,
  type EnemyArchetype,
  type RunPhase,
  type RunStats,
  type RunSummary,
  type SurvivalState,
} from './types.js';
import { SECTOR_COUNT, TICK_HZ } from './constants.js';

/**
 * Tempo, em ticks, abaixo do qual a terceira estrela e concedida.
 *
 * Derivado do numero de setores (4 min cada) e nao um numero solto: a run
 * mudou de um mapa para tres encadeados, e um alvo fixo passaria a significar
 * coisas diferentes se SECTOR_COUNT mudasse.
 *
 * O numero e uma aposta de design explicita: a terceira estrela tem de exigir
 * que o jogador ABRA MAO de alguma coisa — um site de salvage a mais, um modulo
 * melhor, a rota segura — porque e exatamente a tensao que a spec chama de
 * "extrair agora ou arriscar" (secao 1). Um alvo folgado premiaria a run que
 * pega tudo, que e a run sem decisao.
 *
 * Precisa de calibragem por playtest; e o unico numero deste arquivo que se
 * espera mexer.
 */
export const TARGET_SECTOR_TICKS = 4 * 60 * TICK_HZ;
export const TARGET_EXTRACTION_TICKS = TARGET_SECTOR_TICKS * SECTOR_COUNT;

export const emptyStats = (): RunStats => ({
  shotsFired: 0,
  kills: {
    stalker: 0, bruiser: 0, spitter: 0, bomber: 0, guardian: 0, bishop: 0, fungal_horse: 0, miner: 0,
    resonant: 0, mud_lamprey: 0, bellows: 0, scoriac: 0, frost_wraith: 0,
    sulfur_bomber: 0, undertaker: 0, diamandis: 0,
  },
  damageTakenTenths: 0,
  damageDealtTenths: 0,
  solidsDestroyed: 0,
  salvageCompleted: 0,
  modulesAcquired: 0,
  purgeCellsUsed: 0,
  timesDowned: 0,
  revivesGiven: 0,
  oreCollected: 0,
  innocentsKilled: 0,
  discoveries: 0,
});

/**
 * Acumula dano em DECIMOS INTEIROS.
 *
 * Somar floats direto seria o caminho obvio e quebraria o determinismo pelo
 * qual o resto da simulacao paga caro: `0.1 + 0.2 !== 0.3`, e o dano de fogo
 * (2,2 por tick) entra centenas de vezes por run. Duas maquinas que aplicam os
 * mesmos danos em ordens ligeiramente diferentes chegariam a totais diferentes,
 * o hash divergiria e o co-op pediria resync por causa de um contador que nao
 * afeta nada.
 */
export const addDamageTenths = (current: number, amount: number): number =>
  current + Math.round(Math.max(0, amount) * 10);

export const recordKill = (stats: RunStats, archetype: EnemyArchetype): void => {
  stats.kills[archetype] += 1;
  if (archetype === 'guardian') stats.discoveries |= DISCOVERY_GUARDIAN_FELLED;
  if (archetype === 'bishop') stats.discoveries |= DISCOVERY_BISHOP_FELLED;
  if (archetype === 'fungal_horse') stats.discoveries |= DISCOVERY_HORSE_FELLED;
};

export const markDiscovery = (stats: RunStats, bit: number): void => {
  stats.discoveries |= bit;
};

/**
 * As tres estrelas.
 *
 * A escada e de INTENCAO, nao de dificuldade bruta:
 *
 *   1  sobreviveu           — voce saiu vivo do Veio
 *   2  saiu com o nucleo    — voce foi ate o fundo e voltou
 *   3  com o nucleo, no tempo — voce foi ate o fundo, voltou, e nao se demorou
 *
 * Morrer nao da estrela nenhuma, e extrair de maos vazias da uma: as duas coisas
 * sao resultados, mas so uma delas e uma run cumprida.
 *
 * A terceira nao adiciona um objetivo novo — ela cobra o mesmo objetivo com
 * pressa. E o que mantem a decisao "extrair agora ou arriscar" viva depois que o
 * jogador ja aprendeu o mapa: com tempo infinito, pegar tudo e sempre certo.
 */
export const starsFor = (phase: RunPhase, ticks: number, targetTicks: number): 0 | 1 | 2 | 3 => {
  if (phase === 'extracted_with_core') return ticks <= targetTicks ? 3 : 2;
  if (phase === 'extracted') return 1;
  return 0;
};

/** Congela o resultado. Chamado uma vez, no tick em que a run termina. */
export const buildSummary = (state: SurvivalState, deathCause: DamageCause | null): RunSummary => {
  const stats: RunStats = { ...state.stats, kills: { ...state.stats.kills } };
  if (state.coreTaken || state.players.some((_, i) => state.playerExtras[i].hasCore)) {
    stats.discoveries |= DISCOVERY_CORE_TAKEN;
  }
  return {
    seed: state.config.seed,
    phase: state.phase,
    ticks: state.tick,
    contamination: state.contamination,
    // Extracao nao tem causa de morte, mesmo que o jogador tenha levado dano no
    // ultimo segundo: o campo responde "o que te matou", nao "o que te acertou".
    deathCause: state.phase === 'dead' ? deathCause : null,
    stats,
    stars: starsFor(state.phase, state.tick, TARGET_EXTRACTION_TICKS),
    targetTicks: TARGET_EXTRACTION_TICKS,
  };
};
