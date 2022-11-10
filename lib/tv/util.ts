import type { Method } from 'axios'
import { debug, debugVerbose } from '../util/debug'
import { getEnv } from '../util/env'
import { request } from '../util/network'

const apikey = getEnv('THETVDB_API_KEY')
const pin = getEnv('THETVDB_PIN')
export const baseUrl = 'https://api4.thetvdb.com'

interface LoginResult {
  status: string
  data: {
    token: string
  }
}

async function authenticate () {
  debugVerbose('authenticate')

  try {
    const { data, status } = await request({
      method: 'post',
      url: `${baseUrl}/v4/login`,
      body: { apikey, pin },
    }) as LoginResult

    if (!data?.token) {
      throw new Error(`Could not authenticate with TheTVDB, status: ${status}`)
    }

    return data.token as string
  } catch (error: any) {
    debug('Authentication failed:', error?.stack || error)

    throw error
  }
}

interface MakeRequestOptions {
  method?: Method
  params?: { [key: string]: string }
  path: string
  token?: string
}

export async function makeRequest (options: MakeRequestOptions) {
  const { method, params, path } = options
  const token = options.token || await authenticate()
  const url = `${baseUrl}/v4/${path}`

  debugVerbose('request: %o', { method, url, params, token })

  // TODO: handle error
  const result = await request({
    headers: {
      'Authorization': `Bearer ${token}`,
    },
    method,
    params,
    url,
  })

  result.token = token

  return result
}
