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

const QUEEN_SUIT = { silk: 'spiderRed', chitin: 'spiderBlue' };

export const stitcherModel = (anim, frame, queen = false, brood = false, tiny = false) => {
  const flying = anim === 'fly';
  const crouching = anim === 'burst';
  const phase = (frame * Math.PI) / 3;
  const moving = anim === 'walk';
  const sewing = anim === 'special';
  const striking = anim === 'attack';
  // DERRUBADA: a pose da janela de dano. As pernas cedem para fora, o corpo
  // desce ate quase o chao e o abdome tomba para a frente, com a costura
  // ventral (o ponto fraco) virada para quem olha. O jogador ganha 1,5x de
  // dano nesse intervalo; sem uma pose propria a vantagem era invisivel — o
  // corpo continuava de pe, imovel, e lia como um congelamento.
  const downed = anim === 'downed';
  const struggle = downed ? [0, 1, 0.5][frame % 3] : 0;
  const pull = sewing ? (queen ? [0, 1, 2][frame % 3] : [0, 0.5, 1.5, 2, 1, 0][frame % 6]) : 0;
  const thrust = striking ? [-0.5, -1, 2, 0.5][frame % 4] : 0;
  const breath = anim === 'idle' ? [0, 0.5, 0.5, 0][frame % 4] : 0;
  const hurt = anim === 'hit' ? [1, 0][frame % 2] : 0;
  // A ARANHINHA e a cria sem os sacos de seda, a 0,4: um bicho de chao, nao
  // uma ameaca. Mesmo modelo, mesmas poses.
  const scale = queen ? 1.4 : tiny ? 0.4 : brood ? 0.55 : 1;
  const z = downed ? 1 + struggle * 0.5 : crouching ? 1 : (queen ? 4.5 : 2.5) + breath - hurt;
  const b = [];

  // Low thorax, pinched waist, raised OPEN abdomen. The negative space is
  // the identifying feature: a living loom, with no human clothes or tools.
  b.push(box(-1.5, -3, z, 3, 4, 2, 'chitin'));
  b.push(box(-1, -2.5, z + 1.5, 2, 3, 1, 'silk'));
  b.push(box(-0.5, 0.5, z + 0.5, 1, 2, 1, 'chitin'));
  // Derrubada, a gaiola de seda abre mais larga e mais baixa: tombou.
  const cageWidth = (queen ? 3.5 : 2.5) * (downed ? 1.3 : 1);
  const cageHeight = downed ? 2.5 : queen ? 5 : 3;
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
  // Derrubada, a costura ventral fica exposta: maior, e virada para a frente.
  if (downed) b.push(box(-1, -3, z - 0.5, 2, 3, 1.5, 'blood'));
  else b.push(box(-0.5, -2, z - 0.5, 1, 2, 1, 'blood'));

  // Three walking pairs on a worker, four on the queen. Feet remain planted
  // in idle; walking alternates the support triangles instead of bobbing the
  // complete model above the ground.
  const pairs = queen ? 4 : 3;
  for (let p = 0; p < pairs; p++) {
    const y = -2 + p * 1.75;
    for (const side of [-1, 1]) {
      const gait = moving ? Math.sin(phase + p * Math.PI + (side < 0 ? Math.PI : 0)) : 0;
      const reach = (queen ? 5.5 : 4) + (p === 0 ? 0.5 : 0);
      // Derrubada: joelhos no chao, abertos para fora; as pernas de um lado
      // e do outro se debatem em quadros alternados.
      const kick = downed ? struggle * ((p + (side < 0 ? 1 : 0)) % 2) : 0;
      // O alcance nao cresce: o quadro do atlas e a uniao medida das poses de
      // pe, e uma perna mais aberta que a caminhada nao caberia nele.
      const knee = flying
        ? [side * (reach - 2), y, z + 1]
        : downed
          ? [side * (reach + 0.5), y - 0.5, 0.75 + kick]
          : [side * reach, y - 0.5 + gait * 0.5, z + 1.5];
      const foot = flying
        ? [side * 2, y + 1, z - 0.5]
        : downed
          ? [side * (reach + 1), y + (p - 1) * 0.75, 0.5]
          : [side * (reach + 1), y + (p - 1) * 0.75 + gait, Math.max(0.5, gait)];
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
    // Derrubada, as agulhas caem abertas para os lados, com a ponta no chao.
    const elbow = downed
      ? [side * 4, -4, z + 1]
      : [side * (3 + pull * 0.5), -4 - thrust * 0.25, z + 2 + draw];
    const needle = downed
      ? [side * 4.5, -5, 2.5]
      : [side * (1.5 + pull * 0.5), -7 - thrust + draw, z - 0.5];
    limb(b, [side * 1.5, -2, z + 1], elbow, 0.75, 'chitin');
    limb(b, elbow, needle, 0.5, 'silk');
    limb(b, needle, [needle[0], needle[1] - 1.5, needle[2] - 1], 0.5, 'silk');
  }

  if (brood && !tiny) {
    // Unspun silk sacs: a compact, unfinished abdomen, distinct from a small worker.
    b.push(box(-2, 2.5, z + 1, 4, 3, 2, 'silk'));
    b.push(box(-0.5, 3, z + 3, 1, 1.5, 0.5, 'sutureResin'));
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
    // O TRAJE da rainha: a seda vira vermelho, a cuticula vira azul. Resina e
    // o coracao ficam. Costureiros e crias continuam na seda mineral.
    mat: queen ? (QUEEN_SUIT[v.mat] ?? v.mat) : v.mat,
    x: round(v.x * scale),
    y: round(v.y * scale),
    z: round(v.z * scale),
    w: Math.max(0.5, round(v.w * scale)),
    d: Math.max(0.5, round(v.d * scale)),
    h: Math.max(0.5, round(v.h * scale)),
  }));
  return anim === 'die' ? collapse(scaled, Math.min(1, frame / 4)) : scaled;
};

const animations = (queen) => ({
  idle: { frames: queen ? 3 : 4, fps: queen ? 5 : 6, loop: true },
  walk: { frames: 6, fps: 10, loop: true },
  attack: { frames: 4, fps: 10, loop: false },
  special: { frames: queen ? 3 : 6, fps: queen ? 5 : 8, loop: false },
  hit: { frames: 2, fps: 12, loop: false },
  fly: { frames: 1, fps: 6, loop: true },
  ...(!queen ? { burst: { frames: 2, fps: 8, loop: false } } : {}),
  // So a rainha cai: e a unica que o jogador derruba cortando o apoio. Tres
  // quadros lentos, em laco — um corpo se debatendo no chao, nao um golpe.
  // Cada quadro custa oito rumos; tres e o que cabe no orcamento sob demanda.
  ...(queen ? { downed: { frames: 3, fps: 4, loop: true } } : {}),
  die: { frames: 5, fps: 10, loop: false },
});

const SPIDERLING_ANIMATIONS = {
  idle: { frames: 4, fps: 6, loop: true },
  walk: { frames: 6, fps: 12, loop: true },
  attack: { frames: 2, fps: 8, loop: false },
  hit: { frames: 2, fps: 10, loop: false },
  die: { frames: 4, fps: 10, loop: false },
};

const spec = (queen, brood = false, tiny = false) => {
  // Union measured across every animation in every authored direction,
  // including death. Two pixels of border, no rescaling or unused canvas.
  const w = queen ? 176 : tiny ? 48 : brood ? 64 : 104;
  const h = queen ? 122 : tiny ? 40 : brood ? 48 : 74;
  const ax = queen ? 88 : tiny ? 24 : brood ? 32 : 50;
  const ay = queen ? 88 : tiny ? 28 : brood ? 34 : 48;
  return {
    id: queen
      ? 'enemy-seamstress'
      : tiny
        ? 'enemy-silk-spiderling'
        : brood
          ? 'enemy-seamstress-brood'
          : 'enemy-stitcher',
    version: 1,
    frameWidth: w,
    frameHeight: h,
    anchorX: ax,
    anchorY: ay,
    directions: queen ? 8 : 4,
    authoredDirs: queen ? SEAMSTRESS_DIRS : STITCHER_DIRS,
    flipPairs: {},
    hitbox: { w: queen ? 1.8 : tiny ? 0.5 : 0.72, h: queen ? 1.8 : tiny ? 0.5 : 0.8 },
    footprint: { w: queen ? 2 : 1, h: queen ? 2 : 1, offsetX: 0, offsetY: 0 },
    // A aranhinha so precisa das obrigatorias: cada quadro custa quatro rumos
    // e o grupo sob demanda da Cerzideira esta perto do teto.
    animations: tiny ? SPIDERLING_ANIMATIONS : animations(queen),
    draw: (dir, anim, frame) =>
      renderVoxels(stitcherModel(anim, frame, queen, brood, tiny), DIR_INDEX[dir], w, h, ax, ay),
    prompt: queen
      ? 'Cerzideira: eight-direction mineral arthropod, suspended hollow silk ribcage, eight articulated load-bearing legs, paired asymmetrical needle forelimbs, open dorsal fan; existing camera-rotation face raster for diagonal anti-corduroy'
      : 'Costureiro: pale six-legged subterranean arthropod, open silk abdomen, pinning and pulling needle forelimbs, articulated sewing and walking poses',
  };
};

export const STITCHER_SPECS = [spec(false), spec(true), spec(false, true), spec(false, true, true)];
