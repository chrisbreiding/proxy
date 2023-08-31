/* eslint-disable no-console */
import esbuild, { BuildOptions } from 'esbuild'
// @ts-ignore
import bookmarkletPlugin from 'esbuild-plugin-bookmarklet'
import { getEnv } from '../lib/util/env'

const watch = process.argv[2] === '--watch'

const options = {
  entryPoints: ['lib/notion/factor/bookmarklet.ts'],
  bundle: true,
  outfile: 'dist/factor-bookmarklet.js',
  format: 'iife',
  minify: true,
  define: {
    'process.env.API_KEY': `'${getEnv('API_KEY')}'`,
  },
  platform: 'browser',
  plugins: [bookmarkletPlugin],
  write: false,
} as BuildOptions

const bundle = async () => {
  if (watch) {
    await (await esbuild.context(options)).watch()
  } else {
    await esbuild.build(options)
  }
}

bundle().catch((err) => {
  console.error(err)
  process.exit(1)
})
