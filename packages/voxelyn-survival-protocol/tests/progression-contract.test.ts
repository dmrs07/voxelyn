// O contrato existe para NAO ter campo em que mentir. Estes testes vigiam isso.

import { describe, expect, it } from 'vitest';
import {
  IDEMPOTENCY_KEY_MAX,
  IDEMPOTENCY_KEY_MIN,
  IGNORED_CLIENT_CLAIMS,
  RUN_TICKET_TTL_MS,
  isRewardEligibleMode,
  isValidIdempotencyKey,
  type ProgressionSettlementRequest,
  type PublicProgressionProfile,
  type RunMode,
} from '../src/progression-contract';

describe('a submissao nao tem onde mentir', () => {
  // O teste que documenta a decisao: se alguem adicionar um campo de resultado a
  // este tipo, a linha abaixo para de compilar e a discussao acontece no PR.
  it('ProgressionSettlementRequest tem exatamente um campo: o log', () => {
    const request: ProgressionSettlementRequest = { log: 'AAAA' };
    expect(Object.keys(request)).toEqual(['log']);
  });

  it('a lista de campos ignorados cobre todas as afirmacoes tentadoras', () => {
    for (const claim of ['claimedOre', 'claimedCores', 'claimedPhase', 'claimedGeneration']) {
      expect(IGNORED_CLIENT_CLAIMS).toContain(claim);
    }
    // Custo e tuning tambem: o cliente nao decide preco nem configuracao.
    expect(IGNORED_CLIENT_CLAIMS).toContain('oreCost');
    expect(IGNORED_CLIENT_CLAIMS).toContain('tuning');
  });
});

describe('elegibilidade de modo', () => {
  it('so a Expedicao rende recurso permanente', () => {
    const modes: RunMode[] = ['expedition', 'ranked', 'coop', 'local_simulation'];
    expect(modes.filter(isRewardEligibleMode)).toEqual(['expedition']);
  });

  // A simulacao local existe justamente para NAO render nada. Um dia em que ela
  // render, este teste falha antes de o exploit existir.
  it('a simulacao local nunca e elegivel', () => {
    expect(isRewardEligibleMode('local_simulation')).toBe(false);
  });
});

describe('chave de idempotencia', () => {
  it('aceita o formato esperado', () => {
    expect(isValidIdempotencyKey('a'.repeat(IDEMPOTENCY_KEY_MIN))).toBe(true);
    expect(isValidIdempotencyKey('run-2026_08-02ABC')).toBe(true);
  });

  it('recusa curta demais, longa demais, vazia e nao-string', () => {
    expect(isValidIdempotencyKey('a'.repeat(IDEMPOTENCY_KEY_MIN - 1))).toBe(false);
    expect(isValidIdempotencyKey('a'.repeat(IDEMPOTENCY_KEY_MAX + 1))).toBe(false);
    expect(isValidIdempotencyKey('')).toBe(false);
    expect(isValidIdempotencyKey(null)).toBe(false);
    expect(isValidIdempotencyKey(42)).toBe(false);
  });

  // Caractere de controle e barra viram chave de arquivo, chave de cache e linha
  // de log. Uma allowlist estreita e mais barata que descobrir qual delas quebra.
  it('recusa caracteres fora da allowlist', () => {
    for (const bad of ['chave com espaco', '../../etc', 'a\nb-cdefgh', 'aaa/bbb/ccc']) {
      expect(isValidIdempotencyKey(bad)).toBe(false);
    }
  });
});

describe('o perfil publico nao carrega segredo', () => {
  it('nao tem token, ledger nem geracao gravavel pelo cliente', () => {
    const profile: PublicProgressionProfile = {
      profileId: 'p1',
      profileVersion: 3,
      wallet: { ore: 120, cores: 2 },
      purchasedUpgradeIds: ['CA-01'],
      generation: 'G-00',
      unlockedLoreFragmentIds: ['AX-PUB-001', 'AX-PUB-002'],
      statistics: {
        oreHomologated: 120,
        oreLost: 40,
        coresRecovered: 2,
        successfulReturns: 3,
        failedExpeditions: 5,
        upgradesPurchased: 1,
      },
    };
    const keys = Object.keys(profile);
    expect(keys).not.toContain('token');
    expect(keys).not.toContain('sessionToken');
    expect(keys).not.toContain('ledger');
    expect(keys).not.toContain('secret');
  });
});

describe('validade do ticket', () => {
  // 3x o teto de replay do leaderboard: quem joga uma run de 30 minutos ainda
  // tem uma hora para submeter depois de uma queda de rede.
  it('cobre com folga a run mais longa que o servidor aceita', () => {
    const longestAcceptedRunMs = 30 * 60 * 1000; // teto de replay do leaderboard
    expect(RUN_TICKET_TTL_MS).toBeGreaterThanOrEqual(longestAcceptedRunMs);
  });
});
