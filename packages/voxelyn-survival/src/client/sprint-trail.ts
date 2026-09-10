// O RASTRO DA DISPARADA: linhas de velocidade atras do Prospector que corre.
//
// Vive num modulo proprio, e puro, pelo mesmo motivo do arco condutivo: a
// geometria e testavel sem canvas, e o render so a projeta. O rastro sai do
// ESTADO (`sprintUntil` do slot), nao de um evento — e por isso o parceiro
// no co-op e quem reconecta no meio da corrida veem o mesmo que o corredor.

export type SprintStreak = {
  /** Deslocamento do inicio, em tiles, a partir do centro do corpo. */
  x0: number;
  y0: number;
  /** Deslocamento do fim, em tiles: mais atras, na direcao oposta ao rumo. */
  x1: number;
  y1: number;
  alpha: number;
};

/** Quantas linhas, e a fracao de um ciclo de tremulacao por milissegundo. */
export const SPRINT_STREAKS = 3;
const FLICKER_MS = 90;

/**
 * Tres riscos curtos atras do corpo, escalonados lateralmente, que tremulam
 * em fase para parecerem vento e nao um desenho parado. `facing` e o rumo do
 * corpo (o que o parceiro ve); com rumo nulo nao ha rastro — parado nao se
 * corre. `nowMs` so alimenta a tremulacao: cada risco encurta e alonga num
 * ciclo curto, defasado dos vizinhos.
 */
export const sprintStreaks = (facingX: number, facingY: number, nowMs: number): SprintStreak[] => {
  const len = Math.hypot(facingX, facingY);
  if (len < 0.01) return [];
  const bx = -facingX / len;
  const by = -facingY / len;
  // Perpendicular ao rumo, para escalonar os riscos lado a lado.
  const px = -by;
  const py = bx;
  const out: SprintStreak[] = [];
  for (let i = 0; i < SPRINT_STREAKS; i++) {
    const lateral = (i - (SPRINT_STREAKS - 1) / 2) * 0.22;
    const phase = (((nowMs / FLICKER_MS + i * 0.37) % 1) + 1) % 1;
    const stretch = 0.75 + 0.25 * Math.sin(phase * Math.PI * 2);
    const start = 0.35 + (i === 1 ? 0.05 : 0);
    const length = (0.55 + (i === 1 ? 0.25 : 0)) * stretch;
    out.push({
      x0: bx * start + px * lateral,
      y0: by * start + py * lateral,
      x1: bx * (start + length) + px * lateral,
      y1: by * (start + length) + py * lateral,
      alpha: 0.35 + 0.4 * stretch,
    });
  }
  return out;
};

/**
 * Projeta e traca os riscos. `toScreen` e a projecao do mundo; `lift` sobe
 * as linhas do piso ate a altura do tronco, em pixels — o rastro sai do
 * corpo, nao dos pes (os pes sao das particulas de poeira).
 */
export const drawSprintTrail = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  facingX: number,
  facingY: number,
  toScreen: (wx: number, wy: number) => [number, number],
  lift: number,
  lineWidth: number,
  color: string,
  nowMs: number,
): void => {
  const streaks = sprintStreaks(facingX, facingY, nowMs);
  if (streaks.length === 0) return;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineCap = 'round';
  ctx.lineWidth = lineWidth;
  for (const s of streaks) {
    const [ax, ay] = toScreen(x + s.x0, y + s.y0);
    const [bx, by] = toScreen(x + s.x1, y + s.y1);
    ctx.globalAlpha = s.alpha;
    ctx.beginPath();
    ctx.moveTo(ax, ay - lift);
    ctx.lineTo(bx, by - lift);
    ctx.stroke();
  }
  ctx.restore();
};
