import nock from 'nock'
import { describe, it } from 'vitest'

process.env.DARK_SKY_API_KEY = 'dark-sky-key'

import { updateWeather } from '../../../lib/notion/update-current-weather'
import type { WeatherIcon } from '../../../lib/weather'
import { snapshotBody } from '../../util'
import {
  nockAppendBlockChildren,
  nockGetBlockChildren,
  nockNotion,
  nockUpdateBlock,
  notionFixture as fixture,
  notionFixtureContents as fixtureContents,
} from './util'

interface WeatherProps {
  temperature?: number
  icon?: WeatherIcon
  precipProbability?: number
  precipAccumulation?: number
}

describe('lib/notion/update-current-weather', () => {
  function nockCurrentWeather (props: WeatherProps) {
    const weather = fixtureContents('weather/weather')

    weather.currently = {
      ...weather.currently,
      ...props,
    }

    nock('https://api.darksky.net')
    .get('/forecast/dark-sky-key/lat,lng?exclude=minutely,flags&extend=hourly')
    .reply(200, weather)

    nockGetBlockChildren('current-weather-id', { fixture: 'weather/current-weather-children' })
    nockNotion({ path: '/v1/blocks/table-id', method: 'delete' })
    nockAppendBlockChildren({ id: 'current-weather-id' })

    return snapshotBody(nockUpdateBlock('current-weather-id'))
  }

  it('updates the current weather block with temperature and conditions', async () => {
    nock('https://api.darksky.net')
    .get('/forecast/dark-sky-key/lat,lng?exclude=minutely,flags&extend=hourly')
    .replyWithFile(200, fixture('weather/weather'), {
      'Content-Type': 'application/json',
    })

    nockGetBlockChildren('current-weather-id', { fixture: 'weather/current-weather-children' })
    nockNotion({ path: '/v1/blocks/table-id', method: 'delete' })

    const snapshots = [
      snapshotBody(nockUpdateBlock('current-weather-id'), 'heading-update'),
      snapshotBody(nockAppendBlockChildren({ id: 'current-weather-id' }), 'table-append'),
    ]

    await updateWeather({
      notionToken: 'notion-token',
      currentWeatherId: 'current-weather-id',
      location: 'lat,lng',
    })

    await Promise.all(snapshots)
  })

  it('colors cool temperature blue', async () => {
    const snapshot = nockCurrentWeather({ temperature: 40 })

    await updateWeather({
      notionToken: 'notion-token',
      currentWeatherId: 'current-weather-id',
      location: 'lat,lng',
    })

    await snapshot
  })

  it('colors warm temperature green', async () => {
    const snapshot = nockCurrentWeather({ temperature: 60 })

    await updateWeather({
      notionToken: 'notion-token',
      currentWeatherId: 'current-weather-id',
      location: 'lat,lng',
    })

    await snapshot
  })

  it('colors hot temperature orange', async () => {
    const snapshot = nockCurrentWeather({ temperature: 85 })

    await updateWeather({
      notionToken: 'notion-token',
      currentWeatherId: 'current-weather-id',
      location: 'lat,lng',
    })

    await snapshot
  })

  it('colors sweltering temperature red', async () => {
    const snapshot = nockCurrentWeather({ temperature: 100 })

    await updateWeather({
      notionToken: 'notion-token',
      currentWeatherId: 'current-weather-id',
      location: 'lat,lng',
    })

    await snapshot
  })

  it('displays rain icon and probability if rain', async () => {
    const snapshot = nockCurrentWeather({
      icon: 'rain',
      precipProbability: 0.45,
    })

    await updateWeather({
      notionToken: 'notion-token',
      currentWeatherId: 'current-weather-id',
      location: 'lat,lng',
    })

    await snapshot
  })

  it('displays snow icon and accumulation if snow', async () => {
    const snapshot = nockCurrentWeather({
      icon: 'snow',
      precipAccumulation: 2,
    })

    await updateWeather({
      notionToken: 'notion-token',
      currentWeatherId: 'current-weather-id',
      location: 'lat,lng',
    })

    await snapshot
  })
})
