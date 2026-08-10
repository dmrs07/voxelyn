import { describe, expect, it } from 'vitest';
import {
  DESKTOP_CONTROLS,
  controlBarEmphasis,
  controlBarLayout,
} from '../client/desktop-controls';

/**
 * A barra de comandos do desktop existe porque o teclado nao tinha NENHUMA das
 * duas coisas que o toque sempre teve: as teclas na tela e o estado das
 * recargas. O que se pode cobrar sem canvas e o layout — e e o layout que
 * quebra primeiro, porque ele encolhe junto com a janela.
 */

const layoutAt = (w: number, h: number, safeBottom = 0) =>
  controlBarLayout(DESKTOP_CONTROLS, w, h, safeBottom);

describe('layout da barra de comandos', () => {
  it('cabe na janela e fica centralizada', () => {
    for (const width of [1920, 1280, 900, 640, 380]) {
      const layout = layoutAt(width, 800);
      expect(layout.w).toBeLessThanOrEqual(width);
      expect(layout.x).toBeGreaterThanOrEqual(0);
      expect(layout.x + layout.w).toBeLessThanOrEqual(width + 1e-6);
      // Centralizada: a folga da esquerda e a mesma da direita.
      expect(layout.x).toBeCloseTo(width - (layout.x + layout.w), 6);
    }
  });

  it('publica um compartimento por comando, na ordem da lista', () => {
    const layout = layoutAt(1280, 800);
    expect(layout.slots).toHaveLength(DESKTOP_CONTROLS.length);
    expect(layout.slots.map((slot) => slot.control.id)).toEqual(
      DESKTOP_CONTROLS.map((control) => control.id),
    );
  });

  /**
   * Compartimentos que se sobrepoem seriam duas teclas desenhadas uma em cima
   * da outra — o modo de falha mais provavel de um layout que escala.
   */
  it('nunca sobrepoe dois compartimentos, em nenhuma largura', () => {
    for (const width of [1920, 1024, 720, 420, 300]) {
      const { slots } = layoutAt(width, 800);
      for (let i = 1; i < slots.length; i++) {
        expect(slots[i].x).toBeGreaterThanOrEqual(slots[i - 1].x + slots[i - 1].w - 1e-6);
      }
    }
  });

  /**
   * Uma janela estreita ENCOLHE a barra em vez de quebra-la em duas linhas: a
   * segunda linha roubaria altura de jogo justamente onde ha menos dela.
   */
  it('encolhe por escala na janela estreita, sem virar duas linhas', () => {
    const wide = layoutAt(1920, 800);
    const narrow = layoutAt(420, 800);
    expect(narrow.h).toBeLessThan(wide.h);
    expect(narrow.slots.every((slot) => slot.y === narrow.y)).toBe(true);
    expect(narrow.slots.every((slot) => slot.h === narrow.h)).toBe(true);
  });

  /** A area segura do aparelho e folga, e nao sugestao: a barra fica acima dela. */
  it('respeita a area segura de baixo', () => {
    const safeBottom = 34;
    const layout = layoutAt(1280, 800, safeBottom);
    expect(layout.y + layout.h).toBeLessThanOrEqual(800 - safeBottom);
    expect(layout.y + layout.h).toBeLessThan(layoutAt(1280, 800, 0).y + layoutAt(1280, 800, 0).h);
  });

  /**
   * As teclas vem de `input.ts` e nao de um mapa proprio. Este teste nao le o
   * input (ele guarda o teclado privado), mas trava a LISTA: quem mexer nela
   * precisa passar por aqui, e quem passa por aqui e obrigado a conferir o
   * outro lado.
   */
  it('publica esquiva e habilidade como os unicos comandos com recarga', () => {
    const withCooldown = DESKTOP_CONTROLS.filter((control) => control.cooldown).map((c) => c.id);
    expect(withCooldown).toEqual(['dodge', 'ability']);
  });
});

describe('realce da barra', () => {
  /**
   * Ela entra cheia e assenta. Permanente so funciona se ela souber sumir do
   * caminho — e uma barra que nunca assenta e mobilia, que e a objecao que
   * segurou a faixa de mira permanente por tanto tempo.
   */
  it('comeca cheia e assenta num sussurro', () => {
    expect(controlBarEmphasis(0)).toBe(1);
    expect(controlBarEmphasis(3000)).toBe(1);
    const resting = controlBarEmphasis(60_000);
    expect(resting).toBeGreaterThan(0);
    expect(resting).toBeLessThan(0.6);
  });

  it('nunca aumenta com o tempo', () => {
    let previous = Number.POSITIVE_INFINITY;
    for (let ms = 0; ms <= 20_000; ms += 250) {
      const emphasis = controlBarEmphasis(ms);
      expect(emphasis).toBeLessThanOrEqual(previous + 1e-9);
      previous = emphasis;
    }
  });
});
