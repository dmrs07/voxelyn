import { describe, expect, it } from 'vitest';
import { NEGATIVE_TRAITS, POSITIVE_TRAITS } from './gen.js';
import { CHOICE_TEXT, TASK_TEXT, TRAIT_TEXT } from './text.js';

/**
 * PARIDADE de idiomas: o tipo do dicionario da interface ja e verificado
 * pelo compilador; os CATALOGOS da sim (Record<string, ...>) nao — este
 * portao garante que nenhuma chave fica orfa num idioma so.
 */
describe('paridade en/pt dos catalogos', () => {
  it('toda tarefa tem as mesmas variantes nos dois idiomas', () => {
    expect(Object.keys(TASK_TEXT.en).sort()).toEqual(Object.keys(TASK_TEXT.pt).sort());
    for (const id of Object.keys(TASK_TEXT.en)) {
      expect(TASK_TEXT.en[id]!.length, id).toBe(TASK_TEXT.pt[id]!.length);
    }
  });

  it('toda decisao tem as mesmas opcoes (ids estaveis) nos dois idiomas', () => {
    expect(Object.keys(CHOICE_TEXT.en).sort()).toEqual(Object.keys(CHOICE_TEXT.pt).sort());
    for (const id of Object.keys(CHOICE_TEXT.en)) {
      expect(
        CHOICE_TEXT.en[id]!.options.map((o) => o.id),
        id
      ).toEqual(CHOICE_TEXT.pt[id]!.options.map((o) => o.id));
    }
  });

  it('todo trait do jogo tem rotulo nos dois idiomas', () => {
    for (const tr of [...POSITIVE_TRAITS, ...NEGATIVE_TRAITS, 'recusa-css'] as const) {
      expect(TRAIT_TEXT.en[tr], `en ${tr}`).toBeTruthy();
      expect(TRAIT_TEXT.pt[tr], `pt ${tr}`).toBeTruthy();
    }
  });
});
