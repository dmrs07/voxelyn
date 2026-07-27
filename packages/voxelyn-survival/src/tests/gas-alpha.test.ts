import { describe, expect, it } from 'vitest';
import { GAS_ALPHA } from '../client/render';

/**
 * Os quatro niveis de alpha que a art bible §2 permite para efeitos.
 *
 * A regra geral e alpha binario 0/255 em tudo, com uma excecao NOMEADA para
 * gases e luz, que podem usar estes valores e nenhum outro.
 */
const ALLOWED = [64, 128, 192, 255];

describe('opacidade do gas', () => {
  // Este teste existe por causa de um buraco real, e nao por formalidade: o
  // validador de sprites confere alpha dentro do PNG, e o alfa do gas e
  // aplicado no DESENHO. Nenhum dos dois lados olhava para este numero, entao a
  // regra valia so pela boa vontade de quem editasse o arquivo — e ela ja tinha
  // sido quebrada em 0.68, que da 173 e nao e nivel permitido nenhum.
  it('usa um dos quatro niveis permitidos para efeitos', () => {
    const level = Math.round(GAS_ALPHA * 255);
    expect(ALLOWED, `alpha ${level} nao esta na escala permitida`).toContain(level);
  });

  // Metade da escala some no escuro. O gas machuca, e tem de ser lido como
  // perigo em menos de 200 ms sobre pedra escura — nas celulas mal iluminadas,
  // que sao justamente as que o jogador atravessa correndo.
  it('fica acima da metade da escala, para o perigo nao sumir na penumbra', () => {
    expect(Math.round(GAS_ALPHA * 255)).toBeGreaterThan(128);
  });

  // E translucido de verdade: opaco de novo perderia a leitura gasosa que o
  // alfa veio dar.
  it('nao volta a ser opaco', () => {
    expect(GAS_ALPHA).toBeLessThan(1);
  });
});
