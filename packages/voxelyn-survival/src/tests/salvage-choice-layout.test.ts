import { describe, expect, it } from 'vitest';
import { moduleChoiceLayout } from '../client/module-layout';
import { choiceBootPhase, salvageTerminalLayout } from '../client/salvage-choice-presentation';

type Safe = { top: number; right: number; bottom: number; left: number };
const NONE: Safe = { top: 0, right: 0, bottom: 0, left: 0 };
const NOTCH: Safe = { top: 24, right: 44, bottom: 20, left: 44 };

const contains = (outer: { x: number; y: number; w: number; h: number }, inner: { x: number; y: number; w: number; h: number }): boolean =>
  inner.x >= outer.x &&
  inner.y >= outer.y &&
  inner.x + inner.w <= outer.x + outer.w &&
  inner.y + inner.h <= outer.y + outer.h;

describe('layout do terminal de recuperacao', () => {
  const viewports: Array<[string, number, number, Safe, number]> = [
    ['mobile paisagem', 1536, 690, NONE, 190],
    ['paisagem compacta', 640, 360, NONE, 100],
    ['desktop', 1280, 720, NONE, 0],
    ['retrato', 390, 844, NONE, 150],
    ['notch paisagem', 844, 390, NOTCH, 109],
  ];

  it.each(viewports)('%s: os cards de acerto sao os de moduleChoiceLayout, intocados', (_n, vw, vh, safe, reserve) => {
    const terminal = salvageTerminalLayout(vw, vh, safe, reserve);
    const cards = moduleChoiceLayout(vw, vh, safe, reserve);
    expect(terminal.cards).toEqual(cards);
  });

  it.each(viewports)('%s: tela e carcaca envolvem os cards e cabem na viewport', (_n, vw, vh, safe, reserve) => {
    const { cards, screen, housing, headerH } = salvageTerminalLayout(vw, vh, safe, reserve);
    for (const card of cards) {
      expect(contains(screen, card)).toBe(true);
    }
    expect(contains(housing, screen)).toBe(true);
    // Cabecalho reservado ACIMA dos cards, dentro da tela.
    expect(cards[0].y - screen.y).toBeGreaterThanOrEqual(headerH);
    // A carcaca inteira dentro da area util (com a folga de 2px do contorno).
    expect(housing.x).toBeGreaterThanOrEqual(safe.left);
    expect(housing.y).toBeGreaterThanOrEqual(safe.top);
    expect(housing.x + housing.w).toBeLessThanOrEqual(vw - safe.right);
    expect(housing.y + housing.h).toBeLessThanOrEqual(vh - safe.bottom);
  });

  it('cards nao se sobrepoem e mantem alvo minimo de toque', () => {
    for (const [vw, vh, safe, reserve] of [
      [1536, 690, NONE, 190],
      [640, 360, NONE, 100],
      [390, 844, NONE, 150],
    ] as Array<[number, number, Safe, number]>) {
      const { cards } = salvageTerminalLayout(vw, vh, safe, reserve);
      const [a, b] = cards;
      const overlapX = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
      const overlapY = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
      expect(overlapX * overlapY).toBe(0);
      for (const card of cards) {
        expect(card.w).toBeGreaterThanOrEqual(120);
        expect(card.h).toBeGreaterThanOrEqual(120);
      }
    }
  });

  it('retrato empilha, paisagem poe lado a lado', () => {
    const portrait = salvageTerminalLayout(390, 844, NONE, 150);
    expect(portrait.cards[1].y).toBeGreaterThan(portrait.cards[0].y + portrait.cards[0].h - 1);
    const landscape = salvageTerminalLayout(1536, 690, NONE, 190);
    expect(landscape.cards[0].y).toBe(landscape.cards[1].y);
    expect(landscape.cards[1].x).toBeGreaterThan(landscape.cards[0].x + landscape.cards[0].w - 1);
  });

  it('viewport apertada entra em modo compacto (texto decorativo some primeiro)', () => {
    expect(salvageTerminalLayout(640, 360, NONE, 100).compact).toBe(true);
    expect(salvageTerminalLayout(1280, 720, NONE, 0).compact).toBe(false);
  });
});

describe('fases do boot da escolha', () => {
  it('rola o sincronismo, resolve o cabecalho e acende os cards em <=~450ms', () => {
    const start = choiceBootPhase(1000, 1000);
    expect(start.roll).toBe(0);
    expect(start.header).toBe(0);
    expect(start.cards).toBe(0);
    const mid = choiceBootPhase(1180, 1000);
    expect(mid.roll).toBeNull();
    expect(mid.header).toBeGreaterThan(0);
    const done = choiceBootPhase(1450, 1000);
    expect(done.header).toBe(1);
    expect(done.cards).toBe(1);
    expect(done.flicker).toBe(1);
  });

  it('nunca regride nem passa de 1', () => {
    let last = choiceBootPhase(1000, 1000);
    for (let t = 1000; t <= 1600; t += 16) {
      const phase = choiceBootPhase(t, 1000);
      expect(phase.header).toBeGreaterThanOrEqual(last.header);
      expect(phase.cards).toBeGreaterThanOrEqual(last.cards);
      expect(phase.header).toBeLessThanOrEqual(1);
      expect(phase.cards).toBeLessThanOrEqual(1);
      last = phase;
    }
  });
});
