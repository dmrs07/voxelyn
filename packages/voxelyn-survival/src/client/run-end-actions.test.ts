// A tela de fim passou a ter DUAS saidas, e a diferenca entre elas e a
// diferenca entre continuar jogando e ir gastar o minerio na Matriz. Um botao
// que vaza da moldura, ou dois que se sobrepoem no celular estreito, mandam o
// jogador para o lugar errado — e ele so descobre depois do véu.

import { describe, expect, it } from 'vitest';
import {
  ACTIONS_UNITS,
  BUTTON_UNITS,
  END_ACTION_HIT_PAD,
  endActionAt,
  layoutEndActions,
} from './run-end-actions';

/** Os extremos reais: celular em pe, celular deitado e desktop. */
const VIEWPORTS = [
  { name: 'retrato estreito', vw: 320, vh: 568, unit: 10, margin: 8 },
  { name: 'paisagem baixa', vw: 720, vh: 360, unit: 7, margin: 14 },
  { name: 'desktop', vw: 1600, vh: 900, unit: 20, margin: 22 },
];

describe('rodape de acoes da tela de fim', () => {
  it.each(VIEWPORTS)('$name: os dois botoes cabem na moldura', ({ vw, unit, margin }) => {
    const { restart, terminal } = layoutEndActions(vw, 100, unit, margin);
    expect(restart.x).toBeGreaterThanOrEqual(margin);
    expect(terminal.x + terminal.w).toBeLessThanOrEqual(vw - margin);
    expect(restart.w).toBe(terminal.w);
    expect(restart.h).toBe(unit * BUTTON_UNITS);
  });

  // Com `unit` de 7 pixels o vao inteiro tem 6, menos que duas folgas de dedo:
  // inflar os dois retangulos criaria uma faixa que responde as duas acoes, e a
  // primeira da lista ganharia em silencio. A linha do meio nao tem esse
  // problema em nenhum tamanho.
  it.each(VIEWPORTS)('$name: o vao pertence a um botao so', ({ vw, unit, margin }) => {
    const regions = layoutEndActions(vw, 100, unit, margin);
    const { restart, terminal } = regions;
    const meioY = 100 + unit;
    const vao = terminal.x - (restart.x + restart.w);
    expect(vao).toBeGreaterThan(0);
    // Varre o vao inteiro: cada ponto responde uma coisa, e a troca acontece
    // uma vez so — no meio.
    for (let i = 0; i <= 20; i++) {
      const x = restart.x + restart.w + (vao * i) / 20;
      const esperado = x < restart.x + restart.w + vao / 2 ? 'restart' : 'terminal';
      expect(endActionAt(regions, x, meioY)).toBe(esperado);
    }
  });

  it('descer de novo fica a esquerda, onde a leitura termina', () => {
    const { restart, terminal } = layoutEndActions(800, 400, 16, 20);
    expect(restart.x).toBeLessThan(terminal.x);
  });

  it('centra o par na tela', () => {
    const { restart, terminal } = layoutEndActions(800, 400, 16, 20);
    const centro = (restart.x + terminal.x + terminal.w) / 2;
    expect(centro).toBeCloseTo(400, 5);
  });

  it('acerta o botao que o dedo mirou, e nada quando o toque cai no vazio', () => {
    const regions = layoutEndActions(800, 400, 16, 20);
    const meio = (r: { x: number; y: number; w: number; h: number }) => ({
      x: r.x + r.w / 2,
      y: r.y + r.h / 2,
    });
    const a = meio(regions.restart);
    const b = meio(regions.terminal);
    expect(endActionAt(regions, a.x, a.y)).toBe('restart');
    expect(endActionAt(regions, b.x, b.y)).toBe('terminal');
    // Acima dos botoes moram a causa da morte e os numeros: ali o toque nao
    // pode decidir nada. Antes deste rodape ele reiniciava a run.
    expect(endActionAt(regions, a.x, 300)).toBeNull();
    expect(endActionAt(regions, 10, a.y)).toBeNull();
  });

  it('perdoa o erro de borda do polegar', () => {
    const regions = layoutEndActions(360, 400, 12, 8);
    const { restart } = regions;
    const pad = Math.max(END_ACTION_HIT_PAD, restart.h * 0.35);
    expect(endActionAt(regions, restart.x + 10, restart.y + restart.h + pad - 1)).toBe('restart');
    expect(endActionAt(regions, restart.x + 10, restart.y + restart.h + pad + 2)).toBeNull();
    expect(endActionAt(regions, restart.x - END_ACTION_HIT_PAD + 1, restart.y + 2)).toBe('restart');
  });

  // O botao encolhe junto com o documento: numa paisagem de 320px ele fica com
  // 15 pixels de altura. O alvo de toque nao pode encolher junto ate virar um
  // fio, porque e ele que decide entre jogar de novo e ir gastar o minerio.
  it('mantem o alvo utilizavel quando o documento encolhe', () => {
    const regions = layoutEndActions(568, 280, 7, 14);
    const { restart } = regions;
    const alturaDoAlvo = 2 * Math.max(END_ACTION_HIT_PAD, restart.h * 0.35) + restart.h;
    expect(alturaDoAlvo).toBeGreaterThanOrEqual(26);
  });

  // O coeficiente que a tela de fim soma para decidir o `unit` tem de cobrir o
  // que os botoes realmente ocupam. Se ele encolher abaixo disso, o documento
  // e centrado como se o rodape fosse menor e a ultima linha sai pela borda.
  it('reserva altura suficiente para o que desenha', () => {
    expect(ACTIONS_UNITS).toBeGreaterThanOrEqual(BUTTON_UNITS);
    const unit = 16;
    const top = 400;
    const { restart } = layoutEndActions(800, top, unit, 20);
    const fundo = restart.y + restart.h;
    // O respiro acima ja foi contado por quem chamou; o que sobra abaixo do
    // botao ainda cabe dentro da reserva.
    expect(fundo).toBeLessThanOrEqual(top + ACTIONS_UNITS * unit);
  });
});
