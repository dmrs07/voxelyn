import {
  suturePoint,
  loadedSutureAnchor,
  tetherEndpoint,
  SUTURE_FALL_WARNING,
  type Entity,
  type SurvivalState,
  type Suture,
} from '@voxelyn/survival-sim';
import { drawVoxel } from './voxel-draw';

type DrawItem = { depth: number; draw: () => void };
type Project = (x: number, y: number) => [number, number];

/** A cor do apoio carregado e do aviso da faixa: o mesmo ambar dos avisos de chicote. */
const SUPPORT_COLOR = '#e0a45b';
const STRIDE_COLOR = '#f5d38a';

/**
 * A FAIXA DA PUXADA, no chao, com a largura do corpo.
 *
 * O aviso antigo era o fio da amarra mudando de cor: fino, no ar, e sem dizer
 * por onde o corpo de 1,44 de largura ia passar. A faixa vai do corpo ao
 * ponto onde a puxada termina (`tetherEndpoint`, o mesmo da simulacao), com
 * meia-largura igual ao raio dela — quem esta dentro leva os 20 de dano. No
 * preparo ela enche aos poucos (o tempo que resta para sair da frente); no
 * arranque acende e encurta atras do corpo, que ja esta passando.
 */
export const appendTetherLane = (
  ctx: CanvasRenderingContext2D,
  state: SurvivalState,
  queen: Entity,
  support: Suture,
  items: DrawItem[],
  project: Project,
  z: number,
  nowMs: number,
): void => {
  const action = queen.action;
  if (action?.kind !== 'tether') return;
  const end = tetherEndpoint(state, queen, support);
  const dx = end.x - queen.x,
    dy = end.y - queen.y,
    len = Math.hypot(dx, dy);
  if (len < 0.5) return;
  const dir = { x: dx / len, y: dy / len },
    side = { x: -dir.y, y: dir.x },
    half = queen.radius;
  const windup = action.phase === 'windup';
  const progress = windup
    ? Math.min(
        1,
        Math.max(0, (state.tick - action.startedAt) / (action.releaseAt - action.startedAt || 1)),
      )
    : 1;
  const pulse = 0.5 + 0.5 * Math.sin(nowMs / 90);
  const at = (along: number, lateral: number): [number, number] =>
    project(queen.x + dir.x * along + side.x * lateral, queen.y + dir.y * along + side.y * lateral);
  const midX = queen.x + dx * 0.5,
    midY = queen.y + dy * 0.5;
  items.push({
    // Meio passo atras do chao onde ela vai passar: e chao, e nao corpo.
    depth: midX + midY - len * 0.5 - 0.5,
    draw: () => {
      ctx.save();
      const color = windup ? SUPPORT_COLOR : STRIDE_COLOR;
      // O preenchimento cresce do corpo para o destino durante o preparo.
      const reach = windup ? len * (0.35 + 0.65 * progress) : len;
      ctx.fillStyle = color;
      ctx.globalAlpha = windup ? 0.1 + 0.16 * progress : 0.26 + 0.1 * pulse;
      ctx.beginPath();
      ctx.moveTo(...at(0, -half));
      ctx.lineTo(...at(reach, -half));
      ctx.lineTo(...at(reach, half));
      ctx.lineTo(...at(0, half));
      ctx.closePath();
      ctx.fill();
      // As bordas percorrem a faixa inteira desde o primeiro quadro: a
      // largura e a informacao, e ela nao pode esperar o preenchimento.
      ctx.globalAlpha = windup ? 0.45 + 0.35 * progress : 0.9;
      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(1, z);
      for (const lateral of [-half, half]) {
        ctx.beginPath();
        ctx.moveTo(...at(0, lateral));
        ctx.lineTo(...at(len, lateral));
        ctx.stroke();
      }
      // A ponta: onde o corpo para.
      ctx.beginPath();
      ctx.moveTo(...at(len, -half));
      ctx.lineTo(...at(len, half));
      ctx.lineWidth = Math.max(1.5, 2 * z);
      ctx.stroke();
      ctx.restore();
    },
  });
};

/**
 * O APOIO CARREGADO, marcado no chao: a ancora que sustenta a puxada. E o que
 * o jogador precisa reconhecer de imediato — romper a ancora ou cortar a
 * amarra e o que derruba a Cerzideira —, e nem a ancora nem a amarra se
 * distinguiam das outras suturas da sala.
 */
const appendLoadedAnchorMark = (
  ctx: CanvasRenderingContext2D,
  anchor: { x: number; y: number },
  items: DrawItem[],
  project: Project,
  z: number,
  nowMs: number,
): void => {
  const pulse = 0.5 + 0.5 * Math.sin(nowMs / 140);
  items.push({
    depth: anchor.x + anchor.y + 0.52,
    draw: () => {
      ctx.save();
      ctx.strokeStyle = SUPPORT_COLOR;
      ctx.globalAlpha = 0.55 + 0.45 * pulse;
      ctx.lineWidth = Math.max(1.5, 1.5 * z);
      const r = 0.62 + 0.1 * pulse;
      const corners: Array<[number, number]> = [
        [anchor.x - r, anchor.y - r],
        [anchor.x + r, anchor.y - r],
        [anchor.x + r, anchor.y + r],
        [anchor.x - r, anchor.y + r],
      ];
      ctx.beginPath();
      corners.forEach((c, n) => {
        const q = project(c[0], c[1]);
        if (n) ctx.lineTo(q[0], q[1]);
        else ctx.moveTo(q[0], q[1]);
      });
      ctx.closePath();
      ctx.stroke();
      ctx.restore();
    },
  });
};

/** Per-cell depth sorting: a cable behind a wall stays behind that wall. */
export const appendSutureDraws = (
  ctx: CanvasRenderingContext2D,
  state: SurvivalState,
  items: DrawItem[],
  project: Project,
  z: number,
  brightness: (x: number, y: number) => number,
  nowMs = 0,
): void => {
  // A sutura que sustenta a Cerzideira agora, se ha uma: desenhada com a cor
  // do apoio, para que se distinga das demais antes mesmo da puxada.
  const loadedIds = new Set<number>();
  for (const queen of state.enemies)
    if (queen.alive && queen.archetype === 'seamstress' && queen.mood)
      loadedIds.add(queen.mood - 1);
  for (const s of state.sutures) {
    if (s.phase === 'spent') continue;
    const horizontal =
      Math.floor(s.a / state.config.width) === Math.floor(s.b / state.config.width);
    const loaded = s.phase === 'taut' && loadedIds.has(s.id);
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
  for (const queen of state.enemies) {
    if (
      !queen.alive ||
      queen.archetype !== 'seamstress' ||
      !queen.mood ||
      brightness(queen.x, queen.y) <= 0.05
    )
      continue;
    const support = state.sutures.find((s) => s.id + 1 === queen.mood && s.phase === 'taut');
    if (!support) continue;
    const p = loadedSutureAnchor(state, queen, support);
    appendLoadedAnchorMark(ctx, p, items, project, z, nowMs);
    appendTetherLane(ctx, state, queen, support, items, project, z, nowMs);
    // The loaded support is visibly attached to the abdomen, including during windup.
    // Mais grossa que os fios da sala, com uma sombra por baixo: e a linha
    // que o tiro precisa cruzar, e precisa ler como alvo.
    const distance = Math.hypot(p.x - queen.x, p.y - queen.y);
    const windup = queen.action?.phase === 'windup';
    const pulse = 0.5 + 0.5 * Math.sin(nowMs / 90);
    for (let n = 0; n < Math.ceil(distance * 2); n++) {
      const t = n / Math.ceil(distance * 2),
        t2 = (n + 1) / Math.ceil(distance * 2);
      const x = queen.x + (p.x - queen.x) * t,
        y = queen.y + (p.y - queen.y) * t;
      items.push({
        depth: x + y,
        draw: () => {
          const a = project(x, y),
            b = project(queen.x + (p.x - queen.x) * t2, queen.y + (p.y - queen.y) * t2);
          ctx.save();
          ctx.strokeStyle = '#2b2622';
          ctx.lineWidth = 4 * z;
          ctx.beginPath();
          ctx.moveTo(a[0], a[1] - 17 * z);
          ctx.lineTo(b[0], b[1] - 17 * z);
          ctx.stroke();
          ctx.strokeStyle = windup ? SUPPORT_COLOR : '#e2d9c7';
          ctx.globalAlpha = windup ? 0.7 + 0.3 * pulse : 1;
          ctx.lineWidth = 2 * z;
          ctx.beginPath();
          ctx.moveTo(a[0], a[1] - 17 * z);
          ctx.lineTo(b[0], b[1] - 17 * z);
          ctx.stroke();
          ctx.restore();
        },
      });
    }
  }
};
