import nock from 'nock'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

process.env.DARK_SKY_API_KEY = 'dark-sky-key'

import { updateWeather } from '../../../lib/notion/update-current-weather'
import type { WeatherIcon } from '../../../lib/weather'
import { getBody } from '../../util'
import {
  nockGetBlockChildren,
  nockUpdateBlock,
  notionFixtureContents as fixtureContents,
} from './util'

interface WeatherProps {
  temperature?: number
  icon?: WeatherIcon
  precipProbability?: number
  precipAccumulation?: number
}

describe('lib/notion/update-current-weather', () => {
  function makeTableRows () {
    return {
      results: Array(8).fill(1).map((_, i) => (
        { id: `row-${i + 1}`, type: 'table_row', table_row: {} }
      )),
    }
  }

  function nockWeather (props: WeatherProps = {}) {
    const weather = fixtureContents('weather/weather')

    weather.currently = {
      ...weather.currently,
      ...props,
    }

    nock('https://api.darksky.net')
    .get('/forecast/dark-sky-key/lat,lng?exclude=minutely,flags&extend=hourly')
    .reply(200, weather)
  }

  function nockItUp (props?: WeatherProps) {
    nockWeather(props)

    const tableRows = makeTableRows()

    nockGetBlockChildren('current-weather-id', { fixture: 'weather/current-weather-children' })
    nockGetBlockChildren('table-id', { reply: tableRows })

    return [
      getBody(nockUpdateBlock('current-weather-id')),
      getBody(nockUpdateBlock('row-1')),
      getBody(nockUpdateBlock('row-2')),
      getBody(nockUpdateBlock('row-3')),
      getBody(nockUpdateBlock('row-4')),
      getBody(nockUpdateBlock('row-5')),
      getBody(nockUpdateBlock('row-6')),
      getBody(nockUpdateBlock('row-7')),
      getBody(nockUpdateBlock('row-8')),
      getBody(nockUpdateBlock('updated-id')),
    ]
  }

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2022, 11, 1))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('updates the current weather block and daily weather table', async () => {
    const getBodies = nockItUp()

    await updateWeather({
      notionToken: 'notion-token',
      currentWeatherId: 'current-weather-id',
      location: 'lat,lng',
    })

    const bodies = await Promise.all(getBodies)

    expect(bodies).toMatchSnapshot()
  })

  it('colors cool temperature blue', async () => {
    const getBodies = nockItUp({ temperature: 40 })

    await updateWeather({
      notionToken: 'notion-token',
      currentWeatherId: 'current-weather-id',
      location: 'lat,lng',
    })

    const bodies = await Promise.all(getBodies)

    expect(bodies[0]).toMatchSnapshot()
  })

  it('colors warm temperature green', async () => {
    const getBodies = nockItUp({ temperature: 60 })

    await updateWeather({
      notionToken: 'notion-token',
      currentWeatherId: 'current-weather-id',
      location: 'lat,lng',
    })

    const bodies = await Promise.all(getBodies)

    expect(bodies[0]).toMatchSnapshot()
  })

  it('colors hot temperature orange', async () => {
    const getBodies = nockItUp({ temperature: 85 })

    await updateWeather({
      notionToken: 'notion-token',
      currentWeatherId: 'current-weather-id',
      location: 'lat,lng',
    })

    const bodies = await Promise.all(getBodies)

    expect(bodies[0]).toMatchSnapshot()
  })

  it('colors sweltering temperature red', async () => {
    const getBodies = nockItUp({ temperature: 100 })

    await updateWeather({
      notionToken: 'notion-token',
      currentWeatherId: 'current-weather-id',
      location: 'lat,lng',
    })

    const bodies = await Promise.all(getBodies)

    expect(bodies[0]).toMatchSnapshot()
  })

  it('displays rain icon and probability if rain', async () => {
    const getBodies = nockItUp({
      icon: 'rain',
      precipProbability: 0.45,
    })

    await updateWeather({
      notionToken: 'notion-token',
      currentWeatherId: 'current-weather-id',
      location: 'lat,lng',
    })

    const bodies = await Promise.all(getBodies)

    expect(bodies[0]).toMatchSnapshot()
  })

  it('displays snow icon and accumulation if snow', async () => {
    const getBodies = nockItUp({
      icon: 'snow',
      precipAccumulation: 2,
    })

    await updateWeather({
      notionToken: 'notion-token',
      currentWeatherId: 'current-weather-id',
      location: 'lat,lng',
    })

    const bodies = await Promise.all(getBodies)

    expect(bodies[0]).toMatchSnapshot()
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
      {
        type: 'paragraph',
        paragraph: {},
      },
      {
        type: 'paragraph',
        paragraph: {},
      },
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
      {
        type: 'table',
        table: {},
      },
      {
        type: 'table',
        table: {},
      },
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
