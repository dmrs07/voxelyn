import { describe, expect, it } from 'vitest';
import { screenToWorldMove } from './input';

const len = (v: { x: number; y: number }): number => Math.hypot(v.x, v.y);

/** As oito combinacoes de teclas, em deflexao de TELA. */
const KEYS: Array<[string, number, number]> = [
  ['D', 1, 0],
  ['A', -1, 0],
  ['S', 0, 1],
  ['W', 0, -1],
  ['W+D', 1, -1],
  ['S+D', 1, 1],
  ['W+A', -1, -1],
  ['S+A', -1, 1],
];

describe('conversao tela -> mundo do movimento', () => {
  // O bug classico, no lugar onde ele realmente poderia entrar: se a conversao
  // nao normalizasse, a diagonal de teclado sairia 1,41x mais longa.
  it('teclado da magnitude 1 nas oito direcoes', () => {
    for (const [label, mx, my] of KEYS) {
      expect(len(screenToWorldMove(mx, my)), label).toBeCloseTo(1, 6);
    }
  });

  // O bug REAL que estava em producao. Medido antes da correcao: meio-stick para
  // a direita dava 70,7% da velocidade, meio-stick para cima dava 100%. A
  // conversao isometrica estica o eixo vertical por 2, e o clamp da simulacao
  // (`min(1, |move|)`) so escondia isso na deflexao maxima — que e o unico caso
  // que o teclado produz.
  it('a magnitude do analogico e a mesma em qualquer rumo', () => {
    for (const fraction of [0.25, 0.5, 0.75, 1]) {
      for (const [label, mx, my] of KEYS) {
        const unit = Math.hypot(mx, my);
        const v = screenToWorldMove((mx / unit) * fraction, (my / unit) * fraction);
        expect(len(v), `${label} a ${fraction}`).toBeCloseTo(fraction, 6);
      }
    }
  });

  it('nunca passa de 1, mesmo com entrada fora de faixa', () => {
    for (const [, mx, my] of KEYS) {
      expect(len(screenToWorldMove(mx * 9, my * 9))).toBeLessThanOrEqual(1 + 1e-9);
    }
  });

  it('sem entrada, comando parado', () => {
    expect(screenToWorldMove(0, 0)).toEqual({ x: 0, y: 0 });
  });

  // A DIRECAO nao muda: o rumo continua saindo da mesma projecao isometrica, e
  // so o comprimento foi consertado. `D` tem de continuar levando o personagem
  // para a direita na tela, e nao para outro canto.
  it('preserva o rumo isometrico de cada tecla', () => {
    // Tela: sx ∝ (wx - wy), sy ∝ (wx + wy).
    const toScreen = (v: { x: number; y: number }) => ({ x: v.x - v.y, y: v.x + v.y });
    const d = toScreen(screenToWorldMove(1, 0));
    expect(d.x).toBeGreaterThan(0);
    expect(d.y).toBeCloseTo(0, 6); // D: puramente para a direita
    const s = toScreen(screenToWorldMove(0, 1));
    expect(s.y).toBeGreaterThan(0);
    expect(s.x).toBeCloseTo(0, 6); // S: puramente para baixo
    const wd = toScreen(screenToWorldMove(1, -1));
    expect(wd.x).toBeGreaterThan(0);
    expect(wd.y).toBeLessThan(0); // W+D: cima-direita
  });
});
