import {
  suturePoint,
  silkLift,
  silkSupported,
  silkStrike,
  SEAMSTRESS_NET_RADIUS,
  SEAMSTRESS_NET_RANGE,
  SILK_CUT_EXPOSED_FROM,
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
  // A REDE sendo carregada: a faixa do arremesso, num dos oito rumos, com a
  // largura do disco, enchendo ate o release. E o aviso de sair da linha.
  if (queen && a?.kind === 'ranged' && state.tick < a.releaseAt) {
    const progress = Math.max(
      0,
      Math.min(1, (state.tick - a.startedAt) / Math.max(1, a.releaseAt - a.startedAt)),
    );
    const dir = a.direction,
      side = { x: -dir.y, y: dir.x },
      half = SEAMSTRESS_NET_RADIUS,
      reach = SEAMSTRESS_NET_RANGE;
    const at = (along: number, lateral: number): [number, number] =>
      project(
        enemy.x + dir.x * along + side.x * lateral,
        enemy.y + dir.y * along + side.y * lateral,
      );
    items.push({
      depth: enemy.x + enemy.y - 0.5,
      draw: () => {
        ctx.save();
        ctx.fillStyle = '#e6dccb';
        ctx.globalAlpha = 0.08 + 0.16 * progress;
        ctx.beginPath();
        ctx.moveTo(...at(0.8, -half));
        ctx.lineTo(...at(reach * (0.3 + 0.7 * progress), -half));
        ctx.lineTo(...at(reach * (0.3 + 0.7 * progress), half));
        ctx.lineTo(...at(0.8, half));
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = 0.5 + 0.4 * progress;
        ctx.strokeStyle = '#e6dccb';
        ctx.lineWidth = Math.max(1, z);
        for (const lateral of [-half, half]) {
          ctx.beginPath();
          ctx.moveTo(...at(0.8, lateral));
          ctx.lineTo(...at(reach, lateral));
          ctx.stroke();
        }
        ctx.restore();
      },
    });
    return;
  }
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
  // Onde o fio passa a ser CORTAVEL: a mesma distancia do corpo que a
  // simulacao exige do tiro (`cutsTether`). O trecho colado ao corpo e
  // desenhado escuro, o exposto claro — o jogador mira no claro.
  const cable = Math.hypot(anchor.x - enemy.x, anchor.y - enemy.y) || 1;
  const split = Math.min(1, SILK_CUT_EXPOSED_FROM / cable);
  const [sx, sy] = project(
    enemy.x + (anchor.x - enemy.x) * split,
    enemy.y + (anchor.y - enemy.y) * split,
  );
  items.push({
    // Above internal terrain, like the suspended body, with its mark on the support.
    depth: Math.max(anchor.x + anchor.y, enemy.x + enemy.y) + 2,
    draw: () => {
      ctx.save();
      const lift = 14 + silkLift(enemy, state.tick);
      const splitLift = lift + (17 - lift) * split;
      ctx.lineWidth = 4 * z;
      ctx.strokeStyle = '#302920';
      ctx.beginPath();
      ctx.moveTo(ex, ey - lift * z);
      ctx.lineTo(ax, ay - 17 * z);
      ctx.stroke();
      // O trecho protegido, do abdome ate a marca de corte.
      ctx.lineWidth = 2 * z;
      ctx.strokeStyle = '#8a7a62';
      ctx.beginPath();
      ctx.moveTo(ex, ey - lift * z);
      ctx.lineTo(sx, sy - splitLift * z);
      ctx.stroke();
      // O trecho exposto, ate a ancora.
      ctx.strokeStyle = '#f2dec0';
      ctx.beginPath();
      ctx.moveTo(sx, sy - splitLift * z);
      ctx.lineTo(ax, ay - 17 * z);
      ctx.stroke();
      // Um no marca onde o corte comeca a valer. Losango, e nao arco: as
      // pranchas de revisao desenham com um canvas minimo, sem `arc`.
      const ky = sy - splitLift * z,
        k = 1.8 * z;
      ctx.fillStyle = '#f2dec0';
      ctx.beginPath();
      ctx.moveTo(sx, ky - k);
      ctx.lineTo(sx + k, ky);
      ctx.lineTo(sx, ky + k);
      ctx.lineTo(sx - k, ky);
      ctx.closePath();
      ctx.fill();
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
