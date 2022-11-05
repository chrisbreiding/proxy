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

export async function request ({ url, body, headers, params, method = 'get' }: RequestOptions) {
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
    debug('--- axios error ---')
    debug({ url, body, headers, params, method })
    debug('')
    debug({
      status: error?.response?.status,
      statusText: error?.response?.statusText,
      code: error?.data?.code,
      message: error?.data?.message,
      stack: error?.stack,
    })
    debug('')
    Debug.enabled('proxy') && console.trace() // eslint-disable-line no-console
    debug('-------------------')

    throw error
  }
}
