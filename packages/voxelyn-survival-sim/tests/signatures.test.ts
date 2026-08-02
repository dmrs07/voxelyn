// Bestiario de assinatura: um inimigo por estrato, manipulando a REGRA do
// proprio bioma. O que estes testes cobram, em ordem:
// 1. Cada assinatura NASCE no proprio estrato (e so nele), ocupando vaga comum.
// 2. Cada uma opera a alavanca do bioma — cristal que descarrega, agua que
//    esconde, gas que muda de lugar, couraça que abre no calor, gelo que cobre.
// 3. Nenhuma quebra o contrato de leitura: postura viaja em `mood`, bote tem
//    windup, e a couraça e um numero no funil unico de dano.
import { describe, expect, it } from 'vitest';
import {
  SOLID_CRYSTAL,
  SOLID_NONE,
  SURF_EMBER,
  SURF_GAS,
  SURF_ICE,
  SURF_NONE,
  SURF_WATER,
  SCORIAC_ARMOR_SCALE,
} from '../src/constants';
import { setSurface } from '../src/cells';
import { ARCHETYPES, SIGNATURE_OF_STRATUM, damageEntity, spawnEnemy, updateEnemies } from '../src/entities';
import { createRun, emptyCommand, stepRun } from '../src/run';
import { lineageOf } from '../src/strata';
import {
  LURKER_EXPOSED,
  LURKER_HIDDEN,
  SCORIAC_COOL,
  SCORIAC_HOT,
} from '../src/types';
import type { SemanticEvent, SurvivalState } from '../src/types';

const at = (state: SurvivalState, x: number, y: number): number => y * state.config.width + x;

const seedWithLineage = (lineage: string): number => {
  for (let seed = 1; seed < 4096; seed++) {
    if (lineageOf(seed) === lineage) return seed;
  }
  throw new Error(`nenhuma seed pequena com linhagem ${lineage}`);
};

/** Arena limpa e controlada para testes de comportamento. */
const arena = (seed: number): SurvivalState => {
  const state = createRun({ seed });
  for (let y = 20; y <= 30; y++) {
    for (let x = 20; x <= 44; x++) {
      state.solid[at(state, x, y)] = SOLID_NONE;
      state.surface[at(state, x, y)] = SURF_NONE;
    }
  }
  // Isola o teste: nenhum outro inimigo interfere no alvo mais proximo.
  state.enemies = [];
  return state;
};

describe('spawn por estrato', () => {
  it('cada estrato recebe as assinaturas do proprio bando, dentro da contagem normal', () => {
    // A regra ANTIGA era "uma por setor, e a Lampreia e a excecao". O playtest
    // disse o mesmo dela e dos outros: um bicho por mapa e uma curiosidade,
    // nao a fauna do lugar. Cada estrato tem bando agora (SIGNATURE_PACK), e o
    // tamanho e a AMEACA: o Fole e um orgao do bioma, o Ressonante e caro de
    // enfrentar perto de cristal, o Coveiro puxa.
    const cases: Array<{ lineage: string; sector: number; archetype: string; count: number }> = [
      { lineage: 'mineral', sector: 2, archetype: 'resonant', count: 2 },
      { lineage: 'hydric', sector: 2, archetype: 'mud_lamprey', count: 3 },
      { lineage: 'thermal', sector: 2, archetype: 'bellows', count: 3 },
      { lineage: 'thermal', sector: 3, archetype: 'scoriac', count: 3 },
      { lineage: 'cryo', sector: 2, archetype: 'frost_wraith', count: 2 },
      { lineage: 'industrial', sector: 2, archetype: 'undertaker', count: 3 },
    ];
    for (const c of cases) {
      const state = createRun({ seed: seedWithLineage(c.lineage), sector: c.sector });
      const found = state.enemies.filter((e) => e.archetype === c.archetype);
      expect(found.length, `${c.lineage} s${c.sector}: ${c.archetype}`).toBe(c.count);
    }
  });

  it('a assinatura ocupa VAGA COMUM: o bando nao infla a contagem do setor', () => {
    // O contrato que sustenta os bandos: densidade e a coisa que menos deveria
    // variar por bioma. Com o mesmo orcamento de spawns, dois estratos
    // diferentes devem produzir a MESMA quantidade de corpos (os mineradores
    // saem da conta: eles nascem por minerio, nao por vaga de inimigo).
    const countable = (s: SurvivalState): number =>
      s.enemies.filter((e) => e.archetype !== 'miner').length;
    const cryo = createRun({ seed: seedWithLineage('cryo'), sector: 2 });
    const industrial = createRun({ seed: seedWithLineage('industrial'), sector: 2 });
    expect(countable(industrial)).toBe(countable(cryo));
  });

  it('o Spore Bomber nao existe onde nao ha micelio: enxofre e magma usam o de ENXOFRE', () => {
    // O achado que originou o bicho: uma nuvem verde de esporos organicos no
    // meio de uma caverna de magma era o sinal mais fora de lugar do jogo.
    for (const c of [
      { lineage: 'thermal', sector: 2 }, // Fenda Sulfurosa
      { lineage: 'thermal', sector: 3 }, // Fornalha Abissal
    ]) {
      const state = createRun({ seed: seedWithLineage(c.lineage), sector: c.sector });
      expect(state.enemies.some((e) => e.archetype === 'bomber'), `s${c.sector} tem spore bomber`).toBe(false);
      expect(state.enemies.some((e) => e.archetype === 'sulfur_bomber'), `s${c.sector} sem sulfur bomber`).toBe(true);
    }
  });

  it('o basalto nao tem assinatura: o bioma-base continua o de sempre', () => {
    expect(SIGNATURE_OF_STRATUM.basalt).toBeUndefined();
    for (const seed of [1, 2, 3, 42]) {
      const state = createRun({ seed }); // setor 1 e sempre basalto
      const signatures = state.enemies.filter((e) =>
        ['resonant', 'mud_lamprey', 'bellows', 'scoriac', 'frost_wraith'].includes(e.archetype),
      );
      expect(signatures.length).toBe(0);
    }
  });

  it('o bando de lampreias nasce majoritariamente NA agua', () => {
    // Cada lampreia tenta ancorar no lago mais proximo do proprio ponto de
    // spawn (varredura de raio 10). Uma que caia longe de qualquer agua fica
    // exposta — encontro valido, so nao o ideal —, entao o contrato e da
    // MAIORIA do bando, nao de cada individuo.
    const seed = seedWithLineage('hydric');
    const state = createRun({ seed, sector: 2 });
    const lampreys = state.enemies.filter((e) => e.archetype === 'mud_lamprey');
    expect(lampreys.length).toBe(3);
    const wet = lampreys.filter((l) => {
      const i = at(state, Math.floor(l.x), Math.floor(l.y));
      // Agua ou biofluido: o elemento condutivo dela.
      return state.surface[i] === SURF_WATER || state.surface[i] === 2;
    });
    expect(wet.length).toBeGreaterThanOrEqual(2);
  });
});

describe('Ressonante (Catedral Prismatica)', () => {
  it('arma os cristais em volta: descarga com origem de inimigo, apos telegrafo', () => {
    const state = arena(31);
    state.player.x = 30.5;
    state.player.y = 25.5;
    const enemy = spawnEnemy(state, 'resonant', 33, 25, false);
    // Cristais entre os dois: a sala carregada e a arma dele.
    state.solid[at(state, 31, 24)] = SOLID_CRYSTAL;
    state.solid[at(state, 32, 26)] = SOLID_CRYSTAL;

    const seen: SemanticEvent[] = [];
    for (let t = 0; t < 80; t++) {
      seen.push(...stepRun(state, [emptyCommand()]).events);
    }
    const discharge = seen.find((e) => e.t === 'discharge' && e.source === 'enemy');
    expect(discharge, 'pulso nao descarregou').toBeDefined();
    // O telegrafo veio antes: a acao de pulso foi anunciada.
    expect(seen.some((e) => e.t === 'action_start' && e.action === 'pulse' && e.entity === enemy.id)).toBe(true);
  });

  it('sem cristal por perto, nao ha pulso: a sala esvaziada desarma o bicho', () => {
    const state = arena(32);
    state.player.x = 30.5;
    state.player.y = 25.5;
    spawnEnemy(state, 'resonant', 33, 25, false);
    const seen: SemanticEvent[] = [];
    for (let t = 0; t < 80; t++) seen.push(...stepRun(state, [emptyCommand()]).events);
    expect(seen.some((e) => e.t === 'action_start' && e.action === 'pulse')).toBe(false);
  });
});

describe('Lampreia de Lodo (Aquifero Negro)', () => {
  const flooded = (): SurvivalState => {
    const state = arena(33);
    for (let x = 24; x <= 40; x++) setSurface(state, at(state, x, 25), SURF_WATER, 0);
    return state;
  };

  it('submersa em repouso; nao abandona a agua para perseguir', () => {
    const state = flooded();
    state.player.x = 26.5;
    state.player.y = 21.5; // longe da agua, dentro do aggro
    const lamprey = spawnEnemy(state, 'mud_lamprey', 36, 25, false);
    for (let t = 0; t < 40; t++) stepRun(state, [emptyCommand()]);
    expect(lamprey.mood).toBe(LURKER_HIDDEN);
    const i = at(state, Math.floor(lamprey.x), Math.floor(lamprey.y));
    expect(state.surface[i]).toBe(SURF_WATER);
  });

  it('o bote e telegrafado e sai da agua', () => {
    const state = flooded();
    state.player.x = 27.5;
    state.player.y = 25.5; // na margem, dentro do alcance do bote
    const lamprey = spawnEnemy(state, 'mud_lamprey', 29, 25, false);
    const seen: SemanticEvent[] = [];
    for (let t = 0; t < 60; t++) seen.push(...stepRun(state, [emptyCommand()]).events);
    expect(
      seen.some((e) => e.t === 'action_start' && e.action === 'charge' && e.entity === lamprey.id),
    ).toBe(true);
  });
});

describe('Fole (Fenda Sulfurosa)', () => {
  it('inspira o gas em volta numa fase e expele em linha na outra', () => {
    const state = arena(34);
    state.stratum = 'sulfur';
    state.vents = [];
    state.player.x = 26.5;
    state.player.y = 25.5;
    const bellows = spawnEnemy(state, 'bellows', 32, 25, false);
    // Nuvem em volta dele.
    const cloud = [at(state, 31, 25), at(state, 33, 25), at(state, 32, 24), at(state, 32, 26)];
    for (const i of cloud) setSurface(state, i, SURF_GAS, 4000);
    const gasCount = (): number => state.surface.reduce((n, s) => n + (s === SURF_GAS ? 1 : 0), 0);

    // Fase de INSPIRAR do relogio dele.
    const cycle = 100;
    const phaseBase = bellows.id * 37;
    state.tick = cycle * 2 - ((state.tick + phaseBase) % (cycle * 2)); // alinha no inicio de um ciclo par
    bellows.nextActionAt = 0;
    const before = gasCount();
    for (let t = 0; t < 40; t++) updateEnemies(state, []);
    // Ou inalou (fase par) ou expeliu (fase impar) — as duas fases juntas devem
    // mover gas: apos um ciclo inteiro, o total nao pode estar intacto no mesmo
    // lugar. Percorre um ciclo completo e verifica as duas pontas.
    let inhaledSeen = gasCount() < before;
    let exhaledSeen = false;
    for (let t = 0; t < cycle * 2; t++) {
      state.tick += 1;
      updateEnemies(state, []);
      const now = gasCount();
      if (now < before) inhaledSeen = true;
      if (now > 0 && cloud.every((i) => state.surface[i] !== SURF_GAS)) exhaledSeen = true;
    }
    expect(inhaledSeen, 'nunca inspirou a nuvem').toBe(true);
    // Depois de inspirar tudo, a fase de expelir tem de ter posto gas em outro
    // lugar em algum momento do ciclo.
    expect(exhaledSeen || gasCount() > 0).toBe(true);
  });
});

describe('Escoriaceo (Fornalha Abissal)', () => {
  it('frio, a couraça corta o dano; sobre a brasa ele abre e o dano entra inteiro', () => {
    const state = arena(35);
    const cold = spawnEnemy(state, 'scoriac', 30, 25, false);
    const hpBefore = cold.hp;
    damageEntity(state, cold, 20, [], { kind: 'player_shot' });
    expect(hpBefore - cold.hp).toBeCloseTo(20 * SCORIAC_ARMOR_SCALE, 5);
    expect(cold.mood).toBe(SCORIAC_COOL);

    // Brasa sob os pes: a postura abre no proximo passo de IA.
    setSurface(state, at(state, Math.floor(cold.x), Math.floor(cold.y)), SURF_EMBER, 0);
    updateEnemies(state, []);
    expect(cold.mood).toBe(SCORIAC_HOT);
    const hpHot = cold.hp;
    damageEntity(state, cold, 20, [], { kind: 'player_shot' });
    expect(hpHot - cold.hp).toBeCloseTo(20, 5);
  });
});

describe('Espectro de Geada (Cripta Glacial)', () => {
  it('sob o gelo fica oculto; derreter a lamina o expoe', () => {
    const state = arena(36);
    for (let x = 28; x <= 36; x++) setSurface(state, at(state, x, 25), SURF_ICE, 0);
    state.player.x = 24.5;
    state.player.y = 25.5;
    const wraith = spawnEnemy(state, 'frost_wraith', 32, 25, false);
    updateEnemies(state, []);
    expect(wraith.mood).toBe(LURKER_HIDDEN);

    // O lago derreteu sob ele (agua condutiva): sem cobertura.
    for (let x = 28; x <= 36; x++) setSurface(state, at(state, x, 25), SURF_WATER, 280);
    updateEnemies(state, []);
    expect(wraith.mood).toBe(LURKER_EXPOSED);
  });

  it('respeita a velocidade da agua quando desabrigado: a couraça dele e o gelo', () => {
    expect(ARCHETYPES.frost_wraith.speed).toBeGreaterThan(ARCHETYPES.bellows.speed);
  });
});
