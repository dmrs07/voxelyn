// A parte PURA dos leitos de chefe: a fase que cada um le do tick.
//
// Os leitos em si precisam de AudioContext e nao sao testados aqui (nenhum
// teste automatico julga timbre). O que se protege e que a aritmetica de
// fase do cliente e a MESMA da simulacao — um leito que inspirasse enquanto o
// Pulmao expele estaria mentindo no unico canal que o jogador usa para
// cronometrar a luta.
import { describe, expect, it } from 'vitest';
import {
  FURNACE_HEART_CYCLE_TICKS,
  LUNG_MATRIX_CYCLE_TICKS,
  LUNG_MATRIX_HOLD_TICKS,
  furnaceOverheatingAt,
} from '@voxelyn/survival-sim';
import { lungPhaseAt } from './lung-breath-bus';
import { furnaceBeatRateAt } from './furnace-heart-bus';

describe('a respiracao do Pulmao segue o relogio da simulacao', () => {
  it('inspira na primeira metade do ciclo, segura no fim dela, expele na segunda', () => {
    expect(lungPhaseAt(0).phase).toBe('inhale');
    expect(lungPhaseAt(LUNG_MATRIX_CYCLE_TICKS - LUNG_MATRIX_HOLD_TICKS).phase).toBe('hold');
    expect(lungPhaseAt(LUNG_MATRIX_CYCLE_TICKS - 1).phase).toBe('hold');
    expect(lungPhaseAt(LUNG_MATRIX_CYCLE_TICKS).phase).toBe('exhale');
    expect(lungPhaseAt(LUNG_MATRIX_CYCLE_TICKS * 2).phase).toBe('inhale');
  });

  it('o progresso sobe de 0 a 1 dentro de cada fase', () => {
    expect(lungPhaseAt(0).progress).toBe(0);
    const late = lungPhaseAt(LUNG_MATRIX_CYCLE_TICKS - LUNG_MATRIX_HOLD_TICKS - 1);
    expect(late.progress).toBeGreaterThan(0.9);
    expect(late.progress).toBeLessThan(1);
    expect(lungPhaseAt(LUNG_MATRIX_CYCLE_TICKS).progress).toBe(0);
    expect(lungPhaseAt(LUNG_MATRIX_CYCLE_TICKS * 2 - 1).progress).toBeLessThan(1);
  });
});

describe('o batimento da Fornalha segue a blindagem', () => {
  it('acelera no superaquecimento e cai no resfriamento', () => {
    const hotStart = furnaceBeatRateAt(0);
    const hotEnd = furnaceBeatRateAt(FURNACE_HEART_CYCLE_TICKS - 1);
    const cool = furnaceBeatRateAt(FURNACE_HEART_CYCLE_TICKS + 10);
    expect(furnaceOverheatingAt(0)).toBe(true);
    expect(furnaceOverheatingAt(FURNACE_HEART_CYCLE_TICKS + 10)).toBe(false);
    expect(hotEnd).toBeGreaterThan(hotStart);
    expect(cool).toBeLessThan(hotStart);
  });
});
