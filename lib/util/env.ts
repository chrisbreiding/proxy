import { readJsonSync } from 'fs-extra'
import minimist from 'minimist'

type EnvFile = { [key: string]: any }

const args = minimist(process.argv.slice(2)) as { test?: boolean }
const isDevelopmentEnv = process.env.NODE_ENV === 'development'
const isLocalTest = !!args.test
/* v8 ignore next -- @preserve */
const envFile: EnvFile = isDevelopmentEnv || isLocalTest ? readJsonSync('./.env') : {}

export function getEnv (key: string): string | undefined {
  /* v8 ignore next -- @preserve */
  const testValue = isLocalTest ? envFile[`TEST_${key}`] : undefined
  const devValue = envFile[key]
  const prodValue = process.env[key]

  return prodValue || testValue || devValue
}
