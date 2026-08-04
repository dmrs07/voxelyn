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
import type { SpriteBank } from './sprites';

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
// ---------------------------------------------------------------------------
// O slot de sprite da ficha (board 3g): a criatura viva, em miniatura.
// ---------------------------------------------------------------------------
// A criatura anda em DL (baixo-esquerda) dentro de um monitor de 56px com
// tint teal — a ficha nao mostra a criatura, mostra a GRAVACAO dela no
// arquivo da Aurix. O atlas e o mesmo do jogo, emprestado do renderer; o
// painel nunca carrega imagem propria.

/** Lado do monitor da ficha, px (o canvas; a moldura vem do CSS). */
const SPRITE_SLOT = 56;
/** O tint do arquivo: toda gravacao da Aurix sai na fosforescencia teal. */
const ARCHIVE_TINT = { color: '#4fd6c9', alpha: 0.45 };

let spriteRaf = 0;

const drawSpriteSlot = (bank: SpriteBank, canvas: HTMLCanvasElement, elapsedMs: number): void => {
  const archetype = canvas.dataset.archetype;
  if (!archetype) return;
  const manifest = bank.manifestForArchetype(archetype);
  const ctx = canvas.getContext('2d');
  if (!manifest || !ctx) return;
  ctx.clearRect(0, 0, SPRITE_SLOT, SPRITE_SLOT);
  const zoom = Math.min(
    (SPRITE_SLOT - 6) / manifest.frameWidth,
    (SPRITE_SLOT - 6) / manifest.frameHeight,
  );
  // Ancoragem: centraliza na horizontal e senta o pe 3px acima da borda.
  const footX = SPRITE_SLOT / 2 + (manifest.anchorX - manifest.frameWidth / 2) * zoom;
  const footY = SPRITE_SLOT - 3 - (manifest.frameHeight - manifest.anchorY) * zoom;
  bank.drawEntity(ctx, archetype, 'walk', -1, 1, elapsedMs, footX, footY, zoom, ARCHIVE_TINT);
};

/**
 * O laco de animacao das fichas. UM rAF para o painel inteiro, que se
 * desliga sozinho quando as fichas saem do DOM ou a overlay esconde — um
 * laco orfao continuaria queimando bateria atras de um menu fechado.
 */
const animateSprites = (bank: SpriteBank, host: HTMLElement): void => {
  cancelAnimationFrame(spriteRaf);
  const reduced =
    typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const start = performance.now();
  const tick = (now: number): void => {
    const canvases = host.querySelectorAll<HTMLCanvasElement>('canvas.ax-asset-sprite');
    const hidden = host.closest('.overlay')?.classList.contains('hidden') ?? false;
    if (canvases.length === 0 || hidden || !host.isConnected) {
      spriteRaf = 0;
      return;
    }
    canvases.forEach((canvas, index) => {
      // Fases defasadas: dezesseis criaturas marchando em sincronia leem como
      // um unico GIF; o arquivo e feito de gravacoes independentes.
      drawSpriteSlot(bank, canvas, now - start + index * 350);
    });
    spriteRaf = requestAnimationFrame(tick);
  };
  if (reduced) {
    // Sem movimento: um unico quadro parado de cada gravacao.
    host
      .querySelectorAll<HTMLCanvasElement>('canvas.ax-asset-sprite')
      .forEach((canvas, index) => drawSpriteSlot(bank, canvas, index * 350));
    return;
  }
  spriteRaf = requestAnimationFrame(tick);
};

const renderAssetsTab = (host: HTMLElement, records: Records, sprites?: SpriteBank): void => {
  section(host, t('records.assets'));
  for (const archetype of BESTIARY_ORDER) {
    const entry = records.bestiary[archetype];
    // Oculto ate o primeiro abate: o registro e do que VOCE enfrentou, e listar
    // tudo de saida transforma descoberta em checklist. A ficha trancada troca a
    // moldura solida por tracejado + hachura — nunca so opacidade.
    if (!entry) {
      const file = el('div', 'ax-asset is-locked');
      const slot = el('div', 'ax-asset-slot is-locked', '?');
      file.appendChild(slot);
      const body = el('div', 'ax-asset-body');
      body.appendChild(el('div', 'locked', t('records.assets.locked')));
      body.appendChild(el('span', 'lesson', t('records.assets.noOccurrence')));
      file.appendChild(body);
      host.appendChild(file);
      continue;
    }
    const file = BESTIARY_FILES[archetype];
    const card = el('div', 'ax-asset');
    const slot = el('div', 'ax-asset-slot');
    if (sprites) {
      const canvas = el('canvas', 'ax-asset-sprite') as HTMLCanvasElement;
      canvas.width = SPRITE_SLOT;
      canvas.height = SPRITE_SLOT;
      canvas.dataset.archetype = archetype;
      slot.appendChild(canvas);
    }
    card.appendChild(slot);
    const body = el('div', 'ax-asset-body');
    const row = el('div', 'found');
    row.appendChild(el('span', undefined, t(file.code)));
    row.appendChild(el('span', 'tally', t('records.assets.tally', { count: entry.killed })));
    body.appendChild(row);
    body.appendChild(el('span', 'lesson', t(file.note)));
    body.appendChild(
      el(
        'span',
        'field-note',
        t('records.assets.fieldName', { name: t(BESTIARY_NAME_KEYS[archetype]) }),
      ),
    );
    card.appendChild(body);
    host.appendChild(card);
  }
  if (sprites) animateSprites(sprites, host);
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

const TAB_RENDER: Record<
  RecordsTab,
  (host: HTMLElement, records: Records, sprites?: SpriteBank) => void
> = {
  summary: renderSummaryTab,
  assets: renderAssetsTab,
  discoveries: renderDiscoveriesTab,
  history: renderHistoryTab,
};

export const renderRecordsPanel = (
  host: HTMLElement,
  records: Records,
  sprites?: SpriteBank,
): void => {
  // Redesenhar limpa o DOM e derrubaria o foco no documento a cada troca de
  // aba — o mesmo problema (e a mesma solucao) do painel da Matriz.
  const active = document.activeElement;
  const focusKey =
    active instanceof HTMLElement && host.contains(active)
      ? (active.dataset.axFocus ?? null)
      : null;

  host.textContent = '';

  const tabs = el('div', 'ax-tabs');
  tabs.setAttribute('role', 'tablist');
  for (const tab of ['summary', 'assets', 'discoveries', 'history'] as const) {
    const button = el(
      'button',
      `ax-tab${activeTab === tab ? ' is-active' : ''}`,
      t(TAB_LABEL[tab]),
    ) as HTMLButtonElement;
    button.setAttribute('role', 'tab');
    button.setAttribute('aria-selected', activeTab === tab ? 'true' : 'false');
    button.dataset.axFocus = `tab:${tab}`;
    button.addEventListener('click', () => {
      activeTab = tab;
      renderRecordsPanel(host, records, sprites);
    });
    tabs.appendChild(button);
  }
  host.appendChild(tabs);

  const body = el('div', 'panel');
  body.style.width = 'auto';
  body.style.maxHeight = 'none';
  body.style.border = 'none';
  TAB_RENDER[activeTab](body, records, sprites);
  host.appendChild(body);

  if (focusKey) {
    host.querySelector<HTMLElement>(`[data-ax-focus="${CSS.escape(focusKey)}"]`)?.focus();
  }
};
