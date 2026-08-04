// A Matriz Geracional e os Arquivos Aurix.
//
// HTML e nao canvas, pelo mesmo motivo do painel de Registro: isto e texto denso
// e rolavel, e reimplementar quebra de linha, scroll e hit-test de toque no
// canvas seria trabalho gasto no lugar errado.
//
// O redesign (doc AD-UI-2.0) trocou a pilha de cartoes por um CONSOLE: quatro
// trilhos horizontais, um por ramo, com nos que carregam so a sigla e o simbolo
// de estado. Toda a prosa — nome, descricao, custo, o que falta — vive no
// inspetor, que so existe quando ha um no selecionado. A conexao entre nos
// acende quando o pre-requisito esta instalado: o caminho ja pago e visivel de
// relance, sem ler texto.
//
// ---------------------------------------------------------------------------
// A REGRA QUE ESTE ARQUIVO NAO PODE QUEBRAR
// ---------------------------------------------------------------------------
// Nada aqui decide nada. O painel desenha o perfil que o SERVIDOR mandou, e a
// compra e uma INTENCAO enviada — nunca aplicada localmente e depois
// "confirmada". A diferenca aparece no unico caso que importa: com uma compra
// otimista, um 409 obrigaria a desfazer a arvore na tela, e por um instante o
// jogador teria visto um protocolo que ele nao comprou.
//
// O botao desabilita enquanto a requisicao corre. Isso e feedback, e nao
// otimismo: o estado so muda quando a resposta chega.

import {
  TOTAL_UPGRADES,
  UPGRADES,
  UPGRADE_BRANCHES,
  upgradesOfBranch,
  type UpgradeBranch,
  type UpgradeDefinition,
} from '@voxelyn/survival-sim';
import type {
  CodexResponse,
  PublicLoreFragment,
  PublicProgressionProfile,
} from '@voxelyn/survival-protocol';
import { t, type MessageKey } from './i18n';
import { protocolIconSvg } from './matrix-icons';

const el = (tag: string, className?: string, text?: string): HTMLElement => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

export type MatrixTab = 'matrix' | 'codex';

/** Um aviso do painel: a chave e, quando houver, o que ela interpola. */
export type PanelNotice = { key: MessageKey; params?: Record<string, string | number> };

export type MatrixViewState = {
  tab: MatrixTab;
  profile: PublicProgressionProfile | null;
  /** O perfil veio do cache e ainda nao foi confirmado pelo servidor? */
  cached: boolean;
  /**
   * POR QUE o perfil e so cache — ja no formato em que aparece na tela.
   *
   * Sao TRES falhas com acoes diferentes, e o painel dizia a mesma frase para as
   * tres: nao alcancamos ninguem (espere a rede), a Aurix respondeu e recusou
   * (olhe o servidor, e o codigo diz onde), e o endereco esta invalido (nenhuma
   * consulta chegou a sair; conserte o campo). Descobrir qual era exigia abrir o
   * DevTools — era o unico jeito, e nao deveria ser.
   *
   * `null` com `cached` significa que ainda nao houve tentativa nesta sessao.
   */
  stale: PanelNotice | null;
  /**
   * A primeira consulta ao servidor ainda esta correndo?
   *
   * Separado de `cached` porque os dois significam coisas diferentes para o
   * jogador: "estamos perguntando" e "a pergunta falhou". Sem isso o painel
   * anunciava a Aurix como indisponivel no primeiro quadro de TODA abertura,
   * incluindo as que davam certo meio segundo depois.
   */
  loading: boolean;
  codex: CodexResponse | null;
  /** Compra em voo, para desabilitar o botao sem aplicar nada. */
  pending: string | null;
  /**
   * Erro da ultima OPERACAO (uma compra), ja traduzido.
   *
   * Carrega parametros pelo mesmo motivo de `stale`: aqui tambem toda falha
   * que nao fosse conflito de versao saia como "conexao indisponivel", entao
   * saldo insuficiente, teto de requisicoes e protocolo desconhecido eram a
   * mesma frase — e nenhuma delas tinha a ver com conexao.
   */
  notice: PanelNotice | null;
  /**
   * A falha da ULTIMA consulta aos Arquivos, quando houve uma.
   *
   * A aba dos Arquivos mostrava `matrix.loading` sempre que `codex` fosse nulo,
   * e nulo era tanto "ainda vem" quanto "nao veio". Uma consulta que falhava
   * deixava a aba em "Consultando a Aurix Dynamics…" para sempre — a mesma
   * confusao entre pergunta e resposta que este arquivo ja corrigiu duas vezes,
   * aqui pela terceira.
   */
  codexNotice: PanelNotice | null;
  /** O documento a revelar depois de uma compra. */
  reveal: PublicLoreFragment | null;
};

export type MatrixHandlers = {
  onTab: (tab: MatrixTab) => void;
  onPurchase: (upgrade: UpgradeDefinition) => void;
  onDismissReveal: () => void;
};

const BRANCH_LABEL: Record<UpgradeBranch, { title: MessageKey; note: MessageKey }> = {
  chassis: { title: 'matrix.branch.chassis', note: 'matrix.branch.chassis.note' },
  mobility: { title: 'matrix.branch.mobility', note: 'matrix.branch.mobility.note' },
  reactor: { title: 'matrix.branch.reactor', note: 'matrix.branch.reactor.note' },
  survey: { title: 'matrix.branch.survey', note: 'matrix.branch.survey.note' },
};

/**
 * Em que estado este no esta, para ESTE perfil.
 *
 * Uma funcao pura, separada do desenho, porque e a unica logica do painel que
 * vale testar — e porque a ordem dos casos e uma decisao de produto: "exige
 * CA-01" tem de aparecer ANTES de "faltam 35 ⬡", senao o jogador vai minerar
 * por um no que ele nao pode comprar de qualquer jeito.
 */
export type NodeState =
  | { kind: 'installed' }
  | { kind: 'locked'; prerequisite: string }
  | { kind: 'affordable' }
  | { kind: 'missing'; ore: number; cores: number };

export const nodeState = (
  upgrade: UpgradeDefinition,
  profile: PublicProgressionProfile | null,
): NodeState => {
  const owned = new Set(profile?.purchasedUpgradeIds ?? []);
  if (owned.has(upgrade.id)) return { kind: 'installed' };
  // Sem perfil ninguem possui nada, entao o bloqueio por pre-requisito vale
  // tambem offline. Antes o perfil nulo caia direto em "missing", o que era
  // inofensivo quando o estado so escolhia uma frase — mas agora ele escolhe o
  // que o jogador VE, e um cabo desligado nao pode revelar a arvore inteira.
  if (upgrade.prerequisite && !owned.has(upgrade.prerequisite)) {
    return { kind: 'locked', prerequisite: upgrade.prerequisite };
  }
  if (!profile) return { kind: 'missing', ore: upgrade.oreCost, cores: upgrade.coreCost };
  const missingOre = Math.max(0, upgrade.oreCost - profile.wallet.ore);
  const missingCores = Math.max(0, upgrade.coreCost - profile.wallet.cores);
  if (missingOre > 0 || missingCores > 0) {
    return { kind: 'missing', ore: missingOre, cores: missingCores };
  }
  return { kind: 'affordable' };
};

/**
 * Este no tem as caracteristicas ABERTAS para este perfil?
 *
 * A regra de produto: so e especificado o que ja foi comprado e o que ja pode
 * ser comprado — pre-requisito instalado, mesmo sem lastro para pagar. Um no
 * atras de pre-requisito ausente mostra posicao, tier e o que ele exige, e
 * NADA do que faz: nem nome, nem descricao, nem icone, nem custo.
 *
 * Dois motivos, um de jogo e um de ficcao. De jogo: com a arvore inteira
 * legivel, o jogador mira um capstone, upa a trilha dele de uma vez e ignora
 * o resto; selado, cada compra revela apenas o proximo passo, e a escolha
 * volta a ser sobre o que esta na mesa. De ficcao: e progresso cientifico —
 * a Aurix nao especifica o que ainda nao alcancou.
 */
export const nodeRevealed = (state: NodeState): boolean => state.kind !== 'locked';

/**
 * O que o painel ANUNCIA no topo, se e que anuncia algo.
 *
 * Pura e exportada pelo mesmo motivo de `nodeState`: e uma decisao de produto
 * disfarcada de detalhe de render. "Estamos perguntando" e "a pergunta falhou"
 * sao estados diferentes, e trata-los como um so fazia o painel acusar a Aurix
 * de estar fora no primeiro quadro de toda abertura — inclusive as que davam
 * certo meio segundo depois.
 *
 * A mesma confusao acontecia um nivel abaixo, e custou mais caro: "nao
 * alcancamos a Aurix", "a Aurix recusou" e "o endereco esta invalido" sairiam
 * com a MESMA frase, entao um servidor no ar respondendo 429 era
 * indistinguivel de um cabo desligado — e de um campo digitado errado. O codigo
 * vai no texto porque e ele que diz para onde olhar.
 */
export const panelNotice = (view: MatrixViewState): PanelNotice | null => {
  if (view.loading) return { key: 'matrix.loading' };
  if (!view.cached) return null;
  // Sem tentativa registrada, o generico de conexao e o unico que nao inventa
  // diagnostico: e o estado de quem abriu o painel antes da primeira resposta.
  return view.stale ?? { key: 'matrix.offline' };
};

/**
 * Da para comprar agora?
 *
 * Falso enquanto carrega, enquanto o perfil e so cache, e enquanto qualquer
 * compra esta em voo. As tres sao a mesma regra vista de angulos diferentes: so
 * se compra contra um saldo que o SERVIDOR confirmou e que ninguem mais esta
 * gastando neste instante.
 */
export const purchaseEnabled = (view: MatrixViewState): boolean =>
  !view.loading && !view.cached && view.pending === null;

/** Tiers caros pedem confirmacao: 130 minerio e dois nucleos sao horas de jogo. */
export const needsConfirmation = (upgrade: UpgradeDefinition): boolean => upgrade.tier >= 4;

const statusText = (state: NodeState): string => {
  switch (state.kind) {
    case 'installed':
      return t('matrix.node.installed');
    case 'locked':
      return t('matrix.node.locked', { id: state.prerequisite });
    case 'affordable':
      return '';
    case 'missing':
      if (state.ore > 0 && state.cores > 0) {
        return t('matrix.node.missing', { ore: state.ore, cores: state.cores });
      }
      return state.ore > 0
        ? t('matrix.node.missingOre', { ore: state.ore })
        : t('matrix.node.missingCores', { cores: state.cores });
  }
};

const walletCard = (label: MessageKey, value: string, note: MessageKey): HTMLElement => {
  const card = el('div', 'matrix-card');
  card.appendChild(el('div', 'matrix-card-label', t(label)));
  card.appendChild(el('div', 'matrix-card-value', value));
  card.appendChild(el('div', 'matrix-card-note', t(note)));
  return card;
};

const renderHeader = (view: MatrixViewState): HTMLElement => {
  const header = el('div', 'matrix-header');
  const profile = view.profile;
  header.appendChild(
    walletCard('matrix.wallet.ore', String(profile?.wallet.ore ?? 0), 'matrix.wallet.ore.note'),
  );
  header.appendChild(
    walletCard(
      'matrix.wallet.cores',
      String(profile?.wallet.cores ?? 0),
      'matrix.wallet.cores.note',
    ),
  );
  header.appendChild(
    walletCard('matrix.generation', profile?.generation ?? 'G-00', 'matrix.generation.note'),
  );
  const protocols = el('div', 'matrix-card');
  protocols.appendChild(el('div', 'matrix-card-label', t('matrix.protocols')));
  protocols.appendChild(
    el('div', 'matrix-card-value', String(profile?.purchasedUpgradeIds.length ?? 0)),
  );
  protocols.appendChild(
    el('div', 'matrix-card-note', t('matrix.protocols.note', { total: TOTAL_UPGRADES })),
  );
  header.appendChild(protocols);
  return header;
};

/**
 * O no selecionado vive no MODULO, como a aba do Registro: o painel inteiro e
 * redesenhado a cada mudanca de estado (compra, resposta do servidor, troca de
 * idioma), e um estado local a chamada esqueceria a selecao no meio da compra.
 */
let selectedId: string | null = null;

/** Sigla curta do no no trilho: "CA-01" vira "01", "CA-X" vira "X". */
const nodeShortLabel = (upgrade: UpgradeDefinition): string => {
  const dash = upgrade.id.lastIndexOf('-');
  return dash >= 0 ? upgrade.id.slice(dash + 1) : upgrade.id;
};

/**
 * O rotulo do no para leitores de tela.
 *
 * "01 ●" comunica tudo a quem VE o trilho inteiro e nada a quem ouve um botao
 * por vez: ramo, codigo, nome e situacao precisam estar na propria fala do
 * botao. Pura e exportada para o teste cobrar exatamente isso.
 */
export const nodeAriaLabel = (upgrade: UpgradeDefinition, state: NodeState): string => {
  const branch = t(BRANCH_LABEL[upgrade.branch].title);
  // O selo vale para todo canal: um no nao especificado no olho tambem e nao
  // especificado no ouvido, senao o leitor de tela viraria o furo da regra.
  const name = nodeRevealed(state)
    ? t(`upgrade.${upgrade.id}.name` as MessageKey)
    : t('matrix.node.sealed');
  const status = state.kind === 'affordable' ? t('matrix.confirm.yes') : statusText(state);
  return `${branch} · ${upgrade.id} · ${name}${status ? ` — ${status}` : ''}`;
};

/** O simbolo de estado do no. Nunca cor sozinha: simbolo + moldura + fundo. */
const nodeGlyph = (state: NodeState, pending: boolean): string => {
  if (pending) return '…';
  switch (state.kind) {
    case 'installed':
      return '●';
    case 'affordable':
      return '+';
    case 'missing':
      return '⬡';
    case 'locked':
      return '✕';
  }
};

const nodeStateClass = (state: NodeState): string => {
  switch (state.kind) {
    case 'installed':
      return ' is-installed';
    case 'affordable':
      return ' is-affordable';
    case 'locked':
      return ' is-locked';
    case 'missing':
      return '';
  }
};

const renderBranchRail = (
  branch: UpgradeBranch,
  view: MatrixViewState,
  redraw: () => void,
): HTMLElement => {
  const rail = el('div', 'ax-branch');
  const label = el('div', 'ax-branch-label');
  label.appendChild(el('div', 'ax-branch-name', t(BRANCH_LABEL[branch].title)));
  label.appendChild(el('div', 'ax-branch-note', t(BRANCH_LABEL[branch].note)));
  rail.appendChild(label);

  const owned = new Set(view.profile?.purchasedUpgradeIds ?? []);
  const upgrades = upgradesOfBranch(branch);
  upgrades.forEach((upgrade, index) => {
    if (index > 0) {
      // A conexao acende quando o pre-requisito ja esta instalado: o caminho
      // pago e legivel sem abrir nenhum inspetor.
      const link = el('span', `ax-node-link${owned.has(upgrades[index - 1].id) ? ' is-live' : ''}`);
      rail.appendChild(link);
    }
    const state = nodeState(upgrade, view.profile);
    const node = el(
      'button',
      `ax-node${nodeStateClass(state)}${selectedId === upgrade.id ? ' is-selected' : ''}${
        view.pending === upgrade.id ? ' is-pending' : ''
      }`,
    ) as HTMLButtonElement;
    // O protocolo fala por icone (Phosphor, ver matrix-icons.ts); a sigla e o
    // fallback de um id que ainda nao tem desenho. innerHTML e seguro aqui:
    // o SVG e constante nossa, nunca dado de fora. Um no selado nao ganha
    // icone: o desenho DIZ o que o protocolo faz, e e exatamente isso que a
    // regra de visibilidade esconde — sobra a sigla, que so diz a posicao.
    const icon = nodeRevealed(state) ? protocolIconSvg(upgrade.id) : null;
    if (icon) {
      const holder = el('span', 'ax-node-icon');
      holder.innerHTML = icon;
      node.appendChild(holder);
    } else {
      node.appendChild(el('span', undefined, nodeShortLabel(upgrade)));
    }
    node.appendChild(el('span', 'ax-node-glyph', nodeGlyph(state, view.pending === upgrade.id)));
    node.title = upgrade.id;
    node.dataset.axFocus = `node:${upgrade.id}`;
    node.setAttribute('aria-label', nodeAriaLabel(upgrade, state));
    node.setAttribute('aria-pressed', selectedId === upgrade.id ? 'true' : 'false');
    // O no trancado continua CLICAVEL: o inspetor e onde o jogador descobre o
    // pre-requisito. Bloquear o clique esconderia justamente a explicacao.
    node.addEventListener('click', () => {
      selectedId = selectedId === upgrade.id ? null : upgrade.id;
      redraw();
    });
    rail.appendChild(node);
  });
  return rail;
};

const renderInspector = (view: MatrixViewState, handlers: MatrixHandlers): HTMLElement => {
  const inspector = el('div', 'ax-inspector');
  inspector.appendChild(el('div', 'ax-section-label', t('matrix.inspector.title')));
  const upgrade = UPGRADES.find((entry) => entry.id === selectedId);
  if (!upgrade) {
    inspector.appendChild(el('div', 'sub', t('matrix.inspector.hint')));
    return inspector;
  }
  const state = nodeState(upgrade, view.profile);
  // O inspetor e onde o selo mais importa: e o unico lugar do painel com prosa.
  // Um no nao revelado mantem posicao, tier e o pre-requisito — a explicacao de
  // por que ele esta fechado —, e perde nome, descricao, icone e custo.
  const revealed = nodeRevealed(state);

  const head = el('div', 'ax-inspector-head');
  const headIcon = revealed ? protocolIconSvg(upgrade.id) : null;
  if (headIcon) {
    const holder = el('span', 'ax-inspector-icon');
    holder.innerHTML = headIcon;
    head.appendChild(holder);
  }
  const headText = el('div');
  headText.appendChild(el('div', 'codex-code', `${upgrade.id} · T${upgrade.tier}`));
  headText.appendChild(
    el(
      'div',
      'ax-inspector-name',
      revealed ? t(`upgrade.${upgrade.id}.name` as MessageKey) : t('matrix.node.sealed'),
    ),
  );
  head.appendChild(headText);
  inspector.appendChild(head);
  inspector.appendChild(
    el(
      'div',
      'ax-inspector-desc',
      revealed ? t(`upgrade.${upgrade.id}.desc` as MessageKey) : t('matrix.inspector.sealed'),
    ),
  );

  const fieldRow = (label: string, value: string, valueClass?: string): HTMLElement => {
    const row = el('div', 'ax-field');
    row.appendChild(el('span', 'ax-field-label', label));
    row.appendChild(el('span', 'ax-field-dots'));
    const cell = el('span', undefined, value);
    if (valueClass) cell.className = valueClass;
    row.appendChild(cell);
    return row;
  };

  if (upgrade.prerequisite) {
    const met = view.profile?.purchasedUpgradeIds.includes(upgrade.prerequisite) ?? false;
    inspector.appendChild(
      fieldRow(
        t('matrix.inspector.requires'),
        `${upgrade.prerequisite}${met ? ' ✓' : ''}`,
        met ? 'matrix-card-value' : undefined,
      ),
    );
  }
  // O custo tambem e caracteristica: escondido, ninguem poupa 200 ⬡ mirando um
  // capstone que nem sabe o que faz. So a fronteira mostra preco.
  if (revealed) {
    inspector.appendChild(
      fieldRow(t('matrix.inspector.cost'), `${upgrade.oreCost} ⬡ · ${upgrade.coreCost} ◉`),
    );
  }
  if (view.profile && state.kind === 'affordable') {
    inspector.appendChild(
      fieldRow(
        t('matrix.inspector.balanceAfter'),
        `${view.profile.wallet.ore - upgrade.oreCost} ⬡ · ${
          view.profile.wallet.cores - upgrade.coreCost
        } ◉`,
      ),
    );
  }

  if (state.kind === 'affordable') {
    const pending = view.pending === upgrade.id;
    const button = el('button', pending ? 'primary is-pending' : 'primary') as HTMLButtonElement;
    button.textContent = pending ? t('matrix.buying') : t('matrix.confirm.yes');
    // Desabilitado enquanto a requisicao corre. Nao e otimismo: o estado da
    // arvore so muda quando a resposta do servidor chega.
    button.disabled = !purchaseEnabled(view);
    button.dataset.axFocus = 'authorize';
    button.addEventListener('click', () => handlers.onPurchase(upgrade));
    inspector.appendChild(button);
  } else {
    const status = statusText(state);
    if (status) {
      // O que falta e escrito no proprio lugar do botao — ouro, nao vermelho:
      // nao houve perda, so falta lastro (ou falta o pre-requisito nomeado).
      const plate = el('button', undefined, status) as HTMLButtonElement;
      plate.disabled = true;
      if (state.kind === 'installed') {
        plate.className = 'primary';
        plate.disabled = true;
      }
      inspector.appendChild(plate);
    }
  }
  return inspector;
};

const renderMatrixTab = (
  view: MatrixViewState,
  handlers: MatrixHandlers,
  redraw: () => void,
): HTMLElement => {
  const body = el('div', 'matrix-body');
  const notice = panelNotice(view);
  if (notice) {
    // Carregando ganha a varredura CRT (board 3p: o unico lugar dela); falha
    // continua texto parado em tom de aviso — espera e erro nao vestem igual.
    body.appendChild(
      notice.key === 'matrix.loading'
        ? el('div', 'ax-scan ax-loading', t(notice.key, notice.params))
        : el('p', 'sub warn', t(notice.key, notice.params)),
    );
  }
  if (view.notice) body.appendChild(el('p', 'sub warn', t(view.notice.key, view.notice.params)));

  for (const branch of UPGRADE_BRANCHES) {
    body.appendChild(renderBranchRail(branch, view, redraw));
  }
  body.appendChild(el('div', 'ax-legend', t('matrix.legend')));
  body.appendChild(renderInspector(view, handlers));
  body.appendChild(el('p', 'sub matrix-policy', t('matrix.policy')));
  return body;
};

const renderFragment = (fragment: PublicLoreFragment): HTMLElement => {
  const card = el('article', 'codex-doc');
  card.appendChild(el('div', 'codex-code', fragment.documentCode));
  card.appendChild(el('h3', undefined, fragment.title));
  card.appendChild(el('div', 'sub', fragment.summary));
  // Paragrafo por paragrafo, e nao innerHTML: o corpo vem do servidor e nao ha
  // razao nenhuma para dar a ele a chance de virar markup.
  for (const paragraph of fragment.body.split('\n\n')) {
    if (paragraph.trim()) card.appendChild(el('p', 'codex-body', paragraph));
  }
  card.appendChild(el('div', 'codex-source', `${t('codex.source')}: ${fragment.source}`));
  if (fragment.relatedFragmentIds.length > 0) {
    card.appendChild(
      el(
        'div',
        'codex-related',
        `${t('codex.related')}: ${fragment.relatedFragmentIds.join(', ')}`,
      ),
    );
  }
  return card;
};

const renderCodexTab = (view: MatrixViewState): HTMLElement => {
  const body = el('div', 'matrix-body');
  const codex = view.codex;
  if (!codex) {
    const pending = view.codexNotice ?? { key: 'matrix.loading' as const };
    body.appendChild(
      pending.key === 'matrix.loading'
        ? el('div', 'ax-scan ax-loading', t(pending.key, pending.params))
        : el('p', 'sub warn', t(pending.key, pending.params)),
    );
    return body;
  }
  body.appendChild(
    el('div', 'sub', t('codex.count', { unlocked: codex.unlocked.length, total: codex.total })),
  );
  for (const fragment of codex.unlocked) body.appendChild(renderFragment(fragment));
  if (codex.unlocked.length <= 1) body.appendChild(el('p', 'sub', t('codex.empty')));

  for (const locked of codex.locked) {
    const card = el('article', 'codex-doc codex-locked');
    card.appendChild(el('div', 'codex-code', locked.maskedCode));
    card.appendChild(el('div', 'sub', t('codex.locked')));
    card.appendChild(el('div', 'sub', t('codex.clearance', { level: locked.clearanceLevel })));
    body.appendChild(card);
  }
  return body;
};

/** A revelacao pos-compra. Curta, e sempre dispensavel: ninguem e obrigado a ler. */
const renderReveal = (fragment: PublicLoreFragment, handlers: MatrixHandlers): HTMLElement => {
  const panel = el('div', 'codex-reveal');
  panel.appendChild(el('div', 'codex-reveal-title', t('matrix.declassified')));
  panel.appendChild(renderFragment(fragment));
  const close = el('button', 'compact primary', t('options.back')) as HTMLButtonElement;
  close.addEventListener('click', () => handlers.onDismissReveal());
  panel.appendChild(close);
  return panel;
};

export const renderMatrixPanel = (
  root: HTMLElement,
  view: MatrixViewState,
  handlers: MatrixHandlers,
): void => {
  // Redesenhar limpa o DOM inteiro, e com ele o elemento focado — o foco caia
  // no documento a cada selecao de no ou troca de aba, o que quebra teclado e
  // leitor de tela no meio do fluxo de compra. A identidade do foco viaja por
  // `data-ax-focus` e e restaurada sobre o elemento equivalente novo.
  const active = document.activeElement;
  const focusKey =
    active instanceof HTMLElement && root.contains(active)
      ? (active.dataset.axFocus ?? null)
      : null;

  root.textContent = '';

  root.appendChild(renderHeader(view));

  const tabs = el('div', 'ax-tabs matrix-tabs');
  tabs.setAttribute('role', 'tablist');
  for (const tab of ['matrix', 'codex'] as const) {
    const button = el(
      'button',
      `ax-tab${view.tab === tab ? ' is-active' : ''}`,
      t(`matrix.tab.${tab}` as MessageKey),
    ) as HTMLButtonElement;
    button.setAttribute('role', 'tab');
    button.setAttribute('aria-selected', view.tab === tab ? 'true' : 'false');
    button.dataset.axFocus = `tab:${tab}`;
    button.addEventListener('click', () => handlers.onTab(tab));
    tabs.appendChild(button);
  }
  root.appendChild(tabs);

  if (view.reveal) {
    root.appendChild(renderReveal(view.reveal, handlers));
    return;
  }
  const redraw = (): void => renderMatrixPanel(root, view, handlers);
  root.appendChild(
    view.tab === 'matrix' ? renderMatrixTab(view, handlers, redraw) : renderCodexTab(view),
  );

  if (focusKey) {
    // Se o elemento focado deixou de existir (o botao de compra some quando o
    // no vira "instalado"), o foco recua para o no selecionado — nunca para o
    // vazio do documento.
    const target =
      root.querySelector<HTMLElement>(`[data-ax-focus="${CSS.escape(focusKey)}"]`) ??
      (selectedId
        ? root.querySelector<HTMLElement>(`[data-ax-focus="${CSS.escape(`node:${selectedId}`)}"]`)
        : null);
    target?.focus();
  }
};

/** Quantos protocolos existem, para o teste de contagem do painel. */
export const PANEL_TOTAL_UPGRADES = UPGRADES.length;
