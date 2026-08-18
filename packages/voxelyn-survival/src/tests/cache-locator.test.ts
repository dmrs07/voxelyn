import { describe, expect, it } from 'vitest';
import {
  approxDistanceM,
  bearingToDialPoint,
  cacheLocatorLayout,
  formatCacheDistance,
  lerpBearingDeg,
  locatorSignal,
  locatorTargets,
  screenBearingDeg,
  shortestDeltaDeg,
  wrapDeg,
} from '../client/cache-locator';
import type { SalvageSite } from '@voxelyn/survival-sim';

const site = (overrides: Partial<SalvageSite>): SalvageSite => ({
  id: 1,
  tier: 1,
  terminal: { x: 0, y: 0 },
  cache: { x: 0, y: 0 },
  terminalState: 'complete',
  scanEndsAt: 0,
  cacheRevealed: true,
  cacheOpened: false,
  openedBySlot: null,
  ...overrides,
});

describe('bearing de tela (projecao isometrica)', () => {
  // Na projecao 2:1 do jogo: screenX = (dx-dy)*16, screenY = (dx+dy)*8.
  // 0° = cima da tela, sentido horario.
  it('mapeia os oito rumos principais do MUNDO para a direcao de TELA correta', () => {
    // +x do mundo aparece na tela como diagonal inferior-direita: atan2(16, -8)
    const eastWorld = screenBearingDeg(1, 0);
    expect(eastWorld).toBeCloseTo(116.565, 2);
    // +y do mundo: inferior-esquerda, espelho do +x.
    const southWorld = screenBearingDeg(0, 1);
    expect(southWorld).toBeCloseTo(360 - 116.565, 2);
    // -x: superior-esquerda; -y: superior-direita.
    expect(screenBearingDeg(-1, 0)).toBeCloseTo(360 - 63.435, 2);
    expect(screenBearingDeg(0, -1)).toBeCloseTo(63.435, 2);
    // As diagonais do mundo caem nos eixos PUROS da tela.
    expect(screenBearingDeg(1, 1)).toBeCloseTo(180, 5); // baixo da tela
    expect(screenBearingDeg(-1, -1)).toBeCloseTo(0, 5); // cima da tela
    expect(screenBearingDeg(1, -1)).toBeCloseTo(90, 5); // direita da tela
    expect(screenBearingDeg(-1, 1)).toBeCloseTo(270, 5); // esquerda da tela
  });

  it('cobre a volta inteira sem descontinuidade no cruzamento 359°→0°→1°', () => {
    const at = (deg: number): { x: number; y: number } => bearingToDialPoint(deg, 30, 13);
    const a = at(359);
    const b = at(0);
    const c = at(1);
    expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeLessThan(1.2);
    expect(Math.hypot(c.x - b.x, c.y - b.y)).toBeLessThan(1.2);
    // E o wrap numerico em si:
    expect(wrapDeg(360)).toBe(0);
    expect(wrapDeg(-1)).toBe(359);
    expect(wrapDeg(725)).toBe(5);
  });

  it('interpola pelo menor arco, nunca pela volta longa', () => {
    expect(shortestDeltaDeg(359, 1)).toBe(2);
    expect(shortestDeltaDeg(1, 359)).toBe(-2);
    expect(shortestDeltaDeg(0, 180)).toBe(180);
    expect(lerpBearingDeg(359, 1, 0.5)).toBeCloseTo(0, 5);
    expect(lerpBearingDeg(10, 350, 0.5)).toBeCloseTo(0, 5);
  });

  it('poe o marcador no anel exatamente onde o bearing manda', () => {
    expect(bearingToDialPoint(0, 30, 13)).toEqual({ x: 0, y: -13 });
    const right = bearingToDialPoint(90, 30, 13);
    expect(right.x).toBeCloseTo(30, 5);
    expect(right.y).toBeCloseTo(0, 5);
    const behind = bearingToDialPoint(180, 30, 13);
    expect(behind.x).toBeCloseTo(0, 5);
    expect(behind.y).toBeCloseTo(13, 5);
  });
});

describe('distancia aproximada', () => {
  it('arredonda para metros inteiros, sem precisao falsa', () => {
    expect(approxDistanceM(3, 4)).toBe(5);
    expect(approxDistanceM(10.3, 0)).toBe(10);
    expect(formatCacheDistance(12.37)).toBe('12m');
    expect(formatCacheDistance(0.4)).toBe('0m');
  });

  it('classifica o sinal por distancia', () => {
    expect(locatorSignal(30)).toBe('far');
    expect(locatorSignal(10)).toBe('mid');
    expect(locatorSignal(5)).toBe('near');
    expect(locatorSignal(1.5)).toBe('lock');
  });
});

describe('selecao de alvo do localizador', () => {
  it('o mais proximo revelado e fechado vira o alvo primario', () => {
    const sites = [
      site({ id: 1, cache: { x: 20, y: 0 }, tier: 2 }),
      site({ id: 2, cache: { x: 4, y: 0 }, tier: 1 }),
      site({ id: 3, cache: { x: 9, y: 0 }, tier: 3 }),
    ];
    const targets = locatorTargets(sites, 0.5, 0.5);
    expect(targets.map((t) => t.siteId)).toEqual([2, 3, 1]);
    expect(targets[0].tier).toBe(1);
  });

  it('ignora cofres abertos e nao revelados', () => {
    const sites = [
      site({ id: 1, cache: { x: 2, y: 0 }, cacheOpened: true }),
      site({ id: 2, cache: { x: 3, y: 0 }, cacheRevealed: false }),
      site({ id: 3, cache: { x: 8, y: 0 } }),
    ];
    const targets = locatorTargets(sites, 0.5, 0.5);
    expect(targets.map((t) => t.siteId)).toEqual([3]);
  });

  it('promove o proximo cofre quando o atual abre', () => {
    const near = site({ id: 1, cache: { x: 2, y: 0 } });
    const far = site({ id: 2, cache: { x: 10, y: 0 }, tier: 3 });
    expect(locatorTargets([near, far], 0.5, 0.5)[0].siteId).toBe(1);
    near.cacheOpened = true;
    const after = locatorTargets([near, far], 0.5, 0.5);
    expect(after[0].siteId).toBe(2);
    expect(after).toHaveLength(1);
  });

  it('carrega tier e bearing corretos por alvo', () => {
    const sites = [site({ id: 7, tier: 3, cache: { x: 5, y: 5 } })];
    const [target] = locatorTargets(sites, 0.5, 0.5);
    expect(target.tier).toBe(3);
    // Cofre a sudeste do mundo (dx=dy>0) = baixo da tela.
    expect(target.bearingDeg).toBeCloseTo(180, 5);
    expect(target.distance).toBeCloseTo(Math.hypot(5, 5), 5);
  });
});

describe('layout do instrumento', () => {
  const viewports: Array<[string, number, number, { top: number; right: number; bottom: number; left: number }]> = [
    ['mobile paisagem', 1536, 690, { top: 0, right: 0, bottom: 0, left: 0 }],
    ['paisagem compacta', 640, 360, { top: 0, right: 0, bottom: 0, left: 0 }],
    ['desktop', 1280, 720, { top: 0, right: 0, bottom: 0, left: 0 }],
    ['retrato', 390, 844, { top: 0, right: 0, bottom: 0, left: 0 }],
    ['notch paisagem', 844, 390, { top: 24, right: 44, bottom: 20, left: 44 }],
  ];

  it.each(viewports)('%s: fica no topo-centro, dentro da area segura', (_name, vw, vh, safe) => {
    const layout = cacheLocatorLayout(vw, vh, safe);
    expect(layout.bounds.y).toBeGreaterThanOrEqual(safe.top);
    expect(layout.bounds.x).toBeGreaterThanOrEqual(safe.left);
    expect(layout.bounds.x + layout.bounds.w).toBeLessThanOrEqual(vw - safe.right);
    // Compacto: nunca vira uma barra de HUD atravessando a tela.
    expect(layout.bounds.w).toBeLessThanOrEqual(vw * 0.45);
    expect(layout.bounds.y + layout.bounds.h).toBeLessThanOrEqual(safe.top + 110);
    // Centrado horizontalmente.
    expect(Math.abs(layout.cx - vw / 2)).toBeLessThanOrEqual(1);
  });
});
