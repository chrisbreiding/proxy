import nock from 'nock'
import { afterEach, beforeEach, describe, it, vi } from 'vitest'

const token = process.env.APPLE_WEATHER_TOKEN = 'token'
delete process.env.TZ

import { updateWeather } from '../../../lib/notion/update-upcoming-weather'
import { fixtureContents, weatherUrlBasePath } from '../../util'
import { block, nockGetBlockChildren, snapshotUpdateBlocks } from './util'

describe('lib/notion/update-upcoming-weather', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2022, 11, 28))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('updates upcoming quest dates with temperature and conditions', async () => {
    const weather = fixtureContents('weather/weather')

    delete weather.currentWeather
    delete weather.forecastHourly
    delete weather.weatherAlerts

    nock('https://weatherkit.apple.com')
    .matchHeader('authorization', `Bearer ${token}`)
    .get(`${weatherUrlBasePath}&dataSets=forecastDaily`)
    .reply(200, weather)

    const questBlocks = [
      block.p({ text: 'Some text' }),
      block.p({ text: '' }),
      block.p({ text: 'Wed, 12/28    🌪 23° / 62°' }),
      block.bullet({ text: 'A task' }),
      block.bullet({ text: 'A task' }),
      block.p({ text: 'Thu, 12/29' }),
      block.bullet({ text: 'A task' }),
      block.toggle({ text: 'Upcoming', id: 'upcoming-id' }),
    ]

    const upcomingBlocks = [
      block.p({ text: 'Fri, 12/30' }),
      block.bullet({ text: 'A task' }),
      block.p({ text: 'Sat, 12/31' }),
      block.bullet({ text: 'A task' }),
      block.p({ text: 'Sun, 1/1' }),
      block.bullet({ text: 'A task' }),
      block.p({ text: 'Mon, 1/2' }),
      block.bullet({ text: 'A task' }),
      block.p({ text: 'Tue, 1/3' }),
      block.bullet({ text: 'A task' }),
      block.p({ text: 'Tue, 1/4' }),
      block.bullet({ text: 'A task' }),
      block.p({ text: 'Tue, 1/5' }),
      block.bullet({ text: 'A task' }),
      block.p({ text: 'Tue, 1/6' }),
      block.bullet({ text: 'A task' }),
    ]

    nockGetBlockChildren('quests-id', { reply: { results: questBlocks } })
    nockGetBlockChildren('upcoming-id', { reply: { results: upcomingBlocks } })

    const snapshot = snapshotUpdateBlocks([
      'block-6',
      'block-9',
      'block-11',
      'block-13',
      'block-15',
      'block-17',
      'block-19',
      'block-21',
      'block-23',
    ])

    await updateWeather({
      notionToken: 'notion-token',
      questsId: 'quests-id',
      location: 'lat,lng',
    })

    await snapshot
  })
})
