import { describe, expect, it } from 'vitest';
import {
  HoldToOpen,
  PAUSE_HOLD_MS,
  PAUSE_SLOP_PX,
  isInPauseZone,
  pauseZoneHeight,
} from '../client/pause';

describe('faixa de topo: onde o toque longo vale', () => {
  it('cobre o topo da tela e nunca a metade de baixo', () => {
    expect(isInPauseZone(4, 800)).toBe(true);
    expect(isInPauseZone(400, 800)).toBe(false);
    expect(isInPauseZone(799, 800)).toBe(false);
  });

  it('para bem acima dos botoes de acao em paisagem de celular', () => {
    // Layout medido de `SurvivalInput.layoutButtons` com altura 380: a fileira
    // de acoes comeca por volta de 150 px do topo. A faixa nao pode encostar.
    const height = 380;
    expect(pauseZoneHeight(height)).toBeLessThan(140);
    expect(isInPauseZone(150, height)).toBe(false);
  });

  it('nao encolhe a ponto de sumir numa tela muito baixa', () => {
    // 200 px de altura e teclado aberto em paisagem; a faixa ainda precisa
    // caber um dedo.
    expect(pauseZoneHeight(200)).toBeGreaterThanOrEqual(48);
  });

  it('tem teto: numa tela alta a faixa nao vira um terco do jogo', () => {
    expect(pauseZoneHeight(2000)).toBe(120);
  });
});

describe('HoldToOpen: o toque longo', () => {
  it('nao completa antes do tempo, e completa depois', () => {
    const hold = new HoldToOpen();
    hold.begin(1, 100, 20, 1000);
    expect(hold.completed(1000 + PAUSE_HOLD_MS - 1)).toBe(false);
    expect(hold.completed(1000 + PAUSE_HOLD_MS)).toBe(true);
  });

  it('completa UMA vez so', () => {
    const hold = new HoldToOpen();
    hold.begin(1, 100, 20, 0);
    expect(hold.completed(9000)).toBe(true);
    expect(hold.completed(9001)).toBe(false); // o menu nao reabre sozinho
  });

  it('tolera o tremor do dedo parado', () => {
    const hold = new HoldToOpen();
    hold.begin(1, 100, 20, 0);
    hold.drag(1, 100 + PAUSE_SLOP_PX - 1, 20);
    expect(hold.completed(PAUSE_HOLD_MS)).toBe(true);
  });

  it('um arrasto cancela: arrastar nao e segurar', () => {
    const hold = new HoldToOpen();
    hold.begin(1, 100, 20, 0);
    hold.drag(1, 100 + PAUSE_SLOP_PX + 1, 20);
    expect(hold.completed(PAUSE_HOLD_MS)).toBe(false);
  });

  it('ignora o movimento de OUTRO dedo', () => {
    // Dois dedos na tela e o normal aqui: um no joystick, outro segurando o
    // topo. O que anda no joystick nao pode cancelar o que esta parado.
    const hold = new HoldToOpen();
    hold.begin(1, 100, 20, 0);
    hold.drag(2, 900, 900);
    expect(hold.completed(PAUSE_HOLD_MS)).toBe(true);
  });

  it('soltar antes da hora cancela', () => {
    const hold = new HoldToOpen();
    hold.begin(1, 100, 20, 0);
    hold.end(1);
    expect(hold.completed(PAUSE_HOLD_MS)).toBe(false);
  });

  it('soltar OUTRO dedo nao cancela', () => {
    const hold = new HoldToOpen();
    hold.begin(1, 100, 20, 0);
    hold.end(2);
    expect(hold.completed(PAUSE_HOLD_MS)).toBe(true);
  });

  it('pending descreve o gesto em andamento', () => {
    const hold = new HoldToOpen();
    expect(hold.pending).toBe(false);
    hold.begin(1, 100, 20, 0);
    expect(hold.pending).toBe(true);
    hold.completed(PAUSE_HOLD_MS);
    expect(hold.pending).toBe(false); // ja disparou; nao ha mais o que esperar
  });

  it('cancel devolve o gesto ao repouso e o proximo toque comeca limpo', () => {
    const hold = new HoldToOpen();
    hold.begin(1, 100, 20, 0);
    hold.cancel();
    expect(hold.completed(9000)).toBe(false);
    hold.begin(2, 100, 20, 10_000);
    expect(hold.completed(10_000 + PAUSE_HOLD_MS)).toBe(true);
  });
});
