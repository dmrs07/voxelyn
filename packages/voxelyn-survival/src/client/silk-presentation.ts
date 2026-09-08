import {
  suturePoint,
  silkLift,
  silkSupported,
  silkStrike,
  type Entity,
  type SurvivalState,
} from '@voxelyn/survival-sim';

type DrawItem = { depth: number; draw: () => void };
type Project = (x: number, y: number) => [number, number];

/** The ground mark is the authoritative strike footprint; the white cable is the support. */
export const appendSilkThreatDraws = (
  ctx: CanvasRenderingContext2D,
  state: SurvivalState,
  enemy: Entity,
  items: DrawItem[],
  project: Project,
  z: number,
  nowMs: number,
): void => {
  const a = enemy.action,
    f = a?.silkFlight;
  const queen = enemy.archetype === 'seamstress';
  if (!a || (!f && !(queen && a.kind === 'contact'))) return;
  const hit = silkStrike(enemy),
    radius = hit.radius,
    impactAt = f?.impactAt ?? a.releaseAt;
  const progress = Math.max(0, Math.min(1, (state.tick - a.startedAt) / (impactAt - a.startedAt)));
  const impact = state.tick >= impactAt;
  if (state.tick <= impactAt + 3)
    items.push({
      depth: hit.x + hit.y - 2,
      draw: () => {
        ctx.save();
        const color = impact ? '#fff0cd' : queen ? '#efaf66' : '#d68860';
        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        ctx.lineWidth = Math.max(1.5, z * 1.5);
        const ring = (r: number): void => {
          ctx.beginPath();
          for (let n = 0; n <= 24; n++) {
            const angle = (n / 24) * Math.PI * 2;
            const p = project(hit.x + Math.cos(angle) * r, hit.y + Math.sin(angle) * r);
            if (n) ctx.lineTo(...p);
            else ctx.moveTo(...p);
          }
          ctx.closePath();
        };
        ring(radius);
        ctx.globalAlpha = impact ? 0.75 : 0.12 + 0.18 * progress;
        ctx.fill();
        ctx.globalAlpha = 0.95;
        ctx.stroke();
        if (!impact) {
          ring(radius * (1 - progress));
          ctx.stroke();
          const p = project(hit.x, hit.y);
          ctx.beginPath();
          ctx.moveTo(p[0] - 3 * z, p[1]);
          ctx.lineTo(p[0] + 3 * z, p[1]);
          ctx.moveTo(p[0], p[1] - 2 * z);
          ctx.lineTo(p[0], p[1] + 2 * z);
          ctx.stroke();
        }
        ctx.restore();
      },
    });
  if (f?.anchor === undefined || !silkSupported(enemy, state.tick)) return;
  const anchor = suturePoint(state, f.anchor);
  const [ax, ay] = project(anchor.x, anchor.y);
  const [ex, ey] = project(enemy.x, enemy.y);
  items.push({
    // Above internal terrain, like the suspended body, with its mark on the support.
    depth: Math.max(anchor.x + anchor.y, enemy.x + enemy.y) + 2,
    draw: () => {
      ctx.save();
      const lift = 14 + silkLift(enemy, state.tick);
      ctx.lineWidth = 4 * z;
      ctx.strokeStyle = '#302920';
      ctx.beginPath();
      ctx.moveTo(ex, ey - lift * z);
      ctx.lineTo(ax, ay - 17 * z);
      ctx.stroke();
      ctx.lineWidth = 2 * z;
      ctx.strokeStyle = '#f2dec0';
      ctx.beginPath();
      ctx.moveTo(ex, ey - lift * z);
      ctx.lineTo(ax, ay - 17 * z);
      ctx.stroke();
      const pulse = 0.5 + 0.5 * Math.sin(nowMs / 130);
      ctx.strokeStyle = '#efaf66';
      ctx.lineWidth = (1.5 + pulse) * z;
      ctx.beginPath();
      ctx.moveTo(ax, ay - 24 * z);
      ctx.lineTo(ax + 5 * z, ay - 17 * z);
      ctx.lineTo(ax, ay - 10 * z);
      ctx.lineTo(ax - 5 * z, ay - 17 * z);
      ctx.closePath();
      ctx.stroke();
      ctx.restore();
    },
  });
};
