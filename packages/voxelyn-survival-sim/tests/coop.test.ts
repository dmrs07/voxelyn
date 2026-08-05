import { describe, expect, it } from 'vitest';
import { BLEEDOUT_TICKS, DEFAULT_SECTOR_COUNT } from '../src/constants';
import { countCoresTaken, isCoreTaken, markCoreTaken } from '../src/depth';
import { createRun, emptyCommand, hashAuthoritativeState, stepRun } from '../src/run';
import type { PlayerCommand, SurvivalState } from '../src/types';

const idle = (state: SurvivalState, ticks: number, cmds: PlayerCommand[] = []): void => {
  for (let t = 0; t < ticks; t++) stepRun(state, cmds);
};

describe('co-op: multiplayer na simulacao', () => {
  it('createRun com playerCount=2 cria dois players distintos perto da entrada', () => {
    const state = createRun({ seed: 1, playerCount: 2 });
    expect(state.players.length).toBe(2);
    expect(state.playerExtras.length).toBe(2);
    expect(state.player).toBe(state.players[0]); // alias do slot 0
    expect(state.players[0].id).not.toBe(state.players[1].id);
    const d = Math.hypot(state.players[0].x - state.players[1].x, state.players[0].y - state.players[1].y);
    expect(d).toBeGreaterThan(0);
    expect(d).toBeLessThan(4);
  });

  it('inimigos nao colidem com ids de player em co-op (ids reservados)', () => {
    const state = createRun({ seed: 9, playerCount: 2 });
    const playerIds = new Set(state.players.map((p) => p.id)); // {1, 2}
    for (const e of state.enemies) {
      expect(playerIds.has(e.id), `inimigo com id de player: ${e.id}`).toBe(false);
    }
    expect(state.enemies.every((e) => e.id > 2)).toBe(true);
  });

  it('projetil hostil fere o player 2, nao apenas o slot 0', () => {
    const state = createRun({ seed: 9, playerCount: 2 });
    state.enemies = []; // isola do dano de contato
    const p2 = state.players[1];
    const hpBefore = p2.hp;
    state.projectiles.push({
      kind: 'spit',
      id: 999,
      owner: 100,
      x: p2.x,
      y: p2.y,
      vx: 1,
      vy: 0,
      damage: 9,
      distanceTravelled: 0,
      hostile: true,
      leavesBiofluid: false,
      ttl: 5,
    });
    stepRun(state, [emptyCommand(), emptyCommand()]);
    expect(p2.hp).toBeLessThan(hpBefore);
    expect(state.players[0].hp).toBe(state.players[0].maxHp); // player 1 longe, intacto
  });

  it('slot nao reivindicado (joined=false) fica fora da sim: sem dano, sem co-op', () => {
    const state = createRun({ seed: 21, playerCount: 2 });
    state.playerExtras[1].joined = false; // parceiro ainda nao entrou
    state.enemies = [];

    // fogo sob o avatar reservado nao deve feri-lo
    const w = state.config.width;
    const p2 = state.players[1];
    const i = Math.floor(p2.y) * w + Math.floor(p2.x);
    state.surface[i] = 4; // SURF_FIRE
    state.surfaceTimer[i] = 200;
    idle(state, 5);
    expect(p2.hp).toBe(p2.maxHp);

    // extracao com um unico slot em jogo nao exige o parceiro na saida
    state.leftEntryZone = true;
    state.players[0].x = state.entry.x + 0.5;
    state.players[0].y = state.entry.y + 0.5;
    state.players[1].x = state.entry.x + 30; // longe
    const cmd = emptyCommand();
    cmd.interact = true;
    stepRun(state, [cmd, emptyCommand()]);
    expect(state.phase).toBe('extracted');
  });

  it('ondas de contaminacao disparam UMA vez cada (sentinel nao e apagado)', () => {
    const state = createRun({ seed: 33, playerCount: 1 });
    state.enemies = [];
    state.contamination = 0.4; // cruza o primeiro limiar
    let waveMessages = 0;
    for (let t = 0; t < 200; t++) {
      const res = stepRun(state, [emptyCommand()]);
      waveMessages += res.events.filter(
        (e) => e.t === 'message' && e.key === 'sim.contaminationRising'
      ).length;
    }
    expect(waveMessages).toBe(1); // antes: repetia a cada poucos ticks
    expect(state.contaminationWaves).toBe(1);
  });

  it('sala co-op mantem a escolha privada pendente sem pausar ou autoconceder', () => {
    const state = createRun({ seed: 33, playerCount: 2 });
    state.playerExtras[1].joined = false;
    const site = state.salvageSites[0];
    site.terminalState = 'complete';
    site.cacheRevealed = true;
    state.players[0].x = site.cache.x + 0.5;
    state.players[0].y = site.cache.y + 0.5;
    const interact = emptyCommand();
    interact.interact = true;
    stepRun(state, [interact, emptyCommand()]);
    expect(state.phase).toBe('running');
    expect(state.playerExtras[0].activeModules).toEqual([]);
    expect(state.playerExtras[0].pendingModuleChoice).not.toBeNull();
  });

  it('determinismo co-op: mesma seed e mesmos comandos por slot geram o mesmo hash', () => {
    const scripted = (t: number, slot: number): PlayerCommand => {
      const c = emptyCommand();
      c.move = slot === 0 ? { x: 1, y: 0 } : { x: 0, y: 1 };
      c.aim = { x: Math.cos(t * 0.1 + slot), y: Math.sin(t * 0.1 + slot) };
      c.fire = t % 4 === 0;
      return c;
    };
    const a = createRun({ seed: 4242, playerCount: 2 });
    const b = createRun({ seed: 4242, playerCount: 2 });
    for (let t = 0; t < 300; t++) {
      const cmds = [scripted(t, 0), scripted(t, 1)];
      stepRun(a, cmds);
      stepRun(b, cmds);
    }
    expect(hashAuthoritativeState(a)).toBe(hashAuthoritativeState(b));
  });

  it('um player que cai vira abatido (nao morto) enquanto o outro esta de pe', () => {
    const state = createRun({ seed: 7, playerCount: 2 });
    state.players[0].hp = 1;
    // fogo sob o player 0
    const w = state.config.width;
    state.surface[Math.floor(state.players[0].y) * w + Math.floor(state.players[0].x)] = 4;
    state.surfaceTimer[Math.floor(state.players[0].y) * w + Math.floor(state.players[0].x)] = 200;

    idle(state, 5);
    expect(state.playerExtras[0].downed).toBe(true);
    expect(state.players[0].alive).toBe(true); // abatido, ainda nao morto
    expect(state.phase).toBe('running'); // parceiro de pe mantem a run viva
  });

  it('parceiro revive o abatido ao interagir por perto', () => {
    const state = createRun({ seed: 7, playerCount: 2 });
    // abate o player 1 manualmente
    state.playerExtras[1].downed = true;
    state.playerExtras[1].bleedoutAt = state.tick + BLEEDOUT_TICKS;
    state.players[1].hp = 0;
    // coloca o player 0 ao lado
    state.players[0].x = state.players[1].x + 0.5;
    state.players[0].y = state.players[1].y;

    const revive = emptyCommand();
    revive.interact = true;
    const res = stepRun(state, [revive, emptyCommand()]);

    expect(state.playerExtras[1].downed).toBe(false);
    expect(state.players[1].hp).toBeGreaterThan(0);
    expect(res.events.some((e) => e.t === 'revive')).toBe(true);
  });

  it('a run acaba quando ambos os players caem', () => {
    const state = createRun({ seed: 7, playerCount: 2 });
    // player 0 abatido ha muito tempo (vai sangrar) e player 1 cai agora
    state.playerExtras[0].downed = true;
    state.playerExtras[0].bleedoutAt = state.tick + 1;
    state.players[0].hp = 0;
    state.players[1].hp = 0; // sem aliado de pe -> morre direto

    idle(state, 5);
    expect(state.phase).toBe('dead');
  });

  it('abatido sozinho (solo) morre imediatamente - preserva permadeath', () => {
    const state = createRun({ seed: 7, playerCount: 1 });
    state.player.hp = 1;
    const w = state.config.width;
    state.surface[Math.floor(state.player.y) * w + Math.floor(state.player.x)] = 4;
    state.surfaceTimer[Math.floor(state.player.y) * w + Math.floor(state.player.x)] = 200;
    idle(state, 5);
    expect(state.phase).toBe('dead');
    expect(state.playerExtras[0].downed).toBe(false);
  });

  it('cada slot resolve apenas a propria escolha no co-op', () => {
    const state = createRun({ seed: 7, playerCount: 2 });
    const site = state.salvageSites[0];
    site.terminalState = 'complete';
    site.cacheRevealed = true;
    state.players[0].x = site.cache.x + 0.5;
    state.players[0].y = site.cache.y + 0.5;
    const interact = emptyCommand();
    interact.interact = true;
    stepRun(state, [interact, emptyCommand()]);
    expect(state.playerExtras[0].pendingModuleChoice).not.toBeNull();
    expect(state.playerExtras[1].pendingModuleChoice).toBeNull();
    const choose = emptyCommand();
    choose.choose = 0;
    stepRun(state, [emptyCommand(), choose]);
    expect(state.playerExtras[1].activeModules).toEqual([]);
    stepRun(state, [choose, emptyCommand()]);
    expect(state.playerExtras[0].activeModules).toHaveLength(1);
    expect(site.cacheOpened).toBe(true);
  });

  it('extracao coletiva exige todos os players de pe na saida', () => {
    const state = createRun({ seed: 7, playerCount: 2 });
    state.leftEntryZone = true;
    // player 0 na entrada, player 1 longe
    state.players[0].x = state.entry.x + 0.5;
    state.players[0].y = state.entry.y + 0.5;
    state.players[1].x = state.entry.x + 20;
    state.players[1].y = state.entry.y + 20;

    const interact = emptyCommand();
    interact.interact = true;
    stepRun(state, [interact, emptyCommand()]);
    expect(state.phase).toBe('running'); // parceiro nao esta na saida

    // traz o parceiro para a saida
    state.players[1].x = state.entry.x + 1;
    state.players[1].y = state.entry.y + 1;
    stepRun(state, [interact, emptyCommand()]);
    expect(state.phase).toBe('extracted');
  });
});

/**
 * Poe o Nucleo do setor final na mao de um slot, como se ele o tivesse
 * recolhido. Tres escritas em par (mascara da run, mascara do portador,
 * booleano derivado) — e por isso e um helper e nao tres linhas repetidas:
 * esquecer uma delas produziria um estado que a simulacao nunca cria.
 */
const giveCore = (state: SurvivalState, slot: number): void => {
  markCoreTaken(state, DEFAULT_SECTOR_COUNT);
  state.playerExtras[slot].carriedCoreMask |= 1 << DEFAULT_SECTOR_COUNT;
  state.playerExtras[slot].hasCore = true;
};

describe('nucleo e morte do portador', () => {
  it('portador que sangra ate morrer devolve o nucleo ao mundo', () => {
    const state = createRun({ seed: 7, playerCount: 2 });
    // slot 1 pegou o nucleo e esta abatido, prestes a sangrar
    giveCore(state, 1);
    state.playerExtras[1].downed = true;
    state.playerExtras[1].bleedoutAt = state.tick + 1;
    state.players[1].hp = 0;

    idle(state, 3);

    expect(state.players[1].alive).toBe(false);
    expect(state.playerExtras[1].hasCore).toBe(false);
    // recuperavel pelo parceiro: o pedestal DAQUELE setor reabre
    expect(isCoreTaken(state, DEFAULT_SECTOR_COUNT)).toBe(false);
    expect(countCoresTaken(state)).toBe(0);
  });

  it('parceiro sobrevivente NAO extrai com nucleo que nao carrega', () => {
    const state = createRun({ seed: 7, playerCount: 2 });
    state.enemies = [];
    giveCore(state, 1);
    state.playerExtras[1].downed = true;
    state.playerExtras[1].bleedoutAt = state.tick + 1;
    state.players[1].hp = 0;
    idle(state, 3); // slot 1 morre carregando o nucleo

    // slot 0 vai sozinho para a saida
    state.leftEntryZone = true;
    state.players[0].x = state.entry.x + 0.5;
    state.players[0].y = state.entry.y + 0.5;
    const cmd = emptyCommand();
    cmd.interact = true;
    stepRun(state, [cmd, emptyCommand()]);

    // antes: 'extracted_with_core' sem nunca ter tocado no nucleo
    expect(state.phase).toBe('extracted');
  });

  it('morte solo tambem devolve o nucleo (estado consistente)', () => {
    const state = createRun({ seed: 7, playerCount: 1 });
    giveCore(state, 0);
    state.player.hp = 1;
    const w = state.config.width;
    const i = Math.floor(state.player.y) * w + Math.floor(state.player.x);
    state.surface[i] = 4; // SURF_FIRE
    state.surfaceTimer[i] = 200;
    idle(state, 6);

    expect(state.phase).toBe('dead');
    expect(state.playerExtra.hasCore).toBe(false);
    expect(countCoresTaken(state)).toBe(0);
  });
});
