// Geradores procedurais de animacao para modelos voxel — deterministicos,
// parametrizados e puros (testaveis em Node). A filosofia e a MESMA do
// pipeline do jogo (tools/entities.mjs anima por transformacao procedural, e a
// morte usa collapse() em tools/voxel.mjs): nada de IA gerando frames — o
// autor escolhe o preset e a intensidade, e o resultado e sempre o mesmo.
//
// Cada gerador recebe o modelo BASE (a pose neutra) e devolve os frames da
// animacao derivados dele. Regenerar nunca acumula: frame = f(base, indice).
import type { VoxelModel } from './voxel';
import { parseVoxelKey, voxelKey, voxelModelBounds } from './voxel';

/** Hash estavel de posicao — mesma forma do hash3 do pipeline do jogo. */
const hash3 = (x: number, y: number, z: number): number => {
  let h = (x * 73856093) ^ (y * 19349663) ^ (z * 83492791);
  h ^= h >>> 13;
  return h >>> 0;
};

/**
 * Morte por desmoronamento — a leitura do collapse() do jogo, voxel a voxel:
 * os pedacos contraem para o eixo do corpo, perdem altura e assentam num monte
 * que ocupa MENOS espaco que a criatura de pe; parte da materia some (nunca
 * mais de ~3/8) para o monte nao ter o volume do corpo inteiro. Deterministico
 * pelo hash da posicao: regenerar da o mesmo entulho, em toda direcao.
 */
export const collapseModel = (base: VoxelModel, t: number): VoxelModel => {
  if (t <= 0) return structuredClone(base);
  const k = Math.min(1, t);
  const bounds = voxelModelBounds(base);
  if (!bounds) return {};
  const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));
  const out: VoxelModel = {};
  for (const [key, mat] of Object.entries(base)) {
    const [x, y, z] = parseVoxelKey(key);
    const h = hash3(x, y, z);
    if ((h >>> 4) % 8 < Math.round(k * 3)) continue; // parte da materia se perde
    const jitterX = (h & 1) - ((h >>> 1) & 1);
    const jitterY = ((h >>> 2) & 1) - ((h >>> 3) & 1);
    const nx = clamp(Math.round(x * (1 - k * 0.5) + jitterX * k), bounds.minX, bounds.maxX);
    const ny = clamp(Math.round(y * (1 - k * 0.5) + jitterY * k), bounds.minY, bounds.maxY);
    const nz = Math.max(0, Math.round(z * (1 - k * 0.8)));
    out[voxelKey(nx, ny, nz)] = mat;
  }
  return out;
};

/**
 * Pernas por componentes conexos ABAIXO do corte de altura: o plano de corte
 * desconecta as pernas umas das outras (uma aranha rende 8 componentes de
 * graca), sem nenhum rigging manual. Vizinhanca de 6.
 */
export const detectLegs = (model: VoxelModel, cutRatio = 0.35): string[][] => {
  const bounds = voxelModelBounds(model);
  if (!bounds) return [];
  const cutZ = bounds.minZ + Math.max(1, Math.round((bounds.maxZ - bounds.minZ + 1) * cutRatio));
  const below = new Set<string>();
  for (const key of Object.keys(model)) {
    if (parseVoxelKey(key)[2] < cutZ) below.add(key);
  }
  const components: string[][] = [];
  const seen = new Set<string>();
  for (const start of below) {
    if (seen.has(start)) continue;
    const comp: string[] = [];
    const stack = [start];
    seen.add(start);
    while (stack.length > 0) {
      const key = stack.pop()!;
      comp.push(key);
      const [x, y, z] = parseVoxelKey(key);
      for (const [dx, dy, dz] of [
        [1, 0, 0],
        [-1, 0, 0],
        [0, 1, 0],
        [0, -1, 0],
        [0, 0, 1],
        [0, 0, -1],
      ]) {
        const nk = voxelKey(x + dx, y + dy, z + dz);
        if (below.has(nk) && !seen.has(nk)) {
          seen.add(nk);
          stack.push(nk);
        }
      }
    }
    components.push(comp);
  }
  // ordem estavel: pela posicao media (x, depois y) — a fase da marcha depende
  // do INDICE, entao a ordem nao pode variar entre regeneracoes
  const centroid = (comp: string[]): [number, number] => {
    let sx = 0,
      sy = 0;
    for (const key of comp) {
      const [x, y] = parseVoxelKey(key);
      sx += x;
      sy += y;
    }
    return [sx / comp.length, sy / comp.length];
  };
  return components
    .map((comp) => ({ comp, c: centroid(comp) }))
    .sort((a, b) => a.c[0] - b.c[0] || a.c[1] - b.c[1])
    .map((e) => e.comp);
};

const shiftSubset = (
  base: VoxelModel,
  subset: Set<string>,
  dx: number,
  dy: number,
  dz: number,
): VoxelModel => {
  const out: VoxelModel = {};
  // primeiro o que fica parado, depois o que se move — o movel vence conflitos
  for (const [key, mat] of Object.entries(base)) {
    if (!subset.has(key)) out[key] = mat;
  }
  for (const key of subset) {
    const [x, y, z] = parseVoxelKey(key);
    out[voxelKey(x + dx, y + dy, Math.max(0, z + dz))] = base[key];
  }
  return out;
};

const shiftAll = (base: VoxelModel, dx: number, dy: number, dz: number): VoxelModel => {
  const out: VoxelModel = {};
  for (const [key, mat] of Object.entries(base)) {
    const [x, y, z] = parseVoxelKey(key);
    out[voxelKey(x + dx, y + dy, Math.max(0, z + dz))] = mat;
  }
  return out;
};

/** Parte superior do modelo (acima da fracao dada da altura). */
const upperSubset = (model: VoxelModel, ratio: number): Set<string> => {
  const bounds = voxelModelBounds(model);
  const out = new Set<string>();
  if (!bounds) return out;
  const cutZ = bounds.minZ + (bounds.maxZ - bounds.minZ + 1) * ratio;
  for (const key of Object.keys(model)) {
    if (parseVoxelKey(key)[2] >= cutZ) out.add(key);
  }
  return out;
};

/** Respiracao: a parte de cima abaixa 1 voxel no meio do ciclo. */
export const breatheFrame = (
  base: VoxelModel,
  frame: number,
  frames: number,
  intensity: number,
): VoxelModel => {
  const phase = Math.sin((2 * Math.PI * frame) / frames);
  const dip = phase < -0.3 ? -Math.min(2, intensity) : phase < 0.35 ? 0 : 0;
  if (dip === 0) return structuredClone(base);
  return shiftSubset(base, upperSubset(base, 0.5), 0, 0, dip);
};

/**
 * Marcha: pernas detectadas alternam em duas fases (frente/tras com elevacao
 * no balanco), corpo com bob vertical. Sem pernas detectaveis (corpo unico),
 * cai para o bob — a criatura "flutua" andando, que e o fallback honesto.
 */
export const gaitFrame = (
  base: VoxelModel,
  frame: number,
  frames: number,
  intensity: number,
): VoxelModel => {
  const legs = detectLegs(base);
  const cycle = frame / frames;
  const bob = Math.round(Math.abs(Math.sin(2 * Math.PI * cycle)) * Math.min(1, intensity - 1));
  if (legs.length < 2) {
    return shiftAll(base, 0, 0, bob);
  }
  let out = structuredClone(base);
  for (let i = 0; i < legs.length; i++) {
    const phase = i % 2 === 0 ? 0 : 0.5;
    const swing = Math.sin(2 * Math.PI * (cycle + phase));
    const dy = -Math.round(swing * intensity); // frente do modelo e -y
    const lift = swing > 0.4 ? 1 : 0;
    if (dy === 0 && lift === 0) continue;
    out = shiftSubset(out, new Set(legs[i]), 0, dy, lift);
  }
  if (bob !== 0) out = shiftSubset(out, upperSubset(out, 0.35), 0, 0, bob);
  return out;
};

/** Investida: recua, dispara para a frente (-y) e volta. */
export const lungeFrame = (
  base: VoxelModel,
  frame: number,
  frames: number,
  intensity: number,
): VoxelModel => {
  const t = frames <= 1 ? 1 : frame / (frames - 1);
  // curva: leve recuo no comeco, pico de avanco em ~2/3, retorno
  const curve = t < 0.25 ? -0.5 * (t / 0.25) : Math.sin(((t - 0.25) / 0.75) * Math.PI);
  const dy = -Math.round(curve * intensity * 2);
  return shiftAll(base, 0, dy, 0);
};

/** Recuo de dano: corpo para tras (+y), topo inclina mais que a base. */
export const recoilFrame = (
  base: VoxelModel,
  frame: number,
  frames: number,
  intensity: number,
): VoxelModel => {
  const t = frames <= 1 ? 1 : frame / (frames - 1);
  const kick = Math.round((1 - t) * intensity);
  if (kick === 0) return structuredClone(base);
  const shifted = shiftAll(base, 0, kick, 0);
  return shiftSubset(shifted, upperSubset(shifted, 0.5), 0, kick, 0);
};

export type AnimStyle = 'breathe' | 'gait' | 'lunge' | 'recoil' | 'collapse';

/** Preset sugerido para cada animacao do contrato da Art Bible. */
export const styleForAnim = (anim: string): AnimStyle => {
  if (anim === 'walk' || anim === 'fly') return 'gait';
  if (anim === 'attack' || anim === 'special' || anim === 'revive') return 'lunge';
  if (anim === 'hit' || anim === 'downed') return 'recoil';
  if (anim === 'die' || anim === 'burst') return 'collapse';
  return 'breathe';
};

export const STYLE_LABELS: Record<AnimStyle, string> = {
  breathe: 'Respirar (idle)',
  gait: 'Marcha (pernas automaticas)',
  lunge: 'Investida (ataque)',
  recoil: 'Recuo (dano)',
  collapse: 'Desmoronar (morte)',
};

/** Gera todos os frames de uma animacao a partir do modelo base. */
export const generateAnimation = (
  base: VoxelModel,
  style: AnimStyle,
  frames: number,
  intensity: number,
): VoxelModel[] => {
  const out: VoxelModel[] = [];
  for (let f = 0; f < frames; f++) {
    if (style === 'collapse') {
      out.push(collapseModel(base, frames <= 1 ? 1 : f / (frames - 1)));
    } else if (style === 'gait') {
      out.push(gaitFrame(base, f, frames, intensity));
    } else if (style === 'lunge') {
      out.push(lungeFrame(base, f, frames, intensity));
    } else if (style === 'recoil') {
      out.push(recoilFrame(base, f, frames, intensity));
    } else {
      out.push(breatheFrame(base, f, frames, intensity));
    }
  }
  return out;
};
