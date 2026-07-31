import { describe, expect, it } from 'vitest';
import { quantizeCommand } from '@voxelyn/survival-protocol';
import { emptyCommand } from '@voxelyn/survival-sim';
import { screenToWorldAim, screenToWorldMove } from './input';

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

/**
 * Rumo de TELA de um vetor de mundo, em graus.
 *
 * A projecao e 2:1 — `isoX = (x-y)*16`, `isoY = (x+y)*8` no renderer —, e o
 * fator de 2 nao pode ser omitido: sem ele o angulo medido nao e o que o jogador
 * ve, e o teste passaria a cobrar a conta errada.
 */
const screenAngleOf = (v: { x: number; y: number }): number =>
  (Math.atan2((v.x + v.y) * 8, (v.x - v.y) * 16) * 180) / Math.PI;

const angleError = (a: number, b: number): number => {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
};

describe('conversao tela -> mundo da mira', () => {
  it('devolve sempre um rumo unitario', () => {
    for (let deg = 0; deg < 360; deg += 7) {
      const rad = (deg * Math.PI) / 180;
      for (const distance of [3, 60, 400, 1200]) {
        const aim = screenToWorldAim(Math.cos(rad) * distance, Math.sin(rad) * distance);
        expect(len(aim), `${deg} graus a ${distance}px`).toBeCloseTo(1, 6);
      }
    }
  });

  it('aponta exatamente para onde o cursor esta na tela', () => {
    for (let deg = 0; deg < 360; deg += 7) {
      const rad = (deg * Math.PI) / 180;
      const aim = screenToWorldAim(Math.cos(rad) * 300, Math.sin(rad) * 300);
      // O rumo de tela do vetor de mundo tem de ser o mesmo do cursor.
      expect(angleError(screenAngleOf(aim), deg), `${deg} graus`).toBeLessThan(1e-6);
    }
  });

  it('cursor em cima do personagem nao vira mira', () => {
    expect(screenToWorldAim(0, 0)).toEqual({ x: 0, y: 0 });
  });

  /**
   * O defeito que estava em producao, no ponto exato onde ele doia.
   *
   * No solo o comando e QUANTIZADO antes de entrar na simulacao (e o que torna o
   * replay do ranking exato). `q` satura cada eixo em ±1, e a mira que chegava
   * ali era a diferenca em pixels entre o cursor e o centro da tela — centenas.
   * Os dois eixos saturavam juntos e o vetor colapsava numa diagonal: varrendo o
   * cursor em volta do personagem, os 360 rumos possiveis viravam QUATRO, com
   * erro medio de 26,3 graus e maximo de 63.
   *
   * Depois da correcao: 0,13 grau de erro medio e 0,54 no pior caso. O que sobra
   * e o passo do proprio codec — 1/127 de um vetor unitario, esticado pela
   * projecao 2:1 perto da horizontal da tela. Meio grau a 300 px do personagem e
   * menos de tres pixels; o limite abaixo cobra que o erro fique nessa ordem, e
   * nao nas dezenas de graus de antes.
   */
  it('sobrevive a quantizacao do log de comandos', () => {
    let worst = 0;
    for (let deg = 0; deg < 360; deg += 3) {
      const rad = (deg * Math.PI) / 180;
      const cmd = emptyCommand();
      cmd.aim = screenToWorldAim(Math.cos(rad) * 300, Math.sin(rad) * 300);
      const simulated = quantizeCommand(cmd);
      worst = Math.max(worst, angleError(screenAngleOf(simulated.aim), deg));
    }
    expect(worst).toBeLessThan(0.6);
  });
});
