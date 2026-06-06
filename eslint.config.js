const globals = require('globals')
const { defineConfig } = require('eslint/config')
const tseslint = require('typescript-eslint')
const crb = require('eslint-plugin-crb')

module.exports = defineConfig(
  {
    ignores: [
      '.fixtures/**',
      '.history/**',
      '.husky/**',
      '.recorded/**',
      'data/**',
      'data-test/**',
      'dist/**',
      'node_modules/**',
      'patches/**',
    ],
  },
  // Base config for all JS/TS files
  {
    files: ['**/*.{js,ts}'],
    languageOptions: {
      ecmaVersion: 2021,
      globals: {
        ...globals.node,
        ...globals.commonjs,
        ...globals.es2021,
        Promise: true,
      },
    },
    rules: crb.configs.general.rules,
  },
  // TypeScript-specific config
  {
    files: ['**/*.ts'],
    extends: [tseslint.configs.recommended],
    rules: {
      '@typescript-eslint/ban-ts-comment': 'off',
      '@typescript-eslint/no-empty-function': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }],
    },
  },
)
