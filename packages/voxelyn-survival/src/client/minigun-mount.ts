// O CANHAO MONTADO NO BOT: os canos girando por cima do sprite da arma.
//
// Por que uma sobreposicao procedural em vez de quadros novos no atlas: o
// atlas do Prospector tem oito rumos por animacao, e uma arma com quatro
// posicoes de cano seriam trinta e dois quadros por animacao — para uma peca
// que existe por vinte segundos de run. A sobreposicao custa uma dezena de
// retangulos por quadro e responde a rotacao REAL, que e o que o quadro
// pre-renderizado nunca poderia fazer.
//
// A regra que faz isto funcionar num punhado de pixels: em pouquissimo espaco,
// rotacao nao se le por movimento angular — ela se le por ALTERNANCIA. Quatro
// canos empilhados que trocam de comprimento em fase leem como um conjunto
// girando; um desenho girado de verdade num raio de tres pixels le como
// tremor. O mesmo criterio do cartucho em `module-hardware.ts`.

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
  /** 0..1, a rotacao autoritativa. */
  spin: number;
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
  const spin = Math.max(0, Math.min(1, opts.spin));
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

  ctx.save();

  // O CONJUNTO. Quatro canos alternando comprimento em fase com a rotacao.
  // Oito passos, e nao continuo: pixel art nao tem subpixel, e interpolar
  // produziria tremor de meio pixel no lugar de giro.
  const step = Math.floor(spin * 8) % 4;
  const unit = Math.max(1, Math.round(zoom));
  for (let i = 0; i < 4; i++) {
    const phase = (i + step) % 4;
    const front = phase === 0 || phase === 1;
    const offset = (i - 1.5) * 1.1 * zoom;
    const bx = cx + px * offset;
    const by = cy + py * offset;
    const length = (front ? 7 : 5) * zoom;
    ctx.strokeStyle = front ? M.steelLight : M.steel;
    ctx.lineWidth = unit;
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.lineTo(bx + dir.x * length, by + dir.y * length);
    ctx.stroke();
    // A boca clara dos canos da frente: e ela que faz a alternancia LER como
    // rotacao em vez de como cintilacao aleatoria.
    if (front) {
      ctx.fillStyle = M.bone;
      ctx.fillRect(
        Math.round(bx + dir.x * length - unit / 2),
        Math.round(by + dir.y * length - unit / 2),
        unit,
        unit,
      );
    }
  }

  // A cinta que segura o conjunto: sem ela sao quatro riscos soltos.
  ctx.strokeStyle = M.steelDark;
  ctx.lineWidth = Math.max(1, unit * 1.4);
  ctx.beginPath();
  ctx.moveTo(cx + px * 2.4 * zoom + dir.x * 3 * zoom, cy + py * 2.4 * zoom + dir.y * 3 * zoom);
  ctx.lineTo(cx - px * 2.4 * zoom + dir.x * 3 * zoom, cy - py * 2.4 * zoom + dir.y * 3 * zoom);
  ctx.stroke();

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
