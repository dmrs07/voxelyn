// O CANHAO MONTADO NO BOT: a arma por cima do sprite, no ombro do Prospector.
//
// Por que uma sobreposicao procedural em vez de quadros novos no atlas: o
// atlas do Prospector tem oito rumos por animacao, e uma arma com posicoes de
// cano seriam dezenas de quadros por animacao — para uma peca que existe por
// vinte segundos de run. A sobreposicao custa uma dezena de retangulos por
// quadro e responde a rotacao REAL, que e o que o quadro pre-renderizado nunca
// poderia fazer.
//
// A SILHUETA segue o cartucho (`module-hardware.ts`): caixa de municao atras,
// cano curto e GROSSO na frente. Duas pecas, e nao um pente de canos finos —
// e a mesma decisao de la, pela mesma razao: a arma se define por municao, e
// nesta escala um feixe de tubos finos vira um borrao cinza de tres pixels.
//
// A regra que faz a rotacao funcionar num punhado de pixels: em pouquissimo
// espaco, rotacao nao se le por movimento angular — ela se le por
// ALTERNANCIA. Aqui quem alterna e a ventoinha da culatra, tres pixels em
// orbita, que e o mesmo elemento que gira no cartucho.

/** Paleta local: os mesmos aco/osso/ambar/fogo da art bible. */
const M = {
  steelDark: '#1d2430',
  steel: '#2e3a4d',
  steelLight: '#46566e',
  bone: '#b8a98f',
  amber: '#ffd166',
  fire: '#ff7a2f',
  white: '#e8f1ff',
};

/**
 * Direcao de MUNDO convertida para TELA, na projecao 2:1 do jogo.
 *
 * O eixo vertical vale metade. Sem isso o conjunto de canos apontaria para um
 * lugar diferente daquele para onde as balas saem, e a arma passaria a
 * mentir sobre a propria mira — que e a unica coisa que ela nao pode fazer.
 */
export const screenAim = (ax: number, ay: number): { x: number; y: number } => {
  const sx = ax - ay;
  const sy = (ax + ay) * 0.5;
  const len = Math.hypot(sx, sy) || 1;
  return { x: sx / len, y: sy / len };
};

export type MinigunMountOptions = {
  /**
   * ANGULO do conjunto, 0..1 (uma volta) — e nao a velocidade de rotacao.
   *
   * A diferenca e a razao de este campo existir. A velocidade satura em 1
   * durante a rajada inteira; usa-la como angulo congelaria os canos
   * exatamente no trecho em que eles giram mais rapido. Quem integra o angulo
   * a partir da velocidade autoritativa e `minigun-view.ts`.
   */
  phase: number;
  /** 0..1, a fracao de calor: pinta o metal e acende os pontos quentes. */
  heat: number;
  /** 0..1, quanto resta do clarao de boca da ultima rajada. */
  flash: number;
  /** Verdadeiro durante o travamento: o metal fica branco e sai vapor. */
  overheated: boolean;
};

/**
 * Desenha o conjunto de canos ancorado no ombro do Prospector.
 *
 * `(footX, footY)` sao os PES na tela — a mesma ancora que o sprite usa —, e o
 * ombro sai dali por um deslocamento fixo em zoom. Ancorar nos pes e o que
 * mantem o canhao colado ao corpo durante o coice, o tombo da esquiva e o
 * tremor do superaquecimento, todos aplicados a mesma origem.
 */
export const drawMinigunMount = (
  ctx: CanvasRenderingContext2D,
  footX: number,
  footY: number,
  aimX: number,
  aimY: number,
  zoom: number,
  opts: MinigunMountOptions,
): void => {
  const dir = screenAim(aimX, aimY);
  const phase = opts.phase - Math.floor(opts.phase);
  const heat = Math.max(0, Math.min(1, opts.heat));
  const flash = Math.max(0, Math.min(1, opts.flash));

  // Ombro: acima dos pes, deslocado no rumo da mira. Os numeros sao os mesmos
  // do plano de combate — a boca fica a um palmo do corpo.
  const shoulderY = footY - 10 * zoom;
  const cx = footX + dir.x * 5 * zoom;
  const cy = shoulderY + dir.y * 3 * zoom;

  // Perpendicular na tela: e por ela que os canos empilham.
  const px = -dir.y;
  const py = dir.x;
  const unit = Math.max(1, Math.round(zoom));

  ctx.save();

  // A CAIXA DE MUNICAO, atras do ombro: um bloco compacto com dois pixels de
  // latao. E ela que da massa a silhueta e diz de longe qual arma o Prospector
  // esta carregando — inclusive a do parceiro remoto, do outro lado da sala.
  const boxX = cx - dir.x * 3.4 * zoom;
  const boxY = cy - dir.y * 3.4 * zoom;
  const box = Math.max(2, Math.round(3.4 * zoom));
  ctx.fillStyle = M.steel;
  ctx.fillRect(Math.round(boxX - box / 2), Math.round(boxY - box / 2), box, box);
  ctx.fillStyle = M.steelLight;
  ctx.fillRect(Math.round(boxX - box / 2), Math.round(boxY - box / 2), box, Math.max(1, unit));
  ctx.fillStyle = M.amber;
  ctx.fillRect(Math.round(boxX - box / 4), Math.round(boxY), Math.max(1, unit), Math.max(1, unit));

  // O CANO: duas linhas grossas, e nao quatro finas. Calibre, nao contagem.
  for (const side of [-0.6, 0.6]) {
    const bx = cx + px * side * zoom;
    const by = cy + py * side * zoom;
    ctx.strokeStyle = M.steelLight;
    ctx.lineWidth = Math.max(1, unit * 1.3);
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.lineTo(bx + dir.x * 6.5 * zoom, by + dir.y * 6.5 * zoom);
    ctx.stroke();
    ctx.fillStyle = M.bone;
    ctx.fillRect(
      Math.round(bx + dir.x * 6.5 * zoom - unit / 2),
      Math.round(by + dir.y * 6.5 * zoom - unit / 2),
      unit,
      unit,
    );
  }

  // A VENTOINHA da culatra: tres pixels em orbita, na MESMA fase do cartucho.
  // E o unico elemento que se move, e por isso o unico que precisa girar.
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + phase * Math.PI * 2;
    ctx.fillStyle = i === 0 ? M.amber : M.steelLight;
    ctx.fillRect(
      Math.round(cx + Math.cos(a) * 1.7 * zoom - unit / 2),
      Math.round(cy + Math.sin(a) * 1.7 * zoom - unit / 2),
      unit,
      unit,
    );
  }

  // CALOR NO METAL. Cresce com a barra que o HUD ja desenha, e satura em
  // branco no travamento — o mesmo vocabulario do `gunHeatTint` do sprite,
  // para as duas pecas contarem a mesma historia.
  if (heat > 0.18 || opts.overheated) {
    ctx.globalAlpha = opts.overheated ? 0.9 : (heat - 0.18) / 0.82;
    ctx.fillStyle = opts.overheated ? M.white : M.fire;
    ctx.fillRect(
      Math.round(cx + dir.x * 2 * zoom - unit),
      Math.round(cy + dir.y * 2 * zoom - 2 * unit),
      unit * 2,
      unit * 4,
    );
    ctx.globalAlpha = 1;
  }

  // CLARAO DE BOCA. Pequeno e frequente, nunca uma flor de fogo: dezesseis
  // por segundo com o clarao do tiro comum cobririam o inimigo que o jogador
  // esta mirando, e a arma passaria a esconder o proprio alvo.
  if (flash > 0) {
    const tip = 7.5 * zoom;
    const fx = cx + dir.x * tip;
    const fy = cy + dir.y * tip;
    ctx.globalAlpha = 0.35 + flash * 0.5;
    ctx.fillStyle = M.amber;
    const r = Math.max(1.5, 2.2 * zoom * (0.7 + flash * 0.5));
    ctx.beginPath();
    ctx.ellipse(fx, fy, r, r * 0.7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = M.white;
    ctx.fillRect(Math.round(fx - unit / 2), Math.round(fy - unit / 2), unit, unit);
    ctx.globalAlpha = 1;
  }

  ctx.restore();
};
