import { describe, expect, it } from 'vitest';
import { deriveAnim, gunHeatTint, recoilScreenOffset } from './sprites';

/** `rgb(r, g, b)` -> [r, g, b], para comparar a rampa sem depender do formato. */
const channels = (color: string): [number, number, number] => {
  const parts = color.match(/\d+/g);
  if (!parts || parts.length < 3) throw new Error(`cor inesperada: ${color}`);
  return [Number(parts[0]), Number(parts[1]), Number(parts[2])];
};

describe('gunHeatTint', () => {
  it('nao pinta o cano com calor residual', () => {
    expect(gunHeatTint(0, false)).toBeUndefined();
    expect(gunHeatTint(0.17, false)).toBeUndefined();
  });

  it('rubesce antes de abrir em laranja e clarear', () => {
    const warm = gunHeatTint(0.3, false);
    const hot = gunHeatTint(0.7, false);
    const limit = gunHeatTint(1, false);
    expect(warm && hot && limit).toBeTruthy();
    // Vermelho -> laranja -> amarelo: o canal verde e o que sobe monotonicamente
    // ao longo dessa rampa, e e ele que separa os tres estagios.
    const g = [warm, hot, limit].map((tint) => channels(tint!.color)[1]);
    expect(g[0]).toBeLessThan(g[1]);
    expect(g[1]).toBeLessThan(g[2]);
    // E fica sempre abaixo do opaco: o tint e chapado, e em alpha 1 o cano
    // perderia as tres faces e viraria um borrao de uma cor so.
    for (const tint of [warm, hot, limit]) expect(tint!.alpha).toBeLessThan(1);
  });

  it('opacifica conforme aquece', () => {
    expect(gunHeatTint(0.3, false)!.alpha).toBeLessThan(gunHeatTint(0.9, false)!.alpha);
  });

  it('vai a branco opaco no superaquecimento, em qualquer calor', () => {
    // O calor cai para 55% de HEAT_MAX no instante do travamento; o cano nao
    // pode esfriar de aparencia no exato frame em que o gatilho trava.
    for (const heat of [0, 0.55, 1]) {
      const tint = gunHeatTint(heat, true)!;
      expect(tint.alpha).toBe(1);
      expect(channels(tint.color)).toEqual([0xe8, 0xf1, 0xff]);
    }
  });
});

describe('deriveAnim', () => {
  it('mantem walk entre ticks sem reiniciar o ciclo em frames intermediarios', () => {
    let state = deriveAnim(undefined, 0, 0, 100, true, 0);
    expect(state.anim).toBe('idle');

    state = deriveAnim(state, 0.05, 0, 100, true, 16);
    expect(state.anim).toBe('walk');
    const walkStartedAt = state.animStartMs;

    // Render seguinte antes de um novo tick: posicao igual, mas a caminhada nao
    // pode voltar para idle nem reiniciar o elapsedMs no primeiro frame.
    state = deriveAnim(state, 0.05, 0, 100, true, 32);
    expect(state.anim).toBe('walk');
    expect(state.animStartMs).toBe(walkStartedAt);

    state = deriveAnim(state, 0.05, 0, 100, true, 100);
    expect(state.anim).toBe('walk');
    expect(state.animStartMs).toBe(walkStartedAt);

    // Depois da janela sem qualquer deslocamento, idle volta normalmente.
    state = deriveAnim(state, 0.05, 0, 100, true, 137);
    expect(state.anim).toBe('idle');
  });

  it('renova a janela enquanto novos ticks continuam deslocando a entidade', () => {
    let state = deriveAnim(undefined, 0, 0, 100, true, 0);
    state = deriveAnim(state, 0.05, 0, 100, true, 16);
    const walkStartedAt = state.animStartMs;

    state = deriveAnim(state, 0.1, 0, 100, true, 100);
    state = deriveAnim(state, 0.1, 0, 100, true, 180);

    expect(state.anim).toBe('walk');
    expect(state.animStartMs).toBe(walkStartedAt);
  });

  it('preserva a direcao real das pernas durante a janela de movimento', () => {
    let state = deriveAnim(undefined, 1, 1, 100, true, 0);
    state = deriveAnim(state, 1.03, 1.04, 100, true, 16);

    expect(state.moveFacingX).toBeCloseTo(0.6, 5);
    expect(state.moveFacingY).toBeCloseTo(0.8, 5);

    state = deriveAnim(state, 1.03, 1.04, 100, true, 80);
    expect(state.anim).toBe('walk');
    expect(state.moveFacingX).toBeCloseTo(0.6, 5);
    expect(state.moveFacingY).toBeCloseTo(0.8, 5);
  });
});

describe('recoilScreenOffset', () => {
  it('empurra o tronco na direcao oposta a mira isometrica', () => {
    const right = recoilScreenOffset(1, 0, 1, 2);
    expect(right.x).toBeLessThan(0);
    expect(right.y).toBeLessThan(0);

    const left = recoilScreenOffset(-1, 0, 1, 2);
    expect(left.x).toBeGreaterThan(0);
    expect(left.y).toBeGreaterThan(0);
  });

  it('limita a intensidade normalizada', () => {
    const zero = recoilScreenOffset(1, 0, -1, 2);
    expect(Math.hypot(zero.x, zero.y)).toBe(0);
    expect(recoilScreenOffset(1, 0, 2, 2)).toEqual(recoilScreenOffset(1, 0, 1, 2));
  });
});
