import { describe, expect, it } from 'vitest';
import { RestartGate } from '../client/restart';

describe('RestartGate: reiniciar a run', () => {
  it('durante a run manda drenar toques e nunca arma o reinicio', () => {
    const gate = new RestartGate(900);
    for (let t = 0; t < 5; t++) {
      const r = gate.frame(t * 16, false);
      expect(r.drain).toBe(true); // toques de gameplay sao descartados
      expect(r.armed).toBe(false);
    }
  });

  it('o primeiro frame da tela de fim descarta os toques da run', () => {
    const gate = new RestartGate(900);
    gate.frame(0, false);
    const first = gate.frame(1000, true);
    expect(first.drain).toBe(true); // antes: um toque antigo reiniciava na hora
    expect(first.armed).toBe(false);
  });

  it('so arma depois da janela minima de leitura da tela de fim', () => {
    const gate = new RestartGate(900);
    gate.frame(1000, true); // morte
    expect(gate.frame(1500, true).armed).toBe(false); // 500ms: cedo demais
    expect(gate.frame(1899, true).armed).toBe(false);
    expect(gate.frame(1900, true).armed).toBe(true); // 900ms depois
  });

  it('reset rearma a porta para a proxima morte', () => {
    const gate = new RestartGate(900);
    gate.frame(1000, true);
    expect(gate.frame(2000, true).armed).toBe(true);
    gate.reset(); // jogador reiniciou
    gate.frame(2001, true);
    expect(gate.frame(2100, true).armed).toBe(false); // conta de novo do zero
  });

  it('voltar a rodar zera a contagem', () => {
    const gate = new RestartGate(900);
    gate.frame(1000, true);
    gate.frame(1100, false); // nova run
    const back = gate.frame(1200, true); // morreu de novo
    expect(back.armed).toBe(false);
    expect(gate.frame(2200, true).armed).toBe(true);
  });
});
