// Costureiros: needle forelimbs, a hollow silk abdomen and load-bearing legs.
// Every view is rendered from the same model. renderVoxels keeps the model on
// its lattice and rotates the camera for diagonal views (anti-corduroy).
import { box, collapse, renderVoxels } from './voxel.mjs';

export const STITCHER_DIRS = ['dr', 'dl', 'ur', 'ul'];
export const SEAMSTRESS_DIRS = [...STITCHER_DIRS, 'r', 'd', 'l', 'u'];
const DIR_INDEX = Object.fromEntries(SEAMSTRESS_DIRS.map((d, i) => [d, i]));
const round = (x) => Math.round(x * 2) / 2;

// Stepped segments are authored anatomy, not rotation/resampling of a model.
const limb = (out, a, b, width, mat) => {
  const n = Math.max(1, Math.ceil(Math.max(...a.map((v, i) => Math.abs(v - b[i]))) * 2));
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    out.push(
      box(...a.map((v, k) => round(v + (b[k] - v) * t) - width / 2), width, width, width, mat),
    );
  }
};

export const stitcherModel = (anim, frame, queen = false) => {
  const phase = (frame * Math.PI) / 3;
  const moving = anim === 'walk';
  const sewing = anim === 'special';
  const striking = anim === 'attack';
  const pull = sewing ? [0, 0.5, 1.5, 2, 1, 0][frame % 6] : 0;
  const thrust = striking ? [-0.5, -1, 2, 0.5][frame % 4] : 0;
  const breath = anim === 'idle' ? [0, 0.5, 0.5, 0][frame % 4] : 0;
  const hurt = anim === 'hit' ? [1, 0][frame % 2] : 0;
  const scale = queen ? 1.4 : 1;
  const z = (queen ? 4.5 : 2.5) + breath - hurt;
  const b = [];

  // Low thorax, pinched waist, raised OPEN abdomen. The negative space is
  // the identifying feature: a living loom, with no human clothes or tools.
  b.push(box(-1.5, -3, z, 3, 4, 2, 'chitin'));
  b.push(box(-1, -2.5, z + 1.5, 2, 3, 1, 'silk'));
  b.push(box(-0.5, 0.5, z + 0.5, 1, 2, 1, 'chitin'));
  const cageWidth = queen ? 3.5 : 2.5;
  const cageHeight = queen ? 5 : 3;
  for (const side of [-1, 1]) {
    limb(b, [side, 1.5, z + 0.5], [side * cageWidth, 3, z + 2], 1, 'chitin');
    limb(b, [side * cageWidth, 3, z + 2], [side * 1.5, 5, z + cageHeight], 1, 'silk');
    limb(b, [side * 1.5, 5, z + cageHeight], [side * 0.5, 5.5, z + 1], 1, 'chitin');
    // Spool strands span the opening, leaving large holes between them.
    for (let r = 0; r < (queen ? 3 : 2); r++) {
      limb(b, [side * cageWidth, 3, z + 1.5 + r], [side * 0.5, 5.5, z + 1 + r], 0.5, 'silk');
    }
  }
  b.push(box(-0.5, 4.5, z + 1.5, 1, 1, 2, 'sutureResin'));
  // A tiny deep wound marks the weak ventral seam, never a luminous eye.
  b.push(box(-0.5, -2, z - 0.5, 1, 2, 1, 'blood'));

  // Three walking pairs on a worker, four on the queen. Feet remain planted
  // in idle; walking alternates the support triangles instead of bobbing the
  // complete model above the ground.
  const pairs = queen ? 4 : 3;
  for (let p = 0; p < pairs; p++) {
    const y = -2 + p * 1.75;
    for (const side of [-1, 1]) {
      const gait = moving ? Math.sin(phase + p * Math.PI + (side < 0 ? Math.PI : 0)) : 0;
      const reach = (queen ? 5.5 : 4) + (p === 0 ? 0.5 : 0);
      const knee = [side * reach, y - 0.5 + gait * 0.5, z + 1.5];
      const foot = [side * (reach + 1), y + (p - 1) * 0.75 + gait, Math.max(0.5, gait)];
      limb(b, [side * 1.5, y, z + 0.5], knee, 0.75, 'chitin');
      limb(b, knee, foot, 0.5, 'silk');
      b.push(box(knee[0] - 0.5, knee[1] - 0.5, knee[2] - 0.5, 1, 1, 1, 'sutureResin'));
    }
  }

  // Paired sensory feelers, then asymmetric needle forelimbs: one pins the
  // rock while the other draws the stitch. Their motion is visible in every
  // direction, including a true profile.
  b.push(box(-1, -4, z + 0.5, 2, 1.5, 1.5, 'chitin'));
  for (const side of [-1, 1]) {
    limb(b, [side * 0.5, -4, z + 2], [side * 1.5, -5.5, z + 2.5], 0.5, 'silk');
    const draw = side < 0 ? pull : -pull * 0.25;
    const elbow = [side * (3 + pull * 0.5), -4 - thrust * 0.25, z + 2 + draw];
    const needle = [side * (1.5 + pull * 0.5), -7 - thrust + draw, z - 0.5];
    limb(b, [side * 1.5, -2, z + 1], elbow, 0.75, 'chitin');
    limb(b, elbow, needle, 0.5, 'silk');
    limb(b, needle, [needle[0], needle[1] - 1.5, needle[2] - 1], 0.5, 'silk');
  }

  if (queen) {
    // A fan of mineral needles identifies the queen from the rear as well.
    // Unequal heights and an open middle retain the silhouette at 45 degrees.
    for (const side of [-1, 1]) {
      for (let i = 0; i < 3; i++) {
        limb(
          b,
          [side * 1.5, 3 + i * 0.75, z + 3],
          [side * (3.5 - i * 0.5), 4 + i, z + 5 + i * 0.5],
          0.5,
          'silk',
        );
      }
    }
    b.push(box(-1, -1.5, z + 2.5, 2, 2.5, 1, 'sutureResin'));
  }

  const scaled = b.map((v) => ({
    ...v,
    x: round(v.x * scale),
    y: round(v.y * scale),
    z: round(v.z * scale),
    w: Math.max(0.5, round(v.w * scale)),
    d: Math.max(0.5, round(v.d * scale)),
    h: Math.max(0.5, round(v.h * scale)),
  }));
  return anim === 'die' ? collapse(scaled, Math.min(1, frame / 4)) : scaled;
};

const animations = {
  idle: { frames: 4, fps: 6, loop: true },
  walk: { frames: 6, fps: 10, loop: true },
  attack: { frames: 4, fps: 10, loop: false },
  special: { frames: 6, fps: 8, loop: false },
  hit: { frames: 2, fps: 12, loop: false },
  die: { frames: 5, fps: 10, loop: false },
};

const spec = (queen) => {
  // Union measured across every animation in every authored direction,
  // including death. Two pixels of border, no rescaling or unused canvas.
  const w = queen ? 176 : 104;
  const h = queen ? 122 : 72;
  const ax = queen ? 88 : 50;
  const ay = queen ? 88 : 48;
  return {
    id: queen ? 'enemy-seamstress' : 'enemy-stitcher',
    version: 1,
    frameWidth: w,
    frameHeight: h,
    anchorX: ax,
    anchorY: ay,
    directions: queen ? 8 : 4,
    authoredDirs: queen ? SEAMSTRESS_DIRS : STITCHER_DIRS,
    flipPairs: {},
    hitbox: { w: queen ? 1.8 : 0.72, h: queen ? 1.8 : 0.8 },
    footprint: { w: queen ? 2 : 1, h: queen ? 2 : 1, offsetX: 0, offsetY: 0 },
    animations,
    draw: (dir, anim, frame) =>
      renderVoxels(stitcherModel(anim, frame, queen), DIR_INDEX[dir], w, h, ax, ay),
    prompt: queen
      ? 'Cerzideira: eight-direction mineral arthropod, suspended hollow silk ribcage, eight articulated load-bearing legs, paired asymmetrical needle forelimbs, open dorsal fan; existing camera-rotation face raster for diagonal anti-corduroy'
      : 'Costureiro: pale six-legged subterranean arthropod, open silk abdomen, pinning and pulling needle forelimbs, articulated sewing and walking poses',
  };
};

export const STITCHER_SPECS = [spec(false), spec(true)];
