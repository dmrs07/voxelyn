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
  readLoreFragmentIds: [],
  knownAssetArchetypes: [],
  discoveries: 0,
  loreIndex: { assets: {}, discoveries: {} },
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
  codexContext: { kind: 'all' },
  codexReturn: false,
  ...over,
});

const handlers: MatrixHandlers = {
  onTab: () => {},
  onPurchase: () => {},
  onDismissReveal: () => {},
  onCodexContext: () => {},
  onOpenDocument: () => {},
  onReturnToRecords: () => {},
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
    // CA-01 comprado: CA-02 e fronteira, e a fronteira fala o nome real.
    renderMatrixPanel(host, matrixView({ profile: profile(99999, 99, ['CA-01']) }), handlers);
    const ca02 = findUpgrade('CA-02');
    expect(ca02).toBeTruthy();
    const label = host.querySelector('[data-ax-focus="node:CA-02"]')?.getAttribute('aria-label');
    expect(label).toContain('CA-02');
    expect(label).toContain(t('matrix.branch.chassis'));
    expect(label).toContain(t(`upgrade.CA-02.name`));
  });

  it('o no selado nao entrega nome nem descricao, nem no inspetor', () => {
    // Nada comprado: CA-02 esta atras de pre-requisito ausente.
    renderMatrixPanel(host, matrixView(), handlers);
    const label = host.querySelector('[data-ax-focus="node:CA-02"]')?.getAttribute('aria-label');
    expect(label).toContain(t('matrix.node.sealed'));
    expect(label).not.toContain(t('upgrade.CA-02.name'));
    // Abrir o inspetor continua permitido — e la que mora a explicacao do
    // bloqueio — mas o que ele mostra e o selo, nao a especificacao.
    click(host.querySelector('[data-ax-focus="node:CA-02"]'));
    expect(host.textContent).toContain(t('matrix.inspector.sealed'));
    expect(host.textContent).not.toContain(t('upgrade.CA-02.name'));
    expect(host.textContent).not.toContain(t('upgrade.CA-02.desc'));
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

// ---------------------------------------------------------------------------
// Codex narrativo: "Ver docs", bolinhas e estado de leitura
// ---------------------------------------------------------------------------

import type { CodexContext, CodexResponse, PublicLoreFragment } from '@voxelyn/survival-protocol';
import { openCodexDocument } from './matrix-panel';
import { applyRun, emptyRecords as freshRecords } from './records';
import { DISCOVERY_GAS_IGNITION, type RunSummary } from '@voxelyn/survival-sim';

const fragment = (id: string, over: Partial<PublicLoreFragment> = {}): PublicLoreFragment => ({
  id,
  trigger: { kind: 'default' },
  category: 'engineering',
  clearanceLevel: 1,
  documentCode: id,
  chronologyIndex: 0,
  title: `Titulo ${id}`,
  summary: `Resumo ${id}`,
  body: `Corpo ${id}`,
  source: 'Teste',
  relatedFragmentIds: [],
  redactionLevel: 0,
  read: false,
  ...over,
});

const codexOf = (unlocked: PublicLoreFragment[]): CodexResponse => ({
  unlocked,
  locked: [],
  total: unlocked.length,
});

/** Um Registro em que o Espreitador ja foi abatido (fica "conhecido"). */
const recordsWithStalker = () => {
  const summary = {
    seed: 1,
    phase: 'dead',
    ticks: 100,
    contamination: 0,
    deathCause: null,
    stars: 0,
    targetTicks: 1,
    stats: {
      shotsFired: 0,
      kills: { stalker: 1 },
      damageDealtTenths: 0,
      damageTakenTenths: 0,
      timesDowned: 0,
      revivesGiven: 0,
      oreCollected: 0,
      innocentsKilled: 0,
      discoveries: DISCOVERY_GAS_IGNITION,
    },
  } as unknown as RunSummary;
  return applyRun(freshRecords(), summary);
};

const profileWithDocs = (read: string[] = []): ReturnType<typeof profile> => ({
  ...profile(0, 0),
  unlockedLoreFragmentIds: ['AX-PUB-001', 'AX-ENG-012'],
  readLoreFragmentIds: read,
  knownAssetArchetypes: ['stalker'],
  discoveries: DISCOVERY_GAS_IGNITION,
  loreIndex: {
    assets: { stalker: ['AX-ENG-012'] },
    discoveries: { [String(DISCOVERY_GAS_IGNITION)]: ['AX-ENG-012'] },
  },
});

describe('"Ver docs" no Registro de Ativos', () => {
  it('aparece so no Ativo conhecido com documentos, com bolinha de nao lido', () => {
    const contexts: CodexContext[] = [];
    renderRecordsPanel(host, recordsWithStalker(), undefined, {
      profile: profileWithDocs(),
      onViewDocs: (ctx) => contexts.push(ctx),
    });
    click(host.querySelector('[data-ax-focus="tab:assets"]'));
    const link = host.querySelector<HTMLElement>('[data-ax-focus="viewdocs:stalker"]');
    expect(link).not.toBeNull();
    // A bolinha esta la enquanto AX-ENG-012 nao foi lido...
    expect(link?.querySelector('.ax-dot')).not.toBeNull();
    // ...e o rotulo fala para o leitor de tela.
    expect(link?.getAttribute('aria-label')).toContain(t('bestiary.name.stalker'));
    // Nenhum outro Ativo (todos bloqueados) ganha link: existir link revelaria
    // que existe ficha concreta para um inimigo nao identificado.
    expect(host.querySelectorAll('[data-ax-focus^="viewdocs:"]').length).toBe(1);
    click(link);
    expect(contexts).toEqual([{ kind: 'asset', archetype: 'stalker' }]);
  });

  it('a bolinha some depois de lido, e o link permanece', () => {
    renderRecordsPanel(host, recordsWithStalker(), undefined, {
      profile: profileWithDocs(['AX-ENG-012']),
      onViewDocs: () => {},
    });
    click(host.querySelector('[data-ax-focus="tab:assets"]'));
    const link = host.querySelector<HTMLElement>('[data-ax-focus="viewdocs:stalker"]');
    expect(link).not.toBeNull();
    expect(link?.querySelector('.ax-dot')).toBeNull();
  });

  it('sem perfil autoritativo nao ha link nenhum — o Registro segue offline', () => {
    renderRecordsPanel(host, recordsWithStalker(), undefined, {
      profile: null,
      onViewDocs: () => {},
    });
    click(host.querySelector('[data-ax-focus="tab:assets"]'));
    expect(host.querySelector('[data-ax-focus^="viewdocs:"]')).toBeNull();
  });

  it('a Descoberta feita ganha o link com o contexto certo', () => {
    const contexts: CodexContext[] = [];
    renderRecordsPanel(host, recordsWithStalker(), undefined, {
      profile: profileWithDocs(),
      onViewDocs: (ctx) => contexts.push(ctx),
    });
    click(host.querySelector('[data-ax-focus="tab:discoveries"]'));
    const link = host.querySelector<HTMLElement>(
      `[data-ax-focus="viewdocs:discovery:${DISCOVERY_GAS_IGNITION}"]`,
    );
    expect(link).not.toBeNull();
    click(link);
    expect(contexts).toEqual([{ kind: 'discovery', bit: DISCOVERY_GAS_IGNITION }]);
  });
});

describe('aba de Arquivos: abrir, ler, filtrar', () => {
  it('a aba mostra bolinha quando ha documento nao lido, e some depois', () => {
    renderMatrixPanel(host, matrixView({ profile: profileWithDocs() }), handlers);
    expect(host.querySelector('[data-ax-focus="tab:codex"] .ax-dot')).not.toBeNull();
    renderMatrixPanel(
      host,
      matrixView({ profile: profileWithDocs(['AX-PUB-001', 'AX-ENG-012']) }),
      handlers,
    );
    expect(host.querySelector('[data-ax-focus="tab:codex"] .ax-dot')).toBeNull();
  });

  it('abrir um documento mostra o corpo e dispara a marcacao de leitura', () => {
    openCodexDocument(null);
    const opened: string[] = [];
    const doc = fragment('AX-ENG-012');
    renderMatrixPanel(
      host,
      matrixView({ tab: 'codex', profile: profileWithDocs(), codex: codexOf([doc]) }),
      { ...handlers, onOpenDocument: (f) => opened.push(f.id) },
    );
    const header = host.querySelector<HTMLElement>('[data-ax-focus="doc:AX-ENG-012"]');
    expect(header?.getAttribute('aria-expanded')).toBe('false');
    expect(host.textContent).not.toContain('Corpo AX-ENG-012');
    click(header);
    expect(opened).toEqual(['AX-ENG-012']);
    expect(host.textContent).toContain('Corpo AX-ENG-012');
    expect(
      host.querySelector('[data-ax-focus="doc:AX-ENG-012"]')?.getAttribute('aria-expanded'),
    ).toBe('true');
  });

  it('o filtro contextual mostra so os documentos do Ativo e oferece "Todos"', () => {
    openCodexDocument(null);
    const contexts: CodexContext[] = [];
    renderMatrixPanel(
      host,
      matrixView({
        tab: 'codex',
        profile: profileWithDocs(),
        codex: codexOf([fragment('AX-PUB-001'), fragment('AX-ENG-012')]),
        codexContext: { kind: 'asset', archetype: 'stalker' },
        codexReturn: true,
      }),
      { ...handlers, onCodexContext: (ctx) => contexts.push(ctx) },
    );
    expect(host.querySelector('[data-ax-focus="doc:AX-ENG-012"]')).not.toBeNull();
    expect(host.querySelector('[data-ax-focus="doc:AX-PUB-001"]')).toBeNull();
    // O retorno ao Registro existe porque a navegacao veio de la.
    expect(host.querySelector('[data-ax-focus="codex-back"]')).not.toBeNull();
    click(host.querySelector('[data-ax-focus="codex-all"]'));
    expect(contexts).toEqual([{ kind: 'all' }]);
  });

  it('a navegacao contextual abre e foca o documento pedido', () => {
    openCodexDocument('AX-ENG-012');
    renderMatrixPanel(
      host,
      matrixView({
        tab: 'codex',
        profile: profileWithDocs(),
        codex: codexOf([fragment('AX-ENG-012')]),
        codexContext: { kind: 'asset', archetype: 'stalker' },
        codexReturn: true,
      }),
      handlers,
    );
    // Aberto (corpo visivel) e focado.
    expect(host.textContent).toContain('Corpo AX-ENG-012');
    expect(document.activeElement?.getAttribute('data-ax-focus')).toBe('doc:AX-ENG-012');
  });
});

// ---------------------------------------------------------------------------
// Regressoes da review do PR #108
// ---------------------------------------------------------------------------

describe('perfil de cache legado (sem os campos narrativos)', () => {
  // Um cache gravado antes desta feature valida so profileId e wallet; o
  // perfil chega sem loreIndex/readLoreFragmentIds e NADA pode explodir.
  const legacyProfile = (): ReturnType<typeof profile> => {
    const p = profile(10, 1) as unknown as Record<string, unknown>;
    delete p.loreIndex;
    delete p.readLoreFragmentIds;
    delete p.knownAssetArchetypes;
    delete p.discoveries;
    return p as unknown as ReturnType<typeof profile>;
  };

  it('o Registro continua de pe: sem links, sem excecao', () => {
    renderRecordsPanel(host, recordsWithStalker(), undefined, {
      profile: legacyProfile(),
      onViewDocs: () => {},
    });
    click(host.querySelector('[data-ax-focus="tab:assets"]'));
    expect(host.querySelector('[data-ax-focus^="viewdocs:"]')).toBeNull();
    click(host.querySelector('[data-ax-focus="tab:discoveries"]'));
    expect(host.querySelector('[data-ax-focus^="viewdocs:"]')).toBeNull();
  });

  it('a Matriz desenha sem bolinha e sem excecao', () => {
    renderMatrixPanel(host, matrixView({ profile: legacyProfile() }), handlers);
    expect(host.querySelector('[data-ax-focus="tab:codex"] .ax-dot')).toBeNull();
    renderMatrixPanel(
      host,
      matrixView({
        tab: 'codex',
        profile: legacyProfile(),
        codex: codexOf([fragment('AX-PUB-001')]),
        codexContext: { kind: 'asset', archetype: 'stalker' },
        codexReturn: false,
      }),
      handlers,
    );
    // Filtro contextual sem indice = contexto vazio, nunca crash.
    expect(host.textContent).toContain(t('codex.contextEmpty'));
  });
});

describe('leitura acompanha o documento aberto, nao o caminho', () => {
  it('a navegacao contextual (Ver docs) marca o documento focado', () => {
    openCodexDocument('AX-ENG-012');
    const opened: string[] = [];
    renderMatrixPanel(
      host,
      matrixView({
        tab: 'codex',
        profile: profileWithDocs(),
        codex: codexOf([fragment('AX-ENG-012')]),
        codexContext: { kind: 'asset', archetype: 'stalker' },
        codexReturn: true,
      }),
      { ...handlers, onOpenDocument: (f) => opened.push(f.id) },
    );
    expect(opened).toEqual(['AX-ENG-012']);
  });

  it('abrir por link de relacionado tambem marca', () => {
    openCodexDocument('AX-PUB-001');
    const opened: string[] = [];
    const related = fragment('AX-PUB-001');
    const target = fragment('AX-ENG-012', { relatedFragmentIds: [] });
    related.relatedFragmentIds = ['AX-ENG-012'];
    renderMatrixPanel(
      host,
      matrixView({ tab: 'codex', profile: profileWithDocs(), codex: codexOf([related, target]) }),
      { ...handlers, onOpenDocument: (f) => opened.push(f.id) },
    );
    // AX-PUB-001 esta aberto; clicar no relacionado navega para AX-ENG-012.
    click(host.querySelector('.codex-related-link'));
    expect(opened).toContain('AX-ENG-012');
  });

  it('documento fora do filtro atual NAO e marcado: o corpo nao esta visivel', () => {
    openCodexDocument('AX-PUB-001');
    const opened: string[] = [];
    renderMatrixPanel(
      host,
      matrixView({
        tab: 'codex',
        profile: profileWithDocs(),
        codex: codexOf([fragment('AX-PUB-001'), fragment('AX-ENG-012')]),
        // O filtro de stalker so mostra AX-ENG-012; o aberto (PUB-001) esta fora.
        codexContext: { kind: 'asset', archetype: 'stalker' },
        codexReturn: false,
      }),
      { ...handlers, onOpenDocument: (f) => opened.push(f.id) },
    );
    expect(opened).toEqual([]);
  });
});

describe('link de relacionado fora do filtro contextual', () => {
  it('seguir o link limpa o filtro em vez de nao abrir nada', () => {
    // AX-ENG-012 (dossie do stalker) aponta para AX-PUB-001, que esta
    // desbloqueado mas FORA do filtro do stalker. Clicar precisa pedir a
    // limpeza do contexto — nunca deixar um botao clicavel que nao faz nada.
    openCodexDocument('AX-ENG-012');
    const contexts: CodexContext[] = [];
    const source = fragment('AX-ENG-012', { relatedFragmentIds: ['AX-PUB-001'] });
    renderMatrixPanel(
      host,
      matrixView({
        tab: 'codex',
        profile: profileWithDocs(),
        codex: codexOf([fragment('AX-PUB-001'), source]),
        codexContext: { kind: 'asset', archetype: 'stalker' },
        codexReturn: true,
      }),
      { ...handlers, onCodexContext: (ctx) => contexts.push(ctx) },
    );
    click(host.querySelector('.codex-related-link'));
    expect(contexts).toEqual([{ kind: 'all' }]);
  });

  it('link para alvo DENTRO do filtro nao mexe no contexto', () => {
    openCodexDocument('AX-ENG-012');
    const contexts: CodexContext[] = [];
    const withDocs = profileWithDocs();
    withDocs.loreIndex.assets.stalker = ['AX-ENG-012', 'AX-PUB-001'];
    const source = fragment('AX-ENG-012', { relatedFragmentIds: ['AX-PUB-001'] });
    renderMatrixPanel(
      host,
      matrixView({
        tab: 'codex',
        profile: withDocs,
        codex: codexOf([fragment('AX-PUB-001'), source]),
        codexContext: { kind: 'asset', archetype: 'stalker' },
        codexReturn: true,
      }),
      { ...handlers, onCodexContext: (ctx) => contexts.push(ctx) },
    );
    click(host.querySelector('.codex-related-link'));
    expect(contexts).toEqual([]);
    // E o alvo abriu de verdade.
    expect(host.textContent).toContain('Corpo AX-PUB-001');
  });
});
