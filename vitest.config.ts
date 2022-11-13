import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    coverage: {
      exclude: [
        '**/firebase.ts',
        '**/shopping.js',
        '**/patience-diff.js',
        'test/**/*',
      ],
      reporter: ['text'],
    },
  },
})
