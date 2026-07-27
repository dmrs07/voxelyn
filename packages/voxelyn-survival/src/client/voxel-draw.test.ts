import { describe, expect, it } from 'vitest';
import { gasPuffLobes, isGasRamp, type FaceRamp } from './voxel-draw';

const GAS: FaceRamp = ['#ffd166', '#a8e63c', '#1f3d33'];
const SPORE: FaceRamp = ['#66c28a', '#2f6b4f', '#1f3d33'];

describe('gas particle rendering', () => {
  it('aplica o puff somente ao gas, nunca ao esporo', () => {
    expect(isGasRamp(GAS)).toBe(true);
    expect(isGasRamp(SPORE)).toBe(false);
  });

  it('transforma um mote em tres lobulos com volume e vazio interno', () => {
    const lobes = gasPuffLobes(100, 80, 8, 0.72);

    expect(lobes).toHaveLength(3);
    expect(new Set(lobes.map((lobe) => `${lobe.x},${lobe.y}`)).size).toBe(3);
    expect(lobes.some((lobe) => lobe.y < 80)).toBe(true);
    expect(lobes.every((lobe) => lobe.size > 0 && lobe.alpha > 0)).toBe(true);
  });

  it('abre enquanto sobe e perde opacidade ao dissipar', () => {
    const young = gasPuffLobes(100, 80, 8, 1);
    const middle = gasPuffLobes(100, 80, 8, 0.7);
    const late = gasPuffLobes(100, 80, 8, 0.4);

    expect(middle[0].size).toBeGreaterThan(young[0].size);
    expect(late[0].size).toBeGreaterThan(middle[0].size);
    expect(middle[0].alpha).toBeGreaterThan(young[0].alpha);
    expect(late[0].alpha).toBeLessThan(middle[0].alpha);
  });

  it('mantem a forma deterministica para a mesma posicao', () => {
    expect(gasPuffLobes(23, 41, 6, 0.65)).toEqual(gasPuffLobes(23, 41, 6, 0.65));
  });

  it('alterna a abertura lateral entre motes vizinhos sem usar aleatoriedade', () => {
    const left = gasPuffLobes(22, 41, 6, 0.65);
    const right = gasPuffLobes(23, 41, 6, 0.65);
    const leftDirection = Math.sign(left[1].x - left[0].x);
    const rightDirection = Math.sign(right[1].x - right[0].x);

    expect(leftDirection).not.toBe(0);
    expect(rightDirection).toBe(-leftDirection);
  });
});
