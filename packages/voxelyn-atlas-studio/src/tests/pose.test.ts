// Motor de poses: segmentacao em nucleo + membros completos, cura de
// adjacencia e as garantias que o autor ve na tela (modelo nao se despedaca).
import { describe, expect, it } from 'vitest';
import {
  applyAnimationSpec,
  applyFramePose,
  connectedComponents,
  chainOf,
  partsPreviewModel,
  partsSummary,
  PART_COLORS,
  segmentParts,
  validatePosedFrames,
  MAX_MOVE,
  type AnimationSpec,
} from '../pose';
import {
  renderVoxelView,
  shiftModel,
  voxelKey,
  voxelModelBounds,
  VOXEL_MATERIALS,
  type VoxelModel,
} from '../voxel';

const componentCount = (m: VoxelModel): number =>
  connectedComponents(new Set(Object.keys(m))).length;

/**
 * Aranha CONEXA: corpo elipsoide macico e 8 pernas que saem da superficie do
 * corpo, sobem um joelho e descem em DIAGONAL ate o chao — a topologia que
 * derrubava a versao anterior (vizinhanca por face + corte horizontal).
 */
const spider = (): VoxelModel => {
  const m: VoxelModel = {};
  const inBody = (x: number, y: number, z: number): boolean =>
    (x / 5) ** 2 + (y / 4) ** 2 + ((z - 10) / 3) ** 2 <= 1;
  for (let x = -6; x <= 6; x++)
    for (let y = -5; y <= 5; y++)
      for (let z = 7; z <= 13; z++) if (inBody(x, y, z)) m[voxelKey(x, y, z)] = 'rock';

  for (const [dx, dy] of [
    [-1, -1],
    [-1, 0],
    [-1, 1],
    [1, -1],
    [1, 0],
    [1, 1],
    [0, -1],
    [0, 1],
  ] as [number, number][]) {
    // anda do centro para fora ate sair do corpo: ali comeca a perna
    let x = 0,
      y = 0;
    const z0 = 10;
    while (inBody(x + dx, y + dy, z0)) {
      x += dx;
      y += dy;
    }
    let z = z0;
    for (let i = 0; i < 2; i++) {
      x += dx;
      y += dy;
      z += 1;
      m[voxelKey(x, y, z)] = 'bone';
    }
    while (z > 0) {
      x += dx;
      y += dy;
      z -= 1;
      m[voxelKey(x, y, z)] = 'bone';
    }
  }
  return m;
};

/** Corpo macico sobre 4 colunas verticais (a topologia simples). */
const quadruped = (): VoxelModel => {
  const m: VoxelModel = {};
  for (let x = -3; x <= 2; x++)
    for (let y = -2; y <= 1; y++) for (let z = 4; z <= 7; z++) m[voxelKey(x, y, z)] = 'rock';
  for (const [lx, ly] of [
    [-3, -2],
    [2, -2],
    [-3, 1],
    [2, 1],
  ]) {
    for (let z = 0; z <= 3; z++) m[voxelKey(lx, ly, z)] = 'bone';
  }
  return m;
};

describe('segmentParts', () => {
  it('aranha diagonal: acha as 8 pernas INTEIRAS + corpo', () => {
    const m = spider();
    expect(componentCount(m)).toBe(1); // o modelo de teste e conexo
    const parts = segmentParts(m);
    const legs = parts.filter((p) => p.kind === 'perna');
    expect(legs.length).toBe(8);
    expect(parts.find((p) => p.name === 'corpo')).toBeDefined();
    // a CADEIA de cada perna vai da insercao ate o chao (a raiz e so a coxa)
    for (const leg of legs) {
      const chain = chainOf(parts, leg.name);
      expect(Math.min(...chain.map((c) => c.bounds.minZ)), leg.name).toBe(0);
      expect(Math.max(...chain.map((c) => c.bounds.maxZ))).toBeGreaterThan(9);
    }
    // nenhum voxel se perde nem se duplica entre as partes
    const total = parts.reduce((n, p) => n + p.keys.length, 0);
    expect(total).toBe(Object.keys(m).length);
    expect(new Set(parts.flatMap((p) => p.keys)).size).toBe(total);
  });

  it('nomeia as pernas em volta do corpo, comecando pela frente', () => {
    const parts = segmentParts(spider()).filter((p) => p.kind === 'perna');
    expect(parts[0].direction).toBe('frente');
    // as oito direcoes saem distintas e em ordem horaria
    expect(new Set(parts.map((p) => p.direction)).size).toBe(8);
    expect(parts.map((p) => p.name)).toEqual([
      'perna-1',
      'perna-2',
      'perna-3',
      'perna-4',
      'perna-5',
      'perna-6',
      'perna-7',
      'perna-8',
    ]);
  });

  it('quadrupede vertical continua funcionando', () => {
    const parts = segmentParts(quadruped());
    expect(parts.filter((p) => p.kind === 'perna').length).toBe(4);
    expect(parts.find((p) => p.name === 'corpo')).toBeDefined();
  });

  it('pivo de cada membro fica na INSERCAO, no alto da perna', () => {
    for (const leg of segmentParts(spider()).filter((p) => p.kind === 'perna')) {
      expect(leg.pivot[2]).toBeGreaterThan(leg.bounds.maxZ - 3);
    }
  });

  it('overrides do autor: renomear e tratar membro como corpo', () => {
    const m = spider();
    const first = segmentParts(m).find((p) => p.kind === 'perna')!;
    const renamed = segmentParts(m, { names: { [first.handle]: 'pata-dianteira' } });
    expect(renamed.some((p) => p.name === 'pata-dianteira')).toBe(true);

    const mergedParts = segmentParts(m, { mergeToCore: [first.handle] });
    expect(mergedParts.filter((p) => p.kind === 'perna').length).toBe(7);
    const body = mergedParts.find((p) => p.name === 'corpo')!;
    expect(body.keys.length).toBeGreaterThan(
      segmentParts(m).find((p) => p.name === 'corpo')!.keys.length,
    );
  });

  it('e estavel entre chamadas e nao quebra com modelo vazio', () => {
    expect(segmentParts(spider()).map((p) => p.name)).toEqual(
      segmentParts(spider()).map((p) => p.name),
    );
    expect(segmentParts({})).toEqual([]);
  });
});

describe('esqueleto: hierarquia e cadeia de ossos', () => {
  it('cada perna vira uma cadeia com junta interna, presa no corpo', () => {
    const parts = segmentParts(spider());
    for (const leg of parts.filter((p) => p.kind === 'perna')) {
      expect(leg.parent).toBe('corpo');
      const chain = chainOf(parts, leg.name);
      expect(chain.length, `${leg.name} precisa de junta`).toBeGreaterThan(1);
      // a cadeia desce: cada osso comeca mais embaixo que o anterior
      for (let i = 1; i < chain.length; i++) {
        expect(chain[i].parent).toBe(chain[i - 1].name);
        expect(chain[i].pivot[2]).toBeLessThan(chain[i - 1].pivot[2]);
      }
    }
    expect(parts.find((p) => p.name === 'corpo')!.parent).toBeNull();
  });

  it('os ossos particionam o modelo: nada se perde nem se duplica', () => {
    const m = spider();
    const parts = segmentParts(m);
    const keys = parts.flatMap((p) => p.keys);
    expect(new Set(keys).size).toBe(Object.keys(m).length);
  });

  it('quadrupede ganha nomes anatomicos', () => {
    const names = segmentParts(quadruped())
      .filter((p) => p.kind === 'perna')
      .map((p) => p.name)
      .sort();
    expect(names).toEqual([
      'perna-dianteira-direita',
      'perna-dianteira-esquerda',
      'perna-traseira-direita',
      'perna-traseira-esquerda',
    ]);
  });

  it('membro curto demais para uma junta fica com um osso so', () => {
    // corpo macico com dois toquinhos de 3 voxels
    const m: VoxelModel = {};
    for (let x = -2; x <= 2; x++)
      for (let y = -2; y <= 2; y++) for (let z = 3; z <= 7; z++) m[voxelKey(x, y, z)] = 'rock';
    for (const sx of [-3, 3]) for (let z = 4; z <= 6; z++) m[voxelKey(sx, 0, z)] = 'bone';
    const parts = segmentParts(m);
    for (const limb of parts.filter((p) => p.kind !== 'corpo' && p.kind !== 'osso')) {
      expect(chainOf(parts, limb.name).length).toBe(1);
    }
  });
});

describe('cinematica direta: pai carrega filho', () => {
  it('girar a raiz da perna leva a canela e o pe junto', () => {
    const m = spider();
    const parts = segmentParts(m);
    const leg = parts.find((p) => p.kind === 'perna')!;
    const tip = chainOf(parts, leg.name).at(-1)!;
    const posed = applyFramePose(m, parts, {
      poses: [{ part: leg.name, rotate: { axis: 'x', deg: -30 } }],
    });
    // a ponta saiu do lugar mesmo sem ter sido citada na pose
    const stillThere = tip.keys.filter((k) => k in posed).length;
    expect(stillThere).toBeLessThan(tip.keys.length);
    expect(componentCount(posed)).toBe(1);
  });

  it('girar so a canela dobra a junta sem mexer na coxa', () => {
    const m = spider();
    const parts = segmentParts(m);
    const leg = parts.find((p) => p.kind === 'perna')!;
    const chain = chainOf(parts, leg.name);
    const knee = chain[1];
    const posed = applyFramePose(m, parts, {
      poses: [{ part: knee.name, rotate: { axis: 'x', deg: 30 } }],
    });
    // a coxa (raiz) nao se mexeu: todos os voxels dela continuam onde estavam
    for (const k of leg.keys) expect(posed[k], `coxa deveria estar parada em ${k}`).toBeDefined();
    expect(componentCount(posed)).toBe(1);
  });

  it('mover o corpo carrega o bicho inteiro, sem esticar as pernas', () => {
    const m = spider();
    const parts = segmentParts(m);
    const posed = applyFramePose(m, parts, { poses: [{ part: 'corpo', move: [0, 0, 2] }] });
    // subir o corpo = subir tudo: mesma contagem de voxels, so deslocada
    expect(Object.keys(posed).length).toBe(Object.keys(m).length);
    expect(posed).toEqual(shiftModel(m, 0, 0, 2));
  });
});

describe('applyFramePose — o modelo nao se despedaca', () => {
  it('girar uma perna fina mantem o modelo INTEIRO (cura de adjacencia)', () => {
    const m = spider();
    const parts = segmentParts(m);
    for (const deg of [-45, -20, 15, 40]) {
      const posed = applyFramePose(m, parts, {
        poses: [{ part: 'perna-1', rotate: { axis: 'x', deg } }],
      });
      expect(componentCount(posed), `giro de ${deg}deg`).toBe(1);
    }
  });

  it('mover uma perna para longe nao a solta do corpo', () => {
    const m = spider();
    const parts = segmentParts(m);
    const posed = applyFramePose(m, parts, {
      poses: [{ part: 'perna-3', move: [0, -6, 2] }],
    });
    expect(componentCount(posed)).toBe(1);
  });

  it('pose com varias partes ao mesmo tempo continua conexa e sem perda', () => {
    const m = spider();
    const parts = segmentParts(m);
    const posed = applyFramePose(m, parts, {
      poses: [
        { part: 'perna-1', rotate: { axis: 'x', deg: -25 } },
        { part: 'perna-5', rotate: { axis: 'x', deg: 25 } },
        { part: 'perna-3', move: [0, -2, 1] },
        { part: 'corpo', move: [0, 0, 1] },
      ],
    });
    expect(componentCount(posed)).toBe(1);
    expect(Object.keys(posed).length).toBeGreaterThan(Object.keys(m).length * 0.95);
    expect(validatePosedFrames(m, [posed])).toEqual([]);
  });

  it('nada afunda no chao e valores exagerados sao clampados', () => {
    const m = quadruped();
    const parts = segmentParts(m);
    const posed = applyFramePose(m, parts, {
      poses: [{ part: 'corpo', move: [0, 0, -999] }],
    });
    expect(voxelModelBounds(posed)!.minZ).toBeGreaterThanOrEqual(0);
    expect(voxelModelBounds(posed)!.minZ).toBe(Math.max(0, 4 - MAX_MOVE));
  });

  it('parte desconhecida vinda da IA e ignorada sem lancar', () => {
    const m = spider();
    const parts = segmentParts(m);
    expect(applyFramePose(m, parts, { poses: [{ part: 'asa', move: [1, 1, 1] }] })).toEqual(m);
  });
});

describe('applyAnimationSpec', () => {
  it('um modelo por frame, derivado do base; faltante = pose neutra', () => {
    const m = spider();
    const parts = segmentParts(m);
    const spec: AnimationSpec = {
      frames: [{ poses: [] }, { poses: [{ part: 'perna-1', rotate: { axis: 'x', deg: -20 } }] }],
    };
    const frames = applyAnimationSpec(m, parts, spec, 4);
    expect(frames.length).toBe(4);
    expect(frames[0]).toEqual(m);
    expect(frames[1]).not.toEqual(m);
    expect(frames[2]).toEqual(m);
    expect(validatePosedFrames(m, frames)).toEqual([]);
  });

  it('e deterministico', () => {
    const m = spider();
    const parts = segmentParts(m);
    const spec: AnimationSpec = {
      frames: [{ poses: [{ part: 'corpo', rotate: { axis: 'z', deg: 15 } }] }],
    };
    expect(applyAnimationSpec(m, parts, spec, 1)).toEqual(applyAnimationSpec(m, parts, spec, 1));
  });
});

describe('validatePosedFrames', () => {
  it('acusa peca solta e perda de materia', () => {
    const m = spider();
    const broken: VoxelModel = { [voxelKey(40, 40, 0)]: 'rock' };
    const issues = validatePosedFrames(m, [broken]);
    expect(issues.some((i) => i.message.includes('materia'))).toBe(true);
  });
});

describe('resumo e preview para a IA', () => {
  it('summary cita cada parte com direcao, sem despejar voxels', () => {
    const m = spider();
    const parts = segmentParts(m);
    const text = partsSummary(parts, m);
    expect(text).toContain('perna-1');
    expect(text).toContain('frente');
    expect(text).toContain('corpo');
    // a garantia real: o resumo cresce com os OSSOS, nunca com os voxels
    expect(text.length / parts.length).toBeLessThan(150);
    expect(text.length).toBeLessThan(6000);
  });

  it('preview colore cada parte de um material distinto', () => {
    const m = spider();
    const parts = segmentParts(m);
    const preview = partsPreviewModel(parts);
    expect(Object.keys(preview).length).toBe(Object.keys(m).length);
    // corpo + 8 pernas => pelo menos 9 materiais distintos
    expect(new Set(Object.values(preview)).size).toBeGreaterThanOrEqual(9);
  });

  // o mapa de partes so serve se RENDERIZAR: o rasterizador lanca em material
  // sem rampa, e PART_COLORS ja foi preenchido com cores da paleta (fungusLight,
  // mist, amber, moss) que nao sao materiais — a tela quebrava ao abrir a folha
  it('todo material do mapa de partes tem rampa no rasterizador', () => {
    for (const mat of [...PART_COLORS, 'rock']) {
      expect(VOXEL_MATERIALS, `material do mapa de partes: ${mat}`).toContain(mat);
    }
  });

  it('o mapa de partes renderiza sem lancar', () => {
    const parts = segmentParts(spider());
    const view = renderVoxelView(partsPreviewModel(parts), 0);
    expect(view.grid.w).toBeGreaterThan(1);
    expect(view.grid.h).toBeGreaterThan(1);
  });
});
