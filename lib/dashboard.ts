import type express from 'express'

import { debug } from './util/debug'
import { getActiveBeanDetails } from './notion/coffee'
import { getCurrentWeather } from './weather'
import { getGarageData } from './garage'
import { getNotionData } from './notion'

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
  const { location, notionBeansId, notionToken, notionQuestsId } = req.query

  if (!location || typeof location !== 'string') {
    return res.json({ error: { message: 'Must include location in query' } })
  }
  if (!notionBeansId || typeof notionBeansId !== 'string') {
    return res.json({ error: { message: 'Must include notionBeansId in query' } })
  }
  if (!notionToken || typeof notionToken !== 'string') {
    return res.json({ error: { message: 'Must include notionToken in query' } })
  }
  if (!notionQuestsId || typeof notionQuestsId !== 'string') {
    return res.json({ error: { message: 'Must include notionQuestsId in query' } })
  }

  const [garage, quests, weather, beans] = await Promise.all([
    wrap('garage', () => getGarageData()),
    wrap('quests', () => getNotionData({ notionToken, notionPageId: notionQuestsId })),
    wrap('weather', () => getCurrentWeather(location)),
    wrap('beans', () => getActiveBeanDetails({ notionToken, notionBeansId })),
  ])

  res.json({ garage, quests, weather, beans })
}
