import { describe, expect, it } from 'vitest';
import { gasPuffLobes, isGasRamp, type FaceRamp } from './voxel-draw';

const GAS: FaceRamp = ['#ffd166', '#a8e63c', '#1f3d33'];
const SPORE: FaceRamp = ['#66c28a', '#2f6b4f', '#1f3d33'];

const orientationOf = (lobes: ReturnType<typeof gasPuffLobes>): number =>
  Math.sign(lobes[1].x - lobes[0].x);

describe('gas particle rendering', () => {
  it('aplica o puff somente ao gas, nunca ao esporo', () => {
    expect(isGasRamp(GAS)).toBe(true);
    expect(isGasRamp(SPORE)).toBe(false);
  });

  it('transforma um mote em tres lobulos com volume e vazio interno', () => {
    const lobes = gasPuffLobes(100, 80, 8, 0.72, 17);

    expect(lobes).toHaveLength(3);
    expect(new Set(lobes.map((lobe) => `${lobe.x},${lobe.y}`)).size).toBe(3);
    expect(lobes.some((lobe) => lobe.y < 80)).toBe(true);
    expect(lobes.every((lobe) => lobe.size > 0 && lobe.alpha > 0)).toBe(true);
  });

  it('abre enquanto sobe e perde opacidade ao dissipar', () => {
    const young = gasPuffLobes(100, 80, 8, 1, 17);
    const middle = gasPuffLobes(100, 80, 8, 0.7, 17);
    const late = gasPuffLobes(100, 80, 8, 0.4, 17);

    expect(middle[0].size).toBeGreaterThan(young[0].size);
    expect(late[0].size).toBeGreaterThan(middle[0].size);
    expect(middle[0].alpha).toBeGreaterThan(young[0].alpha);
    expect(late[0].alpha).toBeLessThan(middle[0].alpha);
  });

  it('mantem a forma deterministica para a mesma identidade', () => {
    expect(gasPuffLobes(23, 41, 6, 0.65, 91)).toEqual(gasPuffLobes(23, 41, 6, 0.65, 91));
  });

  it('nao espelha quando o mote ou a camera mudam sua posicao em tela', () => {
    const seed = 91;
    const before = gasPuffLobes(23, 41, 6, 0.65, seed);
    const after = gasPuffLobes(84, 7, 6, 0.65, seed);

    expect(orientationOf(before)).not.toBe(0);
    expect(orientationOf(after)).toBe(orientationOf(before));
  });

  it('ainda varia a abertura entre identidades diferentes', () => {
    const left = gasPuffLobes(23, 41, 6, 0.65, 90);
    const right = gasPuffLobes(23, 41, 6, 0.65, 91);

    expect(orientationOf(right)).toBe(-orientationOf(left));
  });
});
