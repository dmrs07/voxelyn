// A corrida que ja custou a carga de duas runs. Dez linhas para trava-la.

import { describe, expect, it } from 'vitest';
import { SettlementQueue } from './settlement-queue';

const entry = (runId: string) => ({ runId, log: `log-${runId}`, url: 'http://s' });

describe('fila de liquidacoes pendentes', () => {
  it('guarda e devolve o que precisa ser reenviado', () => {
    const queue = new SettlementQueue();
    expect(queue.drain()).toEqual([]);
    queue.hold(entry('A'));
    expect(queue.drain()).toEqual([{ runId: 'A', log: 'log-A', url: 'http://s' }]);
  });

  // A corrida: a liquidacao espera ate 45 s e o ticket seguinte volta em 6, entao
  // a run B termina e falha enquanto a retentativa de A ainda esta no ar. Com um
  // slot unico, o sucesso tardio de A apagava o pendente de B — e a carga de B
  // nunca mais seria reenviada.
  it('o sucesso tardio de uma run nao apaga o pendente de outra', () => {
    const queue = new SettlementQueue();
    queue.hold(entry('A'));
    queue.hold(entry('B'));

    queue.settled('A');

    expect(queue.has('A')).toBe(false);
    expect(queue.has('B')).toBe(true);
    expect(queue.drain()).toEqual([{ runId: 'B', log: 'log-B', url: 'http://s' }]);
  });

  it('liquidar uma run desconhecida nao afeta ninguem', () => {
    const queue = new SettlementQueue();
    queue.hold(entry('A'));
    queue.settled('nunca-existiu');
    expect(queue.size).toBe(1);
  });

  it('guardar a mesma run duas vezes atualiza, e nao duplica', () => {
    const queue = new SettlementQueue();
    queue.hold(entry('A'));
    queue.hold({ runId: 'A', log: 'log-novo', url: 'http://outro' });
    expect(queue.drain()).toEqual([{ runId: 'A', log: 'log-novo', url: 'http://outro' }]);
  });

  // `drain` e copia porque quem chama dispara requisicoes que voltam a escrever
  // aqui: iterar a colecao viva enquanto ela muda so quebra com a rede ruim, que
  // e exatamente quando esta fila entra em uso.
  it('drain devolve copia: escrever durante a iteracao nao quebra', () => {
    const queue = new SettlementQueue();
    queue.hold(entry('A'));
    for (const pending of queue.drain()) {
      queue.settled(pending.runId);
      queue.hold(entry('C'));
    }
    expect(queue.has('A')).toBe(false);
    expect(queue.has('C')).toBe(true);
  });
});
