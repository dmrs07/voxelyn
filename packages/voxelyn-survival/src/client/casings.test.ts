import { describe, expect, it } from 'vitest';
import { CasingField, MAX_CASINGS_PER_PLAYER, casingsForBurst } from './casings';

// O que este arquivo protege nao e a aparencia do latao — e o TETO. Uma
// Minigun despeja 300 balas por cartucho e o jogo tem dois Prospectors: sem
// pool e sem limite, uma run longa deixaria centenas de objetos vivos num
// aparelho movel. Aqui se confere que o numero de capsulas vivas nao cresce,
// que a memoria e alocada uma vez, e que o ciclo de vida termina.

const burst = (field: CasingField, slot = 0, rounds = 4, seed = 1): void => {
  field.emitBurst(slot, 10, 10, 1, 0, rounds, seed, 1);
};

describe('capsulas — amostragem', () => {
  it('uma rajada cospe um punhado, nunca uma capsula por bala', () => {
    // O olho le DENSIDADE, nao contagem: oito balas em 200 ms nao podem virar
    // oito objetos, ou o teto por jogador estoura em duas rajadas.
    expect(casingsForBurst(8, 1)).toBeLessThan(8);
    expect(casingsForBurst(1, 1)).toBeGreaterThanOrEqual(1);
    // Mais balas, mais latao — so que devagar.
    expect(casingsForBurst(9, 1)).toBeGreaterThan(casingsForBurst(2, 1));
  });

  it('a qualidade baixa entrega menos materia do MESMO evento', () => {
    expect(casingsForBurst(9, 0.4)).toBeLessThan(casingsForBurst(9, 1));
    // Nunca zero: uma rajada sem nenhuma capsula leria como arma quebrada.
    expect(casingsForBurst(9, 0.05)).toBeGreaterThanOrEqual(1);
  });
});

describe('capsulas — pool e teto', () => {
  it('respeita o teto por jogador mesmo com rajadas sem fim', () => {
    const field = new CasingField();
    for (let i = 0; i < 200; i++) burst(field, 0, 8, i + 1);
    expect(field.countFor(0)).toBeLessThanOrEqual(MAX_CASINGS_PER_PLAYER);
  });

  it('dois jogadores atirando nao passam do teto global', () => {
    const field = new CasingField();
    for (let i = 0; i < 200; i++) {
      burst(field, 0, 8, i + 1);
      burst(field, 1, 8, i + 500);
    }
    expect(field.count).toBeLessThanOrEqual(MAX_CASINGS_PER_PLAYER * 2);
    expect(field.countFor(0)).toBeLessThanOrEqual(MAX_CASINGS_PER_PLAYER);
    expect(field.countFor(1)).toBeLessThanOrEqual(MAX_CASINGS_PER_PLAYER);
  });

  it('o teto de um jogador nao rouba as capsulas do outro', () => {
    const field = new CasingField();
    for (let i = 0; i < 200; i++) burst(field, 0, 8, i + 1);
    const mine = field.countFor(0);
    burst(field, 1, 4, 9999);
    expect(field.countFor(1)).toBeGreaterThan(0);
    // O slot 0 pode ter reciclado as PROPRIAS, nunca perdido para o vizinho.
    expect(field.countFor(0)).toBe(mine);
  });

  it('a populacao volta a zero quando a vida acaba', () => {
    const field = new CasingField();
    for (let i = 0; i < 20; i++) burst(field, 0, 6, i + 1);
    expect(field.count).toBeGreaterThan(0);
    // Cinco segundos de passos: mais que a vida maxima de qualquer capsula.
    for (let i = 0; i < 300; i++) field.step(16);
    expect(field.count).toBe(0);
  });

  it('assenta no chao: nada afunda nem quica para sempre', () => {
    const field = new CasingField();
    burst(field, 0, 4, 7);
    for (let i = 0; i < 400; i++) field.step(16);
    // Sobreviver a mil quiques seria o sintoma de um quique sem perda; a
    // populacao zerada prova que todas assentaram e expiraram.
    expect(field.count).toBe(0);
  });

  it('clear() esvazia tudo, inclusive a contagem por jogador', () => {
    const field = new CasingField();
    burst(field, 0, 8, 1);
    burst(field, 1, 8, 2);
    field.clear();
    expect(field.count).toBe(0);
    expect(field.countFor(0)).toBe(0);
    expect(field.countFor(1)).toBe(0);
  });

  it('um passo enorme (aba que voltou) nao teleporta latao pelo mapa', () => {
    const field = new CasingField();
    burst(field, 0, 4, 3);
    const before = field.count;
    // Trinta segundos num quadro: a vida cobra o intervalo inteiro, e o
    // MOVIMENTO e limitado — a capsula expira em vez de aparecer noutra sala.
    field.step(30000);
    expect(field.count).toBeLessThan(before);
  });
});
