// A INCORPORACAO e a EJECAO de um modulo, conferidas pelo que elas nao podem
// fazer.
//
// O invariante que rege o arquivo inteiro: isto e apresentacao. A concessao
// do modulo aconteceu na simulacao, no tick do comando; nada aqui atrasa,
// confirma ou desfaz nada. Os testes abaixo protegem as tres consequencias
// disso — o evento reaplicado nao encena duas vezes, a falta de origem visual
// nao quebra a selecao, e as duas filas tem teto.

import { describe, expect, it } from 'vitest';
import {
  MAX_EJECTED_PROPS,
  MAX_INSTALL_FLIGHTS,
  ModulePropField,
  INSTALL_FLIGHT_MS,
  installFlightSample,
  installFlightScale,
} from './module-props';

/** Contexto de canvas falso: anota o que foi chamado, nao desenha nada. */
const spyCtx = () => {
  const calls: string[] = [];
  const noop = (name: string) => (): void => void calls.push(name);
  const ctx = {
    calls,
    save: noop('save'),
    restore: noop('restore'),
    beginPath: noop('beginPath'),
    closePath: noop('closePath'),
    moveTo: noop('moveTo'),
    lineTo: noop('lineTo'),
    arc: noop('arc'),
    ellipse: noop('ellipse'),
    stroke: noop('stroke'),
    fill: noop('fill'),
    fillRect: noop('fillRect'),
    translate: noop('translate'),
    rotate: noop('rotate'),
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 0,
    globalAlpha: 1,
  };
  return ctx as unknown as CanvasRenderingContext2D & { calls: string[] };
};

const at = (x: number, y: number) => ({ x, y });

describe('curva do voo de incorporacao', () => {
  it('sai da origem e chega ao destino, em arco', () => {
    const from = at(0, 0);
    const to = at(400, 100);
    const start = installFlightSample(from, to, 0, INSTALL_FLIGHT_MS);
    const end = installFlightSample(from, to, INSTALL_FLIGHT_MS, INSTALL_FLIGHT_MS);
    expect(start.x).toBeCloseTo(from.x);
    expect(end.x).toBeCloseTo(to.x);
    expect(end.y).toBeCloseTo(to.y);
    // No meio ele esta ACIMA da reta: e o arco que o design pede.
    const mid = installFlightSample(from, to, INSTALL_FLIGHT_MS / 2, INSTALL_FLIGHT_MS);
    const straight = from.y + (to.y - from.y) * 0.5;
    expect(mid.y).toBeLessThan(straight);
  });

  it('ENCOLHE ao longo do voo e nunca some', () => {
    expect(installFlightScale(0)).toBe(1);
    expect(installFlightScale(1)).toBeLessThan(installFlightScale(0));
    expect(installFlightScale(1)).toBeGreaterThan(0);
  });

  it('rotaciona levemente, e a rotacao morre na chegada', () => {
    const a = installFlightSample(at(0, 0), at(100, 0), 0, INSTALL_FLIGHT_MS);
    const b = installFlightSample(at(0, 0), at(100, 0), INSTALL_FLIGHT_MS, INSTALL_FLIGHT_MS);
    expect(Math.abs(a.spin)).toBeGreaterThan(0);
    expect(b.spin).toBeCloseTo(0);
    // "Levemente": menos de meia volta, ou o cartucho vira moeda.
    expect(Math.abs(a.spin)).toBeLessThan(Math.PI);
  });

  it('o progresso satura nas duas pontas', () => {
    expect(installFlightSample(at(0, 0), at(9, 9), -500, 100).progress).toBe(0);
    expect(installFlightSample(at(0, 0), at(9, 9), 5000, 100).progress).toBe(1);
  });
});

describe('idempotencia dos eventos cosmeticos', () => {
  it('o mesmo module_selected reaplicado nao encena duas vezes', () => {
    const field = new ModulePropField();
    field.install('piercing', 0, { space: 'screen', x: 10, y: 10 }, 120, 1000);
    field.install('piercing', 0, { space: 'screen', x: 10, y: 10 }, 120, 1001);
    field.install('piercing', 0, { space: 'screen', x: 10, y: 10 }, 120, 1002);
    expect(field.flightCount).toBe(1);
  });

  it('o mesmo module_expired reaplicado nao cospe dois cartuchos', () => {
    const field = new ModulePropField();
    field.eject('minigun', 0, 5, 5, 300, 1000);
    field.eject('minigun', 0, 5, 5, 300, 1010);
    expect(field.ejectedCount).toBe(1);
  });

  it('mas dois eventos genuinamente distintos continuam sendo dois', () => {
    const field = new ModulePropField();
    // Pegar e depois RECARREGAR o mesmo modulo: ticks diferentes, duas
    // encenacoes. Deduplicar por (slot, modulo) apagaria a segunda.
    field.install('piercing', 0, null, 120, 1000);
    field.install('piercing', 0, null, 460, 2000);
    expect(field.flightCount).toBe(2);
    // Slots diferentes tambem: o parceiro pegando o mesmo modulo e outro voo.
    const other = new ModulePropField();
    other.install('siphon', 0, null, 120, 1000);
    other.install('siphon', 1, null, 120, 1000);
    expect(other.flightCount).toBe(2);
  });
});

describe('tetos e ciclo de vida', () => {
  it('a fila de voos tem teto', () => {
    const field = new ModulePropField();
    for (let i = 0; i < 40; i++) field.install('piercing', 0, null, i, 1000 + i);
    expect(field.flightCount).toBeLessThanOrEqual(MAX_INSTALL_FLIGHTS);
  });

  it('a fila de cartuchos ejetados tem teto', () => {
    const field = new ModulePropField();
    for (let i = 0; i < 40; i++) field.eject('explosive', 0, 1, 1, i, 1000 + i);
    expect(field.ejectedCount).toBeLessThanOrEqual(MAX_EJECTED_PROPS);
  });

  it('o cartucho ejetado quica, assenta e some', () => {
    const field = new ModulePropField();
    field.eject('minigun', 0, 10, 10, 1, 0, 1, 0, 1);
    expect(field.ejectedCount).toBe(1);
    for (let i = 0; i < 400; i++) field.step(16, i * 16);
    expect(field.ejectedCount).toBe(0);
  });

  it('o voo se liquida sozinho depois do clarao de encaixe', () => {
    const field = new ModulePropField();
    const ctx = spyCtx();
    field.install('piercing', 0, { space: 'screen', x: 0, y: 0 }, 1, 0);
    // Passado o tempo do voo, o proximo desenho arma o clarao...
    field.drawScreen(
      ctx,
      INSTALL_FLIGHT_MS + 1,
      () => at(200, 200),
      (o) => at(o.x, o.y),
      at(0, 0),
    );
    field.step(16, INSTALL_FLIGHT_MS + 17);
    expect(field.flightCount).toBe(1);
    // ...e o clarao expira logo depois.
    field.step(16, INSTALL_FLIGHT_MS + 2000);
    expect(field.flightCount).toBe(0);
  });

  it('clear() esvazia as duas filas e a memoria de idempotencia', () => {
    const field = new ModulePropField();
    field.install('piercing', 0, null, 1, 0);
    field.eject('siphon', 0, 1, 1, 1, 0);
    field.clear();
    expect(field.flightCount).toBe(0);
    expect(field.ejectedCount).toBe(0);
    // Depois do clear a mesma chave volta a valer: e uma run nova.
    field.install('piercing', 0, null, 1, 0);
    expect(field.flightCount).toBe(1);
  });
});

describe('recuos: a selecao nunca quebra por falta de imagem', () => {
  it('sem origem visual, o voo vira clarao em vez de sumir', () => {
    const field = new ModulePropField();
    const ctx = spyCtx();
    // Cliente que entrou no meio da run: nao viu o card, nao tem origem.
    field.install('conductive', 0, null, 5, 0);
    field.drawScreen(
      ctx,
      10,
      () => at(300, 300),
      () => null,
      at(20, 20),
    );
    // O voo continua vivo (agora como clarao), e o desenho aconteceu.
    expect(field.flightCount).toBe(1);
    expect(ctx.calls.length).toBeGreaterThan(0);
  });

  it('sem destino resolvivel, o clarao cai na HUD e nada lanca', () => {
    const field = new ModulePropField();
    const ctx = spyCtx();
    field.install('ricochet', 1, { space: 'world', x: 4, y: 4 }, 7, 0);
    expect(() =>
      // Jogador fora da camera (destino nulo) e cofre fora da camera (origem
      // nula): os dois recuos ao mesmo tempo.
      field.drawScreen(
        ctx,
        10,
        () => null,
        () => null,
        at(30, 40),
      ),
    ).not.toThrow();
  });

  it('desenhar sem nada na fila e barato e nao lanca', () => {
    const field = new ModulePropField();
    const ctx = spyCtx();
    field.drawScreen(
      ctx,
      0,
      () => at(0, 0),
      (o) => at(o.x, o.y),
      at(0, 0),
    );
    field.drawWorld(
      ctx,
      (x, y) => [x, y],
      2,
      16,
      () => true,
      0,
    );
    expect(ctx.calls).toHaveLength(0);
  });

  it('o culling da camera impede o desenho do cartucho fora da tela', () => {
    const field = new ModulePropField();
    const ctx = spyCtx();
    field.eject('explosive', 0, 900, 900, 1, 0);
    field.drawWorld(
      ctx,
      (x, y) => [x, y],
      2,
      16,
      () => false,
      0,
    );
    expect(ctx.calls).toHaveLength(0);
  });
});
