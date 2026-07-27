import { describe, expect, it } from 'vitest';
import { moduleChoiceLayout, rewardFlightPosition } from '../client/module-layout';

const inside = (rect: { x: number; y: number; w: number; h: number }, w: number, h: number): boolean =>
  rect.x >= 0 && rect.y >= 0 && rect.x + rect.w <= w && rect.y + rect.h <= h;

describe('layout responsivo da escolha de modulos', () => {
  it.each([
    [360, 640],
    [390, 844],
  ])('empilha cards em portrait %sx%s sem sair da viewport', (w, h) => {
    const [a, b] = moduleChoiceLayout(w, h, { top: 12, right: 8, bottom: 20, left: 8 }, 150);
    expect(a.x).toBe(b.x);
    expect(b.y).toBeGreaterThan(a.y + a.h);
    expect(inside(a, w, h)).toBe(true);
    expect(inside(b, w, h)).toBe(true);
  });

  it.each([
    [844, 390],
    [1280, 720],
  ])('coloca cards lado a lado em landscape %sx%s', (w, h) => {
    const [a, b] = moduleChoiceLayout(w, h, { top: 8, right: 8, bottom: 8, left: 8 }, 0);
    expect(a.y).toBe(b.y);
    expect(b.x).toBeGreaterThan(a.x + a.w);
    expect(inside(a, w, h)).toBe(true);
    expect(inside(b, w, h)).toBe(true);
  });

  it('reserva a faixa dos controles touch', () => {
    const h = 844;
    const reserve = 180;
    const cards = moduleChoiceLayout(390, h, { top: 0, right: 0, bottom: 24, left: 0 }, reserve);
    for (const card of cards) expect(card.y + card.h).toBeLessThanOrEqual(h - 24 - reserve);
  });
});


describe('trajetoria visual da Celula de Purga', () => {
  it('parte do cofre, faz um arco e termina exatamente na HUD', () => {
    const from = { x: 320, y: 420 };
    const to = { x: 28, y: 54 };
    expect(rewardFlightPosition(from, to, 0, 650)).toEqual({ ...from, progress: 0 });
    const middle = rewardFlightPosition(from, to, 325, 650);
    expect(middle.progress).toBe(0.5);
    expect(middle.y).toBeLessThan(from.y + (to.y - from.y) * 0.875);
    const end = rewardFlightPosition(from, to, 900, 650);
    expect(end.x).toBeCloseTo(to.x);
    expect(end.y).toBeCloseTo(to.y);
    expect(end.progress).toBe(1);
  });
});
