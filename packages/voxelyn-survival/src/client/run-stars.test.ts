// A nota e a unica coisa da tela de fim que o jogador nao pode reler depois:
// ela vale enquanto a tela esta no ar. Uma animacao que trava no meio, que
// nunca pousa, ou que concede o brilho de nota cheia a duas estrelas mente
// sobre o resultado da run — e mente com confianca, porque animacao parece
// certa por definicao.

import { describe, expect, it } from 'vitest';
import {
  RING_MS,
  STAMP_FROM_SCALE,
  STAMP_MS,
  STAR_COUNT,
  STAR_DELAY_MS,
  STAR_STEP_MS,
  socketAlpha,
  stampEndMs,
  stampStartMs,
  starRowLayout,
  starStamp,
  strikeProgress,
  sweepProgress,
} from './run-stars';

describe('carimbo das estrelas', () => {
  it('nao mostra nada antes da hora, e pousa depois dela', () => {
    const antes = starStamp(0, 0);
    expect(antes.alpha).toBe(0);
    expect(antes.landed).toBe(false);
    const depois = starStamp(stampStartMs(0) + STAMP_MS + 1, 0);
    expect(depois.landed).toBe(true);
    expect(depois.scale).toBe(1);
  });

  it('cai grande e termina no tamanho exato', () => {
    const inicio = starStamp(stampStartMs(0) + 1, 0);
    expect(inicio.scale).toBeGreaterThan(1.5);
    expect(inicio.scale).toBeLessThanOrEqual(STAMP_FROM_SCALE);
    expect(starStamp(stampStartMs(0) + STAMP_MS, 0).scale).toBe(1);
  });

  // O esmagamento e o que da PESO ao carimbo: sem passar do ponto, o glifo so
  // encolhe e para, e a fileira lê como três imagens trocadas de tamanho.
  it('esmaga abaixo do tamanho final antes de assentar', () => {
    let menor = Infinity;
    for (let ms = 1; ms < STAMP_MS; ms += 2) {
      menor = Math.min(menor, starStamp(stampStartMs(0) + ms, 0).scale);
    }
    expect(menor).toBeLessThan(1);
    expect(menor).toBeGreaterThan(0.8); // esmagar demais vira borracha
  });

  it('conta uma de cada vez: a segunda so comeca depois da primeira', () => {
    const noPousoDaPrimeira = stampStartMs(0) + STAMP_MS;
    expect(starStamp(noPousoDaPrimeira, 0).landed).toBe(true);
    expect(starStamp(noPousoDaPrimeira, 1).alpha).toBe(0);
    expect(STAR_STEP_MS).toBeGreaterThan(STAMP_MS);
  });

  it('abre o anel de impacto no pouso e o fecha depois', () => {
    const pouso = stampStartMs(1) + STAMP_MS;
    expect(starStamp(pouso + 10, 1).ring).toBeGreaterThan(0);
    expect(starStamp(pouso + RING_MS / 2, 1).ring).toBeCloseTo(0.5, 1);
    expect(starStamp(pouso + RING_MS + 1, 1).ring).toBe(0);
  });

  it('assenta tudo de uma vez para quem pediu menos movimento', () => {
    const parado = starStamp(0, 2, true);
    expect(parado).toEqual({ scale: 1, alpha: 1, landed: true, ring: 0 });
    expect(socketAlpha(0, true)).toBe(1);
    expect(strikeProgress(0, 0, true)).toBe(1);
    expect(sweepProgress(0, 3, true)).toBe(0);
  });

  it('termina: nenhuma animacao fica no ar depois de dois segundos', () => {
    const tarde = 2000;
    expect(tarde).toBeGreaterThan(stampEndMs(STAR_COUNT) + RING_MS);
    for (let i = 0; i < STAR_COUNT; i++) {
      const fim = starStamp(tarde, i);
      expect(fim).toEqual({ scale: 1, alpha: 1, landed: true, ring: 0 });
    }
    expect(sweepProgress(tarde, 3)).toBe(0);
    expect(socketAlpha(tarde)).toBe(1);
  });
});

describe('o que a nota diz', () => {
  // O brilho e a celebracao da nota CHEIA. Concede-lo a duas estrelas apagaria
  // a unica diferenca entre a run boa e a run perfeita.
  it('o brilho e so da nota cheia', () => {
    const depois = stampEndMs(3) + 200;
    expect(sweepProgress(depois, 3)).toBeGreaterThan(0);
    expect(sweepProgress(depois, 2)).toBe(0);
    expect(sweepProgress(depois, 1)).toBe(0);
    expect(sweepProgress(depois, 0)).toBe(0);
  });

  it('o brilho passa uma vez e nao volta', () => {
    expect(sweepProgress(30_000, 3)).toBe(0);
  });

  // Riscar a fileira de quem saiu vivo do Veio chamaria de fracasso a run que a
  // companhia pagou.
  it('a linha de recusa e so da nota zero', () => {
    const tarde = 3000;
    expect(strikeProgress(tarde, 0)).toBe(1);
    expect(strikeProgress(tarde, 1)).toBe(0);
    expect(strikeProgress(tarde, 3)).toBe(0);
    expect(strikeProgress(0, 0)).toBe(0); // nem antes dos soquetes entrarem
  });

  it('os soquetes entram antes do primeiro carimbo', () => {
    expect(socketAlpha(STAR_DELAY_MS)).toBe(1);
  });
});

describe('a fileira na tela', () => {
  const VIEWPORTS = [
    { name: 'retrato estreito', vw: 320, unit: 10, margin: 8 },
    { name: 'paisagem baixa', vw: 568, unit: 7, margin: 14 },
    { name: 'desktop', vw: 1600, unit: 20, margin: 22 },
  ];

  it.each(VIEWPORTS)('$name: os tres glifos cabem na moldura', ({ vw, unit, margin }) => {
    const row = starRowLayout(vw, 100, unit, margin);
    expect(row.centers).toHaveLength(STAR_COUNT);
    expect(row.centers[0] - row.size / 2).toBeGreaterThanOrEqual(margin);
    expect(row.centers[STAR_COUNT - 1] + row.size / 2).toBeLessThanOrEqual(vw - margin);
  });

  it('fica centrada e com passo igual', () => {
    const row = starRowLayout(800, 100, 16, 20);
    expect((row.centers[0] + row.centers[2]) / 2).toBeCloseTo(400, 5);
    expect(row.centers[1] - row.centers[0]).toBeCloseTo(row.centers[2] - row.centers[1], 5);
  });

  it('os glifos nao se encostam', () => {
    for (const { vw, unit, margin } of VIEWPORTS) {
      const row = starRowLayout(vw, 100, unit, margin);
      expect(row.centers[1] - row.centers[0]).toBeGreaterThan(row.size);
    }
  });

  // A nota e o bloco mais destacado do documento depois do titulo: se ela
  // deixar de crescer com a tela, vira o mesmo cromo de canto que ela veio
  // substituir.
  it('a estrela e maior que o texto do documento', () => {
    const unit = 16;
    const row = starRowLayout(800, 100, unit, 20);
    expect(row.size).toBeGreaterThan(unit * 1.7); // o titulo da tela de fim
  });
});
