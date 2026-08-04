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

  it('ZERO células: obturador + estêncil + fio, duas animacoes de transform', async () => {
    void deployVeil({ swap: () => {} });
    const veil = document.querySelector<HTMLElement>('.ax-veil');
    // Nenhum nó por célula — as duas primeiras estratégias (cor por célula,
    // transform por célula) engasgavam no aparelho; a colmeia agora é um
    // estêncil de máscara sobre um fio que se move.
    expect(veil?.querySelectorAll('span').length).toBe(0);
    const fill = veil?.querySelector<HTMLElement>('.ax-veil-fill');
    const stencil = veil?.querySelector<HTMLElement>('.ax-veil-stencil');
    const front = veil?.querySelector<HTMLElement>('.ax-veil-front');
    expect(fill?.style.animationDuration).not.toBe('');
    expect(front?.style.animationDuration).not.toBe('');
    // A colmeia vive na máscara do estêncil, não em nós.
    expect(stencil?.style.getPropertyValue('mask-image')).toContain('data:image/svg+xml');
    await vi.runAllTimersAsync();
  });

  it('tela grande nao paga mais: a estrutura é a MESMA em qualquer viewport', async () => {
    (window as unknown as { innerWidth: number }).innerWidth = 1920;
    (window as unknown as { innerHeight: number }).innerHeight = 1080;
    void deployVeil({ swap: () => {} });
    const veil = document.querySelector<HTMLElement>('.ax-veil');
    // 1920×1080 e 844×390 pagam os mesmos três elementos e as mesmas duas
    // animações — só o percurso (--ax-sweep) muda.
    expect(veil?.querySelectorAll('*').length).toBe(3);
    expect(veil?.style.getPropertyValue('--ax-sweep')).not.toBe('');
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
