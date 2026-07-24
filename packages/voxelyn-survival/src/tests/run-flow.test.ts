import { describe, expect, it } from 'vitest';
import { createRun, emptyCommand, stepRun } from '../sim/run';
import type { SurvivalState } from '../sim/types';

const stepIdle = (state: SurvivalState, ticks: number): void => {
  for (let t = 0; t < ticks; t++) stepRun(state, [emptyCommand()]);
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
    const state = createRun({ seed: 11 });
    // teleporta o jogador ao pedestal (atalho de teste; interacao é autoritativa)
    state.player.x = state.corePos.x + 0.5;
    state.player.y = state.corePos.y + 0.5;
    const grab = emptyCommand();
    grab.interact = true;
    const result = stepRun(state, [grab]);
    expect(state.coreTaken).toBe(true);
    expect(state.playerExtra.hasCore).toBe(true);
    expect(result.events.some((e) => e.t === 'pickup_core')).toBe(true);

    state.player.x = state.entry.x + 0.5;
    state.player.y = state.entry.y + 0.5;
    state.playerExtra.iframesUntil = state.tick + 10; // ignora dano de contato no teste
    const extract = emptyCommand();
    extract.interact = true;
    stepRun(state, [extract]);
    expect(state.phase).toBe('extracted_with_core');
  });

  it('cache abre uma unica vez e a escolha aplica exatamente um modificador', () => {
    const state = createRun({ seed: 11 });
    const cache = state.caches[0];
    state.player.x = cache.x + 0.5;
    state.player.y = cache.y + 0.5;

    const interact = emptyCommand();
    interact.interact = true;
    stepRun(state, [interact]);
    expect(state.phase).toBe('choice');
    expect(state.pendingChoice).not.toBeNull();
    expect(cache.opened).toBe(true);
    const consumablesAfterOpen = state.playerExtra.consumables;

    // escolher a opcao 0
    const choose = emptyCommand();
    choose.choose = 0;
    stepRun(state, [choose]);
    expect(state.phase).toBe('running');
    expect(state.playerExtra.modifiers.length).toBe(1);

    // reinteragir com o mesmo cache nao duplica loot (inventario idempotente)
    stepRun(state, [interact]);
    expect(state.phase).not.toBe('choice');
    expect(state.playerExtra.consumables).toBe(consumablesAfterOpen);
    expect(state.playerExtra.modifiers.length).toBe(1);
  });

  it('o guardiao existe, esta vivo e proximo do nucleo', () => {
    const state = createRun({ seed: 11 });
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
