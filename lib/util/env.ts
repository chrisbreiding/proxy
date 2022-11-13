import { readJsonSync } from 'fs-extra'

type EnvFile = { [key: string]: any }

const isDevelopment = process.env.NODE_ENV === 'development'
/* c8 ignore next */
const envFile: EnvFile = isDevelopment ? readJsonSync('./.env') : {}

export function getEnv (key: string): string | undefined {
  return process.env[key] || envFile[key]
}
