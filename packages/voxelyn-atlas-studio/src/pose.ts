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

export type PartKind = 'corpo' | 'perna' | 'membro' | 'osso';

/**
 * Um OSSO do esqueleto. A lista de partes e uma arvore achatada: `corpo` e a
 * raiz (`parent: null`), a raiz de cada membro tem `parent: 'corpo'`, e os
 * segmentos seguintes se penduram no anterior.
 *
 * A hierarquia e o que faltava para o resultado parecer riggado. Sem ela cada
 * parte se movia sozinha: mover o corpo deixava as pernas para tras e a cura de
 * adjacencia esticava borracha entre os dois. Com ela, girar a coxa leva a
 * canela e o pe juntos — cinematica direta, o mesmo que um esqueleto de verdade
 * faz — e girar so a canela dobra o joelho.
 */
export type Part = {
  name: string;
  kind: PartKind;
  /** osso pai na arvore; `null` so no corpo */
  parent: string | null;
  /** chaves dos voxels que ESTE osso possui (nao inclui os dos filhos) */
  keys: string[];
  centroid: [number, number, number];
  /** ponto de rotacao: a junta com o pai (para o corpo, o centroide) */
  pivot: [number, number, number];
  bounds: { minX: number; maxX: number; minY: number; maxY: number; minZ: number; maxZ: number };
  /** direcao em que o membro sai do corpo, em palavras ('frente-direita') */
  direction?: string;
  /** chave estavel do membro (o pivo arredondado) — usada para overrides do autor */
  handle: string;
};

/** O osso pedido e todos os descendentes: a cadeia inteira de um membro. */
export const chainOf = (parts: Part[], rootName: string): Part[] => {
  const out: Part[] = [];
  const wanted = new Set([rootName]);
  // as partes saem em ordem de arvore, entao uma passada basta
  for (const p of parts) {
    if (p.name === rootName || (p.parent !== null && wanted.has(p.parent))) {
      wanted.add(p.name);
      out.push(p);
    }
  }
  return out;
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

/** Distancia geodesica (passos na malha 26) de cada voxel do membro ate a insercao. */
const geodesicFrom = (comp: string[], seeds: string[]): Map<string, number> => {
  const inComp = new Set(comp);
  const dist = new Map<string, number>();
  let front = seeds.filter((k) => inComp.has(k));
  for (const k of front) dist.set(k, 0);
  let d = 0;
  while (front.length > 0) {
    d++;
    const next: string[] = [];
    for (const key of front) {
      const [x, y, z] = parseVoxelKey(key);
      for (const [dx, dy, dz] of NEIGHBORS_26) {
        const nk = voxelKey(x + dx, y + dy, z + dz);
        if (inComp.has(nk) && !dist.has(nk)) {
          dist.set(nk, d);
          next.push(nk);
        }
      }
    }
    front = next;
  }
  // voxel inalcancavel (nao deveria acontecer num componente conexo) vai para a ponta
  for (const key of comp) if (!dist.has(key)) dist.set(key, d);
  return dist;
};

/** Quantos ossos um membro merece: um a cada ~5 voxels de comprimento, ate 3. */
const segmentCount = (maxDist: number): number => Math.max(1, Math.min(3, Math.round(maxDist / 5)));

/**
 * Corta o membro em ossos ao longo do proprio comprimento (coxa, canela, pe).
 *
 * E aqui que "riggar" acontece de verdade: sem junta interna, uma perna e um
 * palito rigido que so pendula no quadril, e nenhuma caminhada le. O corte sai
 * da distancia geodesica ate a insercao — que segue a forma do membro, inclusive
 * quando ele desce na diagonal ou dobra —, nao de um plano em z.
 */
const splitLimbChain = (
  comp: string[],
  attachment: string[],
): { keys: string[]; pivot: [number, number, number] }[] => {
  const seeds = attachment.length > 0 ? attachment : [comp[0]];
  const dist = geodesicFrom(comp, seeds);
  const maxDist = Math.max(...comp.map((k) => dist.get(k) ?? 0));
  const n = segmentCount(maxDist);
  if (n === 1 || maxDist === 0) return [{ keys: comp, pivot: centroidOf(seeds) }];

  const bands: string[][] = Array.from({ length: n }, () => []);
  for (const key of comp) {
    const d = dist.get(key) ?? 0;
    bands[Math.min(n - 1, Math.floor((d / (maxDist + 1)) * n))].push(key);
  }

  const out: { keys: string[]; pivot: [number, number, number] }[] = [];
  for (const band of bands) {
    if (band.length === 0) continue; // banda vazia some: melhor 2 ossos gordos que 3 com um oco
    // pivo do osso = sua extremidade PROXIMAL (a junta com o osso anterior)
    const dmin = Math.min(...band.map((k) => dist.get(k) ?? 0));
    const joint = band.filter((k) => (dist.get(k) ?? 0) <= dmin + 1);
    out.push({ keys: band, pivot: out.length === 0 ? centroidOf(seeds) : centroidOf(joint) });
  }
  return out;
};

/** Sufixos dos ossos depois da raiz, por tipo de membro. */
const BONE_SUFFIX: Record<'perna' | 'membro', string[]> = {
  perna: ['canela', 'pe'],
  membro: ['antebraco', 'mao'],
};

/**
 * Nomes anatomicos quando o bicho e de um arquetipo conhecido. Quadrupede e
 * bipede sao os dois casos que valem a pena: `perna-traseira-direita` diz a IA
 * (e ao autor) o que `perna-3` nunca disse. Fora deles, a numeracao por angulo
 * continua sendo a descricao mais honesta.
 */
const archetypeNames = (
  legs: { pivot: [number, number, number] }[],
  coreCentroid: [number, number, number],
): string[] | null => {
  if (legs.length !== 4 && legs.length !== 2) return null;
  const side = (p: [number, number, number]): string =>
    p[0] >= coreCentroid[0] ? 'direita' : 'esquerda';
  if (legs.length === 2) {
    if (side(legs[0].pivot) === side(legs[1].pivot)) return null;
    return legs.map((l) => `perna-${side(l.pivot)}`);
  }
  const front = (p: [number, number, number]): string =>
    p[1] < coreCentroid[1] ? 'dianteira' : 'traseira';
  const names = legs.map((l) => `perna-${front(l.pivot)}-${side(l.pivot)}`);
  // so aceita se as quatro combinacoes sairem distintas: senao o bicho nao e
  // um quadrupede em pe e o palpite atrapalharia mais do que ajuda
  return new Set(names).size === 4 ? names : null;
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
  type Limb = {
    keys: string[];
    pivot: [number, number, number];
    angle: number;
    kind: 'perna' | 'membro';
    chain: { keys: string[]; pivot: [number, number, number] }[];
  };
  const limbs: Limb[] = [];

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
    const chain = splitLimbChain(comp, attachment);
    const b = boundsOf(comp);
    const kind = b.minZ <= modelBounds.minZ + 1 ? 'perna' : 'membro';
    limbs.push({ keys: comp, pivot: chain[0].pivot, angle: 0, kind, chain });
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
  // o corpo e a RAIZ e vem primeiro: chainOf e a composicao de transformacoes
  // percorrem a lista assumindo que todo pai aparece antes dos filhos
  if (coreKeys.length > 0) {
    const centroid = centroidOf(coreKeys);
    parts.push({
      name: 'corpo',
      kind: 'corpo',
      parent: null,
      keys: coreKeys,
      centroid,
      pivot: centroid,
      bounds: boundsOf(coreKeys),
      handle: 'corpo',
    });
  }

  const bodyCentroid = centroidOf(coreKeys.length > 0 ? coreKeys : Object.keys(model));
  const legsKept = kept.filter((l) => l.kind === 'perna');
  const anatomic = archetypeNames(legsKept, bodyCentroid);
  const anatomicOf = new Map(anatomic ? legsKept.map((l, i) => [l, anatomic[i]]) : []);

  let legN = 0;
  let limbN = 0;
  for (const limb of kept) {
    const handle = handleOf(limb.pivot);
    const auto =
      anatomicOf.get(limb) ?? (limb.kind === 'perna' ? `perna-${++legN}` : `membro-${++limbN}`);
    const rootName = overrides?.names?.[handle] ?? auto;
    if (anatomicOf.has(limb)) legN++;
    let parent: string | null = coreKeys.length > 0 ? 'corpo' : null;
    limb.chain.forEach((bone, i) => {
      const name = i === 0 ? rootName : `${rootName}.${BONE_SUFFIX[limb.kind][i - 1]}`;
      parts.push({
        name,
        kind: i === 0 ? limb.kind : 'osso',
        parent,
        keys: bone.keys,
        centroid: centroidOf(bone.keys),
        pivot: bone.pivot,
        bounds: boundsOf(bone.keys),
        direction: directionWord(limb.angle),
        handle: i === 0 ? handle : `${handle}#${i}`,
      });
      parent = name;
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

type Vec3 = [number, number, number];
/** Transformacao em ponto flutuante — o arredondamento acontece uma vez so, no
 * fim da cadeia, para o erro nao se acumular osso a osso. */
type Xform = (p: Vec3) => Vec3;

const IDENTITY: Xform = (p) => p;

const rotationAround = (pivot: Vec3, axis: 'x' | 'y' | 'z', deg: number): Xform => {
  if (deg === 0) return IDENTITY;
  const rad = (deg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return ([x, y, z]) => {
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
    return [nx + pivot[0], ny + pivot[1], nz + pivot[2]];
  };
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

  // transformacao LOCAL de cada osso citado (girar em torno do proprio pivo,
  // depois deslocar); ossos nao citados ficam na identidade local
  const localOf = new Map<string, Xform>();
  for (const pose of validPoses) {
    const part = byName.get(pose.part)!;
    const dx = clamp(Math.round(pose.move?.[0] ?? 0), -MAX_MOVE, MAX_MOVE);
    const dy = clamp(Math.round(pose.move?.[1] ?? 0), -MAX_MOVE, MAX_MOVE);
    const dz = clamp(Math.round(pose.move?.[2] ?? 0), -MAX_MOVE, MAX_MOVE);
    const deg = clamp(pose.rotate?.deg ?? 0, -MAX_DEG, MAX_DEG);
    const rot = rotationAround(part.pivot, pose.rotate?.axis ?? 'x', deg);
    localOf.set(part.name, (p) => {
      const r = rot(p);
      return [r[0] + dx, r[1] + dy, r[2] + dz];
    });
  }

  // CINEMATICA DIRETA: a transformacao de um osso e a do pai aplicada por cima
  // da propria. E o que faz girar a coxa levar a canela e o pe junto — e mover
  // o corpo carregar o bicho inteiro em vez de deixar as pernas para tras.
  const worldOf = new Map<string, Xform>();
  const worldFor = (name: string): Xform => {
    const cached = worldOf.get(name);
    if (cached) return cached;
    const part = byName.get(name);
    const local = localOf.get(name) ?? IDENTITY;
    const parent = part?.parent ? worldFor(part.parent) : IDENTITY;
    const world: Xform =
      local === IDENTITY && parent === IDENTITY ? IDENTITY : (p) => parent(local(p));
    worldOf.set(name, world);
    return world;
  };

  const transformOf = new Map<string, Xform>();
  for (const part of parts) {
    const world = worldFor(part.name);
    if (world === IDENTITY) continue;
    for (const key of part.keys) transformOf.set(key, world);
  }

  const imageOf = new Map<string, Vec3>();
  for (const key of Object.keys(base)) {
    const p = parseVoxelKey(key) as Vec3;
    const t = transformOf.get(key);
    if (!t) {
      imageOf.set(key, p);
      continue;
    }
    const q = t(p);
    imageOf.set(key, [Math.round(q[0]), Math.round(q[1]), Math.max(0, Math.round(q[2]))]);
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
    const dir = p.direction && p.kind !== 'osso' ? `, sai para ${p.direction}` : '';
    const chain = chainOf(parts, p.name);
    const reach =
      p.kind === 'perna'
        ? `, a cadeia chega ao chao (z=${Math.min(...chain.map((c) => c.bounds.minZ))})`
        : '';
    const rel = p.parent ? `, preso em ${p.parent}` : ' (RAIZ)';
    lines.push(
      `- ${p.name}: ${p.keys.length} voxels${rel}${dir}${reach}, junta em (${p.pivot.map((v) => v.toFixed(1)).join(', ')}), z[${p.bounds.minZ}..${p.bounds.maxZ}]`,
    );
  }
  lines.push(
    '',
    'Girar um osso leva os filhos dele junto (cinematica direta): girar a raiz de um membro balanca o membro inteiro, girar o osso seguinte dobra a junta.',
  );
  return lines.join('\n');
};

/**
 * Copia do modelo com uma cor por parte — vira a imagem que mostra a IA (e ao
 * autor) exatamente quais voxels pertencem a cada nome.
 */
// So MATERIAIS (chaves de RAMPS), nunca cores da paleta: o rasterizador pinta
// as tres faces de um voxel a partir da rampa do material e lanca em quem nao
// tem uma. Os nomes de cor abaixo descrevem a face de TOPO da rampa, que e o
// que domina na vista isometrica — e por isso que `fire` le como ambar.
export const PART_COLORS = [
  'blood',
  'electric',
  'acid',
  'loot',
  'biolum',
  'fire',
  'fungus',
  'ice',
  'bone',
  'lamp',
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
  fungus: 'verde-claro',
  ice: 'cinza-gelo',
  bone: 'bege',
  lamp: 'branco-quente',
};

/** Material atribuido a cada parte no mapa de cores — uma fonte so. */
export const partsColorAssignment = (parts: Part[]): { part: Part; material: string }[] => {
  const byName = new Map(parts.map((p) => [p.name, p]));
  // a cor e do MEMBRO, nao do osso: uma perna inteira le como uma mancha so na
  // imagem, e a legenda diz quantos ossos ela tem
  const rootOf = (p: Part): string => {
    let cur = p;
    while (cur.kind === 'osso' && cur.parent) cur = byName.get(cur.parent) ?? cur;
    return cur.name;
  };
  const material = new Map<string, string>();
  let i = 0;
  for (const p of parts) {
    if (p.kind === 'corpo') material.set(p.name, 'rock');
    else if (p.kind !== 'osso') material.set(p.name, PART_COLORS[i++ % PART_COLORS.length]);
  }
  return parts.map((part) => ({ part, material: material.get(rootOf(part)) ?? 'rock' }));
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
    .filter(({ part }) => part.kind !== 'osso')
    .map(({ part, material }) => {
      const bones = chainOf(parts, part.name).length;
      const chain = bones > 1 ? ` (${bones} ossos)` : '';
      return `${COLOR_WORD[material] ?? material} = ${part.name}${chain}`;
    })
    .join('; ');
