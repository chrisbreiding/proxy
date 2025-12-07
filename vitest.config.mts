import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    setupFiles: ['./test/setup.ts'],
    include: ['test/**/*.spec.ts'],
    exclude: ['dist/**/*', 'node_modules/**/*'],
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
