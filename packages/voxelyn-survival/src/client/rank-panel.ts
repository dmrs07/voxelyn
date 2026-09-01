// O painel do ranking: o livro de expedições homologadas.
//
// Montagem por DOM, nunca por innerHTML com interpolacao. Aqui isso deixa de
// ser precaucao e vira necessidade: os nomes vem de OUTRAS PESSOAS, pela rede.
// O servidor ja remove caracteres de controle e corta o comprimento, mas quem
// renderiza e o ultimo responsavel — e `textContent` torna a injecao impossivel
// em vez de improvavel.
//
// O redesign (doc AD-UI-2.0) transformou a lista em LIVRO-CAIXA: colunas de
// posicao, estrelas, operador e tempo, com keyline dourada nas tres primeiras
// linhas — distincao de papel timbrado, nao de podio de game show.
//
// UM LIVRO POR PROFUNDIDADE. As abas no topo nao sao um filtro de conveniencia:
// elas sao a estrutura do placar. Descidas de tres e de sete setores nao sao a
// mesma prova — a segunda tem mais Nucleos disponiveis e leva o dobro do tempo
// — e uma lista unica compararia autorizacao em vez de habilidade. A coluna de
// Nucleos existe pelo mesmo motivo: ela e a pontuacao, e um livro que ordena
// por um numero que nao mostra parece quebrado mesmo quando esta certo.

import { formatDuration, formatSeed } from './run-summary';
import type { RankClass, RankEntry } from './run-recorder';
import { t } from './i18n';

const el = (tag: string, className?: string, text?: string): HTMLElement => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

const stars = (count: number): string => '★'.repeat(count) + '☆'.repeat(Math.max(0, 3 - count));

export type RankView = {
  entries: RankEntry[];
  /** Seed do placar, quando ele e de uma descida especifica. */
  seed?: number;
  /** Os livros que existem, do mais raso ao mais fundo. */
  classes?: RankClass[];
  /** O livro aberto. Zero quando ainda nao ha resposta do servidor. */
  sectorCount?: number;
  /** Trocar de livro. Ausente enquanto carrega: aba que nao responde e pior que aba ausente. */
  onSelectClass?: (sectorCount: number) => void;
  /**
   * Abrir o replay autoritativo de uma linha.
   *
   * Ausente tem o mesmo efeito de `entry.replayAvailable` falso: nenhum botao
   * aparece. As duas condicoes precisam ser verdadeiras porque sao duas coisas
   * diferentes — a linha TER um log guardado, e a tela SABER abrir um.
   */
  onWatchReplay?: (entry: RankEntry) => void;
  /** Mensagem quando nao ha o que mostrar (offline, vazio). */
  emptyReason?: string;
  /**
   * A consulta ainda esta no ar?
   *
   * Separado de `emptyReason` porque espera e ausencia nao podem vestir a
   * mesma roupa: carregando ganha a varredura CRT (board 3p); vazio/offline
   * ganha a hachura de indisponivel. Antes os dois saiam hachurados — e a
   * hachura promete "nao ha", que e mentira enquanto a resposta nao chegou.
   */
  loading?: boolean;
};

/**
 * As abas de profundidade.
 *
 * So aparecem com DOIS livros ou mais. Uma aba solitaria nao oferece escolha
 * nenhuma e ainda assim ocupa a primeira linha da tela dizendo ao jogador que
 * existe algo a decidir — e no dia do deploy, com um livro so, seria exatamente
 * isso.
 */
const renderClasses = (host: HTMLElement, view: RankView): void => {
  const classes = view.classes ?? [];
  if (classes.length < 2) return;
  const tabs = el('div', 'ax-tabs ax-rank-classes');
  for (const board of classes) {
    const active = board.sectorCount === view.sectorCount;
    const tab = el(
      'button',
      `ax-tab${active ? ' is-active' : ''}`,
      t('rank.class', { sectors: board.sectorCount }),
    ) as HTMLButtonElement;
    tab.type = 'button';
    // `aria-pressed` e nao `aria-selected`: sao botoes num grupo, e nao um
    // tablist com paineis irmaos — anunciar tablist obrigaria a navegacao por
    // setas que este grupo nao implementa.
    tab.setAttribute('aria-pressed', String(active));
    tab.title = t('rank.class.entries', { entries: board.entries });
    if (!active && view.onSelectClass) {
      tab.addEventListener('click', () => view.onSelectClass?.(board.sectorCount));
    }
    tabs.appendChild(tab);
  }
  host.appendChild(tabs);
};

export const renderRankPanel = (host: HTMLElement, view: RankView): void => {
  host.textContent = '';

  host.appendChild(
    el(
      'h2',
      'ax-section-label',
      view.seed === undefined ? t('rank.best') : t('rank.seed', { seed: formatSeed(view.seed) }),
    ),
  );

  renderClasses(host, view);

  if (view.entries.length === 0 && view.loading) {
    // Consultando o livro: varredura CRT, o unico CRT permitido (board 3p).
    host.appendChild(el('div', 'ax-scan ax-loading', view.emptyReason ?? t('rank.loading')));
  } else if (view.entries.length === 0) {
    // Livro vazio: tracejado + motivo escrito, nunca uma tela em branco.
    const empty = el('div', 'ax-fragment is-locked');
    empty.appendChild(el('div', 'locked', view.emptyReason ?? t('rank.empty')));
    host.appendChild(empty);
  } else {
    // A ORDEM DAS COLUNAS E A FORMULA DA POSICAO, lida da esquerda para a
    // direita: posicao, quem, e entao os dois numeros que ordenam — Nucleos e
    // tempo, nessa ordem. As estrelas ficam por ULTIMO, e a mudanca nao e
    // estetica.
    //
    // Enquanto elas vinham em segundo lugar, ocupavam o slot em que o olho
    // procura o criterio de ordenacao — e nao sao mais o criterio. Num livro
    // fundo isso produzia uma lista que PARECE quebrada estando certa: uma
    // ★★★ de um Nucleo aparece abaixo de duas ★★☆ de dois, e quem le a coluna
    // de cima para baixo ve as notas fora de ordem antes de ver o porque. No
    // fim da linha elas voltam a ser o que sao: a leitura da run, nao a
    // posicao dela.
    const head = el('div', 'ax-rank-head');
    head.appendChild(el('span', undefined, '#'));
    head.appendChild(el('span', undefined, t('rank.col.operator')));
    head.appendChild(el('span', undefined, t('rank.col.cores')));
    head.appendChild(el('span', undefined, t('rank.col.time')));
    head.appendChild(el('span', undefined, '★'));
    // Sem rotulo: e a coluna do botao de replay, e um cabecalho vazio ainda
    // preenche a sexta faixa da grade para as linhas continuarem alinhadas.
    head.appendChild(el('span'));
    host.appendChild(head);

    view.entries.forEach((entry, index) => {
      const row = el('div', `ax-rank-row${index < 3 ? ' is-podium' : ''}`);
      row.appendChild(el('span', 'ax-rank-pos', String(index + 1).padStart(2, '0')));
      row.appendChild(el('span', 'ax-rank-name', entry.name));
      row.appendChild(el('span', 'ax-rank-cores', String(entry.cores ?? 0)));
      row.appendChild(el('span', 'ax-rank-time', formatDuration(entry.ticks)));
      row.appendChild(el('span', 'ax-stars', stars(entry.stars)));
      const replayCell = el('span', 'ax-rank-replay');
      if (entry.replayAvailable && view.onWatchReplay) {
        const btn = el('button', 'ax-rank-replay-btn', '▶') as HTMLButtonElement;
        btn.type = 'button';
        btn.title = t('rank.replay');
        btn.setAttribute('aria-label', t('rank.replay'));
        btn.addEventListener('click', () => view.onWatchReplay?.(entry));
        replayCell.appendChild(btn);
      }
      row.appendChild(replayCell);
      host.appendChild(row);
    });
  }

  // A explicacao da homologacao: toda descida e reexecutada pela Aurix a
  // partir das entradas registradas. E o que separa o livro de um placar.
  host.appendChild(el('h2', 'ax-section-label', t('rank.how')));
  host.appendChild(el('span', 'lesson', t('rank.how.text')));
};
