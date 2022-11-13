import type express from 'express'

import { getGarageData } from './garage'
import { getNotionData } from './notion'
import { debug } from './util/debug'
import { getWeatherData } from './weather'

async function wrap (who: string, fn: () => Promise<any>) {
  try {
    const data = await fn()

    return { data }
  } catch (error: any) {
    debug('Getting', who, 'data errored:', error.stack)

    return {
      error: {
        name: error.name,
        message: error.message,

        code: error.code,
        status: error.response?.status,
        statusText: error.response?.statusText,

        response: error.response?.data,
      },
    }
  }
}

export async function get (req: express.Request, res: express.Response) {
  const { location, notionToken, notionPageId } = req.query

  if (!location || typeof location !== 'string') {
    return res.json({ error: { message: 'Must include location in query' } })
  }
  if (!notionToken || typeof notionToken !== 'string') {
    return res.json({ error: { message: 'Must include notionToken in query' } })
  }
  if (!notionPageId || typeof notionPageId !== 'string') {
    return res.json({ error: { message: 'Must include notionPageId in query' } })
  }

  const [garage, notion, weather] = await Promise.all([
    wrap('garage', () => getGarageData()),
    wrap('notion', () => getNotionData({ notionToken, notionPageId })),
    wrap('weather', () => getWeatherData(location)),
  ])

  res.json({ garage, notion, weather })
}
