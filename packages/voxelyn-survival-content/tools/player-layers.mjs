import { renderVoxels } from './voxel.mjs';
import {
  ANCHOR_X,
  ANCHOR_Y,
  FRAME_HEIGHT,
  FRAME_WIDTH,
  RENDER_ANCHOR_X,
  RENDER_ANCHOR_Y,
  WALK_FRAMES,
  WALK_SWING,
  prospectorParts,
  walkFps,
} from './prospector.mjs';

const DIRS = ['dr', 'dl', 'ur', 'ul'];
const DIR_INDEX = { dr: 0, dl: 1, ur: 2, ul: 3 };

const idleBob = [0, 0, 1, 0];
// Coice: parado, recua fundo no disparo, volta. O clarao so existe no frame
// em que a arma cospe — um clarao que dura a animacao inteira vira lanterna.
const attackKick = [0, 2, 1, 0];
/** Quadros de `attack` em que a boca do cano acende. */
export const ATTACK_FLASH = [false, true, false, false];
const attackFlash = ATTACK_FLASH;

/**
 * Cadencia da caminhada, casada com a velocidade do Prospector na simulacao.
 *
 * O numero NAO e escolhido a olho. `PLAYER_SPEED` e 4,6 tiles/s e a passada
 * autorada cobre `WALK_CYCLE_TILES` por ciclo, entao a duracao do ciclo esta
 * determinada: qualquer outro valor faz o pe patinar contra o chao. Escrito como
 * a propria conta para o dia em que a velocidade mudar — muda-se o 4.6 e a
 * animacao acompanha, em vez de alguem redescobrir a relacao por tentativa.
 *
 * Duplicar a constante aqui e proposital e coberto por teste: o pacote de
 * conteudo nao depende da simulacao (ele so precisa de @voxelyn/core), e
 * inverter essa dependencia so para ler um numero acoplaria o pipeline de arte
 * ao balanceamento.
 */
const PLAYER_SPEED_TILES_PER_SECOND = 4.6;
const WALK_FPS = walkFps(PLAYER_SPEED_TILES_PER_SECOND);

/** Quadros de cada animacao das camadas, para quem precisa varrer as poses. */
export const LAYER_POSE_FRAMES = {
  idle: idleBob.length,
  walk: WALK_FRAMES,
  attack: attackKick.length,
};

/** Pose exata que cada quadro do atlas de camadas assa. */
export const poseFor = (anim, frame) => {
  if (anim === 'walk') return prospectorParts({ swing: WALK_SWING[frame % WALK_FRAMES] });
  if (anim === 'attack') {
    return prospectorParts({
      kick: attackKick[frame % attackKick.length],
      flash: attackFlash[frame % attackFlash.length],
    });
  }
  return prospectorParts({ bob: idleBob[frame % idleBob.length] });
};

const renderPart = (dir, anim, frame, part) =>
  renderVoxels(
    poseFor(anim, frame)[part],
    DIR_INDEX[dir],
    FRAME_WIDTH,
    FRAME_HEIGHT,
    RENDER_ANCHOR_X,
    RENDER_ANCHOR_Y
  );

/**
 * Referência comum de enquadramento usada pelos três atlas. O gerador inclui
 * estes frames ao calcular a união visual e aplica exatamente o mesmo dx/dy às
 * pernas, ao tronco e à arma, preservando cintura, anchor e escala entre as
 * camadas.
 */
const fitReference = () => {
  const frames = [];
  const animations = [
    ['idle', idleBob.length],
    ['walk', WALK_FRAMES],
    ['attack', attackKick.length],
  ];
  for (const dir of DIRS) {
    for (const [anim, count] of animations) {
      for (let frame = 0; frame < count; frame++) {
        const pose = poseFor(anim, frame);
        frames.push(renderVoxels(
          [...pose.lower, ...pose.upper, ...pose.gun],
          DIR_INDEX[dir],
          FRAME_WIDTH,
          FRAME_HEIGHT,
          RENDER_ANCHOR_X,
          RENDER_ANCHOR_Y
        ));
      }
    }
  }
  return frames;
};

const baseLayer = (id, animations, draw, prompt) => ({
  id,
  version: 4,
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
      idle: { frames: idleBob.length, fps: 6, loop: true },
      walk: { frames: WALK_FRAMES, fps: WALK_FPS, loop: true },
    },
    (dir, anim, frame) => renderPart(dir, anim, frame, 'lower'),
    'digitigrade locomotion layer for the Aurix PX prospector bot'
  ),
  baseLayer(
    'layer-player-prospector-upper',
    {
      idle: { frames: idleBob.length, fps: 6, loop: true },
      attack: { frames: attackKick.length, fps: 12, loop: false },
    },
    (dir, anim, frame) => renderPart(dir, anim, frame, 'upper'),
    'chassis, back hardpoint and sensor head layer for the Aurix PX prospector bot'
  ),
  // Mesmas animações do tronco, quadro a quadro: a arma acompanha o coice, e
  // qualquer divergência de contagem faria o cano descolar do braço no disparo.
  baseLayer(
    'layer-player-prospector-gun',
    {
      idle: { frames: idleBob.length, fps: 6, loop: true },
      attack: { frames: attackKick.length, fps: 12, loop: false },
    },
    (dir, anim, frame) => renderPart(dir, anim, frame, 'gun'),
    'shard driver weapon layer for the Aurix PX prospector bot, tinted by barrel heat at runtime'
  ),
];
