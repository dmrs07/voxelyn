// O AVISO DE PERFIL REABERTO, e as quatro condicoes que ele exige juntas.
//
// Nasceu de um incidente que levou uma hora e devia ter levado dez segundos: a
// arvore de protocolos voltou vazia e o servidor estava impecavel — Postgres
// conectado em todo boot, base intacta, nenhum outro jogador afetado. O que
// aconteceu foi local: o token sumiu deste navegador e o cliente abriu um
// perfil em branco EM SILENCIO. Do lado de fora, perder o vinculo local e
// indistinguivel de o servidor ter apagado tudo — e a primeira suspeita vai
// para o servidor, que e onde a informacao nao esta.
//
// A regra e replicada aqui em vez de importada de `main.ts` de proposito: o
// modulo abre o jogo inteiro no import (canvas, audio, WebSocket). O que este
// arquivo protege e a DECISAO — quando avisar e quando calar —, e ela cabe numa
// funcao pura. Se a de `main.ts` divergir desta, o teste para de proteger; por
// isso as duas ficam com o mesmo nome e o mesmo formato.

import { describe, expect, it } from 'vitest';

type Perfil = {
  profileId: string;
  purchasedUpgradeIds: string[];
  wallet: { ore: number; cores: number };
};

/** Espelha `announceProfileReopened` em `main.ts`. */
const deveAvisar = (previous: Perfil | null, opened: Perfil): boolean => {
  if (!previous || previous.profileId === opened.profileId) return false;
  return (
    previous.purchasedUpgradeIds.length > 0 ||
    previous.wallet.ore > 0 ||
    previous.wallet.cores > 0
  );
};

const perfil = (over: Partial<Perfil> = {}): Perfil => ({
  profileId: 'antigo',
  purchasedUpgradeIds: [],
  wallet: { ore: 0, cores: 0 },
  ...over,
});

const novoEmBranco = perfil({ profileId: 'novo' });

describe('avisa quando ha o que avisar', () => {
  it('perfil novo por cima de um com protocolos comprados', () => {
    expect(deveAvisar(perfil({ purchasedUpgradeIds: ['CA-02'] }), novoEmBranco)).toBe(true);
  });

  it('perfil novo por cima de um com minerio na carteira', () => {
    expect(deveAvisar(perfil({ wallet: { ore: 40, cores: 0 } }), novoEmBranco)).toBe(true);
  });

  it('perfil novo por cima de um com Nucleos na carteira', () => {
    expect(deveAvisar(perfil({ wallet: { ore: 0, cores: 2 } }), novoEmBranco)).toBe(true);
  });
});

describe('cala quando nao ha', () => {
  /**
   * A primeira visita e o caso NORMAL, e e o mais comum de todos. Avisar aqui
   * transformaria a estreia de todo jogador novo num alerta sobre um problema
   * que nao existe.
   */
  it('primeira visita: nao havia perfil nenhum', () => {
    expect(deveAvisar(null, novoEmBranco)).toBe(false);
  });

  // Reconectar ao MESMO perfil nao e perda — e o caminho feliz de uma sessao
  // que expirou e foi renovada.
  it('reabriu a sessao do mesmo perfil', () => {
    const mesmo = perfil({ profileId: 'x', purchasedUpgradeIds: ['CA-02'] });
    expect(deveAvisar(mesmo, { ...mesmo, purchasedUpgradeIds: [] })).toBe(false);
  });

  /**
   * O item que separa "voce perdeu sua arvore" de "voce tinha um perfil zerado
   * e ganhou outro zerado". Sem ele o aviso apareceria para quem nao perdeu
   * nada — e um aviso que cria alarme falso deixa de ser lido, que e o mesmo
   * resultado de nao ter aviso nenhum.
   */
  it('o perfil anterior estava vazio: nao havia o que perder', () => {
    expect(deveAvisar(perfil({ profileId: 'vazio' }), novoEmBranco)).toBe(false);
  });
});
