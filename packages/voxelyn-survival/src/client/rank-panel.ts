// O painel do ranking.
//
// Montagem por DOM, nunca por innerHTML com interpolacao. Aqui isso deixa de
// ser precaucao e vira necessidade: os nomes vem de OUTRAS PESSOAS, pela rede.
// O servidor ja remove caracteres de controle e corta o comprimento, mas quem
// renderiza e o ultimo responsavel — e `textContent` torna a injecao impossivel
// em vez de improvavel.

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
};

export const renderRankPanel = (host: HTMLElement, view: RankView): void => {
  host.textContent = '';

  host.appendChild(
    el(
      'h2',
      undefined,
      view.seed === undefined ? t('rank.best') : t('rank.seed', { seed: formatSeed(view.seed) }),
    ),
  );

  if (view.entries.length === 0) {
    host.appendChild(el('div', 'locked', view.emptyReason ?? t('rank.empty')));
    return;
  }

  const dl = el('dl');
  view.entries.forEach((entry, index) => {
    // A posicao entra no rotulo, e nao numa coluna propria: o painel ja e
    // estreito no celular, e uma terceira coluna espremeria o nome.
    dl.appendChild(
      el(
        'dt',
        undefined,
        t('rank.entry', { position: index + 1, stars: stars(entry.stars), name: entry.name }),
      ),
    );
    dl.appendChild(el('dd', undefined, formatDuration(entry.ticks)));
  });
  host.appendChild(dl);

  host.appendChild(el('h2', undefined, t('rank.how')));
  host.appendChild(el('span', 'lesson', t('rank.how.text')));
};
