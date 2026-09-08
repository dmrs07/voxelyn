// A TEIA da segunda fase da Cerzideira: uma teia de aranha classica — raios do
// centro ate as ancoras nas paredes, aneis concentricos ligando raio a raio —
// tecida fio a fio enquanto ela esta fora da tela, cobrindo quase toda a camara.
//
// Cada fio e uma sutura de `kind: 'web'`, e essa escolha e a razao de o
// arquivo ser pequeno: o corte pelo tiro (`hitSutures`), o reparo pelos
// Costureiros (`sewSuture`/`sewJob`), o hash, o snapshot e a reconexao ja
// existem para suturas. O que a teia acrescenta e a geometria, a ordem de
// tecelagem, o chao pegajoso, as juncoes como apoios de puxada e a
// INTEGRIDADE: enquanto a teia esta quase inteira, ela sustenta a rainha, que
// leva pouco dano. Cortar a teia e o que a expoe — e os Costureiros refazendo
// os fios e o que a protege de novo.
import { SOLID_NONE, SOLID_SUTURE_ANCHOR, SOLID_SUTURE_CRACKED } from './constants.js';
import { createSutures, suturePoint } from './sutures.js';
import { WEB_ANCHOR_REACH, farWallAlong, nearbyReachable } from './suture-layout.js';
import type { Entity, SemanticEvent, SurvivalState, Suture, SutureRecipe, Vec2 } from './types.js';

/** Velocidade do Prospector sobre um fio inteiro: devagar, mas ainda esquiva. */
export const WEB_SLOW = 0.62;
/** Quanto dura a tecelagem inicial (12 s): o tempo de ler onde vai ficar lento. */
export const WEB_WEAVE_TICKS = 240;
/** Pausa entre ela sumir e o primeiro fio: o silencio de "algo esta sendo preparado". */
export const WEB_WEAVE_DELAY = 16;
/** Largura da faixa pegajosa de cada fio, em tiles a partir da linha. */
export const WEB_STICKY_REACH = 1.5;
/** O primeiro anel e a razao entre aneis: uma progressao geometrica, como numa teia real. */
export const WEB_FIRST_RING = 2.2;
export const WEB_RING_RATIO = 1.45;
/** Quantos rumos a teia se prende em volta: um raio por rumo, ate a parede de fundo. */
export const WEB_RAYS = 12;
/** Comprimento alvo de um fio de raio, em tiles; aneis mais longos que isto sao partidos ao meio. */
export const WEB_STRAND_LENGTH = 4;
/**
 * A BLINDAGEM DA TEIA: com a integridade (fios inteiros / fios tecidos) neste
 * limiar ou acima, a Cerzideira leva `WEB_ARMOR` do dano. E a restricao que
 * a durabilidade dela obedece na segunda fase — cortar a teia abre a
 * fraqueza; os Costureiros refazendo-a fecham.
 */
export const WEB_ARMOR_THRESHOLD = 0.6;
export const WEB_ARMOR = 0.4;

export const isWebStrand = (s: SutureRecipe): boolean => s.kind === 'web';

const anchorLike = (state: SurvivalState, i: number): boolean =>
  state.solid[i] === SOLID_SUTURE_ANCHOR || state.solid[i] === SOLID_SUTURE_CRACKED;

/**
 * As ANCORAS da camara em volta do centro, em ordem de angulo: toda celula de
 * ancora (inteira ou rachada) a ate `WEB_ANCHOR_REACH`, a partir de
 * `minDistance`. Sao os apoios de puxada e os pontos onde a teia se prende.
 */
export const chamberAnchors = (state: SurvivalState, center: Vec2, minDistance = 0): number[] => {
  const w = state.config.width,
    h = state.config.height;
  const found: number[] = [];
  const minX = Math.max(1, Math.floor(center.x - WEB_ANCHOR_REACH)),
    maxX = Math.min(w - 2, Math.ceil(center.x + WEB_ANCHOR_REACH)),
    minY = Math.max(1, Math.floor(center.y - WEB_ANCHOR_REACH)),
    maxY = Math.min(h - 2, Math.ceil(center.y + WEB_ANCHOR_REACH));
  for (let y = minY; y <= maxY; y++)
    for (let x = minX; x <= maxX; x++) {
      const i = y * w + x;
      if (!anchorLike(state, i)) continue;
      const d = Math.hypot(x + 0.5 - center.x, y + 0.5 - center.y);
      if (d >= minDistance && d <= WEB_ANCHOR_REACH) found.push(i);
    }
  const angleOf = (i: number): number =>
    Math.atan2(Math.floor(i / w) + 0.5 - center.y, (i % w) + 0.5 - center.x);
  return found.sort((a, b) => angleOf(a) - angleOf(b) || a - b);
};

/**
 * ONDE A TEIA SE PRENDE: doze rumos em volta do centro, cada um ate a PAREDE
 * DE FUNDO (`farWallAlong`) — pilares no caminho nao encerram o rumo, viram
 * juncoes. Se um rumo tem uma ancora de verdade a menos de 15 graus, e ela
 * que prende. A geracao garante ancoras nessas paredes onde a parede permite
 * (`ensureWebAnchors`); onde nao permite, a teia se prende na parede mesmo —
 * so os apoios de puxada exigem ancora de verdade (`supportHolds`).
 */
export const webAnchors = (state: SurvivalState, center: Vec2): number[] => {
  const w = state.config.width,
    h = state.config.height;
  const real = chamberAnchors(state, center, 3);
  const angleOf = (i: number): number =>
    Math.atan2(Math.floor(i / w) + 0.5 - center.y, (i % w) + 0.5 - center.x);
  const found: number[] = [];
  for (let k = 0; k < WEB_RAYS; k++) {
    const angle = (k / WEB_RAYS) * Math.PI * 2 + 0.2;
    const near = real.find(
      (i) =>
        Math.abs(Math.atan2(Math.sin(angleOf(i) - angle), Math.cos(angleOf(i) - angle))) <
        Math.PI / WEB_RAYS,
    );
    const hit = near ?? farWallAlong(state.solid, w, h, center, angle, WEB_ANCHOR_REACH);
    if (hit < 0 || found.includes(hit)) continue;
    const d = Math.hypot((hit % w) + 0.5 - center.x, Math.floor(hit / w) + 0.5 - center.y);
    if (d >= 3) found.push(hit);
  }
  return found.sort((a, b) => angleOf(a) - angleOf(b) || a - b);
};

/** As celulas de chao entre dois pontos; para na primeira parede ou borda. */
const rasterize = (
  state: SurvivalState,
  from: Vec2,
  to: Vec2,
): { cells: number[]; blocked: boolean } => {
  const w = state.config.width,
    h = state.config.height;
  const cells: number[] = [];
  const len = Math.hypot(to.x - from.x, to.y - from.y);
  const steps = Math.max(1, Math.ceil(len / 0.3));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = Math.floor(from.x + (to.x - from.x) * t),
      y = Math.floor(from.y + (to.y - from.y) * t);
    if (x < 1 || y < 1 || x >= w - 1 || y >= h - 1) return { cells, blocked: true };
    const c = y * w + x;
    if (state.solid[c] !== SOLID_NONE) return { cells, blocked: true };
    if (cells[cells.length - 1] !== c) cells.push(c);
  }
  return { cells, blocked: false };
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

type Strand = Omit<SutureRecipe, 'id'>;

const emit = (state: SurvivalState, cells: number[], out: Strand[]): void => {
  if (cells.length < 2) return;
  out.push({
    a: cells[0],
    b: cells[cells.length - 1],
    cells,
    slabCells: stickyBand(state, cells),
    kind: 'web',
    objective: false,
  });
};

/**
 * Um FIO ao longo de uma polilinha densa (pontos a cada ~0,5 tile), partido em
 * trechos retos de ~`WEB_STRAND_LENGTH`. Um pilar no caminho encerra o trecho
 * nele — o pilar vira juncao — e o fio recomeca do outro lado se for a mesma
 * sala (`nearbyReachable`); uma parede que divide salas encerra o fio de vez.
 */
const weaveAlong = (state: SurvivalState, points: Vec2[], out: Strand[]): void => {
  const w = state.config.width;
  let start = 0,
    travelled = 0;
  for (let i = 1; i < points.length; i++) {
    travelled += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
    const last = i === points.length - 1;
    if (travelled < WEB_STRAND_LENGTH && !last) continue;
    const { cells, blocked } = rasterize(state, points[start], points[i]);
    emit(state, cells, out);
    if (!blocked) {
      start = i;
      travelled = 0;
      continue;
    }
    // Encalhou: acha o primeiro ponto de chao adiante e confere se e a mesma sala.
    const stop = cells.length ? cells[cells.length - 1] : -1;
    let j = i;
    while (j < points.length) {
      const c = Math.floor(points[j].y) * w + Math.floor(points[j].x);
      if (state.solid[c] === SOLID_NONE) break;
      j++;
    }
    if (j >= points.length) return;
    const resumeCell = Math.floor(points[j].y) * w + Math.floor(points[j].x);
    if (stop < 0 || !nearbyReachable(state.solid, w, stop, resumeCell, 8)) return;
    start = j;
    i = j;
    travelled = 0;
  }
};

const sample = (from: Vec2, to: Vec2, step = 0.5): Vec2[] => {
  const n = Math.max(1, Math.ceil(Math.hypot(to.x - from.x, to.y - from.y) / step));
  const pts: Vec2[] = [];
  for (let k = 0; k <= n; k++)
    pts.push({ x: from.x + ((to.x - from.x) * k) / n, y: from.y + ((to.y - from.y) * k) / n });
  return pts;
};

/**
 * O DESENHO: a teia de aranha da imagem de referencia, cobrindo a camara.
 *
 * Um RAIO por rumo (`webAnchors`), do centro ate a celula encostada na parede
 * de fundo, em fios de ~4 tiles; pilares no caminho sao juncoes. Por cima,
 * ANEIS: a cada raio r (2,2 tiles, depois x1,45 por anel) uma corda entre
 * raios vizinhos, partida ao meio com o meio puxado para dentro — a
 * concavidade da teia real. Toda extremidade de fio e uma JUNCAO: ancora da
 * teia, apoio de puxada no frenesi (`supportHolds`) e no desenho. A ordem de
 * tecelagem e a de uma aranha: raios primeiro, depois os aneis de dentro para
 * fora.
 */
export const designWeb = (state: SurvivalState, center: Vec2): Strand[] => {
  const out: Strand[] = [];
  const w = state.config.width;
  const anchors = webAnchors(state, center);
  if (anchors.length === 0) return out;
  const spokes = anchors.map((i) => {
    const p = { x: (i % w) + 0.5, y: Math.floor(i / w) + 0.5 };
    const d = Math.hypot(p.x - center.x, p.y - center.y);
    return {
      dir: { x: (p.x - center.x) / d, y: (p.y - center.y) / d },
      // Ate a celula encostada na ancora (ou o proprio chao, num campo aberto).
      reach: state.solid[i] === SOLID_NONE ? d : d - 0.6,
    };
  });
  const at = (k: number, r: number): Vec2 => ({
    x: center.x + spokes[k].dir.x * r,
    y: center.y + spokes[k].dir.y * r,
  });
  for (let k = 0; k < spokes.length; k++)
    weaveAlong(state, sample(at(k, 1), at(k, spokes[k].reach)), out);
  const longest = Math.max(...spokes.map((s) => s.reach));
  for (let r = WEB_FIRST_RING; r < longest - 0.5; r *= WEB_RING_RATIO) {
    if (spokes.length < 3) break;
    for (let k = 0; k < spokes.length; k++) {
      const j = (k + 1) % spokes.length;
      // Um raio curto (a parede chegou antes) prende o anel na propria ponta:
      // e assim que a teia acompanha uma camara irregular ate as paredes. Se
      // os dois ja acabaram, o anel anterior ja passou por ali.
      const rk = Math.min(r, spokes[k].reach - 0.3),
        rj = Math.min(r, spokes[j].reach - 0.3);
      if (rk < r && rj < r) continue;
      if (rk < WEB_FIRST_RING - 0.5 || rj < WEB_FIRST_RING - 0.5) continue;
      const a = at(k, rk),
        b = at(j, rj);
      const span = Math.hypot(b.x - a.x, b.y - a.y);
      // Uma corda entre raios que se abrem demais nao e teia, e uma linha
      // atravessando a sala.
      if (span > 1.6 * r + 1) continue;
      if (span <= 3.2) weaveAlong(state, sample(a, b), out);
      else {
        // O meio puxado para o centro: a concavidade de uma teia de verdade.
        const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        const md = Math.hypot(mid.x - center.x, mid.y - center.y) || 1;
        const sag = Math.min(0.9, span * 0.12);
        const m = {
          x: mid.x - ((mid.x - center.x) / md) * sag,
          y: mid.y - ((mid.y - center.y) / md) * sag,
        };
        weaveAlong(state, [...sample(a, m), ...sample(m, b).slice(1)], out);
      }
    }
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

/**
 * A INTEGRIDADE da teia: fios inteiros sobre fios tecidos (inteiros + cortados).
 * Fios ainda nao tecidos nao contam; sem teia, zero.
 */
export const webIntegrity = (state: SurvivalState): number => {
  let taut = 0,
    loose = 0;
  for (const s of state.sutures) {
    if (!isWebStrand(s)) continue;
    if (s.phase === 'taut') taut++;
    else if (s.phase === 'loose') loose++;
  }
  return taut + loose === 0 ? 0 : taut / (taut + loose);
};

/** A teia sustenta a rainha: com integridade no limiar ou acima, o dano e reduzido. */
export const webArmor = (state: SurvivalState): number =>
  webIntegrity(state) >= WEB_ARMOR_THRESHOLD ? WEB_ARMOR : 1;

/** As JUNCOES inteiras: extremidades de fios inteiros, sem repetir. */
export const webJunctions = (state: SurvivalState): number[] => {
  const cells = new Set<number>();
  for (const s of state.sutures)
    if (isWebStrand(s) && s.phase === 'taut') {
      cells.add(s.a);
      cells.add(s.b);
    }
  return [...cells];
};

/**
 * O apoio de uma puxada ainda existe? Uma ancora de parede (inteira ou
 * rachada) ou uma juncao da teia com pelo menos um fio inteiro. Cortar os
 * fios de uma juncao enquanto ela esta presa ali a derruba — a teia e a
 * locomocao dela, e o corte continua sendo a resposta.
 */
export const supportHolds = (state: SurvivalState, cell: number): boolean =>
  anchorLike(state, cell) ||
  state.sutures.some((s) => isWebStrand(s) && s.phase === 'taut' && (s.a === cell || s.b === cell));
