// RIG MANUAL: o autor crava as juntas e o esqueleto sai delas.
//
// O rig automatico de src/pose.ts acerta a maioria dos bichos, mas ele so
// enxerga geometria: um membro que encosta no corpo por uma area larga, ou dois
// membros grudados, saem errados e nao ha heuristica que salve. Aqui quem
// decide e quem desenhou — o mesmo caminho que as ferramentas de rig oferecem
// quando o automatico erra.
//
// Em malha, rig manual exige pesos de skinning aproximados. Em voxel nao: a
// grade e discreta, entao "cada voxel pertence ao OSSO MAIS PROXIMO" e uma
// resposta exata, sem pesos e sem ambiguidade. E o que este arquivo faz.
import { parseVoxelKey, voxelKey, voxelModelBounds, type VoxelModel } from './voxel';
import { chainOf, segmentParts, type Part, type PartKind } from './pose';

export type Vec3 = [number, number, number];

/** Uma junta a ser marcada pelo autor. */
export type RigSlot = {
  id: string;
  label: string;
  /** o par espelhado em X, quando a simetria esta ligada */
  mirror?: string;
};

/**
 * Um osso: vai da junta `from` ate a junta `to`. `to: null` e osso terminal
 * (mao, pe, cabeca, cauda) — ele continua na direcao em que a cadeia vinha,
 * porque a ponta do membro nao tem uma junta depois dela para marcar.
 */
export type RigBone = {
  name: string;
  parent: string | null;
  from: string;
  to: string | null;
  kind: PartKind;
};

export type RigTemplate = {
  id: string;
  label: string;
  slots: RigSlot[];
  bones: RigBone[];
};

/** Posicoes marcadas: id da junta -> voxel. */
export type JointMarkers = Record<string, Vec3>;

export type ManualRig = {
  template: string;
  markers: JointMarkers;
  /** marcar de um lado espelha no outro (eixo x=-0.5, o mesmo do editor) */
  symmetry: boolean;
};

/** Espelho em X do editor: o mesmo plano de `mirrorModelX`. */
export const mirrorPoint = (p: Vec3): Vec3 => [-1 - p[0], p[1], p[2]];

// A = direita anatomica (+x), B = esquerda. Fica escrito no rotulo porque a
// troca dos dois e o erro mais facil de cometer marcando no celular.
const pair = (id: string, label: string): RigSlot[] => [
  { id: `${id}-A`, label: `${label} direito(a) [A]`, mirror: `${id}-B` },
  { id: `${id}-B`, label: `${label} esquerdo(a) [B]`, mirror: `${id}-A` },
];

const limbBones = (
  limb: string,
  root: string,
  joints: [string, string, string],
  suffixes: [string, string],
  kind: PartKind,
): RigBone[] => [
  { name: limb, parent: root, from: joints[0], to: joints[1], kind },
  {
    name: `${limb}.${suffixes[0]}`,
    parent: limb,
    from: joints[1],
    to: joints[2],
    kind: 'osso',
  },
  {
    name: `${limb}.${suffixes[1]}`,
    parent: `${limb}.${suffixes[0]}`,
    from: joints[2],
    to: null,
    kind: 'osso',
  },
];

const HUMANOID: RigTemplate = {
  id: 'humanoide',
  label: 'Humanoide (2 pernas, 2 bracos)',
  slots: [
    { id: 'virilha', label: 'Virilha (raiz do esqueleto)' },
    { id: 'queixo', label: 'Queixo' },
    ...pair('ombro', 'Ombro'),
    ...pair('cotovelo', 'Cotovelo'),
    ...pair('pulso', 'Pulso'),
    ...pair('joelho', 'Joelho'),
    ...pair('tornozelo', 'Tornozelo'),
  ],
  bones: [
    { name: 'corpo', parent: null, from: 'virilha', to: 'queixo', kind: 'corpo' },
    { name: 'cabeca', parent: 'corpo', from: 'queixo', to: null, kind: 'membro' },
    ...limbBones(
      'braco-direito',
      'corpo',
      ['ombro-A', 'cotovelo-A', 'pulso-A'],
      ['antebraco', 'mao'],
      'membro',
    ),
    ...limbBones(
      'braco-esquerdo',
      'corpo',
      ['ombro-B', 'cotovelo-B', 'pulso-B'],
      ['antebraco', 'mao'],
      'membro',
    ),
    // as duas pernas saem da VIRILHA (nao ha marcador de quadril por lado)
    ...limbBones(
      'perna-direita',
      'corpo',
      ['virilha', 'joelho-A', 'tornozelo-A'],
      ['canela', 'pe'],
      'perna',
    ),
    ...limbBones(
      'perna-esquerda',
      'corpo',
      ['virilha', 'joelho-B', 'tornozelo-B'],
      ['canela', 'pe'],
      'perna',
    ),
  ],
};

const QUADRUPED: RigTemplate = {
  id: 'quadrupede',
  label: 'Quadrupede (cachorro, lobo, cavalo)',
  slots: [
    { id: 'quadril', label: 'Quadril / garupa (raiz do esqueleto)' },
    { id: 'peito', label: 'Peito (frente do tronco)' },
    { id: 'nuca', label: 'Nuca (onde o pescoco sai do tronco)' },
    { id: 'focinho', label: 'Focinho / ponta da cabeca' },
    { id: 'cauda', label: 'Cauda (opcional)' },
    ...pair('ombro', 'Ombro (pata dianteira)'),
    ...pair('cotovelo', 'Cotovelo (pata dianteira)'),
    ...pair('pata-dianteira', 'Pata dianteira'),
    ...pair('coxa', 'Coxa (pata traseira)'),
    ...pair('joelho', 'Joelho (pata traseira)'),
    ...pair('pata-traseira', 'Pata traseira'),
  ],
  bones: [
    { name: 'corpo', parent: null, from: 'quadril', to: 'peito', kind: 'corpo' },
    { name: 'pescoco', parent: 'corpo', from: 'nuca', to: 'focinho', kind: 'membro' },
    { name: 'pescoco.cabeca', parent: 'pescoco', from: 'focinho', to: null, kind: 'osso' },
    { name: 'cauda', parent: 'corpo', from: 'cauda', to: null, kind: 'membro' },
    ...limbBones(
      'perna-dianteira-direita',
      'corpo',
      ['ombro-A', 'cotovelo-A', 'pata-dianteira-A'],
      ['canela', 'pe'],
      'perna',
    ),
    ...limbBones(
      'perna-dianteira-esquerda',
      'corpo',
      ['ombro-B', 'cotovelo-B', 'pata-dianteira-B'],
      ['canela', 'pe'],
      'perna',
    ),
    ...limbBones(
      'perna-traseira-direita',
      'corpo',
      ['coxa-A', 'joelho-A', 'pata-traseira-A'],
      ['canela', 'pe'],
      'perna',
    ),
    ...limbBones(
      'perna-traseira-esquerda',
      'corpo',
      ['coxa-B', 'joelho-B', 'pata-traseira-B'],
      ['canela', 'pe'],
      'perna',
    ),
  ],
};

export const RIG_TEMPLATES: RigTemplate[] = [HUMANOID, QUADRUPED];

export const templateById = (id: string): RigTemplate | undefined =>
  RIG_TEMPLATES.find((t) => t.id === id);

/** Marcadores efetivos: com simetria ligada, o lado marcado preenche o vazio. */
export const resolveMarkers = (rig: ManualRig): JointMarkers => {
  const tpl = templateById(rig.template);
  if (!tpl) return {};
  const out: JointMarkers = { ...rig.markers };
  if (!rig.symmetry) return out;
  for (const slot of tpl.slots) {
    if (!slot.mirror) continue;
    if (out[slot.id] || !rig.markers[slot.mirror]) continue;
    out[slot.id] = mirrorPoint(rig.markers[slot.mirror]);
  }
  return out;
};

const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const len = (a: Vec3): number => Math.hypot(a[0], a[1], a[2]);

/** Distancia ao quadrado de um ponto ao SEGMENTO ab (nao a reta infinita). */
const distToSegment = (p: Vec3, a: Vec3, b: Vec3): number => {
  const ab = sub(b, a);
  const ap = sub(p, a);
  const denom = ab[0] ** 2 + ab[1] ** 2 + ab[2] ** 2;
  const t =
    denom === 0
      ? 0
      : Math.max(0, Math.min(1, (ap[0] * ab[0] + ap[1] * ab[1] + ap[2] * ab[2]) / denom));
  const dx = ap[0] - ab[0] * t;
  const dy = ap[1] - ab[1] * t;
  const dz = ap[2] - ab[2] * t;
  return dx * dx + dy * dy + dz * dz;
};

type Segment = { bone: RigBone; a: Vec3; b: Vec3; depth: number };

/** Distancia do osso ate a raiz — quem esta mais longe e a extremidade. */
const depthOf = (tpl: RigTemplate, bone: RigBone): number => {
  const byName = new Map(tpl.bones.map((b) => [b.name, b]));
  let d = 0;
  let cur: RigBone | undefined = bone;
  while (cur?.parent) {
    d++;
    cur = byName.get(cur.parent);
  }
  return d;
};

/**
 * Segmentos de cada osso que tem marcadores suficientes. Osso terminal ganha um
 * segmento que sai da ultima junta CONTINUANDO a direcao da cadeia — e assim
 * que a mao, o pe e a cabeca recebem voxels sem precisar de uma junta a mais.
 */
const buildSegments = (
  tpl: RigTemplate,
  markers: JointMarkers,
  reach: number,
): { segments: Segment[]; skipped: Set<string> } => {
  const byName = new Map(tpl.bones.map((b) => [b.name, b]));
  const segments: Segment[] = [];
  const skipped = new Set<string>();

  for (const bone of tpl.bones) {
    const a = markers[bone.from];
    if (!a) {
      skipped.add(bone.name);
      continue;
    }
    if (bone.to) {
      const b = markers[bone.to];
      if (!b) {
        skipped.add(bone.name);
        continue;
      }
      segments.push({ bone, a, b, depth: depthOf(tpl, bone) });
      continue;
    }
    // terminal: continua na direcao de onde a cadeia vinha
    const parent = bone.parent ? byName.get(bone.parent) : undefined;
    const prev = parent ? markers[parent.from] : undefined;
    const dir = prev ? sub(a, prev) : ([0, 0, -1] as Vec3);
    const l = len(dir) || 1;
    segments.push({
      bone,
      a,
      b: [a[0] + (dir[0] / l) * reach, a[1] + (dir[1] / l) * reach, a[2] + (dir[2] / l) * reach],
      depth: depthOf(tpl, bone),
    });
  }
  return { segments, skipped };
};

/** Quantas juntas do template ainda faltam para o rig valer. */
export const missingSlots = (rig: ManualRig): RigSlot[] => {
  const tpl = templateById(rig.template);
  if (!tpl) return [];
  const markers = resolveMarkers(rig);
  const needed = new Set<string>();
  for (const bone of tpl.bones) {
    needed.add(bone.from);
    if (bone.to) needed.add(bone.to);
  }
  // a cauda e opcional: um bicho sem cauda nao pode ficar travado por ela
  needed.delete('cauda');
  return tpl.slots.filter((s) => needed.has(s.id) && !markers[s.id]);
};

/**
 * Monta as partes a partir das juntas marcadas: cada voxel vai para o osso cujo
 * segmento esta mais perto dele.
 *
 * Osso que nao recebeu voxel nenhum some, e os filhos dele sobem para o avo —
 * senao um marcador mal colocado deixaria um galho orfao na arvore, e a
 * composicao de transformacoes procuraria um pai que nao existe.
 */
export const rigToParts = (model: VoxelModel, rig: ManualRig): Part[] => {
  const tpl = templateById(rig.template);
  const bounds = voxelModelBounds(model);
  if (!tpl || !bounds) return [];
  const markers = resolveMarkers(rig);
  const reach =
    Math.hypot(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY, bounds.maxZ - bounds.minZ) ||
    1;
  const { segments, skipped } = buildSegments(tpl, markers, reach);
  if (segments.length === 0) return [];

  const keysOf = new Map<string, string[]>();
  for (const key of Object.keys(model)) {
    const p = parseVoxelKey(key) as Vec3;
    let best = segments[0];
    let bestD = Infinity;
    for (const seg of segments) {
      const d = distToSegment(p, seg.a, seg.b);
      // EMPATE VAI PARA A EXTREMIDADE: os voxels em volta de uma junta ficam a
      // mesma distancia dos dois ossos que ela liga, e a pata precisa ganhar da
      // canela — senao o osso da ponta nasce vazio e some da arvore
      if (d < bestD - 1e-9 || (Math.abs(d - bestD) <= 1e-9 && seg.depth > best.depth)) {
        bestD = Math.min(d, bestD);
        best = seg;
      }
    }
    const list = keysOf.get(best.bone.name);
    if (list) list.push(key);
    else keysOf.set(best.bone.name, [key]);
  }

  // pai efetivo: pula os ossos que sumiram (sem marcador ou sem voxel)
  const alive = (name: string): boolean => keysOf.has(name) && !skipped.has(name);
  const byName = new Map(tpl.bones.map((b) => [b.name, b]));
  const effectiveParent = (bone: RigBone): string | null => {
    let p = bone.parent;
    while (p && !alive(p)) p = byName.get(p)?.parent ?? null;
    return p;
  };

  const parts: Part[] = [];
  for (const bone of tpl.bones) {
    const keys = keysOf.get(bone.name);
    if (!keys || skipped.has(bone.name)) continue;
    const pivot = markers[bone.from];
    let minX = Infinity,
      maxX = -Infinity,
      minY = Infinity,
      maxY = -Infinity,
      minZ = Infinity,
      maxZ = -Infinity,
      sx = 0,
      sy = 0,
      sz = 0;
    for (const key of keys) {
      const [x, y, z] = parseVoxelKey(key);
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
      minZ = Math.min(minZ, z);
      maxZ = Math.max(maxZ, z);
      sx += x;
      sy += y;
      sz += z;
    }
    parts.push({
      name: bone.name,
      kind: bone.kind,
      parent: effectiveParent(bone),
      keys,
      centroid: [sx / keys.length, sy / keys.length, sz / keys.length],
      pivot,
      bounds: { minX, maxX, minY, maxY, minZ, maxZ },
      handle: voxelKey(Math.round(pivot[0]), Math.round(pivot[1]), Math.round(pivot[2])),
    });
  }
  // ordem topologica: chainOf e a composicao de transformacoes leem a lista uma
  // vez so e exigem que todo pai apareca antes dos filhos
  const emitted = new Set<string>();
  const ordered: Part[] = [];
  let pending = parts;
  while (pending.length > 0) {
    const ready = pending.filter((p) => p.parent === null || emitted.has(p.parent));
    if (ready.length === 0) break; // nao deveria acontecer; nao trava se acontecer
    for (const p of ready) {
      emitted.add(p.name);
      ordered.push(p);
    }
    pending = pending.filter((p) => !emitted.has(p.name));
  }
  return [...ordered, ...pending];
};

/** Ponto do osso mais distante do pivo dele — serve de "ponta" da cadeia. */
const farthestFrom = (part: Part, from: Vec3): Vec3 => {
  let best: Vec3 = from;
  let bestD = -1;
  for (const key of part.keys) {
    const p = parseVoxelKey(key) as Vec3;
    const d = (p[0] - from[0]) ** 2 + (p[1] - from[1]) ** 2 + (p[2] - from[2]) ** 2;
    if (d > bestD) {
      bestD = d;
      best = p;
    }
  }
  return best;
};

const round3 = (p: Vec3): Vec3 => [Math.round(p[0]), Math.round(p[1]), Math.round(p[2])];

/**
 * Palpite inicial das juntas, tirado do rig AUTOMATICO. E o mesmo par que as
 * ferramentas de rig oferecem: o automatico chuta, o autor corrige o que saiu
 * torto — muito mais rapido que cravar quinze juntas do zero no celular.
 *
 * O que nao da para inferir com honestidade fica de fora: a folha mostra o que
 * falta, e um palpite errado custa mais caro que um campo vazio.
 */
export const guessMarkers = (model: VoxelModel, tpl: RigTemplate): JointMarkers => {
  const parts = segmentParts(model);
  const body = parts.find((p) => p.kind === 'corpo');
  if (!body) return {};
  const out: JointMarkers = {};
  const [bx, by] = body.centroid;
  const bz = (body.bounds.minZ + body.bounds.maxZ) / 2;

  /** As juntas de uma cadeia: insercao, dobra, ponta. */
  const jointsOf = (root: Part): [Vec3, Vec3, Vec3] => {
    const chain = chainOf(parts, root.name);
    const tip = farthestFrom(chain[chain.length - 1], chain[chain.length - 1].pivot);
    return [
      round3(root.pivot),
      round3(chain[1]?.pivot ?? root.centroid),
      round3(chain[2]?.pivot ?? tip),
    ];
  };

  const legs = parts.filter((p) => p.kind === 'perna');
  const limbs = parts.filter((p) => p.kind === 'membro');
  const sideOf = (p: Part): 'A' | 'B' => (p.pivot[0] >= bx ? 'A' : 'B');
  const isFront = (p: Part): boolean => p.pivot[1] < by;

  if (tpl.id === 'quadrupede') {
    out.quadril = round3([bx, body.bounds.maxY - 1, bz]);
    out.peito = round3([bx, body.bounds.minY + 1, bz]);
    for (const leg of legs) {
      const [a, b, c] = jointsOf(leg);
      const side = sideOf(leg);
      if (isFront(leg)) {
        out[`ombro-${side}`] = a;
        out[`cotovelo-${side}`] = b;
        out[`pata-dianteira-${side}`] = c;
      } else {
        out[`coxa-${side}`] = a;
        out[`joelho-${side}`] = b;
        out[`pata-traseira-${side}`] = c;
      }
    }
    // membro que sai para a FRENTE e cabeca/pescoco; para tras, cauda
    const head = limbs.filter((p) => p.pivot[1] < by).sort((a, b) => a.pivot[1] - b.pivot[1])[0];
    if (head) {
      out.nuca = round3(head.pivot);
      out.focinho = round3(farthestFrom(chainOf(parts, head.name).at(-1)!, head.pivot));
    }
    const tail = limbs.filter((p) => p.pivot[1] > by).sort((a, b) => b.pivot[1] - a.pivot[1])[0];
    if (tail) out.cauda = round3(tail.pivot);
    return out;
  }

  if (tpl.id === 'humanoide') {
    out.virilha = round3([bx, by, body.bounds.minZ]);
    out.queixo = round3([bx, by, body.bounds.maxZ]);
    for (const leg of legs) {
      const [, b, c] = jointsOf(leg);
      const side = sideOf(leg);
      out[`joelho-${side}`] = b;
      out[`tornozelo-${side}`] = c;
    }
    // bracos: membros que saem para os LADOS, nao para cima (cabeca)
    const arms = limbs.filter((p) => Math.abs(p.pivot[0] - bx) >= Math.abs(p.pivot[1] - by));
    for (const arm of arms) {
      const [a, b, c] = jointsOf(arm);
      const side = sideOf(arm);
      out[`ombro-${side}`] = a;
      out[`cotovelo-${side}`] = b;
      out[`pulso-${side}`] = c;
    }
    return out;
  }
  return out;
};
