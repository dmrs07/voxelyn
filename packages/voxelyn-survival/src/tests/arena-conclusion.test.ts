import { describe, expect, it } from 'vitest';
import { createArenaConclusionGuard } from '../client/arena-conclusion';

describe('createArenaConclusionGuard', () => {
  it('is undecided at the start', () => {
    const guard = createArenaConclusionGuard();
    expect(guard.current()).toBeNull();
  });

  it('accepts the first conclude() call', () => {
    const guard = createArenaConclusionGuard();
    expect(guard.conclude('victory')).toBe(true);
    expect(guard.current()).toBe('victory');
  });

  it("a late 'abandoned' after a victory is a no-op, not an overwrite", () => {
    const guard = createArenaConclusionGuard();
    guard.conclude('victory');
    // Simula a aba fechando (pagehide) DEPOIS de a luta ja ter sido vencida.
    const applied = guard.conclude('abandoned');
    expect(applied).toBe(false);
    expect(guard.current()).toBe('victory');
  });

  it("a late 'abandoned' after a defeat is also a no-op", () => {
    const guard = createArenaConclusionGuard();
    guard.conclude('defeat');
    expect(guard.conclude('abandoned')).toBe(false);
    expect(guard.current()).toBe('defeat');
  });

  it('a repeated identical conclude() is still a no-op after the first', () => {
    const guard = createArenaConclusionGuard();
    expect(guard.conclude('abandoned')).toBe(true);
    expect(guard.conclude('abandoned')).toBe(false);
  });
});
