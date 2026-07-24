import { describe, expect, it } from 'vitest';
// Mesmo specifier usado pelo cliente (resolvido pelo alias do vite para o pacote extraido)
import { createRun, emptyCommand, hashAuthoritativeState, stepRun } from '@voxelyn/survival-sim';

describe('cliente usa a mesma simulacao extraida', () => {
  it('o pacote @voxelyn/survival-sim resolve e roda em Node sem DOM', () => {
    expect(typeof window).toBe('undefined'); // ambiente Node puro
    const state = createRun({ seed: 424242 });
    for (let t = 0; t < 60; t++) stepRun(state, [emptyCommand()]);
    expect(state.tick).toBe(60);
    expect(hashAuthoritativeState(state)).toMatch(/^[0-9a-f]{8}$/);
  });
});
