// @vitest-environment happy-dom
//
// Os UNICOS testes de DOM do pacote, e por um motivo estreito: os paineis de
// arquivo redesenham o proprio DOM inteiro a cada mudanca de estado, e a
// promessa de acessibilidade — o foco sobrevive ao redesenho, as abas falam
// como abas, o no fala o que e — nao e observavel em funcao pura nenhuma.
// Tudo o mais continua em ambiente node: o custo do happy-dom se paga aqui e
// so aqui.

import { beforeEach, describe, expect, it } from 'vitest';
import { findUpgrade } from '@voxelyn/survival-sim';
import type { PublicProgressionProfile } from '@voxelyn/survival-protocol';
import { renderRecordsPanel } from './records-panel';
import { renderMatrixPanel, type MatrixHandlers, type MatrixViewState } from './matrix-panel';
import { emptyRecords } from './records';
import { t } from './i18n';

const profile = (
  ore: number,
  cores: number,
  purchased: string[] = [],
): PublicProgressionProfile => ({
  profileId: 'p1',
  profileVersion: 1,
  wallet: { ore, cores },
  purchasedUpgradeIds: purchased,
  generation: 'G-00',
  unlockedLoreFragmentIds: [],
  statistics: {
    oreHomologated: 0,
    oreLost: 0,
    coresRecovered: 0,
    successfulReturns: 0,
    failedExpeditions: 0,
    upgradesPurchased: 0,
  },
});

const matrixView = (over: Partial<MatrixViewState> = {}): MatrixViewState => ({
  tab: 'matrix',
  profile: profile(99999, 99),
  cached: false,
  stale: null,
  loading: false,
  codex: null,
  pending: null,
  notice: null,
  codexNotice: null,
  reveal: null,
  ...over,
});

const handlers: MatrixHandlers = {
  onTab: () => {},
  onPurchase: () => {},
  onDismissReveal: () => {},
};

const click = (element: Element | null): void => {
  expect(element).not.toBeNull();
  (element as HTMLElement).dispatchEvent(new MouseEvent('click', { bubbles: true }));
};

let host: HTMLElement;
beforeEach(() => {
  document.body.textContent = '';
  host = document.createElement('div');
  document.body.appendChild(host);
});

describe('painel de registro: abas de verdade', () => {
  it('a barra fala como tablist e a aba ativa se anuncia', () => {
    renderRecordsPanel(host, emptyRecords());
    const bar = host.querySelector('[role="tablist"]');
    expect(bar).not.toBeNull();
    const tabs = host.querySelectorAll('[role="tab"]');
    expect(tabs.length).toBe(4);
    const selected = Array.from(tabs).filter((tab) => tab.getAttribute('aria-selected') === 'true');
    expect(selected.length).toBe(1);
  });

  it('trocar de aba troca o conteudo e move o aria-selected', () => {
    renderRecordsPanel(host, emptyRecords());
    click(host.querySelector('[data-ax-focus="tab:assets"]'));
    // O registro de ativos abre com a secao propria...
    expect(host.textContent).toContain(t('records.assets'));
    // ...e a aba anterior deixa de se anunciar como ativa.
    expect(host.querySelector('[data-ax-focus="tab:assets"]')?.getAttribute('aria-selected')).toBe(
      'true',
    );
    expect(host.querySelector('[data-ax-focus="tab:summary"]')?.getAttribute('aria-selected')).toBe(
      'false',
    );
  });

  it('o foco sobrevive ao redesenho da troca de aba', () => {
    renderRecordsPanel(host, emptyRecords());
    const historyTab = host.querySelector<HTMLElement>('[data-ax-focus="tab:history"]');
    historyTab?.focus();
    click(historyTab);
    // O clique redesenhou o painel inteiro; sem a restauracao, o foco cairia
    // no documento e o proximo Tab recomecaria do zero.
    expect(document.activeElement?.getAttribute('data-ax-focus')).toBe('tab:history');
  });
});

describe('matriz: selecao, fala e foco', () => {
  it('selecionar um no abre o inspetor com o nome e mantem o foco no no', () => {
    renderMatrixPanel(host, matrixView(), handlers);
    const node = host.querySelector<HTMLElement>('[data-ax-focus="node:CA-01"]');
    node?.focus();
    click(node);
    expect(host.textContent).toContain(t('upgrade.CA-01.name'));
    expect(document.activeElement?.getAttribute('data-ax-focus')).toBe('node:CA-01');
    expect(host.querySelector('[data-ax-focus="node:CA-01"]')?.getAttribute('aria-pressed')).toBe(
      'true',
    );
  });

  it('o no fala ramo, codigo, nome e estado — nunca so "01 ●"', () => {
    renderMatrixPanel(host, matrixView(), handlers);
    const ca02 = findUpgrade('CA-02');
    expect(ca02).toBeTruthy();
    const label = host.querySelector('[data-ax-focus="node:CA-02"]')?.getAttribute('aria-label');
    expect(label).toContain('CA-02');
    expect(label).toContain(t('matrix.branch.chassis'));
    expect(label).toContain(t(`upgrade.CA-02.name`));
  });

  it('quando o botao focado some, o foco recua para o no selecionado', () => {
    // MV-01 esta compravel: seleciona (o clique redesenha) e foca o botao de
    // autorizacao dentro do inspetor.
    renderMatrixPanel(host, matrixView(), handlers);
    click(host.querySelector('[data-ax-focus="node:MV-01"]'));
    const authorize = host.querySelector<HTMLElement>('[data-ax-focus="authorize"]');
    authorize?.focus();
    expect(document.activeElement?.getAttribute('data-ax-focus')).toBe('authorize');
    // A compra confirma: o servidor devolve o perfil com MV-01 instalado e o
    // painel redesenha. O botao de autorizar nao existe mais — o foco nao pode
    // cair no vazio do documento.
    renderMatrixPanel(host, matrixView({ profile: profile(99999, 99, ['MV-01']) }), handlers);
    expect(document.activeElement?.getAttribute('data-ax-focus')).toBe('node:MV-01');
  });

  it('as abas da matriz tambem se anunciam', () => {
    renderMatrixPanel(host, matrixView(), handlers);
    expect(host.querySelector('[role="tablist"]')).not.toBeNull();
    expect(host.querySelector('[data-ax-focus="tab:matrix"]')?.getAttribute('aria-selected')).toBe(
      'true',
    );
    expect(host.querySelector('[data-ax-focus="tab:codex"]')?.getAttribute('aria-selected')).toBe(
      'false',
    );
  });
});
