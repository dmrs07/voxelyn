import { describe, expect, it } from 'vitest';
import { DIRS8_BY_ANGLE, dirFromFacing, dirFromFacing8 } from '../src/manifest';

// Os oito rumos de uma PECA: os quatro quadrantes de `dirFromFacing` mais a
// horizontal e a vertical da tela. O contrato que importa e que os quatro
// quadros compartilhados continuem sendo os mesmos no centro de cada quadrante
// — e que as diagonais do mundo, que antes caiam no fio de uma fronteira,
// ganhem quadro proprio.
describe('dirFromFacing8', () => {
  it('concorda com dirFromFacing no centro de cada quadrante', () => {
    // Os eixos do mundo sao o centro dos quadrantes autorados.
    expect(dirFromFacing8(1, 0)).toBe('dr');
    expect(dirFromFacing8(0, 1)).toBe('dl');
    expect(dirFromFacing8(-1, 0)).toBe('ul');
    expect(dirFromFacing8(0, -1)).toBe('ur');
    for (const [x, y] of [
      [1, 0],
      [0, 1],
      [-1, 0],
      [0, -1],
    ]) {
      expect(dirFromFacing8(x, y)).toBe(dirFromFacing(x, y));
    }
  });

  it('da quadro proprio a horizontal e a vertical da tela', () => {
    expect(dirFromFacing8(1, -1)).toBe('r');
    expect(dirFromFacing8(1, 1)).toBe('d');
    expect(dirFromFacing8(-1, 1)).toBe('l');
    expect(dirFromFacing8(-1, -1)).toBe('u');
  });

  it('percorre os oito setores em ordem de angulo, com 45 graus cada', () => {
    const seen: string[] = [];
    for (let i = 0; i < 8; i++) {
      const angle = (i * Math.PI) / 4;
      // Do angulo de TELA de volta ao vetor de mundo: sdx = fx - fy, sdy = fx + fy.
      const sdx = Math.cos(angle);
      const sdy = Math.sin(angle);
      const fx = (sdx + sdy) / 2;
      const fy = (sdy - sdx) / 2;
      seen.push(dirFromFacing8(fx, fy));
      // Um pouco antes e um pouco depois do centro ainda e o mesmo setor.
      for (const off of [-0.35, 0.35]) {
        const a = angle + off;
        const sx = Math.cos(a);
        const sy = Math.sin(a);
        expect(dirFromFacing8((sx + sy) / 2, (sy - sx) / 2)).toBe(seen[i]);
      }
    }
    expect(seen).toEqual([...DIRS8_BY_ANGLE]);
  });
});
