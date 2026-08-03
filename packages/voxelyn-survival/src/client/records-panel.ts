// O painel "Registro": o arquivo de expedições da Aurix.
//
// HTML e nao canvas, ao contrario do resto da apresentacao, e por um motivo
// pratico: isto e texto denso e rolavel, e o canvas nao rola. Escrever quebra
// de linha, scroll e hit-test de toque a mao para reimplementar o que uma <div>
// ja faz seria trabalho gasto no lugar errado — o canvas existe aqui para o
// jogo, nao para os menus.
//
// O redesign (doc AD-UI-2.0, Torre de Arquivo) trocou a lista unica por ABAS:
// resumo, ativos, descobertas e historico. A lista plana obrigava o jogador a
// rolar o bestiario inteiro para chegar ao historico — e num arquivo
// corporativo cada assunto e uma pasta, nao uma pagina continua.
//
// A montagem e por DOM e nao por innerHTML com interpolacao. Nada aqui vem de
// fora hoje, mas o historico ja carrega seeds e vai carregar nome de jogador
// quando o leaderboard chegar; montar por texto agora e deixar a injecao
// pronta para o dia em que a fonte deixar de ser local.

import type { RunSummary } from '@voxelyn/survival-sim';
import {
  BESTIARY_FILES,
  BESTIARY_NAME_KEYS,
  BESTIARY_ORDER,
  DISCOVERIES,
  hasDiscovery,
  type Records,
} from './records';
import { t, type MessageKey } from './i18n';
import { describeCause, formatDuration, formatSeed } from './run-summary';

const el = (tag: string, className?: string, text?: string): HTMLElement => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

const section = (parent: HTMLElement, title: string): HTMLElement => {
  parent.appendChild(el('h2', undefined, title));
  return parent;
};

const definitions = (parent: HTMLElement, rows: Array<[string, string]>): void => {
  const dl = el('dl');
  for (const [label, value] of rows) {
    dl.appendChild(el('dt', undefined, label));
    dl.appendChild(el('dd', undefined, value));
  }
  parent.appendChild(dl);
};

const stars = (count: number): string => '★'.repeat(count) + '☆'.repeat(3 - count);

export type RecordsTab = 'summary' | 'assets' | 'discoveries' | 'history';

const TAB_LABEL: Record<RecordsTab, MessageKey> = {
  summary: 'records.tab.summary',
  assets: 'records.tab.assets',
  discoveries: 'records.tab.discoveries',
  history: 'records.tab.history',
};

/**
 * A aba aberta vive no MODULO, nao no chamador.
 *
 * O painel e redesenhado inteiro na troca de idioma (main.ts re-chama
 * `renderRecordsPanel` com o painel aberto), e um estado local a chamada
 * voltaria ao resumo no meio da leitura do historico. O custo — a proxima
 * abertura lembra a ultima aba — e o comportamento de um arquivo de verdade.
 */
let activeTab: RecordsTab = 'summary';

const renderSummaryTab = (host: HTMLElement, records: Records): void => {
  const { totals, best } = records;
  section(host, t('records.totals'));
  definitions(host, [
    [t('records.totals.runs'), String(totals.runs)],
    [t('records.totals.deaths'), String(totals.deaths)],
    [t('records.totals.extractions'), String(totals.extractions)],
    [t('records.totals.withCore'), String(totals.extractionsWithCore)],
    [t('records.totals.kills'), String(totals.kills)],
    [t('records.totals.time'), formatDuration(totals.ticks)],
  ]);

  section(host, t('records.best'));
  definitions(host, [
    [t('records.best.stars'), stars(best.stars)],
    [
      t('records.best.fastestCore'),
      best.fastestCoreTicks === null
        ? t('summary.stat.none')
        : formatDuration(best.fastestCoreTicks),
    ],
    [t('records.best.longestSurvival'), formatDuration(best.longestSurvivalTicks)],
    [t('records.best.masteredSeeds'), String(records.masteredSeeds.length)],
  ]);
};

// "REGISTRO DE ATIVOS", e nao "BESTIÁRIO".
//
// Quem escreve esta pagina e a empresa, e a empresa nao catalogaria povos como
// fauna nem admitiria que sao povos. A designacao corporativa vem primeiro,
// porque e o que o relatorio considera o nome de verdade; o nome que o JOGADOR
// aprendeu vem embaixo, como uma nota de campo que alguem acrescentou a mao.
//
// A distancia entre as duas linhas e o efeito inteiro. O jogo nao diz ao
// jogador o que sentir sobre isso — so mostra o que foi arquivado.
const renderAssetsTab = (host: HTMLElement, records: Records): void => {
  section(host, t('records.assets'));
  for (const archetype of BESTIARY_ORDER) {
    const entry = records.bestiary[archetype];
    // Oculto ate o primeiro abate: o registro e do que VOCE enfrentou, e listar
    // tudo de saida transforma descoberta em checklist. A ficha trancada troca a
    // moldura solida por tracejado + hachura — nunca so opacidade.
    if (!entry) {
      const file = el('div', 'ax-asset is-locked');
      file.appendChild(el('div', 'locked', t('records.assets.locked')));
      file.appendChild(el('span', 'lesson', t('records.assets.noOccurrence')));
      host.appendChild(file);
      continue;
    }
    const file = BESTIARY_FILES[archetype];
    const card = el('div', 'ax-asset');
    const row = el('div', 'found');
    row.appendChild(el('span', undefined, t(file.code)));
    row.appendChild(el('span', 'tally', t('records.assets.tally', { count: entry.killed })));
    card.appendChild(row);
    card.appendChild(el('span', 'lesson', t(file.note)));
    card.appendChild(
      el(
        'span',
        'field-note',
        t('records.assets.fieldName', { name: t(BESTIARY_NAME_KEYS[archetype]) }),
      ),
    );
    host.appendChild(card);
  }
};

const renderDiscoveriesTab = (host: HTMLElement, records: Records): void => {
  section(host, t('records.discoveries'));
  for (const discovery of DISCOVERIES) {
    const found = hasDiscovery(records, discovery.bit);
    const fragment = el('div', found ? 'ax-fragment' : 'ax-fragment is-locked');
    fragment.appendChild(
      el(
        'div',
        found ? 'found' : 'locked',
        found ? t(discovery.title) : t('records.assets.locked'),
      ),
    );
    fragment.appendChild(
      el('span', 'lesson', found ? t(discovery.lesson) : t('records.discoveries.locked')),
    );
    host.appendChild(fragment);
  }
};

/** Uma linha do livro de incidentes: resultado, tempo e o que acabou com a run. */
const historyOutcome = (run: RunSummary): string =>
  run.phase === 'extracted_with_core'
    ? t('records.history.core')
    : run.phase === 'extracted'
      ? t('records.history.extracted')
      : describeCause(run.deathCause).headline;

const renderHistoryTab = (host: HTMLElement, records: Records): void => {
  section(host, t('records.history'));
  if (records.history.length === 0) {
    host.appendChild(el('div', 'locked', t('records.history.empty')));
    return;
  }
  for (const run of records.history.slice(0, 8)) {
    const row = el('div', 'ax-ledger-row');
    row.appendChild(el('span', 'ax-stars', stars(run.stars)));
    row.appendChild(el('span', undefined, formatDuration(run.ticks)));
    row.appendChild(el('span', 'sub', historyOutcome(run)));
    row.appendChild(
      el('span', 'lesson', t('records.history.seed', { seed: formatSeed(run.seed) })),
    );
    host.appendChild(row);
  }
};

const TAB_RENDER: Record<RecordsTab, (host: HTMLElement, records: Records) => void> = {
  summary: renderSummaryTab,
  assets: renderAssetsTab,
  discoveries: renderDiscoveriesTab,
  history: renderHistoryTab,
};

export const renderRecordsPanel = (host: HTMLElement, records: Records): void => {
  host.textContent = '';

  const tabs = el('div', 'ax-tabs');
  for (const tab of ['summary', 'assets', 'discoveries', 'history'] as const) {
    const button = el(
      'button',
      `ax-tab${activeTab === tab ? ' is-active' : ''}`,
      t(TAB_LABEL[tab]),
    ) as HTMLButtonElement;
    button.addEventListener('click', () => {
      activeTab = tab;
      renderRecordsPanel(host, records);
    });
    tabs.appendChild(button);
  }
  host.appendChild(tabs);

  const body = el('div', 'panel');
  body.style.width = 'auto';
  body.style.maxHeight = 'none';
  body.style.border = 'none';
  TAB_RENDER[activeTab](body, records);
  host.appendChild(body);
};
