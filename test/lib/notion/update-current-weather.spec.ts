import nock from 'nock'
import { describe, it } from 'vitest'

process.env.DARK_SKY_API_KEY = 'dark-sky-key'

import { notionFixture as fixture, nockUpdateBlock } from '../../support/util'
import main from '../../../lib/notion/update-current-weather'

describe('lib/notion/update-current-weather', () => {
  it('updates the current weather block with temperature and conditions', async () => {
    nock('https://api.darksky.net')
    .get('/forecast/dark-sky-key/lat,lng?exclude=minutely,flags&extend=hourly')
    .replyWithFile(200, fixture('weather/weather'), {
      'Content-Type': 'application/json',
    })

    nockUpdateBlock('current-weather-id', {
      fixture: 'weather/current-weather-update',
    })

    await main.updateWeather({
      notionToken: 'notion-token',
      currentWeatherId: 'current-weather-id',
      weatherLocation: 'lat,lng',
    })
  })
})
