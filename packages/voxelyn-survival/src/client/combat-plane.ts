// O PLANO DE COMBATE: a altura unica em que mira, projetil e impacto vivem.
//
// ---------------------------------------------------------------------------
// O PROBLEMA, QUE E DE PROJECAO E NAO DE BALANCEAMENTO
// ---------------------------------------------------------------------------
// Numa projecao isometrica, subir na tela e afastar-se no mundo sao o MESMO
// deslocamento de pixel. Todo elemento desenhado acima do proprio ponto de chao
// esta, para o olho, tambem deslocado no mundo — e a conta de quanto depende da
// altura que se deu a ele.
//
// O jogo tinha tres alturas diferentes convivendo no mesmo gesto de mirar:
//
//   - a MIRA saia dos PES do Prospector (o centro da tela, altura zero);
//   - o BOLT era desenhado na boca do cano (1,25 tile, 20 px de subida no zoom
//     2 — mais de um tile inteiro de chao);
//   - o IMPACTO nascia no chao de novo (altura ~0,1).
//
// A consequencia media na tela: o tiro nao passava por cima do cursor, passava
// 20 px ACIMA da linha que ligava o personagem ao cursor. O jogador mirava num
// bicho, via o estilhaco cruzar o corpo dele e o tiro passava por tras — porque
// a colisao acontece no plano do CHAO, e o corpo do bicho tambem esta desenhado
// acima do chao dele. E o burst do impacto aparecia num terceiro lugar, colado
// no piso, longe de onde o projetil visivelmente estava quando parou.
//
// ---------------------------------------------------------------------------
// A REGRA
// ---------------------------------------------------------------------------
// UMA altura para tudo que participa de acertar alguem. A mira e medida a
// partir dela, o projetil voa nela, o impacto nasce nela. Com as tres no mesmo
// plano, a linha reta que o jogador ve entre o cursor e o personagem e
// exatamente o caminho que o projetil desenha — e a materia do impacto termina
// onde o corpo do projetil estava.
//
// E a estrategia que os jogos isometricos de tiro usam ha decadas: nao existe
// "altura correta" derivavel da fisica, existe uma altura ESCOLHIDA em que o
// jogo inteiro concorda. O que faz a mira funcionar nao e o numero, e o acordo.
//
// O numero, ainda assim, nao e arbitrario: 0,55 tile e a altura em que fica o
// centro visual do corpo de uma criatura media (raio 0,35 -> ~10z px de meio
// corpo acima dos pes, contra 8,8z px deste plano no mesmo zoom). Mirar no
// TRONCO do bicho, que e o que a mao faz sozinha, passou a ser mirar onde o
// tiro de fato vai.
//
// O que NAO muda: a simulacao continua sem eixo Z. Nada aqui e colisao — e
// tudo apresentacao, e por isso vive no cliente.

import { PROSPECTOR_MUZZLE_HEIGHT_TILES } from '@voxelyn/survival-content';

/**
 * A altura do plano de combate, em tiles de mundo.
 *
 * Consumida por tres lugares que precisam concordar: o ancoramento da mira
 * (`render.ts`), o corpo do projetil (`projectiles.ts`) e a materia do impacto
 * (`particles.ts`). Mudar este numero move os tres juntos, que e a unica forma
 * de mexer nele sem reabrir o defeito que ele fecha.
 */
export const COMBAT_PLANE_TILES = 0.55;

/**
 * Distancia, em tiles percorridos, em que o tiro desce da boca do cano ate o
 * plano de combate.
 *
 * A altura do cano nao some — ela vira ORIGEM em vez de altitude de cruzeiro. O
 * estilhaco continua nascendo na arma (a razao pela qual `PROSPECTOR_MUZZLE_
 * HEIGHT_TILES` existe: antes ele saia da barriga do bot), so que assenta no
 * plano em pouco mais de um tile. Curto de proposito: o que precisa ser lido e
 * "saiu da arma", e um tiro que leva meia arena para descer volta a ser um tiro
 * que nao passa pelo cursor.
 */
export const MUZZLE_SETTLE_TILES = 1.1;

/**
 * Altura de voo de um projetil, em tiles, pela distancia que ele ja percorreu.
 *
 * `fromMuzzle` separa o que saiu da ARMA do jogador (que comeca alto e desce)
 * do que saiu do chao — o cuspe do Spitter e a pedra do Britador nascem na
 * altura em que voam e ficam nela.
 *
 * A curva e `easeOutCubic`: cai depressa no primeiro palmo e encosta suave no
 * plano. Uma reta faria o estilhaco descer com velocidade constante e "pousar"
 * com quina visivel justamente no meio do campo de leitura.
 */
export const projectileHeightTiles = (travelledTiles: number, fromMuzzle: boolean): number => {
  if (!fromMuzzle) return COMBAT_PLANE_TILES;
  const t = Math.max(0, Math.min(1, travelledTiles / MUZZLE_SETTLE_TILES));
  const eased = 1 - (1 - t) ** 3;
  return PROSPECTOR_MUZZLE_HEIGHT_TILES + (COMBAT_PLANE_TILES - PROSPECTOR_MUZZLE_HEIGHT_TILES) * eased;
};

/**
 * Quantos PIXELS de tela uma altura de mundo vale.
 *
 * A altura usa a altura do losango (`tileH`) como unidade, e nao a metade dela
 * que separa dois tiles de chao: e a mesma escala com que os voxels de corpo
 * sao desenhados, e trocar de escala aqui descolaria o projetil das criaturas
 * ao lado dele.
 */
export const heightToScreenPx = (heightTiles: number, tileH: number, zoom: number): number =>
  heightTiles * tileH * zoom;
