import { suturePoint, SUTURE_FALL_WARNING, type SurvivalState } from '@voxelyn/survival-sim';
import { drawVoxel } from './voxel-draw';
import { appendSilkThreatDraws } from './silk-presentation';
import {
  appendSeamstressThreadDraws,
  appendWebDraws,
  appendWebSupportDraws,
  appendWebRepairDraws,
} from './web-presentation';
type DrawItem = { depth: number; draw: () => void };
type Project = (x: number, y: number) => [number, number];
const SUPPORT_COLOR = '#e0a45b';

/** Colony hazards stay outside the boss chamber. */
export const appendSutureDraws = (
  ctx: CanvasRenderingContext2D,
  state: SurvivalState,
  items: DrawItem[],
  project: Project,
  z: number,
  brightness: (x: number, y: number) => number,
  nowMs = 0,
): void => {
  // A teia da segunda fase tem desenho proprio (web-presentation.ts).
  appendWebDraws(ctx, state, items, project, z, brightness, nowMs);
  appendWebSupportDraws(ctx, state, items, project, z, brightness);
  for (const s of state.sutures) {
    if (s.encounter || s.phase === 'spent' || s.kind === 'web') continue;
    const horizontal =
      Math.floor(s.a / state.config.width) === Math.floor(s.b / state.config.width);
    const loaded = false;
    for (const i of s.cells) {
      const p = suturePoint(state, i);
      if (brightness(p.x, p.y) <= 0.05) continue;
      const warning = s.phase === 'cut' && s.whipAt > state.tick;
      const closing = s.closeAt > state.tick;
      const color =
        warning || closing || loaded ? SUPPORT_COLOR : s.objective ? '#c3af83' : '#d5cdbc';
      const [sx, sy] = project(p.x, p.y);
      if (warning || closing || (s.fallAt > state.tick && s.slabCells.includes(i))) {
        items.push({
          depth: p.x + p.y - 0.48,
          draw: () => {
            ctx.save();
            ctx.strokeStyle = '#f0a867';
            ctx.lineWidth = 1.5 * z;
            const corners = [
              [p.x - 0.46, p.y - 0.46],
              [p.x + 0.46, p.y - 0.46],
              [p.x + 0.46, p.y + 0.46],
              [p.x - 0.46, p.y + 0.46],
            ];
            ctx.beginPath();
            for (const [n, c] of corners.entries()) {
              const q = project(c[0], c[1]);
              if (n) ctx.lineTo(...q);
              else ctx.moveTo(...q);
            }
            ctx.closePath();
            ctx.stroke();
            // A cross marks the falling mass; line-only cells mark the whip.
            if (s.slabCells.includes(i)) {
              ctx.beginPath();
              ctx.moveTo(sx - 3 * z, sy - 2 * z);
              ctx.lineTo(sx + 3 * z, sy + 2 * z);
              ctx.moveTo(sx + 3 * z, sy - 2 * z);
              ctx.lineTo(sx - 3 * z, sy + 2 * z);
              ctx.stroke();
            }
            ctx.restore();
          },
        });
      }
      items.push({
        depth: p.x + p.y,
        draw: () => {
          ctx.save();
          const sag = s.phase === 'loose' ? 5 * z : 0;
          const a = project(p.x - (horizontal ? 0.5 : 0), p.y - (horizontal ? 0 : 0.5));
          const b = project(p.x + (horizontal ? 0.5 : 0), p.y + (horizontal ? 0 : 0.5));
          if (s.phase !== 'cut' || warning) {
            ctx.strokeStyle = '#4b4540';
            ctx.lineWidth = 3 * z;
            ctx.beginPath();
            ctx.moveTo(a[0], a[1] - 9 * z + sag);
            ctx.lineTo(b[0], b[1] - 9 * z + sag);
            ctx.stroke();
            ctx.strokeStyle = color;
            ctx.lineWidth = z;
            ctx.beginPath();
            ctx.moveTo(a[0], a[1] - 10 * z + sag);
            ctx.lineTo(b[0], b[1] - 10 * z + sag);
            ctx.stroke();
            ctx.fillStyle = color;
            ctx.fillRect(Math.round(sx - z), Math.round(sy - 11 * z + sag), 2 * z, 3 * z);
          }
          if (
            s.kind === 'roof' &&
            s.slabCells.includes(i) &&
            (s.phase === 'taut' || s.fallAt > state.tick)
          ) {
            const descent =
              s.fallAt > state.tick
                ? Math.max(0, 1 - (s.fallAt - state.tick) / SUTURE_FALL_WARNING)
                : 0;
            const lift = (18 - 16 * descent * descent) * z;
            drawVoxel(ctx, sx, sy - lift, 12 * z, ['#7f8180', '#3c454b', '#596269']);
            ctx.fillStyle = s.objective ? '#d3b578' : '#d5cdbc';
            ctx.fillRect(Math.round(sx - z), Math.round(sy - lift - 7 * z), 2 * z, 9 * z);
          }
          ctx.restore();
        },
      });
    }
  }
  for (const enemy of state.enemies)
    if (enemy.alive && brightness(enemy.x, enemy.y) > 0.05) {
      appendSilkThreatDraws(ctx, state, enemy, items, project, z, nowMs);
      if (enemy.archetype === 'stitcher')
        appendWebRepairDraws(ctx, state, enemy, items, project, z);
      if (enemy.archetype === 'seamstress')
        appendSeamstressThreadDraws(ctx, state, enemy, items, project, z, nowMs);
    }
};
