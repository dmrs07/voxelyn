// A parabola do salto do Devorador.
//
// Ela vive no cliente porque altura nao decide nada na simulacao — nao ha
// colisao em z. O que estes testes protegem e o contrato com a simulacao: as
// duas pontas do arco tem de tocar o chao nos MESMOS ticks em que as crateras
// acontecem, e nada aqui pode produzir NaN ou altura negativa a partir de um
// snapshot atrasado.
import { describe, expect, it } from 'vitest';
import {
  leapHeight,
  leapProgress,
  leapShadowAlpha,
  leapShadowScale,
} from '../client/leap-arc';

describe('a parabola do arco', () => {
  it('toca o chao nas duas pontas e sobe no meio', () => {
    expect(leapHeight(0)).toBe(0);
    expect(leapHeight(1)).toBe(0);
    expect(leapHeight(0.5)).toBeCloseTo(1, 6);
    // Simetrica: subir e descer levam o mesmo tempo.
    expect(leapHeight(0.25)).toBeCloseTo(leapHeight(0.75), 6);
  });

  it('nunca afunda o corpo no chao, mesmo com o tick fora da faixa', () => {
    // Um snapshot atrasado entrega tick alem do fim do arco. Extrapolar a
    // parabola daria altura NEGATIVA — o chefe desaparecendo por baixo do piso
    // no ultimo quadro do salto.
    for (const p of [-3, -0.2, 1.0001, 2, 40]) {
      expect(leapHeight(p), `progresso ${p}`).toBe(0);
    }
  });

  it('sobe monotonicamente ate o apice e desce dali', () => {
    for (let p = 0.05; p <= 0.5; p += 0.05) {
      expect(leapHeight(p)).toBeGreaterThan(leapHeight(p - 0.05));
    }
    for (let p = 0.55; p <= 0.95; p += 0.05) {
      expect(leapHeight(p)).toBeLessThan(leapHeight(p - 0.05));
    }
  });
});

describe('o progresso sai do vao da acao', () => {
  it('vai de 0 a 1 entre o inicio e o fim do voo', () => {
    expect(leapProgress(100, 100, 120)).toBe(0);
    expect(leapProgress(110, 100, 120)).toBeCloseTo(0.5, 6);
    expect(leapProgress(120, 100, 120)).toBe(1);
  });

  it('prende fora da faixa em vez de extrapolar', () => {
    expect(leapProgress(80, 100, 120)).toBe(0);
    expect(leapProgress(400, 100, 120)).toBe(1);
  });

  it('um vao nulo devolve 0, e nunca NaN', () => {
    // Divisao por zero aqui viraria uma coordenada invalida no `drawImage`, que
    // apaga o sprite sem erro nenhum no console.
    expect(leapProgress(100, 100, 100)).toBe(0);
    expect(leapProgress(100, 120, 100)).toBe(0);
    expect(Number.isNaN(leapProgress(100, 100, 100))).toBe(false);
  });
});

describe('a sombra e quem conta a altura', () => {
  // Em projecao isometrica sem perspectiva, subir e afastar-se desenham o mesmo
  // deslocamento na tela. Sem a sombra encolhendo, o salto seria indistinguivel
  // de um passo para longe — daí ela nao ser enfeite.
  it('encolhe e clareia conforme o corpo sobe', () => {
    expect(leapShadowScale(0)).toBe(1);
    expect(leapShadowScale(1)).toBeLessThan(leapShadowScale(0));
    expect(leapShadowAlpha(1)).toBeLessThan(leapShadowAlpha(0));
  });

  it('nunca some por completo: o chefe sempre tem lugar no chao', () => {
    for (const h of [0, 0.5, 1, 4, -2]) {
      expect(leapShadowScale(h), `altura ${h}`).toBeGreaterThan(0.4);
      expect(leapShadowAlpha(h), `altura ${h}`).toBeGreaterThan(0.15);
    }
  });
});
