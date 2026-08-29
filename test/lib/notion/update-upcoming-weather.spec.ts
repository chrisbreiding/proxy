import mockFs from 'mock-fs'
import nock from 'nock'
import path from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

delete process.env.TZ

import { updateWeather } from '../../../lib/notion/update-upcoming-weather'
import { fixtureContents, weatherUrlBasePath } from '../../util'
import { block, nockGetBlockChildren, snapshotUpdateBlocks } from './util'

const token = process.env.APPLE_WEATHER_TOKEN!

describe('lib/notion/update-upcoming-weather', () => {
  beforeEach(() => {
    // mock-fs defers its async callbacks with timers, so only Date is faked
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2022, 11, 28))
    // isolates these tests from any real data/weather-data.json on disk, so
    // they always fall back to the WEATHER_LOCATION env var
    mockFs({
      'test/fixtures': mockFs.load(path.resolve(process.cwd(), 'test/fixtures')),
    })
  })

  afterEach(() => {
    vi.useRealTimers()
    mockFs.restore()
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
    })

    await snapshot
  })

  it('does not update dates without weather data', async () => {
    const weather = fixtureContents('weather/weather')

    delete weather.currentWeather
    delete weather.forecastHourly
    delete weather.weatherAlerts

    nock('https://weatherkit.apple.com')
    .matchHeader('authorization', `Bearer ${token}`)
    .get(`${weatherUrlBasePath}&dataSets=forecastDaily`)
    .reply(200, weather)

    const questBlocks = [
      block.p({ text: 'Wed, 12/28' }),
      block.bullet({ text: 'A task' }),
      // 1/9 is beyond the weather forecast range (ends 1/6)
      block.p({ text: 'Mon, 1/9' }),
      block.bullet({ text: 'A task' }),
      block.toggle({ text: 'Upcoming', id: 'upcoming-id' }),
    ]

    const upcomingBlocks = [
      block.p({ text: 'Fri, 12/30' }),
      block.bullet({ text: 'A task' }),
    ]

    nockGetBlockChildren('quests-id', { reply: { results: questBlocks } })
    nockGetBlockChildren('upcoming-id', { reply: { results: upcomingBlocks } })

    // Only 12/28 and 12/30 should be updated (not 1/9)
    const snapshot = snapshotUpdateBlocks([
      'block-25',
      'block-30',
    ])

    await updateWeather({
      notionToken: 'notion-token',
      questsId: 'quests-id',
    })

    await snapshot
  })
  it('uses the location set in the admin page instead of the environment variable', async () => {
    const weather = fixtureContents('weather/weather')

    delete weather.currentWeather
    delete weather.forecastHourly
    delete weather.weatherAlerts

    const weatherScope = nock('https://weatherkit.apple.com')
    .matchHeader('authorization', `Bearer ${token}`)
    .get(`${weatherUrlBasePath.replace('/en/lat/lng', '/en/40.1/-80.2')}&dataSets=forecastDaily`)
    .reply(200, weather)

    const questBlocks = [
      block.p({ text: 'Wed, 12/28' }),
      block.bullet({ text: 'A task' }),
      block.toggle({ text: 'Upcoming', id: 'upcoming-id' }),
    ]

    nockGetBlockChildren('quests-id', { reply: { results: questBlocks } })
    nockGetBlockChildren('upcoming-id', { reply: { results: [] } })

    nock('https://api.notion.com')
    .patch(/.*/)
    .reply(200)

    mockFs({
      'data': {
        'weather-data.json': JSON.stringify({
          location: { coordinates: '40.1,-80.2', name: 'Somewhere, PA' },
        }),
      },
    })

    await updateWeather({
      notionToken: 'notion-token',
      questsId: 'quests-id',
    })

    expect(weatherScope.isDone()).to.equal(true)
  })
})
