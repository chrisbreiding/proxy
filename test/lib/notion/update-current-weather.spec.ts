import nock from 'nock'
import { describe, it } from 'vitest'

process.env.DARK_SKY_API_KEY = 'dark-sky-key'

import {
  notionFixture as fixture,
  nockUpdateBlock,
  snapshotBody,
  nockNotion,
  nockGetBlockChildren,
  nockAppendBlockChildren,
} from './util'
import { updateWeather } from '../../../lib/notion/update-current-weather'

describe('lib/notion/update-current-weather', () => {
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
})
