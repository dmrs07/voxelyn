import { describe, expect, it } from 'vitest';
import { MAX_FLASHES, addFlash, flashPower, pruneFlashes, type Flash } from './flash';

const flash = (startedMs: number, power = 1, durationMs = 200): Flash => ({
  x: 0, y: 0, r: 4, power, startedMs, durationMs, hex: '#ff7a2f',
});

describe('clarões de evento', () => {
  it('acende com forca cheia e chega a zero no fim', () => {
    const f = flash(1000);
    expect(flashPower(f, 1000)).toBe(1);
    expect(flashPower(f, 1200)).toBe(0);
    expect(flashPower(f, 5000)).toBe(0);
  });

  // Decaimento linear le como interruptor desligando; fogo se apagando entrega
  // quase todo o brilho no comeco e some devagar no fim.
  it('decai mais rapido no comeco do que no fim', () => {
    const f = flash(0);
    const meio = flashPower(f, 100);
    expect(meio).toBeCloseTo(0.25, 5);
    expect(meio).toBeLessThan(0.5); // seria 0.5 exato se fosse linear
    expect(flashPower(f, 50) - flashPower(f, 100)).toBeGreaterThan(
      flashPower(f, 100) - flashPower(f, 150)
    );
  });

  it('nunca devolve forca negativa nem acima da declarada', () => {
    const f = flash(1000, 0.75);
    for (const t of [0, 999, 1000, 1100, 1199, 1200, 9999]) {
      const p = flashPower(f, t);
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThanOrEqual(0.75);
    }
  });

  it('descarta os que ja apagaram e preserva a ordem de chegada', () => {
    const list = [flash(0), flash(150), flash(300)];
    const vivos = pruneFlashes(list, 320);
    expect(vivos.map((f) => f.startedMs)).toEqual([150, 300]);
  });

  // Recusar o clarao NOVO tambem respeitaria o teto e estaria errado: numa
  // cadeia de detonacoes a que importa e a ultima, provavelmente em cima do
  // jogador — descartar a nova deixaria justamente essa no escuro.
  it('respeita o teto descartando o MAIS VELHO', () => {
    const list: Flash[] = [];
    for (let i = 0; i < MAX_FLASHES + 4; i++) addFlash(list, flash(i * 10));
    expect(list.length).toBe(MAX_FLASHES);
    expect(list[list.length - 1].startedMs).toBe((MAX_FLASHES + 3) * 10);
    expect(list[0].startedMs).toBe(40);
  });

  it('mantem o teto mesmo partindo de uma lista ja estourada', () => {
    const list: Flash[] = [];
    for (let i = 0; i < MAX_FLASHES + 5; i++) list.push(flash(i));
    addFlash(list, flash(999));
    expect(list.length).toBe(MAX_FLASHES);
    expect(list[list.length - 1].startedMs).toBe(999);
  });
});
