// @vitest-environment happy-dom
//
// O contrato do véu, nao a estetica — e agora ele governa o ciclo inteiro:
// preparar corre com a onda e termina ANTES da troca; a troca acontece sob o
// preto; a promessa so resolve com o véu removido (e o laco liberado); uma
// ativacao com outra no ar e RECUSADA sem rodar nada; e nenhum teclado
// atravessa a janela enquanto o véu existe.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { deployVeil, veilActive } from './deploy-veil';

beforeEach(() => {
  vi.useFakeTimers();
  document.body.textContent = '';
});
afterEach(async () => {
  await vi.runAllTimersAsync();
  vi.useRealTimers();
});

describe('véu de deploy', () => {
  it('sequencia completa: fecha, prepara, troca sob o preto e libera no fim', async () => {
    const order: string[] = [];
    let resolvePrepare: () => void = () => {};
    const prepare = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolvePrepare = () => {
            order.push('prepare-done');
            resolve();
          };
        }),
    );
    const swap = vi.fn(() => order.push('swap'));
    const done = deployVeil({ prepare, swap });

    // A onda esta no ar e a preparacao comeca junto com ela (no microtask
    // seguinte — antes de qualquer atraso da onda).
    const veil = document.querySelector('.ax-veil');
    expect(veil).not.toBeNull();
    expect(veil?.children.length).toBeGreaterThan(0);
    expect(veil?.classList.contains('is-closed')).toBe(true);
    expect(veilActive()).toBe(true);
    await Promise.resolve();
    expect(prepare).toHaveBeenCalledTimes(1);

    // A onda fechou, mas a preparacao ainda nao terminou: NADA troca. E o que
    // impede o mundo de nascer atras de uma tela que ainda nao e a dele.
    await vi.advanceTimersByTimeAsync(2000);
    expect(swap).not.toHaveBeenCalled();

    resolvePrepare();
    await vi.runAllTimersAsync();
    expect(order).toEqual(['prepare-done', 'swap']);
    expect(await done).toBe(true);
    // A onda passou: nenhum residuo fica na pagina, e o véu esta livre.
    expect(document.querySelector('.ax-veil')).toBeNull();
    expect(veilActive()).toBe(false);
  });

  it('ativacao com véu no ar e RECUSADA: nada roda, nenhum segundo véu', async () => {
    const first = vi.fn();
    const secondPrepare = vi.fn();
    const secondSwap = vi.fn();
    const firstDone = deployVeil({ swap: first });
    const secondDone = deployVeil({ prepare: secondPrepare, swap: secondSwap });

    // O Enter repetido no carimbo: o clique duplicado e descartado na hora —
    // sem segunda autorizacao, sem segunda troca, sem véu empilhado.
    expect(await secondDone).toBe(false);
    expect(secondPrepare).not.toHaveBeenCalled();
    expect(secondSwap).not.toHaveBeenCalled();
    expect(document.querySelectorAll('.ax-veil').length).toBe(1);

    await vi.runAllTimersAsync();
    expect(await firstDone).toBe(true);
    expect(first).toHaveBeenCalledTimes(1);
    expect(secondSwap).not.toHaveBeenCalled();
  });

  it('o teclado morre na captura enquanto o véu existe — e volta depois', async () => {
    // Um listener de jogo tipico: bolha na janela. A tecla de verdade tem como
    // alvo o elemento focado (aqui, o body) — e a captura do véu na janela a
    // mata antes de qualquer alvo abaixo.
    const reached = vi.fn();
    window.addEventListener('keydown', reached);
    const press = (): boolean =>
      document.body.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }),
      );
    const done = deployVeil({ swap: () => {} });

    press();
    expect(reached).not.toHaveBeenCalled();

    await vi.runAllTimersAsync();
    expect(await done).toBe(true);
    press();
    expect(reached).toHaveBeenCalledTimes(1);
    window.removeEventListener('keydown', reached);
  });

  it('atrasos diagonais nas células; o lampejo é UM elemento, nao N animacoes', async () => {
    void deployVeil({ swap: () => {} });
    const cells = document.querySelectorAll<HTMLElement>('.ax-veil span');
    const delays = new Set(Array.from(cells).map((cell) => cell.style.transitionDelay));
    // Onda diagonal exige atrasos ESCALONADOS — um atraso unico seria um
    // fade de tela inteira, nao um obturador.
    expect(delays.size).toBeGreaterThan(3);
    // Celulas NAO carregam animacao propria: animar cor por celula repintava
    // centenas de clip-paths por quadro no meio da onda. O lampejo teal e um
    // unico elemento varrendo por transform, com a duracao da onda inteira.
    for (const cell of Array.from(cells).slice(0, 20)) {
      expect(cell.style.animationDelay).toBe('');
    }
    const fronts = document.querySelectorAll<HTMLElement>('.ax-veil .ax-veil-front');
    expect(fronts.length).toBe(1);
    expect(fronts[0].style.animationDuration).not.toBe('');
    await vi.runAllTimersAsync();
  });

  it('tela grande nao paga mais: células com teto, onda com a MESMA duracao', async () => {
    // O happy-dom deixa o viewport nas maos do teste.
    (window as unknown as { innerWidth: number }).innerWidth = 1920;
    (window as unknown as { innerHeight: number }).innerHeight = 1080;
    void deployVeil({ swap: () => {} });
    const cells = document.querySelectorAll<HTMLElement>('.ax-veil span');
    // Sem o teto, 1920×1080 geraria ~2200 spans; com ele, a célula cresce.
    expect(cells.length).toBeLessThan(800);
    // E a onda dura o que dura no celular: o maior atraso respeita o teto.
    const maxDelay = Math.max(
      ...Array.from(cells).map((cell) => parseInt(cell.style.transitionDelay, 10)),
    );
    expect(maxDelay).toBeLessThanOrEqual(520 + 13);
    await vi.runAllTimersAsync();
    (window as unknown as { innerWidth: number }).innerWidth = 1024;
    (window as unknown as { innerHeight: number }).innerHeight = 768;
  });

  it('a estática toca uma vez por varredura: fechar e abrir', async () => {
    const sound = vi.fn();
    void deployVeil({ swap: () => {}, sound });
    // Fechou: primeira estática, junto com a onda.
    expect(sound).toHaveBeenCalledTimes(1);
    await vi.runAllTimersAsync();
    // Abriu: segunda e última — sem terceira depois que o véu some.
    expect(sound).toHaveBeenCalledTimes(2);
  });

  it('ativacao recusada nao toca estática: sem onda, sem som', async () => {
    const sound = vi.fn();
    void deployVeil({ swap: () => {} });
    const done = deployVeil({ swap: () => {}, sound });
    expect(await done).toBe(false);
    expect(sound).not.toHaveBeenCalled();
    await vi.runAllTimersAsync();
    expect(sound).not.toHaveBeenCalled();
  });

  it('um prepare que LANCA nao prende a tela no preto: troca e abre mesmo assim', async () => {
    const swap = vi.fn();
    const done = deployVeil({
      prepare: () => Promise.reject(new Error('autorizacao caiu')),
      swap,
    });
    await vi.runAllTimersAsync();
    expect(await done).toBe(true);
    // O estado de falha e problema do preparador; o véu garante a abertura.
    expect(swap).toHaveBeenCalledTimes(1);
    expect(document.querySelector('.ax-veil')).toBeNull();
  });
});
