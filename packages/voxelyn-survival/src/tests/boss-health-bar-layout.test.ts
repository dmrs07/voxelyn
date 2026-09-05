// A GEOMETRIA da barra de chefe, medida sem Canvas.
//
// A barra vive no rodape, que e onde moram os manches, os botoes e a barra de
// comandos. A promessa deste arquivo: ela nunca cobre um input, nunca cruza a
// area segura, e encolhe ornamento antes de encolher a vida.
import { describe, expect, it } from 'vitest';
import {
  bossHealthBarDesktopWidth,
  bossHealthBarLayout,
  rectsOverlap,
  type BossHealthBarLayout,
} from '../client/boss-health-bar-layout';
import {
  AIM_JOYSTICK_RADIUS,
  MOVE_JOYSTICK_RADIUS,
  SurvivalInput,
  touchControlGeometry,
} from '../client/input';
import { DESKTOP_CONTROL_BAR_RESERVE } from '../client/desktop-controls';
import { hudPanelLayout, hudScale } from '../client/hud-layout';

const NO_SAFE = { top: 0, right: 0, bottom: 0, left: 0 };

const integers = (layout: BossHealthBarLayout): void => {
  for (const v of [layout.x, layout.y, layout.width, layout.height, layout.endCap]) {
    expect(Number.isInteger(v)).toBe(true);
  }
  for (const r of [layout.frame, layout.bed, layout.accent]) {
    for (const v of [r.x, r.y, r.width, r.height]) expect(Number.isInteger(v)).toBe(true);
  }
  expect(Number.isInteger(layout.name.baseline)).toBe(true);
  expect(Number.isInteger(layout.name.x)).toBe(true);
};

/** Os circulos dos controles, como retangulos envolventes, para o teste de sobreposicao. */
const touchRects = (w: number, h: number, safe = NO_SAFE) => {
  const g = touchControlGeometry(w, h, safe);
  const circle = (cx: number, cy: number, r: number) => ({
    x: cx - r,
    y: cy - r,
    width: r * 2,
    height: r * 2,
  });
  return [
    circle(g.moveX, g.moveY, MOVE_JOYSTICK_RADIUS),
    circle(g.aimX, g.aimY, AIM_JOYSTICK_RADIUS),
    circle(g.dodgeX, g.aimY, g.hitRadius),
    circle(g.aimX - g.step * 2, g.actionY, g.hitRadius),
    circle(g.aimX - g.step, g.actionY, g.hitRadius),
    circle(g.aimX, g.actionY, g.hitRadius),
  ];
};

describe('desktop', () => {
  it.each([
    [1366, 768],
    [1920, 1080],
    [2560, 1080],
    [1024, 600],
  ])('%ix%i: centralizada, monumental, acima da barra de comandos', (w, h) => {
    const layout = bossHealthBarLayout({
      viewportWidth: w,
      viewportHeight: h,
      safe: NO_SAFE,
      touchMode: false,
    });
    expect(layout.visible).toBe(true);
    integers(layout);
    // Centralizada.
    expect(Math.abs(layout.x + layout.width / 2 - w / 2)).toBeLessThanOrEqual(1);
    // A largura da direcao: 60-72% da tela ate o teto de 860.
    expect(layout.width).toBe(Math.min(860, Math.round(w * 0.66)));
    expect(layout.width).toBeLessThanOrEqual(860);
    // A vida entre 10 e 14 px; o nome entre 16 e 21.
    expect(layout.bed.height).toBeGreaterThanOrEqual(10);
    expect(layout.bed.height).toBeLessThanOrEqual(14);
    expect(layout.name.fontPx).toBeGreaterThanOrEqual(16);
    expect(layout.name.fontPx).toBeLessThanOrEqual(21);
    // Acima da barra de comandos, dentro da tela.
    expect(layout.frame.y + layout.frame.height).toBeLessThanOrEqual(
      h - DESKTOP_CONTROL_BAR_RESERVE,
    );
    expect(layout.y).toBeGreaterThan(h * 0.5);
    // O nome comeca onde o leito comeca.
    expect(layout.name.x).toBe(layout.bed.x);
    // O leito esta dentro da moldura, a moldura dentro da peca.
    expect(layout.bed.x).toBeGreaterThan(layout.frame.x);
    expect(layout.bed.x + layout.bed.width).toBeLessThan(layout.frame.x + layout.frame.width);
    expect(layout.frame.x - layout.endCap).toBe(layout.x);
  });

  it('a largura monumental para de crescer em 860', () => {
    expect(bossHealthBarDesktopWidth(1366)).toBe(860);
    expect(bossHealthBarDesktopWidth(3440)).toBe(860);
    expect(bossHealthBarDesktopWidth(1000)).toBe(660);
  });

  it('respeita a area segura de baixo', () => {
    const plain = bossHealthBarLayout({
      viewportWidth: 1366,
      viewportHeight: 768,
      safe: NO_SAFE,
      touchMode: false,
    });
    const safe = bossHealthBarLayout({
      viewportWidth: 1366,
      viewportHeight: 768,
      safe: { top: 0, right: 0, bottom: 40, left: 0 },
      touchMode: false,
    });
    expect(safe.frame.y).toBe(plain.frame.y - 40);
  });
});

describe('toque em paisagem (568x320)', () => {
  const W = 568;
  const H = 320;
  it('usa a faixa livre entre os controles, sem cobrir nenhum', () => {
    const layout = bossHealthBarLayout({
      viewportWidth: W,
      viewportHeight: H,
      safe: NO_SAFE,
      touchMode: true,
    });
    expect(layout.visible).toBe(true);
    integers(layout);
    expect(layout.orientation).toBe('landscape');
    const piece = { x: layout.x, y: layout.y, width: layout.width, height: layout.height };
    for (const control of touchRects(W, H)) expect(rectsOverlap(piece, control)).toBe(false);
    // A vida entre 8 e 11 px, o nome entre 12 e 15.
    expect(layout.bed.height).toBeGreaterThanOrEqual(8);
    expect(layout.bed.height).toBeLessThanOrEqual(11);
    expect(layout.name.fontPx).toBeGreaterThanOrEqual(12);
    expect(layout.name.fontPx).toBeLessThanOrEqual(15);
    // Na linha dos manches.
    const g = touchControlGeometry(W, H);
    expect(Math.abs(layout.frame.y + layout.frame.height / 2 - g.aimY)).toBeLessThanOrEqual(2);
  });

  it('a mesma geometria que os botoes reais usam', () => {
    const input = new SurvivalInput(null as unknown as HTMLCanvasElement);
    input.layoutButtons(W, H, NO_SAFE);
    const g = touchControlGeometry(W, H, NO_SAFE);
    expect(input.state.joystick.originX).toBe(g.moveX);
    expect(input.state.aimTouch.originY).toBe(g.aimY);
    expect(input.state.buttons.find((b) => b.id === 'dodge')?.cx).toBe(g.dodgeX);
    expect(input.state.buttons.find((b) => b.id === 'interact')?.cy).toBe(g.actionY);
  });

  it('encolhe ornamento antes de encolher a vida', () => {
    const layout = bossHealthBarLayout({
      viewportWidth: W,
      viewportHeight: H,
      safe: NO_SAFE,
      touchMode: true,
    });
    expect(layout.ornament).not.toBe('full');
    expect(layout.bed.height).toBeGreaterThanOrEqual(8);
  });
});

describe('toque em retrato (320x568)', () => {
  const W = 320;
  const H = 568;
  it('quase a largura inteira, acima dos controles, respeitando margens', () => {
    const layout = bossHealthBarLayout({
      viewportWidth: W,
      viewportHeight: H,
      safe: NO_SAFE,
      touchMode: true,
    });
    expect(layout.visible).toBe(true);
    integers(layout);
    expect(layout.orientation).toBe('portrait');
    expect(layout.width).toBeGreaterThanOrEqual(W * 0.85);
    expect(layout.x).toBeGreaterThanOrEqual(12);
    expect(layout.x + layout.width).toBeLessThanOrEqual(W - 12);
    const piece = { x: layout.x, y: layout.y, width: layout.width, height: layout.height };
    for (const control of touchRects(W, H)) expect(rectsOverlap(piece, control)).toBe(false);
    const g = touchControlGeometry(W, H);
    expect(layout.frame.y + layout.frame.height).toBeLessThanOrEqual(g.top);
    // E nao sobe ate o painel de status.
    const hs = hudScale(W, H);
    const panel = hudPanelLayout({
      viewportWidth: W / hs,
      safe: NO_SAFE,
      dense: true,
      moduleCount: 3,
      surveyHeight: 40,
      objectiveLines: 3,
      freezeMeter: true,
    });
    expect(layout.y).toBeGreaterThan((panel.y + panel.height) * hs);
  });
});

describe('areas seguras assimetricas', () => {
  it('a peca fica dentro da area segura em todas as posturas', () => {
    const safe = { top: 44, right: 34, bottom: 21, left: 0 };
    for (const [w, h, touch] of [
      [844, 390, true],
      [390, 844, true],
      [1366, 768, false],
    ] as Array<[number, number, boolean]>) {
      const layout = bossHealthBarLayout({
        viewportWidth: w,
        viewportHeight: h,
        safe,
        touchMode: touch,
      });
      expect(layout.visible).toBe(true);
      expect(layout.x).toBeGreaterThanOrEqual(safe.left);
      expect(layout.x + layout.width).toBeLessThanOrEqual(w - safe.right);
      expect(layout.y).toBeGreaterThanOrEqual(safe.top);
      expect(layout.frame.y + layout.frame.height).toBeLessThanOrEqual(h - safe.bottom);
      if (touch) {
        const piece = { x: layout.x, y: layout.y, width: layout.width, height: layout.height };
        for (const control of touchRects(w, h, safe)) {
          expect(rectsOverlap(piece, control)).toBe(false);
        }
      }
    }
  });
});

describe('o painel de status', () => {
  it('a peca recua para a direita do painel quando o tocaria', () => {
    const panel = { x: 12, y: 10, width: 200, height: 700 };
    const layout = bossHealthBarLayout({
      viewportWidth: 1366,
      viewportHeight: 768,
      safe: NO_SAFE,
      touchMode: false,
      hudPanel: panel,
    });
    expect(layout.visible).toBe(true);
    expect(rectsOverlap(layout, panel)).toBe(false);
    expect(layout.x).toBeGreaterThanOrEqual(panel.x + panel.width);
  });

  it('um painel que nao toca a peca nao a move', () => {
    const base = bossHealthBarLayout({
      viewportWidth: 1366,
      viewportHeight: 768,
      safe: NO_SAFE,
      touchMode: false,
    });
    const withPanel = bossHealthBarLayout({
      viewportWidth: 1366,
      viewportHeight: 768,
      safe: NO_SAFE,
      touchMode: false,
      hudPanel: { x: 12, y: 10, width: 300, height: 260 },
    });
    expect(withPanel).toEqual(base);
  });
});

describe('telas excepcionais', () => {
  it('uma tela minuscula esconde a peca em vez de desenhar uma linha ilegivel', () => {
    const layout = bossHealthBarLayout({
      viewportWidth: 160,
      viewportHeight: 120,
      safe: NO_SAFE,
      touchMode: true,
    });
    expect(layout.visible).toBe(false);
  });
});
