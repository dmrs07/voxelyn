import { describe, expect, it } from 'vitest';
import { faceColorMatrix, orderFacesForDraw } from '../client/face-light';

/**
 * A matriz de cor e a conta inteira da iluminacao por pixel: ela recebe as tres
 * MASCARAS de face (vermelho topo, verde esquerda, azul direita) e devolve a
 * soma das tres luzes. Um erro de coluna aqui ilumina o ombro esquerdo quando a
 * tocha esta a direita, e o defeito seria indistinguivel de "a luz esta
 * estranha" — por isso as colunas sao cobradas uma a uma.
 */

const rows = (values: string): number[][] => {
  const n = values.split(/\s+/).map(Number);
  return [n.slice(0, 5), n.slice(5, 10), n.slice(10, 15), n.slice(15, 20)];
};

const dark = { color: 'rgb(0,0,0)', alpha: 0 };

describe('matriz de cor das faces', () => {
  it('tem vinte valores, em quatro linhas de cinco', () => {
    const values = faceColorMatrix([dark, dark, dark]);
    expect(values.split(/\s+/)).toHaveLength(20);
    expect(rows(values)).toHaveLength(4);
  });

  /**
   * O ALPHA passa intacto. A silhueta do mapa de faces e a do sprite; mexer
   * nesta linha abriria ou fecharia o corpo em vez de ilumina-lo.
   */
  it('deixa o alpha passar sem tocar nele', () => {
    const [, , , alphaRow] = rows(faceColorMatrix([
      { color: 'rgb(255,128,0)', alpha: 1 },
      { color: 'rgb(0,255,0)', alpha: 1 },
      { color: 'rgb(0,0,255)', alpha: 1 },
    ]));
    expect(alphaRow).toEqual([0, 0, 0, 1, 0]);
  });

  /**
   * CADA FACE NA COLUNA DELA. A coluna 0 multiplica o canal vermelho da
   * entrada, que e a mascara do topo; a 1 o verde (esquerda); a 2 o azul
   * (direita). Trocar duas colunas e o erro mais facil de cometer e o mais
   * dificil de ver.
   */
  it('poe a cor de cada face na coluna do canal dela', () => {
    const values = faceColorMatrix([
      { color: 'rgb(255,0,0)', alpha: 1 }, // topo vermelho puro
      { color: 'rgb(0,255,0)', alpha: 1 }, // esquerda verde puro
      { color: 'rgb(0,0,255)', alpha: 1 }, // direita azul puro
    ]);
    const [r, g, b] = rows(values);
    // Saida vermelha so recebe do topo; verde so da esquerda; azul so da direita.
    expect(r.slice(0, 3)).toEqual([1, 0, 0]);
    expect(g.slice(0, 3)).toEqual([0, 1, 0]);
    expect(b.slice(0, 3)).toEqual([0, 0, 1]);
  });

  /** A FORCA entra na cor: meia luz e meia coluna. */
  it('multiplica a cor pela forca da face', () => {
    const full = rows(faceColorMatrix([{ color: 'rgb(255,255,255)', alpha: 1 }, dark, dark]));
    const half = rows(faceColorMatrix([{ color: 'rgb(255,255,255)', alpha: 0.5 }, dark, dark]));
    expect(full[0][0]).toBeCloseTo(1, 4);
    expect(half[0][0]).toBeCloseTo(0.5, 4);
  });

  /**
   * Face sem luz nao contribui NADA. Sem isso, uma face virada para longe da
   * tocha ainda somaria a cor dela e o corpo inteiro clarearia por igual — que
   * e exatamente o defeito que a normal por pixel existe para consertar.
   */
  it('face apagada some da matriz inteira', () => {
    const values = faceColorMatrix([
      { color: 'rgb(255,200,120)', alpha: 0.6 },
      dark,
      { color: 'rgb(255,200,120)', alpha: 0 },
    ]);
    const [r, g, b] = rows(values);
    for (const row of [r, g, b]) {
      expect(row[1]).toBe(0); // esquerda apagada
      expect(row[2]).toBe(0); // direita com forca zero
    }
    expect(r[0]).toBeGreaterThan(0); // e o topo continua acendendo
  });

  /**
   * Uma luz alaranjada tem de sair alaranjada: mais vermelho que azul na
   * coluna da face que a recebeu. E a checagem que pega uma inversao de
   * canais na leitura do `rgb(...)`.
   */
  it('preserva o matiz da luz na coluna da face', () => {
    const [r, g, b] = rows(faceColorMatrix([{ color: 'rgb(255,122,47)', alpha: 1 }, dark, dark]));
    expect(r[0]).toBeGreaterThan(g[0]);
    expect(g[0]).toBeGreaterThan(b[0]);
  });

  it('nao quebra com face ausente nem com cor ilegivel', () => {
    expect(() => faceColorMatrix([])).not.toThrow();
    expect(faceColorMatrix([]).split(/\s+/)).toHaveLength(20);
    const values = faceColorMatrix([{ color: 'nao-e-cor', alpha: 1 }, dark, dark]);
    expect(values.split(/\s+/).every((n) => Number.isFinite(Number(n)))).toBe(true);
  });
});

describe('espelhamento', () => {
  const faces = ['topo', 'esquerda', 'direita'] as const;

  it('sem espelho, cada luz fica na coluna que ja era dela', () => {
    expect(orderFacesForDraw(faces, false)).toEqual(['topo', 'esquerda', 'direita']);
  });

  /**
   * COM espelho as duas laterais trocam, e o topo nao: inverter em x nao mexe
   * no que olha para cima. E este o teste que pega a metade das direcoes do
   * jogo recebendo luz do lado errado — um defeito que se apresenta como "as
   * vezes a luz fica estranha".
   */
  it('com espelho, as duas laterais trocam e o topo fica', () => {
    expect(orderFacesForDraw(faces, true)).toEqual(['topo', 'direita', 'esquerda']);
  });

  it('espelhar duas vezes volta ao comeco', () => {
    expect(orderFacesForDraw(orderFacesForDraw(faces, true), true)).toEqual([...faces]);
  });
});
