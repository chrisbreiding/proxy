import axios, { Method } from 'axios'
import Debug from 'debug'

import { debug } from './debug'

interface RequestOptions {
  url: string
  body?: object
  headers?: { [key: string]: string }
  params?: { [key: string]: string }
  method?: Method
}

export async function request (options: RequestOptions) {
  const { url, body, headers, params, method = 'get' } = options

  try {
    const response = await axios({
      method,
      url,
      headers,
      params,
      data: body,
    })

    return response.data
  } catch (error: any) {
    if (typeof error === 'object') {
      error.callStack = (new Error(error.message)).stack
    }

    debug('--- axios error ---')
    debug({ url, body, headers, params, method })
    debug('')
    debug({
      stack: error?.stack,
      callStack: error?.callStack,
      message: error?.data?.message || error?.message,

      code: error?.data?.code,
      status: error?.response?.status,
      statusText: error?.response?.statusText,
    })
    debug('')
    Debug.enabled('proxy') && console.trace() // eslint-disable-line no-console
    debug('-------------------')

    throw error
  }
}
