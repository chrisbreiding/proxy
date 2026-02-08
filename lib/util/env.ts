import { readJsonSync } from 'fs-extra'

type EnvFile = { [key: string]: any }

const isDevelopment = process.env.NODE_ENV === 'development'
const isTest = process.env.NODE_ENV === 'test'
/* v8 ignore next -- @preserve */
const envFile: EnvFile = isDevelopment || isTest ? readJsonSync('./.env') : {}

export function getEnv (key: string): string | undefined {
  /* v8 ignore next -- @preserve */
  const testValue = isTest ? envFile[`TEST_${key}`] : undefined
  const devValue = envFile[key]
  const prodValue = process.env[key]

  return prodValue || testValue || devValue
}
