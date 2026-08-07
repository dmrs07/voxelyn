// Motor de POSES por partes: o modelo e segmentado automaticamente em pecas
// nomeadas (corpo + pernas por componentes conexos), e cada frame de animacao
// e descrito por transformacoes POR PARTE (mover, girar em torno do pivo).
//
// E a divisao de trabalho que faz IA funcionar aqui: a IA projeta a POSE num
// JSON compacto ("perna-3: gira -20 graus e avanca 2") e este motor aplica nos
// voxels com precisao deterministica — a IA nunca toca voxel por voxel, que e
// exatamente onde modelos de linguagem erram.
import { parseVoxelKey, voxelKey, voxelModelBounds, type VoxelModel } from './voxel';
import { detectLegs } from './animate';

export type Part = {
  name: string;
  /** chaves dos voxels da parte no modelo BASE */
  keys: string[];
  /** centro geometrico (x, y, z) */
  centroid: [number, number, number];
  /**
   * Pivo de rotacao: para pernas, o centro da linha de TOPO da parte (o
   * "quadril", onde ela encosta no corpo); para o corpo, o centroide.
   */
  pivot: [number, number, number];
  bounds: { minX: number; maxX: number; minY: number; maxY: number; minZ: number; maxZ: number };
};

const partBounds = (keys: string[]): Part['bounds'] => {
  let minX = Infinity,
    maxX = -Infinity,
    minY = Infinity,
    maxY = -Infinity,
    minZ = Infinity,
    maxZ = -Infinity;
  for (const key of keys) {
    const [x, y, z] = parseVoxelKey(key);
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
    minZ = Math.min(minZ, z);
    maxZ = Math.max(maxZ, z);
  }
  return { minX, maxX, minY, maxY, minZ, maxZ };
};

const centroidOf = (keys: string[]): [number, number, number] => {
  let sx = 0,
    sy = 0,
    sz = 0;
  for (const key of keys) {
    const [x, y, z] = parseVoxelKey(key);
    sx += x;
    sy += y;
    sz += z;
  }
  const n = keys.length || 1;
  return [sx / n, sy / n, sz / n];
};

/**
 * Segmenta o modelo em partes nomeadas: `perna-1..N` (componentes conexos
 * abaixo do corte de altura, ordem estavel) e `corpo` (todo o resto).
 */
export const segmentParts = (model: VoxelModel): Part[] => {
  const legs = detectLegs(model);
  const used = new Set<string>();
  const parts: Part[] = [];
  // um componente de 1 voxel e ruido de superficie, nao um membro
  const realLegs = legs.filter((keys) => keys.length >= 2);
  realLegs.forEach((keys, i) => {
    for (const key of keys) used.add(key);
    const bounds = partBounds(keys);
    const topKeys = keys.filter((key) => parseVoxelKey(key)[2] === bounds.maxZ);
    const topCenter = centroidOf(topKeys);
    parts.push({
      name: `perna-${i + 1}`,
      keys,
      centroid: centroidOf(keys),
      pivot: [topCenter[0], topCenter[1], bounds.maxZ],
      bounds,
    });
  });
  const bodyKeys = Object.keys(model).filter((key) => !used.has(key));
  if (bodyKeys.length > 0) {
    const bounds = partBounds(bodyKeys);
    parts.push({
      name: 'corpo',
      keys: bodyKeys,
      centroid: centroidOf(bodyKeys),
      pivot: centroidOf(bodyKeys),
      bounds,
    });
  }
  return parts;
};

/** Pose de UMA parte num frame: deslocamento e/ou rotacao em torno do pivo. */
export type PartPose = {
  part: string;
  /** deslocamento em voxels finos [dx, dy, dz] (frente do modelo = -y) */
  move?: [number, number, number];
  /** rotacao em graus em torno do pivo da parte */
  rotate?: { axis: 'x' | 'y' | 'z'; deg: number };
};

export type FramePose = { poses: PartPose[] };

export type AnimationSpec = { frames: FramePose[] };

/** Limites de sanidade sobre o que a IA pode pedir. */
export const MAX_MOVE = 8;
export const MAX_DEG = 60;

const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

const rotatePoint = (
  x: number,
  y: number,
  z: number,
  pivot: [number, number, number],
  axis: 'x' | 'y' | 'z',
  deg: number,
): [number, number, number] => {
  const rad = (deg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const px = x - pivot[0];
  const py = y - pivot[1];
  const pz = z - pivot[2];
  let nx = px,
    ny = py,
    nz = pz;
  if (axis === 'z') {
    nx = px * cos - py * sin;
    ny = px * sin + py * cos;
  } else if (axis === 'x') {
    ny = py * cos - pz * sin;
    nz = py * sin + pz * cos;
  } else {
    nx = px * cos + pz * sin;
    nz = -px * sin + pz * cos;
  }
  return [Math.round(nx + pivot[0]), Math.round(ny + pivot[1]), Math.round(nz + pivot[2])];
};

/**
 * Aplica as poses de um frame sobre o modelo BASE. Partes nao citadas ficam
 * paradas; partes movidas vencem conflitos de celula (desenham por cima).
 * Nada desce abaixo do chao (z >= 0).
 */
export const applyFramePose = (base: VoxelModel, parts: Part[], frame: FramePose): VoxelModel => {
  const byName = new Map(parts.map((p) => [p.name, p]));
  const posed = new Set<string>();
  const out: VoxelModel = {};

  const validPoses = frame.poses.filter((p) => byName.has(p.part));
  for (const pose of validPoses) {
    for (const key of byName.get(pose.part)!.keys) posed.add(key);
  }
  // primeiro o que fica parado
  for (const [key, mat] of Object.entries(base)) {
    if (!posed.has(key)) out[key] = mat;
  }
  // depois cada parte posada
  for (const pose of validPoses) {
    const part = byName.get(pose.part)!;
    const dx = clamp(Math.round(pose.move?.[0] ?? 0), -MAX_MOVE, MAX_MOVE);
    const dy = clamp(Math.round(pose.move?.[1] ?? 0), -MAX_MOVE, MAX_MOVE);
    const dz = clamp(Math.round(pose.move?.[2] ?? 0), -MAX_MOVE, MAX_MOVE);
    const deg = clamp(pose.rotate?.deg ?? 0, -MAX_DEG, MAX_DEG);
    const axis = pose.rotate?.axis ?? 'x';
    for (const key of part.keys) {
      const [x, y, z] = parseVoxelKey(key);
      let nx = x,
        ny = y,
        nz = z;
      if (deg !== 0) {
        [nx, ny, nz] = rotatePoint(x, y, z, part.pivot, axis, deg);
      }
      out[voxelKey(nx + dx, ny + dy, Math.max(0, nz + dz))] = base[key];
    }
  }
  return out;
};

/**
 * Aplica um spec completo: um modelo por frame, sempre derivado do BASE
 * (regenerar nunca acumula). Frames alem do pedido sao ignorados; frames
 * faltantes repetem a pose neutra.
 */
export const applyAnimationSpec = (
  base: VoxelModel,
  parts: Part[],
  spec: AnimationSpec,
  frameCount: number,
): VoxelModel[] => {
  const out: VoxelModel[] = [];
  for (let f = 0; f < frameCount; f++) {
    const frame = spec.frames[f];
    out.push(frame ? applyFramePose(base, parts, frame) : structuredClone(base));
  }
  return out;
};

/** Resumo compacto das partes para o prompt da IA (nunca os voxels). */
export const partsSummary = (parts: Part[], model: VoxelModel): string => {
  const b = voxelModelBounds(model);
  const lines = [
    `Modelo: ${Object.keys(model).length} voxels, caixa x[${b?.minX}..${b?.maxX}] y[${b?.minY}..${b?.maxY}] z[${b?.minZ}..${b?.maxZ}] (chao em z=0, FRENTE = -y, cima = +z).`,
    `Partes (nome, voxels, centroide, pivo):`,
  ];
  for (const p of parts) {
    lines.push(
      `- ${p.name}: ${p.keys.length} voxels, centroide (${p.centroid.map((v) => v.toFixed(1)).join(', ')}), pivo (${p.pivot.map((v) => v.toFixed(1)).join(', ')}), z[${p.bounds.minZ}..${p.bounds.maxZ}]`,
    );
  }
  return lines.join('\n');
};
