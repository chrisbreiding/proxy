import mockFs from 'mock-fs'
import nock from 'nock'
import {
  afterAll,
  describe,
  expect,
  it,
} from 'vitest'

process.env.API_KEY = 'key'
process.env.DARK_SKY_API_KEY = 'dark-sky-key'

import { startServer } from '../../index'
import { nockGetBlockChildren } from './notion/util'
import { handleServer } from '../support/util'

describe('lib/dashboard', () => {
  describe('GET /dashboard/:key', () => {
    handleServer(startServer)

    afterAll(() => {
      mockFs.restore()
    })

    it('returns garage, notion, and weather data', async (ctx) => {
      nockGetBlockChildren('quests-id', { reply: { results: [] } })

      nock('https://api.darksky.net')
      .get('/forecast/dark-sky-key/lat,lng?exclude=minutely,flags&extend=hourly')
      .reply(200, { weather: 'data' })

      mockFs({
        'data': {
          'garage-data.json': JSON.stringify({ garage: 'data' }),
        },
      })

      const res = await ctx.request.get('/dashboard/key?location=lat,lng&notionToken=notion-token&notionPageId=quests-id')

      expect(res.status).to.equal(200)
      expect(res.body.garage).to.deep.equal({ data: { garage: 'data' } })
      expect(res.body.notion).to.deep.equal({ data: [] })
      expect(res.body.weather).to.deep.equal({ data: { weather: 'data' } })
    })

    it('returns individual error instead of data', async (ctx) => {
      nockGetBlockChildren('quests-id', { reply: { results: [] } })

      nock('https://api.darksky.net')
      .get('/forecast/dark-sky-key/lat,lng?exclude=minutely,flags&extend=hourly')
      .reply(500, {
        message: 'could not get weather',
      })

      mockFs({
        'data': {
          'garage-data.json': JSON.stringify({ garage: 'data' }),
        },
      })

      const res = await ctx.request.get('/dashboard/key?location=lat,lng&notionToken=notion-token&notionPageId=quests-id')

      expect(res.status).to.equal(200)
      expect(res.body.garage).to.deep.equal({ data: { garage: 'data' } })
      expect(res.body.notion).to.deep.equal({ data: [] })

      expect(res.body.weather.message).to.equal('Request failed with status code 500')
      expect(res.body.weather.status).to.equal(500)
      expect(res.body.weather.response).to.deep.equal({ message: 'could not get weather' })
    })

    it('status 403 if key does not match', async (ctx) => {
      const res = await ctx.request.get('/dashboard/nope')

      expect(res.status).to.equal(403)
    })
  })
})
