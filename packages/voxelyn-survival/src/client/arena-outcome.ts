// Deteccao de FIM DE LUTA na arena — separado de `state.phase`.
//
// A sim so termina uma run por MORTE ou EXTRACAO: matar o chefe do setor
// apenas marca `sectorBoss.defeated` e libera o poco/portal, porque no jogo
// real a run continua (descer mais fundo, recolher o Nucleo, extrair). A
// arena nao tem "mais fundo": ela existe para testar UMA luta isolada, e sem
// uma condicao terminal propria o testador venceria o chefe e continuaria
// preso na tela, sem resumo, sem retry, sem nada registrado.
//
// Funcao PURA e testavel sem DOM/rAF de proposito: `arena-main.ts` so chama
// isto a cada tick e para de simular no primeiro resultado nao-nulo.
import type { SurvivalState } from '@voxelyn/survival-sim';
import type { ArenaBossId } from './arena-catalog';

export type ArenaOutcome = 'victory' | 'defeat' | 'abandoned';

/**
 * Devolve o desfecho da arena se um ja se decidiu neste `state`, ou `null`
 * enquanto a luta continua.
 *
 * A ORDEM importa: `phase !== 'running'` e o sinal mais forte que a sim
 * produz (o Prospector caiu, ou — fora do fluxo normal da arena, mas possivel
 * se o testador insistir em interagir no poco apos vencer — a run extraiu),
 * e por isso e checado primeiro. So depois, com o jogador de pe, e que faz
 * sentido perguntar se o DONO do setor caiu: um chefe derrotado no MESMO tick
 * em que o jogador tambem caiu (dano simultaneo) e derrota, nao vitoria — o
 * Prospector nao esta la para comemorar.
 */
export const arenaOutcomeFor = (state: SurvivalState, boss: ArenaBossId): ArenaOutcome | null => {
  if (state.phase === 'dead') return 'defeat';
  // 'extracted' / 'extracted_with_core': fora do caminho que a arena pretende
  // exercitar (ela nao desce nem sobe setor), mas alcancavel se o testador
  // interagir no poco depois de vencer. Tratado como limpeza do setor: o
  // chefe nao guarda mais nada, e nao ha "derrota" nenhuma para relatar.
  if (state.phase !== 'running') return 'victory';
  if (state.sectorBoss.archetype === boss && state.sectorBoss.defeated) return 'victory';
  return null;
};
