import { describe, expect, it } from 'vitest';
import { PROP_KINDS, descentPlatformState, propModel } from './props.mjs';

const descent = PROP_KINDS.find((kind) => kind.name === 'descent');

describe('modelo voxel do transporte de descida', () => {
  it('tem seis quadros geometricamente distintos', () => {
    expect(descent).toBeDefined();
    const signatures = [];
    for (let frame = 0; frame < descent.frames; frame++) {
      const model = propModel('descent', frame);
      expect(model.length).toBeGreaterThan(0);
      signatures.push(JSON.stringify(model));
    }
    expect(new Set(signatures).size).toBe(descent.frames);
  });

  it('mantem uma boca escura e larga em todos os quadros', () => {
    for (let frame = 0; frame < descent.frames; frame++) {
      const model = propModel('descent', frame);
      expect(model.some((part) =>
        part.x === -2 && part.y === -2 && part.z === 0 &&
        part.w === 5 && part.d === 5 && part.mat === 'rockDeep'
      )).toBe(true);
    }
  });

  it('baixa e encolhe a plataforma ao longo do ciclo', () => {
    const states = Array.from({ length: descent.frames }, (_, frame) => descentPlatformState(frame));
    for (let frame = 1; frame < states.length; frame++) {
      expect(states[frame].z).toBeLessThanOrEqual(states[frame - 1].z);
      expect(states[frame].radius).toBeLessThanOrEqual(states[frame - 1].radius);
    }
    expect(states[0].z).toBeGreaterThan(states.at(-1).z);
    expect(states[0].radius).toBeGreaterThan(states.at(-1).radius);
  });

  it('fica baixo para nao competir com o monumento do Nucleo', () => {
    const maxDescentZ = Math.max(...Array.from(
      { length: descent.frames },
      (_, frame) => Math.max(...propModel('descent', frame).map((part) => part.z + part.h - 1)),
    ));
    const maxCoreZ = Math.max(...propModel('core', 0).map((part) => part.z + part.h - 1));
    expect(maxDescentZ).toBeLessThan(maxCoreZ);
    expect(maxDescentZ).toBeLessThanOrEqual(7);
  });
});
