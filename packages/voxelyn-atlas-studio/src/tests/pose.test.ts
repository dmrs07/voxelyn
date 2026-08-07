// Motor de poses por partes: segmentacao, transformacoes com pivo e a
// aplicacao de specs vindos da IA (incluindo specs malformados/exagerados).
import { describe, expect, it } from 'vitest';
import {
  applyAnimationSpec,
  applyFramePose,
  segmentParts,
  MAX_MOVE,
  type AnimationSpec,
} from '../pose';
import { voxelKey, voxelModelBounds, type VoxelModel } from '../voxel';

/** Corpo 6x4x3 sobre 4 pernas-coluna de 4 voxels. */
const quadruped = (): VoxelModel => {
  const m: VoxelModel = {};
  for (let x = -3; x <= 2; x++) {
    for (let y = -2; y <= 1; y++) {
      for (let z = 4; z <= 6; z++) m[voxelKey(x, y, z)] = 'rock';
    }
  }
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
  it('nomeia pernas e corpo, com pivo do quadril no topo da perna', () => {
    const parts = segmentParts(quadruped());
    const legs = parts.filter((p) => p.name.startsWith('perna'));
    const body = parts.find((p) => p.name === 'corpo');
    expect(legs.length).toBe(4);
    expect(body).toBeDefined();
    for (const leg of legs) {
      expect(leg.pivot[2]).toBe(leg.bounds.maxZ); // pivo no topo (quadril)
    }
    // estavel entre chamadas
    expect(segmentParts(quadruped()).map((p) => p.name)).toEqual(parts.map((p) => p.name));
  });

  it('ignora componentes minusculos (ruido)', () => {
    const m = quadruped();
    m[voxelKey(10, 10, 0)] = 'rock'; // voxel solto
    const parts = segmentParts(m);
    expect(parts.filter((p) => p.name.startsWith('perna')).length).toBe(4);
  });
});

describe('applyFramePose', () => {
  it('move so a parte citada e preserva materia', () => {
    const base = quadruped();
    const parts = segmentParts(base);
    const leg = parts.find((p) => p.name === 'perna-1')!;
    const posed = applyFramePose(base, parts, {
      poses: [{ part: 'perna-1', move: [0, -2, 0] }],
    });
    expect(Object.keys(posed).length).toBe(Object.keys(base).length);
    // a perna andou -2 em y
    const oldBounds = leg.bounds;
    let minY = Infinity;
    for (const key of Object.keys(posed)) {
      const [x, y] = key.split(',').map(Number);
      if (x === oldBounds.minX) minY = Math.min(minY, y);
    }
    expect(minY).toBe(oldBounds.minY - 2);
  });

  it('rotacao no pivo mantem o topo da perna ancorado', () => {
    const base = quadruped();
    const parts = segmentParts(base);
    const leg = parts.find((p) => p.name === 'perna-1')!;
    const posed = applyFramePose(base, parts, {
      poses: [{ part: 'perna-1', rotate: { axis: 'x', deg: -45 } }],
    });
    // o voxel do pivo (topo) nao sai do lugar
    const pivotKey = voxelKey(
      Math.round(leg.pivot[0]),
      Math.round(leg.pivot[1]),
      Math.round(leg.pivot[2]),
    );
    expect(posed[pivotKey]).toBeDefined();
    // a ponta (z=0) balancou para frente (-y) e subiu
    const bounds = voxelModelBounds(posed)!;
    expect(bounds.minY).toBeLessThan(-2);
  });

  it('nada afunda no chao e valores exagerados sao clampados', () => {
    const base = quadruped();
    const parts = segmentParts(base);
    const posed = applyFramePose(base, parts, {
      poses: [{ part: 'corpo', move: [0, 0, -999] }],
    });
    const bounds = voxelModelBounds(posed)!;
    expect(bounds.minZ).toBeGreaterThanOrEqual(0);
    // clamp: o corpo desceu no maximo MAX_MOVE (de z=4 para z>=4-MAX_MOVE, piso 0)
    expect(bounds.minZ).toBe(Math.max(0, 4 - MAX_MOVE));
  });

  it('parte desconhecida e ignorada sem lancar', () => {
    const base = quadruped();
    const parts = segmentParts(base);
    const posed = applyFramePose(base, parts, {
      poses: [{ part: 'asa-esquerda', move: [1, 1, 1] }],
    });
    expect(posed).toEqual(base);
  });
});

describe('applyAnimationSpec', () => {
  it('um modelo por frame, sempre derivado do base; frames faltantes = neutro', () => {
    const base = quadruped();
    const parts = segmentParts(base);
    const spec: AnimationSpec = {
      frames: [{ poses: [] }, { poses: [{ part: 'perna-1', move: [0, -1, 1] }] }],
    };
    const frames = applyAnimationSpec(base, parts, spec, 4);
    expect(frames.length).toBe(4);
    expect(frames[0]).toEqual(base);
    expect(frames[1]).not.toEqual(base);
    expect(frames[2]).toEqual(base); // faltante → neutro
    expect(frames[3]).toEqual(base);
  });

  it('e deterministico', () => {
    const base = quadruped();
    const parts = segmentParts(base);
    const spec: AnimationSpec = {
      frames: [{ poses: [{ part: 'corpo', rotate: { axis: 'z', deg: 15 } }] }],
    };
    expect(applyAnimationSpec(base, parts, spec, 1)).toEqual(
      applyAnimationSpec(base, parts, spec, 1),
    );
  });
});
