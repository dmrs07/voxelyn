// A LIMALHA E A LEITURA DA POLARIDADE.
//
// O que estes testes protegem nao e o desenho, e a informacao: o sentido dos
// riscos e a unica coisa na tela que diz para que lado o campo do Magnetarca
// empurra. Um bug que os fizesse todos apontarem para dentro deixaria a luta
// exatamente como ela estava antes deste rework — bonita e ilegivel.
import { describe, expect, it } from 'vitest';
import { MAGNET_FILINGS, MAGNET_FILING_LENGTH, magnetFiling } from './magnet-filings';

const INNER = 3;
const OUTER = 13;

const radius = (x: number, y: number): number => Math.hypot(x, y);

describe('a limalha do Magnetarca diz a polaridade', () => {
  it('atraindo, a cabeca aponta para DENTRO; repelindo, para fora', () => {
    for (let i = 0; i < MAGNET_FILINGS; i++) {
      for (const seconds of [0.13, 0.9, 2.1, 5.7]) {
        const inward = magnetFiling(i, MAGNET_FILINGS, seconds, false, INNER, OUTER);
        const outward = magnetFiling(i, MAGNET_FILINGS, seconds, true, INNER, OUTER);
        expect(
          radius(inward.hx, inward.hy),
          `risco ${i} atraindo aponta para fora`,
        ).toBeLessThanOrEqual(radius(inward.x, inward.y) + 1e-9);
        expect(
          radius(outward.hx, outward.hy),
          `risco ${i} repelindo aponta para dentro`,
        ).toBeGreaterThanOrEqual(radius(outward.x, outward.y) - 1e-9);
      }
    }
  });

  it('nenhum risco sai do campo nem entra no anel de esmagamento', () => {
    // O desenho promete um lugar: a limalha atravessa o campo, e o campo tem
    // duas fronteiras. Um risco alem delas mostraria materia sendo carregada
    // onde a simulacao nao carrega nada.
    for (let i = 0; i < MAGNET_FILINGS; i++) {
      for (const seconds of [0, 0.4, 1.3, 3.9, 11.2]) {
        for (const out of [false, true]) {
          const f = magnetFiling(i, MAGNET_FILINGS, seconds, out, INNER, OUTER);
          for (const [x, y] of [
            [f.x, f.y],
            [f.hx, f.hy],
          ]) {
            const r = radius(x, y);
            expect(r, `risco ${i} passou por dentro do anel`).toBeGreaterThanOrEqual(INNER - 1e-9);
            expect(r, `risco ${i} passou da borda do campo`).toBeLessThanOrEqual(OUTER + 1e-9);
          }
        }
      }
    }
  });

  it('o risco tem comprimento, e ele encolhe so ao encostar na fronteira', () => {
    // Um risco de comprimento zero e um ponto, e ponto nao tem sentido — no
    // sentido literal: sem os dois extremos nao da para ler direcao nenhuma.
    let full = 0;
    for (let i = 0; i < MAGNET_FILINGS; i++) {
      const f = magnetFiling(i, MAGNET_FILINGS, 1.7, false, INNER, OUTER);
      const len = Math.hypot(f.hx - f.x, f.hy - f.y);
      expect(len).toBeLessThanOrEqual(MAGNET_FILING_LENGTH + 1e-9);
      if (Math.abs(len - MAGNET_FILING_LENGTH) < 1e-6) full++;
    }
    expect(full, 'nenhum risco tem o comprimento cheio').toBeGreaterThan(MAGNET_FILINGS / 2);
  });

  it('e PURA: as mesmas entradas dao o mesmo risco', () => {
    // Duas maquinas de uma sala de co-op desenham o mesmo campo porque leem as
    // mesmas entradas. Um `Math.random` aqui quebraria isso em silencio — as
    // duas telas continuariam plausiveis, e diferentes.
    const a = magnetFiling(7, MAGNET_FILINGS, 2.5, true, INNER, OUTER);
    const b = magnetFiling(7, MAGNET_FILINGS, 2.5, true, INNER, OUTER);
    expect(a).toEqual(b);
  });

  it('as duas pontas da travessia apagam', () => {
    // Sem isso a limalha pisca na borda do campo e no anel de esmagamento — e a
    // borda do campo e onde o jogador precisa ver que AINDA ha campo.
    const ends: number[] = [];
    const middles: number[] = [];
    for (let i = 0; i < MAGNET_FILINGS; i++) {
      const f = magnetFiling(i, MAGNET_FILINGS, 0, false, INNER, OUTER);
      const travel = Math.abs(radius(f.x, f.y) - OUTER) / (OUTER - INNER);
      (travel < 0.06 || travel > 0.94 ? ends : middles).push(f.alpha);
    }
    for (const alpha of ends) expect(alpha).toBeLessThan(0.4);
    expect(Math.max(...middles), 'nenhum risco chega a ficar visivel').toBeGreaterThan(0.8);
  });
});
