// A REDE DE SEDA da Cerzideira: um disco de teia arremessado, autorado em
// oito rumos. O disco fica de pe, perpendicular ao voo — quem ve a rede vindo
// ve a teia de frente —, com raios, dois aneis e um no central de resina. Os
// tres quadros giram o disco em torno do eixo do voo: e o giro que diz que
// ela esta voando, e nao parada no ar.
import { box, renderVoxels } from './voxel.mjs';

export const NET_DIRS = ['dr', 'dl', 'ur', 'ul', 'r', 'd', 'l', 'u'];
/** Rumo de voo no mundo (x para a direita, y para baixo), por nome de rumo. */
const DIR_VECTOR = {
  r: [1, 0],
  dr: [Math.SQRT1_2, Math.SQRT1_2],
  d: [0, 1],
  dl: [-Math.SQRT1_2, Math.SQRT1_2],
  l: [-1, 0],
  ul: [-Math.SQRT1_2, -Math.SQRT1_2],
  u: [0, -1],
  ur: [Math.SQRT1_2, -Math.SQRT1_2],
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
  // O plano do disco: a lateral (perpendicular ao voo, no chao) e a vertical.
  const side = [-fy, fx];
  const R = 2.5;
  const Z0 = 4;
  const spin = (frame / 3) * (Math.PI / 4);
  const at = (angle, r) => [
    side[0] * Math.cos(angle) * r,
    side[1] * Math.cos(angle) * r,
    Z0 + Math.sin(angle) * r,
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
  // A camera e sempre a de `dr` (indice 0): o disco ja esta autorado no rumo.
  draw: (dir, _anim, frame) => renderVoxels(netModel(dir, frame), 0, 48, 48, 24, 36),
  prompt:
    'voxel-isometric thrown silk net, upright disc of pale mineral silk with eight spokes, two rings and a resin knot, spinning in flight, authored in eight directions',
};
