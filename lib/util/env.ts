import fs from 'fs-extra'

type EnvFile = { [key: string]: any }

const isDevelopment = process.env.NODE_ENV === 'development'
const envFile: EnvFile = isDevelopment ? fs.readJsonSync('./.env') : {}

export function getEnv (key: string): string | undefined {
  return process.env[key] || envFile[key]
}
