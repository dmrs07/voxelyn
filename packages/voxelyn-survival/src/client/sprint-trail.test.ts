import { describe, expect, it } from 'vitest';
import { SPRINT_STREAKS, sprintStreaks } from './sprint-trail';

describe('rastro da Disparada', () => {
  it('sai atras do corpo, na direcao oposta ao rumo, e nunca com rumo nulo', () => {
    const east = sprintStreaks(1, 0, 0);
    expect(east).toHaveLength(SPRINT_STREAKS);
    for (const s of east) {
      expect(s.x0).toBeLessThan(0);
      expect(s.x1).toBeLessThan(s.x0);
      expect(s.alpha).toBeGreaterThan(0);
      expect(s.alpha).toBeLessThanOrEqual(1);
    }
    const north = sprintStreaks(0, -1, 0);
    for (const s of north) expect(s.y1).toBeGreaterThan(s.y0);
    expect(sprintStreaks(0, 0, 0)).toEqual([]);
  });
  it('escalona os riscos lado a lado e tremula com o tempo', () => {
    const a = sprintStreaks(1, 0, 0);
    const ys = a.map((s) => s.y0);
    expect(new Set(ys.map((v) => v.toFixed(3))).size).toBe(SPRINT_STREAKS);
    const b = sprintStreaks(1, 0, 40);
    expect(a.map((s) => s.x1)).not.toEqual(b.map((s) => s.x1));
  });
});
