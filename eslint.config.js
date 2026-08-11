import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import svelte from 'eslint-plugin-svelte';
import prettier from 'eslint-config-prettier';
import svelteParser from 'svelte-eslint-parser';

export default [
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/.svelte-kit/**',
      '**/coverage/**',
      '**/.vite/**',
      '**/.turbo/**',
      '**/packages/voxelforge-electron/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...svelte.configs['flat/recommended'],
  {
    files: ['**/*.svelte'],
    languageOptions: {
      parser: svelteParser,
      parserOptions: {
        parser: tseslint.parser,
        extraFileExtensions: ['.svelte'],
        sourceType: 'module',
        ecmaVersion: 'latest',
      },
    },
  },
  {
    files: ['**/*.{ts,tsx,js,jsx}'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        sourceType: 'module',
        ecmaVersion: 'latest',
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/consistent-type-imports': ['warn', { prefer: 'type-imports' }],
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  {
    // scripts de build/validacao de sprites: rodam em Node, nao no browser
    files: [
      'packages/voxelyn-survival-content/tools/**/*.mjs',
      'packages/voxelyn-atlas-studio/scripts/**/*.mjs',
    ],
    languageOptions: {
      globals: { Buffer: 'readonly', console: 'readonly', process: 'readonly', URL: 'readonly' },
    },
  },
  {
    // pipeline do devlog: roda em Node, fora de qualquer pacote
    files: ['scripts/**/*.mjs'],
    languageOptions: {
      globals: {
        Buffer: 'readonly',
        console: 'readonly',
        process: 'readonly',
        URL: 'readonly',
        // O trecho que roda DENTRO do browser (addInitScript/evaluate) mora
        // neste arquivo mas executa na pagina: sem estes, o lint acusa
        // no-undef em codigo que nunca roda no Node.
        document: 'readonly',
        localStorage: 'readonly',
        // Globais web que o Node tem desde a v18 e o upload usa.
        fetch: 'readonly',
        URLSearchParams: 'readonly',
        AbortSignal: 'readonly',
        structuredClone: 'readonly',
      },
    },
  },
  {
    // service workers dos PWAs: escopo ServiceWorkerGlobalScope, nao window
    files: ['packages/voxelyn-survival/public/sw.js', 'packages/voxelyn-atlas-studio/public/sw.js'],
    languageOptions: {
      globals: {
        self: 'readonly',
        caches: 'readonly',
        fetch: 'readonly',
        console: 'readonly',
        URL: 'readonly',
        Request: 'readonly',
        Response: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
      },
    },
  },
  prettier,
];
