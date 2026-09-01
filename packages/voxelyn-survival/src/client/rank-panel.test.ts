// @vitest-environment happy-dom
//
// O painel do ranking, na parte que o jogador usa para NAVEGAR entre livros.
//
// O que estes testes protegem sao duas decisoes que falham em silencio:
//
//   1. as abas so aparecem com dois livros ou mais — uma aba solitaria ocupa a
//      primeira linha da tela anunciando uma escolha que nao existe, e no dia
//      do deploy, com um livro so, seria exatamente isso;
//   2. a coluna de Nucleos e desenhada — ela e a pontuacao, e um livro que
//      ordena por um numero que nao mostra parece quebrado mesmo estando certo.

import { beforeEach, describe, expect, it } from 'vitest';
import { renderRankPanel } from './rank-panel';
import type { RankEntry } from './run-recorder';
import { setLocale } from './i18n';

const entry = (over: Partial<RankEntry> = {}): RankEntry => ({
  id: 1,
  name: 'Dani',
  seed: 42,
  stars: 3,
  ticks: 6000,
  phase: 'extracted_with_core',
  mode: 'solo',
  kills: 0,
  cores: 1,
  sectorCount: 3,
  replayAvailable: false,
  ...over,
});

let host: HTMLElement;
beforeEach(() => {
  setLocale('pt-BR');
  host = document.createElement('div');
});

describe('abas de profundidade', () => {
  it('nao aparecem quando so existe um livro', () => {
    renderRankPanel(host, {
      entries: [entry()],
      classes: [{ sectorCount: 3, entries: 1 }],
      sectorCount: 3,
    });
    expect(host.querySelectorAll('.ax-rank-classes .ax-tab')).toHaveLength(0);
  });

  it('aparecem com dois livros, e marcam o aberto', () => {
    renderRankPanel(host, {
      entries: [entry()],
      classes: [
        { sectorCount: 3, entries: 4 },
        { sectorCount: 7, entries: 1 },
      ],
      sectorCount: 7,
    });
    const tabs = Array.from(host.querySelectorAll<HTMLButtonElement>('.ax-rank-classes .ax-tab'));
    expect(tabs.map((t) => t.textContent)).toEqual(['3 setores', '7 setores']);
    expect(tabs.map((t) => t.getAttribute('aria-pressed'))).toEqual(['false', 'true']);
  });

  it('clicar numa aba fechada pede aquele livro', () => {
    const asked: number[] = [];
    renderRankPanel(host, {
      entries: [],
      classes: [
        { sectorCount: 3, entries: 4 },
        { sectorCount: 7, entries: 1 },
      ],
      sectorCount: 3,
      onSelectClass: (sectors) => asked.push(sectors),
    });
    const tabs = Array.from(host.querySelectorAll<HTMLButtonElement>('.ax-rank-classes .ax-tab'));
    tabs[1].click();
    // A aba ja aberta nao repete a consulta: um clique nela seria uma ida a
    // rede que nao muda nada na tela.
    tabs[0].click();
    expect(asked).toEqual([7]);
  });

  /**
   * As abas continuam na tela ENQUANTO a lista e buscada.
   *
   * Sem isto, trocar de livro faz o seletor inteiro piscar fora e voltar — e a
   * aba que o jogador acabou de clicar some justamente no instante em que ele
   * espera ver o resultado dela.
   */
  it('sobrevivem ao estado de carregamento', () => {
    renderRankPanel(host, {
      entries: [],
      loading: true,
      classes: [
        { sectorCount: 3, entries: 4 },
        { sectorCount: 7, entries: 1 },
      ],
      sectorCount: 7,
    });
    expect(host.querySelectorAll('.ax-rank-classes .ax-tab')).toHaveLength(2);
    expect(host.querySelector('.ax-loading')).not.toBeNull();
  });
});

describe('a linha do livro', () => {
  /**
   * A ordem das colunas e a formula da posicao, lida da esquerda para a
   * direita. As estrelas por ULTIMO nao e capricho: no slot anterior (segundo
   * lugar) elas ocupavam onde o olho procura o criterio de ordenacao, e num
   * livro fundo a lista PARECIA quebrada estando certa — uma ★★★ de um Nucleo
   * abaixo de duas ★★☆ de dois.
   */
  it('ordena as colunas como a pontuacao ordena as linhas', () => {
    renderRankPanel(host, { entries: [entry()] });
    const head = Array.from(host.querySelectorAll('.ax-rank-head span')).map(
      (s) => s.textContent,
    );
    // A sexta faixa e a coluna do botao de replay — sem rotulo de proposito
    // (ver `renderRankPanel`), e ainda assim presente para as linhas casarem
    // com o cabecalho.
    expect(head).toEqual(['#', 'Operador', 'Núcleos', 'Tempo', '★', '']);
  });

  it('mostra os Nucleos, que sao a pontuacao', () => {
    renderRankPanel(host, { entries: [entry({ cores: 2 })] });
    expect(host.querySelector('.ax-rank-cores')?.textContent).toBe('2');
  });

  // Os nomes vem de outras pessoas, pela rede. `textContent` torna a injecao
  // impossivel em vez de improvavel — o servidor sanear nao dispensa isto.
  it('escreve o nome como texto, nunca como marcacao', () => {
    renderRankPanel(host, { entries: [entry({ name: '<img src=x onerror=1>' })] });
    expect(host.querySelector('img')).toBeNull();
    expect(host.querySelector('.ax-rank-name')?.textContent).toBe('<img src=x onerror=1>');
  });
});

describe('botao de replay', () => {
  /**
   * As duas condicoes tem de ser verdadeiras: a linha TER um log guardado
   * (`replayAvailable`) e a tela SABER abrir um (`onWatchReplay`). Faltando
   * qualquer uma, o botao nao aparece — um botao que nao leva a lugar nenhum
   * e pior que nenhum botao.
   */
  it('nao aparece sem replayAvailable, mesmo com onWatchReplay', () => {
    renderRankPanel(host, {
      entries: [entry({ replayAvailable: false })],
      onWatchReplay: () => {},
    });
    expect(host.querySelector('.ax-replay-btn')).toBeNull();
  });

  it('nao aparece sem onWatchReplay, mesmo com replayAvailable', () => {
    renderRankPanel(host, { entries: [entry({ replayAvailable: true })] });
    expect(host.querySelector('.ax-replay-btn')).toBeNull();
  });

  it('aparece com as duas condicoes, e o clique leva a propria linha', () => {
    const watched: number[] = [];
    renderRankPanel(host, {
      entries: [entry({ id: 7, replayAvailable: true })],
      onWatchReplay: (entry) => watched.push(entry.id),
    });
    const btn = host.querySelector<HTMLButtonElement>('.ax-replay-btn');
    expect(btn).not.toBeNull();
    btn?.click();
    expect(watched).toEqual([7]);
  });
});
