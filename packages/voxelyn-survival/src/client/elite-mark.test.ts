// A MARCA DO ELITE, do lado de quem a ve.
//
// O que estes testes protegem:
//
// 1. A MARCA ESCURECE, NAO PINTA. O veu laranja chapado que morava aqui apagava
//    as faces do voxel; o carvao tem de continuar sendo a metade mais escura e
//    mais opaca da respiracao, e a brasa a mais fraca.
// 2. TUDO CABE NO RASTRO DO PE. A marca promete a celula que a criatura ocupa;
//    uma brasa fora do anel mentiria sobre onde o corpo esta.
// 3. O HEXAGONO E QUEIMADO, NAO DESENHADO: fica parado (girar seria runa de
//    magia), cabe no rastro do pe, tem as quinas ABERTAS e nenhum lado apaga de
//    vez — um lado apagado abriria um buraco e a celula deixaria de ser lida.
// 4. O CALOR SOBE. Toda brasa so anda para cima dentro de uma vida, e a vida
//    recomeca do chao — uma unica vez por ciclo.
// 5. NINGUEM RESPIRA EM UNISSONO. Duas criaturas com IDs diferentes estao em
//    fases diferentes; a mesma criatura no mesmo instante desenha sempre a
//    mesma marca (duas maquinas de uma sala de co-op veem o mesmo bicho).
// 6. MOVIMENTO REDUZIDO PARA A MARCA, e nao a apaga: continua havendo elite na
//    tela, so nao ha pulso.
import { describe, expect, it } from 'vitest';
import {
  ELITE_EMBERS,
  ELITE_HEX_SIDES,
  ELITE_RING_RX,
  ELITE_RING_RY,
  ELITE_TINT_CHAR,
  ELITE_TINT_EMBER,
  eliteBreath,
  eliteEmbers,
  eliteHex,
  eliteHexCorners,
  eliteRim,
  eliteTint,
} from './elite-mark';

const SIZE = 24;
const luma = (color: string): number => {
  const [r, g, b] = [1, 3, 5].map((i) => Number.parseInt(color.slice(i, i + 2), 16));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

describe('a respiracao do elite', () => {
  it('anda entre carvao e brasa, e volta', () => {
    const seen: number[] = [];
    for (let t = 0; t < 5200; t += 40) seen.push(eliteBreath(t, 3, false));
    expect(Math.min(...seen)).toBeLessThan(0.05);
    expect(Math.max(...seen)).toBeGreaterThan(0.95);
    for (const v of seen) expect(v).toBeGreaterThanOrEqual(0);
    for (const v of seen) expect(v).toBeLessThanOrEqual(1);
  });

  it('duas criaturas nao respiram juntas, e a mesma criatura e sempre igual', () => {
    const fases = new Set<string>();
    for (let id = 1; id <= 6; id++) fases.add(eliteBreath(500, id, false).toFixed(4));
    expect(fases.size).toBeGreaterThan(4);
    expect(eliteBreath(500, 4, false)).toBe(eliteBreath(500, 4, false));
  });

  it('para no meio do caminho com movimento reduzido', () => {
    expect(eliteBreath(0, 9, true)).toBe(eliteBreath(4321, 9, true));
  });
});

describe('o tint do corpo', () => {
  it('escurece: o carvao e mais escuro E mais opaco que a brasa', () => {
    // A metade escura pode carregar mais alpha porque baixar todas as faces
    // juntas preserva a rampa do voxel; clarear apaga, e por isso a brasa entra
    // fraca. Se um dia isto se inverter, o elite volta a ser um veu chapado.
    let carvao = eliteTint(0, 1, false);
    let brasa = carvao;
    for (let t = 0; t < 5200; t += 20) {
      const tint = eliteTint(t, 1, false);
      if (tint.alpha > carvao.alpha) carvao = tint;
      if (tint.alpha < brasa.alpha) brasa = tint;
    }
    expect(carvao.alpha).toBeCloseTo(ELITE_TINT_CHAR, 2);
    expect(brasa.alpha).toBeCloseTo(ELITE_TINT_EMBER, 2);
    expect(luma(carvao.color)).toBeLessThan(luma(brasa.color));
  });

  it('nunca chega a opacidade do veu antigo', () => {
    // 0.35 era o veu laranja chapado. A marca nova conta elite pelo contraste e
    // pelo chao, e nao afogando o corpo numa cor so.
    for (let t = 0; t < 5200; t += 20) {
      expect(eliteTint(t, 2, false).alpha).toBeLessThanOrEqual(ELITE_TINT_CHAR);
    }
  });
});

describe('o contorno aceso', () => {
  it('acende junto com a respiracao e nunca fecha em opaco', () => {
    const frio = eliteRim(0, 5, true);
    expect(frio.alpha).toBeGreaterThan(0);
    expect(frio.alpha).toBeLessThan(1);
    const amostras = [];
    for (let t = 0; t < 5200; t += 40) amostras.push(eliteRim(t, 5, false));
    const forte = amostras.reduce((a, b) => (a.alpha > b.alpha ? a : b));
    const fraco = amostras.reduce((a, b) => (a.alpha < b.alpha ? a : b));
    expect(forte.alpha).toBeLessThan(1);
    // Mais aceso e tambem mais claro: e a mesma brasa subindo, nao duas cores.
    expect(luma(forte.color)).toBeGreaterThan(luma(fraco.color));
  });
});

describe('o hexagono queimado', () => {
  it('tem seis lados e cabe no rastro do pe', () => {
    const edges = eliteHex(SIZE, 900, 4, false);
    expect(edges).toHaveLength(ELITE_HEX_SIDES);
    for (const e of edges) {
      for (const [x, y] of [
        [e.x0, e.y0],
        [e.x1, e.y1],
      ]) {
        // Dentro da elipse do rastro, com folga de arredondamento.
        const r = (x / (SIZE * ELITE_RING_RX)) ** 2 + (y / (SIZE * ELITE_RING_RY)) ** 2;
        expect(r).toBeLessThanOrEqual(1.001);
      }
    }
  });

  it('as quinas ficam ABERTAS: nenhum lado encosta na quina', () => {
    const corners = eliteHexCorners(SIZE);
    expect(corners).toHaveLength(ELITE_HEX_SIDES);
    for (const e of eliteHex(SIZE, 900, 4, false)) {
      const perto = corners.some(
        ([cx, cy]) =>
          Math.hypot(cx - e.x0, cy - e.y0) < 0.5 || Math.hypot(cx - e.x1, cy - e.y1) < 0.5,
      );
      expect(perto).toBe(false);
    }
  });

  it('nao gira: so o calor muda com o tempo', () => {
    const a = eliteHex(SIZE, 0, 4, false);
    const b = eliteHex(SIZE, 1234, 4, false);
    a.forEach((e, i) => {
      expect([e.x0, e.y0, e.x1, e.y1]).toEqual([b[i].x0, b[i].y0, b[i].x1, b[i].y1]);
    });
    expect(a.map((e) => e.heat)).not.toEqual(b.map((e) => e.heat));
  });

  it('nenhum lado apaga de vez, e nem todos acendem juntos', () => {
    const heats: number[][] = [];
    for (let t = 0; t < 3000; t += 60) heats.push(eliteHex(SIZE, t, 4, false).map((e) => e.heat));
    for (const linha of heats) for (const h of linha) expect(h).toBeGreaterThan(0.4);
    for (const linha of heats) for (const h of linha) expect(h).toBeLessThanOrEqual(1.0001);
    // Em algum instante ha lados claramente em fases diferentes.
    const espalhamento = heats.map((l) => Math.max(...l) - Math.min(...l));
    expect(Math.max(...espalhamento)).toBeGreaterThan(0.3);
  });

  it('com movimento reduzido o calor congela', () => {
    expect(eliteHex(SIZE, 0, 4, true)).toEqual(eliteHex(SIZE, 9999, 4, true));
  });
});

describe('as brasas', () => {
  it('nascem dentro do anel e so sobem', () => {
    for (const ember of eliteEmbers(SIZE, 900, 4, false)) {
      expect(Math.abs(ember.dx)).toBeLessThanOrEqual(SIZE * ELITE_RING_RX);
      expect(ember.alpha).toBeGreaterThanOrEqual(0);
      expect(ember.alpha).toBeLessThanOrEqual(1);
      expect(ember.size).toBeGreaterThan(0);
    }
  });

  it('cada brasa sobe sem parar e renasce no chao uma vez por ciclo', () => {
    for (let i = 0; i < ELITE_EMBERS; i++) {
      let renascimentos = 0;
      let anterior = eliteEmbers(SIZE, 0, 4, false)[i].dy;
      for (let t = 25; t <= 1750; t += 25) {
        const atual = eliteEmbers(SIZE, t, 4, false)[i].dy;
        if (atual > anterior) renascimentos++;
        anterior = atual;
      }
      expect(renascimentos).toBe(1);
    }
  });

  it('sobem dos dois lados do corpo: ha brasa atras e brasa na frente', () => {
    const lados = new Set<boolean>();
    for (let id = 1; id <= 8; id++)
      for (const ember of eliteEmbers(SIZE, 300, id, false)) lados.add(ember.front);
    expect(lados.size).toBe(2);
  });

  it('congelam espalhadas com movimento reduzido, em vez de sumir', () => {
    const parado = eliteEmbers(SIZE, 0, 4, true);
    expect(eliteEmbers(SIZE, 3000, 4, true)).toEqual(parado);
    expect(parado.some((e) => e.alpha > 0.2)).toBe(true);
    // Espalhadas: nenhuma altura repetida, senao seriam uma fileira so.
    expect(new Set(parado.map((e) => e.dy.toFixed(3))).size).toBe(ELITE_EMBERS);
  });
});
