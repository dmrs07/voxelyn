// O painel nao decide nada — mas ele DIZ o que falta, e essa mensagem e uma
// decisao de produto: "faltam 35 ⬡" para um no bloqueado manda o jogador minerar
// por nada.

import { describe, expect, it } from 'vitest';
import { findUpgrade, UPGRADES } from '@voxelyn/survival-sim';
import type { PublicProgressionProfile } from '@voxelyn/survival-protocol';
import {
  needsConfirmation,
  nodeAriaLabel,
  nodeState,
  panelNotice,
  purchaseEnabled,
  type MatrixViewState,
} from './matrix-panel';
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

const ca01 = findUpgrade('CA-01');
const ca02 = findUpgrade('CA-02');
if (!ca01 || !ca02) throw new Error('catalogo incompleto');

describe('estado de um no', () => {
  it('instalado quando ja comprado', () => {
    expect(nodeState(ca01, profile(0, 0, ['CA-01']))).toEqual({ kind: 'installed' });
  });

  // A ordem que importa: bloqueio ANTES de saldo.
  it('bloqueado pelo pre-requisito, mesmo com a carteira cheia', () => {
    expect(nodeState(ca02, profile(99999, 99))).toEqual({
      kind: 'locked',
      prerequisite: 'CA-01',
    });
  });

  it('comprável quando ha arvore e saldo', () => {
    expect(nodeState(ca01, profile(35, 1))).toEqual({ kind: 'affordable' });
  });

  it('diz exatamente o que falta, e nao "saldo insuficiente"', () => {
    expect(nodeState(ca01, profile(17, 0))).toEqual({ kind: 'missing', ore: 18, cores: 1 });
    expect(nodeState(ca01, profile(35, 0))).toEqual({ kind: 'missing', ore: 0, cores: 1 });
    expect(nodeState(ca01, profile(0, 1))).toEqual({ kind: 'missing', ore: 35, cores: 0 });
  });

  // Minerio de sobra e nenhum nucleo: a situacao exata de quem so extrai cedo.
  it('minerio sozinho nunca deixa um no comprável', () => {
    for (const upgrade of UPGRADES) {
      const owned = UPGRADES.filter(
        (u) => u.branch === upgrade.branch && u.tier < upgrade.tier,
      ).map((u) => u.id);
      const state = nodeState(upgrade, profile(999_999, 0, owned));
      expect(state.kind, upgrade.id).toBe('missing');
      if (state.kind === 'missing') expect(state.cores).toBeGreaterThan(0);
    }
  });

  it('sem perfil, nada e comprável', () => {
    expect(nodeState(ca01, null).kind).toBe('missing');
  });
});

describe('confirmacao', () => {
  // Tiers 4 a 6 custam 130+ minerio e dois nucleos: horas de jogo por clique.
  it('so os tiers caros pedem confirmacao', () => {
    for (const upgrade of UPGRADES) {
      expect(needsConfirmation(upgrade), upgrade.id).toBe(upgrade.tier >= 4);
    }
  });
});

// ---------------------------------------------------------------------------
// Estados do painel
// ---------------------------------------------------------------------------

const view = (over: Partial<MatrixViewState> = {}): MatrixViewState => ({
  tab: 'matrix',
  profile: profile(9999, 9),
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

describe('o painel distingue "perguntando" de "a pergunta falhou"', () => {
  it('enquanto carrega, anuncia a consulta e nao a queda', () => {
    expect(panelNotice(view({ loading: true, cached: true }))).toEqual({ key: 'matrix.loading' });
  });

  it('so depois de a consulta falhar e que avisa que esta offline', () => {
    expect(panelNotice(view({ loading: false, cached: true }))).toEqual({ key: 'matrix.offline' });
  });

  it('com perfil autoritativo, nao anuncia nada', () => {
    expect(panelNotice(view())).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// "Nao alcancamos" e "recusou" nao sao a mesma noticia
// ---------------------------------------------------------------------------
// As duas pedem acoes OPOSTAS: uma manda esperar a rede, a outra manda olhar o
// servidor. O painel dizia a mesma frase para as duas, e descobrir qual era
// exigia abrir o DevTools — foi assim que um servidor no ar passou dias sendo
// lido como um servidor fora do ar.

describe('o painel distingue as tres maneiras de ficar sem perfil', () => {
  it('sem tentativa registrada, cai no generico de conexao', () => {
    expect(panelNotice(view({ cached: true, stale: null }))).toEqual({ key: 'matrix.offline' });
  });

  it('com resposta que recusou, mostra o codigo em vez de culpar a conexao', () => {
    const stale = { key: 'matrix.refused', params: { code: 'rate_limited 429' } } as const;
    expect(panelNotice(view({ cached: true, stale }))).toEqual(stale);
  });

  it('endereco invalido nao vira "a Aurix recusou": ninguem foi consultado', () => {
    const stale = { key: 'matrix.badUrl' } as const;
    expect(panelNotice(view({ cached: true, stale }))).toEqual(stale);
  });

  it('perfil confirmado nao anuncia nada, mesmo com falha antiga pendurada', () => {
    expect(
      panelNotice(view({ cached: false, stale: { key: 'matrix.refused', params: { code: 'x' } } })),
    ).toBeNull();
  });
});

describe('quando da para comprar', () => {
  it('so contra saldo que o servidor confirmou, e sem compra em voo', () => {
    expect(purchaseEnabled(view())).toBe(true);
    expect(purchaseEnabled(view({ loading: true }))).toBe(false);
    expect(purchaseEnabled(view({ cached: true }))).toBe(false);
    expect(purchaseEnabled(view({ pending: 'CA-01' }))).toBe(false);
  });
});

// O rotulo falado de um no. "01 ●" diz tudo a quem ve o trilho e nada a quem
// ouve um botao por vez: ramo, codigo, nome e situacao precisam estar na fala.
describe('rotulo de leitor de tela do no', () => {
  it('carrega ramo, codigo, nome e a situacao escrita', () => {
    const label = nodeAriaLabel(ca02, nodeState(ca02, profile(99999, 99)));
    expect(label).toContain(t('matrix.branch.chassis'));
    expect(label).toContain('CA-02');
    expect(label).toContain(t('upgrade.CA-02.name'));
    expect(label).toContain(t('matrix.node.locked', { id: 'CA-01' }));
  });

  it('no compravel anuncia a acao, nao um estado vazio', () => {
    const label = nodeAriaLabel(ca01, nodeState(ca01, profile(99999, 99)));
    expect(label).toContain(t('matrix.confirm.yes'));
  });

  it('no instalado anuncia a incorporacao', () => {
    const label = nodeAriaLabel(ca01, nodeState(ca01, profile(0, 0, ['CA-01'])));
    expect(label).toContain(t('matrix.node.installed'));
  });
});
