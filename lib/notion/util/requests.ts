import type { Method } from 'axios'
import { debug } from '../../util/debug'
import { request } from '../../util/network'

interface MakeRequestOptions {
  body?: object
  method?: Method
  notionToken: string
  path: string
}

// https://developers.notion.com/reference/request-limits#rate-limits
// 429 = rate_limited, 529 = service_overload. Both should be retried,
// respecting the Retry-After header (an integer number of seconds)
const retryableStatuses = [429, 529]
const maxRetries = 5
const defaultRetryAfterSeconds = 1

function delay (seconds: number) {
  return new Promise((resolve) => setTimeout(resolve, seconds * 1000))
}

function getRetryAfterSeconds (error: any) {
  const { headers, status } = error.response || {}

  if (!retryableStatuses.includes(status)) return

  const retryAfter = Number(headers?.['retry-after'])

  return Number.isFinite(retryAfter) ? retryAfter : defaultRetryAfterSeconds
}

export async function makeRequest<T> (options: MakeRequestOptions): Promise<T> {
  const { notionToken, body, path, method = 'get' } = options

  for (let attempt = 0; ; attempt++) {
    try {
      return await request<T>({
        method,
        body,
        url: `https://api.notion.com/v1/${path}`,
        headers: {
          'Authorization': `Bearer ${notionToken}`,
          'Notion-Version': '2025-09-03',
        },
      })
    } catch (error: any) {
      const retryAfterSeconds = getRetryAfterSeconds(error)

      if (retryAfterSeconds == null || attempt === maxRetries) throw error

      debug('Notion request to %s failed with status %d, retrying after %ds', path, error.response.status, retryAfterSeconds)

      await delay(retryAfterSeconds)
    }
  }
}
