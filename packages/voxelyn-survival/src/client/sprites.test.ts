import { describe, expect, it } from 'vitest';
import { deriveAnim } from './sprites';

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
});
