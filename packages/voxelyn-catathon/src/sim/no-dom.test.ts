import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * A fronteira, VERIFICADA e nao prometida — a mesma disciplina da Iliada.
 * A simulacao nao pode tocar DOM, relogio de parede nem acaso nao semeado:
 * qualquer um dos tres e o fim do replay deterministico.
 */
describe('fronteira da simulacao', () => {
  it('nenhum arquivo de sim/ toca DOM, Date.now ou Math.random', () => {
    const dir = dirname(fileURLToPath(import.meta.url));
    for (const file of readdirSync(dir)) {
      if (!file.endsWith('.ts') || file.endsWith('.test.ts')) continue;
      const src = readFileSync(resolve(dir, file), 'utf8');
      for (const banned of ['document.', 'window.', 'Date.now', 'Math.random', 'requestAnimationFrame', 'localStorage']) {
        expect(src.includes(banned), `${file} usa ${banned}`).toBe(false);
      }
    }
  });
});
