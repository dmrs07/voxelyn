// Estratos, ocupacoes e linhagens: a gramatica ambiental da descida.
//
// O que estes testes protegem, em ordem de importancia:
// 1. DETERMINISMO: o bioma e funcao pura da seed. Reconectar, replays e co-op
//    dependem de qualquer maquina derivar o mesmo estrato para o mesmo setor.
// 2. COMPATIBILIDADE: o basalto limpo E o mapa historico — mesma sequencia de
//    RNG, mesmos numeros. Uma run que caia nele joga o que sempre jogou.
// 3. IDENTIDADE: cada estrato realmente muda a materia do setor (agua no
//    aquifero, nervuras no prismatico), e a agua tem as tres propriedades que
//    definem o Aquifero — conduz, retarda e apaga fogo.
import { describe, expect, it } from 'vitest';
import {
  BISHOP_SECTOR,
  ICE_REFREEZE_TICKS,
  SECTOR_COUNT,
  SOLID_CRYSTAL,
  SOLID_FRAGILE,
  SOLID_NONE,
  SURF_EMBER,
  SURF_FIRE,
  SURF_FUNGAL,
  SURF_ICE,
  SURF_NONE,
  SURF_SCORCHED,
  SURF_WATER,
  VENT_CYCLE_TICKS,
  WATER_SLOW,
  WORLD_H,
  WORLD_W,
} from '../src/constants';
import { dischargeAt, igniteCell, setSurface, stepCells } from '../src/cells';
import { surfaceSpeedMul } from '../src/entities';
import { createRun, emptyCommand, stepRun } from '../src/run';
import { descend } from '../src/sectors';
import { biomeMix, biomeProfile, lineageOf, sectorBiome } from '../src/strata';
import { DEFAULT_PROFILE, generateWorld } from '../src/worldgen';
import type { SectorBiome, SemanticEvent, SurvivalState } from '../src/types';

const SEEDS = [1, 2, 3, 42, 1337, 0xdecafbad, 987654321, 7];

const at = (state: SurvivalState, x: number, y: number): number => y * state.config.width + x;

/** Uma seed cuja linhagem seja a pedida, para testar cada trilha de verdade. */
const seedWithLineage = (lineage: string): number => {
  for (let seed = 1; seed < 4096; seed++) {
    if (lineageOf(seed) === lineage) return seed;
  }
  throw new Error(`nenhuma seed pequena com linhagem ${lineage}`);
};

describe('derivacao do bioma', () => {
  it('e funcao pura da seed: mesma entrada, mesmo bioma, sem consumir RNG', () => {
    for (const seed of SEEDS) {
      for (let sector = 1; sector <= SECTOR_COUNT; sector++) {
        const a = sectorBiome(seed, sector);
        const b = sectorBiome(seed, sector);
        expect(b).toEqual(a);
      }
    }
  });

  it('createRun({ sector: N }) reconstroi o mesmo bioma da descida ao vivo', () => {
    for (const seed of SEEDS) {
      const live = createRun({ seed });
      const events: SemanticEvent[] = [];
      descend(live, events);
      const rebuilt = createRun({ seed, sector: 2 });
      expect(rebuilt.stratum).toBe(live.stratum);
      expect(rebuilt.occupation).toBe(live.occupation);
      expect(rebuilt.lineage).toBe(live.lineage);
      // E o mundo em si tambem: a garantia de reconexao nao e so o rotulo.
      expect(Array.from(rebuilt.solid)).toEqual(Array.from(live.solid));
    }
  });

  it('a run segue UMA linhagem: os tres setores contam a mesma historia', () => {
    for (const seed of SEEDS) {
      const lineage = lineageOf(seed);
      for (let sector = 1; sector <= SECTOR_COUNT; sector++) {
        expect(sectorBiome(seed, sector).lineage).toBe(lineage);
      }
    }
  });

  it('o primeiro setor de toda linhagem e basalto: a referencia vem antes da variacao', () => {
    for (const seed of SEEDS) {
      expect(sectorBiome(seed, 1).stratum).toBe('basalt');
      expect(sectorBiome(seed, 1).occupation).toBe('none');
    }
  });

  it('anuncia o bioma no evento de chegada ao setor', () => {
    const state = createRun({ seed: 11 });
    const events: SemanticEvent[] = [];
    descend(state, events);
    const entered = events.find((e) => e.t === 'sector_entered');
    expect(entered).toBeDefined();
    if (entered?.t === 'sector_entered') {
      const expected = sectorBiome(11, 2);
      expect(entered.stratum).toBe(expected.stratum);
      expect(entered.occupation).toBe(expected.occupation);
    }
  });
});

describe('perfis por estrato', () => {
  const basalt: SectorBiome = { stratum: 'basalt', occupation: 'none', lineage: 'mineral' };
  const prismatic: SectorBiome = { stratum: 'prismatic', occupation: 'none', lineage: 'mineral' };
  const aquifer: SectorBiome = { stratum: 'aquifer', occupation: 'none', lineage: 'hydric' };

  it('basalto limpo preserva as MATERIAS historicas em qualquer linhagem e setor', () => {
    // O contrato do basalto evoluiu de bytes para IDENTIDADE (pedido de
    // playtest: a gramatica basaltica ganha anfiteatros, florestas de pilares
    // e fissuras). O que continua intocavel: o automato como base, e as
    // materias — nada de agua, brasa, gelo ou nervura de cristal nele.
    // Variacao de materia no basalto segue sendo trabalho das ocupacoes.
    for (const lineage of ['hydric', 'mineral', 'industrial', 'thermal', 'arid', 'cryo'] as const) {
      for (let sector = 1; sector <= SECTOR_COUNT; sector++) {
        const clean: SectorBiome = { stratum: 'basalt', occupation: 'none', lineage };
        const profile = biomeProfile(clean, sector);
        expect({ ...profile, halls: 'none' }, `${lineage} s${sector}`).toEqual(DEFAULT_PROFILE);
        expect(profile.halls, `${lineage} s${sector}`).toBe('columns');
      }
    }
  });

  it('o basalto continua sem NENHUM elemento de outro estrato no chao', () => {
    for (const seed of SEEDS.slice(0, 4)) {
      const world = generateWorld(seed, WORLD_W, WORLD_H, biomeProfile(basalt, 1));
      const count = (kind: number): number =>
        world.surface.reduce((n, s) => n + (s === kind ? 1 : 0), 0);
      expect(count(SURF_WATER)).toBe(0);
      expect(count(SURF_ICE)).toBe(0);
      expect(count(SURF_EMBER)).toBe(0);
    }
  });

  it('a gramatica basaltica deixa pilares de ROCHA soltos nos saloes', () => {
    let seedsWithPillars = 0;
    for (const seed of SEEDS.slice(0, 4)) {
      const world = generateWorld(seed, WORLD_W, WORLD_H, biomeProfile(basalt, 1));
      let pillars = 0;
      for (let y = 1; y < WORLD_H - 1; y++) {
        for (let x = 1; x < WORLD_W - 1; x++) {
          if (world.solid[y * WORLD_W + x] !== 1) continue; // SOLID_ROCK
          const around = [world.solid[y * WORLD_W + x - 1], world.solid[y * WORLD_W + x + 1],
            world.solid[(y - 1) * WORLD_W + x], world.solid[(y + 1) * WORLD_W + x]];
          if (around.every((s) => s === SOLID_NONE)) pillars++;
        }
      }
      if (pillars > 0) seedsWithPillars++;
    }
    expect(seedsWithPillars).toBeGreaterThanOrEqual(3);
  });

  it('o aquifero tem lagos; o basalto seco nao tem nenhum', () => {
    for (const seed of SEEDS.slice(0, 4)) {
      const wet = generateWorld(seed, WORLD_W, WORLD_H, biomeProfile(aquifer, 2));
      const dry = generateWorld(seed, WORLD_W, WORLD_H);
      const waterCells = (world: { surface: Uint8Array }): number =>
        world.surface.reduce((n, s) => n + (s === SURF_WATER ? 1 : 0), 0);
      expect(waterCells(wet)).toBeGreaterThan(60);
      expect(waterCells(dry)).toBe(0);
    }
  });

  it('a catedral tem muito mais cristal que o basalto, e ele forma nervuras', () => {
    for (const seed of SEEDS.slice(0, 4)) {
      const crystalCount = (solid: Uint8Array): number =>
        solid.reduce((n, s) => n + (s === SOLID_CRYSTAL ? 1 : 0), 0);
      const cathedral = generateWorld(seed, WORLD_W, WORLD_H, biomeProfile(prismatic, 2));
      const gallery = generateWorld(seed, WORLD_W, WORLD_H);
      expect(crystalCount(cathedral.solid)).toBeGreaterThan(crystalCount(gallery.solid) * 2);
    }
  });

  it('cada estrato tem a propria estrutura de salao; o basalto nao tem nenhuma', () => {
    const halls = (stratum: SectorBiome['stratum'], lineage: SectorBiome['lineage']): string =>
      biomeProfile({ stratum, occupation: 'none', lineage }, 2).halls;
    expect(halls('basalt', 'mineral')).toBe('columns');
    expect(halls('prismatic', 'mineral')).toBe('radial');
    expect(halls('aquifer', 'hydric')).toBe('karst');
    expect(halls('sulfur', 'thermal')).toBe('lungs');
    expect(halls('furnace', 'thermal')).toBe('canyon');
    expect(halls('silica', 'arid')).toBe('terraced');
    expect(halls('glacial', 'cryo')).toBe('lakes');
  });

  it('a rotunda da Catedral deixa pilares de cristal soltos no salao', () => {
    // Pilar solto = cristal com os quatro vizinhos abertos: so a rotunda produz
    // isso (a decoracao de parede poe cristal COLADO em rocha). Seeds fixas:
    // o teste e deterministico, nao estatistico.
    let seedsWithPillars = 0;
    for (const seed of SEEDS.slice(0, 4)) {
      const world = generateWorld(seed, WORLD_W, WORLD_H, biomeProfile(prismatic, 2));
      let pillars = 0;
      for (let y = 1; y < WORLD_H - 1; y++) {
        for (let x = 1; x < WORLD_W - 1; x++) {
          if (world.solid[y * WORLD_W + x] !== SOLID_CRYSTAL) continue;
          const open = [world.solid[y * WORLD_W + x - 1], world.solid[y * WORLD_W + x + 1],
            world.solid[(y - 1) * WORLD_W + x], world.solid[(y + 1) * WORLD_W + x]];
          if (open.every((s) => s === SOLID_NONE)) pillars++;
        }
      }
      if (pillars > 0) seedsWithPillars++;
    }
    // Uma rotunda pode calhar de ser selada pelo fechamento de bolsoes; nas
    // quatro seeds fixas, a maioria tem de sobreviver conectada.
    expect(seedsWithPillars).toBeGreaterThanOrEqual(3);
  });

  it('a gramatica registra os centros dos saloes — sem mover um byte do mapa', () => {
    // hallCenters e informacao de APRESENTACAO (ancora dos landmarks do
    // cliente): registrar nao pode consumir RNG nem mudar celula nenhuma.
    // O perfil historico puro (halls 'none') continua sem centro algum.
    const pure = generateWorld(42, WORLD_W, WORLD_H, DEFAULT_PROFILE);
    expect(pure.hallCenters).toEqual([]);

    for (const seed of SEEDS.slice(0, 4)) {
      // Todo estrato da primeira leva tem gramatica; os centros existem e
      // moram dentro da moldura do mapa.
      const state = createRun({ seed, sector: 2 });
      expect(state.hallCenters.length).toBeGreaterThan(0);
      for (const c of state.hallCenters) {
        expect(c.x).toBeGreaterThan(1);
        expect(c.y).toBeGreaterThan(1);
        expect(c.x).toBeLessThan(WORLD_W - 1);
        expect(c.y).toBeLessThan(WORLD_H - 1);
      }
      // Mesma seed, mesma lista: e a mesma derivacao pura do resto do mundo.
      expect(createRun({ seed, sector: 2 }).hallCenters).toEqual(state.hallCenters);
    }

    // A descida ao vivo e a reconstrucao por createRun veem os MESMOS
    // centros — a decoracao de quem reconecta ancora nos mesmos saloes.
    const live = createRun({ seed: 7 });
    const events: SemanticEvent[] = [];
    descend(live, events);
    expect(live.hallCenters).toEqual(createRun({ seed: 7, sector: 2 }).hallCenters);
  });

  it('as bacias do Aquifero nascem cheias: existe um lago CONECTADO grande', () => {
    const seed = seedWithLineage('hydric');
    const state = createRun({ seed, sector: 2 });
    const w = state.config.width;
    const h = state.config.height;
    const seen = new Set<number>();
    let largest = 0;
    for (let i = 0; i < state.surface.length; i++) {
      if (state.surface[i] !== SURF_WATER || seen.has(i)) continue;
      let size = 0;
      const stack = [i];
      seen.add(i);
      while (stack.length > 0) {
        const cur = stack.pop() as number;
        size++;
        const cx = cur % w;
        const cy = (cur - cx) / w;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = cx + dx;
          const ny = cy + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const ni = ny * w + nx;
          if (seen.has(ni) || state.surface[ni] !== SURF_WATER) continue;
          seen.add(ni);
          stack.push(ni);
        }
      }
      largest = Math.max(largest, size);
    }
    expect(largest).toBeGreaterThanOrEqual(25);
  });

  it('todo estrato continua gerando mapa solucionavel com nucleo alcancavel', () => {
    // A promessa central do worldgen nao pode depender do perfil: agua e
    // cristal mudam materia, nunca a prova de alcancabilidade.
    for (const lineage of ['hydric', 'mineral', 'industrial'] as const) {
      const seed = seedWithLineage(lineage);
      for (let sector = 1; sector <= SECTOR_COUNT; sector++) {
        const state = createRun({ seed, sector });
        expect(state.solid[at(state, state.corePos.x, state.corePos.y)]).toBe(SOLID_NONE);
        expect(state.solid[at(state, state.entry.x, state.entry.y)]).toBe(SOLID_NONE);
      }
    }
  });

  it('a entrada continua limpa mesmo no aquifero: ninguem nasce dentro do lago', () => {
    const seed = seedWithLineage('hydric');
    const state = createRun({ seed, sector: 2 });
    expect(state.stratum).toBe('aquifer');
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        expect(state.surface[at(state, state.entry.x + dx, state.entry.y + dy)]).toBe(SURF_NONE);
      }
    }
  });

  it('a ocupacao micelial inclina a fauna para spitters e bombers sem mudar a contagem', () => {
    const clean: SectorBiome = { stratum: 'aquifer', occupation: 'none', lineage: 'hydric' };
    const infested: SectorBiome = { stratum: 'aquifer', occupation: 'mycelial', lineage: 'hydric' };
    const before = biomeMix(clean, 3);
    const after = biomeMix(infested, 3);
    expect(after.length).toBe(before.length);
    const organic = (mix: readonly string[]): number =>
      mix.filter((a) => a === 'spitter' || a === 'bomber').length;
    expect(organic(after)).toBeGreaterThanOrEqual(organic(before));
  });
});

describe('agua do Aquifero Negro', () => {
  const flooded = (seed: number): SurvivalState => {
    const state = createRun({ seed });
    // Arena controlada: um corredor aberto com uma faixa de agua.
    for (let y = 20; y <= 26; y++) {
      for (let x = 20; x <= 40; x++) {
        state.solid[at(state, x, y)] = SOLID_NONE;
        state.surface[at(state, x, y)] = SURF_NONE;
      }
    }
    for (let x = 22; x <= 34; x++) setSurface(state, at(state, x, 23), SURF_WATER, 0);
    return state;
  };

  it('conduz descarga pela poca conectada', () => {
    const state = flooded(9);
    const events: SemanticEvent[] = [];
    expect(dischargeAt(state, 23, 23, events)).toBe(true);
    expect(state.charges.length).toBeGreaterThan(10);
    expect(events.some((e) => e.t === 'discharge')).toBe(true);
  });

  it('retarda quem atravessa, menos que o biofluido', () => {
    const state = flooded(10);
    state.player.x = 23.5;
    state.player.y = 23.5;
    expect(surfaceSpeedMul(state, state.player)).toBe(WATER_SLOW);
  });

  it('nao acende: fogo nao nasce na agua', () => {
    const state = flooded(11);
    const events: SemanticEvent[] = [];
    expect(igniteCell(state, at(state, 25, 23), events)).toBe(false);
    expect(state.surface[at(state, 25, 23)]).toBe(SURF_WATER);
  });

  it('apaga fogo encostado nela em vez de deixa-lo espalhar', () => {
    const state = flooded(12);
    const fireCell = at(state, 25, 22); // colado na faixa de agua
    setSurface(state, fireCell, SURF_FIRE, 400);
    // stepCells roda a cada CELL_STEP_INTERVAL ticks; avanca ate processar.
    for (let t = 0; t < 12 && state.surface[fireCell] === SURF_FIRE; t++) {
      state.tick += 1;
      stepCells(state, []);
    }
    expect(state.surface[fireCell]).toBe(SURF_SCORCHED);
    expect(state.surface[at(state, 25, 23)]).toBe(SURF_WATER);
  });
});

describe('segunda leva: linhagens termica, arida e crio', () => {
  it('as trilhas novas seguem a tabela da spec', () => {
    const thermal = seedWithLineage('thermal');
    expect(sectorBiome(thermal, 2).stratum).toBe('sulfur');
    expect(sectorBiome(thermal, 3).stratum).toBe('furnace');
    const arid = seedWithLineage('arid');
    expect(sectorBiome(arid, 2).stratum).toBe('silica');
    expect(sectorBiome(arid, 3).stratum).toBe('furnace');
    const cryo = seedWithLineage('cryo');
    expect(sectorBiome(cryo, 2).stratum).toBe('glacial');
    expect(sectorBiome(cryo, 3).stratum).toBe('glacial');
  });

  it('a Fornalha nunca recebe colonia micelial: a intrusao vira Aurix', () => {
    for (let seed = 1; seed < 4096; seed++) {
      for (let sector = 2; sector <= SECTOR_COUNT; sector++) {
        const biome = sectorBiome(seed, sector);
        if (biome.stratum === 'furnace') expect(biome.occupation).not.toBe('mycelial');
      }
    }
  });

  it('cada estrato novo muda a materia do setor', () => {
    const count = (arr: Uint8Array, kind: number): number =>
      arr.reduce((n, s) => n + (s === kind ? 1 : 0), 0);
    const mk = (stratum: 'sulfur' | 'furnace' | 'silica' | 'glacial', lineage: 'thermal' | 'arid' | 'cryo') =>
      generateWorld(42, WORLD_W, WORLD_H, biomeProfile({ stratum, occupation: 'none', lineage }, 2));
    const dry = generateWorld(42, WORLD_W, WORLD_H);

    // Glacial: lagos congelados.
    expect(count(mk('glacial', 'cryo').surface, SURF_ICE)).toBeGreaterThan(60);
    // Fornalha: fissuras incandescentes e campos de carvao.
    const furnace = mk('furnace', 'thermal');
    expect(count(furnace.surface, SURF_EMBER)).toBeGreaterThan(30);
    expect(count(furnace.surface, SURF_SCORCHED)).toBeGreaterThan(30);
    // Fenda: muito mais respiradouros que o basalto.
    expect(mk('sulfur', 'thermal').ventPositions.length).toBeGreaterThan(dry.ventPositions.length);
    // Silica: bem mais parede fragil.
    expect(count(mk('silica', 'arid').solid, SOLID_FRAGILE)).toBeGreaterThan(
      count(dry.solid, SOLID_FRAGILE) * 1.2,
    );
  });
});

describe('ventilacao da Fenda Sulfurosa', () => {
  const ventState = (): SurvivalState => {
    const state = createRun({ seed: 21 });
    state.stratum = 'sulfur';
    for (let y = 28; y <= 32; y++) {
      for (let x = 28; x <= 32; x++) {
        state.solid[at(state, x, y)] = SOLID_NONE;
        state.surface[at(state, x, y)] = SURF_NONE;
      }
    }
    state.vents = [{ x: 30, y: 30, nextEmitAt: 0 }];
    return state;
  };

  it('a fonte emite na janela dela e dorme na oposta', () => {
    // fase de (30,30) = (30*7 + 30*13) % 2 = 0: ativa nas janelas pares.
    const active = ventState();
    active.tick = 0;
    stepCells(active, []);
    expect(active.surface[at(active, 30, 30)]).not.toBe(SURF_NONE);

    const dormant = ventState();
    // Janela impar mais proxima, alinhada ao passo celular.
    dormant.tick = VENT_CYCLE_TICKS + (3 - (VENT_CYCLE_TICKS % 3)) % 3;
    stepCells(dormant, []);
    expect(dormant.surface[at(dormant, 30, 30)]).toBe(SURF_NONE);
  });

  it('fora da Fenda, o respiradouro ignora o ciclo (comportamento historico)', () => {
    const state = ventState();
    state.stratum = 'basalt';
    state.tick = VENT_CYCLE_TICKS + (3 - (VENT_CYCLE_TICKS % 3)) % 3; // janela "dormente"
    stepCells(state, []);
    expect(state.surface[at(state, 30, 30)]).not.toBe(SURF_NONE);
  });
});

describe('fissuras da Fornalha Abissal', () => {
  it('em cima da brasa, o calor da arma dissipa devagar — e nao ha dano', () => {
    const onEmber = createRun({ seed: 22 });
    const cold = createRun({ seed: 22 });
    for (const state of [onEmber, cold]) {
      const px = Math.floor(state.player.x);
      const py = Math.floor(state.player.y);
      state.playerExtra.heat = 60;
      if (state === onEmber) setSurface(state, at(state, px, py), SURF_EMBER, 0);
    }
    for (let t = 0; t < 10; t++) {
      stepRun(onEmber, [emptyCommand()]);
      stepRun(cold, [emptyCommand()]);
    }
    expect(onEmber.playerExtra.heat).toBeGreaterThan(cold.playerExtra.heat);
    expect(onEmber.player.hp).toBe(onEmber.player.maxHp);
  });

  it('o chao queimado e CARVAO na Fornalha: acende persistente — e so la', () => {
    const furnace = createRun({ seed: 23 });
    furnace.stratum = 'furnace';
    const i = at(furnace, 30, 30);
    furnace.solid[i] = SOLID_NONE;
    furnace.surface[i] = SURF_SCORCHED;
    expect(igniteCell(furnace, i, [])).toBe(true);
    expect(furnace.surface[i]).toBe(SURF_FIRE);

    const basalt = createRun({ seed: 23 });
    const j = at(basalt, 30, 30);
    basalt.solid[j] = SOLID_NONE;
    basalt.surface[j] = SURF_SCORCHED;
    expect(igniteCell(basalt, j, [])).toBe(false);
    expect(basalt.surface[j]).toBe(SURF_SCORCHED);
  });
});

describe('gelo da Cripta Glacial', () => {
  const frozen = (seed: number): SurvivalState => {
    const state = createRun({ seed });
    for (let y = 20; y <= 26; y++) {
      for (let x = 20; x <= 40; x++) {
        state.solid[at(state, x, y)] = SOLID_NONE;
        state.surface[at(state, x, y)] = SURF_NONE;
      }
    }
    for (let x = 22; x <= 34; x++) setSurface(state, at(state, x, 23), SURF_ICE, 0);
    return state;
  };

  it('gelo nao conduz; derretido vira agua condutiva; e recongela sozinho', () => {
    const state = frozen(24);
    // Congelado: a descarga nao encontra circuito.
    expect(dischargeAt(state, 25, 23, [])).toBe(false);

    // Calor derrete: agua com relogio de recongelamento.
    const i = at(state, 25, 23);
    expect(igniteCell(state, i, [])).toBe(false);
    expect(state.surface[i]).toBe(SURF_WATER);
    expect(state.surfaceTimer[i]).toBe(ICE_REFREEZE_TICKS);
    expect(dischargeAt(state, 25, 23, [])).toBe(true);

    // A janela fecha: depois do relogio, gelo de novo.
    for (let t = 0; t <= ICE_REFREEZE_TICKS + 6 && state.surface[i] === SURF_WATER; t += 1) {
      state.tick += 1;
      stepCells(state, []);
    }
    expect(state.surface[i]).toBe(SURF_ICE);
  });

  it('fogo encostado no gelo o derrete — e a agua nova apaga o proprio fogo', () => {
    const state = frozen(25);
    const fireCell = at(state, 25, 22); // colado na faixa de gelo
    setSurface(state, fireCell, SURF_FIRE, 400);
    for (let t = 0; t < 24 && state.surface[fireCell] === SURF_FIRE; t++) {
      state.tick += 1;
      stepCells(state, []);
    }
    expect(state.surface[at(state, 25, 23)]).toBe(SURF_WATER);
    expect(state.surface[fireCell]).toBe(SURF_SCORCHED);
  });
});

describe('bolso micelial do Bispo', () => {
  it('a arena do setor 2 tem tapete fungico em QUALQUER linhagem', () => {
    for (const lineage of ['hydric', 'mineral', 'industrial', 'thermal', 'arid', 'cryo'] as const) {
      const seed = seedWithLineage(lineage);
      const state = createRun({ seed, sector: BISHOP_SECTOR });
      const bishop = state.enemies.find((e) => e.archetype === 'bishop');
      expect(bishop, `linhagem ${lineage}: setor 2 sem bispo`).toBeDefined();
      if (!bishop) continue;
      let fungal = 0;
      const cx = Math.floor(bishop.x);
      const cy = Math.floor(bishop.y);
      for (let dy = -4; dy <= 4; dy++) {
        for (let dx = -4; dx <= 4; dx++) {
          const x = cx + dx;
          const y = cy + dy;
          if (x < 0 || y < 0 || x >= state.config.width || y >= state.config.height) continue;
          if (state.surface[at(state, x, y)] === SURF_FUNGAL) fungal += 1;
        }
      }
      expect(fungal, `linhagem ${lineage}: arena sem colonia`).toBeGreaterThan(8);
    }
  });
});
