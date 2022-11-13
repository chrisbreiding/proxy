import dayjs from 'dayjs'
import nock from 'nock'
import { afterEach, beforeEach, describe, it, vi } from 'vitest'

process.env.DARK_SKY_API_KEY = 'dark-sky-key'

import { updateWeather } from '../../../lib/notion/update-upcoming-weather'
import { snapshotBody } from '../../util'
import {
  block,
  nockGetBlockChildren,
  nockNotion,
  notionFixture as fixture,
  notionFixtureContents as fixtureContents,
} from './util'

describe('lib/notion/update-upcoming-weather', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('updates upcoming quest dates with temperature and conditions', async () => {
    vi.setSystemTime(new Date(2022, 11, 1)) // just needs to be before 12/27

    const weather = fixtureContents('weather/weather')

    weather.daily.data[0].time = dayjs('2022-12-27').unix()
    weather.daily.data[1].time = dayjs('2022-12-28').unix()
    weather.daily.data[2].time = dayjs('2022-12-29').unix()
    weather.daily.data[3].time = dayjs('2022-12-30').unix()
    weather.daily.data[4].time = dayjs('2022-12-31').unix()
    weather.daily.data[5].time = dayjs('2023-01-01').unix()
    weather.daily.data[6].time = dayjs('2023-01-02').unix()

    nock('https://api.darksky.net')
    .get('/forecast/dark-sky-key/lat,lng?exclude=minutely,flags&extend=hourly')
    .reply(200, weather)

    const questBlocks = [
      block.p({ text: 'Some text' }),
      block.p({ text: '' }),
      block.p({ text: 'Mon, 12/27    ☀️ 33° / 62°' }),
      block.bullet({ text: 'A task' }),
      block.bullet({ text: 'A task' }),
      block.p({ text: 'Tue, 12/28' }),
      block.bullet({ text: 'A task' }),
      block.toggle({ text: 'Upcoming', id: 'upcoming-id' }),
    ]

    const upcomingBlocks = [
      block.p({ text: 'Wed, 12/29' }),
      block.bullet({ text: 'A task' }),
      block.p({ text: 'Thu, 12/30' }),
      block.bullet({ text: 'A task' }),
      block.p({ text: 'Fri, 12/31' }),
      block.bullet({ text: 'A task' }),
      block.p({ text: 'Sat, 1/1' }),
      block.bullet({ text: 'A task' }),
      block.p({ text: 'Sun, 1/2' }),
      block.bullet({ text: 'A task' }),
    ]

    nockGetBlockChildren('quests-id', { reply: { results: questBlocks } })
    nockGetBlockChildren('upcoming-id', { reply: { results: upcomingBlocks } })

    const snapshotUpdates = [6, 8, 10, 12, 14, 16].map((num) => {
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
