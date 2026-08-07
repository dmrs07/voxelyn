// Motor de POSES por partes: o modelo e segmentado em nucleo (corpo) e MEMBROS
// completos, e cada frame de animacao e descrito por transformacoes POR PARTE
// (mover, girar em torno do pivo de insercao).
//
// E a divisao de trabalho que faz IA funcionar aqui: a IA projeta a POSE num
// JSON compacto ("perna-3: gira -20 graus e avanca 2") e este motor aplica nos
// voxels — a IA nunca toca voxel por voxel, que e onde modelos de linguagem
// erram.
//
// SEGMENTACAO (v2). A primeira versao cortava o modelo num plano horizontal e
// procurava componentes por FACE. As duas escolhas quebravam um bicho de
// pernas diagonais: perna que desce na diagonal encosta voxel a voxel pela
// QUINA, entao cada voxel virava um componente de tamanho 1 e era descartado
// como ruido — uma aranha de 8 patas devolvia ZERO pernas —, e o corte
// horizontal ainda decepava a coxa, deixando-a no corpo enquanto so a ponta
// girava (era a origem dos pedacos flutuando na tela).
//
// Agora: o NUCLEO e a massa espessa do modelo (voxels de interior, crescidos
// uma vez para pegar a superficie), e cada membro e um componente conexo por
// VIZINHANCA-26 do que sobra — da insercao ate a ponta, com o pivo no ponto
// onde ele realmente encosta no corpo.
import { parseVoxelKey, voxelKey, voxelModelBounds, type VoxelModel } from './voxel';

const NEIGHBORS_6: [number, number, number][] = [
  [1, 0, 0],
  [-1, 0, 0],
  [0, 1, 0],
  [0, -1, 0],
  [0, 0, 1],
  [0, 0, -1],
];

const NEIGHBORS_26: [number, number, number][] = (() => {
  const out: [number, number, number][] = [];
  for (let dx = -1; dx <= 1; dx++)
    for (let dy = -1; dy <= 1; dy++)
      for (let dz = -1; dz <= 1; dz++) if (dx || dy || dz) out.push([dx, dy, dz]);
  return out;
})();

/** Componentes conexos de um conjunto de chaves, pela vizinhanca dada. */
export const connectedComponents = (
  keys: Set<string>,
  neighbors: [number, number, number][] = NEIGHBORS_26,
): string[][] => {
  const seen = new Set<string>();
  const out: string[][] = [];
  for (const start of keys) {
    if (seen.has(start)) continue;
    const comp: string[] = [];
    const stack = [start];
    seen.add(start);
    while (stack.length > 0) {
      const key = stack.pop()!;
      comp.push(key);
      const [x, y, z] = parseVoxelKey(key);
      for (const [dx, dy, dz] of neighbors) {
        const nk = voxelKey(x + dx, y + dy, z + dz);
        if (keys.has(nk) && !seen.has(nk)) {
          seen.add(nk);
          stack.push(nk);
        }
      }
    }
    out.push(comp);
  }
  return out;
};

export type PartKind = 'corpo' | 'perna' | 'membro';

export type Part = {
  name: string;
  kind: PartKind;
  /** chaves dos voxels da parte no modelo BASE */
  keys: string[];
  centroid: [number, number, number];
  /** ponto de rotacao: para membros, a INSERCAO no corpo; para o corpo, o centroide */
  pivot: [number, number, number];
  bounds: { minX: number; maxX: number; minY: number; maxY: number; minZ: number; maxZ: number };
  /** direcao em que o membro sai do corpo, em palavras ('frente-direita') */
  direction?: string;
  /** chave estavel do membro (o pivo arredondado) — usada para overrides do autor */
  handle: string;
};

const boundsOf = (keys: string[]): Part['bounds'] => {
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
 * Nucleo do modelo: a massa espessa a que os membros se prendem.
 *
 * Voxel de INTERIOR (as seis faces ocupadas) e a definicao mais limpa e a que
 * vale para tudo que sai do voxelizador de STL, que preenche solidos. Modelos
 * ocos (montados a mao como casca) nao tem interior nenhum — por isso o
 * fallback por espessura, contando vizinhos na malha 26. Uma dilatacao final
 * traz a SUPERFICIE do corpo de volta para o nucleo; sem ela o corpo inteiro
 * viraria "membro" por ser casca.
 */
const detectCore = (model: VoxelModel): Set<string> => {
  const solid = new Set(Object.keys(model));
  const isSolid = (x: number, y: number, z: number): boolean => solid.has(voxelKey(x, y, z));

  let seeds = [...solid].filter((key) => {
    const [x, y, z] = parseVoxelKey(key);
    return NEIGHBORS_6.every(([dx, dy, dz]) => isSolid(x + dx, y + dy, z + dz));
  });

  if (seeds.length === 0) {
    const counts = [...solid].map((key) => {
      const [x, y, z] = parseVoxelKey(key);
      let n = 0;
      for (const [dx, dy, dz] of NEIGHBORS_26) if (isSolid(x + dx, y + dy, z + dz)) n++;
      return [key, n] as const;
    });
    const max = counts.reduce((a, c) => Math.max(a, c[1]), 0);
    const threshold = Math.max(6, Math.round(max * 0.7));
    seeds = counts.filter(([, n]) => n >= threshold).map(([key]) => key);
  }
  if (seeds.length === 0) return new Set();

  const comps = connectedComponents(new Set(seeds), NEIGHBORS_26).sort(
    (a, b) => b.length - a.length,
  );
  const core = new Set(comps[0]);
  for (const key of [...core]) {
    const [x, y, z] = parseVoxelKey(key);
    for (const [dx, dy, dz] of NEIGHBORS_26) {
      const nk = voxelKey(x + dx, y + dy, z + dz);
      if (solid.has(nk)) core.add(nk);
    }
  }
  return core;
};

/** 0=frente(-y), 90=direita(+x), 180=tras, 270=esquerda. */
const directionWord = (deg: number): string => {
  const a = ((deg % 360) + 360) % 360;
  if (a < 22.5 || a >= 337.5) return 'frente';
  if (a < 67.5) return 'frente-direita';
  if (a < 112.5) return 'direita';
  if (a < 157.5) return 'tras-direita';
  if (a < 202.5) return 'tras';
  if (a < 247.5) return 'tras-esquerda';
  if (a < 292.5) return 'esquerda';
  return 'frente-esquerda';
};

/** Overrides do autor: renomear membros e tratar alguns como parte do corpo. */
export type PartOverrides = {
  names?: Record<string, string>;
  mergeToCore?: string[];
};

/**
 * Segmenta o modelo em `corpo` + membros completos (`perna-N` quando o membro
 * alcanca o chao, `membro-N` caso contrario), ordenados pelo angulo em torno
 * do corpo comecando pela frente — a ordem e estavel e espacialmente legivel,
 * que e o que a IA precisa para alternar patas opostas.
 */
export const segmentParts = (model: VoxelModel, overrides?: PartOverrides): Part[] => {
  if (Object.keys(model).length === 0) return [];
  const core = detectCore(model);
  const merged = new Set(overrides?.mergeToCore ?? []);
  const rest = new Set(Object.keys(model).filter((key) => !core.has(key)));
  const comps = connectedComponents(rest, NEIGHBORS_26);

  const modelBounds = voxelModelBounds(model)!;
  const coreKeys = [...core];
  const limbs: {
    keys: string[];
    pivot: [number, number, number];
    angle: number;
    kind: PartKind;
  }[] = [];

  for (const comp of comps) {
    // componente minusculo e sujeira de superficie: fica parado com o corpo
    if (comp.length < 3) {
      for (const key of comp) coreKeys.push(key);
      continue;
    }
    const attachment = comp.filter((key) => {
      const [x, y, z] = parseVoxelKey(key);
      return NEIGHBORS_26.some(([dx, dy, dz]) => core.has(voxelKey(x + dx, y + dy, z + dz)));
    });
    const pivot = centroidOf(attachment.length > 0 ? attachment : comp);
    const b = boundsOf(comp);
    const kind: PartKind = b.minZ <= modelBounds.minZ + 1 ? 'perna' : 'membro';
    limbs.push({ keys: comp, pivot, angle: 0, kind });
  }

  const coreCentroid = centroidOf(coreKeys.length > 0 ? coreKeys : Object.keys(model));
  for (const limb of limbs) {
    const c = centroidOf(limb.keys);
    limb.angle = (Math.atan2(c[0] - coreCentroid[0], -(c[1] - coreCentroid[1])) * 180) / Math.PI;
  }
  limbs.sort((a, b) => {
    const na = ((a.angle % 360) + 360) % 360;
    const nb = ((b.angle % 360) + 360) % 360;
    return na - nb || a.pivot[2] - b.pivot[2];
  });

  const handleOf = (pivot: [number, number, number]): string =>
    voxelKey(Math.round(pivot[0]), Math.round(pivot[1]), Math.round(pivot[2]));

  // membros que o autor marcou como corpo saem da lista antes da numeracao
  const kept = limbs.filter((l) => !merged.has(handleOf(l.pivot)));
  for (const l of limbs) if (merged.has(handleOf(l.pivot))) coreKeys.push(...l.keys);

  const parts: Part[] = [];
  let legN = 0;
  let limbN = 0;
  for (const limb of kept) {
    const handle = handleOf(limb.pivot);
    const auto = limb.kind === 'perna' ? `perna-${++legN}` : `membro-${++limbN}`;
    parts.push({
      name: overrides?.names?.[handle] ?? auto,
      kind: limb.kind,
      keys: limb.keys,
      centroid: centroidOf(limb.keys),
      pivot: limb.pivot,
      bounds: boundsOf(limb.keys),
      direction: directionWord(limb.angle),
      handle,
    });
  }
  if (coreKeys.length > 0) {
    const centroid = centroidOf(coreKeys);
    parts.push({
      name: 'corpo',
      kind: 'corpo',
      keys: coreKeys,
      centroid,
      pivot: centroid,
      bounds: boundsOf(coreKeys),
      handle: 'corpo',
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

/** Voxels de uma reta 3D entre dois pontos (inclusive). */
const line3d = (
  a: [number, number, number],
  b: [number, number, number],
): [number, number, number][] => {
  const steps = Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]), Math.abs(b[2] - a[2]));
  if (steps === 0) return [a];
  const out: [number, number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    out.push([
      Math.round(a[0] + (b[0] - a[0]) * t),
      Math.round(a[1] + (b[1] - a[1]) * t),
      Math.round(a[2] + (b[2] - a[2]) * t),
    ]);
  }
  return out;
};

const chebyshev = (a: [number, number, number], b: [number, number, number]): number =>
  Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]), Math.abs(a[2] - b[2]));

/**
 * Aplica as poses de um frame sobre o modelo BASE.
 *
 * CURA DE ADJACENCIA: depois de transformar, todo par de voxels que era
 * vizinho no modelo base e voltou separado ganha uma reta de voxels ligando os
 * dois. Uma regra so resolve os dois modos de ruptura que apareciam na tela —
 * a perna fina que virava tracejado ao girar (arredondamento) e o membro que
 * se soltava do corpo (a junta) —, porque ambos sao a mesma coisa: adjacencia
 * do base que a pose desfez. O invariante e simples de enunciar e de testar:
 * modelo conexo continua conexo depois de qualquer pose.
 */
export const applyFramePose = (base: VoxelModel, parts: Part[], frame: FramePose): VoxelModel => {
  const byName = new Map(parts.map((p) => [p.name, p]));
  const validPoses = frame.poses.filter((p) => byName.has(p.part));
  if (validPoses.length === 0) return structuredClone(base);

  // transformacao por parte (identidade para as nao citadas)
  const transformOf = new Map<string, (k: string) => [number, number, number]>();
  for (const pose of validPoses) {
    const part = byName.get(pose.part)!;
    const dx = clamp(Math.round(pose.move?.[0] ?? 0), -MAX_MOVE, MAX_MOVE);
    const dy = clamp(Math.round(pose.move?.[1] ?? 0), -MAX_MOVE, MAX_MOVE);
    const dz = clamp(Math.round(pose.move?.[2] ?? 0), -MAX_MOVE, MAX_MOVE);
    const deg = clamp(pose.rotate?.deg ?? 0, -MAX_DEG, MAX_DEG);
    const axis = pose.rotate?.axis ?? 'x';
    const pivot = part.pivot;
    for (const key of part.keys) {
      transformOf.set(key, (k: string) => {
        const [x, y, z] = parseVoxelKey(k);
        const [rx, ry, rz] = deg !== 0 ? rotatePoint(x, y, z, pivot, axis, deg) : [x, y, z];
        return [rx + dx, ry + dy, Math.max(0, rz + dz)];
      });
    }
  }

  const imageOf = new Map<string, [number, number, number]>();
  for (const key of Object.keys(base)) {
    const t = transformOf.get(key);
    imageOf.set(key, t ? t(key) : (parseVoxelKey(key) as [number, number, number]));
  }

  const out: VoxelModel = {};
  // estatico primeiro; o que se moveu desenha por cima
  for (const key of Object.keys(base)) {
    if (!transformOf.has(key)) {
      const p = imageOf.get(key)!;
      out[voxelKey(p[0], p[1], p[2])] = base[key];
    }
  }
  for (const key of Object.keys(base)) {
    if (transformOf.has(key)) {
      const p = imageOf.get(key)!;
      out[voxelKey(p[0], p[1], p[2])] = base[key];
    }
  }

  // cura: adjacencia do base que a pose desfez vira uma reta de voxels
  for (const key of Object.keys(base)) {
    const [x, y, z] = parseVoxelKey(key);
    const a = imageOf.get(key)!;
    for (const [dx, dy, dz] of NEIGHBORS_26) {
      const nk = voxelKey(x + dx, y + dy, z + dz);
      if (!(nk in base) || nk <= key) continue; // cada par uma vez so
      const b = imageOf.get(nk)!;
      if (chebyshev(a, b) <= 1) continue;
      for (const [lx, ly, lz] of line3d(a, b)) {
        const lk = voxelKey(lx, ly, Math.max(0, lz));
        if (!(lk in out)) out[lk] = base[key];
      }
    }
  }
  return out;
};

/**
 * Aplica um spec completo: um modelo por frame, sempre derivado do BASE
 * (regenerar nunca acumula). Frames faltantes repetem a pose neutra.
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

/**
 * Rede de seguranca do item 3: um frame posado nao pode se despedacar nem
 * evaporar. A cura acima deveria tornar isso impossivel; esta checagem existe
 * para o caso que ela nao cobre chegar como AVISO ao autor, e nao como uma
 * aranha quebrada na tela.
 */
export type PoseIssue = { frame: number; message: string };

export const validatePosedFrames = (base: VoxelModel, frames: VoxelModel[]): PoseIssue[] => {
  const baseCount = Object.keys(base).length;
  const baseComps = connectedComponents(new Set(Object.keys(base)), NEIGHBORS_26).length;
  const issues: PoseIssue[] = [];
  frames.forEach((m, i) => {
    const count = Object.keys(m).length;
    if (count < baseCount * 0.85) {
      issues.push({
        frame: i,
        message: `perdeu ${Math.round((1 - count / baseCount) * 100)}% da materia`,
      });
    }
    const comps = connectedComponents(new Set(Object.keys(m)), NEIGHBORS_26).length;
    if (comps > baseComps) {
      issues.push({ frame: i, message: `${comps - baseComps} peca(s) soltas do corpo` });
    }
  });
  return issues;
};

/** Resumo compacto das partes para o prompt da IA (nunca os voxels). */
export const partsSummary = (parts: Part[], model: VoxelModel): string => {
  const b = voxelModelBounds(model);
  const lines = [
    `Modelo: ${Object.keys(model).length} voxels, caixa x[${b?.minX}..${b?.maxX}] y[${b?.minY}..${b?.maxY}] z[${b?.minZ}..${b?.maxZ}] (chao em z=0, FRENTE = -y, cima = +z).`,
    `Partes:`,
  ];
  for (const p of parts) {
    const dir = p.direction ? `, sai para ${p.direction}` : '';
    const reach = p.kind === 'perna' ? `, ponta no chao (z=${p.bounds.minZ})` : '';
    lines.push(
      `- ${p.name}: ${p.keys.length} voxels${dir}${reach}, pivo/insercao (${p.pivot.map((v) => v.toFixed(1)).join(', ')}), z[${p.bounds.minZ}..${p.bounds.maxZ}]`,
    );
  }
  return lines.join('\n');
};

/**
 * Copia do modelo com uma cor por parte — vira a imagem que mostra a IA (e ao
 * autor) exatamente quais voxels pertencem a cada nome.
 */
export const PART_COLORS = [
  'blood',
  'electric',
  'acid',
  'loot',
  'biolum',
  'fire',
  'fungusLight',
  'mist',
  'amber',
  'moss',
] as const;

/** Nome legivel da cor de cada material do mapa de partes (para a legenda). */
const COLOR_WORD: Record<string, string> = {
  rock: 'cinza-azulado',
  blood: 'vermelho',
  electric: 'azul',
  acid: 'verde-limao',
  loot: 'dourado',
  biolum: 'ciano',
  fire: 'laranja',
  fungusLight: 'verde-claro',
  mist: 'cinza-claro',
  amber: 'ambar',
  moss: 'verde-escuro',
};

/** Material atribuido a cada parte no mapa de cores — uma fonte so. */
export const partsColorAssignment = (parts: Part[]): { part: Part; material: string }[] => {
  let i = 0;
  return parts.map((part) => ({
    part,
    material: part.kind === 'corpo' ? 'rock' : PART_COLORS[i++ % PART_COLORS.length],
  }));
};

export const partsPreviewModel = (parts: Part[]): VoxelModel => {
  const out: VoxelModel = {};
  for (const { part, material } of partsColorAssignment(parts)) {
    for (const key of part.keys) out[key] = material;
  }
  return out;
};

/** Legenda do mapa de partes, em texto, para acompanhar a imagem no prompt. */
export const partsLegend = (parts: Part[]): string =>
  partsColorAssignment(parts)
    .map(({ part, material }) => `${COLOR_WORD[material] ?? material} = ${part.name}`)
    .join('; ');
