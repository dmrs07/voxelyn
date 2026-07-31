import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    // src/ tambem: manifest.test.ts vive junto do codigo que testa e ficava
    // fora do include, entao nunca rodava.
    // .mjs tambem: os testes de geometria alcancam `tools/*.mjs`, que e
    // JavaScript puro e fica de proposito fora de `src/` — e portanto fora do
    // `tsc` que compila o pacote.
    // `tools/` tambem: alguns testes de geometria vivem colados ao gerador que
    // testam, e ficando fora do include eles rodavam verdes localmente sem nunca
    // ter sido executados no CI — cobertura de mentira, que e pior que nenhuma.
    include: [
      'tests/**/*.test.{ts,mjs}',
      'src/**/*.test.ts',
      'tools/**/*.test.mjs',
    ],
  },
});
