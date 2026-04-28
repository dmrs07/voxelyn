import { describe, expect, it } from 'vitest';
import { DIRECTIONS, toEngineFacing } from '../sprite-atlas/direction.js';

describe('sprite atlas directions', () => {
  it('lists exactly DR DL UR UL', () => {
    expect(DIRECTIONS).toEqual(['DR', 'DL', 'UR', 'UL']);
  });

  it('maps each direction to engine-facing ids', () => {
    expect(toEngineFacing('DR')).toBe('dr');
    expect(toEngineFacing('DL')).toBe('dl');
    expect(toEngineFacing('UR')).toBe('ur');
    expect(toEngineFacing('UL')).toBe('ul');
  });
});
