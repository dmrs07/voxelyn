// O painel nao decide nada — mas ele DIZ o que falta, e essa mensagem e uma
// decisao de produto: "faltam 35 ⬡" para um no bloqueado manda o jogador minerar
// por nada.

import { describe, expect, it } from 'vitest';
import { findUpgrade, UPGRADES } from '@voxelyn/survival-sim';
import type { PublicProgressionProfile } from '@voxelyn/survival-protocol';
import {
  needsConfirmation,
  nodeState,
  panelNotice,
  purchaseEnabled,
  type MatrixViewState,
} from './matrix-panel';

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
  loading: false,
  codex: null,
  pending: null,
  notice: null,
  reveal: null,
  ...over,
});

describe('o painel distingue "perguntando" de "a pergunta falhou"', () => {
  it('enquanto carrega, anuncia a consulta e nao a queda', () => {
    expect(panelNotice(view({ loading: true, cached: true }))).toBe('matrix.loading');
  });

  it('so depois de a consulta falhar e que avisa que esta offline', () => {
    expect(panelNotice(view({ loading: false, cached: true }))).toBe('matrix.offline');
  });

  it('com perfil autoritativo, nao anuncia nada', () => {
    expect(panelNotice(view())).toBeNull();
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
