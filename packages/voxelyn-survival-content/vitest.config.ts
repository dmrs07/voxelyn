import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    // src/ tambem: manifest.test.ts vive junto do codigo que testa e ficava
    // fora do include, entao nunca rodava.
    include: ['tests/**/*.test.ts', 'src/**/*.test.ts'],
  },
});
