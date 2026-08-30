// A rotacao reconstruida no cliente.
//
// O que esta sob teste e a promessa do co-op: o parceiro remoto nao recebe
// `minigun` no snapshot, e mesmo assim tem de PARECER estar usando a arma. A
// reconstrucao vale enquanto reancorar nas transicoes e enquanto a rampa
// local for a mesma da simulacao — e as duas coisas sao o que se confere aqui.

import { describe, expect, it } from 'vitest';
import { MINIGUN_SPIN_MAX, MINIGUN_SPIN_UP_PER_TICK, TICK_HZ } from '@voxelyn/survival-sim';
import {
  BARREL_TURNS_PER_SECOND,
  MinigunViews,
  MUZZLE_FLASH_WINDOW_MS,
  advanceBarrelPhase,
  advanceSpin,
  spinRises,
} from './minigun-view';

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

describe('angulo dos canos — velocidade NAO e angulo', () => {
  // A regressao que este bloco tranca: `spin` SATURA em 1 durante a rajada
  // inteira. Qualquer desenho que a use como fase congela exatamente no
  // trecho em que os canos giram mais rapido — o oposto do que a arma promete.
  it('o angulo continua andando com a velocidade saturada', () => {
    let phase = 0;
    const seen = new Set<number>();
    for (let i = 0; i < 60; i++) {
      phase = advanceBarrelPhase(phase, 1, 1000 / 60);
      seen.add(Math.floor(phase * 8) % 4);
    }
    // Um segundo de rajada cheia passa pelos QUATRO arranjos de cano, e nao
    // por um so.
    expect(seen.size).toBe(4);
  });

  it('da BARREL_TURNS_PER_SECOND voltas por segundo na rotacao maxima', () => {
    let turns = 0;
    let phase = 0;
    for (let i = 0; i < 120; i++) {
      const next = advanceBarrelPhase(phase, 1, 1000 / 120);
      if (next < phase) turns++;
      phase = next;
    }
    expect(turns).toBe(BARREL_TURNS_PER_SECOND);
  });

  it('para quando a rotacao para, e desacelera junto com ela', () => {
    expect(advanceBarrelPhase(0.3, 0, 500)).toBe(0.3);
    const fast = advanceBarrelPhase(0, 1, 100);
    const slow = advanceBarrelPhase(0, 0.25, 100);
    expect(slow).toBeLessThan(fast);
    expect(slow).toBeGreaterThan(0);
  });

  it('envolve em 0..1 em vez de crescer sem teto', () => {
    let phase = 0;
    for (let i = 0; i < 2000; i++) phase = advanceBarrelPhase(phase, 1, 16);
    expect(phase).toBeGreaterThanOrEqual(0);
    expect(phase).toBeLessThan(1);
  });

  it('o registro integra o angulo por slot enquanto a velocidade satura', () => {
    const views = new MinigunViews();
    views.applyAuthoritative(0, 'firing', MINIGUN_SPIN_MAX);
    const start = views.get(0).barrelPhase;
    for (let i = 0; i < 6; i++) {
      views.step(1000 / 60);
      views.applyAuthoritative(0, 'firing', MINIGUN_SPIN_MAX);
    }
    expect(views.get(0).spin).toBe(1);
    expect(views.get(0).barrelPhase).not.toBe(start);
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

  it('a rajada sozinha ja poe a view em firing', () => {
    // Cliente que entra (ou reconecta) com o parceiro ja atirando: o
    // `full_resync` nao carrega eventos e o snapshot do parceiro nao carrega
    // `minigun`, entao a transicao `minigun_spin` nunca chegou. Se a rajada
    // nao afirmasse a fase, a view nasceria em `idle` e `step()`
    // DESACELERARIA entre uma rajada e a seguinte — os canos do parceiro
    // cairiam e saltariam cinco vezes por segundo, para sempre.
    const views = new MinigunViews();
    views.applyBurst(0, 4, MINIGUN_SPIN_MAX, 1000);
    expect(views.get(0).phase).toBe('firing');

    // Uma janela inteira entre rajadas (200 ms) sem perder rotacao.
    for (let i = 0; i < 12; i++) views.step(1000 / 60);
    expect(views.get(0).spin).toBe(1);
  });

  it('slots sao independentes e clear() esquece todos', () => {
    const views = new MinigunViews();
    views.applySpin(0, 'firing', MINIGUN_SPIN_MAX);
    expect(views.get(1).spin).toBe(0);
    views.clear();
    expect(views.get(0).spin).toBe(0);
  });
});
