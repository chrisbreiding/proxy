const globals = require('globals')
const tseslint = require('typescript-eslint')
const { FlatCompat } = require('@eslint/eslintrc')

const compat = new FlatCompat()

module.exports = tseslint.config(
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
  },
  ...compat.extends('plugin:crb/general'),
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
