import { describe, expect, it } from 'vitest';
import { createRun, emptyCommand, stepRun } from '../src/run';
import { ARCHETYPES, spawnEnemy } from '../src/entities';
import { PLAYER_SPEED, SOLID_NONE, SOLID_ROCK, SURF_NONE, TICK_HZ } from '../src/constants';
import type { SurvivalState } from '../src/types';

/**
 * Mundo TOTALMENTE aberto com moldura solida, jogador no centro.
 *
 * Medir velocidade num mapa gerado nao mede velocidade: mede colisao. A primeira
 * versao destas medicoes rodou na arena da run e devolveu de 39% a 100% por
 * direcao, o que parecia um bug enorme de movimento e era o jogador raspando na
 * parede perto da entrada.
 */
const openWorld = (state: SurvivalState): void => {
  const w = state.config.width;
  const h = state.config.height;
  state.solid.fill(SOLID_NONE);
  state.surface.fill(SURF_NONE);
  state.surfaceTimer.fill(0);
  for (let x = 0; x < w; x++) {
    state.solid[x] = SOLID_ROCK;
    state.solid[(h - 1) * w + x] = SOLID_ROCK;
  }
  for (let y = 0; y < h; y++) {
    state.solid[y * w] = SOLID_ROCK;
    state.solid[y * w + w - 1] = SOLID_ROCK;
  }
  state.enemies.length = 0;
  state.projectiles.length = 0;
  state.vents.length = 0;
  state.player.x = w / 2;
  state.player.y = h / 2;
};

const TICKS = 20;

/** Tiles por tick que o jogador realmente andou com este comando. */
const measurePlayer = (move: { x: number; y: number }): number => {
  const state = createRun({ seed: 4242 });
  openWorld(state);
  const x0 = state.player.x;
  const y0 = state.player.y;
  const cmd = { ...emptyCommand(), move };
  for (let t = 0; t < TICKS; t++) stepRun(state, [cmd]);
  return Math.hypot(state.player.x - x0, state.player.y - y0) / TICKS;
};

describe('velocidade do jogador', () => {
  // O bug classico de jogo isometrico: andar na diagonal soma os catetos e sai
  // 1,41x mais rapido. Aqui ele NAO existe, e este teste e o que garante que
  // continue nao existindo — `stepPlayer` normaliza por `hypot` antes de aplicar.
  //
  // As oito direcoes sao os vetores de MUNDO que a conversao isometrica de
  // `input.ts` produz para cada combinacao de teclas.
  it('e a mesma nas oito direcoes', () => {
    const esperado = PLAYER_SPEED / TICK_HZ;
    const dirs: Array<[string, number, number]> = [
      ['D', 1, -1],
      ['A', -1, 1],
      ['S', 2, 2],
      ['W', -2, -2],
      ['W+D', -1, -3],
      ['S+D', 3, 1],
      ['W+A', -3, -1],
      ['S+A', 1, 3],
    ];
    for (const [label, x, y] of dirs) {
      const d = measurePlayer({ x, y });
      expect(d, `${label} saiu de ${esperado}`).toBeCloseTo(esperado, 5);
    }
  });

  // O comando carrega DIRECAO e MAGNITUDE, e a magnitude e a fracao de
  // velocidade. Nada que o cliente mande pode passar de 1.
  it('nunca passa da velocidade base, nem com comando exagerado', () => {
    const esperado = PLAYER_SPEED / TICK_HZ;
    for (const move of [{ x: 50, y: 50 }, { x: 999, y: 0 }, { x: 3, y: -7 }]) {
      expect(measurePlayer(move)).toBeLessThanOrEqual(esperado + 1e-9);
    }
  });

  it('respeita magnitude parcial, para o analogico', () => {
    const esperado = PLAYER_SPEED / TICK_HZ;
    // Meia magnitude em MUNDO: meia velocidade, independente do rumo.
    expect(measurePlayer({ x: 0.5, y: 0 })).toBeCloseTo(esperado * 0.5, 4);
    expect(measurePlayer({ x: 0, y: 0.5 })).toBeCloseTo(esperado * 0.5, 4);
    expect(measurePlayer({ x: 0.354, y: -0.354 })).toBeCloseTo(esperado * 0.5, 3);
  });
});

describe('velocidade dos inimigos', () => {
  // Havia um segundo empurrao no eixo livre quando o outro travava, somado por
  // cima do deslocamento que `moveEntity` ja tinha feito. Resultado medido: um
  // spitter colado na parede andava a 114% da propria velocidade — raspar parede
  // era mais rapido que correr em campo aberto.
  it('raspar parede nunca e mais rapido que correr solto', () => {
    const state = createRun({ seed: 8 });
    openWorld(state);
    const w = state.config.width;
    const cx = Math.floor(w / 2);
    const cy = Math.floor(state.config.height / 2);
    for (let dy = -25; dy <= 25; dy++) state.solid[(cy + dy) * w + cx] = SOLID_ROCK;

    const e = spawnEnemy(state, 'spitter', cx - 1, cy, false);
    e.alertedUntil = Number.MAX_SAFE_INTEGER;
    e.x = cx - 0.35; // colado: `blockedX` desde o primeiro tick
    // Diagonal: dirX empurra na parede, dirY domina e fica livre.
    state.player.x = e.x + 6;
    state.player.y = e.y - 7.8;

    const speed = ARCHETYPES.spitter.speed / TICK_HZ;
    const x0 = e.x;
    const y0 = e.y;
    for (let t = 0; t < TICKS; t++) stepRun(state, [emptyCommand()]);
    const perTick = Math.hypot(e.x - x0, e.y - y0) / TICKS;

    expect(perTick).toBeGreaterThan(0); // deslizou de verdade, nao grudou
    expect(perTick).toBeLessThanOrEqual(speed + 1e-9);
  });
});
