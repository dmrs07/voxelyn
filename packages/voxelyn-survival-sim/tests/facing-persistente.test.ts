import { describe, expect, it } from 'vitest';
import { FLAMETHROWER_CHANNEL_TICKS, SOLID_NONE, SURF_NONE } from '../src/constants';
import { createRun, emptyCommand, hashAuthoritativeState, stepRun } from '../src/run';
import type { PlayerCommand, SurvivalState } from '../src/types';

// A regressao que este arquivo guarda: o comando NEUTRO carregava uma mira
// fantasma `{x: 1, y: 0}` (leste, que projeta como o sprite isometrico "dr"), e
// qualquer tick sem input de mira — stick solto, personagem parado, menu aberto,
// slot sem comando — esmagava o facing persistido de volta para DR.

const clearArena = (state: SurvivalState, cx = 40, cy = 40, radius = 12): void => {
  state.enemies = [];
  state.vents = [];
  state.projectiles = [];
  state.player.x = cx + 0.5;
  state.player.y = cy + 0.5;
  for (let y = cy - radius; y <= cy + radius; y++) {
    for (let x = cx - radius; x <= cx + radius; x++) {
      const i = y * state.config.width + x;
      state.solid[i] = SOLID_NONE;
      state.surface[i] = SURF_NONE;
      state.surfaceTimer[i] = 0;
    }
  }
};

const aimCommand = (aim: { x: number; y: number }): PlayerCommand => {
  const command = emptyCommand();
  command.aim = aim;
  return command;
};

/** As oito direcoes isometricas suportadas pela mira. */
const EIGHT_DIRECTIONS = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
  { x: Math.SQRT1_2, y: Math.SQRT1_2 },
  { x: -Math.SQRT1_2, y: Math.SQRT1_2 },
  { x: Math.SQRT1_2, y: -Math.SQRT1_2 },
  { x: -Math.SQRT1_2, y: -Math.SQRT1_2 },
];

describe('facing persistente do jogador', () => {
  it('o comando neutro tem mira ZERO, nao um rumo valido', () => {
    // O default antigo `{1, 0}` era exatamente o bug: "sem mira" codificado
    // como "mirando para leste".
    const command = emptyCommand();
    expect(command.aim).toEqual({ x: 0, y: 0 });
  });

  it('preserva a ultima mira valida em cada uma das oito direcoes apos soltar o stick', () => {
    for (const dir of EIGHT_DIRECTIONS) {
      const state = createRun({ seed: 11 });
      clearArena(state);
      stepRun(state, [aimCommand(dir)]);

      // Solta o stick: dezenas de ticks neutros, nenhum deles pode apagar o rumo.
      for (let tick = 0; tick < 30; tick++) stepRun(state, [emptyCommand()]);

      expect(state.playerExtra.aim.x).toBeCloseTo(dir.x, 5);
      expect(state.playerExtra.aim.y).toBeCloseTo(dir.y, 5);
      expect(state.player.facing.x).toBeCloseTo(dir.x, 5);
      expect(state.player.facing.y).toBeCloseTo(dir.y, 5);
    }
  });

  it('mover sem mirar nao toca no facing: movimento e mira sao eixos separados', () => {
    const state = createRun({ seed: 12 });
    clearArena(state);
    stepRun(state, [aimCommand({ x: 0, y: -1 })]);

    const walk = emptyCommand();
    walk.move = { x: 1, y: 0 };
    for (let tick = 0; tick < 20; tick++) stepRun(state, [walk]);
    // Entra em idle depois de andar: continua olhando para onde mirou.
    for (let tick = 0; tick < 20; tick++) stepRun(state, [emptyCommand()]);

    expect(state.playerExtra.aim).toEqual({ x: 0, y: -1 });
    expect(state.player.facing).toEqual({ x: 0, y: -1 });
  });

  it('disparar e parar nao devolve o facing para DR', () => {
    const state = createRun({ seed: 13 });
    clearArena(state);
    const shooting = aimCommand({ x: 0, y: 1 });
    shooting.fire = true;
    for (let tick = 0; tick < 6; tick++) stepRun(state, [shooting]);

    for (let tick = 0; tick < 30; tick++) stepRun(state, [emptyCommand()]);

    expect(state.playerExtra.aim).toEqual({ x: 0, y: 1 });
    expect(state.player.facing).toEqual({ x: 0, y: 1 });
  });

  it('ativar e terminar o sopro termico preserva o facing', () => {
    const state = createRun({ seed: 14 });
    clearArena(state);
    state.playerExtra.ability = 'flamethrower';
    const command = aimCommand({ x: -1, y: 0 });
    command.ability = true;
    stepRun(state, [command]);

    for (let tick = 0; tick <= FLAMETHROWER_CHANNEL_TICKS + 5; tick++) {
      stepRun(state, [emptyCommand()]);
    }

    expect(state.playerExtra.aim).toEqual({ x: -1, y: 0 });
    expect(state.player.facing).toEqual({ x: -1, y: 0 });
  });

  it('input neutro desde o comeco mantem o default DR de jogador recem-criado', () => {
    // DR como valor INICIAL e legitimo: e o unico caso em que nenhuma direcao
    // anterior existe.
    const state = createRun({ seed: 15 });
    clearArena(state);
    for (let tick = 0; tick < 20; tick++) stepRun(state, [emptyCommand()]);
    expect(state.playerExtra.aim).toEqual({ x: 1, y: 0 });
    expect(state.player.facing).toEqual({ x: 1, y: 0 });
  });

  it('a mira persistida entra no hash autoritativo: snapshot/resync nao pode perde-la', () => {
    const a = createRun({ seed: 16 });
    const b = createRun({ seed: 16 });
    expect(hashAuthoritativeState(a)).toBe(hashAuthoritativeState(b));
    b.playerExtra.aim = { x: 0, y: 1 };
    expect(hashAuthoritativeState(a)).not.toBe(hashAuthoritativeState(b));
  });

  it('uma direcao diferente de DR nunca volta para DR espontaneamente', () => {
    const state = createRun({ seed: 17 });
    clearArena(state);
    stepRun(state, [aimCommand({ x: 0, y: 1 })]);

    // Mistura de tudo que antes reintroduzia o fantasma: neutro, andar, esquiva.
    for (let tick = 0; tick < 120; tick++) {
      const command = emptyCommand();
      if (tick % 3 === 0) command.move = { x: 1, y: 0 };
      if (tick === 40) command.dodge = true;
      stepRun(state, [command]);
      expect(state.player.facing).toEqual({ x: 0, y: 1 });
    }
  });
});
