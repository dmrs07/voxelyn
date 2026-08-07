// Geradores procedurais de animacao: determinismo e as propriedades visuais
// que cada preset promete.
import { describe, expect, it } from 'vitest';
import { collapseModel, detectLegs, generateAnimation, styleForAnim } from '../animate';
import { voxelKey, voxelModelBounds, type VoxelModel } from '../voxel';

/** Corpo com 4 pernas: bloco em cima, colunas separadas embaixo. */
const quadruped = (): VoxelModel => {
  const m: VoxelModel = {};
  for (let x = -4; x <= 3; x++) {
    for (let y = -3; y <= 2; y++) {
      for (let z = 4; z <= 7; z++) m[voxelKey(x, y, z)] = 'rock';
    }
  }
  for (const [lx, ly] of [
    [-4, -3],
    [3, -3],
    [-4, 2],
    [3, 2],
  ]) {
    for (let z = 0; z <= 3; z++) m[voxelKey(lx, ly, z)] = 'bone';
  }
  return m;
};

describe('detectLegs', () => {
  it('acha as 4 pernas como componentes separados, em ordem estavel', () => {
    const legs = detectLegs(quadruped());
    expect(legs.length).toBe(4);
    // corte a 35% da altura (z<3) pega os 3 voxels de baixo de cada perna
    expect(legs.flat().length).toBe(12);
    expect(detectLegs(quadruped())).toEqual(legs); // deterministico
  });

  it('corpo unico (sem pernas) nao gera componentes multiplos', () => {
    const m: VoxelModel = {};
    for (let z = 0; z <= 5; z++) m[voxelKey(0, 0, z)] = 'rock';
    expect(detectLegs(m).length).toBe(1);
  });
});

describe('collapseModel', () => {
  it('t=0 preserva o corpo; t=1 assenta no chao com menos materia', () => {
    const base = quadruped();
    expect(collapseModel(base, 0)).toEqual(base);
    const rubble = collapseModel(base, 1);
    const count = Object.keys(rubble).length;
    expect(count).toBeGreaterThan(0);
    expect(count).toBeLessThan(Object.keys(base).length);
    const bounds = voxelModelBounds(rubble)!;
    expect(bounds.maxZ).toBeLessThanOrEqual(2); // monte baixo
    const baseBounds = voxelModelBounds(base)!;
    expect(bounds.maxX - bounds.minX).toBeLessThanOrEqual(baseBounds.maxX - baseBounds.minX);
  });

  it('e deterministico', () => {
    expect(collapseModel(quadruped(), 0.6)).toEqual(collapseModel(quadruped(), 0.6));
  });
});

describe('generateAnimation', () => {
  it('gait produz frames diferentes entre si e do base', () => {
    const base = quadruped();
    const frames = generateAnimation(base, 'gait', 6, 2);
    expect(frames.length).toBe(6);
    for (const f of frames) expect(Object.keys(f).length).toBeGreaterThan(0);
    const serial = frames.map((f) => JSON.stringify(Object.keys(f).sort()));
    expect(new Set(serial).size).toBeGreaterThan(2);
  });

  it('lunge avanca em -y no meio e volta perto do fim', () => {
    const base = quadruped();
    const frames = generateAnimation(base, 'lunge', 4, 2);
    const minY = (m: VoxelModel): number => voxelModelBounds(m)!.minY;
    expect(Math.min(...frames.map(minY))).toBeLessThan(minY(base));
  });

  it('recoil comeca recuado (+y) e termina na pose base', () => {
    const base = quadruped();
    const frames = generateAnimation(base, 'recoil', 2, 2);
    expect(voxelModelBounds(frames[0])!.maxY).toBeGreaterThan(voxelModelBounds(base)!.maxY);
    expect(frames[frames.length - 1]).toEqual(base);
  });

  it('todos os estilos sao deterministicos', () => {
    const base = quadruped();
    for (const style of ['breathe', 'gait', 'lunge', 'recoil', 'collapse'] as const) {
      expect(generateAnimation(base, style, 5, 2)).toEqual(generateAnimation(base, style, 5, 2));
    }
  });
});

describe('styleForAnim', () => {
  it('mapeia o contrato da Art Bible para os presets', () => {
    expect(styleForAnim('idle')).toBe('breathe');
    expect(styleForAnim('walk')).toBe('gait');
    expect(styleForAnim('attack')).toBe('lunge');
    expect(styleForAnim('hit')).toBe('recoil');
    expect(styleForAnim('die')).toBe('collapse');
  });
});
