import { readFileSync, writeFileSync } from 'node:fs';

const replaceOnce = (file, before, after) => {
  const source = readFileSync(file, 'utf8');
  const first = source.indexOf(before);
  const last = source.lastIndexOf(before);
  if (first < 0 || first !== last) {
    throw new Error(`${file}: expected exactly one match, found ${first < 0 ? 0 : 'multiple'}`);
  }
  writeFileSync(file, source.slice(0, first) + after + source.slice(first + before.length));
};

const insertBefore = (file, marker, addition) => {
  replaceOnce(file, marker, `${addition}${marker}`);
};

// ---------------------------------------------------------------------------
// Simulation integration: hazards and player cleansing.
// ---------------------------------------------------------------------------
const run = 'packages/voxelyn-survival-sim/src/run.ts';
replaceOnce(run,
`  GAS_DAMAGE_PER_TICK,
  HEAT_DECAY_PER_TICK,`,
`  GAS_DAMAGE_PER_TICK,
  SPORE_DAMAGE_PER_TICK,
  HEAT_DECAY_PER_TICK,`);
replaceOnce(run,
`  SURF_FIRE,
  SURF_GAS,
  SURF_NONE,`,
`  SURF_FIRE,
  SURF_GAS,
  SURF_NONE,
  SURF_SPORES,`);
replaceOnce(run,
`    } else if (surf === SURF_GAS && ent.kind === 'player') {
      // esporos afetam o prospector (criaturas do Veio sao imunes)
      damageEntity(state, ent, GAS_DAMAGE_PER_TICK, events);
    }`,
`    } else if (surf === SURF_GAS && ent.kind === 'player') {
      // Gas sulfuroso e toxico; criaturas do Veio sao imunes ao proprio ambiente.
      damageEntity(state, ent, GAS_DAMAGE_PER_TICK, events);
    } else if (surf === SURF_SPORES && ent.kind === 'player') {
      // Esporos do bomber sao organicos e irritantes, mas nao volateis/explosivos.
      damageEntity(state, ent, SPORE_DAMAGE_PER_TICK, events);
    }`);
replaceOnce(run,
`        if (state.surface[i] === SURF_FIRE || state.surface[i] === SURF_GAS) {`,
`        if (state.surface[i] === SURF_FIRE || state.surface[i] === SURF_GAS || state.surface[i] === SURF_SPORES) {`);
replaceOnce(run,
`        if (state.surface[i] === SURF_GAS) setSurface(state, i, SURF_NONE, 0);`,
`        if (state.surface[i] === SURF_GAS || state.surface[i] === SURF_SPORES) {
          setSurface(state, i, SURF_NONE, 0);
        }`);

// ---------------------------------------------------------------------------
// Client surface mapping and ambient emissions.
// ---------------------------------------------------------------------------
const render = 'packages/voxelyn-survival/src/client/render.ts';
replaceOnce(render,
`  SURF_FIRE,
  SURF_FUNGAL,
  SURF_GAS,
  SURF_NONE,
  SURF_SCORCHED,`,
`  SURF_FIRE,
  SURF_FUNGAL,
  SURF_FUNGAL_HEATED,
  SURF_GAS,
  SURF_NONE,
  SURF_SCORCHED,
  SURF_SPORES,`);
replaceOnce(render,
`  [SURF_FIRE]: 4,
  [SURF_SCORCHED]: 5,
};`,
`  [SURF_FIRE]: 4,
  [SURF_SCORCHED]: 5,
  [SURF_SPORES]: 6,
  [SURF_FUNGAL_HEATED]: 7,
};`);
replaceOnce(render,
`  [SURF_FIRE]: '#ff7a2f',
  [SURF_SCORCHED]: '#0b0e14',
};`,
`  [SURF_FIRE]: '#ff7a2f',
  [SURF_SCORCHED]: '#0b0e14',
  [SURF_SPORES]: '#66c28a',
  [SURF_FUNGAL_HEATED]: '#6e4a33',
};`);
replaceOnce(render,
`        if (surf === SURF_GAS) {
          // A crosta no chao diz ONDE o gas esta; os motes subindo dizem que ele
          // esta VIVO e para onde vai. Sem eles o gas era so uma textura.
          this.particles.emitGas(x + 0.5, y + 0.5, nowMs, this.quality.maxFx / PRESETS.high.maxFx);
        }`,
`        const ambientScale = this.quality.maxFx / PRESETS.high.maxFx;
        if (surf === SURF_GAS) {
          // Gas sulfurico: sopros amarelos que abrem enquanto sobem.
          this.particles.emitGas(x + 0.5, y + 0.5, nowMs, ambientScale);
        } else if (surf === SURF_SPORES) {
          // Esporos: graos verdes com deriva lateral, sem a silhueta de puff do gas.
          this.particles.emitSpores(x + 0.5, y + 0.5, nowMs, ambientScale);
        } else if (surf === SURF_FUNGAL_HEATED) {
          // Aviso da secagem: pouca fumaca escura antes de surgir qualquer chama.
          this.particles.emitFungalSmoke(x + 0.5, y + 0.5, nowMs, ambientScale);
        }`);

// ---------------------------------------------------------------------------
// Runtime particles: spores and damp-fungus smoke are independent from gas.
// ---------------------------------------------------------------------------
const particles = 'packages/voxelyn-survival/src/client/particles.ts';
replaceOnce(particles,
`  | 'gas'
  | 'debris'`,
`  | 'gas'
  | 'sporeCloud'
  | 'debris'`);
replaceOnce(particles,
`  gas: ['#ffd166', '#a8e63c', '#1f3d33'],
  debris:`,
`  gas: ['#ffd166', '#a8e63c', '#1f3d33'],
  // Nuvem organica: compartilha a familia do fungo, nunca a rampa sulfurica.
  sporeCloud: ['#66c28a', '#2f6b4f', '#1f3d33'],
  debris:`);
replaceOnce(particles,
`  private readonly lastGasBucket = new Map<number, number>();
  /** Teto vindo do preset de qualidade; mobile no minimo nao aguenta o de cima. */`,
`  private readonly lastGasBucket = new Map<number, number>();
  private readonly lastSporeBucket = new Map<number, number>();
  private readonly lastFungalSmokeBucket = new Map<number, number>();
  /** Teto vindo do preset de qualidade; mobile no minimo nao aguenta o de cima. */`);
replaceOnce(particles,
`    this.items.length = 0;
    this.lastGasBucket.clear();`,
`    this.items.length = 0;
    this.lastGasBucket.clear();
    this.lastSporeBucket.clear();
    this.lastFungalSmokeBucket.clear();`);
insertBefore(particles,
`  step(dtMs: number): void {`,
`  /** Esporos organicos: deriva mais larga, subida baixa e vida mais longa. */
  emitSpores(x: number, y: number, nowMs: number, scale: number): void {
    const phase = (Math.imul(x | 0, 12582917) ^ Math.imul(y | 0, 4256249)) >>> 0;
    const bucket = (nowMs / 260) | 0;
    const every = Math.max(1, Math.round(3 / scale));
    if (bucket % every !== phase % every) return;
    const cell = ((x | 0) << 16) | (y | 0);
    if (this.lastSporeBucket.get(cell) === bucket) return;
    this.lastSporeBucket.set(cell, bucket);

    const rnd = seeded(eventSeed(x, y, phase ^ Math.imul(bucket, 1597334677)));
    this.push({
      x: x + rnd() * 0.95 - 0.475,
      y: y + rnd() * 0.95 - 0.475,
      z: 0.12 + rnd() * 0.18,
      vx: (rnd() - 0.5) * 0.24,
      vy: (rnd() - 0.5) * 0.24,
      vz: 0.22 + rnd() * 0.22,
      life: 1250,
      maxLife: 1250,
      kind: 'sporeCloud',
    });
  }

  /** Fungo aquecido: fumaca rara e baixa, nunca chama antes do timer autoritativo. */
  emitFungalSmoke(x: number, y: number, nowMs: number, scale: number): void {
    const phase = (Math.imul(x | 0, 19349663) ^ Math.imul(y | 0, 83492791)) >>> 0;
    const bucket = (nowMs / 420) | 0;
    const every = Math.max(1, Math.round(4 / scale));
    if (bucket % every !== phase % every) return;
    const cell = ((x | 0) << 16) | (y | 0);
    if (this.lastFungalSmokeBucket.get(cell) === bucket) return;
    this.lastFungalSmokeBucket.set(cell, bucket);

    const rnd = seeded(eventSeed(x, y, phase ^ Math.imul(bucket, 2246822519)));
    this.push({
      x: x + rnd() * 0.6 - 0.3,
      y: y + rnd() * 0.6 - 0.3,
      z: 0.08,
      vx: (rnd() - 0.5) * 0.08,
      vy: (rnd() - 0.5) * 0.08,
      vz: 0.18 + rnd() * 0.12,
      life: 900,
      maxLife: 900,
      kind: 'ash',
    });
  }

`);
replaceOnce(particles,
`      if (p.kind === 'gas' || p.kind === 'ash') {`,
`      if (p.kind === 'gas' || p.kind === 'sporeCloud' || p.kind === 'ash') {`);

// ---------------------------------------------------------------------------
// Existing simulation tests: replace assumptions that encoded the conflation.
// ---------------------------------------------------------------------------
const materials = 'packages/voxelyn-survival-sim/tests/materials.test.ts';
replaceOnce(materials,
`  SURF_FUNGAL,
  SURF_GAS,`,
`  SURF_FUNGAL,
  SURF_FUNGAL_HEATED,
  SURF_GAS,`);
replaceOnce(materials,
`  SURF_SCORCHED,
} from '../src/constants';`,
`  SURF_SCORCHED,
  SURF_SPORES,
} from '../src/constants';`);
replaceOnce(materials,
`  it('calor acende fungo e biofluido', () => {
    for (const surf of [SURF_FUNGAL, SURF_BIOFLUID]) {
      const state = world(17);
      const i = at(state, 30, 30);
      state.surface[i] = surf;
      impactSurface(state, 30, 30, 'thermal', []);
      expect(state.surface[i]).toBe(SURF_FIRE);
    }
  });`,
`  it('calor seca o fungo antes da chama, mas acende biofluido na hora', () => {
    const fungal = world(17);
    const fi = at(fungal, 30, 30);
    fungal.surface[fi] = SURF_FUNGAL;
    impactSurface(fungal, 30, 30, 'thermal', []);
    expect(fungal.surface[fi]).toBe(SURF_FUNGAL_HEATED);

    const fluid = world(17);
    const bi = at(fluid, 30, 30);
    fluid.surface[bi] = SURF_BIOFLUID;
    impactSurface(fluid, 30, 30, 'thermal', []);
    expect(fluid.surface[bi]).toBe(SURF_FIRE);
  });

  it('calor esteriliza esporos sem produzir explosao', () => {
    const state = world(21);
    const i = at(state, 30, 30);
    state.surface[i] = SURF_SPORES;
    const events: SemanticEvent[] = [];
    expect(impactSurface(state, 30, 30, 'thermal', events)).toBe(false);
    expect(state.surface[i]).toBe(SURF_FIRE);
    expect(events.some((e) => e.t === 'explosion')).toBe(false);
  });`);

const reactions = 'packages/voxelyn-survival-sim/tests/reactions.test.ts';
replaceOnce(reactions,
`  FIRE_FUEL_TICKS,
  SOLID_CRYSTAL,`,
`  FIRE_FUEL_TICKS,
  FUNGAL_FIRE_FUEL_TICKS,
  FUNGAL_HEAT_TICKS,
  GAS_FLASH_TICKS,
  SPORE_LIFE_TICKS,
  SOLID_CRYSTAL,`);
replaceOnce(reactions,
`  SURF_FUNGAL,
  SURF_GAS,
  SURF_NONE,`,
`  SURF_FUNGAL,
  SURF_FUNGAL_HEATED,
  SURF_GAS,
  SURF_NONE,
  SURF_SCORCHED,
  SURF_SPORES,`);
replaceOnce(reactions,
`import { spawnEnemy } from '../src/entities';`,
`import { damageEntity, spawnEnemy } from '../src/entities';`);
replaceOnce(reactions,
`  it('fogo se propaga pela vegetacao fungica e a consome', () => {
    const state = createRun({ seed: 7 });
    const w = state.config.width;
    clearArea(state, 40, 40, 60, 60);
    for (let y = 45; y <= 55; y++) {
      for (let x = 45; x <= 55; x++) {
        state.surface[y * w + x] = SURF_FUNGAL;
      }
    }
    const events: SemanticEvent[] = [];
    setSurface(state, 50 * w + 50, SURF_FIRE, FIRE_FUEL_TICKS);

    tickCells(state, events, 40);

    let _fungalLeft = 0;
    let scorchedOrFire = 0;
    for (let y = 45; y <= 55; y++) {
      for (let x = 45; x <= 55; x++) {
        const surf = state.surface[y * w + x];
        if (surf === SURF_FUNGAL) _fungalLeft++;
        else scorchedOrFire++;
      }
    }
    expect(scorchedOrFire).toBeGreaterThan(30); // a queimada se espalhou de verdade
  });`,
`  it('fungo umido seca antes de pegar fogo e queima por mais tempo', () => {
    const state = createRun({ seed: 7 });
    const w = state.config.width;
    clearArea(state, 46, 46, 54, 54);
    const fungal = 50 * w + 51;
    state.surface[fungal] = SURF_FUNGAL;
    const events: SemanticEvent[] = [];
    setSurface(state, 50 * w + 50, SURF_FIRE, FIRE_FUEL_TICKS);

    tickCells(state, events, 1);
    expect(state.surface[fungal]).toBe(SURF_FUNGAL_HEATED);
    expect(state.surfaceTimer[fungal]).toBe(FUNGAL_HEAT_TICKS);

    tickCells(state, events, Math.floor(FUNGAL_HEAT_TICKS / CELL_STEP_INTERVAL) - 1);
    expect(state.surface[fungal]).toBe(SURF_FUNGAL_HEATED);
    tickCells(state, events, 1);
    expect(state.surface[fungal]).toBe(SURF_FIRE);
    expect(state.surfaceTimer[fungal]).toBe(FUNGAL_FIRE_FUEL_TICKS);
  });`);
replaceOnce(reactions,
`  it('gas de esporos inflama instantaneamente em contato com fogo', () => {
    const state = createRun({ seed: 7 });
    const w = state.config.width;
    clearArea(state, 20, 20, 30, 30);
    for (let x = 22; x <= 28; x++) state.surface[25 * w + x] = SURF_GAS;
    for (let x = 22; x <= 28; x++) state.surfaceTimer[25 * w + x] = 200;
    for (let x = 22; x <= 28; x++) state.reactionQueue.push(25 * w + x);

    const events: SemanticEvent[] = [];
    setSurface(state, 25 * w + 21, SURF_FIRE, FIRE_FUEL_TICKS);
    tickCells(state, events, 10);

    let fireCount = 0;
    for (let x = 22; x <= 28; x++) {
      if (state.surface[25 * w + x] === SURF_FIRE) fireCount++;
    }
    expect(fireCount).toBeGreaterThanOrEqual(5); // corrente de gas virou corrente de fogo
  });`,
`  it('gas sulfurico acende em cadeia e some num flash curto', () => {
    const state = createRun({ seed: 7 });
    const w = state.config.width;
    clearArea(state, 20, 20, 30, 30);
    for (let x = 22; x <= 28; x++) setSurface(state, 25 * w + x, SURF_GAS, 200);

    const events: SemanticEvent[] = [];
    setSurface(state, 25 * w + 21, SURF_FIRE, FIRE_FUEL_TICKS);
    tickCells(state, events, 1);
    expect(state.surface[25 * w + 22]).toBe(SURF_FIRE);
    expect(state.surfaceTimer[25 * w + 22]).toBe(GAS_FLASH_TICKS);

    tickCells(state, events, Math.ceil(GAS_FLASH_TICKS / CELL_STEP_INTERVAL) + 1);
    expect(state.surface[25 * w + 22]).toBe(SURF_SCORCHED);
  });

  it('esporos do bomber sao uma nuvem propria, localizada e temporaria', () => {
    const state = createRun({ seed: 8 });
    const w = state.config.width;
    clearArea(state, 36, 36, 44, 44);
    const bomber = spawnEnemy(state, 'bomber', 40, 40, false);
    const events: SemanticEvent[] = [];
    damageEntity(state, bomber, bomber.hp, events);

    const cloud = [];
    for (let y = 39; y <= 41; y++) for (let x = 39; x <= 41; x++) {
      const surf = state.surface[y * w + x];
      if (surf === SURF_SPORES) cloud.push(y * w + x);
      expect(surf).not.toBe(SURF_GAS);
    }
    expect(cloud.length).toBeGreaterThan(0);
    expect(cloud.every((i) => state.surfaceTimer[i] === SPORE_LIFE_TICKS)).toBe(true);

    tickCells(state, events, Math.ceil(SPORE_LIFE_TICKS / CELL_STEP_INTERVAL) + 1);
    expect(cloud.every((i) => state.surface[i] === SURF_NONE)).toBe(true);
  });`);

// Client regression tests for the two independent ambient emitters.
const particleTests = 'packages/voxelyn-survival/src/tests/particles.test.ts';
insertBefore(particleTests,
`  // Fisica igual em qualquer taxa de atualizacao:`,
`  it('emite esporos verdes separados do gas e com deriva propria', () => {
    const p = new VoxelParticles();
    for (let ms = 0; ms < 5000 && p.count === 0; ms += 130) p.emitSpores(6.5, 8.5, ms, 1);
    const items = (p as unknown as { items: Array<{ kind: string; vx: number; vy: number }> }).items;
    expect(items.some((i) => i.kind === 'sporeCloud')).toBe(true);
    expect(items.some((i) => Math.abs(i.vx) + Math.abs(i.vy) > 0)).toBe(true);
  });

  it('fumaca do fungo aquecido nao cria gas nem esporos', () => {
    const p = new VoxelParticles();
    for (let ms = 0; ms < 6000 && p.count === 0; ms += 210) p.emitFungalSmoke(4.5, 4.5, ms, 1);
    const kinds = new Set((p as unknown as { items: Array<{ kind: string }> }).items.map((i) => i.kind));
    expect(kinds).toEqual(new Set(['ash']));
  });

`);

console.log('surface separation migration applied');
