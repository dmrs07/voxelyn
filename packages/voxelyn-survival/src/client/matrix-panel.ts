// A Matriz Geracional e os Arquivos Aurix.
//
// HTML e nao canvas, pelo mesmo motivo do painel de Registro: isto e texto denso
// e rolavel, e reimplementar quebra de linha, scroll e hit-test de toque no
// canvas seria trabalho gasto no lugar errado.
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

const el = (tag: string, className?: string, text?: string): HTMLElement => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

export type MatrixTab = 'matrix' | 'codex';

export type MatrixViewState = {
  tab: MatrixTab;
  profile: PublicProgressionProfile | null;
  /** O perfil veio do cache e ainda nao foi confirmado pelo servidor? */
  cached: boolean;
  codex: CodexResponse | null;
  /** Compra em voo, para desabilitar o botao sem aplicar nada. */
  pending: string | null;
  /** Erro da ultima operacao, ja traduzido em chave. */
  notice: MessageKey | null;
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
  if (!profile) return { kind: 'missing', ore: upgrade.oreCost, cores: upgrade.coreCost };
  const owned = new Set(profile.purchasedUpgradeIds);
  if (owned.has(upgrade.id)) return { kind: 'installed' };
  if (upgrade.prerequisite && !owned.has(upgrade.prerequisite)) {
    return { kind: 'locked', prerequisite: upgrade.prerequisite };
  }
  const missingOre = Math.max(0, upgrade.oreCost - profile.wallet.ore);
  const missingCores = Math.max(0, upgrade.coreCost - profile.wallet.cores);
  if (missingOre > 0 || missingCores > 0) {
    return { kind: 'missing', ore: missingOre, cores: missingCores };
  }
  return { kind: 'affordable' };
};

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

const renderNode = (
  upgrade: UpgradeDefinition,
  view: MatrixViewState,
  handlers: MatrixHandlers,
): HTMLElement => {
  const state = nodeState(upgrade, view.profile);
  const node = el('div', `matrix-node matrix-node-${state.kind}`);

  const head = el('div', 'matrix-node-head');
  head.appendChild(el('span', 'matrix-node-id', `${upgrade.id} · T${upgrade.tier}`));
  node.appendChild(head);
  node.appendChild(el('div', 'matrix-node-name', t(`upgrade.${upgrade.id}.name` as MessageKey)));
  node.appendChild(el('div', 'matrix-node-desc', t(`upgrade.${upgrade.id}.desc` as MessageKey)));

  const side = el('div', 'matrix-node-side');
  if (state.kind === 'installed') {
    side.appendChild(el('span', 'matrix-node-installed', t('matrix.node.installed')));
  } else {
    side.appendChild(
      el('span', 'matrix-node-cost', `${upgrade.oreCost} ⬡ · ${upgrade.coreCost} ◉`),
    );
    const status = statusText(state);
    if (status) side.appendChild(el('span', 'matrix-node-status', status));
  }
  node.appendChild(side);

  if (state.kind === 'affordable') {
    const button = el('button', 'compact primary') as HTMLButtonElement;
    button.textContent = view.pending === upgrade.id ? t('matrix.buying') : t('matrix.confirm.yes');
    // Desabilitado enquanto a requisicao corre. Nao e otimismo: o estado da
    // arvore so muda quando a resposta do servidor chega.
    button.disabled = view.pending !== null || view.cached;
    button.addEventListener('click', () => handlers.onPurchase(upgrade));
    node.appendChild(button);
  }
  return node;
};

const renderMatrixTab = (view: MatrixViewState, handlers: MatrixHandlers): HTMLElement => {
  const body = el('div', 'matrix-body');
  if (view.cached) body.appendChild(el('p', 'sub warn', t('matrix.offline')));
  if (view.notice) body.appendChild(el('p', 'sub warn', t(view.notice)));

  for (const branch of UPGRADE_BRANCHES) {
    const section = el('section', 'matrix-branch');
    section.appendChild(el('h2', undefined, t(BRANCH_LABEL[branch].title)));
    section.appendChild(el('div', 'sub', t(BRANCH_LABEL[branch].note)));
    for (const upgrade of upgradesOfBranch(branch)) {
      section.appendChild(renderNode(upgrade, view, handlers));
    }
    body.appendChild(section);
  }
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
    body.appendChild(el('p', 'sub', t('matrix.loading')));
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
  root.textContent = '';

  root.appendChild(renderHeader(view));

  const tabs = el('div', 'row matrix-tabs');
  for (const tab of ['matrix', 'codex'] as const) {
    const button = el(
      'button',
      `compact${view.tab === tab ? ' primary' : ''}`,
      t(`matrix.tab.${tab}` as MessageKey),
    ) as HTMLButtonElement;
    button.addEventListener('click', () => handlers.onTab(tab));
    tabs.appendChild(button);
  }
  root.appendChild(tabs);

  if (view.reveal) {
    root.appendChild(renderReveal(view.reveal, handlers));
    return;
  }
  root.appendChild(view.tab === 'matrix' ? renderMatrixTab(view, handlers) : renderCodexTab(view));
};

/** Quantos protocolos existem, para o teste de contagem do painel. */
export const PANEL_TOTAL_UPGRADES = UPGRADES.length;
