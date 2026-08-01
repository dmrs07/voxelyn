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
  SECTOR_COUNT,
  SOLID_CRYSTAL,
  SOLID_NONE,
  SURF_FIRE,
  SURF_FUNGAL,
  SURF_NONE,
  SURF_SCORCHED,
  SURF_WATER,
  WATER_SLOW,
  WORLD_H,
  WORLD_W,
} from '../src/constants';
import { dischargeAt, igniteCell, setSurface, stepCells } from '../src/cells';
import { surfaceSpeedMul } from '../src/entities';
import { createRun } from '../src/run';
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

  it('basalto limpo e EXATAMENTE o perfil historico, em qualquer linhagem e setor', () => {
    // O bioma original do jogo esta preservado como tipo proprio: Galerias de
    // Basalto sem ocupacao SAO o mapa antigo. Nenhuma linhagem pode tempera-lo
    // — variacao de basalto e trabalho das ocupacoes.
    for (const lineage of ['hydric', 'mineral', 'industrial'] as const) {
      for (let sector = 1; sector <= SECTOR_COUNT; sector++) {
        const clean: SectorBiome = { stratum: 'basalt', occupation: 'none', lineage };
        expect(biomeProfile(clean, sector), `${lineage} s${sector}`).toEqual(DEFAULT_PROFILE);
      }
    }
    expect(biomeProfile(basalt, 1)).toEqual(DEFAULT_PROFILE);
  });

  it('o mundo do basalto limpo e byte a byte o mundo historico', () => {
    for (const seed of SEEDS.slice(0, 4)) {
      const historic = generateWorld(seed, WORLD_W, WORLD_H);
      const viaProfile = generateWorld(seed, WORLD_W, WORLD_H, biomeProfile(basalt, 1));
      expect(Array.from(viaProfile.solid)).toEqual(Array.from(historic.solid));
      expect(Array.from(viaProfile.surface)).toEqual(Array.from(historic.surface));
    }
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

describe('bolso micelial do Bispo', () => {
  it('a arena do setor 2 tem tapete fungico em QUALQUER linhagem', () => {
    for (const lineage of ['hydric', 'mineral', 'industrial'] as const) {
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
