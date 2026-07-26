import { box, renderVoxels } from './voxel.mjs';
import {
  facetEllipse,
  fillDiamond,
  fillEllipse,
  fillRect,
  grid,
  line,
  outlineWith,
  set,
  thickLine,
} from './lib.mjs';

export const ANIM_ORDER = ['idle', 'walk', 'attack', 'special', 'hit', 'downed', 'revive', 'die', 'fly', 'burst'];
const DIRS = ['dr', 'dl', 'ur', 'ul'];
const dirInfo = (dir) => ({
  front: dir === 'dr' || dir === 'dl',
  side: dir === 'dr' || dir === 'ur' ? 1 : -1,
  back: dir === 'ur' || dir === 'ul',
});
const bob6 = [0, -1, -1, 0, 0, -1];
const walkPhase = [0, 1, 2, 0, 2, 1];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

const limb = (g, x0, y0, x1, y1, name = 'rockShadow', width = 1) => {
  thickLine(g, x0, y0, x1, y1, width, name);
  set(g, x1, y1, 'rockLight');
};

const scatter = (g, cx, cy, phase, names, spreadX, spreadY) => {
  const offsets = [[-5, 0], [-3, -3], [0, 1], [3, -2], [5, 1], [-1, -5], [2, 4], [-5, 4]];
  const count = clamp(2 + phase * 2, 2, offsets.length);
  for (let i = 0; i < count; i++) {
    const [ox, oy] = offsets[i];
    const x = cx + Math.round((ox * spreadX * phase) / 4);
    const y = cy + Math.round((oy * spreadY * phase) / 4);
    fillRect(g, x, y, i % 3 === 0 ? 2 : 1, i % 2 === 0 ? 2 : 1, names[i % names.length]);
  }
};

// ---------------------------------------------------------------------------
// player-prospector 24x32
// ---------------------------------------------------------------------------
const drawProspector = (dir, pose = {}) => {
  const g = grid(24, 32);
  const { front, side, back } = dirInfo(dir);
  const bob = pose.bob ?? 0;
  const phase = pose.phase ?? 0;
  const attack = pose.attack ?? 0;
  const hit = pose.hit ?? 0;
  const downed = pose.downed ?? 0;
  const revive = pose.revive ?? 0;
  const death = pose.death ?? -1;
  const cx = 12 + side * attack - side * hit;

  if (death >= 0) {
    const baseY = 27;
    if (death === 0) {
      limb(g, cx - 3, 21, cx - 5, 29, 'rockShadow');
      limb(g, cx + 2, 21, cx + 4, 29, 'rockShadow');
      facetEllipse(g, cx, 18, 5, 6, 'rock', 'rockLight', 'dark');
      facetEllipse(g, cx, 10, 4, 4, 'bone', 'player', 'rockShadow');
      fillRect(g, cx - 2, 10, 4, 2, 'dark');
      set(g, cx + side * 3, 9, 'biolum');
    } else {
      scatter(g, cx, baseY - 4, death, ['rock', 'rockLight', 'bone', 'rust'], 1, 0.8);
      if (death < 4) {
        fillEllipse(g, cx - side * death, baseY - 5 + death, Math.max(1, 4 - death), Math.max(1, 3 - death / 2), 'rock');
        fillDiamond(g, cx + side * (3 + death), baseY - 8 + death, 2, 2, 'bone');
        set(g, cx + side * (4 + death), baseY - 9 + death, death < 3 ? 'biolum' : 'rockShadow');
      }
    }
    outlineWith(g, 'dark');
    return g;
  }

  if (downed > 0) {
    const pulse = downed % 2;
    limb(g, cx - 3, 22, cx - 6, 28, 'rockShadow');
    limb(g, cx + 2, 22, cx + 5, 28, 'rockShadow');
    facetEllipse(g, cx, 21, 5, 4, 'rock', 'rockLight', 'dark');
    facetEllipse(g, cx + side * 2, 15, 4, 4, 'bone', 'player', 'rockShadow');
    fillRect(g, cx + side * (front ? -1 : 0) - 2, 15, 4, 2, 'dark');
    set(g, cx + side * 4, 14, pulse ? 'biolum' : 'electric');
    fillEllipse(g, cx - side * 5, 23, 2, 3, 'fungusDark');
    outlineWith(g, 'dark');
    return g;
  }

  const rise = revive > 0 ? Math.max(0, 4 - Math.floor(revive / 2)) : 0;
  const y = bob + rise;
  const leftLift = phase === 1 ? 2 : 0;
  const rightLift = phase === 2 ? 2 : 0;

  limb(g, cx - 3, 22 + y, cx - 4 - side, 29 + y - leftLift, 'rockShadow');
  limb(g, cx + 2, 22 + y, cx + 4 + side, 29 + y - rightLift, 'rockShadow');
  fillRect(g, cx - 6 - side, 28 + y - leftLift, 4, 2, 'rock');
  fillRect(g, cx + 2 + side, 28 + y - rightLift, 4, 2, 'rock');

  const tankX = cx - side * 5;
  facetEllipse(g, tankX, 18 + y, 2, 5, 'fungusDark', 'fungusLight', 'dark');
  set(g, tankX - side, 17 + y, 'biolum');

  facetEllipse(g, cx, 19 + y, 5, 6, 'rock', 'rockLight', 'dark');
  fillRect(g, cx - 4, 22 + y, 8, 2, 'rust');
  fillRect(g, cx - 5, 23 + y, 10, 1, 'loot');

  const armX = cx + side * 5;
  limb(g, cx + side * 3, 18 + y, armX + side * attack, 22 + y - attack, 'rock', 1);
  if (attack > 0) {
    const ringX = armX + side * (2 + attack);
    fillEllipse(g, ringX, 21 + y - attack, 3 + attack, 2, 'loot');
    fillEllipse(g, ringX, 21 + y - attack, Math.max(1, 1 + attack), 1, 'dark');
    set(g, ringX + side * (3 + attack), 20 + y - attack, 'electric');
  } else {
    fillDiamond(g, armX + side, 22 + y, 2, 2, 'loot');
  }

  facetEllipse(g, cx, 10 + y, 4, 4, back ? 'rockLight' : 'bone', 'player', 'rockShadow');
  fillEllipse(g, cx, 8 + y, 4, 2, 'rockLight');
  if (front) {
    fillRect(g, cx - 3, 10 + y, 6, 2, 'dark');
    set(g, cx - side, 10 + y, revive > 0 && revive < 3 ? 'electric' : 'biolum');
    set(g, cx + side, 10 + y, 'biolum');
  }
  set(g, cx + side * 3, 7 + y, revive > 0 ? 'player' : 'biolum');
  set(g, cx + side * 3, 6 + y, 'electric');

  outlineWith(g, 'dark');
  return g;
};

// ---------------------------------------------------------------------------
// player-prospector 32x40 — MODELO VOXEL
//
// Este e o primeiro personagem migrado do desenho 2D para o rasterizador voxel.
// As quatro direcoes sao rotacoes do mesmo modelo, entao nao podem divergir
// entre si como acontecia quando cada uma era redesenhada a mao.
// ---------------------------------------------------------------------------
const DIR_INDEX = { dr: 0, dl: 1, ur: 2, ul: 3 };

/** Prospector de pe. `y0` desloca o corpo (bob, recuo de dano). */
const prospectorStanding = ({ bob = 0, st = 0, sw = 0, lean = 0, crouch = 0 } = {}) => {
  const b = [];
  // `crouch` encurta as pernas E baixa todo o resto na mesma medida: sem isso
  // o tronco descola das pernas nos frames de queda e de revive.
  const c = Math.max(0, Math.min(3, crouch));
  const legH = Math.max(1, 3 - c);
  const up = bob - c;
  // botas + pernas
  b.push(box(-2, -1 + lean, Math.max(0, st), 2, 2, 1, 'rust'));
  b.push(box(1, -1 + lean, Math.max(0, -st), 2, 2, 1, 'rust'));
  b.push(box(-2, -1 + lean, 1 + Math.max(0, st), 2, 2, legH, 'rockDeep'));
  b.push(box(1, -1 + lean, 1 + Math.max(0, -st), 2, 2, legH, 'rockDeep'));
  // cinto
  b.push(box(-2, -1 + lean, 5 + up, 5, 2, 1, 'loot'));
  // torso: peitoral na frente, modulo fungico nas costas
  b.push(box(-2, -1 + lean, 6 + up, 5, 2, 4, 'rock'));
  b.push(box(-2, -2 + lean, 6 + up, 5, 1, 4, 'rust'));
  b.push(box(-1, 1 + lean, 7 + up, 3, 1, 3, 'fungus'));
  b.push(box(-1, 2 + lean, 8 + up, 3, 1, 1, 'biolum'));
  // ombreiras
  b.push(box(-3, -1 + lean, 9 + up, 1, 2, 1, 'rock'));
  b.push(box(3, -1 + lean, 9 + up, 1, 2, 1, 'rock'));
  // pescoco + capacete + visor + lanterna
  b.push(box(-1, -1 + lean * 2, 10 + up, 3, 2, 1, 'rockDeep'));
  b.push(box(-1, -1 + lean * 2, 11 + up, 3, 3, 2, 'bone'));
  b.push(box(-1, -2 + lean * 2, 11 + up, 3, 1, 1, 'biolum'));
  b.push(box(0, -2 + lean * 2, 13 + up, 1, 1, 1, 'loot'));
  // bracos + picareta
  b.push(box(-3, -1 + lean, 6 + up, 1, 2, 3, 'rock'));
  b.push(box(3, -1 + lean, 6 + up + sw, 1, 2, 3, 'rock'));
  b.push(box(3, -2 + lean, 4 + up + sw * 3, 1, 1, 3, 'loot'));
  return b;
};

/**
 * Prospector CAIDO, de costas no chao. Silhueta horizontal — em co-op este e
 * o estado que o parceiro precisa reconhecer de longe para vir reanimar, entao
 * ele nao pode parecer so uma versao baixinha da pose em pe.
 * O modulo fungico e o visor ficam virados para cima, funcionando como farol.
 */
const prospectorProne = ({ breath = 0, settle = 0 } = {}) => {
  const z = settle;
  const b = [];
  // pernas dobradas para fora
  b.push(box(-3, 2, z, 2, 2, 2, 'rockDeep'));
  b.push(box(1, 2, z, 2, 2, 2, 'rockDeep'));
  b.push(box(-3, 4, z, 2, 1, 1, 'rust'));
  b.push(box(1, 4, z, 2, 1, 1, 'rust'));
  // torso deitado, peitoral virado para cima
  b.push(box(-2, -1, z, 5, 3, 2, 'rock'));
  b.push(box(-2, -1, z + 2, 5, 3, 1, 'rust'));
  b.push(box(-2, 2, z, 5, 1, 1, 'loot'));
  // modulo fungico brilhando para cima: farol de revive
  b.push(box(-1, 0, z + 3 + breath, 3, 1, 1, 'biolum'));
  // capacete no chao, visor para cima
  b.push(box(-1, -3, z, 3, 2, 2, 'bone'));
  b.push(box(-1, -3, z + 2, 3, 2, 1, 'biolum'));
  // bracos abertos
  b.push(box(-5, 0, z, 2, 2, 1, 'rock'));
  b.push(box(3, 0, z, 2, 2, 1, 'rock'));
  // picareta caida ao lado
  b.push(box(4, 2, z, 1, 3, 1, 'loot'));
  return b;
};

/** Modelo 3D do prospector para uma animacao/frame. */
const prospectorModel = (anim, f) => {
  if (anim === 'idle') return prospectorStanding({ bob: [0, 0, 1, 0][f % 4] });
  if (anim === 'walk') return prospectorStanding({ st: [0, 1, 2, 1, 0, -1][f % 6] });
  if (anim === 'attack') return prospectorStanding({ sw: [0, 0, 1, 2][f % 4] });
  // dano: recuo real do tronco e da cabeca, nao um pixel de bob
  if (anim === 'hit') return prospectorStanding({ lean: [1, 0][f % 2], bob: [1, 0][f % 2] });
  // queda: dois frames tombando, depois o corpo ja no chao assentando
  if (anim === 'die') {
    if (f === 0) return prospectorStanding({ lean: 1, crouch: 1 });
    if (f === 1) return prospectorStanding({ lean: 2, crouch: 3 });
    return prospectorProne({ settle: Math.max(0, 4 - f) });
  }
  // abatido: respira devagar, com o farol pulsando
  if (anim === 'downed') return prospectorProne({ breath: [0, 0, 1, 0][f % 4] });
  // revive: espelha a queda — sobe do chao ate ficar de pe
  if (anim === 'revive') {
    if (f <= 2) return prospectorProne({ settle: f });
    if (f === 3) return prospectorStanding({ lean: 2, crouch: 3 });
    if (f === 4) return prospectorStanding({ lean: 1, crouch: 1 });
    return prospectorStanding({});
  }
  return prospectorStanding({});
};

const prospectorFrame = (dir, anim, f) =>
  renderVoxels(prospectorModel(anim, f), DIR_INDEX[dir], 32, 40, 14, 34);

// ---------------------------------------------------------------------------
// enemy-stalker 24x24
// ---------------------------------------------------------------------------
const drawStalker = (dir, pose = {}) => {
  const g = grid(24, 24);
  const { side, front } = dirInfo(dir);
  const bob = pose.bob ?? 0;
  const phase = pose.phase ?? 0;
  const attack = pose.attack ?? 0;
  const hit = pose.hit ?? 0;
  const death = pose.death ?? -1;
  const cx = 12 - side * hit;

  if (death >= 0) {
    if (death === 0) return drawStalker(dir, { hit: 1 });
    fillEllipse(g, cx, 18 + Math.min(2, death), Math.max(2, 7 - death), Math.max(1, 3 - death / 2), 'blood');
    scatter(g, cx, 19, death, ['blood', 'rust', 'rockShadow', 'loot'], 0.8, 0.5);
    if (death < 4) fillDiamond(g, cx + side * (5 + death), 17 + death, 3, 1, 'loot');
    outlineWith(g, 'dark');
    return g;
  }

  const y = bob;
  for (let i = 0; i < 4; i++) {
    const ox = [-6, -3, 3, 6][i];
    const lift = (phase + i) % 2 === 0 ? 0 : 2;
    limb(g, cx + ox * 0.55, 16 + y, cx + ox, 21 + y - lift, i < 2 ? 'rockShadow' : 'rust');
  }
  facetEllipse(g, cx, 14 + y, 7, 4, 'blood', 'rust', 'rockShadow');
  fillRect(g, cx - 4, 15 + y, 8, 2, 'rockShadow');
  const hx = cx + side * (4 + attack);
  facetEllipse(g, hx, 12 + y - attack, 3, 3, 'blood', 'rust', 'rockShadow');
  if (front) {
    set(g, hx + side, 11 + y - attack, 'fire');
    set(g, hx + side * 2, 12 + y - attack, 'loot');
  }
  const bladeBaseX = cx + side * 3;
  const bladeTipX = cx + side * (8 + attack * 2);
  const bladeTipY = 16 + y - attack * 2;
  thickLine(g, bladeBaseX, 15 + y, bladeTipX, bladeTipY, 2, 'loot');
  set(g, bladeTipX, bladeTipY - 1, attack > 0 ? 'fire' : 'loot');
  if (attack >= 2) {
    line(g, cx - side * 1, 7 + y, cx + side * 9, 10 + y, 'fire');
    line(g, cx + side * 1, 6 + y, cx + side * 8, 8 + y, 'loot');
  }
  outlineWith(g, 'dark');
  return g;
};
const stalkerFrame = (dir, anim, f) => {
  if (anim === 'idle') return drawStalker(dir, { bob: [0, -1, 0, 0][f] });
  if (anim === 'walk') return drawStalker(dir, { bob: bob6[f], phase: f });
  if (anim === 'attack') return drawStalker(dir, { attack: [0, 1, 2, 0][f], phase: f });
  if (anim === 'hit') return drawStalker(dir, { hit: [1, 0][f] });
  return drawStalker(dir, { death: f });
};

// ---------------------------------------------------------------------------
// enemy-spitter 24x24
// ---------------------------------------------------------------------------
const drawSpitter = (dir, pose = {}) => {
  const g = grid(24, 24);
  const { side, front } = dirInfo(dir);
  const bob = pose.bob ?? 0;
  const phase = pose.phase ?? 0;
  const inflate = pose.inflate ?? 0;
  const hit = pose.hit ?? 0;
  const death = pose.death ?? -1;
  const cx = 12 - side * hit;

  if (death >= 0) {
    if (death === 0) return drawSpitter(dir, { hit: 1 });
    const ry = Math.max(1, 5 - death);
    fillEllipse(g, cx, 20, 7 - death * 0.5, ry, death < 3 ? 'fungus' : 'fungusDark');
    scatter(g, cx, 19, death, ['fungus', 'fungusLight', 'acid'], 0.6, 0.3);
    outlineWith(g, 'dark');
    return g;
  }

  const y = bob;
  const legSwing = phase % 3 - 1;
  limb(g, cx - 3, 17 + y, cx - 5 - legSwing, 22 + y, 'fungusDark');
  limb(g, cx + 3, 17 + y, cx + 5 + legSwing, 22 + y, 'fungusDark');
  limb(g, cx - 4, 13 + y, cx - 7 + legSwing, 18 + y, 'fungus');
  limb(g, cx + 4, 13 + y, cx + 7 - legSwing, 18 + y, 'fungus');
  facetEllipse(g, cx, 14 + y, 5, 6, 'fungus', 'fungusLight', 'fungusDark');
  const throatX = cx + side * 3;
  facetEllipse(g, throatX, 13 + y, 3 + inflate, 3 + inflate, inflate > 0 ? 'acid' : 'fungus', 'fungusLight', 'fungusDark');
  const hx = cx + side * (2 + inflate);
  facetEllipse(g, hx, 8 + y - inflate, 4, 3, 'fungus', 'fungusLight', 'fungusDark');
  fillEllipse(g, hx - side * 2, 6 + y - inflate, 1, 2, 'player');
  fillEllipse(g, hx + side * 2, 6 + y - inflate, 1, 2, 'player');
  set(g, hx - side * 2, 6 + y - inflate, 'dark');
  set(g, hx + side * 2, 6 + y - inflate, 'dark');
  if (front) fillRect(g, hx + side * 2, 9 + y - inflate, 3 + inflate, 2, inflate >= 2 ? 'acid' : 'dark');
  if (inflate >= 2) {
    set(g, hx + side * 7, 9 + y - inflate, 'acid');
    set(g, hx + side * 9, 8 + y - inflate, 'acid');
  }
  outlineWith(g, 'dark');
  return g;
};
const spitterFrame = (dir, anim, f) => {
  if (anim === 'idle') return drawSpitter(dir, { bob: [0, 0, -1, 0][f] });
  if (anim === 'walk') return drawSpitter(dir, { bob: bob6[f], phase: f });
  if (anim === 'attack') return drawSpitter(dir, { inflate: [0, 1, 2, 0][f] });
  if (anim === 'hit') return drawSpitter(dir, { hit: [1, 0][f] });
  return drawSpitter(dir, { death: f });
};

// ---------------------------------------------------------------------------
// enemy-spore-bomber 24x24
// ---------------------------------------------------------------------------
const drawBomber = (dir, pose = {}) => {
  const g = grid(24, 24);
  const { side, front } = dirInfo(dir);
  const bob = pose.bob ?? 0;
  const phase = pose.phase ?? 0;
  const inflate = pose.inflate ?? 0;
  const attack = pose.attack ?? 0;
  const hit = pose.hit ?? 0;
  const death = pose.death ?? -1;
  const cx = 12 - side * hit;

  if (death >= 0) {
    if (death === 0) return drawBomber(dir, { inflate: 2 });
    fillEllipse(g, cx, 19, Math.max(2, 7 - death), Math.max(1, 4 - death), death < 2 ? 'blood' : 'fungusDark');
    scatter(g, cx, 18, death, ['fungusDark', 'rockShadow', 'blood', 'fire'], 1, 0.5);
    outlineWith(g, 'dark');
    return g;
  }

  const y = bob;
  const swing = phase % 2;
  limb(g, cx - 3, 18 + y, cx - 5, 22 + y - swing, 'rockShadow');
  limb(g, cx + 3, 18 + y, cx + 5, 22 + y - (1 - swing), 'rockShadow');
  facetEllipse(g, cx, 15 + y, 6 + inflate, 7 + inflate, 'fungusDark', 'rock', 'dark');
  fillEllipse(g, cx, 11 + y - inflate, 5 + inflate, 4 + inflate, 'rockShadow');
  fillEllipse(g, cx - side * 2, 10 + y - inflate, 2, 2, 'rock');
  const eye = inflate >= 2 ? 'fire' : attack > 0 ? 'blood' : 'biolum';
  if (front) {
    fillDiamond(g, cx + side, 11 + y - inflate, 2, 2, eye);
    set(g, cx + side, 11 + y - inflate, 'player');
  }
  const podX = cx - side * (5 + attack);
  facetEllipse(g, podX, 16 + y - attack, 3 + inflate, 4 + inflate, 'rock', 'rockLight', 'dark');
  for (const [ox, oy] of [[-1, -1], [1, 0], [0, 2]]) set(g, podX + ox, 16 + y - attack + oy, inflate >= 2 ? 'fire' : 'blood');
  if (inflate >= 3) {
    set(g, cx - 8, 8, 'fire'); set(g, cx + 8, 10, 'fire');
    set(g, cx - 6, 5, 'blood'); set(g, cx + 6, 6, 'blood');
  }
  outlineWith(g, 'dark');
  return g;
};
const bomberFrame = (dir, anim, f) => {
  if (anim === 'idle') return drawBomber(dir, { bob: [0, 0, -1, 0][f] });
  if (anim === 'walk') return drawBomber(dir, { bob: bob6[f], phase: f });
  if (anim === 'attack') return drawBomber(dir, { attack: [0, 1, 2, 0][f] });
  if (anim === 'special') return drawBomber(dir, { inflate: [0, 1, 2, 3, 3, 2][f] });
  if (anim === 'hit') return drawBomber(dir, { hit: [1, 0][f] });
  return drawBomber(dir, { death: f });
};

// ---------------------------------------------------------------------------
// enemy-bruiser 40x48
// ---------------------------------------------------------------------------
const drawBruiser = (dir, pose = {}) => {
  const g = grid(40, 48);
  const { side, front } = dirInfo(dir);
  const bob = pose.bob ?? 0;
  const phase = pose.phase ?? 0;
  const attack = pose.attack ?? 0;
  const hit = pose.hit ?? 0;
  const death = pose.death ?? -1;
  const cx = 20 - side * hit;

  if (death >= 0) {
    if (death === 0) return drawBruiser(dir, { hit: 1 });
    fillEllipse(g, cx, 40, Math.max(4, 14 - death * 2), Math.max(2, 8 - death), 'rock');
    scatter(g, cx, 37, death, ['rock', 'rockLight', 'bone', 'electric'], 1.5, 0.7);
    if (death < 4) fillDiamond(g, cx + side * death, 34 + death, 3, 3, death < 3 ? 'electric' : 'rockShadow');
    outlineWith(g, 'dark');
    return g;
  }

  const y = bob;
  const step = phase % 2;
  fillEllipse(g, cx - 7, 40 + y - step, 6, 4, 'rockShadow');
  fillEllipse(g, cx + 7, 40 + y - (1 - step), 6, 4, 'rockShadow');
  facetEllipse(g, cx, 28 + y, 12, 13, 'rock', 'rockLight', 'rockShadow');
  fillDiamond(g, cx, 27 + y, 4, 5, 'electric');
  fillDiamond(g, cx, 27 + y, 2, 3, 'biolum');
  const leftArmX = cx - 13 - (side < 0 ? attack * 2 : 0);
  const rightArmX = cx + 13 + (side > 0 ? attack * 2 : 0);
  facetEllipse(g, leftArmX, 30 + y - attack, 7 + attack, 9, 'bone', 'rockLight', 'rockShadow');
  facetEllipse(g, rightArmX, 30 + y - attack, 7 + attack, 9, 'bone', 'rockLight', 'rockShadow');
  facetEllipse(g, cx, 14 + y, 8, 7, 'rock', 'rockLight', 'rockShadow');
  fillDiamond(g, cx + side * 2, 12 + y, 3, 3, front ? 'bone' : 'rockLight');
  if (attack >= 2) {
    line(g, cx - 14, 43, cx + 14, 43, 'electric');
    set(g, cx - 16, 42, 'rockLight'); set(g, cx + 16, 42, 'rockLight');
  }
  outlineWith(g, 'dark');
  return g;
};
const bruiserFrame = (dir, anim, f) => {
  if (anim === 'idle') return drawBruiser(dir, { bob: [0, 0, -1, 0][f] });
  if (anim === 'walk') return drawBruiser(dir, { bob: bob6[f], phase: f });
  if (anim === 'attack') return drawBruiser(dir, { attack: [0, 1, 2, 0][f] });
  if (anim === 'hit') return drawBruiser(dir, { hit: [1, 0][f] });
  return drawBruiser(dir, { death: f });
};

// ---------------------------------------------------------------------------
// enemy-guardian 40x48
// ---------------------------------------------------------------------------
const drawGuardian = (dir, pose = {}) => {
  const g = grid(40, 48);
  const { side, front } = dirInfo(dir);
  const bob = pose.bob ?? 0;
  const phase = pose.phase ?? 0;
  const attack = pose.attack ?? 0;
  const special = pose.special ?? 0;
  const hit = pose.hit ?? 0;
  const death = pose.death ?? -1;
  const cx = 20 - side * hit;

  if (death >= 0) {
    if (death === 0) return drawGuardian(dir, { hit: 1 });
    const slump = death * 3;
    fillEllipse(g, cx, 39, Math.max(6, 15 - death), Math.max(3, 10 - death), 'rockShadow');
    fillEllipse(g, cx - 10, 38 + Math.min(4, death), Math.max(3, 8 - death), Math.max(2, 6 - death), 'bone');
    fillEllipse(g, cx + 10, 38 + Math.min(4, death), Math.max(3, 8 - death), Math.max(2, 6 - death), 'bone');
    if (death < 4) {
      fillDiamond(g, cx, 29 + slump, 4, 4, death < 2 ? 'electric' : 'rock');
      scatter(g, cx, 34, death, ['rock', 'bone', 'rockLight'], 1.3, 0.7);
    }
    outlineWith(g, 'dark');
    return g;
  }

  const y = bob + special;
  const step = phase % 2;
  fillEllipse(g, cx - 7, 42 + y - step, 7, 4, 'rockShadow');
  fillEllipse(g, cx + 7, 42 + y - (1 - step), 7, 4, 'rockShadow');
  facetEllipse(g, cx, 27 + y, 11, 14, 'rockShadow', 'rock', 'dark');
  fillDiamond(g, cx, 27 + y, 4, 5, 'electric');
  fillDiamond(g, cx, 27 + y, 2, 3, 'player');

  const armDrop = attack * 3;
  const armSpread = special > 0 ? 2 : 0;
  facetEllipse(g, cx - 14 - armSpread, 29 + y + armDrop, 8, 11 - attack, 'bone', 'rockLight', 'rockShadow');
  facetEllipse(g, cx + 14 + armSpread, 29 + y + armDrop, 8, 11 - attack, 'bone', 'rockLight', 'rockShadow');
  fillEllipse(g, cx - 14 - armSpread, 39 + y + armDrop, 7, 5, 'rock');
  fillEllipse(g, cx + 14 + armSpread, 39 + y + armDrop, 7, 5, 'rock');

  facetEllipse(g, cx, 11 + y, 7, 7, 'bone', 'player', 'rockShadow');
  fillDiamond(g, cx + side * 2, 10 + y, 3, 4, front ? 'dark' : 'rock');
  set(g, cx + side * 2, 11 + y, front ? 'electric' : 'rockLight');
  if (attack >= 2) {
    line(g, cx - 16, 45, cx + 16, 45, 'electric');
    for (const ox of [-14, -8, 8, 14]) set(g, cx + ox, 43, 'rockLight');
  }
  if (special > 0) {
    set(g, cx - 12, 13, 'electric'); set(g, cx + 12, 13, 'electric');
    set(g, cx - 9, 8, 'biolum'); set(g, cx + 9, 8, 'biolum');
  }
  outlineWith(g, 'dark');
  return g;
};
const guardianFrame = (dir, anim, f) => {
  if (anim === 'idle') return drawGuardian(dir, { bob: [0, 0, -1, 0][f] });
  if (anim === 'walk') return drawGuardian(dir, { bob: bob6[f], phase: f });
  if (anim === 'attack') return drawGuardian(dir, { attack: [0, 1, 2, 0][f] });
  if (anim === 'special') return drawGuardian(dir, { special: [0, -1, -2, 0][f] });
  if (anim === 'hit') return drawGuardian(dir, { hit: [1, 0][f] });
  return drawGuardian(dir, { death: f });
};

const boltFrame = (_dir, _anim, f) => {
  const g = grid(16, 16);
  fillDiamond(g, 8, 8, 3, 3, 'biolum');
  fillDiamond(g, 8, 8, 1, 1, 'player');
  const pts = [[13, 8], [8, 13], [3, 8], [8, 3]];
  const [x, y] = pts[f % 4];
  set(g, x, y, 'electric');
  outlineWith(g, 'dark');
  return g;
};
const impactFrame = (_dir, _anim, f) => {
  const g = grid(16, 16);
  const r = 1 + f;
  for (let a = 0; a < Math.PI * 2; a += Math.PI / 8) {
    set(g, 8 + Math.round(Math.cos(a) * r), 8 + Math.round(Math.sin(a) * r), f < 2 ? 'player' : 'biolum');
  }
  if (f === 0) fillDiamond(g, 8, 8, 2, 2, 'player');
  return g;
};

const living = {
  idle: { frames: 4, fps: 6, loop: true },
  walk: { frames: 6, fps: 10, loop: true },
  attack: { frames: 4, fps: 12, loop: false },
  hit: { frames: 2, fps: 12, loop: false },
  die: { frames: 5, fps: 10, loop: false },
};
const base = (id, frameWidth, frameHeight, anchorX, anchorY, hitbox, footprint, animations, draw, prompt) => ({
  id,
  version: 2,
  frameWidth,
  frameHeight,
  anchorX,
  anchorY,
  directions: 4,
  authoredDirs: DIRS,
  flipPairs: {},
  hitbox,
  footprint,
  animations,
  draw,
  prompt,
});

export const ENTITY_SPECS = [
  base('player-prospector', 32, 40, 16, 38, { w: 0.68, h: 1 }, { w: 1, h: 1, offsetX: 0, offsetY: 0 }, {
    ...living,
    downed: { frames: 4, fps: 6, loop: true },
    revive: { frames: 6, fps: 8, loop: false },
  }, prospectorFrame, 'voxel-isometric underground prospector, pale mining helmet, cyan visor, asymmetric tool ring and fungal back module'),
  base('enemy-stalker', 24, 24, 12, 22, { w: 0.64, h: 0.6 }, { w: 1, h: 1, offsetX: 0, offsetY: 0 }, living, stalkerFrame, 'voxel-isometric low red chitin predator with one mineral blade, four authored directions'),
  base('enemy-spitter', 24, 24, 12, 22, { w: 0.68, h: 0.72 }, { w: 1, h: 1, offsetX: 0, offsetY: 0 }, living, spitterFrame, 'voxel-isometric fungal amphibian, bulb eyes, acid throat, restrained neon accents'),
  base('enemy-spore-bomber', 24, 24, 12, 22, { w: 0.62, h: 0.72 }, { w: 1, h: 1, offsetX: 0, offsetY: 0 }, {
    ...living,
    special: { frames: 6, fps: 10, loop: false },
  }, bomberFrame, 'voxel-isometric compact spore carrier, hooded silhouette, central eye and telegraphed explosive pod'),
  base('enemy-bruiser', 40, 48, 20, 45, { w: 0.92, h: 1.1 }, { w: 1.25, h: 1.25, offsetX: 0, offsetY: 0 }, living, bruiserFrame, 'voxel-isometric compact geode bruiser, broad shoulders, pale rock plates and electric core'),
  base('enemy-guardian', 40, 48, 20, 45, { w: 1.36, h: 1.4 }, { w: 1.7, h: 1.7, offsetX: 0, offsetY: 0 }, {
    ...living,
    special: { frames: 4, fps: 10, loop: false },
  }, guardianFrame, 'voxel-isometric mineral titan, huge pale forearms, dark torso, mask and electric chest core'),
  {
    id: 'fx-projectile-bolt', version: 2, frameWidth: 16, frameHeight: 16, anchorX: 8, anchorY: 8,
    directions: 1, authoredDirs: ['n'], flipPairs: {}, hitbox: { w: 0.2, h: 0.2 },
    footprint: { w: 0, h: 0, offsetX: 0, offsetY: 0 },
    animations: { fly: { frames: 4, fps: 16, loop: true } }, draw: boltFrame,
    prompt: 'small cyan voxel energy bolt',
  },
  {
    id: 'fx-impact-burst', version: 2, frameWidth: 16, frameHeight: 16, anchorX: 8, anchorY: 8,
    directions: 1, authoredDirs: ['n'], flipPairs: {}, hitbox: { w: 0, h: 0 },
    footprint: { w: 0, h: 0, offsetX: 0, offsetY: 0 },
    animations: { burst: { frames: 5, fps: 14, loop: false } }, draw: impactFrame,
    prompt: 'small cyan voxel impact ring',
  },
];
