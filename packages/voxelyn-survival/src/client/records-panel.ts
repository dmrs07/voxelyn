// O painel "Registro": o que o jogador tem a mostrar depois de perder tudo.
//
// HTML e nao canvas, ao contrario do resto da apresentacao, e por um motivo
// pratico: isto e texto denso e rolavel, e o canvas nao rola. Escrever quebra
// de linha, scroll e hit-test de toque a mao para reimplementar o que uma <div>
// ja faz seria trabalho gasto no lugar errado — o canvas existe aqui para o
// jogo, nao para os menus.
//
// A montagem e por DOM e nao por innerHTML com interpolacao. Nada aqui vem de
// fora hoje, mas o historico ja carrega seeds e vai carregar nome de jogador
// quando o leaderboard chegar; montar por texto agora e deixar a injecao
// pronta para o dia em que a fonte deixar de ser local.

import type { RunSummary } from '@voxelyn/survival-sim';
import { BESTIARY_FILES, BESTIARY_NAMES, BESTIARY_ORDER, DISCOVERIES, hasDiscovery, type Records } from './records';
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

/** Uma linha de historico: resultado, tempo e o que acabou com a run. */
const historyLine = (run: RunSummary): string => {
  const outcome =
    run.phase === 'extracted_with_core'
      ? 'núcleo'
      : run.phase === 'extracted'
        ? 'saiu'
        : describeCause(run.deathCause).headline;
  return `${stars(run.stars)}  ${formatDuration(run.ticks)}  ${outcome}`;
};

export const renderRecordsPanel = (host: HTMLElement, records: Records): void => {
  host.textContent = '';
  const { totals, best } = records;

  section(host, 'TOTAIS');
  definitions(host, [
    ['Descidas', String(totals.runs)],
    ['Mortes', String(totals.deaths)],
    ['Extrações', String(totals.extractions)],
    ['Com o núcleo', String(totals.extractionsWithCore)],
    ['Abates', String(totals.kills)],
    ['Tempo no Veio', formatDuration(totals.ticks)],
  ]);

  section(host, 'MELHORES');
  definitions(host, [
    ['Melhor nota', stars(best.stars)],
    [
      'Núcleo mais rápido',
      best.fastestCoreTicks === null ? '—' : formatDuration(best.fastestCoreTicks),
    ],
    ['Maior sobrevivência', formatDuration(best.longestSurvivalTicks)],
    ['Seeds dominadas', String(records.masteredSeeds.length)],
  ]);

  // "REGISTRO DE ATIVOS", e nao "BESTIÁRIO".
  //
  // Quem escreve esta pagina e a empresa, e a empresa nao catalogaria povos como
  // fauna nem admitiria que sao povos. A designacao corporativa vem primeiro,
  // porque e o que o relatorio considera o nome de verdade; o nome que o JOGADOR
  // aprendeu vem embaixo, entre parenteses, como uma nota de campo que alguem
  // acrescentou a mao.
  //
  // A distancia entre as duas linhas e o efeito inteiro. O jogo nao diz ao
  // jogador o que sentir sobre isso — so mostra o que foi arquivado.
  section(host, 'REGISTRO DE ATIVOS');
  for (const archetype of BESTIARY_ORDER) {
    const entry = records.bestiary[archetype];
    // Oculto ate o primeiro abate: o registro e do que VOCE enfrentou, e listar
    // tudo de saida transforma descoberta em checklist.
    if (!entry) {
      host.appendChild(el('div', 'locked', '— — —'));
      host.appendChild(el('span', 'lesson', 'sem ocorrência registrada'));
      continue;
    }
    const file = BESTIARY_FILES[archetype];
    const row = el('div', 'found');
    row.appendChild(el('span', undefined, file.code));
    row.appendChild(el('span', 'tally', `×${entry.killed}`));
    host.appendChild(row);
    host.appendChild(el('span', 'lesson', file.note));
    host.appendChild(el('span', 'field-note', `campo: ${BESTIARY_NAMES[archetype]}`));
  }

  section(host, 'DESCOBERTAS');
  for (const discovery of DISCOVERIES) {
    const found = hasDiscovery(records, discovery.bit);
    const title = el('div', found ? 'found' : 'locked', found ? discovery.title : '— — —');
    host.appendChild(title);
    host.appendChild(
      el('span', 'lesson', found ? discovery.lesson : 'ainda não aconteceu com você'),
    );
  }

  section(host, 'ÚLTIMAS DESCIDAS');
  if (records.history.length === 0) {
    host.appendChild(el('div', 'locked', 'nenhuma ainda'));
    return;
  }
  for (const run of records.history.slice(0, 8)) {
    const row = el('div', undefined, historyLine(run));
    row.appendChild(el('span', 'lesson', `seed ${formatSeed(run.seed)}`));
    host.appendChild(row);
  }
};
