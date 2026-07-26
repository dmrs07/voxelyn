import { describe, expect, it } from 'vitest';
import { deriveAnim, recoilScreenOffset } from './sprites';

describe('deriveAnim', () => {
  it('mantem walk entre ticks sem reiniciar o ciclo em frames intermediarios', () => {
    let state = deriveAnim(undefined, 0, 0, 100, true, 0);
    expect(state.anim).toBe('idle');

    state = deriveAnim(state, 0.05, 0, 100, true, 16);
    expect(state.anim).toBe('walk');
    const walkStartedAt = state.animStartMs;

    // Render seguinte antes de um novo tick: posicao igual, mas a caminhada nao
    // pode voltar para idle nem reiniciar o elapsedMs no primeiro frame.
    state = deriveAnim(state, 0.05, 0, 100, true, 32);
    expect(state.anim).toBe('walk');
    expect(state.animStartMs).toBe(walkStartedAt);

    state = deriveAnim(state, 0.05, 0, 100, true, 100);
    expect(state.anim).toBe('walk');
    expect(state.animStartMs).toBe(walkStartedAt);

    // Depois da janela sem qualquer deslocamento, idle volta normalmente.
    state = deriveAnim(state, 0.05, 0, 100, true, 137);
    expect(state.anim).toBe('idle');
  });

  it('renova a janela enquanto novos ticks continuam deslocando a entidade', () => {
    let state = deriveAnim(undefined, 0, 0, 100, true, 0);
    state = deriveAnim(state, 0.05, 0, 100, true, 16);
    const walkStartedAt = state.animStartMs;

    state = deriveAnim(state, 0.1, 0, 100, true, 100);
    state = deriveAnim(state, 0.1, 0, 100, true, 180);

    expect(state.anim).toBe('walk');
    expect(state.animStartMs).toBe(walkStartedAt);
  });

  it('preserva a direcao real das pernas durante a janela de movimento', () => {
    let state = deriveAnim(undefined, 1, 1, 100, true, 0);
    state = deriveAnim(state, 1.03, 1.04, 100, true, 16);

    expect(state.moveFacingX).toBeCloseTo(0.6, 5);
    expect(state.moveFacingY).toBeCloseTo(0.8, 5);

    state = deriveAnim(state, 1.03, 1.04, 100, true, 80);
    expect(state.anim).toBe('walk');
    expect(state.moveFacingX).toBeCloseTo(0.6, 5);
    expect(state.moveFacingY).toBeCloseTo(0.8, 5);
  });
});

describe('recoilScreenOffset', () => {
  it('empurra o tronco na direcao oposta a mira isometrica', () => {
    const right = recoilScreenOffset(1, 0, 1, 2);
    expect(right.x).toBeLessThan(0);
    expect(right.y).toBeLessThan(0);

    const left = recoilScreenOffset(-1, 0, 1, 2);
    expect(left.x).toBeGreaterThan(0);
    expect(left.y).toBeGreaterThan(0);
  });

  it('limita a intensidade normalizada', () => {
    expect(recoilScreenOffset(1, 0, -1, 2)).toEqual({ x: -0, y: -0 });
    expect(recoilScreenOffset(1, 0, 2, 2)).toEqual(recoilScreenOffset(1, 0, 1, 2));
  });
});
