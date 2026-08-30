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

import { PROSPECTOR_MUZZLES, type MuzzleOffsetTiles } from '@voxelyn/survival-content';

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
 * Quanto da posicao de BOCA ainda vale, pela distancia percorrida.
 *
 * 1 na saida do cano, 0 depois de `MUZZLE_SETTLE_TILES`. E `(1 - t)^3`, o
 * complemento do `easeOutCubic` que a altura ja usava: cai depressa no primeiro
 * palmo e encosta suave no plano. Uma reta faria o estilhaco descer com
 * velocidade constante e "pousar" com quina visivel justamente no meio do campo
 * de leitura.
 *
 * Existe como funcao propria porque agora TRES medidas dependem dela — altura,
 * deslocamento lateral e a sombra que os denuncia —, e uma curva duplicada em
 * tres lugares e uma curva que vai divergir.
 */
export const muzzleBlend = (travelledTiles: number): number => {
  const t = Math.max(0, Math.min(1, travelledTiles / MUZZLE_SETTLE_TILES));
  return (1 - t) ** 3;
};

/**
 * A boca da arma que disparou este projetil, ou `null` para o que sai do chao.
 *
 * O `kind` e o discriminador porque ele ja carrega a arma: `flechette` so
 * existe saindo da Minigun, e nenhuma outra coisa do jogador sai dela. O cuspe
 * do Spitter e a pedra do Britador nascem na altura em que voam e ficam nela.
 */
export const muzzleForProjectile = (
  kind: string | undefined,
  hostile: boolean
): MuzzleOffsetTiles | null => {
  if (hostile) return null;
  return kind === 'flechette' ? PROSPECTOR_MUZZLES.minigun : PROSPECTOR_MUZZLES.bolt;
};

/**
 * Altura de voo de um projetil, em tiles, pela distancia que ele ja percorreu.
 *
 * `muzzle` ausente e o que saiu do CHAO — o cuspe do Spitter, a pedra do
 * Britador —, que nasce no plano de combate e fica nele.
 */
export const projectileHeightTiles = (
  travelledTiles: number,
  muzzle: MuzzleOffsetTiles | null
): number =>
  muzzle === null
    ? COMBAT_PLANE_TILES
    : COMBAT_PLANE_TILES + (muzzle.height - COMBAT_PLANE_TILES) * muzzleBlend(travelledTiles);

/**
 * Deslocamento LATERAL ainda devido a boca, em tiles, a direita da trajetoria.
 *
 * Este e o eixo que faltava. A arma e montada no ombro DIREITO do bot, um terco
 * de tile fora do eixo do corpo, e a simulacao nasce o projetil no centro — de
 * onde ele visivelmente nao sai. A altura sozinha resolvia a metade vertical do
 * problema desde sempre; esta resolve a outra.
 *
 * Ele CONVERGE, e nao poderia ser diferente: a colisao acontece na posicao
 * autoritativa, entao um deslocamento permanente faria o tiro desenhado passar
 * ao lado do que ele de fato acerta. E o mesmo contrato da altura, no mesmo
 * prazo — o desenho comeca na arma e encontra a verdade em pouco mais de um
 * tile, que e onde o jogador para de olhar para o cano e passa a olhar o alvo.
 *
 * O componente PARA A FRENTE fica de fora de proposito. Ele existe (a boca da
 * Minigun esta 0,35 tile a frente de onde a bala nasce), mas um deslocamento no
 * eixo do movimento e indistinguivel de um projetil que saiu dois quadros
 * antes — a 22 tiles por segundo, 0,35 tile e 16 ms. Corrigi-lo exigiria
 * duplicar no cliente a distancia de nascimento que a simulacao escolhe, uma
 * segunda fonte de verdade para comprar um efeito que ninguem ve.
 */
export const muzzleLateralTiles = (
  travelledTiles: number,
  muzzle: MuzzleOffsetTiles | null
): number => (muzzle === null ? 0 : muzzle.lateral * muzzleBlend(travelledTiles));

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
