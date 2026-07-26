import { describe, expect, it } from 'vitest';
import {
  SOLID_CRYSTAL,
  SOLID_CRYSTAL_DULL,
  SOLID_FRAGILE,
  SOLID_FRAGILE_WEAK,
  SOLID_NONE,
  SOLID_ORE,
  SOLID_ORE_CHIPPED,
  SOLID_ORE_SPENT,
  SOLID_ROCK,
  SURF_BIOFLUID,
  SURF_FIRE,
  SURF_FUNGAL,
  SURF_GAS,
  SURF_NONE,
  SURF_SCORCHED,
} from '../src/constants';
import { impactSolid, impactSurface, projectileClass } from '../src/materials';
import { createRun } from '../src/run';
import type { Projectile, SemanticEvent, SurvivalState } from '../src/types';

const clearArea = (state: SurvivalState, x0: number, y0: number, x1: number, y1: number): void => {
  const w = state.config.width;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      state.solid[y * w + x] = SOLID_NONE;
      state.surface[y * w + x] = SURF_NONE;
    }
  }
};

const world = (seed: number): SurvivalState => {
  const state = createRun({ seed });
  clearArea(state, 20, 20, 40, 40);
  return state;
};
const at = (state: SurvivalState, x: number, y: number): number => y * state.config.width + x;

const proj = (over: Partial<Projectile>): Projectile => ({
  id: 1, owner: 1, x: 0, y: 0, vx: 1, vy: 0, damage: 1,
  piercing: false, conductive: false, explosive: false, hostile: false,
  leavesBiofluid: false, ttl: 10, ...over,
});

describe('classe do projetil', () => {
  it('sai dos modificadores da run, com precedencia fixa', () => {
    expect(projectileClass(proj({}))).toBe('kinetic');
    expect(projectileClass(proj({ conductive: true }))).toBe('energy');
    expect(projectileClass(proj({ explosive: true }))).toBe('thermal');
    expect(projectileClass(proj({ leavesBiofluid: true, hostile: true }))).toBe('bio');
    // Sem ordem fixa, o mesmo tiro reagiria diferente conforme a ordem de
    // leitura das flags — e o determinismo iria junto.
    expect(projectileClass(proj({ conductive: true, explosive: true }))).toBe('thermal');
  });
});

describe('materiais reagem por classe de projetil', () => {
  it('rocha nao cede a nenhuma classe', () => {
    for (const cls of ['kinetic', 'energy', 'thermal', 'bio'] as const) {
      const state = world(3);
      state.solid[at(state, 30, 30)] = SOLID_ROCK;
      const events: SemanticEvent[] = [];
      const r = impactSolid(state, 30, 30, cls, events);
      expect(r.broke, cls).toBe(false);
      expect(state.solid[at(state, 30, 30)], cls).toBe(SOLID_ROCK);
    }
  });

  it('energia usa a rocha como condutor e carrega o entorno aberto', () => {
    const state = world(4);
    state.solid[at(state, 30, 30)] = SOLID_ROCK;
    const events: SemanticEvent[] = [];
    impactSolid(state, 30, 30, 'energy', events);
    expect(state.charges.length).toBeGreaterThan(0);
    expect(events.some((e) => e.t === 'discharge')).toBe(true);
  });

  it('acido escorre e deixa poca no pe da parede', () => {
    const state = world(5);
    state.solid[at(state, 30, 30)] = SOLID_ROCK;
    impactSolid(state, 30, 30, 'bio', []);
    const around = [at(state, 29, 30), at(state, 31, 30), at(state, 30, 29), at(state, 30, 31)];
    expect(around.some((i) => state.surface[i] === SURF_BIOFLUID)).toBe(true);
  });

  // O jogador precisa ver a cobertura indo embora e decidir sair. Cair no
  // primeiro toque seria morte sem aviso.
  it('acido corroi rocha fragil em DOIS estagios', () => {
    const state = world(6);
    const i = at(state, 30, 30);
    state.solid[i] = SOLID_FRAGILE;
    const events: SemanticEvent[] = [];

    const first = impactSolid(state, 30, 30, 'bio', events);
    expect(first.broke).toBe(false);
    expect(state.solid[i]).toBe(SOLID_FRAGILE_WEAK);
    expect(events.some((e) => e.t === 'corrode')).toBe(true);

    const second = impactSolid(state, 30, 30, 'bio', events);
    expect(second.broke).toBe(true);
    expect(state.solid[i]).toBe(SOLID_NONE);
  });

  it('termico estilhaca fragil em area, levando os vizinhos', () => {
    const state = world(7);
    for (const [x, y] of [[30, 30], [31, 30], [29, 30]]) state.solid[at(state, x, y)] = SOLID_FRAGILE;
    impactSolid(state, 30, 30, 'thermal', []);
    expect(state.solid[at(state, 30, 30)]).toBe(SOLID_NONE);
    expect(state.solid[at(state, 31, 30)]).toBe(SOLID_NONE);
    expect(state.solid[at(state, 29, 30)]).toBe(SOLID_NONE);
  });

  it('cinetico esgota o veio em duas lascas, nunca infinitamente', () => {
    const state = world(8);
    const i = at(state, 30, 30);
    state.solid[i] = SOLID_ORE;
    const events: SemanticEvent[] = [];
    impactSolid(state, 30, 30, 'kinetic', events);
    expect(state.solid[i]).toBe(SOLID_ORE_CHIPPED);
    impactSolid(state, 30, 30, 'kinetic', events);
    expect(state.solid[i]).toBe(SOLID_ORE_SPENT);
    // Esgotado nao rende mais nada: sem isso uma parede seria fonte infinita.
    const before = events.filter((e) => e.t === 'chip').length;
    impactSolid(state, 30, 30, 'kinetic', events);
    expect(events.filter((e) => e.t === 'chip').length).toBe(before);
    expect(state.solid[i]).toBe(SOLID_ORE_SPENT);
  });

  // Isto e o que faz o minerio existir: atirar num veio mata algo do outro lado.
  it('energia percorre o veio de minerio e descarrega longe do impacto', () => {
    const state = world(9);
    for (let x = 26; x <= 34; x++) state.solid[at(state, x, 30)] = SOLID_ORE;
    const events: SemanticEvent[] = [];
    impactSolid(state, 26, 30, 'energy', events);
    const discharge = events.find((e) => e.t === 'discharge') as Extract<SemanticEvent, { t: 'discharge' }>;
    expect(discharge).toBeDefined();
    // Carga na ponta oposta do veio, a 8 celulas do ponto atingido.
    const farEnd = [at(state, 34, 29), at(state, 34, 31)];
    expect(discharge.cells.some((c) => farEnd.includes(c))).toBe(true);
  });

  it('veio lascado ainda conduz; veio contaminado nao', () => {
    const chipped = world(10);
    for (let x = 26; x <= 32; x++) chipped.solid[at(chipped, x, 30)] = SOLID_ORE_CHIPPED;
    const a: SemanticEvent[] = [];
    impactSolid(chipped, 26, 30, 'energy', a);
    expect(a.some((e) => e.t === 'discharge')).toBe(true);

    const spent = world(10);
    for (let x = 26; x <= 32; x++) spent.solid[at(spent, x, 30)] = SOLID_ORE_SPENT;
    const b: SemanticEvent[] = [];
    impactSolid(spent, 26, 30, 'energy', b);
    expect(b.some((e) => e.t === 'discharge')).toBe(false);
  });

  it('termico funde o minerio e deixa chao queimado', () => {
    const state = world(11);
    const i = at(state, 30, 30);
    state.solid[i] = SOLID_ORE;
    impactSolid(state, 30, 30, 'thermal', []);
    expect(state.solid[i]).toBe(SOLID_NONE);
    expect(state.surface[i]).toBe(SURF_SCORCHED);
  });

  it('acido contamina o veio: continua parede, deixa de conduzir', () => {
    const state = world(12);
    const i = at(state, 30, 30);
    state.solid[i] = SOLID_ORE;
    impactSolid(state, 30, 30, 'bio', []);
    expect(state.solid[i]).toBe(SOLID_ORE_SPENT);
    const events: SemanticEvent[] = [];
    impactSolid(state, 30, 30, 'energy', events);
    expect(events.some((e) => e.t === 'discharge')).toBe(false);
  });

  it('energia ressoa e leva a cadeia de cristais junto', () => {
    const state = world(13);
    for (let x = 28; x <= 32; x++) state.solid[at(state, x, 30)] = SOLID_CRYSTAL;
    impactSolid(state, 28, 30, 'energy', []);
    for (let x = 28; x <= 32; x++) expect(state.solid[at(state, x, 30)], `x=${x}`).toBe(SOLID_NONE);
  });

  it('termico racha o cristal sem quebrar: vira fragil', () => {
    const state = world(14);
    const i = at(state, 30, 30);
    state.solid[i] = SOLID_CRYSTAL;
    impactSolid(state, 30, 30, 'thermal', []);
    expect(state.solid[i]).toBe(SOLID_FRAGILE);
  });

  it('acido opaca o cristal, que para de descarregar ao quebrar', () => {
    const state = world(15);
    const i = at(state, 30, 30);
    state.solid[i] = SOLID_CRYSTAL;
    state.surface[at(state, 31, 30)] = SURF_BIOFLUID;
    impactSolid(state, 30, 30, 'bio', []);
    expect(state.solid[i]).toBe(SOLID_CRYSTAL_DULL);

    const events: SemanticEvent[] = [];
    impactSolid(state, 30, 30, 'kinetic', events);
    expect(state.solid[i]).toBe(SOLID_NONE);
    // Cristal vivo dispara descarga ao quebrar; opaco ja gastou a energia dele.
    expect(events.some((e) => e.t === 'discharge')).toBe(false);
  });
});

describe('superficies reagem por classe de projetil', () => {
  it('faisca e calor detonam o gas; cinetico atravessa', () => {
    for (const [cls, detona] of [['energy', true], ['thermal', true], ['kinetic', false], ['bio', false]] as const) {
      const state = world(16);
      const i = at(state, 30, 30);
      state.surface[i] = SURF_GAS;
      const events: SemanticEvent[] = [];
      const consumed = impactSurface(state, 30, 30, cls, events);
      expect(consumed, cls).toBe(detona);
      expect(events.some((e) => e.t === 'explosion'), cls).toBe(detona);
    }
  });

  it('calor acende fungo e biofluido', () => {
    for (const surf of [SURF_FUNGAL, SURF_BIOFLUID]) {
      const state = world(17);
      const i = at(state, 30, 30);
      state.surface[i] = surf;
      impactSurface(state, 30, 30, 'thermal', []);
      expect(state.surface[i]).toBe(SURF_FIRE);
    }
  });

  it('acido apaga fogo e reidrata cinza', () => {
    const state = world(18);
    const fogo = at(state, 30, 30);
    const cinza = at(state, 31, 30);
    state.surface[fogo] = SURF_FIRE;
    state.surface[cinza] = SURF_SCORCHED;
    impactSurface(state, 30, 30, 'bio', []);
    impactSurface(state, 31, 30, 'bio', []);
    expect(state.surface[fogo]).toBe(SURF_SCORCHED);
    expect(state.surface[cinza]).toBe(SURF_FUNGAL);
  });

  it('acido alimenta o fungo, que avanca para as celulas limpas', () => {
    const state = world(20);
    state.surface[at(state, 30, 30)] = SURF_FUNGAL;
    impactSurface(state, 30, 30, 'bio', []);
    const around = [at(state, 29, 30), at(state, 31, 30), at(state, 30, 29), at(state, 30, 31)];
    expect(around.every((n) => state.surface[n] === SURF_FUNGAL)).toBe(true);
  });

  it('nao consome o projetil quando o material nao reage', () => {
    const state = world(19);
    expect(impactSurface(state, 30, 30, 'kinetic', [])).toBe(false);
  });
});
