import { describe, expect, it } from 'vitest';
import { BLEEDOUT_TICKS } from '../src/constants';
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

  it('cache no co-op concede modificador na hora, sem pausar a sim', () => {
    const state = createRun({ seed: 7, playerCount: 2 });
    const cache = state.caches[0];
    state.players[0].x = cache.x + 0.5;
    state.players[0].y = cache.y + 0.5;
    const interact = emptyCommand();
    interact.interact = true;
    stepRun(state, [interact, emptyCommand()]);
    expect(state.phase).toBe('running'); // nunca entra em 'choice'
    expect(state.playerExtras[0].modifiers.length).toBe(1);
    expect(cache.opened).toBe(true);
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
