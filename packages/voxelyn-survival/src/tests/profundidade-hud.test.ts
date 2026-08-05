// O HUD de PROFUNDIDADE: o que o jogador le sobre a run que ele esta jogando.
//
// A regressao que este arquivo existe para impedir e uma so, e ela nao quebra
// nada: mostrar o denominador errado. Uma run de G-01 que anuncia "3/7" parece
// truncada por uma area perdida — quando na verdade ela esta completa. O erro
// inverso e pior: uma run de G-04 que anuncia "3/3" manda o jogador embora com
// quatro setores por explorar.

import { describe, expect, it } from 'vitest';
import { createRun, runDepthForGeneration, type ProspectorGeneration } from '@voxelyn/survival-sim';
import { setLocale, t } from '../client/i18n';
import { objectiveViewOf } from '../client/objective-prop';

const LOCALES = ['pt-BR', 'en'] as const;

const runFor = (generation: ProspectorGeneration, sector = 1) =>
  createRun({ seed: 7, sector, depth: runDepthForGeneration(generation) });

describe('o denominador do HUD e o total ACESSIVEL da run', () => {
  it.each([
    ['G-00' as const, 3],
    ['G-01' as const, 3],
    ['G-02' as const, 4],
    ['G-03' as const, 5],
    ['G-04' as const, 7],
  ])('%s desenha um total de %i', (generation, total) => {
    const state = runFor(generation);
    expect(state.config.depth.sectorCount).toBe(total);
    setLocale('pt-BR');
    expect(t('hud.sector', { sector: state.sector, total: state.config.depth.sectorCount })).toBe(
      `SETOR 1/${total}`,
    );
  });

  it('G-01 fecha em 3/3 — nunca em 3/7', () => {
    const state = runFor('G-01', 3);
    setLocale('pt-BR');
    const line = t('hud.sector', { sector: state.sector, total: state.config.depth.sectorCount });
    expect(line).toBe('SETOR 3/3');
    expect(line).not.toContain('7');
  });

  it('G-04 chega a 7/7', () => {
    const state = runFor('G-04', 7);
    setLocale('pt-BR');
    expect(t('hud.sector', { sector: 7, total: state.config.depth.sectorCount })).toBe(
      'SETOR 7/7',
    );
  });
});

describe('contador de Nucleos', () => {
  it('so tem o que dizer quando a run tem mais de um', () => {
    expect(runFor('G-01').config.depth.coreSectors).toHaveLength(1);
    expect(runFor('G-02').config.depth.coreSectors).toHaveLength(1);
    expect(runFor('G-03').config.depth.coreSectors).toHaveLength(2);
    expect(runFor('G-04').config.depth.coreSectors).toHaveLength(2);
  });

  it('a contagem acompanha o Nucleo intermediario', () => {
    const state = runFor('G-04', 3);
    setLocale('pt-BR');
    expect(t('hud.cores', { taken: 0, total: 2 })).toBe('NÚCLEOS 0/2');
    state.coresTakenMask |= 1 << 3;
    expect(t('hud.cores', { taken: 1, total: 2 })).toBe('NÚCLEOS 1/2');
    // E o intermediario NAO poe a run em retorno: a diretiva continua descendo.
    expect(objectiveViewOf(state).returning).toBe(false);
  });
});

describe('feedback dos selos e do retorno', () => {
  it('o setor selado se anuncia como selo, e nao como poco disponivel', () => {
    const state = runFor('G-04', 3);
    const view = objectiveViewOf(state);
    expect(view.sealedByBoss).toBe(true);
    expect(view.hasCore).toBe(true);
    for (const locale of LOCALES) {
      setLocale(locale);
      expect(t('hud.objective.breakSeal').length).toBeGreaterThan(0);
      expect(t('hud.objective.breakSeal')).not.toBe('hud.objective.breakSeal');
    }
  });

  it('as tres mensagens novas da simulacao existem nos dois idiomas', () => {
    const keys = [
      'sim.descentSealedByBoss',
      'sim.coreSealedByBoss',
      'sim.coreTakenDeeper',
    ] as const;
    for (const locale of LOCALES) {
      setLocale(locale);
      for (const key of keys) {
        const text = t(key);
        expect(text, `${locale} ${key}`).not.toBe(key);
        expect(text.length).toBeGreaterThan(0);
      }
    }
  });

  it('o carimbo de autorizacao do menu existe nos dois idiomas', () => {
    for (const locale of LOCALES) {
      setLocale(locale);
      expect(t('menu.clearance.generation', { generation: 'G-03' })).toContain('G-03');
      expect(t('menu.clearance.depth', { sectors: 5 })).toContain('5');
      expect(t('menu.clearance.cores', { cores: 2 })).toContain('2');
    }
  });

  it('o aviso do Nucleo INTERMEDIARIO nao manda voltar', () => {
    for (const locale of LOCALES) {
      setLocale(locale);
      const deeper = t('toast.core.deeper', { taken: 1, total: 2 });
      expect(deeper).toContain('1');
      expect(deeper).toContain('2');
      // E e uma frase DIFERENTE da de fim de run.
      expect(deeper).not.toBe(t('toast.core.taken'));
    }
  });

  it('a linha de carga informa a CONTAGEM de Nucleos, nunca o literal 1', () => {
    for (const locale of LOCALES) {
      setLocale(locale);
      expect(t('summary.cargo.core', { ore: 40, cores: 2 })).toContain('2');
      expect(t('summary.outcome.cores', { cores: 2 })).toContain('2');
    }
  });
});
