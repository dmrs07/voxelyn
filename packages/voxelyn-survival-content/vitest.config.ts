import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    // src/ tambem: manifest.test.ts vive junto do codigo que testa e ficava
    // fora do include, entao nunca rodava.
    // .mjs tambem: os testes de geometria alcancam `tools/*.mjs`, que e
    // JavaScript puro e fica de proposito fora de `src/` — e portanto fora do
    // `tsc` que compila o pacote.
    include: [
      'tests/**/*.test.{ts,mjs}',
      'src/**/*.test.ts',
    ],
  },
});
