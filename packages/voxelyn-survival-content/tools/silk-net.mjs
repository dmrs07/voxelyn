// A REDE DE SEDA da Cerzideira: um disco de teia arremessado, autorado em
// oito rumos. O disco fica de pe, perpendicular ao voo — quem ve a rede vindo
// ve a teia de frente —, com raios, dois aneis e um no central de resina. Os
// tres quadros giram o disco em torno do eixo do voo: e o giro que diz que
// ela esta voando, e nao parada no ar.
import { DIR_UNROTATED, box, renderVoxels } from './voxel.mjs';

export const NET_DIRS = ['dr', 'dl', 'ur', 'ul', 'r', 'd', 'l', 'u'];
/**
 * Rumo de voo NO MUNDO, por nome de rumo. Os nomes sao rumos DE TELA (e assim
 * que `dirFromFacing8` escolhe o quadro): `dr` e a diagonal para baixo e a
 * direita da tela, que no mundo e o eixo +x; `r` e a horizontal da tela, que
 * no mundo e a diagonal (+x, -y). O modelo e construido ja no rumo e
 * desenhado SEM giro de camera (`DIR_UNROTATED`), entao os eixos do modelo
 * sao os eixos do mundo, e o disco projeta na tela exatamente como o
 * projetil autoritativo anda.
 */
const DIR_VECTOR = {
  r: [Math.SQRT1_2, -Math.SQRT1_2],
  dr: [1, 0],
  d: [Math.SQRT1_2, Math.SQRT1_2],
  dl: [0, 1],
  l: [-Math.SQRT1_2, Math.SQRT1_2],
  ul: [-1, 0],
  u: [-Math.SQRT1_2, -Math.SQRT1_2],
  ur: [0, -1],
};
const round = (x) => Math.round(x * 2) / 2;

const limb = (out, a, b, width, mat) => {
  const n = Math.max(1, Math.ceil(Math.max(...a.map((v, i) => Math.abs(v - b[i]))) * 2));
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    out.push(
      box(...a.map((v, k) => round(v + (b[k] - v) * t) - width / 2), width, width, width, mat),
    );
  }
};

export const netModel = (dir, frame) => {
  const [fx, fy] = DIR_VECTOR[dir];
  const R = 2.5;
  const Z0 = 4;
  const spin = (frame / 3) * (Math.PI / 4);
  // O DISCO NAO FICA DE PE, PERPENDICULAR AO VOO, EM NENHUM RUMO: a camera
  // isometrica veria uma linha em metade deles. Duas correcoes, por rumo:
  // - INCLINACAO: o topo pende para tras quando o disco vem para a camera e
  //   para a frente quando se afasta (`atan2(fx + fy, 2)` e o angulo que
  //   maximiza a altura projetada do eixo vertical do disco).
  // - GUINADA: nos rumos horizontais da tela (r/l) o eixo lateral do disco
  //   projeta so em profundidade; ele gira ate 45 graus em direcao ao voo
  //   para ganhar largura na tela. Nos rumos verticais (d/u) nao gira.
  const tilt = Math.atan2(fx + fy, 2);
  const up = [-fx * Math.sin(tilt), -fy * Math.sin(tilt), Math.cos(tilt)];
  const yaw = (Math.PI / 4) * (1 - Math.abs(fx + fy) / Math.SQRT2);
  const side = [-fy * Math.cos(yaw) + fx * Math.sin(yaw), fx * Math.cos(yaw) + fy * Math.sin(yaw)];
  const at = (angle, r) => [
    side[0] * Math.cos(angle) * r + up[0] * Math.sin(angle) * r,
    side[1] * Math.cos(angle) * r + up[1] * Math.sin(angle) * r,
    Z0 + up[2] * Math.sin(angle) * r,
  ];
  const b = [];
  // Raios.
  for (let k = 0; k < 8; k++) {
    const a = spin + (k * Math.PI) / 4;
    limb(b, at(a, 0.5), at(a, R), 0.5, 'silk');
  }
  // Dois aneis, em segmentos.
  for (const r of [R * 0.55, R]) {
    const steps = 16;
    for (let k = 0; k < steps; k++) {
      const a0 = spin + (k / steps) * Math.PI * 2,
        a1 = spin + ((k + 1) / steps) * Math.PI * 2;
      limb(b, at(a0, r), at(a1, r), 0.5, 'silk');
    }
  }
  // O no central de resina, um pouco a frente no rumo do voo.
  b.push(box(fx * 0.5 - 0.5, fy * 0.5 - 0.5, Z0 - 0.5, 1, 1, 1, 'sutureResin'));
  return b;
};

export const SILK_NET_SPEC = {
  id: 'fx-silk-net',
  version: 1,
  frameWidth: 48,
  frameHeight: 48,
  anchorX: 24,
  anchorY: 36,
  directions: 8,
  authoredDirs: NET_DIRS,
  flipPairs: {},
  hitbox: { w: 1.2, h: 1.2 },
  footprint: { w: 0, h: 0, offsetX: 0, offsetY: 0 },
  animations: { fly: { frames: 3, fps: 10, loop: true } },
  // Sem giro de camera: o disco ja esta autorado no rumo, em eixos do mundo.
  draw: (dir, _anim, frame) => renderVoxels(netModel(dir, frame), DIR_UNROTATED, 48, 48, 24, 36),
  prompt:
    'voxel-isometric thrown silk net, upright disc of pale mineral silk with eight spokes, two rings and a resin knot, spinning in flight, authored in eight directions',
};
