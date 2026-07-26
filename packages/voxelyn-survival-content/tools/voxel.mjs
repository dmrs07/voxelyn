// Rasterizador voxel isometrico, construido sobre o @voxelyn/core.
//
// Por que existe: o gerador de personagens desenhava em 2D (elipses, linhas,
// retangulos) com duas tonalidades fingindo volume, enquanto a art bible e a
// production spec pedem "modelo voxel pre-renderizado, com volumes facetados e
// leitura tridimensional clara". Alem de nao entregar volume, redesenhar cada
// direcao a mao fazia as quatro divergirem entre si.
//
// Aqui o personagem e um MODELO 3D de caixas de voxels. As quatro direcoes sao
// rotacoes de 90 graus do MESMO modelo, entao nao podem discordar. A projecao,
// a ordem do pintor e a chave de profundidade vem do core (projectIso,
// makeDrawKey, sortDrawCommands) — nao ha matematica isometrica duplicada aqui.
import { makeDrawKey, projectIso, sortDrawCommands } from '@voxelyn/core';
import { grid, set } from './lib.mjs';

/**
 * Rampas de face por material: [topo, esquerda, direita].
 * TODAS as entradas sao nomes da paleta mestra — o validador rejeita qualquer
 * cor fora dela, entao sombrear aqui e escolher rampa, nao multiplicar canal.
 * Key light no topo-esquerda, conforme a art bible.
 */
export const RAMPS = {
  rock: ['rockLight', 'rock', 'rockShadow'],
  rockDeep: ['rock', 'rockShadow', 'dark'],
  rust: ['bone', 'rust', 'rockShadow'],
  bone: ['bone', 'rust', 'rockShadow'],
  fungus: ['fungusLight', 'fungus', 'fungusDark'],
  fungusDeep: ['fungus', 'fungusDark', 'dark'],
  biolum: ['biolum', 'fungusLight', 'fungus'],
  acid: ['acid', 'fungusLight', 'fungus'],
  fire: ['loot', 'fire', 'blood'],
  blood: ['blood', 'rust', 'dark'],
  electric: ['electric', 'rockLight', 'rock'],
  loot: ['loot', 'rust', 'rockShadow'],
  player: ['player', 'bone', 'rust'],
};

/** Caixa de voxels. Eixos: x = leste, y = sul, z = cima; origem entre os pes. */
export const box = (x, y, z, w, d, h, mat) => ({ x, y, z, w, d, h, mat });

// Um voxel na projecao 2:1: 4px de largura, 2px de topo, 2px de lateral.
// tileW/tileH/zStep sao os parametros que projectIso() do core espera.
export const VOX = { tileW: 4, tileH: 2, zStep: 2 };

// makeDrawKey desloca bits, entao exige coordenadas nao-negativas. Os modelos
// sao autorados em torno da origem (pes no centro), logo precisam deste offset.
const KEY_BIAS = 64;

const rot = (x, y, r) => {
  if (r === 1) return [-y, x];
  if (r === 2) return [-x, -y];
  if (r === 3) return [y, -x];
  return [x, y];
};

/** Expande caixas em voxels, descartando os internos (nunca visiveis). */
const shellVoxels = (boxes, r) => {
  const out = [];
  for (const b of boxes) {
    const ramp = RAMPS[b.mat];
    if (!ramp) throw new Error(`material sem rampa: ${b.mat}`);
    for (let dx = 0; dx < b.w; dx++) {
      for (let dy = 0; dy < b.d; dy++) {
        for (let dz = 0; dz < b.h; dz++) {
          const interior =
            dx > 0 && dx < b.w - 1 && dy > 0 && dy < b.d - 1 && dz > 0 && dz < b.h - 1;
          if (interior) continue;
          const [x, y] = rot(b.x + dx, b.y + dy, r);
          out.push({ x, y, z: b.z + dz, ramp });
        }
      }
    }
  }
  return out;
};

/** Desenha um cubo isometrico com as tres faces visiveis. */
const cube = (g, sx, sy, ramp) => {
  const [top, left, right] = ramp;
  // topo: losango afunilado, o que da a leitura de faceta
  set(g, sx + 1, sy - 2, top);
  set(g, sx + 2, sy - 2, top);
  for (let i = 0; i < 4; i++) set(g, sx + i, sy - 1, top);
  // laterais
  for (let i = 0; i < VOX.zStep; i++) {
    set(g, sx + 0, sy + i, left);
    set(g, sx + 1, sy + i, left);
    set(g, sx + 2, sy + i, right);
    set(g, sx + 3, sy + i, right);
  }
};

/**
 * Rasteriza um modelo numa grade `w`x`h`.
 * @param dirIndex 0=dr, 1=dl, 2=ur, 3=ul (rotacoes do mesmo modelo)
 */
export const renderVoxels = (boxes, dirIndex, w, h, anchorX, anchorY) => {
  const g = grid(w, h);
  const commands = [];
  for (const v of shellVoxels(boxes, dirIndex)) {
    const { sx, sy } = projectIso(v.x, v.y, v.z, VOX.tileW, VOX.tileH, VOX.zStep);
    commands.push({
      key: makeDrawKey(v.x + KEY_BIAS, v.y + KEY_BIAS, v.z, 0),
      draw: () => cube(g, Math.round(anchorX + sx), Math.round(anchorY + sy), v.ramp),
    });
  }
  sortDrawCommands(commands); // ordem do pintor: fundo -> frente
  for (const c of commands) c.draw();
  return g;
};

/**
 * Extensao projetada do modelo nas quatro direcoes. Serve para conferir que o
 * modelo cabe no frame ANTES de gerar, em vez de descobrir depois que o
 * fitToMargin reescalou o sprite em silencio.
 */
export const projectedBounds = (boxes) => {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (let r = 0; r < 4; r++) {
    for (const v of shellVoxels(boxes, r)) {
      const { sx, sy } = projectIso(v.x, v.y, v.z, VOX.tileW, VOX.tileH, VOX.zStep);
      minX = Math.min(minX, sx);
      maxX = Math.max(maxX, sx + 3);
      minY = Math.min(minY, sy - 2);
      maxY = Math.max(maxY, sy + VOX.zStep - 1);
    }
  }
  return { w: maxX - minX + 1, h: maxY - minY + 1, minX, maxX, minY, maxY };
};
