import type express from 'express'

import { getGarageData } from './garage'
import { getNotionData } from './notion'
import { getWeatherData } from './weather'

async function wrap (who: string, fn: () => Promise<any>) {
  try {
    const data = await fn()

    return { data }
  } catch (error: any) {
    // eslint-disable-next-line no-console
    console.log('Getting', who, 'data errored:', error.stack)

    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    }
  }
}

export async function get (req: express.Request, res: express.Response) {
  const { location, notionToken, notionPageId } = req.query

  if (!location || typeof location !== 'string') {
    return res.json({ error: 'Must include location in query' })
  }
  if (!notionToken || typeof notionToken !== 'string') {
    return res.json({ error: 'Must include notionToken in query' })
  }
  if (!notionPageId || typeof notionPageId !== 'string') {
    return res.json({ error: 'Must include notionPageId in query' })
  }

  const [garage, notion, weather] = await Promise.all([
    wrap('garage', () => getGarageData()),
    wrap('notion', () => getNotionData({ notionToken, notionPageId })),
    wrap('weather', () => getWeatherData({ location })),
  ])

  res.json({ garage, notion, weather })
}
