import { describe, expect, it } from 'vitest';
import { dirFromFacing } from '@voxelyn/survival-content';
import { FACING_HYSTERESIS_RAD, FacingHysteresis, facingQuadrant, screenAngle } from './facing';

const DIRS = ['dr', 'dl', 'ul', 'ur'];

/** As oito direcoes de mundo que o teclado produz (ver screenToWorldMove). */
const KEYBOARD: Array<[string, number, number]> = [
  ['w', -1, -1],
  ['s', 1, 1],
  ['a', -1, 1],
  ['d', 1, -1],
  ['wd', -1, -3],
  ['wa', -3, -1],
  ['sa', 3, 1],
  ['sd', 1, 3],
];

describe('facingQuadrant', () => {
  it('concorda com dirFromFacing em toda a volta', () => {
    for (let deg = 0; deg < 360; deg += 1) {
      const rad = (deg * Math.PI) / 180;
      const x = Math.cos(rad);
      const y = Math.sin(rad);
      expect(DIRS[facingQuadrant(x, y)]).toBe(dirFromFacing(x, y));
    }
  });
});

describe('FacingHysteresis', () => {
  it('devolve o vetor cru enquanto o quadrante nao muda', () => {
    const hysteresis = new FacingHysteresis();
    expect(hysteresis.resolve(1, 1, 0)).toEqual({ x: 1, y: 0 });
    expect(hysteresis.resolve(1, 0.9, 0.1)).toEqual({ x: 0.9, y: 0.1 });
  });

  /**
   * O bug relatado no co-op: "o personagem fica num flicker absurdo alternando
   * rapidamente o facing".
   *
   * Andar para cima na tela (W sozinho) e o rumo de mundo (-1,-1), que cai EM
   * CIMA da fronteira entre `ul` e `ur`. O servidor arredonda x e y para tres
   * casas separadamente antes de mandar, entao o deslocamento observado pelo
   * cliente nunca tem as duas componentes exatamente iguais — o desempate vira
   * cara ou coroa a cada quadro, e o boneco espelha 60 vezes por segundo.
   *
   * A sequencia abaixo e o ruido de arredondamento reproduzido: o mesmo rumo,
   * com um milesimo de sobra ora num eixo, ora no outro.
   */
  it('nao troca de quadrante com ruido de arredondamento sobre a fronteira', () => {
    const hysteresis = new FacingHysteresis();
    const noisy = [
      [-0.7071, -0.7071],
      [-0.7075, -0.7067],
      [-0.7067, -0.7075],
      [-0.7071, -0.7071],
      [-0.7080, -0.7062],
      [-0.7062, -0.7080],
    ] as const;

    const dirs = noisy.map(([x, y]) => {
      const stable = hysteresis.resolve(1, x, y);
      return dirFromFacing(stable.x, stable.y);
    });

    expect(new Set(dirs).size).toBe(1);
  });

  it('acompanha uma virada de verdade no mesmo quadro', () => {
    const hysteresis = new FacingHysteresis();
    const first = hysteresis.resolve(1, 1, 0);
    expect(dirFromFacing(first.x, first.y)).toBe('dr');
    const turned = hysteresis.resolve(1, -1, 0);
    expect(turned).toEqual({ x: -1, y: 0 });
    expect(dirFromFacing(turned.x, turned.y)).toBe('ul');
  });

  /**
   * O teto da margem: as oito direcoes do teclado ou caem sobre uma fronteira,
   * ou ficam a 26,6 graus dela. Uma histerese mais larga que isso grudaria uma
   * diagonal legitima no quadrante do vizinho — o boneco andaria para um lado
   * olhando para o outro, que e pior que o flicker que ela veio consertar.
   */
  it('deixa cada direcao de teclado alcancar o proprio quadrante', () => {
    for (const [pressed, x, y] of KEYBOARD) {
      const hysteresis = new FacingHysteresis();
      // Comeca comprometida com o quadrante OPOSTO ao que a tecla pede.
      hysteresis.resolve(1, -x, -y);
      const stable = hysteresis.resolve(1, x, y);
      const wanted = dirFromFacing(x, y);
      const got = dirFromFacing(stable.x, stable.y);
      // Sobre a fronteira (w/a/s/d sozinhos) qualquer um dos dois vizinhos e uma
      // resposta honesta; fora dela, tem de ser exatamente o quadrante pedido.
      const onEdge = Math.abs(Math.abs(screenAngle(x, y)) % (Math.PI / 2)) < 1e-9;
      if (!onEdge) expect(`${pressed}:${got}`).toBe(`${pressed}:${wanted}`);
    }
  });

  it('a margem cabe dentro do que separa uma fronteira da diagonal mais proxima', () => {
    // 26,57 graus: o angulo de tela de (-1,-3), a diagonal de teclado mais
    // proxima de uma fronteira.
    expect(FACING_HYSTERESIS_RAD).toBeLessThan(0.4636);
  });

  it('esquece entidades que sumiram do mundo', () => {
    const hysteresis = new FacingHysteresis();
    hysteresis.resolve(1, 1, 0, 0);
    hysteresis.sweep(10_000);
    // Sem memoria, o primeiro rumo depois da varredura volta a ser aceito cru.
    expect(hysteresis.resolve(1, -1, 0, 10_000)).toEqual({ x: -1, y: 0 });
  });
});
