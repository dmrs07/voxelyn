import { box, renderVoxels } from './voxel.mjs';

const DIRS = ['dr', 'dl', 'ur', 'ul'];
const DIR_INDEX = { dr: 0, dl: 1, ur: 2, ul: 3 };
const FRAME_WIDTH = 32;
const FRAME_HEIGHT = 40;
const ANCHOR_X = 16;
const ANCHOR_Y = 38;

const idleBob = [0, 0, 1, 0];
const walkStride = [0, 1, 2, 1, 0, -1];
// Coice: parado, recua fundo no disparo, volta. O clarao so existe no frame
// em que a arma cospe — um clarao que dura a animacao inteira vira lanterna.
const attackKick = [0, 2, 1, 0];
const attackFlash = [false, true, false, false];

/**
 * Camadas voxel do Prospector em pé.
 *
 * As pernas e o restante do corpo são autorados no mesmo sistema de coordenadas
 * e rasterizados com a mesma referência de enquadramento. Isso permite ao
 * runtime combinar locomoção e ataque sem uma emenda que salta entre frames.
 *
 * A ARMA sai numa camada própria pela mesma razão que o tronco saiu das pernas:
 * ela precisa mudar de cor sozinha. O calor é uma mecânica que já existe na
 * simulação — cada tiro aquece, o excesso trava o gatilho e machuca — e até aqui
 * ela só aparecia numa barrinha do HUD. Uma camada isolada deixa o runtime
 * pintar o metal do frio ao incandescente sem tocar no resto do corpo, que é o
 * único jeito de o jogador ler o próprio calor olhando para o personagem em vez
 * de para a interface.
 */
const prospectorStandingLayers = ({ bob = 0, stride = 0, kick = 0, flash = false } = {}) => {
  const lower = [];
  const upper = [];
  const gun = [];

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
  // Braco de apoio, a frente do corpo: sustenta o cano com as duas maos.
  upper.push(box(-3, -1, 6 + bob, 1, 2, 3, 'rock'));
  upper.push(box(1, -2 + kick, 7 + bob, 1, 1, 1, 'rock'));
  // Braco da coronha, que absorve o coice.
  upper.push(box(3, -1 + kick, 6 + bob, 1, 2, 3, 'rock'));

  // CRAVADOR DE ESTILHACOS — nao uma picareta.
  //
  // O prospector atira: tem projetil, calor e superaquecimento. A "arma" era um
  // palito 1x1x3 de `loot` que subia num golpe de cima para baixo, o que nao
  // corresponde a nenhuma dessas mecanicas — lia como picareta porque era uma
  // picareta. Aqui e uma ferramenta de mineracao reaproveitada: camara biolum
  // que alimenta o disparo, cano curto apontado para a FRENTE (-y) e coronha
  // atras. No disparo a arma inteira recua (+y) em vez de girar, que e o gesto
  // que o recuo da tela ja descreve.
  //
  // A 4px por voxel a arma tem ~3 voxels: ela precisa ler por CONTRASTE e
  // SILHUETA, nao por detalhe. A primeira tentativa fez o receptor de
  // `rockDeep`, que e a cor do proprio corpo — a arma sumia dentro do torso — e
  // pos uma camara biolum de 2 voxels, que virou a TERCEIRA mancha teal do
  // personagem, competindo com o visor e o modulo fungico. Aqui o corpo da arma
  // e palido para destacar contra o tronco escuro, e so UM voxel e biolum.
  const gunY = -1 + kick;
  // receptor palido, atravessado na altura do peito: a barra que quebra a
  // silhueta e diz "isto e uma ferramenta", nao um braco
  gun.push(box(2, gunY - 2, 7 + bob, 2, 3, 1, 'bone'));
  // camara de energia: um unico voxel, no ponto onde o cano encontra o corpo
  gun.push(box(2, gunY - 1, 8 + bob, 1, 1, 1, 'biolum'));
  // boca do cano, escura em repouso e acesa no frame do disparo
  gun.push(box(2, gunY - 3, 7 + bob, 1, 1, 1, flash ? 'loot' : 'rust'));

  return { lower, upper, gun };
};

const poseFor = (anim, frame) => {
  if (anim === 'walk') return prospectorStandingLayers({ stride: walkStride[frame % walkStride.length] });
  if (anim === 'attack') {
    return prospectorStandingLayers({
      kick: attackKick[frame % attackKick.length],
      flash: attackFlash[frame % attackFlash.length],
    });
  }
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
          14,
          34
        ));
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
  // Mesmas animações do tronco, quadro a quadro: a arma acompanha o coice, e
  // qualquer divergência de contagem faria o cano descolar do braço no disparo.
  baseLayer(
    'layer-player-prospector-gun',
    {
      idle: { frames: 4, fps: 6, loop: true },
      attack: { frames: 4, fps: 12, loop: false },
    },
    (dir, anim, frame) => renderPart(dir, anim, frame, 'gun'),
    'shard driver weapon layer for the voxel-isometric prospector, tinted by barrel heat at runtime'
  ),
];
