import mockFs from 'mock-fs'
import nock from 'nock'
import path from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { updateWeather } from '../../../lib/notion/update-current-weather'
import type { SourceIcon } from '../../../lib/weather'
import { fixtureContents, weatherPath, weatherUrlBase } from '../../util'
import { block, nockGetBlockChildren, nockUpdateBlock, snapshotUpdateBlocks } from './util'

interface WeatherProps {
  icon?: SourceIcon
  precip?: number
  precipprob?: number
  temp?: number
}

describe('lib/notion/update-current-weather', () => {
  function makeTableRows () {
    return {
      results: Array(8).fill(1).map((_, i) => (
        block({ id: `row-${i + 1}`, type: 'table_row', content: {} })
      )),
    }
  }

  function nockWeather (props: WeatherProps = {}) {
    const weather = fixtureContents('weather/weather')

    weather.currentConditions = {
      ...weather.currentConditions,
      temp: props.temp || weather.currentConditions.temp,
      icon: props.icon || weather.currentConditions.icon,
    }

    // the first hour is the current hour
    if (props.precip || props.precipprob) {
      weather.days[0].hours[0] = {
        ...weather.days[0].hours[0],
        precip: props.precip,
        precipprob: props.precipprob,
      }
    }

    delete weather.alerts

    nock(weatherUrlBase)
    .get(weatherPath({ include: 'current,days,hours' }))
    .reply(200, weather)
  }

  function nockItUp (props?: WeatherProps) {
    nockWeather(props)

    const tableRows = makeTableRows()

    nockGetBlockChildren('current-weather-id', { fixture: 'weather/current-weather-children' })
    nockGetBlockChildren('table-id', { reply: tableRows })

    return snapshotUpdateBlocks([
      'current-weather-id',
      'location-id',
      'row-1',
      'row-2',
      'row-3',
      'row-4',
      'row-5',
      'row-6',
      'row-7',
      'row-8',
      'updated-id',
    ])
  }

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

  it('updates the current weather block and daily weather table', async () => {
    const snapshot = nockItUp({ icon: 'snow' })

    await updateWeather({
      notionToken: 'notion-token',
      currentWeatherId: 'current-weather-id',
    })

    await snapshot
  })

  it('colors cool temperature blue', async () => {
    const snapshot = nockItUp({
      // @ts-expect-error
      icon: 'other',
      temp: 40,
    })

    await updateWeather({
      notionToken: 'notion-token',
      currentWeatherId: 'current-weather-id',
    })

    await snapshot
  })

  it('colors warm temperature green', async () => {
    const snapshot = nockItUp({
      icon: 'cloudy',
      temp: 60,
    })

    await updateWeather({
      notionToken: 'notion-token',
      currentWeatherId: 'current-weather-id',
    })

    await snapshot
  })

  it('colors hot temperature orange', async () => {
    const snapshot = nockItUp({ temp: 85 })

    await updateWeather({
      notionToken: 'notion-token',
      currentWeatherId: 'current-weather-id',
    })

    await snapshot
  })

  it('colors sweltering temperature red', async () => {
    const snapshot = nockItUp({
      temp: 100,
      icon: 'thunder-rain',
    })

    await updateWeather({
      notionToken: 'notion-token',
      currentWeatherId: 'current-weather-id',
    })

    await snapshot
  })

  it('displays rain icon and probability if rain', async () => {
    const snapshot = nockItUp({
      icon: 'rain',
      precipprob: 45,
    })

    await updateWeather({
      notionToken: 'notion-token',
      currentWeatherId: 'current-weather-id',
    })

    await snapshot
  })

  it('displays snow icon and accumulation if snow', async () => {
    const snapshot = nockItUp({
      icon: 'snow',
      precip: 0.98,
    })

    await updateWeather({
      notionToken: 'notion-token',
      currentWeatherId: 'current-weather-id',
    })

    await snapshot
  })

  it('uses the location set in the admin page instead of the environment variable', async () => {
    const weather = fixtureContents('weather/weather')

    delete weather.alerts

    const weatherScope = nock(weatherUrlBase)
    .get(weatherPath({ include: 'current,days,hours', location: '40.1,-80.2' }))
    .reply(200, weather)

    nockGetBlockChildren('current-weather-id', { fixture: 'weather/current-weather-children' })
    nockGetBlockChildren('table-id', { reply: makeTableRows() })

    nock('https://api.notion.com')
    .patch(/.*/)
    .times(11)
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
      currentWeatherId: 'current-weather-id',
    })

    expect(weatherScope.isDone()).to.equal(true)
  })

  it('errors if current weather block does not have exactly 3 children', async () => {
    nockWeather()
    nockGetBlockChildren('current-weather-id', { reply: { results: [] } })
    nockUpdateBlock('current-weather-id')

    await expect(() => updateWeather({
      notionToken: 'notion-token',
      currentWeatherId: 'current-weather-id',
    })).rejects.toThrowError('Expected current weather block to have 3 children, a paragraph block, a table block, and a paragraph block')
  })

  it('errors if first child of current weather block is not a paragraph', async () => {
    nockWeather()
    nockGetBlockChildren('current-weather-id', { reply: { results: [
      block({ type: 'table', content: {} }),
      block({ type: 'table', content: {} }),
      block.p(),
    ] } })
    nockUpdateBlock('current-weather-id')

    await expect(() => updateWeather({
      notionToken: 'notion-token',
      currentWeatherId: 'current-weather-id',
    })).rejects.toThrowError('Expected first block to be a paragraph, but it is a \'table\'')
  })

  it('errors if second child of current weather block is not a table', async () => {
    nockWeather()
    nockGetBlockChildren('current-weather-id', { reply: { results: [
      block.p(),
      block.p(),
      block.p(),
    ] } })
    nockUpdateBlock('current-weather-id')

    await expect(() => updateWeather({
      notionToken: 'notion-token',
      currentWeatherId: 'current-weather-id',
    })).rejects.toThrowError('Expected second block to be a table, but it is a \'paragraph\'')
  })

  it('errors if third child of current weather block is not a paragraph', async () => {
    nockWeather()
    nockGetBlockChildren('current-weather-id', { reply: { results: [
      block.p(),
      block({ type: 'table', content: {} }),
      block({ type: 'table', content: {} }),
    ] } })
    nockUpdateBlock('current-weather-id')

    await expect(() => updateWeather({
      notionToken: 'notion-token',
      currentWeatherId: 'current-weather-id',
    })).rejects.toThrowError('Expected third block to be a paragraph, but it is a \'table\'')
  })

  it('errors if table does not have 8 rows', async () => {
    nockWeather()
    nockGetBlockChildren('current-weather-id', { fixture: 'weather/current-weather-children' })
    nockGetBlockChildren('table-id', { reply: { results: [] } })

    nockUpdateBlock('current-weather-id')
    nockUpdateBlock('location-id')

    await expect(() => updateWeather({
      notionToken: 'notion-token',
      currentWeatherId: 'current-weather-id',
    })).rejects.toThrowError('Expected table to have 8 rows, but it has 0')
  })
})
