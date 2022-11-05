import nock from 'nock'
import { describe, expect, it } from 'vitest'

process.env.DARK_SKY_API_KEY = 'dark-sky-key'

import { notionFixture as fixture, nockUpdateBlock, snapshotBody } from '../../support/util'
import { updateWeather } from '../../../lib/notion/update-current-weather'

describe('lib/notion/update-current-weather', () => {
  it('updates the current weather block with temperature and conditions', async () => {
    nock('https://api.darksky.net')
    .get('/forecast/dark-sky-key/lat,lng?exclude=minutely,flags&extend=hourly')
    .replyWithFile(200, fixture('weather/weather'), {
      'Content-Type': 'application/json',
    })

    const scope = nockUpdateBlock('current-weather-id')
    const snapshotUpdate = snapshotBody(scope)

    await updateWeather({
      notionToken: 'notion-token',
      currentWeatherId: 'current-weather-id',
      weatherLocation: 'lat,lng',
    })

    await snapshotUpdate
  })
})
