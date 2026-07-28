import { describe, expect, it } from 'vitest';
import { createRun, HEAT_MAX, SURF_FIRE, SURF_GAS, SURF_NONE } from '@voxelyn/survival-sim';
import type { SurvivalState } from '@voxelyn/survival-sim';
import {
  AMBIENCE_RADIUS,
  FALL_TAU_MS,
  RISE_TAU_MS,
  SILENT_AMBIENCE,
  approachLevels,
  sampleAmbience,
} from './ambience';

/** Run limpa com o jogador longe das bordas, para caber o raio de amostragem. */
const fresh = (): SurvivalState => {
  const state = createRun({ seed: 12345 });
  state.surface.fill(SURF_NONE);
  state.enemies.length = 0;
  state.contamination = 0;
  state.player.x = 48;
  state.player.y = 48;
  state.playerExtra.heat = 0;
  return state;
};

/**
 * Pinta `count` celulas em bloco em volta do jogador, sempre DENTRO do raio.
 *
 * Pintar em linha reta era o erro obvio e silencioso: com raio 14, uma linha de
 * 60 celulas so deposita 14 dentro da janela amostrada, e o teste media a
 * geometria do helper em vez do comportamento da amostragem.
 */
const paint = (state: SurvivalState, surf: number, count: number): void => {
  const w = state.config.width;
  const cx = Math.floor(state.player.x);
  const cy = Math.floor(state.player.y);
  const side = Math.min(AMBIENCE_RADIUS, 10);
  let left = count;
  for (let dy = -side; dy <= side && left > 0; dy++) {
    for (let dx = -side; dx <= side && left > 0; dx++) {
      if (dx === 0 && dy === 0) continue;
      state.surface[(cy + dy) * w + cx + dx] = surf;
      left--;
    }
  }
};

describe('amostragem de ambiencia', () => {
  it('mundo vazio nao faz barulho', () => {
    expect(sampleAmbience(fresh(), 1)).toEqual(SILENT_AMBIENCE);
  });

  it('fogo proximo levanta o leito de fogo e satura', () => {
    const poucoFogo = fresh();
    paint(poucoFogo, SURF_FIRE, 5);
    const muitoFogo = fresh();
    paint(muitoFogo, SURF_FIRE, 60);

    const a = sampleAmbience(poucoFogo, 1);
    const b = sampleAmbience(muitoFogo, 1);
    expect(a.fire).toBeGreaterThan(0);
    expect(a.fire).toBeLessThan(b.fire);
    expect(b.fire).toBe(1); // satura, nunca passa de 1
    expect(a.gas).toBe(0); // fogo nao vaza para o leito errado
  });

  // O ponto do sistema: o que esta FORA da tela mas perto ainda soa; o que esta
  // do outro lado do mapa nao. Sem esse recorte o sibilo seria constante a run
  // inteira e o ouvido pararia de registra-lo justamente quando importa.
  it('ignora o que esta alem do raio de amostragem', () => {
    const state = fresh();
    const w = state.config.width;
    const cy = Math.floor(state.player.y);
    const cx = Math.floor(state.player.x);
    state.surface[cy * w + cx + AMBIENCE_RADIUS + 3] = SURF_GAS;
    expect(sampleAmbience(state, 1).gas).toBe(0);

    state.surface[cy * w + cx + AMBIENCE_RADIUS - 1] = SURF_GAS;
    expect(sampleAmbience(state, 1).gas).toBeGreaterThan(0);
  });

  it('le o calor do jogador local, normalizado', () => {
    const state = fresh();
    state.playerExtra.heat = HEAT_MAX / 2;
    expect(sampleAmbience(state, 1).heat).toBeCloseTo(0.5, 5);
    state.playerExtra.heat = HEAT_MAX * 3;
    expect(sampleAmbience(state, 1).heat).toBe(1);
  });

  it('le a contaminacao como o relogio da run', () => {
    const state = fresh();
    state.contamination = 0.42;
    expect(sampleAmbience(state, 1).dread).toBeCloseTo(0.42, 5);
  });

  // Sem ouvinte vivo o mundo continua existindo, mas nao ha de onde ouvi-lo: o
  // fogo nao pode continuar crepitando na tela de morte.
  it('cala tudo quando nao ha jogador vivo', () => {
    const state = fresh();
    paint(state, SURF_FIRE, 30);
    state.contamination = 0.9;
    for (const p of state.players) p.alive = false;
    expect(sampleAmbience(state, 1)).toEqual(SILENT_AMBIENCE);
  });

  it('nao estoura as bordas do mundo', () => {
    const state = fresh();
    state.player.x = 1;
    state.player.y = 1;
    expect(() => sampleAmbience(state, 1)).not.toThrow();
    state.player.x = state.config.width - 1;
    state.player.y = state.config.height - 1;
    expect(() => sampleAmbience(state, 1)).not.toThrow();
  });
});

describe('suavizacao dos leitos', () => {
  const zero = SILENT_AMBIENCE;
  const cheio = { fire: 1, gas: 1, heat: 1, dread: 1, threat: 1 };

  it('nunca salta direto para o alvo', () => {
    const passo = approachLevels(zero, cheio, 16);
    expect(passo.fire).toBeGreaterThan(0);
    expect(passo.fire).toBeLessThan(1);
  });

  // Perigo aparecendo tem de ser imediato; perigo sumindo pode relaxar devagar.
  it('sobe mais rapido do que desce', () => {
    expect(RISE_TAU_MS).toBeLessThan(FALL_TAU_MS);
    const subida = approachLevels(zero, cheio, 100).fire;
    const descida = 1 - approachLevels(cheio, zero, 100).fire;
    expect(subida).toBeGreaterThan(descida);
  });

  // O jogo rebaixa para 30 FPS sozinho sob carga. Com passo fixo por quadro, a
  // ambiencia mudaria de comportamento exatamente nos momentos de mais acao.
  it('avanca o mesmo tanto em 100 ms, a 30 ou a 60 FPS', () => {
    let a = zero;
    for (let i = 0; i < 6; i++) a = approachLevels(a, cheio, 16.67); // ~60 FPS
    let b = zero;
    for (let i = 0; i < 3; i++) b = approachLevels(b, cheio, 33.33); // ~30 FPS
    expect(a.fire).toBeCloseTo(b.fire, 2);
  });

  it('converge para o alvo e nao passa dele', () => {
    let levels = zero;
    for (let i = 0; i < 400; i++) levels = approachLevels(levels, cheio, 16);
    expect(levels.fire).toBeCloseTo(1, 4);
    expect(levels.fire).toBeLessThanOrEqual(1);
  });

  it('trata dt negativo sem andar para tras', () => {
    const passo = approachLevels({ ...zero, fire: 0.5 }, cheio, -100);
    expect(passo.fire).toBeCloseTo(0.5, 5);
  });
});
