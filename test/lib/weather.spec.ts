import nock from 'nock'
import {
  describe,
  expect,
  it,
} from 'vitest'

import { handleServer } from '../support/util'

process.env.DARK_SKY_API_KEY = 'key'

import { startServer } from '../../index'
import { getWeatherData } from '../../lib/weather'

describe('lib/weather', () => {
  describe('GET /weather', () => {
    handleServer(startServer)

    it('returns weather data from DarkSky', async (ctx) => {
      nock('https://api.darksky.net')
      .get('/forecast/key/location?exclude=minutely,flags&extend=hourly')
      .reply(200, {
        the: 'weather data',
      })

      const res = await ctx.request.get('/weather?location=location')

      expect(res.status).to.equal(200)
      expect(res.body).to.deep.equal({
        the: 'weather data',
      })
    })

    it('status 500 with error if error', async (ctx) => {
      nock('https://api.darksky.net')
      .get('/forecast/key/location?exclude=minutely,flags&extend=hourly')
      .reply(500, {
        message: 'could not get weather',
      })

      const res = await ctx.request.get('/weather?location=location')

      expect(res.status).to.equal(500)
      expect(res.body.data).to.deep.equal({
        message: 'could not get weather',
      })
      expect(res.body.error.code).to.equal('ERR_BAD_RESPONSE')
    })
  })

  describe('#getWeatherData', () => {
    it('returns weather data from DarkSky', async () => {
      nock('https://api.darksky.net')
      .get('/forecast/key/location?exclude=minutely,flags&extend=hourly')
      .reply(200, {
        the: 'weather data',
      })

      const result = await getWeatherData('location')

      expect(result).to.deep.equal({
        the: 'weather data',
      })
    })
  })
})
