// A rotacao reconstruida no cliente.
//
// O que esta sob teste e a promessa do co-op: o parceiro remoto nao recebe
// `minigun` no snapshot, e mesmo assim tem de PARECER estar usando a arma. A
// reconstrucao vale enquanto reancorar nas transicoes e enquanto a rampa
// local for a mesma da simulacao — e as duas coisas sao o que se confere aqui.

import { describe, expect, it } from 'vitest';
import { MINIGUN_SPIN_MAX, MINIGUN_SPIN_UP_PER_TICK, TICK_HZ } from '@voxelyn/survival-sim';
import { MinigunViews, MUZZLE_FLASH_WINDOW_MS, advanceSpin, spinRises } from './minigun-view';

const TICK_MS = 1000 / TICK_HZ;

describe('rampa reconstruida', () => {
  it('sobe em spinning_up e em firing, desce no resto', () => {
    expect(spinRises('spinning_up')).toBe(true);
    expect(spinRises('firing')).toBe(true);
    expect(spinRises('spinning_down')).toBe(false);
    expect(spinRises('overheated')).toBe(false);
    expect(spinRises('idle')).toBe(false);
  });

  it('um tick de subida vale o MESMO que na simulacao', () => {
    const afterOne = advanceSpin(0, 'spinning_up', TICK_MS);
    expect(afterOne).toBeCloseTo(MINIGUN_SPIN_UP_PER_TICK / MINIGUN_SPIN_MAX, 6);
  });

  it('chega ao mesmo lugar a 30 e a 120 quadros por segundo', () => {
    let slow = 0;
    for (let i = 0; i < 21; i++) slow = advanceSpin(slow, 'spinning_up', 1000 / 30);
    let fast = 0;
    for (let i = 0; i < 84; i++) fast = advanceSpin(fast, 'spinning_up', 1000 / 120);
    expect(slow).toBeCloseTo(fast, 5);
  });

  it('satura nas duas pontas', () => {
    expect(advanceSpin(1, 'firing', 5000)).toBe(1);
    expect(advanceSpin(0.2, 'spinning_down', 5000)).toBe(0);
  });

  it('um quadro enorme (aba que voltou) nao explode a rampa', () => {
    // O passo e limitado, entao o motor sobe no maximo um pedaco da curva em
    // vez de saltar para o topo com a arma parada.
    expect(advanceSpin(0, 'spinning_up', 60000)).toBeLessThanOrEqual(1);
    expect(advanceSpin(0, 'spinning_up', 60000)).toBeGreaterThan(0);
  });
});

describe('registro por slot', () => {
  it('um slot que nunca foi visto le como parado', () => {
    const views = new MinigunViews();
    expect(views.get(3).spin).toBe(0);
    expect(views.get(3).phase).toBe('idle');
  });

  it('a transicao reancora rotacao e fase', () => {
    const views = new MinigunViews();
    views.applySpin(1, 'firing', MINIGUN_SPIN_MAX);
    expect(views.get(1).spin).toBe(1);
    expect(views.get(1).phase).toBe('firing');
  });

  it('integra entre transicoes e para quando a fase muda', () => {
    const views = new MinigunViews();
    views.applySpin(0, 'spinning_up', 0);
    for (let i = 0; i < 14; i++) views.step(TICK_MS);
    expect(views.get(0).spin).toBeGreaterThan(0.9);
    views.applySpin(0, 'spinning_down', MINIGUN_SPIN_MAX);
    for (let i = 0; i < 12; i++) views.step(TICK_MS);
    expect(views.get(0).spin).toBe(0);
  });

  it('o valor autoritativo do slot local vence a integracao', () => {
    const views = new MinigunViews();
    views.applySpin(0, 'spinning_up', 0);
    for (let i = 0; i < 5; i++) views.step(TICK_MS);
    views.applyAuthoritative(0, 'overheated', 0);
    expect(views.get(0).spin).toBe(0);
    expect(views.get(0).phase).toBe('overheated');
  });

  it('a rajada reancora e acende o clarao de boca por uma janela', () => {
    const views = new MinigunViews();
    views.applyBurst(0, 3, MINIGUN_SPIN_MAX, 1000);
    expect(views.get(0).spin).toBe(1);
    expect(views.firingFlash(0, 1000)).toBeGreaterThan(0);
    // Dentro da janela ainda acende; fora dela, apaga.
    expect(views.firingFlash(0, 1000 + MUZZLE_FLASH_WINDOW_MS / 2)).toBeGreaterThan(0);
    expect(views.firingFlash(0, 1000 + MUZZLE_FLASH_WINDOW_MS + 1)).toBe(0);
  });

  it('o clarao cobre o intervalo entre rajadas, para nao piscar a 5 Hz', () => {
    // O evento sai a cada quatro ticks (200 ms). Uma janela menor que isso
    // mostraria a cadencia do EVENTO, que e detalhe de implementacao.
    expect(MUZZLE_FLASH_WINDOW_MS).toBeGreaterThan(200);
  });

  it('slots sao independentes e clear() esquece todos', () => {
    const views = new MinigunViews();
    views.applySpin(0, 'firing', MINIGUN_SPIN_MAX);
    expect(views.get(1).spin).toBe(0);
    views.clear();
    expect(views.get(0).spin).toBe(0);
  });
});
