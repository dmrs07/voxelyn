import { describe, expect, it } from 'vitest';
import { moduleChoiceLayout } from '../client/module-layout';

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
