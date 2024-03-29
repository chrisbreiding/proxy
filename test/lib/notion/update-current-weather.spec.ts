import nock from 'nock'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const token = process.env.APPLE_WEATHER_TOKEN = 'token'

import { updateWeather } from '../../../lib/notion/update-current-weather'
import type { ConditionCode } from '../../../lib/weather'
import { fixtureContents, weatherUrlBasePath } from '../../util'
import { block, nockGetBlockChildren, nockUpdateBlock, snapshotUpdateBlocks } from './util'

interface WeatherProps {
  conditionCode?: ConditionCode
  precipitationAmount?: number
  precipitationChance?: number
  temperature?: number
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

    weather.currentWeather = {
      ...weather.currentWeather,
      temperature: props.temperature || weather.currentWeather.temperature,
      conditionCode: props.conditionCode || weather.currentWeather.conditionCode,
    }

    if (props.precipitationAmount || props.precipitationChance) {
      weather.forecastHourly = {
        hours: [
          {
            ...weather.forecastHourly.hours[0],
            precipitationAmount: props.precipitationAmount,
            precipitationChance: props.precipitationChance,
          },
        ],
      }
    }

    delete weather.weatherAlerts

    nock('https://weatherkit.apple.com')
    .matchHeader('authorization', `Bearer ${token}`)
    .get(`${weatherUrlBasePath}&dataSets=currentWeather,forecastDaily,forecastHourly&hourlyStart=2022-12-28T05:00:00.000Z&hourlyEnd=2022-12-28T06:00:00.000Z`)
    .reply(200, weather)
  }

  function nockItUp (props?: WeatherProps) {
    nockWeather(props)

    const tableRows = makeTableRows()

    nockGetBlockChildren('current-weather-id', { fixture: 'weather/current-weather-children' })
    nockGetBlockChildren('table-id', { reply: tableRows })

    return snapshotUpdateBlocks([
      'current-weather-id',
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

  function toCelsius (fahrenheit: number) {
    return (fahrenheit - 32) / 1.8
  }

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2022, 11, 28))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('updates the current weather block and daily weather table', async () => {
    const snapshot = nockItUp({ conditionCode: 'Blizzard' })

    await updateWeather({
      notionToken: 'notion-token',
      currentWeatherId: 'current-weather-id',
      location: 'lat,lng',
    })

    await snapshot
  })

  it('colors cool temperature blue', async () => {
    const snapshot = nockItUp({
      // @ts-expect-error
      conditionCode: 'Other',
      temperature: toCelsius(40),
    })

    await updateWeather({
      notionToken: 'notion-token',
      currentWeatherId: 'current-weather-id',
      location: 'lat,lng',
    })

    await snapshot
  })

  it('colors warm temperature green', async () => {
    const snapshot = nockItUp({
      conditionCode: 'Cloudy',
      temperature: toCelsius(60),
    })

    await updateWeather({
      notionToken: 'notion-token',
      currentWeatherId: 'current-weather-id',
      location: 'lat,lng',
    })

    await snapshot
  })

  it('colors hot temperature orange', async () => {
    const snapshot = nockItUp({ temperature: toCelsius(85) })

    await updateWeather({
      notionToken: 'notion-token',
      currentWeatherId: 'current-weather-id',
      location: 'lat,lng',
    })

    await snapshot
  })

  it('colors sweltering temperature red', async () => {
    const snapshot = nockItUp({
      temperature: toCelsius(100),
      conditionCode: 'MixedSnowAndSleet',
    })

    await updateWeather({
      notionToken: 'notion-token',
      currentWeatherId: 'current-weather-id',
      location: 'lat,lng',
    })

    await snapshot
  })

  it('displays rain icon and probability if rain', async () => {
    const snapshot = nockItUp({
      conditionCode: 'Rain',
      precipitationChance: 0.45,
    })

    await updateWeather({
      notionToken: 'notion-token',
      currentWeatherId: 'current-weather-id',
      location: 'lat,lng',
    })

    await snapshot
  })

  it('displays snow icon and accumulation if snow', async () => {
    const snapshot = nockItUp({
      conditionCode: 'Snow',
      precipitationAmount: 25,
    })

    await updateWeather({
      notionToken: 'notion-token',
      currentWeatherId: 'current-weather-id',
      location: 'lat,lng',
    })

    await snapshot
  })

  it('errors if current weather block does not have exactly 2 children', async () => {
    nockWeather()
    nockGetBlockChildren('current-weather-id', { reply: { results: [] } })
    nockUpdateBlock('current-weather-id')

    await expect(() => updateWeather({
      notionToken: 'notion-token',
      currentWeatherId: 'current-weather-id',
      location: 'lat,lng',
    })).rejects.toThrowError('Expected current weather block to have 2 children, a table block and a paragraph block')
  })

  it('errors if first child of current weather block is not a table', async () => {
    nockWeather()
    nockGetBlockChildren('current-weather-id', { reply: { results: [
      block.p(),
      block.p(),
    ] } })
    nockUpdateBlock('current-weather-id')

    await expect(() => updateWeather({
      notionToken: 'notion-token',
      currentWeatherId: 'current-weather-id',
      location: 'lat,lng',
    })).rejects.toThrowError('Expected first block to be a table, but it is a \'paragraph\'')
  })

  it('errors if second child of current weather block is not a table', async () => {
    nockWeather()
    nockGetBlockChildren('current-weather-id', { reply: { results: [
      block({ type: 'table', content: {} }),
      block({ type: 'table', content: {} }),
    ] } })
    nockUpdateBlock('current-weather-id')

    await expect(() => updateWeather({
      notionToken: 'notion-token',
      currentWeatherId: 'current-weather-id',
      location: 'lat,lng',
    })).rejects.toThrowError('Expected second block to be a paragraph, but it is a \'table\'')
  })

  it('errors if table does not have 8 rows', async () => {
    nockWeather()
    nockGetBlockChildren('current-weather-id', { fixture: 'weather/current-weather-children' })
    nockGetBlockChildren('table-id', { reply: { results: [] } })

    nockUpdateBlock('current-weather-id')

    await expect(() => updateWeather({
      notionToken: 'notion-token',
      currentWeatherId: 'current-weather-id',
      location: 'lat,lng',
    })).rejects.toThrowError('Expected table to have 8 rows, but it has 0')
  })
})
