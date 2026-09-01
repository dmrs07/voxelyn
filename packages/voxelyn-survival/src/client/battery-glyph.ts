// O GLIFO DA CELULA DE PURGA: uma bateria, desenhada para ler a 13 px.
//
// O glifo antigo era um retangulo de 6×8 px com uma barra dentro — no
// tamanho da linha de recursos ele lia como um "i" apagado, e uma fileira
// deles nao lia como fileira de coisa nenhuma. Este e uma pilha de verdade:
// terminal em cima, corpo arredondado, tres segmentos de carga empilhados e
// um fio de luz na borda esquerda. A mesma silhueta em todos os tamanhos: no
// painel (13), no voo da recompensa (18+) e no compartimento vazio (so o
// contorno).
//
// Tudo e desenhado a partir de `h` (a altura total, terminal incluido) para a
// silhueta escalar sem trocar de forma, e as coordenadas sao arredondadas ao
// meio-pixel para o contorno de 1 px sair nitido, e nao borrado em duas
// colunas.

export type BatteryFill = 'full' | 'empty';

const snap = (v: number): number => Math.round(v) + 0.5;

/**
 * Desenha a pilha centrada em (cx, cy). `color` e o contorno e os segmentos;
 * `fill` decide se ha carga dentro. `alpha` apaga o glifo inteiro — e como o
 * compartimento vazio se distingue do cheio sem mudar de forma.
 */
export const drawBatteryGlyph = (
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  h: number,
  color: string,
  fill: BatteryFill = 'full',
  alpha = 1,
): void => {
  const bodyH = Math.max(6, Math.round(h * 0.8));
  const bodyW = Math.max(5, Math.round(h * 0.58));
  const capH = Math.max(1, Math.round(h * 0.12));
  const capW = Math.max(2, Math.round(bodyW * 0.45));
  const radius = Math.max(1, Math.round(h * 0.12));
  const top = cy - h / 2 + capH;
  const left = cx - bodyW / 2;
  const x0 = snap(left);
  const y0 = snap(top);
  const x1 = snap(left + bodyW) - 1;
  const y1 = snap(top + bodyH) - 1;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.lineWidth = 1;

  // O terminal: um dente cheio em cima do corpo.
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(cx - capW / 2), Math.round(top - capH), capW, capH);

  // O corpo: fundo escuro, contorno arredondado.
  ctx.beginPath();
  ctx.moveTo(x0 + radius, y0);
  ctx.lineTo(x1 - radius, y0);
  ctx.quadraticCurveTo(x1, y0, x1, y0 + radius);
  ctx.lineTo(x1, y1 - radius);
  ctx.quadraticCurveTo(x1, y1, x1 - radius, y1);
  ctx.lineTo(x0 + radius, y1);
  ctx.quadraticCurveTo(x0, y1, x0, y1 - radius);
  ctx.lineTo(x0, y0 + radius);
  ctx.quadraticCurveTo(x0, y0, x0 + radius, y0);
  ctx.closePath();
  ctx.fillStyle = 'rgba(11,14,20,0.9)';
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.stroke();

  if (fill === 'full') {
    // Tres segmentos empilhados, com um pixel de ar entre eles: e o desenho
    // universal de "carregada", e le mesmo quando cada segmento tem 2 px.
    const innerX = x0 + 1.5;
    const innerW = x1 - x0 - 3;
    const innerTop = y0 + 1.5;
    const innerH = y1 - y0 - 3;
    const segments = innerH >= 9 ? 3 : 2;
    const gap = 1;
    const segH = Math.max(1, Math.floor((innerH - gap * (segments - 1)) / segments));
    ctx.fillStyle = color;
    for (let i = 0; i < segments; i++) {
      const sy = innerTop + innerH - (i + 1) * segH - i * gap;
      ctx.fillRect(innerX, sy, innerW, segH);
    }
    // O fio de luz: a borda esquerda do corpo pega a luz, como o latao do
    // chassi. Um pixel, quase branco, do topo ao fundo.
    ctx.fillStyle = 'rgba(232,241,255,0.35)';
    ctx.fillRect(x0 + 0.5, y0 + radius, 1, y1 - y0 - radius * 2);
  }
  ctx.restore();
};
