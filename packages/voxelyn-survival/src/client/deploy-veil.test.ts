// @vitest-environment happy-dom
//
// O contrato do véu, nao a estetica: `swap` roda exatamente uma vez, sob o
// preto total; o véu bloqueia toques enquanto existe e some sozinho ao fim;
// e uma segunda transicao no meio da onda nao perde o clique — troca na hora.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { deployVeil } from './deploy-veil';

beforeEach(() => {
  vi.useFakeTimers();
  document.body.textContent = '';
});
afterEach(() => {
  vi.runAllTimers();
  vi.useRealTimers();
});

describe('véu de deploy', () => {
  it('fecha, troca uma vez sob o preto e se remove', () => {
    const swap = vi.fn();
    deployVeil(swap);

    const veil = document.querySelector('.ax-veil');
    expect(veil).not.toBeNull();
    // A colmeia existe e esta fechando; a troca ainda nao aconteceu.
    expect(veil?.children.length).toBeGreaterThan(0);
    expect(veil?.classList.contains('is-closed')).toBe(true);
    expect(swap).not.toHaveBeenCalled();

    vi.runAllTimers();
    expect(swap).toHaveBeenCalledTimes(1);
    // A onda passou: nenhum residuo fica na pagina.
    expect(document.querySelector('.ax-veil')).toBeNull();
  });

  it('transicao concorrente nao perde a troca: executa imediato, sem segundo véu', () => {
    const first = vi.fn();
    const second = vi.fn();
    deployVeil(first);
    deployVeil(second);

    // A segunda troca ja aconteceu (perder a animacao e melhor que perder o
    // clique) e nenhum segundo véu foi empilhado.
    expect(second).toHaveBeenCalledTimes(1);
    expect(document.querySelectorAll('.ax-veil').length).toBe(1);

    vi.runAllTimers();
    expect(first).toHaveBeenCalledTimes(1);
  });

  it('cada célula carrega o proprio atraso diagonal', () => {
    deployVeil(() => {});
    const cells = document.querySelectorAll<HTMLElement>('.ax-veil span');
    const delays = new Set(Array.from(cells).map((cell) => cell.style.transitionDelay));
    // Onda diagonal exige atrasos ESCALONADOS — um atraso unico seria um
    // fade de tela inteira, nao um obturador.
    expect(delays.size).toBeGreaterThan(3);
    vi.runAllTimers();
  });
});
