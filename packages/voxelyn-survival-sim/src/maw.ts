// O CAMPO DA BOCA — a geometria da sucao do Devorador Branco.
//
// Tudo aqui e funcao pura de (tick, distancia, chao). Nenhum estado, nenhum
// evento, nenhuma celula escrita: a simulacao usa estas contas para arrastar
// corpos e engolir areia, e o cliente usa AS MESMAS para desenhar o vortice.
//
// Por que separado de `entities.ts`, e por que exportado: o vortice e um efeito
// que dura sete segundos e muda de tamanho a cada quadro. Transmiti-lo seria um
// numero por tick para dizer o que as duas pontas ja sabem calcular — e, pior,
// abriria a possibilidade de o desenho discordar da sucao. Um anel desenhado
// meio tile alem de onde a boca de fato agarra e uma mentira sobre a unica
// coisa que este golpe pede que o jogador leia.
//
// O que a simulacao manda e o unico dado que ela sozinha conhece: o TICK em que
// a boca abriu (`bossRuntime.mawOpenedAt`). Dali para a frente as duas pontas
// integram, com as mesmas constantes, o mesmo campo.

import {
  DEVOURER_MAW_BITE_RADIUS,
  DEVOURER_MAW_GLASS_GRIP,
  DEVOURER_MAW_PULL_CORE,
  DEVOURER_MAW_PULL_EDGE,
  DEVOURER_MAW_PULL_FALLOFF,
  DEVOURER_MAW_RADIUS,
  DEVOURER_MAW_SPOOL_TICKS,
} from './constants.js';

/**
 * Quanto da boca ja abriu, de 0 (o tick do pouso) a 1 (aberta por inteiro).
 *
 * `mawOpenedAt < 0` e "nao ha boca aberta" e devolve 0 — nao e um caso de erro,
 * e o estado normal de 90% da luta.
 *
 * Cresce LINEARMENTE de proposito. A tentacao era uma curva que ficasse mansa
 * no comeco e disparasse no fim, mas a rampa e a unica parte do golpe que o
 * jogador cronometra em vez de medir com os olhos: uma taxa constante deixa
 * "quanto tempo ainda da para ficar" ser aprendido uma vez e valer sempre.
 */
export const mawIntensity = (tick: number, mawOpenedAt: number): number => {
  if (mawOpenedAt < 0) return 0;
  const elapsed = tick - mawOpenedAt;
  if (elapsed <= 0) return 0;
  if (elapsed >= DEVOURER_MAW_SPOOL_TICKS) return 1;
  return elapsed / DEVOURER_MAW_SPOOL_TICKS;
};

/**
 * Ate onde a boca chega NESTE tick, em tiles.
 *
 * O que cresce e o ALCANCE, e nunca a forca. A sucao a quatro tiles e a mesma
 * no segundo dois e no segundo sete; o que muda e se a quatro tiles ja ha
 * sucao. Essa separacao e o que permite ao jogador aprender a linha do
 * sem-volta (ver DEVOURER_MAW_PULL_FALLOFF) como um lugar fixo no mundo em vez
 * de um numero que ele teria de reestimar a cada instante da janela.
 *
 * Comeca em zero e nao na garganta: no tick do pouso a boca ainda e so uma
 * cratera, e o primeiro segundo da janela e exatamente o que a janela sempre
 * foi — chegue, encoste, descarregue.
 */
export const mawReach = (tick: number, mawOpenedAt: number): number =>
  DEVOURER_MAW_RADIUS * mawIntensity(tick, mawOpenedAt);

/**
 * A sucao a uma distancia `d` do centro, em tiles por segundo, JA descontado o
 * alcance atual.
 *
 * Zero fora do alcance, zero sem boca aberta. Dentro da garganta devolve o pico
 * — quem esta la nao esta sendo puxado, esta sendo comido, e a conta so importa
 * para o corpo nao parar de andar no ultimo meio tile.
 *
 * `onGlass` e o contra-jogo (DEVOURER_MAW_GLASS_GRIP): sobre vidro a boca nao
 * tem o que agarrar, e a sucao cai abaixo da caminhada em qualquer ponto do
 * disco. O parametro e o CHAO SOB A VITIMA e nao o chao do caminho: o que
 * segura e onde os pes estao.
 */
export const mawPull = (d: number, tick: number, mawOpenedAt: number, onGlass: boolean): number => {
  const reach = mawReach(tick, mawOpenedAt);
  if (reach <= 0 || d > reach) return 0;
  const span = DEVOURER_MAW_RADIUS - DEVOURER_MAW_BITE_RADIUS;
  // `t` mede contra o raio CHEIO e nao contra o alcance do instante. Medir
  // contra o alcance comprimiria a curva inteira dentro de um disco pequeno, e
  // um jogador a dois tiles sentiria a forca da garganta no segundo em que a
  // boca ainda mal abriu — a linha do sem-volta deixaria de ser um lugar e
  // viraria uma funcao do relogio, que e a unica coisa que ela nao pode ser.
  const t = Math.max(0, Math.min(1, (DEVOURER_MAW_RADIUS - d) / span));
  const raw =
    DEVOURER_MAW_PULL_EDGE +
    (DEVOURER_MAW_PULL_CORE - DEVOURER_MAW_PULL_EDGE) * Math.pow(t, DEVOURER_MAW_PULL_FALLOFF);
  return onGlass ? raw * DEVOURER_MAW_GLASS_GRIP : raw;
};
