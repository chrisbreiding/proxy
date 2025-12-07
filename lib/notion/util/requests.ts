import type { Method } from 'axios'
import { request } from '../../util/network'

interface MakeRequestOptions {
  body?: object
  method?: Method
  notionToken: string
  path: string
}

export function makeRequest<T> (options: MakeRequestOptions): Promise<T> {
  const { notionToken, body, path, method = 'get' } = options

  return request({
    method,
    body,
    url: `https://api.notion.com/v1/${path}`,
    headers: {
      'Authorization': `Bearer ${notionToken}`,
      'Notion-Version': '2025-09-03',
    },
  })
}
