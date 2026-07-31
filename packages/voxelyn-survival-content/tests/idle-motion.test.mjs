// Idle vivo: nenhum personagem do elenco pode congelar em repouso.
//
// Seis dos nove personagens ja estiveram exatamente assim — os quatro frames de
// `idle` eram bit a bit identicos, entao um inimigo parado era uma estatua e a
// tela morta nao dizia se o jogo travou ou se o bicho e assim. O manifest
// declara `idle` com 4 quadros a 6 fps; se os quadros sao iguais, essa
// declaracao e mentira que nenhum outro validador pega: frame vazio, paleta e
// jitter passam todos.
//
// O teste desenha os quadros crus do gerador (antes do enquadramento comum do
// atlas, que so desloca todos por igual) e exige que ao menos um difira do
// primeiro. Nao exige que TODOS difiram: padroes como [0, 1, 1, 0] tem quadros
// vizinhos iguais de proposito.
import { describe, expect, it } from 'vitest';
import { ENTITY_SPECS } from '../tools/entities.mjs';

const CAST = ENTITY_SPECS.filter(
  (s) => s.id.startsWith('player-') || s.id.startsWith('enemy-')
);

describe('idle vivo', () => {
  it('cobre o elenco inteiro', () => {
    expect(CAST.length).toBeGreaterThanOrEqual(9);
  });

  for (const spec of CAST) {
    it(`${spec.id}: quadros de idle nao sao todos identicos`, () => {
      const first = Buffer.from(spec.draw('dr', 'idle', 0).buf);
      let moved = false;
      for (let f = 1; f < spec.animations.idle.frames && !moved; f++) {
        moved = !first.equals(Buffer.from(spec.draw('dr', 'idle', f).buf));
      }
      expect(moved).toBe(true);
    });
  }
});
