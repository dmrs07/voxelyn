// O CAMPO DO MAGNETARCA — a leitura do encontro, em funcoes puras.
//
// Tudo aqui e funcao pura de (tick, prazo da inversao, humor). Nenhum estado,
// nenhum evento, nenhuma celula escrita: a simulacao cobra por estas contas e o
// cliente desenha por AS MESMAS.
//
// Por que separado de `entities.ts`, e por que exportado: a faixa e a coisa que
// o encontro pede que o jogador leia, e ela e feita de tres numeros que mudam a
// cada tick (a polaridade, a borda que cobra agora e quanto falta para trocar
// de lado). Transmitir o desenho seria mandar o que as duas pontas ja sabem
// calcular — e abriria a chance de o anel desenhado discordar do anel que
// machuca. Um anel meio tile fora de lugar e uma mentira sobre a UNICA coisa
// que esta luta pede que se leia.
//
// O que a simulacao manda e o unico dado que ela sozinha conhece: o TICK em que
// a polaridade vira (`bossRuntime.magnetFlipAt`) e o humor do corpo, que ja
// viaja com qualquer inimigo. Dali para a frente as duas pontas derivam o mesmo
// campo com as mesmas constantes.

import {
  MAGNETARCH_CRUSH_RANGE,
  MAGNETARCH_CYCLE_TICKS,
  MAGNETARCH_FIELD_RANGE,
  MAGNETARCH_FLIP_WINDUP_TICKS,
  MAGNETARCH_TETHER_RANGE,
} from './constants.js';
import { MAGNET_ATTRACT } from './types.js';

/** As duas polaridades, mais a folga em que nao vale nenhuma das duas. */
export type MagnetPolarity = 'attract' | 'repel' | 'inverting';

export type MagnetField = {
  /** Se o campo ja acordou. Antes disso nada aqui vale — nem cobra, nem desenha. */
  live: boolean;
  /** O que vale AGORA. `inverting` e a folga: o campo esta calado. */
  polarity: MagnetPolarity;
  /** O que vale quando a folga fechar. Fora dela, e o que ja vale. */
  next: Exclude<MagnetPolarity, 'inverting'>;
  /** Ticks ate a proxima inversao (>= 0). */
  ticksToFlip: number;
  /**
   * O quanto do ciclo ja passou, de 0 (a polaridade acabou de valer) a 1 (o
   * instante da troca). A folga esta INCLUIDA na conta: ela e o fim do ciclo, e
   * nao uma pausa entre dois.
   *
   * E o "quando" do encontro, e ele e uma pergunta diferente do "onde": os
   * aneis dizem em que lugar ficar, este numero diz quanto tempo aquele lugar
   * continua valendo. Sem ele o aviso so chega na folga — e a decisao de
   * atravessar a faixa e de antes dela.
   */
  progress: number;
  /**
   * O quanto a inversao ja carregou, de 0 (a folga acabou de abrir) a 1 (ela
   * fecha neste tick). Zero fora da folga.
   */
  charge: number;
  /**
   * O raio da borda que COBRA nesta polaridade — o anel de esmagamento
   * atraindo, o do arco de retorno repelindo. Dentro da folga, -1: nao ha borda
   * cobrando, e desenhar uma seria prometer dano que nao vem.
   */
  edge: number;
};

/**
 * A FAIXA: o intervalo de distancias que nenhuma das duas polaridades cobra.
 *
 * Constante e nao derivada da fase de proposito, porque e essa a regra do
 * encontro. As bordas trocam de dono a cada ciclo — atraindo, a de dentro
 * avanca; repelindo, a de fora —, mas o corredor entre elas e o mesmo o tempo
 * todo. Um jogador que aprende `[3, 9]` uma vez esta certo para sempre; e a
 * unica ancora fixa de uma luta feita de troca.
 */
export const MAGNET_BAND_INNER = MAGNETARCH_CRUSH_RANGE;
export const MAGNET_BAND_OUTER = MAGNETARCH_TETHER_RANGE;

/**
 * O estado do campo neste tick.
 *
 * `flipAt < 0` e "o campo ainda dorme" e devolve `live: false` — nao e erro, e
 * o estado de todo tick anterior ao primeiro passo do jogador dentro do
 * alcance (ver `magnetarchStep`).
 *
 * A folga e lida do PRAZO e nao de um booleano transmitido: `flipAt - tick` ja
 * viaja, e um segundo campo dizendo "estou invertendo" so criaria uma segunda
 * verdade capaz de discordar da primeira num resync.
 */
export const magnetField = (tick: number, flipAt: number, mood: number): MagnetField => {
  const current = mood === MAGNET_ATTRACT ? 'attract' : 'repel';
  if (flipAt < 0) {
    return {
      live: false,
      polarity: current,
      next: current,
      ticksToFlip: 0,
      progress: 0,
      charge: 0,
      edge: -1,
    };
  }
  const ticksToFlip = Math.max(0, flipAt - tick);
  const inverting = ticksToFlip <= MAGNETARCH_FLIP_WINDUP_TICKS;
  // O que vem DEPOIS da folga e o oposto do que vale agora — a inversao ja esta
  // decidida no instante em que o campo se cala, e e por isso que ela pode ser
  // desenhada durante a folga em vez de anunciada depois.
  const next = inverting ? (current === 'attract' ? 'repel' : 'attract') : current;
  return {
    live: true,
    polarity: inverting ? 'inverting' : current,
    next,
    ticksToFlip,
    progress: 1 - Math.min(MAGNETARCH_CYCLE_TICKS, ticksToFlip) / MAGNETARCH_CYCLE_TICKS,
    charge: inverting ? 1 - ticksToFlip / Math.max(1, MAGNETARCH_FLIP_WINDUP_TICKS) : 0,
    edge: inverting ? -1 : current === 'attract' ? MAGNET_BAND_INNER : MAGNET_BAND_OUTER,
  };
};

/**
 * Onde o jogador esta em relacao a faixa, a partir da distancia ao corpo.
 *
 * `outside` e quem esta fora do campo inteiro: la nao ha puxao nem cobranca, e
 * tambem nao ha luta — o Nucleo esta dentro. Existe como resposta explicita
 * para o desenho poder apagar o campo em vez de desenha-lo pela metade.
 */
export type MagnetStanding = 'crush' | 'band' | 'tether' | 'outside';

export const magnetStanding = (dist: number): MagnetStanding => {
  if (dist < MAGNET_BAND_INNER) return 'crush';
  if (dist <= MAGNET_BAND_OUTER) return 'band';
  if (dist <= MAGNETARCH_FIELD_RANGE) return 'tether';
  return 'outside';
};
