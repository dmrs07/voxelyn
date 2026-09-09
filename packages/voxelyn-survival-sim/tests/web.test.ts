import { describe, expect, it } from 'vitest';
import { SOLID_NONE, SOLID_ROCK } from '../src/constants';
import { createRun } from '../src/run';
import { cutSuture } from '../src/sutures';
import {
  designWeb,
  spinWeb,
  supportHolds,
  weaveWeb,
  webAnchors,
  webArmor,
  webIntegrity,
  webRepairJobs,
  webSpeedMul,
  WEB_ARMOR,
  WEB_ARMOR_THRESHOLD,
} from '../src/web';

const center = { x: 24.5, y: 24.5 };
const fixture = () => {
  const state = createRun({ seed: 1 });
  state.solid.fill(SOLID_NONE);
  state.sutures = [];
  return state;
};

describe('Cerzideira web geometry', () => {
  it.each([1, 2, 5, 9])(
    'stops every spoke and spiral at an enclosing wall %i tiles from the center',
    (radius) => {
      const state = fixture();
      const w = state.config.width;
      const min = 24 - radius,
        max = 24 + radius;
      // A one-cell wall, with open floor on BOTH sides. Close walls also
      // truncate strands before they have enough cells to be emitted.
      for (let n = min; n <= max; n++) {
        state.solid[min * w + n] = state.solid[max * w + n] = SOLID_ROCK;
        state.solid[n * w + min] = state.solid[n * w + max] = SOLID_ROCK;
      }
      const inside = (cell: number) => {
        const x = cell % w,
          y = Math.floor(cell / w);
        return x > min && x < max && y > min && y < max;
      };

      state.tick = spinWeb(state, center, state.tick);
      weaveWeb(state, []);
      const web = state.sutures;
      // Uma sala de 3x3 ou 5x5 nao tem chao para um fio de duas celulas a
      // partir de um tile do centro; de 11x11 em diante a teia existe.
      if (radius <= 2) expect(web).toHaveLength(0);
      else expect(web.length).toBeGreaterThan(0);
      expect(web.flatMap((s) => s.cells).every(inside)).toBe(true);
      expect(web.flatMap((s) => s.slabCells).every(inside)).toBe(true);

      // Detached strands would slow players outside and create repair work
      // there. Check the gameplay consumers as well as the drawn geometry.
      for (let y = 6; y <= 42; y++)
        for (let x = 6; x <= 42; x++) {
          if (inside(y * w + x) || state.solid[y * w + x] !== SOLID_NONE) continue;
          state.player.x = x + 0.5;
          state.player.y = y + 0.5;
          expect(webSpeedMul(state, state.player)).toBe(1);
        }
      for (const strand of web) cutSuture(state, strand, [], 0);
      const jobs = webRepairJobs(state, center);
      expect(jobs).toHaveLength(web.length);
      expect(jobs.flatMap((s) => s.cells).every(inside)).toBe(true);
    },
  );

  it('a parede encerra o raio antes dela, o trecho visivel fica, e nada nasce do outro lado', () => {
    const state = fixture();
    const w = state.config.width;
    const wallX = 28;
    for (let y = 1; y < state.config.height - 1; y++) state.solid[y * w + wallX] = SOLID_ROCK;
    const web = designWeb(state, center);
    // A teia continua se prendendo em volta: oito rumos ou mais.
    expect(webAnchors(state, center).length).toBeGreaterThanOrEqual(8);
    const cells = web.flatMap((s) => s.cells);
    expect(cells.every((c) => c % w < wallX)).toBe(true);
    // Algum raio chega ate a celula encostada na parede: o trecho visivel fica.
    expect(web.some((s) => s.b % w === wallX - 1 || s.a % w === wallX - 1)).toBe(true);
    // E o lado oposto tem teia normal, longe da parede.
    expect(web.filter((s) => s.cells.every((c) => c % w <= 16)).length).toBeGreaterThan(3);
  });

  it('as juncoes sao apoios enquanto tem fio inteiro; a integridade blinda so acima do limiar', () => {
    const state = fixture();
    const w = state.config.width;
    for (let n = 4; n <= 44; n++) {
      state.solid[4 * w + n] = state.solid[44 * w + n] = SOLID_ROCK;
      state.solid[n * w + 4] = state.solid[n * w + 44] = SOLID_ROCK;
    }
    state.tick = spinWeb(state, center, state.tick);
    weaveWeb(state, []);
    const web = state.sutures;
    expect(web.length).toBeGreaterThan(30);
    expect(webIntegrity(state)).toBe(1);
    expect(webArmor(state)).toBe(WEB_ARMOR);
    const junction = web[0].b;
    expect(supportHolds(state, junction)).toBe(true);
    for (const s of web) if (s.a === junction || s.b === junction) cutSuture(state, s, [], 0);
    expect(supportHolds(state, junction)).toBe(false);
    // Corta ate abaixo de 60%: a blindagem cai.
    for (const s of web) {
      if (webIntegrity(state) < WEB_ARMOR_THRESHOLD) break;
      if (s.phase === 'taut') cutSuture(state, s, [], 0);
    }
    expect(webIntegrity(state)).toBeLessThan(WEB_ARMOR_THRESHOLD);
    expect(webArmor(state)).toBe(1);
  });
});
