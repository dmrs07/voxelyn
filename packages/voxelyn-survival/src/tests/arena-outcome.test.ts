import { describe, expect, it } from 'vitest';
import { stepRun, type PlayerCommand } from '@voxelyn/survival-sim';
import { arenaOutcomeFor } from '../client/arena-outcome';
import { createArenaRun } from '../client/arena-setup';

const emptyCommand: PlayerCommand = {
  move: { x: 0, y: 0 },
  aim: { x: 0, y: 0 },
  fire: false,
  ability: false,
  dodge: false,
  interact: false,
  purge: false,
  choose: null,
};

describe('arenaOutcomeFor', () => {
  it('is null while the boss is alive and the Prospector is standing', () => {
    const state = createArenaRun({ boss: 'guardian', maxHp: 100, ability: 'pulse', modules: [] });
    expect(arenaOutcomeFor(state, 'guardian')).toBeNull();
  });

  it("is 'victory' the instant the CHOSEN boss flips to defeated", () => {
    const state = createArenaRun({ boss: 'guardian', maxHp: 100, ability: 'pulse', modules: [] });
    state.sectorBoss.defeated = true;
    expect(arenaOutcomeFor(state, 'guardian')).toBe('victory');
  });

  it("is 'defeat' when the Prospector dies, even if the boss also fell", () => {
    const state = createArenaRun({ boss: 'guardian', maxHp: 100, ability: 'pulse', modules: [] });
    state.sectorBoss.defeated = true;
    state.phase = 'dead';
    // Dano simultaneo: o Prospector nao sobrevive para comemorar a queda do chefe.
    expect(arenaOutcomeFor(state, 'guardian')).toBe('defeat');
  });

  it('never fires victory for a boss OTHER than the one selected', () => {
    const state = createArenaRun({ boss: 'guardian', maxHp: 100, ability: 'pulse', modules: [] });
    // `sectorBoss.archetype` so muda por `descend`/`ascend`; simulado aqui so
    // para provar que o predicado compara pelo chefe ESCOLHIDO, nao qualquer um.
    state.sectorBoss.archetype = 'bishop';
    state.sectorBoss.defeated = true;
    expect(arenaOutcomeFor(state, 'guardian')).toBeNull();
  });

  it('stays null across live ticks until the boss is actually brought down', () => {
    const state = createArenaRun({ boss: 'guardian', maxHp: 500, ability: 'pulse', modules: [] });
    for (let i = 0; i < 50 && arenaOutcomeFor(state, 'guardian') === null; i++) {
      stepRun(state, [emptyCommand]);
    }
    // Parado na entrada, sem provocar o chefe: nem vitoria nem derrota em 50 ticks.
    expect(arenaOutcomeFor(state, 'guardian')).toBeNull();
    expect(state.phase).toBe('running');
  });
});
