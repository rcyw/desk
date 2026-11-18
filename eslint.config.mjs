import js from '@eslint/js';
import astro from 'eslint-plugin-astro';
import { defineConfig, globalIgnores } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig(
  globalIgnores(['.astro/', 'dist/']),
  {
    files: ['**/*.{js,mjs,ts,tsx,astro}'],
    extends: [js.configs.recommended],
  },
  {
    files: ['**/*.{ts,tsx,astro}'],
    extends: [tseslint.configs.recommended],
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
    },
  },
  astro.configs.recommended,
  {
    files: ['src/**/*.{js,ts,tsx}'],
    languageOptions: { globals: globals.browser },
  },
  {
    files: ['*.mjs', 'tests/**/*.mjs'],
    languageOptions: { globals: globals.node },
  },
);
