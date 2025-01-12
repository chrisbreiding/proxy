import { URL } from 'url'
import axios, { Method } from 'axios'
import Debug from 'debug'
import path from 'path'
import type { ParsedQs } from 'qs'

import { debug, debugVerbose } from './debug'
import { outputJsonSync, readJSONSync } from 'fs-extra'

export interface RequestOptions {
  url: string
  body?: object
  headers?: { [key: string]: string }
  params?: ParsedQs
  method?: Method
}

function normalizedParams (originalParams?: ParsedQs) {
  if (!originalParams || typeof originalParams === 'string') {
    return originalParams
  }

  const params = new URLSearchParams()

  for (const [key, value] of Object.entries(originalParams)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        params.append(key, item as string)
      }
    } else {
      params.append(key, value as string)
    }
  }

  return params
}

export async function request<T = any> (options: RequestOptions): Promise<T> {
  const { url, body, headers, params, method = 'get' } = options

  debugVerbose('request: %s %s %o', method.toUpperCase(), url, { body, params, headers })

  try {
    /* c8 ignore start */
    if (Debug.enabled('proxy:record:requests')) {
      const parsedUrl = new URL(url)
      const paramsPart = params && Object.keys(params).length && Object.entries(params).map(([key, value]) => `${key}-${value}`).join(')(')
      const paramsString = paramsPart ? `-(${paramsPart})` : ''
      const filePath = path.join(process.cwd(), `.recorded/requests/${parsedUrl.pathname}-${method.toUpperCase()}${paramsString}.json`)
      const existing = readJSONSync(filePath, { throws: false }) || []

      outputJsonSync(filePath, existing.concat({ url, method, headers, params, body }), { spaces: 2 })
    }

    /* c8 ignore stop */
    const response = await axios({
      method,
      url,
      headers,
      params: normalizedParams(params),
      data: body,
    })

    /* c8 ignore start */
    if (Debug.enabled('proxy:record:responses')) {
      const parsedUrl = new URL(url)
      const paramsPart = params && Object.keys(params).length && Object.entries(params).map(([key, value]) => `${key}-${value}`).join(')(')
      const paramsString = paramsPart ? `-(${paramsPart})` : ''
      const filePath = path.join(process.cwd(), `.recorded/responses/${parsedUrl.pathname}-${method.toUpperCase()}${paramsString}.json`)
      const existing = readJSONSync(filePath, { throws: false }) || []

      outputJsonSync(filePath, existing.concat({ request: { url, method, headers, params, body }, response: response.data }), { spaces: 2 })
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
    debug('---')
    debug({
      stack: error?.stack,
      callStack: error?.callStack,
      message: error?.data?.message || error?.message,

      code: error?.code || error?.data?.code,
      data: error?.response?.data,
      status: error?.response?.status,
      statusText: error?.response?.statusText,
    })
    debug('---')
    Debug.enabled('proxy') && console.trace() // eslint-disable-line no-console
    debug('-------------------')
    /* c8 ignore stop */

    throw error
  }
}
