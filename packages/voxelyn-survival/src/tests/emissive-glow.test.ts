import { describe, expect, it } from 'vitest';
import { EMISSIVE_HEX } from '@voxelyn/survival-content';
import { glowAlpha, keepEmissivePixels } from '../client/sprites';

/**
 * A outra metade deste contrato vive no pacote de conteudo, que e quem possui os
 * atlas: la se confere que as pecas que dependem de brilhar de fato tem pixel
 * emissivo, e que as que nao dependem nao tem. Aqui fica a regra de decisao.
 */
const px = (...bytes: number[]): Uint8ClampedArray => Uint8ClampedArray.from(bytes);

describe('mascara de emissivos', () => {
  it('guarda so as cores que emitem luz', () => {
    const data = px(
      0x59, 0xf2, 0xc2, 255, // biolum: fica
      0x6e, 0x4a, 0x33, 255, // rust: sai
      0x7a, 0xb8, 0xff, 255, // electric: fica
      0xb8, 0xa9, 0x8f, 255, // bone: sai
    );

    expect(keepEmissivePixels(data, EMISSIVE_HEX)).toBe(2);
    expect([...data]).toEqual([
      0x59, 0xf2, 0xc2, 255,
      0x6e, 0x4a, 0x33, 0,
      0x7a, 0xb8, 0xff, 255,
      0xb8, 0xa9, 0x8f, 0,
    ]);
  });

  it('nao acende pixel transparente que por acaso carrega a cor', () => {
    // PNG com alpha zero ainda guarda RGB. Sem a checagem de alpha, o halo
    // apareceria em cima do vazio em volta do sprite.
    const data = px(0x59, 0xf2, 0xc2, 0);
    expect(keepEmissivePixels(data, EMISSIVE_HEX)).toBe(0);
  });

  /**
   * Ouro e branco NAO emitem. E a decisao mais facil de reverter por engano — os
   * dois sao claros e "parecem" luz —, e reverte-la faria o baculo do Bispo, a
   * fivela do Prospector e todo casco do Corcel brilharem, prometendo uma
   * mecanica que nao existe.
   */
  it('nao acende ouro nem branco, que sao materiais', () => {
    const data = px(
      0xff, 0xd1, 0x66, 255, // loot
      0xe8, 0xf1, 0xff, 255, // player
    );
    expect(keepEmissivePixels(data, EMISSIVE_HEX)).toBe(0);
  });

  it('devolve zero quando nao ha luz nenhuma, para o desenho pular o halo', () => {
    const data = px(
      0x6e, 0x4a, 0x33, 255,
      0x2e, 0x3a, 0x4d, 255,
    );
    expect(keepEmissivePixels(data, EMISSIVE_HEX)).toBe(0);
  });
});

/**
 * O halo herda a transparencia do corpo que ele acende.
 *
 * A atenuacao de um sprite nunca e decoracao: o parceiro escurece porque a
 * caverna esta escura ali, o eco de morte se apaga porque esta acabando, a
 * oferta do poco e translucida porque ainda nao foi tomada. Um halo em
 * opacidade fixa contradiz as tres — o visor fica aceso sobre um corpo que quase
 * nao esta na tela, e no eco de morte fura a regra de que so o farol proprio
 * atravessa o escuro.
 */
describe('opacidade do halo', () => {
  it('escala a opacidade herdada em vez de substitui-la', () => {
    const full = glowAlpha(1);
    expect(glowAlpha(0.2)).toBeCloseTo(full * 0.2, 6);
    expect(glowAlpha(0.5)).toBeCloseTo(full * 0.5, 6);
  });

  it('nunca acende mais do que o corpo que o gerou', () => {
    for (const inherited of [0, 0.05, 0.3, 0.75, 1]) {
      expect(glowAlpha(inherited)).toBeLessThanOrEqual(inherited);
    }
  });

  it('some junto com o corpo, e nao depois dele', () => {
    expect(glowAlpha(0)).toBe(0);
  });
});
