import nock from 'nock'
import { afterEach, beforeEach, describe, it, vi } from 'vitest'

process.env.DARK_SKY_API_KEY = 'dark-sky-key'

import { updateWeather } from '../../../lib/notion/update-upcoming-weather'
import { snapshotBody } from '../../util'
import {
  block,
  notionFixture as fixture,
  nockGetBlockChildren,
  nockNotion,
} from './util'

describe('lib/notion/update-upcoming-weather', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('updates upcoming quest dates with temperature and conditions', async () => {
    vi.setSystemTime(new Date(2022, 9, 1)) // just needs to be before 10/31

    nock('https://api.darksky.net')
    .get('/forecast/dark-sky-key/lat,lng?exclude=minutely,flags&extend=hourly')
    .replyWithFile(200, fixture('weather/weather'), {
      'Content-Type': 'application/json',
    })

    const questBlocks = [
      block.p({ text: 'Mon, 10/31' }),
      block.bullet({ text: 'A task' }),
      block.p({ text: 'Tue, 11/1' }),
      block.bullet({ text: 'A task' }),
      block.toggle({ text: 'Upcoming', id: 'upcoming-id' }),
    ]

    const upcomingBlocks = [
      block.p({ text: 'Wed, 11/2' }),
      block.bullet({ text: 'A task' }),
      block.p({ text: 'Thu, 11/3' }),
      block.bullet({ text: 'A task' }),
      block.p({ text: 'Fri, 11/4' }),
      block.bullet({ text: 'A task' }),
      block.p({ text: 'Sat, 11/5' }),
      block.bullet({ text: 'A task' }),
      block.p({ text: 'Sun, 11/6' }),
      block.bullet({ text: 'A task' }),
    ]

    nockGetBlockChildren('quests-id', { reply: { results: questBlocks } })
    nockGetBlockChildren('upcoming-id', { reply: { results: upcomingBlocks } })

    const snapshotUpdates = [1, 3, 5, 7, 9, 11, 13].map((num) => {
      return snapshotBody(nockNotion({
        method: 'patch',
        path: `/v1/blocks/block-${num}`,
      }), `block-${num}-update`)
    })

    await updateWeather({
      notionToken: 'notion-token',
      questsId: 'quests-id',
      location: 'lat,lng',
    })

    await Promise.all(snapshotUpdates)
  })
})
