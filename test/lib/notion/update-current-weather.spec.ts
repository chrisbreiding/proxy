import nock from 'nock'
import { describe, it } from 'vitest'

process.env.DARK_SKY_API_KEY = 'dark-sky-key'

import { fixture, nockUpdateBlock } from '../../support/util'
import weather from '../../../lib/notion/update-current-weather'

describe('lib/notion/update-current-weather', () => {
  it('appends blocks in the drop zone based on the year template patterns and year extras', async () => {
    nock('https://api.darksky.net')
    .get('/forecast/dark-sky-key/lat,lng?exclude=minutely,flags&extend=hourly')
    .replyWithFile(200, fixture('weather/weather'), {
      'Content-Type': 'application/json',
    })

    nockUpdateBlock('current-weather-id', {
      fixture: 'weather/current-weather-update',
    })

    await weather.updateWeather({
      notionToken: 'notion-token',
      currentWeatherId: 'current-weather-id',
      weatherLocation: 'lat,lng',
    })
  })
})
