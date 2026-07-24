import {
  clearTopRows,
  fillEllipse,
  fillRect,
  grid,
  line,
  outlineWith,
  set,
} from './lib.mjs';

// Convencao: authored dirs 'dr' (frente, virado para baixo-direita) e 'ur' (costas,
// virado para cima-direita). 'dl'/'ul' sao flips horizontais no runtime.
// Anchor no centro-base (pes). Silhueta primeiro, paleta restrita, outline dark.

// ---------------------------------------------------------------------------
// player-prospector 24x32 - explorador com lampada de capacete biolum
// ---------------------------------------------------------------------------
const drawProspector = (dir, { bob = 0, legPhase = 0, lunge = 0, flash = false }) => {
  const g = grid(24, 32);
  const front = dir === 'dr';
  const cx = 12 + lunge;
  const yb = bob;

  // pernas
  const lLift = legPhase === 1 ? 1 : 0;
  const rLift = legPhase === 2 ? 1 : 0;
  fillRect(g, cx - 4, 25 + yb - lLift, 3, 5, 'rockShadow');
  fillRect(g, cx + 1, 25 + yb - rLift, 3, 5, 'rockShadow');
  // botas
  fillRect(g, cx - 4, 29 + yb - lLift, 3, 1, 'rock');
  fillRect(g, cx + 1, 29 + yb - rLift, 3, 1, 'rock');

  // tanque nas costas (biotecnologia)
  const tankX = front ? cx + 4 : cx - 6;
  fillRect(g, tankX, 14 + yb, 3, 8, 'fungusDark');
  set(g, tankX + 1, 15 + yb, 'fungusLight');
  set(g, tankX + 1, 18 + yb, 'biolum');

  // torso
  fillEllipse(g, cx, 19 + yb, 5, 6, 'rock');
  fillEllipse(g, cx - 1, 18 + yb, 4, 5, 'rockLight');
  fillRect(g, cx - 3, 22 + yb, 7, 2, 'rockShadow'); // cinto

  // cabeca + capacete
  fillEllipse(g, cx, 11 + yb, 4, 4, front ? 'bone' : 'rockLight');
  fillEllipse(g, cx, 10 + yb, 4, 3, 'rockLight'); // capacete
  if (front) {
    fillRect(g, cx - 2, 11 + yb, 4, 2, 'dark'); // visor
    // lampada
    set(g, cx + 3, 10 + yb, 'biolum');
    set(g, cx + 3, 9 + yb, flash ? 'player' : 'biolum');
    if (flash) set(g, cx + 4, 10 + yb, 'biolum');
  } else {
    set(g, cx, 9 + yb, 'biolum'); // luz piloto tenue nas costas
  }

  // braco/arma frontal
  const armX = front ? cx + 4 : cx - 4;
  fillRect(g, armX, 18 + yb, 2, 4, 'rock');
  if (flash) {
    set(g, front ? armX + 2 : armX - 1, 19 + yb, 'biolum');
    set(g, front ? armX + 3 : armX - 2, 19 + yb, 'player');
  }

  outlineWith(g, 'dark');
  return g;
};

const playerFrame = (dir, anim, f) => {
  let opts = {};
  let clip = 0;
  if (anim === 'idle') opts.bob = [0, 0, -1, 0][f];
  else if (anim === 'walk') {
    opts.bob = [0, -1, 0, -1][f];
    opts.legPhase = [0, 1, 0, 2][f];
  } else if (anim === 'attack') {
    opts.lunge = [0, 1, 2, 1][f];
    opts.flash = f === 1 || f === 2;
  } else if (anim === 'hit') opts.bob = [-1, 0][f];
  else if (anim === 'die') {
    opts.bob = f;
    clip = f * 7;
  }
  const g = drawProspector(dir, opts);
  if (clip > 0) clearTopRows(g, clip);
  return g;
};

// ---------------------------------------------------------------------------
// enemy-stalker 24x24 - predador quitinoso, baixo e largo, olhos acidos
// ---------------------------------------------------------------------------
const drawStalker = (dir, { bob = 0, legPhase = 0 }) => {
  const g = grid(24, 24);
  const front = dir === 'dr';
  const cx = 12;
  const yb = bob;

  // pernas multiplas
  const phase = legPhase;
  const legs = [
    [-6, 0],
    [-3, 1],
    [3, 1],
    [6, 0],
  ];
  legs.forEach(([ox, ph], i) => {
    const lift = (phase + i) % 2 === 1 ? 1 : 0;
    line(g, cx + ox * 0.5, 15 + yb, cx + ox, 21 - lift + yb, 'rockShadow');
  });

  // corpo baixo
  fillEllipse(g, cx, 15 + yb, 6, 4, 'rock');
  fillEllipse(g, cx, 14 + yb, 5, 3, 'rockLight');
  fillRect(g, cx - 4, 15 + yb, 8, 1, 'rockShadow');

  // cabeca projetada
  const hx = front ? cx + 4 : cx - 4;
  fillEllipse(g, hx, 14 + yb, 3, 2, 'rock');
  if (front) {
    set(g, hx + 1, 13 + yb, 'acid');
    set(g, hx + 2, 14 + yb, 'acid'); // olhos
  }

  outlineWith(g, 'dark');
  return g;
};

const stalkerFrame = (dir, anim, f) => {
  let opts = {};
  let clip = 0;
  if (anim === 'idle') opts.bob = [0, -1, 0, -1][f];
  else if (anim === 'walk') {
    opts.bob = [0, -1, 0, -1][f];
    opts.legPhase = f % 2;
  } else if (anim === 'hit') opts.bob = [-1, 0][f];
  else if (anim === 'die') {
    opts.bob = f + 1;
    clip = f * 5;
  }
  const g = drawStalker(dir, opts);
  if (clip > 0) clearTopRows(g, clip);
  return g;
};

// ---------------------------------------------------------------------------
// enemy-spitter 24x24 - saco acido bulboso com bocal
// ---------------------------------------------------------------------------
const drawSpitter = (dir, { bob = 0, inflate = 0, spit = false }) => {
  const g = grid(24, 24);
  const front = dir === 'dr';
  const cx = 12;
  const yb = bob;

  // base/pes
  fillRect(g, cx - 3, 20 + yb, 6, 2, 'fungusDark');

  // saco acido (infla no ataque)
  const r = 6 + inflate;
  fillEllipse(g, cx, 14 + yb, r, r - 1, 'fungusDark');
  fillEllipse(g, cx - 1, 13 + yb, r - 1, r - 2, 'acid');
  fillEllipse(g, cx - 2, 12 + yb, 2, 2, 'fungusLight'); // brilho
  // veias
  set(g, cx + 2, 15 + yb, 'fungus');
  set(g, cx - 3, 16 + yb, 'fungus');

  // bocal
  const nx = front ? cx + r - 1 : cx - r + 1;
  fillRect(g, front ? nx : nx - 1, 13 + yb, 2, 2, 'fungusDark');
  if (spit) {
    set(g, front ? nx + 2 : nx - 2, 13 + yb, 'acid');
    set(g, front ? nx + 3 : nx - 3, 13 + yb, 'acid');
  }

  outlineWith(g, 'dark');
  return g;
};

const spitterFrame = (dir, anim, f) => {
  let opts = {};
  let clip = 0;
  if (anim === 'idle') opts.bob = [0, 0, -1, 0][f];
  else if (anim === 'walk') opts.bob = [0, -1, 0, -1][f];
  else if (anim === 'attack') {
    opts.inflate = [0, 1, 2, 0][f];
    opts.spit = f === 3;
  } else if (anim === 'hit') opts.bob = [-1, 0][f];
  else if (anim === 'die') {
    opts.bob = f + 1;
    clip = f * 5;
  }
  const g = drawSpitter(dir, opts);
  if (clip > 0) clearTopRows(g, clip);
  return g;
};

// ---------------------------------------------------------------------------
// fx-projectile-bolt 16x16 - nucleo biolum com faisca giratoria (1 direcao)
// ---------------------------------------------------------------------------
const boltFrame = (_dir, _anim, f) => {
  const g = grid(16, 16);
  const cx = 8;
  const cy = 8;
  fillEllipse(g, cx, cy, 3, 3, 'biolum');
  fillEllipse(g, cx, cy, 1.5, 1.5, 'player');
  const angs = [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2];
  const a = angs[f % 4];
  set(g, cx + Math.round(Math.cos(a) * 5), cy + Math.round(Math.sin(a) * 5), 'electric');
  set(g, cx + Math.round(Math.cos(a + Math.PI) * 5), cy + Math.round(Math.sin(a + Math.PI) * 5), 'electric');
  outlineWith(g, 'dark');
  return g;
};

// ---------------------------------------------------------------------------
// fx-impact-burst 16x16 - anel expansivo que dissipa (1 direcao, 5 frames)
// ---------------------------------------------------------------------------
const impactFrame = (_dir, _anim, f) => {
  const g = grid(16, 16);
  const cx = 8;
  const cy = 8;
  const r = 1 + f * 1.6;
  const color = f < 2 ? 'player' : f < 4 ? 'biolum' : 'fungus';
  for (let a = 0; a < Math.PI * 2; a += Math.PI / 8) {
    set(g, cx + Math.round(Math.cos(a) * r), cy + Math.round(Math.sin(a) * r), color);
  }
  if (f === 0) fillEllipse(g, cx, cy, 2, 2, 'player');
  return g;
};

// ---------------------------------------------------------------------------
// Especificacoes do primeiro pacote
// ---------------------------------------------------------------------------
export const ENTITY_SPECS = [
  {
    id: 'player-prospector',
    frameWidth: 24,
    frameHeight: 32,
    anchorX: 12,
    anchorY: 30,
    directions: 4,
    authoredDirs: ['dr', 'ur'],
    flipPairs: { dl: 'dr', ul: 'ur' },
    hitbox: { w: 0.68, h: 1.0 },
    animations: {
      idle: { frames: 4, fps: 6, loop: true },
      walk: { frames: 4, fps: 10, loop: true },
      attack: { frames: 4, fps: 12, loop: false },
      hit: { frames: 2, fps: 12, loop: false },
      die: { frames: 4, fps: 8, loop: false },
    },
    draw: playerFrame,
    prompt: 'isolated underground prospector, helmet lamp biolum accent, back bio-tank, iso 2:1, restricted palette',
  },
  {
    id: 'enemy-stalker',
    frameWidth: 24,
    frameHeight: 24,
    anchorX: 12,
    anchorY: 22,
    directions: 4,
    authoredDirs: ['dr', 'ur'],
    flipPairs: { dl: 'dr', ul: 'ur' },
    hitbox: { w: 0.64, h: 0.6 },
    animations: {
      idle: { frames: 4, fps: 6, loop: true },
      walk: { frames: 4, fps: 12, loop: true },
      hit: { frames: 2, fps: 12, loop: false },
      die: { frames: 4, fps: 10, loop: false },
    },
    draw: stalkerFrame,
    prompt: 'low chitinous multi-legged cave predator, acid eyes, strong silhouette, iso 2:1',
  },
  {
    id: 'enemy-spitter',
    frameWidth: 24,
    frameHeight: 24,
    anchorX: 12,
    anchorY: 22,
    directions: 4,
    authoredDirs: ['dr', 'ur'],
    flipPairs: { dl: 'dr', ul: 'ur' },
    hitbox: { w: 0.68, h: 0.7 },
    animations: {
      idle: { frames: 4, fps: 6, loop: true },
      walk: { frames: 4, fps: 8, loop: true },
      attack: { frames: 4, fps: 10, loop: false },
      hit: { frames: 2, fps: 12, loop: false },
      die: { frames: 4, fps: 10, loop: false },
    },
    draw: spitterFrame,
    prompt: 'bulbous acid-sac creature with nozzle, ranged spitter, iso 2:1, restricted palette',
  },
  {
    id: 'fx-projectile-bolt',
    frameWidth: 16,
    frameHeight: 16,
    anchorX: 8,
    anchorY: 8,
    directions: 1,
    authoredDirs: ['n'],
    flipPairs: {},
    hitbox: { w: 0.3, h: 0.3 },
    animations: { fly: { frames: 4, fps: 20, loop: true } },
    draw: boltFrame,
    prompt: 'biolum energy bolt with electric spark trail',
  },
  {
    id: 'fx-impact-burst',
    frameWidth: 16,
    frameHeight: 16,
    anchorX: 8,
    anchorY: 8,
    directions: 1,
    authoredDirs: ['n'],
    flipPairs: {},
    hitbox: { w: 0, h: 0 },
    animations: { burst: { frames: 5, fps: 24, loop: false } },
    draw: impactFrame,
    prompt: 'expanding impact ring, biolum to fungus fade',
  },
];

export const ANIM_ORDER = ['idle', 'walk', 'attack', 'hit', 'die', 'fly', 'burst'];
