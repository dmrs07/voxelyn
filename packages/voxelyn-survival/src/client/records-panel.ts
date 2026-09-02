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
import type { CodexContext, PublicProgressionProfile } from '@voxelyn/survival-protocol';
import {
  BESTIARY_FILES,
  BESTIARY_NAME_KEYS,
  BESTIARY_ORDER,
  DISCOVERIES,
  hasDiscovery,
  runSummaryIdentity,
  type Records,
} from './records';
import { t, type MessageKey } from './i18n';
import { describeCause, formatDuration, formatSeed } from './run-summary';
import type { SpriteBank } from './sprites';
import { externalLinkIconSvg, newDotSpan } from './matrix-icons';

/**
 * A ponte Registro → Codex.
 *
 * O Registro continua funcionando 100% offline sem ela (o historico e local e
 * sempre foi); quando o perfil autoritativo existe, ela acrescenta o "Ver docs"
 * e a bolinha de documento novo. `profile.loreIndex` e DERIVADO NO SERVIDOR e
 * so contem Ativos conhecidos e Descobertas feitas — e por isso que consulta-lo
 * aqui nunca revela ficha de inimigo que o jogador ainda nao identificou.
 */
export type RecordsCodexLink = {
  profile: PublicProgressionProfile | null;
  onViewDocs: (context: CodexContext) => void;
};

/**
 * O que o Registro oferece ALEM de ler os proprios records.
 *
 * Hoje so o replay das descidas guardadas neste aparelho. As duas metades
 * chegam de fora — quais linhas tem log (`replayable`) e o que fazer ao clicar
 * (`onWatchReplay`) — porque `local-replays.ts` fala com `localStorage`, e um
 * painel que le storage sozinho deixa de poder ser desenhado num teste.
 */
export type RecordsPanelOptions = {
  /** As identidades (`runSummaryIdentity`) que tem replay guardado e valido. */
  replayable?: ReadonlySet<string>;
  onWatchReplay?: (run: RunSummary) => void;
};

/** Os documentos deste contexto tem algum ainda nao lido? */
const hasUnreadDocs = (
  profile: PublicProgressionProfile,
  fragmentIds: readonly string[],
): boolean => {
  const read = new Set(profile.readLoreFragmentIds ?? []);
  return fragmentIds.some((id) => !read.has(id));
};

/**
 * O link "Ver docs ↗", ou null quando este contexto nao tem documentos.
 *
 * Nao aparecer e a regra de sigilo: um Ativo bloqueado com link revelaria que
 * existe uma ficha concreta para um inimigo ainda nao identificado.
 */
const viewDocsLink = (
  codex: RecordsCodexLink | undefined,
  context: CodexContext,
  fragmentIds: readonly string[] | undefined,
  ariaName: string,
  focusKey: string,
): HTMLElement | null => {
  if (!codex?.profile || !fragmentIds || fragmentIds.length === 0) return null;
  const button = el('button', 'ax-viewdocs') as HTMLButtonElement;
  button.dataset.axFocus = focusKey;
  button.setAttribute('aria-label', t('records.viewDocs.aria', { name: ariaName }));
  if (hasUnreadDocs(codex.profile, fragmentIds)) {
    button.appendChild(newDotSpan(t('codex.new')));
  }
  button.appendChild(el('span', undefined, t('records.viewDocs')));
  const icon = el('span', 'ax-viewdocs-icon');
  // innerHTML e seguro aqui: o SVG e constante nossa, nunca dado de fora.
  icon.innerHTML = externalLinkIconSvg();
  button.appendChild(icon);
  button.addEventListener('click', () => codex.onViewDocs(context));
  return button;
};

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
  // "Melhores" sem nenhuma descida: um travessao para tudo. Tres estrelas
  // vazias e "0:00" liam como notas reais (a pior nota, o menor tempo).
  const none = t('summary.stat.none');
  definitions(host, [
    [t('records.best.stars'), best.stars === 0 ? none : stars(best.stars)],
    [
      t('records.best.fastestCore'),
      best.fastestCoreTicks === null ? none : formatDuration(best.fastestCoreTicks),
    ],
    [
      t('records.best.longestSurvival'),
      best.longestSurvivalTicks === 0 ? none : formatDuration(best.longestSurvivalTicks),
    ],
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

const renderAssetsTab = (
  host: HTMLElement,
  records: Records,
  sprites?: SpriteBank,
  codex?: RecordsCodexLink,
): void => {
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
    // Encadeamento opcional ate o fim: um perfil hidratado de um cache antigo
    // pode chegar sem `loreIndex`, e o Registro tem de continuar utilizavel —
    // sem links, mas de pe.
    const docs = viewDocsLink(
      codex,
      { kind: 'asset', archetype },
      codex?.profile?.loreIndex?.assets?.[archetype],
      t(BESTIARY_NAME_KEYS[archetype]),
      `viewdocs:${archetype}`,
    );
    if (docs) row.appendChild(docs);
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

const renderDiscoveriesTab = (
  host: HTMLElement,
  records: Records,
  _sprites?: SpriteBank,
  codex?: RecordsCodexLink,
): void => {
  section(host, t('records.discoveries'));
  for (const discovery of DISCOVERIES) {
    const found = hasDiscovery(records, discovery.bit);
    const fragment = el('div', found ? 'ax-fragment' : 'ax-fragment is-locked');
    const headline = el(
      'div',
      found ? 'found' : 'locked',
      found ? t(discovery.title) : t('records.assets.locked'),
    );
    // A licao curta continua sendo o resumo de campo; o link leva a narrativa
    // completa, que vive nos documentos corporativos. Descoberta bloqueada nao
    // ganha link nem revela codigo — a regra e a mesma dos Ativos.
    if (found) {
      const docs = viewDocsLink(
        codex,
        { kind: 'discovery', bit: discovery.bit },
        codex?.profile?.loreIndex?.discoveries?.[String(discovery.bit)],
        t(discovery.title),
        `viewdocs:discovery:${discovery.bit}`,
      );
      if (docs) headline.appendChild(docs);
    }
    fragment.appendChild(headline);
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

const renderHistoryTab = (
  host: HTMLElement,
  records: Records,
  options?: RecordsPanelOptions,
): void => {
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
    // O botao so aparece com log guardado E com quem saiba abri-lo — as duas
    // coisas, pela mesma razao do livro do ranking: um botao que nao leva a
    // lugar nenhum e pior que nenhum botao. Aqui a diferenca e que a maioria
    // destas linhas e MORTE, e morte nao sobe para o servidor: o que torna
    // estas revisiveis e o log neste aparelho, e nada mais.
    if (options?.onWatchReplay && options.replayable?.has(runSummaryIdentity(run))) {
      const btn = el('button', 'ax-replay-btn', '▶') as HTMLButtonElement;
      btn.type = 'button';
      btn.title = t('records.replay');
      btn.setAttribute('aria-label', t('records.replay'));
      btn.addEventListener('click', () => options.onWatchReplay?.(run));
      row.appendChild(btn);
    }
    host.appendChild(row);
  }
};

const TAB_RENDER: Record<
  RecordsTab,
  (
    host: HTMLElement,
    records: Records,
    sprites?: SpriteBank,
    codex?: RecordsCodexLink,
    options?: RecordsPanelOptions,
  ) => void
> = {
  summary: renderSummaryTab,
  assets: renderAssetsTab,
  discoveries: renderDiscoveriesTab,
  // A aba do historico e a unica que le `options`; as outras ignoram o
  // parametro, e a assinatura comum e o que mantem o despacho por tabela.
  history: (host, records, _sprites, _codex, options) => renderHistoryTab(host, records, options),
};

export const renderRecordsPanel = (
  host: HTMLElement,
  records: Records,
  sprites?: SpriteBank,
  codex?: RecordsCodexLink,
  options?: RecordsPanelOptions,
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
      renderRecordsPanel(host, records, sprites, codex, options);
    });
    tabs.appendChild(button);
  }
  host.appendChild(tabs);

  const body = el('div', 'panel');
  body.style.width = 'auto';
  body.style.maxHeight = 'none';
  body.style.border = 'none';
  TAB_RENDER[activeTab](body, records, sprites, codex, options);
  host.appendChild(body);

  if (focusKey) {
    host.querySelector<HTMLElement>(`[data-ax-focus="${CSS.escape(focusKey)}"]`)?.focus();
  }
};
