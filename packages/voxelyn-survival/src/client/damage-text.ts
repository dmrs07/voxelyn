// Numeros de dano flutuantes.
//
// Por que existe separado: o numero e a unica informacao NUMERICA do jogo e
// aparece sobre o pior fundo possivel — terreno voxel malhado, fungo
// verde-claro, poca luminosa. Texto liso, sem contorno, desaparecia dentro da
// textura em boa parte do mapa, e era pior justamente no caso mais critico: o
// dano que o proprio jogador recebe, desenhado em vermelho escuro sobre pedra
// escura.
//
// Isolado aqui, o desenho pode ser conferido contra fundos reais sem subir o
// jogo inteiro.

/** Contorno: escuro da paleta mestra, para o numero nao inventar cor nova. */
const OUTLINE = '#0b0e14';

/**
 * Opacidade de um numero pela fracao de vida ja gasta.
 *
 * Segura opaco na primeira metade e so entao some. Desvanecer desde o quadro
 * zero gasta em transparencia exatamente o instante em que o jogador esta
 * olhando para o golpe.
 */
export const damageAlpha = (t: number): number => {
  const p = Math.max(0, Math.min(1, t));
  return p < 0.55 ? 1 : 1 - (p - 0.55) / 0.45;
};

/**
 * Escala do texto a partir do dano.
 *
 * A raiz achata o crescimento: linear, um golpe de 40 sairia sete vezes maior
 * que um de 6 e taparia a tela em vez de informar.
 */
export const damageScale = (amount: number): number =>
  Math.min(1.9, 0.9 + Math.sqrt(Math.max(0, amount)) / 7);

/**
 * Deslocamentos laterais em tiles, percorridos em ciclo.
 *
 * Uma tabela em vez de um sorteio: o leque fica sempre bem distribuido, sem os
 * aglomerados que o acaso produz, e nao ha risco de dois numeros consecutivos
 * caindo no mesmo ponto. Sem espalhamento, uma rajada em cima de um inimigo
 * desenha varios numeros exatamente sobrepostos — o resultado nao e um numero
 * grande, e um borrao que nao se le.
 */
export const DAMAGE_FAN = [0, 0.38, -0.32, 0.18, -0.44, 0.46, -0.16];

export const drawDamageNumber = (
  ctx: CanvasRenderingContext2D,
  text: string,
  sx: number,
  sy: number,
  color: string,
  scale: number,
  alpha: number,
  zoom: number
): void => {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.font = `bold ${Math.round(7 * zoom * scale)}px monospace`;
  ctx.textAlign = 'center';
  // O contorno e o que resolve o problema de verdade: funciona sobre qualquer
  // fundo sem depender da cor do numero, e sem exigir que toda cor de dano seja
  // clara — o vermelho continua podendo significar "voce levou".
  ctx.lineWidth = Math.max(2, 2.5 * zoom);
  ctx.lineJoin = 'round';
  ctx.miterLimit = 2;
  ctx.strokeStyle = OUTLINE;
  ctx.strokeText(text, sx, sy);
  ctx.fillStyle = color;
  ctx.fillText(text, sx, sy);
  ctx.restore();
};
