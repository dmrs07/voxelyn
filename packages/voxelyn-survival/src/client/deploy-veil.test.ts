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

    // As DUAS trocas ja aconteceram, na ordem original: a pendente e puxada
    // para frente antes da nova (perder a animacao e melhor que perder o
    // clique) e nenhum segundo véu foi empilhado.
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
    expect(document.querySelectorAll('.ax-veil').length).toBe(1);

    vi.runAllTimers();
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('véu atropelado nao ressuscita: a troca antiga nunca roda DEPOIS da nova', () => {
    // O caso de campo: DESCER agenda esconder o menu, um erro sincrono manda
    // de volta ao menu no meio da onda. Se o timeout do véu antigo ainda
    // rodasse a troca dele, esconderia o menu de novo — jogador preso num
    // canvas morto. O estado final tem que ser o da troca mais NOVA.
    const order: string[] = [];
    deployVeil(() => order.push('esconde menu'));
    deployVeil(() => order.push('mostra menu'));
    expect(order).toEqual(['esconde menu', 'mostra menu']);

    vi.runAllTimers();
    expect(order).toEqual(['esconde menu', 'mostra menu']);
  });

  it('cada célula carrega o proprio atraso diagonal, na transicao E no lampejo', () => {
    deployVeil(() => {});
    const cells = document.querySelectorAll<HTMLElement>('.ax-veil span');
    const delays = new Set(Array.from(cells).map((cell) => cell.style.transitionDelay));
    // Onda diagonal exige atrasos ESCALONADOS — um atraso unico seria um
    // fade de tela inteira, nao um obturador.
    expect(delays.size).toBeGreaterThan(3);
    // O lampejo teal da frente de onda viaja com a mesma diagonal: cada
    // celula carrega o MESMO atraso na animacao e na transicao.
    for (const cell of Array.from(cells).slice(0, 20)) {
      expect(cell.style.animationDelay).toBe(cell.style.transitionDelay);
    }
    vi.runAllTimers();
  });

  it('a estática toca uma vez por varredura: fechar e abrir', () => {
    const sound = vi.fn();
    deployVeil(() => {}, sound);
    // Fechou: primeira estática, junto com a onda.
    expect(sound).toHaveBeenCalledTimes(1);
    vi.runAllTimers();
    // Abriu: segunda e última — sem terceira depois que o véu some.
    expect(sound).toHaveBeenCalledTimes(2);
  });

  it('véu pulado nao toca estática: sem onda, sem som', () => {
    const sound = vi.fn();
    const swap = vi.fn();
    deployVeil(() => {});
    // Segunda chamada com a onda no ar: troca imediata, silenciosa.
    deployVeil(swap, sound);
    expect(swap).toHaveBeenCalledTimes(1);
    expect(sound).not.toHaveBeenCalled();
    vi.runAllTimers();
  });
});
