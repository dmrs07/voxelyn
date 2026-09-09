import {
  isWebStrand,
  seamstressHidden,
  silkLift,
  webRepairProgress,
  webSupports,
  webSupportMaxHp,
  suturePoint,
  SEAMSTRESS_STAGE_ALOFT,
  SEAMSTRESS_STAGE_ASCENDING,
  SEAMSTRESS_STAGE_DESCENDING,
  SEAMSTRESS_STAGE_FRENZY,
  type Entity,
  type SurvivalState,
} from '@voxelyn/survival-sim';

type DrawItem = { depth: number; draw: () => void };
type Project = (x: number, y: number) => [number, number];

/** A seda da teia, o fio cortado a espera de reparo e a costura em andamento. */
const SILK = '#e6dccb';
const SILK_SHADOW = '#2b2622';
const LOOSE = '#8a7a62';
const REPAIR = '#f0c27a';
/** Quanto o fio flutua acima do chao, em pixels de zoom 1: e uma teia rasteira. */
const WEB_LIFT = 3;

/**
 * A TEIA DA SEGUNDA FASE, no chao da camara.
 *
 * Tres coisas, e cada uma responde a uma pergunta do jogador. A FAIXA
 * translucida sob cada fio inteiro e "onde eu ando devagar" — some no tick em
 * que o fio e cortado, porque e da integridade do fio que a simulacao le a
 * lentidao. O FIO e o alvo do tiro. O fio CORTADO fica como um fantasma
 * pontilhado (a passagem esta aberta) e, quando um Costureiro o refaz, a
 * costura cresce de uma ponta a outra na cor do reparo, no mesmo relogio da
 * barra acima do Costureiro: dois segundos para interromper um fio.
 */
export const appendWebDraws = (
  ctx: CanvasRenderingContext2D,
  state: SurvivalState,
  items: DrawItem[],
  project: Project,
  z: number,
  brightness: (x: number, y: number) => number,
  nowMs: number,
): void => {
  for (const s of state.sutures) {
    if (!isWebStrand(s) || s.phase === 'spent') continue;
    const a = suturePoint(state, s.cells[0]),
      b = suturePoint(state, s.cells[s.cells.length - 1]);
    if (brightness(a.x, a.y) <= 0.05 && brightness(b.x, b.y) <= 0.05) continue;
    if (s.phase === 'taut') {
      for (const i of s.slabCells) {
        const p = suturePoint(state, i);
        if (brightness(p.x, p.y) <= 0.05) continue;
        items.push({
          // Chao: abaixo de qualquer corpo ou aviso na mesma celula.
          depth: p.x + p.y - 0.6,
          draw: () => {
            ctx.save();
            ctx.fillStyle = SILK;
            ctx.globalAlpha = 0.14;
            const c = [
              project(p.x - 0.5, p.y - 0.5),
              project(p.x + 0.5, p.y - 0.5),
              project(p.x + 0.5, p.y + 0.5),
              project(p.x - 0.5, p.y + 0.5),
            ];
            ctx.beginPath();
            ctx.moveTo(c[0][0], c[0][1]);
            for (let n = 1; n < 4; n++) ctx.lineTo(c[n][0], c[n][1]);
            ctx.closePath();
            ctx.fill();
            ctx.restore();
          },
        });
      }
    }
    const [ax, ay] = project(a.x, a.y),
      [bx, by] = project(b.x, b.y);
    items.push({
      depth: (a.x + a.y + b.x + b.y) / 2 - 0.3,
      draw: () => {
        ctx.save();
        if (s.phase === 'taut') {
          ctx.lineWidth = 2.5 * z;
          ctx.strokeStyle = SILK_SHADOW;
          ctx.beginPath();
          ctx.moveTo(ax, ay - (WEB_LIFT - 1) * z);
          ctx.lineTo(bx, by - (WEB_LIFT - 1) * z);
          ctx.stroke();
          ctx.lineWidth = Math.max(1, z);
          ctx.strokeStyle = SILK;
          ctx.beginPath();
          ctx.moveTo(ax, ay - WEB_LIFT * z);
          ctx.lineTo(bx, by - WEB_LIFT * z);
          ctx.stroke();
          ctx.fillStyle = SILK;
          for (const [px, py] of [
            [ax, ay],
            [bx, by],
          ])
            ctx.fillRect(Math.round(px - z), Math.round(py - (WEB_LIFT + 1) * z), 2 * z, 2 * z);
        } else {
          // Cortado: o fantasma do fio, e por cima a costura em andamento.
          ctx.globalAlpha = 0.35;
          ctx.strokeStyle = LOOSE;
          ctx.lineWidth = Math.max(1, z);
          ctx.setLineDash([2 * z, 3 * z]);
          ctx.beginPath();
          ctx.moveTo(ax, ay - WEB_LIFT * z);
          ctx.lineTo(bx, by - WEB_LIFT * z);
          ctx.stroke();
          ctx.setLineDash([]);
          const progress = Math.max(
            s.tension / 100,
            ...state.enemies.map((e) =>
              e.webRepair?.kind === 'strand' && e.webRepair.target === s.id
                ? (webRepairProgress(state, e) ?? 0)
                : 0,
            ),
          );
          if (progress > 0) {
            const t = progress;
            const pulse = 0.7 + 0.3 * Math.sin(nowMs / 90);
            ctx.globalAlpha = pulse;
            ctx.strokeStyle = REPAIR;
            ctx.lineWidth = 2 * z;
            ctx.beginPath();
            ctx.moveTo(ax, ay - WEB_LIFT * z);
            ctx.lineTo(ax + (bx - ax) * t, ay - WEB_LIFT * z + (by - ay) * t);
            ctx.stroke();
          }
        }
        ctx.restore();
      },
    });
  }
};

/** Reinforced knots stay visible when broken, so their reconstruction has a clear target. */
export const appendWebSupportDraws = (
  ctx: CanvasRenderingContext2D,
  state: SurvivalState,
  items: DrawItem[],
  project: Project,
  z: number,
  brightness: (x: number, y: number) => number,
): void => {
  for (const support of webSupports(state)) {
    if (support.kind !== 'junction') continue;
    if (
      !state.sutures.some(
        (s) =>
          s.kind === 'web' && s.phase !== 'spent' && (s.a === support.cell || s.b === support.cell),
      )
    )
      continue;
    const p = suturePoint(state, support.cell);
    if (brightness(p.x, p.y) <= 0.05) continue;
    const [sx, sy] = project(p.x, p.y);
    items.push({
      depth: p.x + p.y - 0.1,
      draw: () => {
        ctx.save();
        ctx.fillStyle = SILK_SHADOW;
        ctx.fillRect(sx - 3 * z, sy - 6 * z, 6 * z, 6 * z);
        ctx.fillStyle = support.hp === webSupportMaxHp(support) ? SILK : REPAIR;
        // One pip per remaining impact; an empty frame identifies a broken knot.
        for (let n = 0; n < support.hp; n++)
          ctx.fillRect(sx + (n * 2 - 2.5) * z, sy - 5 * z, z, 4 * z);
        ctx.restore();
      },
    });
  }
};

/** A short amber channel bar above the head, driven by the authoritative action clock. */
export const appendWebRepairDraws = (
  ctx: CanvasRenderingContext2D,
  state: SurvivalState,
  worker: Entity,
  items: DrawItem[],
  project: Project,
  z: number,
): void => {
  const progress = webRepairProgress(state, worker);
  if (progress === null) return;
  const [sx, sy] = project(worker.x, worker.y);
  items.push({
    depth: worker.x + worker.y + 1,
    draw: () => {
      ctx.save();
      ctx.fillStyle = '#171c23';
      ctx.fillRect(sx - 10 * z, sy - 36 * z, 20 * z, 5 * z);
      ctx.fillStyle = '#65543c';
      ctx.fillRect(sx - 9 * z, sy - 35 * z, 18 * z, 3 * z);
      ctx.fillStyle = REPAIR;
      ctx.fillRect(sx - 9 * z, sy - 35 * z, 18 * z * progress, 3 * z);
      ctx.restore();
    },
  });
};

/**
 * O FIO VERTICAL da subida e da descida: do corpo ate fora da tela. Enquanto
 * ela esta fora, o fio continua no lugar onde ela sumiu, esticado — e o aviso
 * de que ela vai voltar por ele.
 */
export const appendSeamstressThreadDraws = (
  ctx: CanvasRenderingContext2D,
  state: SurvivalState,
  queen: Entity,
  items: DrawItem[],
  project: Project,
  z: number,
  nowMs: number,
): void => {
  const stage = queen.silk?.stage ?? 0;
  if (
    stage !== SEAMSTRESS_STAGE_ASCENDING &&
    stage !== SEAMSTRESS_STAGE_ALOFT &&
    stage !== SEAMSTRESS_STAGE_DESCENDING
  )
    return;
  const [sx, sy] = project(queen.x, queen.y);
  const lift = seamstressHidden(queen) ? 0 : silkLift(queen, state.tick);
  items.push({
    depth: queen.x + queen.y + 2.5,
    draw: () => {
      ctx.save();
      const sway = Math.sin(nowMs / 400) * 1.5 * z;
      const top = -ctx.canvas.height;
      ctx.lineWidth = 3 * z;
      ctx.strokeStyle = SILK_SHADOW;
      ctx.globalAlpha = 0.8;
      ctx.beginPath();
      ctx.moveTo(sx, sy - (lift + 16) * z);
      ctx.lineTo(sx + sway, top);
      ctx.stroke();
      ctx.lineWidth = Math.max(1, 1.2 * z);
      ctx.strokeStyle = SILK;
      ctx.globalAlpha = stage === SEAMSTRESS_STAGE_ALOFT ? 0.55 + 0.25 * Math.sin(nowMs / 250) : 1;
      ctx.beginPath();
      ctx.moveTo(sx, sy - (lift + 16) * z);
      ctx.lineTo(sx + sway, top);
      ctx.stroke();
      ctx.restore();
    },
  });
};

/**
 * OS OLHOS VERMELHOS do frenesi. O atlas nao tem olhos (a Cerzideira nunca
 * teve um olho luminoso), entao o sinal e desenhado por cima do sprite, na
 * cabeca: dois pontos com halo, pulsando. Sem novo atlas — o orcamento de
 * memoria sob demanda nao cabe outra animacao de oito rumos.
 */
export const drawSeamstressEyes = (
  ctx: CanvasRenderingContext2D,
  headX: number,
  headY: number,
  facingX: number,
  z: number,
  nowMs: number,
): void => {
  const pulse = 0.65 + 0.35 * Math.sin(nowMs / 110);
  const gap = 2.6 * z;
  // Olhando para a esquerda ou direita, um olho fica atras do outro.
  const spread = Math.abs(facingX) > 0.85 ? 0.35 : 1;
  ctx.save();
  for (const side of [-1, 1]) {
    const x = headX + side * gap * spread,
      y = headY;
    ctx.fillStyle = '#ff3b30';
    ctx.globalAlpha = 0.28 * pulse;
    ctx.beginPath();
    ctx.moveTo(x, y - 3.5 * z);
    ctx.lineTo(x + 3.5 * z, y);
    ctx.lineTo(x, y + 3.5 * z);
    ctx.lineTo(x - 3.5 * z, y);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 0.95;
    ctx.fillRect(Math.round(x - 0.9 * z), Math.round(y - 0.9 * z), 1.8 * z, 1.8 * z);
  }
  ctx.restore();
};

export const seamstressFrenzyStage = SEAMSTRESS_STAGE_FRENZY;
