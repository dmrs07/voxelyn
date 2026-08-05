import { describe, expect, it } from 'vitest';
import { GUARDIAN_SUMMON_COUNT, DEFAULT_SECTOR_COUNT, SOLID_NONE } from '../src/constants';
import { BOSS_PHASE_SUMMON } from '../src/types';
import { bossArchetypeForBiome } from '../src/bosses';
import { sectorBiome } from '../src/strata';
import { createRun, emptyCommand, stepRun } from '../src/run';
import { countCoresTaken, markSectorBossDown } from '../src/depth';
import { spawnEnemy } from '../src/entities';
import { grantOrRechargeModule } from '../src/modules';
import type { SurvivalState } from '../src/types';

const stepIdle = (state: SurvivalState, ticks: number): void => {
  for (let t = 0; t < ticks; t++) stepRun(state, [emptyCommand()]);
};


/** Primeira seed >= base cujo setor final tem o Guardiao (bossForBiome). */
const guardianSeed = (base: number): number => {
  for (let seed = base; seed < base + 4096; seed++) {
    if (bossArchetypeForBiome(sectorBiome(seed, DEFAULT_SECTOR_COUNT)) === 'guardian') return seed;
  }
  throw new Error(`nenhuma seed proxima de ${base} com Guardiao no setor final`);
};

describe('fluxo da run', () => {
  it('permadeath: morte encerra a run e comandos posteriores nao alteram nada', () => {
    const state = createRun({ seed: 11 });
    state.player.hp = 1;
    // fogo sob o jogador mata no proximo hazard tick
    const w = state.config.width;
    const i = Math.floor(state.player.y) * w + Math.floor(state.player.x);
    state.surface[i] = 4; // SURF_FIRE
    state.surfaceTimer[i] = 100;

    stepIdle(state, 3);
    expect(state.phase).toBe('dead');
    expect(state.player.alive).toBe(false);

    const tickAtDeath = state.tick;
    const cmd = emptyCommand();
    cmd.fire = true;
    cmd.move = { x: 1, y: 0 };
    const before = { x: state.player.x, y: state.player.y };
    stepRun(state, [cmd]);
    expect(state.tick).toBe(tickAtDeath); // sim congelada
    expect(state.player.x).toBe(before.x);
    expect(state.player.y).toBe(before.y);
  });

  it('extracao no spawn e bloqueada ate o jogador deixar a zona de entrada', () => {
    const state = createRun({ seed: 11 });
    const cmd = emptyCommand();
    cmd.interact = true;
    stepRun(state, [cmd]);
    expect(state.phase).toBe('running'); // toque acidental nao encerra a run

    state.leftEntryZone = true; // jogador explorou e voltou
    stepRun(state, [cmd]);
    expect(state.phase).toBe('extracted');
  });

  it('pegar o nucleo e extrair encerra como "extracted_with_core"', () => {
    // Setor final: e o unico com nucleo. Nos anteriores o mesmo ponto e o poco.
    const state = createRun({ seed: guardianSeed(11), sector: DEFAULT_SECTOR_COUNT });
    // O selo do setor cede primeiro: o pedestal so aceita a mao depois de o
    // dono cair (ver depth.ts, coreUnlocked).
    markSectorBossDown(state, state.sector);
    // teleporta o jogador ao pedestal (atalho de teste; interacao é autoritativa)
    state.player.x = state.corePos.x + 0.5;
    state.player.y = state.corePos.y + 0.5;
    const grab = emptyCommand();
    grab.interact = true;
    const result = stepRun(state, [grab]);
    expect(countCoresTaken(state)).toBe(1);
    expect(state.playerExtra.hasCore).toBe(true);
    expect(result.events.some((e) => e.t === 'pickup_core')).toBe(true);

    // REGRA NOVA da extracao de retorno: com o Nucleo, a entrada do setor
    // final nao extrai — SOBE. A vitoria mora na plataforma do setor 1
    // (o contrato completo esta em return-extraction.test.ts).
    state.player.x = state.entry.x + 0.5;
    state.player.y = state.entry.y + 0.5;
    state.playerExtra.iframesUntil = state.tick + 10; // ignora dano de contato no teste
    const extract = emptyCommand();
    extract.interact = true;
    stepRun(state, [extract]);
    expect(state.phase).toBe('running');
    expect(state.sector).toBe(DEFAULT_SECTOR_COUNT - 1);
  });

  it('cofre abre uma unica vez e a escolha privada aplica exatamente um modulo', () => {
    const state = createRun({ seed: 11 });
    const site = state.salvageSites[0];
    site.terminalState = 'complete';
    site.cacheRevealed = true;
    state.player.x = site.cache.x + 0.5;
    state.player.y = site.cache.y + 0.5;

    const interact = emptyCommand();
    interact.interact = true;
    stepRun(state, [interact]);
    expect(state.phase).toBe('running');
    expect(state.playerExtra.pendingModuleChoice).not.toBeNull();
    expect(site.cacheOpened).toBe(true);
    const purgeCellsAfterOpen = state.playerExtra.purgeCells;

    const choose = emptyCommand();
    choose.choose = 0;
    stepRun(state, [choose]);
    expect(state.phase).toBe('running');
    expect(state.playerExtra.activeModules.length).toBe(1);

    stepRun(state, [interact]);
    expect(state.playerExtra.purgeCells).toBe(purgeCellsAfterOpen);
    expect(state.playerExtra.activeModules.length).toBe(1);
  });

  it('o guardiao existe, esta vivo e proximo do nucleo', () => {
    const state = createRun({ seed: guardianSeed(11), sector: DEFAULT_SECTOR_COUNT });
    const guardian = state.enemies.find((e) => e.archetype === 'guardian');
    expect(guardian).toBeDefined();
    expect(guardian!.alive).toBe(true);
    const d = Math.hypot(guardian!.x - state.corePos.x, guardian!.y - state.corePos.y);
    expect(d).toBeLessThan(6);
  });

  it('nenhum inimigo nasce colado no jogador', () => {
    for (const seed of [3, 11, 77, 2024]) {
      const state = createRun({ seed });
      for (const enemy of state.enemies) {
        const d = Math.hypot(enemy.x - state.player.x, enemy.y - state.player.y);
        expect(d).toBeGreaterThan(6);
      }
    }
  });

  it('uma run ociosa longa nao trava nem corrompe o estado (soak curto)', () => {
    const state = createRun({ seed: 500 });
    stepIdle(state, 2000); // 100s de sim
    expect(state.tick).toBeGreaterThan(0);
    expect(['running', 'dead']).toContain(state.phase);
  });
});

describe('guardiao: invocacao de 50%', () => {
  it('nao e bloqueada por um stalker spawnado antes (id maior que o do guardiao)', () => {
    const state = createRun({ seed: guardianSeed(4242), playerCount: 1, sector: DEFAULT_SECTOR_COUNT });
    // acorda o guardiao e o coloca abaixo de 50%
    const guardian = state.enemies.find((e) => e.archetype === 'guardian');
    expect(guardian, 'seed sem guardiao').toBeDefined();
    state.bossRuntime.awake = true;

    // uma onda de contaminacao spawna um stalker ANTES dos 50%: id maior que o
    // do guardiao. Ele morre, mas continua em state.enemies.
    spawnEnemy(state, 'stalker', Math.floor(state.entry.x) + 4, Math.floor(state.entry.y), false);
    const intruder = state.enemies[state.enemies.length - 1];
    expect(intruder.id).toBeGreaterThan(guardian!.id);
    intruder.alive = false;
    intruder.hp = 0;

    const stalkersBefore = state.enemies.filter((e) => e.archetype === 'stalker').length;
    guardian!.hp = guardian!.maxHp * 0.4;
    stepRun(state, [emptyCommand()]);

    // antes: o stalker de id maior fazia a sim achar que ja tinha invocado
    expect(state.bossRuntime.phasesFired & BOSS_PHASE_SUMMON).not.toBe(0);
    // Derivado da constante, e nao um numero fixo: o tamanho da matilha e uma
    // decisao de balanceamento e vai mudar de novo.
    expect(state.enemies.filter((e) => e.archetype === 'stalker').length).toBe(
      stalkersBefore + GUARDIAN_SUMMON_COUNT
    );
  });

  it('invoca uma unica vez, mesmo com o guardiao muito tempo abaixo de 50%', () => {
    const state = createRun({ seed: guardianSeed(4242), playerCount: 1, sector: DEFAULT_SECTOR_COUNT });
    const guardian = state.enemies.find((e) => e.archetype === 'guardian')!;
    state.bossRuntime.awake = true;
    guardian.hp = guardian.maxHp * 0.3;
    stepRun(state, [emptyCommand()]);
    const after = state.enemies.filter((e) => e.archetype === 'stalker').length;
    for (let t = 0; t < 40; t++) stepRun(state, [emptyCommand()]);
    expect(state.enemies.filter((e) => e.archetype === 'stalker').length).toBe(after);
  });
});

/**
 * Abre um corredor horizontal de celulas.
 *
 * Os testes de projetil fixam coordenadas e ate aqui davam sorte de o mapa ser
 * aberto ali. Isso amarrava o teste ao DESENHO do mundo: qualquer mudanca de
 * worldgen (ou da seed derivada de setor) fazia o bolt bater em rocha e o teste
 * falhar por um motivo que nao tem nada a ver com perfuracao.
 */
const clearRow = (state: SurvivalState, x0: number, x1: number, y: number): void => {
  const w = state.config.width;
  for (let x = x0; x <= x1; x++) {
    for (let dy = -1; dy <= 1; dy++) state.solid[(y + dy) * w + x] = SOLID_NONE;
  }
};

describe('projetil perfurante', () => {
  it('atinge cada inimigo uma unica vez ao atravessa-lo', () => {
    const state = createRun({ seed: 777, playerCount: 1 });
    state.enemies = [];
    state.projectiles = [];
    clearRow(state, 36, 48, 40);
    const target = spawnEnemy(state, 'bruiser', 40, 40, false);
    const hpBefore = target.hp;

    // bolt perfurante vindo da esquerda, atravessando o alvo
    state.projectiles.push({
      kind: 'bolt',
      id: 9001,
      owner: state.player.id,
      x: target.x - 1.2,
      y: target.y,
      vx: 13,
      vy: 0,
      damage: 10,
      modules: { piercing: true },
      distanceTravelled: 0,
      hostile: false,
      leavesBiofluid: false,
      ttl: 30,
    });

    // ticks suficientes para o bolt cruzar todo o corpo do alvo
    for (let t = 0; t < 6; t++) stepRun(state, [emptyCommand()]);

    // antes: cada substep dentro do raio aplicava dano de novo
    expect(hpBefore - target.hp).toBe(10);
  });

  it('ainda atinge um SEGUNDO inimigo no caminho', () => {
    const state = createRun({ seed: 777, playerCount: 1 });
    state.enemies = [];
    state.projectiles = [];
    grantOrRechargeModule(state.playerExtra, 'piercing', state.tick);
    clearRow(state, 36, 48, 40);
    const first = spawnEnemy(state, 'bruiser', 40, 40, false);
    const second = spawnEnemy(state, 'bruiser', 43, 40, false);
    const hp1 = first.hp;
    const hp2 = second.hp;

    state.projectiles.push({
      kind: 'bolt',
      id: 9002,
      owner: state.player.id,
      x: first.x - 1.2,
      y: first.y,
      vx: 13,
      vy: 0,
      damage: 10,
      modules: { piercing: true },
      distanceTravelled: 0,
      hostile: false,
      leavesBiofluid: false,
      ttl: 30,
    });
    for (let t = 0; t < 10; t++) stepRun(state, [emptyCommand()]);

    expect(hp1 - first.hp).toBe(10);
    expect(hp2 - second.hp).toBe(10); // perfuracao segue valendo
  });
});
