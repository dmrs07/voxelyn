import { it } from 'vitest';
import { generateWorld, floodWalkable } from '../src/worldgen';
import { biomeProfile } from '../src/strata';
import { SOLID_NONE, SURF_WATER, SURF_DEEP_WATER, WORLD_W, WORLD_H } from '../src/constants';
it('sweep', () => {
  const biome = {
    stratum: 'aquifer' as const,
    occupation: 'none' as const,
    lineage: 'hydric' as const,
  };
  const N = Number(process.env.SWEEP_N ?? 100);
  const sectors = [2, 4, 7];
  const rows: any[] = [];
  let fails = 0,
    worst = 0,
    worstSeed = -1;
  const sizes: number[] = [];
  for (const sector of sectors) {
    const profile = biomeProfile(biome, sector);
    for (let seed = 1; seed <= N; seed++) {
      const w = generateWorld(seed * 7919 + sector, WORLD_W, WORLD_H, profile);
      const W = WORLD_W,
        H = WORLD_H;
      let open = 0,
        shallow = 0,
        deep = 0;
      for (let i = 0; i < w.solid.length; i++) {
        if (w.solid[i] !== SOLID_NONE) continue;
        open++;
        if (w.surface[i] === SURF_WATER) shallow++;
        else if (w.surface[i] === SURF_DEEP_WATER) deep++;
      }
      // components of deep
      const seen = new Set<number>();
      let comps = 0;
      for (let i = 0; i < w.surface.length; i++) {
        if (w.surface[i] !== SURF_DEEP_WATER || seen.has(i)) continue;
        comps++;
        const q = [i];
        seen.add(i);
        let size = 0;
        while (q.length) {
          const c = q.pop()!;
          size++;
          const x = c % W,
            y = (c - x) / W;
          for (const [dx, dy] of [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1],
          ]) {
            const nx = x + dx,
              ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
            const n = ny * W + nx;
            if (seen.has(n) || w.surface[n] !== SURF_DEEP_WATER) continue;
            seen.add(n);
            q.push(n);
          }
        }
        sizes.push(size);
        // rim check: no deep 4-adjacent to dry open floor
      }
      let badRim = 0;
      for (let i = 0; i < w.surface.length; i++) {
        if (w.surface[i] !== SURF_DEEP_WATER) continue;
        const x = i % W,
          y = (i - x) / W;
        for (const [dx, dy] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ]) {
          const n = (y + dy) * W + (x + dx);
          if (
            w.solid[n] === SOLID_NONE &&
            w.surface[n] !== SURF_WATER &&
            w.surface[n] !== SURF_DEEP_WATER
          )
            badRim++;
        }
      }
      const walk = floodWalkable(w.solid, w.surface, W, H, w.entry.x, w.entry.y);
      const targets = [
        w.corePos,
        w.guardianSpawn,
        ...w.salvageSites.map((s) => s.terminal),
        ...w.salvageSites.map((s) => s.cache),
        ...w.enemySpawns,
        ...w.ventPositions,
      ];
      const unreachable = targets.filter((t) => !walk.has(t.y * W + t.x)).length;
      // worst mandatory route: BFS distance entry->core over walkable
      const dist = new Map<number, number>();
      const q = [w.entry.y * W + w.entry.x];
      dist.set(q[0], 0);
      for (let h = 0; h < q.length; h++) {
        const c = q[h];
        const x = c % W,
          y = (c - x) / W;
        for (const [dx, dy] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ]) {
          const nx = x + dx,
            ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          const n = ny * W + nx;
          if (dist.has(n) || !walk.has(n)) continue;
          dist.set(n, dist.get(c)! + 1);
          q.push(n);
        }
      }
      const route = dist.get(w.corePos.y * W + w.corePos.x) ?? -1;
      if (unreachable > 0 || badRim > 0) fails++;
      if (route > worst) {
        worst = route;
        worstSeed = seed;
      }
      rows.push({ sector, seed, open, shallow, deep, comps, unreachable, badRim, route });
    }
  }
  const avg = (k: string) => (rows.reduce((a, r) => a + r[k], 0) / rows.length).toFixed(2);
  console.log(
    JSON.stringify(
      {
        maps: rows.length,
        fails,
        shallowFrac:
          ((rows.reduce((a, r) => a + r.shallow / r.open, 0) / rows.length) * 100).toFixed(2) + '%',
        deepFrac:
          ((rows.reduce((a, r) => a + r.deep / r.open, 0) / rows.length) * 100).toFixed(2) + '%',
        compsAvg: avg('comps'),
        compsMin: Math.min(...rows.map((r) => r.comps)),
        compsMax: Math.max(...rows.map((r) => r.comps)),
        sizeMin: Math.min(...sizes),
        sizeAvg: (sizes.reduce((a, b) => a + b, 0) / sizes.length).toFixed(1),
        sizeMax: Math.max(...sizes),
        badRim: rows.filter((r) => r.badRim > 0).length,
        unreachableMaps: rows.filter((r) => r.unreachable > 0).length,
        worstRoute: worst,
        worstSeed,
        routeAvg: avg('route'),
      },
      null,
      1,
    ),
  );
}, 600000);
