// Rig manual: o autor crava as juntas e o esqueleto sai delas. O que estes
// testes cobram e o contrato que o motor de poses assume — arvore com pai antes
// de filho, particao completa dos voxels e pivo na junta marcada.
import { describe, expect, it } from 'vitest';
import {
  RIG_TEMPLATES,
  guessMarkers,
  missingSlots,
  mirrorPoint,
  resolveMarkers,
  rigToParts,
  templateById,
  type ManualRig,
} from '../rig';
import { applyFramePose, chainOf } from '../pose';
import { voxelKey, type VoxelModel } from '../voxel';

/** Cachorro tosco: tronco horizontal, pescoco/cabeca na frente, 4 patas. */
const dog = (): VoxelModel => {
  const m: VoxelModel = {};
  // tronco: y de -6 (frente) a 4 (tras), z 6..10
  for (let x = -2; x <= 1; x++)
    for (let y = -6; y <= 4; y++) for (let z = 6; z <= 10; z++) m[voxelKey(x, y, z)] = 'rock';
  // pescoco + cabeca, saindo para a frente e para cima
  for (let x = -1; x <= 0; x++)
    for (let y = -9; y <= -7; y++) for (let z = 9; z <= 12; z++) m[voxelKey(x, y, z)] = 'bone';
  // quatro patas descendo ate o chao
  for (const [lx, ly] of [
    [-2, -5],
    [1, -5],
    [-2, 3],
    [1, 3],
  ]) {
    for (let z = 1; z <= 5; z++) m[voxelKey(lx, ly, z)] = 'bone';
    // pata: dois voxels apoiados no chao, apontando para a frente
    for (let dy = -1; dy <= 0; dy++) m[voxelKey(lx, ly + dy, 0)] = 'bone';
  }
  return m;
};

const dogRig = (symmetry = false): ManualRig => ({
  template: 'quadrupede',
  symmetry,
  markers: {
    quadril: [-1, 3, 8],
    peito: [-1, -5, 8],
    nuca: [-1, -6, 10],
    focinho: [-1, -9, 11],
    'ombro-A': [1, -5, 6],
    'cotovelo-A': [1, -5, 3],
    'pata-dianteira-A': [1, -5, 0],
    'ombro-B': [-2, -5, 6],
    'cotovelo-B': [-2, -5, 3],
    'pata-dianteira-B': [-2, -5, 0],
    'coxa-A': [1, 3, 6],
    'joelho-A': [1, 3, 3],
    'pata-traseira-A': [1, 3, 0],
    'coxa-B': [-2, 3, 6],
    'joelho-B': [-2, 3, 3],
    'pata-traseira-B': [-2, 3, 0],
  },
});

describe('templates', () => {
  it('todo osso aponta para um pai e para juntas que existem no template', () => {
    for (const tpl of RIG_TEMPLATES) {
      const slots = new Set(tpl.slots.map((s) => s.id));
      const bones = new Set(tpl.bones.map((b) => b.name));
      expect(tpl.bones.filter((b) => b.parent === null).length, tpl.id).toBe(1);
      for (const bone of tpl.bones) {
        expect(slots.has(bone.from), `${tpl.id}/${bone.name}.from=${bone.from}`).toBe(true);
        if (bone.to) expect(slots.has(bone.to), `${tpl.id}/${bone.name}.to`).toBe(true);
        if (bone.parent) expect(bones.has(bone.parent), `${tpl.id}/${bone.name}.parent`).toBe(true);
      }
      // nomes unicos: a arvore e indexada por nome
      expect(bones.size).toBe(tpl.bones.length);
    }
  });

  it('cada lado A tem um par B espelhado', () => {
    for (const tpl of RIG_TEMPLATES) {
      for (const slot of tpl.slots) {
        if (!slot.mirror) continue;
        expect(tpl.slots.find((s) => s.id === slot.mirror)?.mirror).toBe(slot.id);
      }
    }
  });
});

describe('simetria', () => {
  it('marcar um lado preenche o outro, e so o que falta', () => {
    const rig: ManualRig = {
      template: 'humanoide',
      symmetry: true,
      markers: { 'joelho-A': [2, 0, 5], 'tornozelo-B': [-9, 0, 1] },
    };
    const m = resolveMarkers(rig);
    expect(m['joelho-B']).toEqual(mirrorPoint([2, 0, 5]));
    expect(m['tornozelo-A']).toEqual(mirrorPoint([-9, 0, 1]));
    // o que o autor marcou a mao nao e sobrescrito
    expect(m['joelho-A']).toEqual([2, 0, 5]);
  });

  it('espelhar duas vezes volta ao ponto original', () => {
    expect(mirrorPoint(mirrorPoint([3, -2, 7]))).toEqual([3, -2, 7]);
  });

  it('desligada, nao inventa marcador nenhum', () => {
    const rig: ManualRig = {
      template: 'humanoide',
      symmetry: false,
      markers: { 'joelho-A': [2, 0, 5] },
    };
    expect(resolveMarkers(rig)['joelho-B']).toBeUndefined();
  });
});

describe('missingSlots', () => {
  it('lista o que falta e ignora a cauda, que e opcional', () => {
    const missing = missingSlots(dogRig()).map((s) => s.id);
    expect(missing).toEqual([]);
    const partial: ManualRig = { ...dogRig(), markers: { quadril: [0, 0, 8] } };
    expect(missingSlots(partial).length).toBeGreaterThan(5);
    expect(missingSlots(partial).some((s) => s.id === 'cauda')).toBe(false);
  });

  it('com simetria, marcar um lado ja resolve o par', () => {
    const half = { ...dogRig(true) };
    half.markers = Object.fromEntries(
      Object.entries(half.markers).filter(([k]) => !k.endsWith('-B')),
    );
    expect(missingSlots(half)).toEqual([]);
  });
});

describe('rigToParts', () => {
  it('particiona TODOS os voxels entre os ossos, sem perda nem duplicata', () => {
    const m = dog();
    const parts = rigToParts(m, dogRig());
    const keys = parts.flatMap((p) => p.keys);
    expect(keys.length).toBe(Object.keys(m).length);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('devolve a arvore com o pai sempre antes do filho', () => {
    const parts = rigToParts(dog(), dogRig());
    const seen = new Set<string>();
    for (const p of parts) {
      if (p.parent !== null)
        expect(seen.has(p.parent), `${p.name} veio antes de ${p.parent}`).toBe(true);
      seen.add(p.name);
    }
    expect(parts.filter((p) => p.parent === null).length).toBe(1);
  });

  it('acha as quatro patas e a cabeca, cada uma com a cadeia completa', () => {
    const parts = rigToParts(dog(), dogRig());
    const legs = parts.filter((p) => p.kind === 'perna');
    expect(legs.map((p) => p.name).sort()).toEqual([
      'perna-dianteira-direita',
      'perna-dianteira-esquerda',
      'perna-traseira-direita',
      'perna-traseira-esquerda',
    ]);
    for (const leg of legs) expect(chainOf(parts, leg.name).length).toBe(3);
    expect(parts.find((p) => p.name === 'pescoco')).toBeDefined();
  });

  it('o pivo de cada osso e exatamente a junta marcada', () => {
    const rig = dogRig();
    const tpl = templateById('quadrupede')!;
    const parts = rigToParts(dog(), rig);
    for (const part of parts) {
      const bone = tpl.bones.find((b) => b.name === part.name)!;
      expect(part.pivot, part.name).toEqual(rig.markers[bone.from]);
    }
  });

  it('osso sem marcador some e o filho sobe para o avo', () => {
    const rig = dogRig();
    delete rig.markers['cotovelo-A'];
    delete rig.markers['pata-dianteira-A'];
    const parts = rigToParts(dog(), rig);
    const names = new Set(parts.map((p) => p.name));
    expect(names.has('perna-dianteira-direita.canela')).toBe(false);
    // e a arvore continua fechada: todo pai citado existe
    for (const p of parts) if (p.parent) expect(names.has(p.parent)).toBe(true);
  });

  it('o rig manual alimenta o motor de poses e o modelo nao se despedaca', () => {
    const m = dog();
    const parts = rigToParts(m, dogRig());
    const posed = applyFramePose(m, parts, {
      poses: [
        { part: 'perna-dianteira-direita', rotate: { axis: 'x', deg: -25 } },
        { part: 'perna-traseira-esquerda.canela', rotate: { axis: 'x', deg: 20 } },
        { part: 'corpo', move: [0, 0, 1] },
      ],
    });
    expect(Object.keys(posed).length).toBeGreaterThan(Object.keys(m).length * 0.9);
  });

  it('modelo vazio ou template desconhecido devolve lista vazia', () => {
    expect(rigToParts({}, dogRig())).toEqual([]);
    expect(rigToParts(dog(), { template: 'nada', symmetry: false, markers: {} })).toEqual([]);
  });
});

describe('guessMarkers', () => {
  it('chuta as juntas do quadrupede a partir do rig automatico', () => {
    const tpl = templateById('quadrupede')!;
    const guessed = guessMarkers(dog(), tpl);
    // as quatro patas saem, cada uma com as tres juntas
    for (const side of ['A', 'B']) {
      for (const id of [`ombro-${side}`, `cotovelo-${side}`, `pata-dianteira-${side}`]) {
        expect(guessed[id], id).toBeDefined();
      }
      for (const id of [`coxa-${side}`, `joelho-${side}`, `pata-traseira-${side}`]) {
        expect(guessed[id], id).toBeDefined();
      }
    }
    expect(guessed.quadril).toBeDefined();
    expect(guessed.peito).toBeDefined();
    // quadril fica ATRAS do peito (frente = -y)
    expect(guessed.quadril[1]).toBeGreaterThan(guessed.peito[1]);
    // dianteiras a frente das traseiras, e os lados nao se cruzam
    expect(guessed['ombro-A'][1]).toBeLessThan(guessed['coxa-A'][1]);
    expect(guessed['ombro-A'][0]).toBeGreaterThan(guessed['ombro-B'][0]);
  });

  it('as juntas chutadas sao inteiras e viram um rig utilizavel', () => {
    const tpl = templateById('quadrupede')!;
    const rig: ManualRig = {
      template: 'quadrupede',
      symmetry: false,
      markers: guessMarkers(dog(), tpl),
    };
    for (const pos of Object.values(rig.markers)) {
      for (const v of pos) expect(Number.isInteger(v)).toBe(true);
    }
    const parts = rigToParts(dog(), rig);
    expect(parts.filter((p) => p.kind === 'perna').length).toBe(4);
    expect(parts.flatMap((p) => p.keys).length).toBe(Object.keys(dog()).length);
  });

  it('modelo vazio nao chuta nada', () => {
    expect(guessMarkers({}, templateById('humanoide')!)).toEqual({});
  });
});
