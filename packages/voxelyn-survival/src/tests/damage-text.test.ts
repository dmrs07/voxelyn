import { describe, expect, it } from 'vitest';
import { DAMAGE_FAN, damageAlpha, damageScale } from '../client/damage-text';

describe('numeros de dano', () => {
  // Desvanecer desde o quadro zero — como fazia — gasta em transparencia
  // exatamente o instante em que o jogador esta olhando para o golpe.
  it('segura opaco na primeira metade e so entao some', () => {
    expect(damageAlpha(0)).toBe(1);
    expect(damageAlpha(0.4)).toBe(1);
    expect(damageAlpha(0.55)).toBe(1);
    expect(damageAlpha(1)).toBeCloseTo(0);
    expect(damageAlpha(0.8)).toBeLessThan(1);
    expect(damageAlpha(0.8)).toBeGreaterThan(0);
  });

  it('prende a opacidade fora da faixa', () => {
    expect(damageAlpha(-1)).toBe(1);
    expect(damageAlpha(2)).toBeCloseTo(0);
  });

  it('cresce com o dano', () => {
    expect(damageScale(30)).toBeGreaterThan(damageScale(5));
    expect(damageScale(5)).toBeGreaterThan(damageScale(1));
  });

  // Linear, um golpe de 40 sairia sete vezes maior que um de 6 e taparia a
  // tela em vez de informar.
  it('achata o crescimento e tem teto', () => {
    expect(damageScale(9999)).toBeLessThanOrEqual(1.9);
    // Dobrar o dano nao pode dobrar o tamanho.
    expect(damageScale(40) / damageScale(20)).toBeLessThan(1.5);
  });

  it('nunca some nem inverte com dano degenerado', () => {
    for (const d of [0, -5, -9999]) expect(damageScale(d)).toBeGreaterThan(0);
    // Dano negativo nao pode gerar NaN via Math.sqrt.
    expect(damageScale(-5)).toBeCloseTo(0.9);
    expect(damageScale(0)).toBeCloseTo(0.9);
  });

  // Sem espalhamento, uma rajada no mesmo alvo desenha varios numeros
  // exatamente sobrepostos — o resultado nao e um numero grande, e um borrao.
  it('espalha acertos seguidos para os dois lados, sem repetir em sequencia', () => {
    expect(DAMAGE_FAN.length).toBeGreaterThan(3);
    expect(DAMAGE_FAN.some((v) => v > 0)).toBe(true);
    expect(DAMAGE_FAN.some((v) => v < 0)).toBe(true);
    for (let i = 1; i < DAMAGE_FAN.length; i++) {
      expect(DAMAGE_FAN[i], `posicao ${i}`).not.toBe(DAMAGE_FAN[i - 1]);
    }
    // Fecha o ciclo sem colidir com o inicio.
    expect(DAMAGE_FAN[DAMAGE_FAN.length - 1]).not.toBe(DAMAGE_FAN[0]);
  });

  it('mantem o leque dentro de um tile, para o numero nao descolar do alvo', () => {
    for (const v of DAMAGE_FAN) expect(Math.abs(v)).toBeLessThan(0.5);
  });
});
