import { describe, expect, it } from 'vitest';
import { TICK_MS, createRun, emptyCommand, stepRun } from '@voxelyn/survival-sim';
import type { SurvivalState, Vec2 } from '@voxelyn/survival-sim';
import { LocalPlayout } from './local-playout';

/**
 * O que o jogador VE no solo, quadro a quadro.
 *
 * O defeito que este arquivo tranca e o irmao local do "senti meu personagem
 * teleportar" do co-op: a simulacao anda a 20 Hz, o monitor a 60, e o desenho
 * saia do tick recem-simulado sem nada entre um e outro. Dois de cada tres
 * quadros nao mexiam um pixel e o terceiro saltava o tick inteiro.
 *
 * Ele nunca apareceu em teste de simulacao porque a simulacao esta CERTA — ela
 * produz os mesmos ticks nos mesmos instantes com ou sem o defeito. O que estava
 * errado era o intervalo entre eles, e e so olhando quadro a quadro, com o
 * acumulador de verdade, que ele aparece.
 */

/** O laco do solo sem canvas: acumulador, `stepRun` e a vista de cada quadro. */
class SoloLoop {
  readonly playout = new LocalPlayout();
  state: SurvivalState;
  private accumulator = 0;

  constructor(seed = 4242) {
    this.state = createRun({ seed });
    this.playout.capture(this.state);
  }

  /** Um quadro de render de `deltaMs`. Devolve a vista que seria desenhada. */
  frame(deltaMs: number, move: Vec2): SurvivalState {
    this.accumulator += deltaMs;
    while (this.accumulator >= TICK_MS) {
      const cmd = emptyCommand();
      cmd.move = { x: move.x, y: move.y };
      stepRun(this.state, [cmd]);
      this.playout.capture(this.state);
      this.accumulator -= TICK_MS;
    }
    const view = this.playout.sample(this.state, this.accumulator / TICK_MS);
    if (!view) throw new Error('sem retrato: `capture` nao foi chamado');
    return view;
  }
}

/** Rumo que sai da entrada sem esbarrar na parede logo no primeiro passo. */
const openDirection = (seed: number): Vec2 => {
  const candidates: Vec2[] = [
    { x: 1, y: 0 },
    { x: 0, y: 1 },
    { x: -1, y: 0 },
    { x: 0, y: -1 },
  ];
  let best = candidates[0];
  let bestTravel = -1;
  for (const dir of candidates) {
    const probe = createRun({ seed });
    const from = { x: probe.player.x, y: probe.player.y };
    for (let i = 0; i < 30; i++) {
      const cmd = emptyCommand();
      cmd.move = dir;
      stepRun(probe, [cmd]);
    }
    const travel = Math.hypot(probe.player.x - from.x, probe.player.y - from.y);
    if (travel > bestTravel) {
      bestTravel = travel;
      best = dir;
    }
  }
  return best;
};

/** Deslocamento desenhado de um quadro para o outro, em tiles. */
const steps = (positions: Array<{ x: number; y: number }>): number[] => {
  const out: number[] = [];
  for (let i = 1; i < positions.length; i++) {
    out.push(Math.hypot(positions[i].x - positions[i - 1].x, positions[i].y - positions[i - 1].y));
  }
  return out;
};

const FRAME_60_HZ = 1000 / 60;

describe('LocalPlayout: o movimento desenhado a 60 Hz', () => {
  /**
   * O defeito, medido. Sem interpolacao o corpo desenhado e o do ultimo tick
   * inteiro, entao a 60 Hz ele fica parado em dois de cada tres quadros — e o
   * terceiro paga a conta de uma vez.
   */
  it('sem a vista, dois de cada tres quadros nao saem do lugar', () => {
    const seed = 4242;
    const dir = openDirection(seed);
    const loop = new SoloLoop(seed);
    const live: Array<{ x: number; y: number }> = [];
    for (let i = 0; i < 120; i++) {
      loop.frame(FRAME_60_HZ, dir);
      live.push({ x: loop.state.player.x, y: loop.state.player.y });
    }
    const frozen = steps(live).filter((d) => d < 1e-9).length;
    expect(frozen).toBeGreaterThan(steps(live).length * 0.5);
  });

  it('com a vista, todo quadro anda — e anda a mesma fracao', () => {
    const seed = 4242;
    const dir = openDirection(seed);
    const loop = new SoloLoop(seed);
    const drawn: Array<{ x: number; y: number }> = [];
    // O primeiro quadro ainda nao tem dois retratos; a medida comeca depois.
    for (let i = 0; i < 5; i++) loop.frame(FRAME_60_HZ, dir);
    for (let i = 0; i < 120; i++) {
      const view = loop.frame(FRAME_60_HZ, dir);
      drawn.push({ x: view.player.x, y: view.player.y });
    }
    const moved = steps(drawn);
    expect(Math.min(...moved)).toBeGreaterThan(0);
    // A 60 Hz cada quadro vale um terco de tick. A folga cobre a aceleracao do
    // proprio andar; o que nao pode e um quadro valer o triplo do outro.
    expect(Math.max(...moved)).toBeLessThan(Math.min(...moved) * 2);
  });

  /**
   * A defasagem e de um tick CRAVADO — o piso do co-op, sem a estimativa de
   * jitter que uma fonte local nao precisa. Se ela crescer, o jogador passa a
   * mirar mais atras do que ve.
   */
  it('a vista fica exatamente um tick atras da simulacao', () => {
    const seed = 4242;
    const dir = openDirection(seed);
    const loop = new SoloLoop(seed);
    // O primeiro tick ainda nao foi simulado: ate ele existir ha um retrato so,
    // e a vista e ele proprio. A defasagem comeca quando ha entre o que cair.
    while (loop.state.tick < 1) loop.frame(FRAME_60_HZ, dir);
    for (let i = 0; i < 60; i++) {
      const view = loop.frame(FRAME_60_HZ, dir);
      expect(view.tick).toBe(loop.state.tick - 1);
    }
  });

  /** Quadro longo (aba que voltou) nao pode extrapolar para alem do simulado. */
  it('quadro que simula varios ticks de uma vez cai entre os dois ultimos', () => {
    const seed = 4242;
    const dir = openDirection(seed);
    const loop = new SoloLoop(seed);
    loop.frame(FRAME_60_HZ, dir);
    const view = loop.frame(TICK_MS * 5, dir);
    expect(view.tick).toBe(loop.state.tick - 1);
  });
});

describe('LocalPlayout: o que a vista NAO faz', () => {
  it('nao escreve a posicao interpolada de volta na simulacao', () => {
    const loop = new SoloLoop(7);
    const dir = openDirection(7);
    for (let i = 0; i < 10; i++) loop.frame(FRAME_60_HZ, dir);
    const before = { x: loop.state.player.x, y: loop.state.player.y };
    loop.playout.sample(loop.state, 0.5);
    expect(loop.state.player.x).toBe(before.x);
    expect(loop.state.player.y).toBe(before.y);
  });

  /**
   * Amostrar duas vezes o mesmo instante tem de dar a mesma posicao. Se a vista
   * escrevesse no retrato em vez de devolver copia, cada quadro partiria de onde
   * o anterior parou e o corpo derivaria para a frente sozinho.
   */
  it('amostrar de novo o mesmo instante da a mesma posicao', () => {
    const loop = new SoloLoop(7);
    const dir = openDirection(7);
    for (let i = 0; i < 10; i++) loop.frame(FRAME_60_HZ, dir);
    const a = loop.playout.sample(loop.state, 0.5)!;
    const b = loop.playout.sample(loop.state, 0.5)!;
    expect(b.player.x).toBe(a.player.x);
    expect(b.player.y).toBe(a.player.y);
  });
});

describe('LocalPlayout: estado discreto e descontinuidade', () => {
  /**
   * A regra herdada do co-op: posicao vem de entre os dois retratos, todo o
   * resto vem do retrato JA ALCANCADO. Lido do seguinte, a criatura sumiria
   * antes de o corpo dela chegar onde morreu.
   */
  it('a criatura que sai no tick seguinte continua desenhada ate a linha chegar nele', () => {
    const state = createRun({ seed: 99 });
    const playout = new LocalPlayout();
    for (let i = 0; i < 40; i++) stepRun(state, [emptyCommand()]);
    expect(state.enemies.length).toBeGreaterThan(0);

    playout.capture(state);
    const doomed = state.enemies[0];
    // Um tick em que ela deixa de existir, sem depender de quem a matou.
    state.tick += 1;
    state.enemies = state.enemies.filter((e) => e.id !== doomed.id);
    playout.capture(state);

    const mid = playout.sample(state, 0.5)!;
    expect(mid.enemies.some((e) => e.id === doomed.id)).toBe(true);
    expect(mid.tick).toBe(state.tick - 1);
  });

  /**
   * A descida troca o mundo inteiro sob os mesmos ids. Interpolar entre os dois
   * arrastaria o Prospector do poco ate a entrada do setor novo por cima de um
   * terreno que o retrato anterior nao descreve.
   */
  it('descer de setor reengata em vez de interpolar', () => {
    const state = createRun({ seed: 99 });
    const playout = new LocalPlayout();
    for (let i = 0; i < 20; i++) stepRun(state, [emptyCommand()]);
    playout.capture(state);

    state.tick += 1;
    state.sector += 1;
    state.player.x += 30;
    state.player.y += 30;
    playout.capture(state);

    const view = playout.sample(state, 0.5)!;
    expect(view.player.x).toBe(state.player.x);
    expect(view.player.y).toBe(state.player.y);
    expect(view.tick).toBe(state.tick);
  });

  it('depois do reengate o proximo par volta a interpolar', () => {
    const state = createRun({ seed: 99 });
    const playout = new LocalPlayout();
    playout.capture(state);
    state.tick += 1;
    state.sector += 1;
    playout.capture(state);

    const x0 = state.player.x;
    state.tick += 1;
    state.player.x += 1;
    playout.capture(state);

    const view = playout.sample(state, 0.5)!;
    expect(view.player.x).toBeCloseTo(x0 + 0.5, 6);
  });
});
