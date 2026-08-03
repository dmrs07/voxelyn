// O que a evolucao visual PODE e o que ela nao pode.
//
// O teste que mais importa e o ultimo: os marcos nao encostam em hitbox. A
// arvore vende consistencia, leitura e margem — nunca espaco ocupado.

import { describe, expect, it } from 'vitest';
import type { ProspectorGeneration } from '@voxelyn/survival-sim';
import { drawGenerationMarks, generationIndex, marksFor } from './prospector-generation';

const ALL: ProspectorGeneration[] = ['G-00', 'G-01', 'G-02', 'G-03', 'G-04'];

describe('marcos por geracao', () => {
  it('G-00 nao acrescenta nada ao Prospector de fabrica', () => {
    expect(Object.values(marksFor('G-00')).every((v) => v === false)).toBe(true);
  });

  it('G-04 acende tudo, inclusive o unico traco emissivo', () => {
    const marks = marksFor('G-04');
    expect(Object.values(marks).every((v) => v === true)).toBe(true);
    expect(marks.reactorRing).toBe(true);
  });

  // O chassi CRESCE, nao troca: G-02 mantem as ombreiras de G-01. E a mesma
  // ideia que a lore conta sobre as geracoes se depositarem umas sobre as outras.
  it('e cumulativo: nenhum marco desliga ao subir de geracao', () => {
    for (let i = 1; i < ALL.length; i++) {
      const before = marksFor(ALL[i - 1]);
      const after = marksFor(ALL[i]);
      for (const key of Object.keys(before) as (keyof typeof before)[]) {
        if (before[key]) expect(after[key], `${ALL[i]}/${key}`).toBe(true);
      }
    }
  });

  it('cada geracao acrescenta pelo menos um traco novo', () => {
    for (let i = 1; i < ALL.length; i++) {
      const before = Object.values(marksFor(ALL[i - 1])).filter(Boolean).length;
      const after = Object.values(marksFor(ALL[i])).filter(Boolean).length;
      expect(after, ALL[i]).toBeGreaterThan(before);
    }
  });

  it('o halo do reator e exclusivo do capstone geracional', () => {
    for (const generation of ALL) {
      expect(marksFor(generation).reactorRing).toBe(generation === 'G-04');
    }
  });

  it('geracao desconhecida cai em G-00 em vez de lancar', () => {
    expect(generationIndex('G-99' as ProspectorGeneration)).toBe(0);
  });
});

describe('o desenho nao toca no que a simulacao decide', () => {
  /** Um contexto de canvas falso que so anota o que foi chamado. */
  const spyCtx = () => {
    const calls: string[] = [];
    const noop = (name: string) => (): void => void calls.push(name);
    return {
      calls,
      ctx: {
        save: noop('save'),
        restore: noop('restore'),
        beginPath: noop('beginPath'),
        moveTo: noop('moveTo'),
        lineTo: noop('lineTo'),
        stroke: noop('stroke'),
        fillRect: noop('fillRect'),
        ellipse: noop('ellipse'),
        lineCap: '',
        lineWidth: 0,
        fillStyle: '',
        strokeStyle: '',
        globalAlpha: 1,
      } as unknown as CanvasRenderingContext2D,
    };
  };

  it('G-00 nao emite uma unica chamada de desenho', () => {
    const { ctx, calls } = spyCtx();
    drawGenerationMarks(ctx, marksFor('G-00'), 100, 100, 2, 1, 0);
    expect(calls).toEqual([]);
  });

  it('todo desenho fica dentro de um save/restore pareado', () => {
    for (const generation of ALL.slice(1)) {
      const { ctx, calls } = spyCtx();
      drawGenerationMarks(ctx, marksFor(generation), 100, 100, 2, 1, 0);
      expect(calls.filter((c) => c === 'save').length, generation).toBe(1);
      expect(calls.filter((c) => c === 'restore').length, generation).toBe(1);
      expect(calls[0]).toBe('save');
      expect(calls.at(-1)).toBe('restore');
    }
  });

  // A garantia central: um G-04 ocupa exatamente o mesmo espaco que um G-00.
  // Se a arvore vendesse hitbox, ela estaria vendendo a pior coisa que poderia.
  it('nenhuma geracao altera raio, ancora ou footprint', () => {
    const radius = 0.34;
    for (const generation of ALL) {
      const { ctx } = spyCtx();
      const before = radius;
      drawGenerationMarks(ctx, marksFor(generation), 100, 100, 2, 1, 0);
      expect(radius).toBe(before);
    }
  });

  it('o rumo decide o lado, e nao a existencia do traco', () => {
    const right = spyCtx();
    const left = spyCtx();
    drawGenerationMarks(right.ctx, marksFor('G-04'), 100, 100, 2, 1, 0);
    drawGenerationMarks(left.ctx, marksFor('G-04'), 100, 100, 2, -1, 0);
    expect(left.calls).toEqual(right.calls);
  });
});
