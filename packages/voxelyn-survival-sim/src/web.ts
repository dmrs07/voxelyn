// A TEIA da segunda fase da Cerzideira: uma espiral inspirada na de Fibonacci,
// sustentada por raios, tecida fio a fio enquanto ela esta fora da tela.
//
// Cada fio e uma sutura de `kind: 'web'`, e essa escolha e a razao de o
// arquivo ser pequeno: o corte pelo tiro (`hitSutures`), o reparo pelos
// Costureiros (`sewSuture`/`sewJob`), o hash, o snapshot e a reconexao ja
// existem para suturas. O que a teia acrescenta e a geometria, a ordem de
// tecelagem e o chao pegajoso.
import { SOLID_NONE } from './constants.js';
import { createSutures, suturePoint } from './sutures.js';
import type { Entity, SemanticEvent, SurvivalState, Suture, SutureRecipe, Vec2 } from './types.js';

/** Velocidade do Prospector sobre um fio inteiro: devagar, mas ainda esquiva. */
export const WEB_SLOW = 0.62;
/** Quanto dura a tecelagem inicial (8 s): o tempo de ler onde vai ficar lento. */
export const WEB_WEAVE_TICKS = 160;
/** Pausa entre ela sumir e o primeiro fio: o silencio de "algo esta sendo preparado". */
export const WEB_WEAVE_DELAY = 16;
/** Raio da teia a partir do centro da camara, em tiles. */
export const WEB_RADIUS = 13;
/** Raios de sustentacao, no angulo de ouro: nunca dois alinhados. */
export const WEB_SPOKES = 5;
/** Largura da faixa pegajosa de cada fio, em tiles a partir da linha. */
export const WEB_STICKY_REACH = 1;
const PHI = (1 + Math.sqrt(5)) / 2;
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

export const isWebStrand = (s: SutureRecipe): boolean => s.kind === 'web';

/** As celulas de chao entre dois pontos; para na primeira parede. */
const rasterize = (state: SurvivalState, from: Vec2, to: Vec2): number[] => {
  const w = state.config.width,
    h = state.config.height;
  const cells: number[] = [];
  const len = Math.hypot(to.x - from.x, to.y - from.y);
  const steps = Math.max(1, Math.ceil(len / 0.3));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = Math.floor(from.x + (to.x - from.x) * t),
      y = Math.floor(from.y + (to.y - from.y) * t);
    if (x < 1 || y < 1 || x >= w - 1 || y >= h - 1) break;
    const c = y * w + x;
    if (state.solid[c] !== SOLID_NONE) break;
    if (cells[cells.length - 1] !== c) cells.push(c);
  }
  return cells;
};

/** A faixa pegajosa: as celulas de chao a ate `WEB_STICKY_REACH` do segmento. */
const stickyBand = (state: SurvivalState, cells: number[]): number[] => {
  const w = state.config.width,
    h = state.config.height;
  const a = suturePoint(state, cells[0]),
    b = suturePoint(state, cells[cells.length - 1]);
  const dx = b.x - a.x,
    dy = b.y - a.y,
    len2 = dx * dx + dy * dy || 1;
  const band = new Set<number>(cells);
  const minX = Math.max(1, Math.floor(Math.min(a.x, b.x) - WEB_STICKY_REACH - 1)),
    maxX = Math.min(w - 2, Math.ceil(Math.max(a.x, b.x) + WEB_STICKY_REACH + 1)),
    minY = Math.max(1, Math.floor(Math.min(a.y, b.y) - WEB_STICKY_REACH - 1)),
    maxY = Math.min(h - 2, Math.ceil(Math.max(a.y, b.y) + WEB_STICKY_REACH + 1));
  for (let y = minY; y <= maxY; y++)
    for (let x = minX; x <= maxX; x++) {
      const c = y * w + x;
      if (state.solid[c] !== SOLID_NONE) continue;
      const px = x + 0.5,
        py = y + 0.5;
      const t = Math.max(0, Math.min(1, ((px - a.x) * dx + (py - a.y) * dy) / len2));
      if (Math.hypot(px - a.x - dx * t, py - a.y - dy * t) <= WEB_STICKY_REACH) band.add(c);
    }
  return [...band];
};

/** Divide uma polilinha em fios de ~`length` tiles, cada um reto e sem parede no meio. */
const strandsAlong = (
  state: SurvivalState,
  points: Vec2[],
  length: (at: Vec2) => number,
  out: Array<Omit<SutureRecipe, 'id'>>,
): void => {
  let start = 0,
    travelled = 0;
  for (let i = 1; i < points.length; i++) {
    travelled += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
    const last = i === points.length - 1;
    if (travelled < length(points[start]) && !last) continue;
    const cells = rasterize(state, points[start], points[i]);
    if (cells.length >= 2)
      out.push({
        a: cells[0],
        b: cells[cells.length - 1],
        cells,
        slabCells: stickyBand(state, cells),
        kind: 'web',
        objective: false,
      });
    start = i;
    travelled = 0;
  }
};

/**
 * O DESENHO: cinco raios de sustentacao no angulo de ouro, do centro ate a
 * parede, e por cima uma espiral logaritmica de razao de ouro — a espiral
 * das caixas de Fibonacci, sem as caixas, com a razao aplicada por meia
 * volta para caber na camara. Os raios vem primeiro na ordem de tecelagem:
 * uma teia comeca pela estrutura, e o jogador le a estrutura antes do resto.
 * A geometria para nas paredes; fios com menos de duas celulas de chao nao
 * existem.
 */
export const designWeb = (state: SurvivalState, center: Vec2): Array<Omit<SutureRecipe, 'id'>> => {
  const out: Array<Omit<SutureRecipe, 'id'>> = [];
  for (let k = 0; k < WEB_SPOKES; k++) {
    const angle = 0.4 + k * GOLDEN_ANGLE;
    const points: Vec2[] = [];
    for (let r = 1; r <= WEB_RADIUS + 4; r += 0.5)
      points.push({ x: center.x + Math.cos(angle) * r, y: center.y + Math.sin(angle) * r });
    strandsAlong(state, points, () => 4, out);
  }
  // Dois bracos da mesma espiral, meia volta um do outro, crescendo um fator
  // de ouro por MEIA volta (r = r0 * phi^(theta / pi)). A espiral de ouro
  // estrita cresce por quarto de volta e da duas voltas e meia num raio de
  // 13 — rala demais para pegar alguem. Assim ela da cinco, a teia le como
  // teia, e ainda deixa os vaos que o jogador aprende a usar.
  const r0 = 1.4;
  for (const arm of [0, Math.PI]) {
    const points: Vec2[] = [];
    for (let theta = 0; ; ) {
      const r = r0 * Math.pow(PHI, theta / Math.PI);
      if (r > WEB_RADIUS) break;
      points.push({
        x: center.x + Math.cos(theta + arm) * r,
        y: center.y + Math.sin(theta + arm) * r,
      });
      theta += Math.min(0.9, 0.6 / r);
    }
    strandsAlong(
      state,
      points,
      (at) => Math.max(1.6, Math.min(3.6, Math.hypot(at.x - center.x, at.y - center.y) * 0.8)),
      out,
    );
  }
  return out;
};

/**
 * Cria os fios como suturas `web`, ainda nao tecidos (`spent`), cada um com o
 * tick em que passa a existir em `resewAt`. A ordem e a do desenho.
 */
export const spinWeb = (state: SurvivalState, center: Vec2, from: number): number => {
  const recipes = designWeb(state, center);
  let id = state.sutures.reduce((m, s) => Math.max(m, s.id), -1) + 1;
  const strands = createSutures(recipes.map((r) => ({ ...r, id: id++ })));
  strands.forEach((s, n) => {
    s.phase = 'spent';
    s.tension = 0;
    s.resewAt = from + WEB_WEAVE_DELAY + Math.floor((n * WEB_WEAVE_TICKS) / strands.length);
  });
  state.sutures.push(...strands);
  return from + WEB_WEAVE_DELAY + WEB_WEAVE_TICKS;
};

/** Um fio por vez, no tick marcado: nasce inteiro, com som e chao pegajoso. */
export const weaveWeb = (state: SurvivalState, events: SemanticEvent[]): void => {
  for (const s of state.sutures) {
    if (!isWebStrand(s) || s.phase !== 'spent' || s.resewAt < 0 || state.tick < s.resewAt) continue;
    s.phase = 'taut';
    s.tension = 100;
    s.resewAt = -1;
    events.push({ t: 'suture', phase: 'taut', id: s.id, ...suturePoint(state, s.cells[0]) });
  }
};

/** A teia inteira some: a Cerzideira caiu, e o chao volta a ser chao. */
export const dissolveWeb = (state: SurvivalState): void => {
  for (const s of state.sutures)
    if (isWebStrand(s)) {
      s.phase = 'spent';
      s.tension = 0;
      s.resewAt = -1;
    }
};

/** A celula esta sob um fio INTEIRO da teia? Fios cortados nao pegam. */
export const webCovers = (state: SurvivalState, cell: number): boolean =>
  state.sutures.some((s) => isWebStrand(s) && s.phase === 'taut' && s.slabCells.includes(cell));

/** Multiplicador de velocidade do PROSPECTOR onde ele pisa. Inimigos nao o pagam. */
export const webSpeedMul = (state: SurvivalState, ent: Entity): number =>
  ent.kind === 'player' &&
  webCovers(state, Math.floor(ent.y) * state.config.width + Math.floor(ent.x))
    ? WEB_SLOW
    : 1;

/** Fios cortados a espera de reparo, do mais perto ao mais longe de `from`. */
export const webRepairJobs = (state: SurvivalState, from: Vec2): Suture[] =>
  state.sutures
    .filter((s) => isWebStrand(s) && s.phase === 'loose')
    .sort((a, b) => {
      const pa = suturePoint(state, a.cells[0]),
        pb = suturePoint(state, b.cells[0]);
      return (
        Math.hypot(pa.x - from.x, pa.y - from.y) - Math.hypot(pb.x - from.x, pb.y - from.y) ||
        a.id - b.id
      );
    });
