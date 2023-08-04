import { URL } from 'url'
import axios, { Method } from 'axios'
import Debug from 'debug'
import path from 'path'

import { debug } from './debug'
import { outputJsonSync } from 'fs-extra'

export interface RequestOptions {
  url: string
  body?: object
  headers?: { [key: string]: string }
  params?: { [key: string]: string }
  method?: Method
}

export async function request (options: RequestOptions) {
  const { url, body, headers, params, method = 'get' } = options

  try {
    /* c8 ignore start */
    if (Debug.enabled('proxy:record:requests')) {
      const parsedUrl = new URL(url)
      const paramsPart = params && Object.keys(params).length && Object.entries(params).map(([key, value]) => `${key}-${value}`).join(')(')
      const paramsString = paramsPart ? `-(${paramsPart})` : ''
      const filePath = path.join(process.cwd(), `.recorded/requests/${parsedUrl.pathname}${paramsString}.json`)
      outputJsonSync(filePath, { url, method, headers, params, body }, { spaces: 2 })
    }

    /* c8 ignore stop */
    const response = await axios({
      method,
      url,
      headers,
      params,
      data: body,
    })

    /* c8 ignore start */
    if (Debug.enabled('proxy:record:responses')) {
      const parsedUrl = new URL(url)
      const paramsPart = params && Object.keys(params).length && Object.entries(params).map(([key, value]) => `${key}-${value}`).join(')(')
      const paramsString = paramsPart ? `-(${paramsPart})` : ''
      const filePath = path.join(process.cwd(), `.recorded/responses/${parsedUrl.pathname}${paramsString}.json`)

      outputJsonSync(filePath, { url, method, headers, params, body, response: response.data }, { spaces: 2 })
    }

    /* c8 ignore stop */
    return response.data
  } catch (error: any) {
    if (typeof error === 'object') {
      error.callStack = (new Error(error.message)).stack
    }

    /* c8 ignore start */
    debug('--- axios error ---')
    debug(options)
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
    /* c8 ignore stop */

    throw error
  }
}
