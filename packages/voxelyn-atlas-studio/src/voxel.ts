// Rasterizador voxel isometrico do Studio — PORT 1:1 de
// packages/voxelyn-survival-content/tools/voxel.mjs (e da matematica de
// projecao do @voxelyn/core), operando sobre VOXELS UNITARIOS da grade fina em
// vez de caixas autoradas. O teste de paridade (src/tests/voxel.test.ts)
// renderiza o mesmo modelo pelos dois lados e exige igualdade byte a byte:
// mexeu no rasterizador do jogo, o teste cobra este arquivo.
//
// No editor, o personagem e um MODELO 3D montado voxel a voxel ("Lego"): as
// quatro direcoes sao rotacoes de 90 graus do MESMO modelo e nao podem
// discordar — que e exatamente a garantia do pipeline oficial.
import type { Grid } from './types';
import { createGrid } from './grid';
import { COLORS } from './palette';

/** Rampas de face por material: [topo, esquerda, direita]. Espelho do jogo. */
export const RAMPS: Record<string, [string, string, string]> = {
  rock: ['rockLight', 'rock', 'rockShadow'],
  rockDeep: ['rock', 'rockShadow', 'dark'],
  floor: ['rockShadow', 'dark', 'dark'],
  scorch: ['dark', 'dark', 'dark'],
  rust: ['bone', 'brass', 'rockShadow'],
  bone: ['bone', 'brass', 'rockShadow'],
  fungus: ['fungusLight', 'moss', 'fungusDark'],
  fungusDeep: ['fungus', 'fungusDark', 'dark'],
  biolum: ['biolum', 'fungusLight', 'fungus'],
  acid: ['acid', 'fungusLight', 'fungus'],
  pool: ['fungusDark', 'dark', 'dark'],
  water: ['rock', 'rockShadow', 'dark'],
  ice: ['mist', 'rockLight', 'rockShadow'],
  silt: ['chalk', 'bone', 'brass'],
  glass: ['player', 'mist', 'rock'],
  sulfur: ['loot', 'acid', 'fungusDark'],
  fire: ['amber', 'fire', 'blood'],
  lamp: ['beam', 'amber', 'fire'],
  blood: ['blood', 'char', 'dark'],
  electric: ['electric', 'mist', 'rock'],
  loot: ['loot', 'brass', 'rockShadow'],
  player: ['player', 'bone', 'rust'],
};

export const SHADOW_OF: Record<string, string> = {
  player: 'chalk',
  chalk: 'bone',
  bone: 'brass',
  brass: 'rust',
  rust: 'char',
  char: 'dark',
  mist: 'rockLight',
  rockLight: 'rock',
  rock: 'rockShadow',
  rockShadow: 'dark',
  biolum: 'fungusLight',
  fungusLight: 'moss',
  moss: 'fungus',
  fungus: 'fungusDark',
  fungusDark: 'dark',
  acid: 'fungusLight',
  beam: 'amber',
  loot: 'bone',
  amber: 'fire',
  fire: 'blood',
  blood: 'char',
  electric: 'mist',
  dark: 'dark',
};

export const LIGHT_OF: Record<string, string> = {
  char: 'rust',
  rust: 'brass',
  brass: 'bone',
  bone: 'chalk',
  chalk: 'player',
  rockShadow: 'rock',
  rock: 'rockLight',
  rockLight: 'mist',
  mist: 'chalk',
  dark: 'rockShadow',
  fungusDark: 'fungus',
  fungus: 'moss',
  moss: 'fungusLight',
  fungusLight: 'fungusLight',
  blood: 'blood',
  loot: 'loot',
  player: 'player',
  acid: 'acid',
  biolum: 'biolum',
  electric: 'electric',
  fire: 'fire',
  amber: 'amber',
  beam: 'beam',
};

/** Materiais (rampas) que emitem luz e nao recebem oclusao. */
export const EMISSIVE_RAMPS = new Set(['biolum', 'electric', 'fire', 'acid', 'amber', 'beam']);

/** Materiais disponiveis no editor voxel, na ordem da paleta de UI. */
export const VOXEL_MATERIALS = Object.keys(RAMPS);

// Um voxel na projecao 2:1: 4px de largura, 2px de topo, 2px de lateral.
export const VOX = { tileW: 4, tileH: 2, zStep: 2 } as const;

// makeDrawKey desloca bits, entao exige coordenadas nao-negativas.
const KEY_BIAS = 128;

// 0=dr, 1=dl, 2=ur, 3=ul — mesmo contrato de renderVoxels do jogo.
const DIRECTION_ROTATION = [1, 2, 0, 3] as const;

export const VOXEL_DIRS = ['dr', 'dl', 'ur', 'ul'] as const;

const rot = (x: number, y: number, r: number): [number, number] => {
  if (r === 1) return [-y, x];
  if (r === 2) return [-x, -y];
  if (r === 3) return [y, -x];
  return [x, y];
};

const projectIso = (x: number, y: number, z: number): { sx: number; sy: number } => ({
  sx: (x - y) * (VOX.tileW >> 1),
  sy: (x + y) * (VOX.tileH >> 1) - z * VOX.zStep,
});

const makeDrawKey = (x: number, y: number, z: number): number =>
  ((x + y) << 16) | ((z & 0xff) << 8);

type Face = {
  slot: 0 | 1 | 2;
  n: [number, number, number];
  u: [number, number, number];
  v: [number, number, number];
};

const FACES: Record<'top' | 'left' | 'right', Face> = {
  top: { slot: 0, n: [0, 0, 1], u: [1, 0, 0], v: [0, 1, 0] },
  left: { slot: 1, n: [0, 1, 0], u: [1, 0, 0], v: [0, 0, 1] },
  right: { slot: 2, n: [1, 0, 0], u: [0, 1, 0], v: [0, 0, 1] },
};

type IsSolid = (x: number, y: number, z: number) => boolean;

/** Passos de sombra de uma face — mesma contagem de 8 vizinhos do jogo. */
export const ambientOcclusionSteps = (
  isSolid: IsSolid,
  x: number,
  y: number,
  z: number,
  face: 'top' | 'left' | 'right',
): number => {
  const spec = FACES[face];
  const [nx, ny, nz] = spec.n;
  const [ux, uy, uz] = spec.u;
  const [vx, vy, vz] = spec.v;
  const ax = x + nx;
  const ay = y + ny;
  const az = z + nz;
  let count = 0;
  for (let a = -1; a <= 1; a++) {
    for (let b = -1; b <= 1; b++) {
      if (a === 0 && b === 0) continue;
      if (isSolid(ax + ux * a + vx * b, ay + uy * a + vy * b, az + uz * a + vz * b)) count++;
    }
  }
  return count >= 6 ? 2 : count >= 3 ? 1 : 0;
};

export const isLitCorner = (isSolid: IsSolid, x: number, y: number, z: number): boolean =>
  !isSolid(x, y, z + 1) && !isSolid(x - 1, y, z) && !isSolid(x, y - 1, z);

const stepped = (table: Record<string, string>, name: string, steps: number): string => {
  let out = name;
  for (let i = 0; i < steps; i++) out = table[out] ?? out;
  return out;
};

/**
 * Pixels de um cubo isometrico, relativos a origem: [dx, dy, slotDaFace].
 * Copiado do jogo — a leitura de faceta vem desta tabela.
 */
const CUBE_CELLS: [number, number, number][] = (() => {
  const cells: [number, number, number][] = [
    [1, -2, 0],
    [2, -2, 0],
  ];
  for (let i = 0; i < 4; i++) cells.push([i, -1, 0]);
  for (let i = 0; i < VOX.zStep; i++) {
    cells.push([0, i, 1], [1, i, 1], [2, i, 2], [3, i, 2]);
  }
  return cells;
})();

/**
 * Modelo do editor: voxels UNITARIOS da grade fina.
 * Chave `"x,y,z"` (inteiros, origem entre os pes) -> nome de material (RAMPS).
 */
export type VoxelModel = Record<string, string>;

export const voxelKey = (x: number, y: number, z: number): string => `${x},${y},${z}`;

export const parseVoxelKey = (key: string): [number, number, number] => {
  const [x, y, z] = key.split(',').map(Number);
  return [x, y, z];
};

const setGridPx = (g: Grid, x: number, y: number, colorName: string): void => {
  if (x < 0 || y < 0 || x >= g.w || y >= g.h) return;
  const c = COLORS[colorName];
  if (!c) throw new Error(`cor fora da paleta: ${colorName}`);
  const i = (y * g.w + x) * 4;
  g.buf[i] = c[0];
  g.buf[i + 1] = c[1];
  g.buf[i + 2] = c[2];
  g.buf[i + 3] = 255;
};

/**
 * Rasteriza o modelo numa grade w×h com a origem (entre os pes) no anchor.
 * @param dirIndex 0=dr, 1=dl, 2=ur, 3=ul
 */
export const renderVoxelModel = (
  model: VoxelModel,
  dirIndex: number,
  w: number,
  h: number,
  anchorX: number,
  anchorY: number,
): Grid => {
  const rotation = DIRECTION_ROTATION[dirIndex];
  if (rotation === undefined) throw new Error(`direcao voxel invalida: ${dirIndex}`);
  const g = createGrid(w, h);

  // ocupacao e casca no espaco ROTACIONADO (as faces visiveis sao da TELA)
  const solid = new Set<string>();
  const voxels: { x: number; y: number; z: number; mat: string }[] = [];
  for (const [key, mat] of Object.entries(model)) {
    const [ax, ay, az] = parseVoxelKey(key);
    const [x, y] = rot(ax, ay, rotation);
    solid.add(voxelKey(x, y, az));
    voxels.push({ x, y, z: az, mat });
  }
  const isSolid: IsSolid = (x, y, z) => solid.has(voxelKey(x, y, z));

  const commands: { key: number; draw: () => void }[] = [];
  for (const v of voxels) {
    // voxel totalmente cercado nunca e visivel: os tres oclusores (+x, +y, +z)
    // desenham DEPOIS dele na ordem do pintor e cobrem as tres faces
    if (
      isSolid(v.x + 1, v.y, v.z) &&
      isSolid(v.x - 1, v.y, v.z) &&
      isSolid(v.x, v.y + 1, v.z) &&
      isSolid(v.x, v.y - 1, v.z) &&
      isSolid(v.x, v.y, v.z + 1) &&
      isSolid(v.x, v.y, v.z - 1)
    ) {
      continue;
    }
    const base = RAMPS[v.mat];
    if (!base) throw new Error(`material sem rampa: ${v.mat}`);
    let ramp: readonly [string, string, string] = base;
    if (!EMISSIVE_RAMPS.has(v.mat)) {
      const out: [string, string, string] = [base[0], base[1], base[2]];
      let changed = false;
      for (const [face, spec] of Object.entries(FACES) as ['top' | 'left' | 'right', Face][]) {
        const steps = ambientOcclusionSteps(isSolid, v.x, v.y, v.z, face);
        if (steps === 0) continue;
        out[spec.slot] = stepped(SHADOW_OF, base[spec.slot], steps);
        changed = true;
      }
      if (out[0] === base[0] && isLitCorner(isSolid, v.x, v.y, v.z)) {
        const lit = stepped(LIGHT_OF, base[0], 1);
        if (lit !== base[0]) {
          out[0] = lit;
          changed = true;
        }
      }
      if (changed) ramp = out;
    }
    const { sx, sy } = projectIso(v.x, v.y, v.z);
    const finalRamp = ramp;
    commands.push({
      key: makeDrawKey(v.x + KEY_BIAS, v.y + KEY_BIAS, v.z),
      draw: () => {
        const ox = Math.round(anchorX + sx);
        const oy = Math.round(anchorY + sy);
        for (const [dx, dy, face] of CUBE_CELLS) setGridPx(g, ox + dx, oy + dy, finalRamp[face]);
      },
    });
  }
  commands.sort((a, b) => a.key - b.key);
  for (const c of commands) c.draw();
  return g;
};

/**
 * Vista EDITAVEL do modelo: renderiza numa grade dimensionada pelo proprio
 * modelo (nunca corta) e devolve um mapa de acerto pixel→voxel para construir
 * direto na vista 3D — tocar numa face adiciona a peca encaixada nela, como
 * Lego. As coordenadas devolvidas sao AUTORADAS (do modelo, nao da rotacao),
 * prontas para editar o VoxelModel.
 */
export type ViewHit = {
  /** voxel tocado, em coordenadas autoradas */
  vox: [number, number, number];
  /** celula vizinha atraves da face tocada (onde o pencil encaixa a peca) */
  add: [number, number, number];
};

export type VoxelView = {
  grid: Grid;
  /**
   * Posicao, em pixels da grade, da ORIGEM do modelo (entre os pes). O editor
   * ancora a tela nela: assim a vista nao "pula" quando os limites do modelo
   * crescem durante a edicao e o hit-test continua valendo.
   */
  originX: number;
  originY: number;
  /** hit do pixel (px,py) da grade, ou undefined em fundo vazio */
  hitAt: (px: number, py: number) => ViewHit | undefined;
};

const FACE_NORMAL: [number, number, number][] = [
  [0, 0, 1], // slot 0: topo
  [0, 1, 0], // slot 1: esquerda (+y na tela)
  [1, 0, 0], // slot 2: direita (+x na tela)
];

const unrot = (x: number, y: number, r: number): [number, number] => rot(x, y, (4 - r) % 4);

export const renderVoxelView = (model: VoxelModel, dirIndex: number, pad = 6): VoxelView => {
  const rotation = DIRECTION_ROTATION[dirIndex];
  if (rotation === undefined) throw new Error(`direcao voxel invalida: ${dirIndex}`);

  const solid = new Set<string>();
  const voxels: { x: number; y: number; z: number; mat: string }[] = [];
  let minX = Infinity,
    maxX = -Infinity,
    minY = Infinity,
    maxY = -Infinity;
  for (const [key, mat] of Object.entries(model)) {
    const [ax, ay, az] = parseVoxelKey(key);
    const [x, y] = rot(ax, ay, rotation);
    solid.add(voxelKey(x, y, az));
    voxels.push({ x, y, z: az, mat });
    const { sx, sy } = projectIso(x, y, az);
    minX = Math.min(minX, sx);
    maxX = Math.max(maxX, sx + 3);
    minY = Math.min(minY, sy - 2);
    maxY = Math.max(maxY, sy + VOX.zStep - 1);
  }
  if (voxels.length === 0) {
    return { grid: createGrid(1, 1), originX: 0, originY: 0, hitAt: () => undefined };
  }
  const w = maxX - minX + 1 + pad * 2;
  const h = maxY - minY + 1 + pad * 2;
  const anchorX = pad - minX;
  const anchorY = pad - minY;
  const g = createGrid(w, h);
  const hits = new Map<number, ViewHit>();
  const isSolid: IsSolid = (x, y, z) => solid.has(voxelKey(x, y, z));

  const commands: { key: number; draw: () => void }[] = [];
  for (const v of voxels) {
    if (
      isSolid(v.x + 1, v.y, v.z) &&
      isSolid(v.x - 1, v.y, v.z) &&
      isSolid(v.x, v.y + 1, v.z) &&
      isSolid(v.x, v.y - 1, v.z) &&
      isSolid(v.x, v.y, v.z + 1) &&
      isSolid(v.x, v.y, v.z - 1)
    ) {
      continue;
    }
    const base = RAMPS[v.mat];
    if (!base) throw new Error(`material sem rampa: ${v.mat}`);
    let ramp: readonly [string, string, string] = base;
    if (!EMISSIVE_RAMPS.has(v.mat)) {
      const out: [string, string, string] = [base[0], base[1], base[2]];
      let changed = false;
      for (const [face, spec] of Object.entries(FACES) as ['top' | 'left' | 'right', Face][]) {
        const steps = ambientOcclusionSteps(isSolid, v.x, v.y, v.z, face);
        if (steps === 0) continue;
        out[spec.slot] = stepped(SHADOW_OF, base[spec.slot], steps);
        changed = true;
      }
      if (out[0] === base[0] && isLitCorner(isSolid, v.x, v.y, v.z)) {
        const lit = stepped(LIGHT_OF, base[0], 1);
        if (lit !== base[0]) {
          out[0] = lit;
          changed = true;
        }
      }
      if (changed) ramp = out;
    }
    const { sx, sy } = projectIso(v.x, v.y, v.z);
    const finalRamp = ramp;
    const [avx, avy] = unrot(v.x, v.y, rotation);
    commands.push({
      key: makeDrawKey(v.x + KEY_BIAS, v.y + KEY_BIAS, v.z),
      draw: () => {
        const ox = Math.round(anchorX + sx);
        const oy = Math.round(anchorY + sy);
        for (const [dx, dy, face] of CUBE_CELLS) {
          setGridPx(g, ox + dx, oy + dy, finalRamp[face]);
          const n = FACE_NORMAL[face];
          const [nax, nay] = unrot(v.x + n[0], v.y + n[1], rotation);
          // ordem do pintor: quem desenha por ultimo e o voxel visivel no pixel
          hits.set((oy + dy) * w + (ox + dx), {
            vox: [avx, avy, v.z],
            add: [nax, nay, v.z + n[2]],
          });
        }
      },
    });
  }
  commands.sort((a, b) => a.key - b.key);
  for (const c of commands) c.draw();

  return {
    grid: g,
    originX: anchorX,
    originY: anchorY,
    hitAt: (px, py) => {
      if (px < 0 || py < 0 || px >= w || py >= h) return undefined;
      return hits.get(py * w + px);
    },
  };
};

/** Extensao projetada nas 4 direcoes, em pixels relativos ao anchor. */
export const voxelProjectedBounds = (
  model: VoxelModel,
): { minX: number; maxX: number; minY: number; maxY: number; w: number; h: number } => {
  let minX = Infinity,
    maxX = -Infinity,
    minY = Infinity,
    maxY = -Infinity;
  for (const key of Object.keys(model)) {
    const [ax, ay, az] = parseVoxelKey(key);
    for (const rotation of DIRECTION_ROTATION) {
      const [x, y] = rot(ax, ay, rotation);
      const { sx, sy } = projectIso(x, y, az);
      minX = Math.min(minX, sx);
      maxX = Math.max(maxX, sx + 3);
      minY = Math.min(minY, sy - 2);
      maxY = Math.max(maxY, sy + VOX.zStep - 1);
    }
  }
  if (minX === Infinity) return { minX: 0, maxX: 0, minY: 0, maxY: 0, w: 0, h: 0 };
  return { minX, maxX, minY, maxY, w: maxX - minX + 1, h: maxY - minY + 1 };
};

/** Caixa 3D ocupada pelo modelo (unidades finas). */
export const voxelModelBounds = (
  model: VoxelModel,
): {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
} | null => {
  let out: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
    minZ: number;
    maxZ: number;
  } | null = null;
  for (const key of Object.keys(model)) {
    const [x, y, z] = parseVoxelKey(key);
    if (!out) out = { minX: x, maxX: x, minY: y, maxY: y, minZ: z, maxZ: z };
    else {
      out.minX = Math.min(out.minX, x);
      out.maxX = Math.max(out.maxX, x);
      out.minY = Math.min(out.minY, y);
      out.maxY = Math.max(out.maxY, y);
      out.minZ = Math.min(out.minZ, z);
      out.maxZ = Math.max(out.maxZ, z);
    }
  }
  return out;
};

/** Desloca o modelo inteiro em voxels finos. */
export const shiftModel = (model: VoxelModel, dx: number, dy: number, dz: number): VoxelModel => {
  const out: VoxelModel = {};
  for (const [key, mat] of Object.entries(model)) {
    const [x, y, z] = parseVoxelKey(key);
    out[voxelKey(x + dx, y + dy, z + dz)] = mat;
  }
  return out;
};

/** Caixa em x/y de uma selecao de fatia (inclusiva nos dois cantos). */
export type VoxelBox = { minX: number; maxX: number; minY: number; maxY: number };

/**
 * Copia sem as camadas de `minZ` a `maxZ` (inclusive). E a operacao de corte
 * da base: um STL quase sempre vem apoiado numa laje solida que nao faz parte
 * do bicho, e apagar voxel a voxel no celular e inviavel.
 */
export const removeZRange = (model: VoxelModel, minZ: number, maxZ: number): VoxelModel => {
  const out: VoxelModel = {};
  for (const [key, mat] of Object.entries(model)) {
    const z = parseVoxelKey(key)[2];
    if (z >= minZ && z <= maxZ) continue;
    out[key] = mat;
  }
  return out;
};

/**
 * Copia sem os voxels dentro da caixa em x/y. Sem `minZ`/`maxZ` o corte
 * atravessa TODAS as camadas — que e o que resolve "some com esse pedaco" em
 * um gesto so, em vez de repetir camada por camada.
 */
export const removeBox = (
  model: VoxelModel,
  box: VoxelBox,
  minZ?: number,
  maxZ?: number,
): VoxelModel => {
  const out: VoxelModel = {};
  for (const [key, mat] of Object.entries(model)) {
    const [x, y, z] = parseVoxelKey(key);
    const inXY = x >= box.minX && x <= box.maxX && y >= box.minY && y <= box.maxY;
    const inZ = (minZ === undefined || z >= minZ) && (maxZ === undefined || z <= maxZ);
    if (inXY && inZ) continue;
    out[key] = mat;
  }
  return out;
};

/**
 * Baixa o modelo ate encostar no chao. So DESCE: um modelo que ja afunda
 * abaixo de z=0 sobe, um que ja esta apoiado nao se mexe. Cortar a base
 * deixa o bicho flutuando, e e isto que o assenta de volta.
 */
export const settleToGround = (model: VoxelModel): VoxelModel => {
  const b = voxelModelBounds(model);
  return b && b.minZ !== 0 ? shiftModel(model, 0, 0, -b.minZ) : { ...model };
};

/** Espelha o modelo no plano x=-0.5 (eixo de simetria do editor). */
export const mirrorModelX = (model: VoxelModel): VoxelModel => {
  const out: VoxelModel = {};
  for (const [key, mat] of Object.entries(model)) {
    const [x, y, z] = parseVoxelKey(key);
    out[voxelKey(-1 - x, y, z)] = mat;
  }
  return out;
};
