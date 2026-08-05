// A PARABOLA do salto do Devorador Branco.
//
// Por que a altura vive aqui e nao na simulacao: ela nao decide nada. Nao ha
// colisao em z no jogo — o arco atravessa parede porque ele esta no ar, e isso
// ja e verdade pelo humor, nao pela altura. Um campo de altura no estado
// autoritativo seria um numero hasheado, ressincronizado e reenviado a cada
// tick para nao afetar resultado nenhum.
//
// O que a simulacao manda e o que ela realmente sabe: o VAO DE TEMPO do voo,
// em `EntityAction` (`startedAt` -> `releaseAt`), que ela precisa manter de pe
// de qualquer jeito para conduzir o corpo. A altura sai dali por aritmetica
// pura, igual nos dois clientes de uma sala de co-op porque a entrada e a
// mesma — e sem custar um byte a mais no snapshot.

/**
 * Altura normalizada (0 no chao, 1 no apice) para um progresso de 0 a 1.
 *
 * `4p(1-p)` e a parabola que vale 0 nas duas pontas e 1 no meio: o corpo sai do
 * chao no tick da cratera de decolagem e toca o chao no tick da cratera de
 * queda. As duas concordancias sao o ponto — uma sombra que encosta antes ou
 * depois do estrago faria o jogador ler a distancia errada.
 *
 * Fora da faixa a altura e 0 e nao um valor extrapolado: um snapshot atrasado
 * pode entregar um tick alem do fim do arco, e uma parabola extrapolada
 * devolveria altura NEGATIVA — o chefe afundando no chao no ultimo quadro.
 */
export const leapHeight = (progress: number): number => {
  if (!(progress > 0) || progress >= 1) return 0;
  return 4 * progress * (1 - progress);
};

/**
 * Progresso do arco a partir do vao que a acao carrega.
 *
 * `span <= 0` devolve 0 em vez de dividir por zero: um arco de duracao nula e
 * possivel no papel (distancia minima, velocidade alta) e nao pode virar NaN,
 * que se propagaria ate um `drawImage` com coordenada invalida.
 */
export const leapProgress = (tick: number, startedAt: number, releaseAt: number): number => {
  const span = releaseAt - startedAt;
  if (span <= 0) return 0;
  return Math.max(0, Math.min(1, (tick - startedAt) / span));
};

/**
 * Altura do apice, em pixels logicos antes do zoom.
 *
 * Alta o bastante para a silhueta se descolar do chao de verdade — o arco tem
 * de ser legivel como ARCO a distancia, e nao como um corpo tremendo — e baixa
 * o bastante para o sprite nao sair pela borda de cima da tela quando o salto
 * acontece perto do topo do viewport.
 *
 * Nasceu em 26 e foi CONFERIDO em video antes de valer. A 26 o corpo subia
 * pouco mais que meio tile e o salto lia como tremor; a 52 — um tile inteiro de
 * altura projetada no zoom padrao — ele lê como arco. O numero e de gosto, mas
 * a escala nao: e ela que separa "pulou" de "vibrou".
 */
export const LEAP_PEAK_PX = 52;

/**
 * A sombra encolhe com a altura, e e ela que conta a distancia ao chao.
 *
 * Numa projecao isometrica sem perspectiva, um corpo subindo e um corpo indo
 * para o fundo desenham o MESMO deslocamento na tela: sem a sombra, o salto e
 * indistinguivel de um passo para longe. A sombra e o unico dado que resolve a
 * ambiguidade, entao ela nao e enfeite — e a leitura.
 */
export const leapShadowScale = (height: number): number => 1 - 0.45 * Math.max(0, Math.min(1, height));
export const leapShadowAlpha = (height: number): number => 0.45 * (1 - 0.55 * Math.max(0, Math.min(1, height)));
