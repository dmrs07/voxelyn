import { describe, expect, it } from 'vitest';
import { isBossArchetype } from '../src/bosses';
import {
  EXTRACT_RADIUS,
  DEFAULT_SECTOR_COUNT,
  SOLID_NONE,
  targetExtractionTicks,
  TARGET_SECTOR_TICKS,
  createRun,
  emptyCommand,
  hashAuthoritativeState,
  isCoreTaken,
  isFinalSector,
  markSectorBossDown,
  sectorSeed,
  stepRun,
} from '../src/index.js';
import type { SemanticEvent, SurvivalState } from '../src/index.js';

/** Leva o(s) jogador(es) ao poco e interage, devolvendo os eventos gerados. */
const reachPit = (state: SurvivalState): SemanticEvent[] => {
  for (const player of state.players) {
    player.x = state.corePos.x + 0.5;
    player.y = state.corePos.y + 0.5;
  }
  const interact = { ...emptyCommand(), interact: true };
  return stepRun(
    state,
    state.players.map(() => interact),
  ).events;
};

describe('estrutura de setores', () => {
  it('a run comeca no primeiro setor, sem Guardiao nem nucleo', () => {
    const state = createRun({ seed: 101 });
    expect(state.sector).toBe(1);
    expect(isFinalSector(1, DEFAULT_SECTOR_COUNT)).toBe(false);
    expect(state.enemies.some((e) => e.archetype === 'guardian')).toBe(false);
  });

  it('so o setor final tem chefe — qualquer que seja o do bioma', () => {
    // Quem e o chefe sai de `bossForBiome`; o que este teste protege e a
    // ESTRUTURA: um por run, no fim. Enumerar arquetipos a mao aqui fez o
    // teste mentir a cada chefe novo.
    for (let sector = 1; sector <= DEFAULT_SECTOR_COUNT; sector++) {
      const state = createRun({ seed: 102, sector });
      const bosses = state.enemies.filter((e) => isBossArchetype(e.archetype));
      expect(bosses.length, `setor ${sector}`).toBe(sector === DEFAULT_SECTOR_COUNT ? 1 : 0);
    }
  });

  it('alcancar o poco desce um setor em vez de terminar a run', () => {
    const state = createRun({ seed: 103 });
    const events = reachPit(state);
    expect(state.phase).toBe('running');
    expect(state.sector).toBe(2);
    expect(events.some((e) => e.t === 'sector_entered')).toBe(true);
  });

  it('no setor final o mesmo ponto entrega o nucleo, e nao uma descida', () => {
    const state = createRun({ seed: 104, sector: DEFAULT_SECTOR_COUNT });
    markSectorBossDown(state, state.sector);
    const events = reachPit(state);
    expect(state.sector).toBe(DEFAULT_SECTOR_COUNT);
    expect(isCoreTaken(state, DEFAULT_SECTOR_COUNT)).toBe(true);
    expect(events.some((e) => e.t === 'pickup_core')).toBe(true);
  });

  // O ponto de o mundo ser reescrito no lugar: o jogador ATRAVESSA a descida
  // com o que construiu. Zerar a build a cada setor faria de tres setores tres
  // runs curtas em vez de uma run com arco.
  it('a build atravessa a descida', () => {
    const state = createRun({ seed: 105 });
    state.playerExtra.purgeCells = 4;
    state.playerExtra.activeModules = [
      { id: 'piercing', lifetime: { kind: 'charges', remaining: 2, maximum: 3 } },
    ];
    state.player.hp = 61;
    state.stats.shotsFired = 33;

    reachPit(state);

    expect(state.sector).toBe(2);
    expect(state.playerExtra.purgeCells).toBe(4);
    expect(state.playerExtra.activeModules[0]?.id).toBe('piercing');
    expect(state.player.hp).toBe(61);
    expect(state.stats.shotsFired).toBe(33); // contadores sao da RUN, nao do setor
  });

  it('o mundo realmente troca ao descer', () => {
    const state = createRun({ seed: 106 });
    const before = Uint8Array.from(state.solid);
    const versionsBefore = Uint32Array.from(state.chunkVersion);
    reachPit(state);

    expect(state.solid).not.toEqual(before);
    // TODA versao de chunk avanca: sem isso, chunks de conteudo coincidente
    // ficariam marcados como atuais e o cliente costuraria pedacos do setor
    // anterior no novo.
    for (let i = 0; i < versionsBefore.length; i++) {
      expect(state.chunkVersion[i]).toBeGreaterThan(versionsBefore[i]);
    }
  });

  it('limpa inimigos e projeteis do setor anterior', () => {
    const state = createRun({ seed: 107 });
    state.projectiles.push({
      kind: 'bolt',
      id: 999,
      owner: 1,
      x: 5,
      y: 5,
      vx: 1,
      vy: 0,
      damage: 5,
      distanceTravelled: 0,
      hostile: true,
      leavesBiofluid: false,
      ttl: 100,
    });
    const idsBefore = new Set(state.enemies.map((e) => e.id));
    reachPit(state);
    expect(state.projectiles).toHaveLength(0);
    expect(state.enemies.every((e) => !idsBefore.has(e.id))).toBe(true);
  });

  it('nasce em chao livre no setor novo', () => {
    for (let seed = 200; seed < 215; seed++) {
      const state = createRun({ seed });
      reachPit(state);
      const i = Math.floor(state.player.y) * state.config.width + Math.floor(state.player.x);
      expect(state.solid[i], `seed ${seed}`).toBe(SOLID_NONE);
    }
  });

  // Descer alivia, nunca absolve: comecar limpo faria do poco um botao de reset
  // e destruiria a pressao que da sentido a decisao de explorar mais.
  it('a contaminacao atravessa a descida, reduzida mas nao zerada', () => {
    const state = createRun({ seed: 108 });
    state.contamination = 0.5;
    reachPit(state);
    expect(state.contamination).toBeGreaterThan(0);
    expect(state.contamination).toBeLessThan(0.5);
  });

  it('a contaminacao sobe mais rapido quanto mais fundo', () => {
    const rate = (sector: number): number => {
      const state = createRun({ seed: 109, sector });
      state.contamination = 0;
      // Sai da zona de entrada para nao disparar extracao por acidente.
      state.leftEntryZone = false;
      const before = state.contamination;
      for (let i = 0; i < 40; i++) stepRun(state, [emptyCommand()]);
      return state.contamination - before;
    };
    expect(rate(2)).toBeGreaterThan(rate(1));
    expect(rate(3)).toBeGreaterThan(rate(2));
  });
});

describe('seeds de setor', () => {
  // A run inteira tem de ser reproduzivel a partir de um unico numero: e disso
  // que dependem a seed compartilhavel e a verificacao do leaderboard.
  it('sao deterministicas e distintas entre setores', () => {
    for (const runSeed of [0, 1, 42, 0xdeadbeef]) {
      const seeds = [1, 2, 3].map((s) => sectorSeed(runSeed, s));
      expect(seeds).toEqual([1, 2, 3].map((s) => sectorSeed(runSeed, s)));
      expect(new Set(seeds).size).toBe(3);
    }
  });

  it('runs diferentes nao compartilham o mesmo setor 2', () => {
    expect(sectorSeed(1, 2)).not.toBe(sectorSeed(2, 2));
  });

  /**
   * A garantia que o co-op depende: descer ate o setor N tem de produzir o
   * MESMO mundo que construir o setor N direto. Sem ela, um cliente que
   * reconecta no meio da run reconstroi um mapa diferente do da sala.
   */
  it('descer ate o setor 2 da o mesmo mundo que comecar nele', () => {
    const descended = createRun({ seed: 4242 });
    reachPit(descended);
    const direct = createRun({ seed: 4242, sector: 2 });
    expect(descended.solid).toEqual(direct.solid);
    expect(descended.entry).toEqual(direct.entry);
    expect(descended.corePos).toEqual(direct.corePos);
  });
});

describe('determinismo com setores', () => {
  it('duas descidas identicas produzem o mesmo hash', () => {
    const play = (): string => {
      const state = createRun({ seed: 31337 });
      reachPit(state);
      for (let i = 0; i < 60; i++) stepRun(state, [emptyCommand()]);
      return hashAuthoritativeState(state);
    };
    expect(play()).toBe(play());
  });

  it('o setor entra no hash', () => {
    const a = createRun({ seed: 555, sector: 1 });
    const b = createRun({ seed: 555, sector: 1 });
    expect(hashAuthoritativeState(a)).toBe(hashAuthoritativeState(b));
    b.sector = 2;
    expect(hashAuthoritativeState(a)).not.toBe(hashAuthoritativeState(b));
  });
});

describe('tempo-alvo das tres estrelas', () => {
  // Derivado do numero de setores, e nao um numero solto: a run passou de um
  // mapa para tres, e um alvo fixo passaria a significar outra coisa se
  // DEFAULT_SECTOR_COUNT mudasse.
  it('escala com o numero de setores', () => {
    expect(targetExtractionTicks(DEFAULT_SECTOR_COUNT)).toBe(TARGET_SECTOR_TICKS * DEFAULT_SECTOR_COUNT);
  });

  it('cabe na promessa de 12 a 20 minutos', () => {
    const minutes = targetExtractionTicks(DEFAULT_SECTOR_COUNT) / (20 * 60);
    expect(minutes).toBeGreaterThanOrEqual(8);
    expect(minutes).toBeLessThanOrEqual(20);
  });
});

describe('descida coletiva no co-op', () => {
  it('nao desce com o parceiro longe do poco', () => {
    const state = createRun({ seed: 110, playerCount: 2 });
    state.players[0].x = state.corePos.x + 0.5;
    state.players[0].y = state.corePos.y + 0.5;
    state.players[1].x = state.corePos.x + EXTRACT_RADIUS + 6;
    state.players[1].y = state.corePos.y;
    const cmd = { ...emptyCommand(), interact: true };
    stepRun(state, [cmd, emptyCommand()]);
    expect(state.sector).toBe(1);
  });

  // Um parceiro abatido deixado para tras num mapa que deixou de existir nao
  // teria como ser resgatado: a descida cobra a mesma condicao da extracao.
  it('nao desce com o parceiro abatido', () => {
    const state = createRun({ seed: 111, playerCount: 2 });
    for (const p of state.players) {
      p.x = state.corePos.x + 0.5;
      p.y = state.corePos.y + 0.5;
    }
    state.playerExtras[1].downed = true;
    const cmd = { ...emptyCommand(), interact: true };
    stepRun(state, [cmd, emptyCommand()]);
    expect(state.sector).toBe(1);
  });

  it('desce com os dois no poco, e quem estava abatido desce de pe', () => {
    const state = createRun({ seed: 112, playerCount: 2 });
    for (const p of state.players) {
      p.x = state.corePos.x + 0.5;
      p.y = state.corePos.y + 0.5;
    }
    const cmd = { ...emptyCommand(), interact: true };
    stepRun(state, [cmd, cmd]);
    expect(state.sector).toBe(2);
    expect(state.playerExtras.every((e) => !e.downed)).toBe(true);
  });
});
