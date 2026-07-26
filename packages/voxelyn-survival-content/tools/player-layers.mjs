import { box, renderVoxels } from './voxel.mjs';

const DIRS = ['dr', 'dl', 'ur', 'ul'];
const DIR_INDEX = { dr: 0, dl: 1, ur: 2, ul: 3 };
const FRAME_WIDTH = 32;
const FRAME_HEIGHT = 40;
const ANCHOR_X = 16;
const ANCHOR_Y = 38;

const idleBob = [0, 0, 1, 0];
const walkStride = [0, 1, 2, 1, 0, -1];
const attackSwing = [0, 0, 1, 2];

/**
 * Camadas voxel do Prospector em pé.
 *
 * As pernas e o restante do corpo são autorados no mesmo sistema de coordenadas
 * e rasterizados com a mesma referência de enquadramento. Isso permite ao
 * runtime combinar locomoção e ataque sem uma emenda que salta entre frames.
 */
const prospectorStandingLayers = ({ bob = 0, stride = 0, swing = 0 } = {}) => {
  const lower = [];
  const upper = [];

  // botas + pernas
  lower.push(box(-2, -1, Math.max(0, stride), 2, 2, 1, 'rust'));
  lower.push(box(1, -1, Math.max(0, -stride), 2, 2, 1, 'rust'));
  lower.push(box(-2, -1, 1 + Math.max(0, stride), 2, 2, 3, 'rockDeep'));
  lower.push(box(1, -1, 1 + Math.max(0, -stride), 2, 2, 3, 'rockDeep'));

  // cinto: pertence ao tronco para esconder a junção com as pernas.
  upper.push(box(-2, -1, 5 + bob, 5, 2, 1, 'loot'));
  // torso: peitoral na frente, módulo fúngico nas costas
  upper.push(box(-2, -1, 6 + bob, 5, 2, 4, 'rock'));
  upper.push(box(-2, -2, 6 + bob, 5, 1, 4, 'rust'));
  upper.push(box(-1, 1, 7 + bob, 3, 1, 3, 'fungus'));
  upper.push(box(-1, 2, 8 + bob, 3, 1, 1, 'biolum'));
  // ombreiras
  upper.push(box(-3, -1, 9 + bob, 1, 2, 1, 'rock'));
  upper.push(box(3, -1, 9 + bob, 1, 2, 1, 'rock'));
  // capacete + visor + lanterna
  upper.push(box(-1, -1, 10 + bob, 3, 3, 2, 'bone'));
  upper.push(box(-1, -2, 10 + bob, 3, 1, 1, 'biolum'));
  upper.push(box(0, -2, 11 + bob, 1, 1, 1, 'loot'));
  // braços + ferramenta/arma
  upper.push(box(-3, -1, 6 + bob, 1, 2, 3, 'rock'));
  upper.push(box(3, -1, 6 + bob + swing, 1, 2, 3, 'rock'));
  upper.push(box(3, -2, 4 + bob + swing * 3, 1, 1, 3, 'loot'));

  return { lower, upper };
};

const poseFor = (anim, frame) => {
  if (anim === 'walk') return prospectorStandingLayers({ stride: walkStride[frame % walkStride.length] });
  if (anim === 'attack') return prospectorStandingLayers({ swing: attackSwing[frame % attackSwing.length] });
  return prospectorStandingLayers({ bob: idleBob[frame % idleBob.length] });
};

const renderPart = (dir, anim, frame, part) =>
  renderVoxels(poseFor(anim, frame)[part], DIR_INDEX[dir], FRAME_WIDTH, FRAME_HEIGHT, 14, 34);

/**
 * Referência comum de enquadramento usada pelos dois atlas. O gerador inclui
 * estes frames ao calcular a união visual e aplica exatamente o mesmo dx/dy às
 * pernas e ao tronco, preservando cintura, anchor e escala entre as camadas.
 */
const fitReference = () => {
  const frames = [];
  const animations = [
    ['idle', idleBob.length],
    ['walk', walkStride.length],
    ['attack', attackSwing.length],
  ];
  for (const dir of DIRS) {
    for (const [anim, count] of animations) {
      for (let frame = 0; frame < count; frame++) {
        const pose = poseFor(anim, frame);
        frames.push(renderVoxels([...pose.lower, ...pose.upper], DIR_INDEX[dir], FRAME_WIDTH, FRAME_HEIGHT, 14, 34));
      }
    }
  }
  return frames;
};

const baseLayer = (id, animations, draw, prompt) => ({
  id,
  version: 3,
  frameWidth: FRAME_WIDTH,
  frameHeight: FRAME_HEIGHT,
  anchorX: ANCHOR_X,
  anchorY: ANCHOR_Y,
  directions: 4,
  authoredDirs: DIRS,
  flipPairs: {},
  hitbox: { w: 0.68, h: 1 },
  footprint: { w: 1, h: 1, offsetX: 0, offsetY: 0 },
  animations,
  draw,
  fitReference,
  prompt,
});

export const PLAYER_LAYER_SPECS = [
  baseLayer(
    'layer-player-prospector-lower',
    {
      idle: { frames: 4, fps: 6, loop: true },
      walk: { frames: 6, fps: 10, loop: true },
    },
    (dir, anim, frame) => renderPart(dir, anim, frame, 'lower'),
    'lower-body locomotion layer for the voxel-isometric prospector'
  ),
  baseLayer(
    'layer-player-prospector-upper',
    {
      idle: { frames: 4, fps: 6, loop: true },
      attack: { frames: 4, fps: 12, loop: false },
    },
    (dir, anim, frame) => renderPart(dir, anim, frame, 'upper'),
    'upper-body aim and attack layer for the voxel-isometric prospector'
  ),
];
