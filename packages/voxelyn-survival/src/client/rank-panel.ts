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

import { formatDuration, formatSeed } from './run-summary';
import type { RankEntry } from './run-recorder';
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

export const renderRankPanel = (host: HTMLElement, view: RankView): void => {
  host.textContent = '';

  host.appendChild(
    el(
      'h2',
      'ax-section-label',
      view.seed === undefined ? t('rank.best') : t('rank.seed', { seed: formatSeed(view.seed) }),
    ),
  );

  if (view.entries.length === 0 && view.loading) {
    // Consultando o livro: varredura CRT, o unico CRT permitido (board 3p).
    host.appendChild(el('div', 'ax-scan ax-loading', view.emptyReason ?? t('rank.loading')));
  } else if (view.entries.length === 0) {
    // Livro vazio: tracejado + motivo escrito, nunca uma tela em branco.
    const empty = el('div', 'ax-fragment is-locked');
    empty.appendChild(el('div', 'locked', view.emptyReason ?? t('rank.empty')));
    host.appendChild(empty);
  } else {
    const head = el('div', 'ax-rank-head');
    head.appendChild(el('span', undefined, '#'));
    head.appendChild(el('span', undefined, '★'));
    head.appendChild(el('span', undefined, t('rank.col.operator')));
    head.appendChild(el('span', undefined, t('rank.col.time')));
    host.appendChild(head);

    view.entries.forEach((entry, index) => {
      const row = el('div', `ax-rank-row${index < 3 ? ' is-podium' : ''}`);
      row.appendChild(el('span', 'ax-rank-pos', String(index + 1).padStart(2, '0')));
      row.appendChild(el('span', 'ax-stars', stars(entry.stars)));
      row.appendChild(el('span', 'ax-rank-name', entry.name));
      row.appendChild(el('span', 'ax-rank-time', formatDuration(entry.ticks)));
      host.appendChild(row);
    });
  }

  // A explicacao da homologacao: toda descida e reexecutada pela Aurix a
  // partir das entradas registradas. E o que separa o livro de um placar.
  host.appendChild(el('h2', 'ax-section-label', t('rank.how')));
  host.appendChild(el('span', 'lesson', t('rank.how.text')));
};
