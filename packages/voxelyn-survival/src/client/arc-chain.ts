type Point = { x: number; y: number };
export const ARC_FLASH_MS = 240;

/** Stable branches between the actual hit points. No render-time randomness or extra targets. */
export const arcBoltPoints = (from: Point, to: Point, seed: number): Point[] => {
  const dx = to.x - from.x,
    dy = to.y - from.y;
  const length = Math.hypot(dx, dy);
  if (length < 0.01) return [from, to];
  const count = Math.max(3, Math.min(12, Math.ceil(length / 14)));
  const points = [from];
  for (let i = 1; i < count; i++) {
    const at = i / count;
    const hash = Math.imul(seed ^ Math.imul(i, 0x45d9f3b), 0x27d4eb2d) >>> 0;
    const offset = ((hash % 1000) / 500 - 1) * Math.min(9, length * 0.13) * Math.sin(Math.PI * at);
    points.push({
      x: from.x + dx * at - (dy / length) * offset,
      y: from.y + dy * at + (dx / length) * offset,
    });
  }
  points.push(to);
  return points;
};

export const drawArcChain = (
  ctx: CanvasRenderingContext2D,
  hops: readonly Point[],
  ageMs: number,
  toScreen: (x: number, y: number) => [number, number],
  zoom: number,
  reducedMotion = false,
): void => {
  if (ageMs < 0 || ageMs >= ARC_FLASH_MS) return;
  ctx.save();
  ctx.lineJoin = 'miter';
  ctx.lineCap = 'round';
  const fade = Math.pow(1 - ageMs / ARC_FLASH_MS, 0.75);
  const points = hops.map((p) => {
    const [x, y] = toScreen(p.x, p.y);
    return { x, y: y - 10 * zoom };
  });
  for (let i = 1; i < points.length; i++) {
    const seed = Math.round(hops[i].x * 100) ^ Math.round(hops[i].y * 100) ^ (i * 571);
    const bolt = arcBoltPoints(points[i - 1], points[i], seed);
    const trace = (): void => {
      ctx.beginPath();
      ctx.moveTo(bolt[0].x, bolt[0].y);
      for (const p of bolt.slice(1)) ctx.lineTo(p.x, p.y);
      ctx.stroke();
    };
    ctx.globalAlpha = fade * (reducedMotion ? 0.16 : 0.25);
    ctx.strokeStyle = '#23beaf';
    ctx.lineWidth = 5 * zoom;
    trace();
    ctx.globalAlpha = fade * 0.9;
    ctx.strokeStyle = '#61ffd8';
    ctx.lineWidth = 1.8 * zoom;
    trace();
    ctx.globalAlpha = fade;
    ctx.strokeStyle = '#effffb';
    ctx.lineWidth = Math.max(1, 0.6 * zoom);
    trace();
    const mid = bolt[Math.floor(bolt.length / 2)];
    ctx.globalAlpha = fade * 0.55;
    ctx.strokeStyle = '#61ffd8';
    ctx.lineWidth = zoom * 0.7;
    ctx.beginPath();
    ctx.moveTo(mid.x, mid.y);
    ctx.lineTo(mid.x + 4 * zoom, mid.y - 5 * zoom);
    ctx.lineTo(mid.x + 2 * zoom, mid.y - 8 * zoom);
    ctx.stroke();
    const end = points[i],
      size = (reducedMotion ? 2 : 3) * zoom;
    ctx.globalAlpha = fade;
    ctx.fillStyle = '#e8fff9';
    ctx.fillRect(end.x - size / 2, end.y - size / 2, size, size);
  }
  ctx.restore();
};
