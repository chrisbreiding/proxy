import mockFs from 'mock-fs'
import nock from 'nock'
import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

process.env.API_KEY = 'key'
const token = process.env.APPLE_WEATHER_TOKEN = 'token'

import { startServer } from '../../index'
import { nockGetBlockChildren, nockNotion } from './notion/util'
import { fixtureContents, handleServer, weatherUrlBasePath } from '../util'

describe('lib/dashboard', () => {
  describe('GET /dashboard/:key', () => {
    handleServer(startServer)

    beforeEach(() => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date(2022, 11, 28))
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    afterAll(() => {
      mockFs.restore()
    })

    it('returns garage, quests, and beans data', async (ctx) => {
      nockGetBlockChildren('quests-id', { reply: { results: [] } })

      nock('https://weatherkit.apple.com')
      .matchHeader('authorization', `Bearer ${token}`)
      .get(`${weatherUrlBasePath}&dataSets=currentWeather,forecastHourly&hourlyStart=2022-12-28T05:00:00.000Z&hourlyEnd=2022-12-28T06:00:00.000Z`)
      .reply(200, fixtureContents('weather/weather'))

      nockNotion({
        method: 'post',
        path: '/v1/databases/beans-id/query',
        fixture: 'coffee/beans',
      })

      mockFs({
        'data': {
          'garage-data.json': JSON.stringify({ garage: 'data' }),
        },
      })

      const res = await ctx.request.get('/dashboard/key?location=lat,lng&notionToken=notion-token&notionQuestsId=quests-id&notionBeansId=beans-id')

      expect(res.status).to.equal(200)
      expect(res.body.garage).to.deep.equal({ data: { garage: 'data' } })
      expect(res.body.quests).to.deep.equal({ data: [] })
      expect(res.body.weather).toMatchInlineSnapshot(`
        {
          "data": {
            "apparentTemperature": 39.092,
            "icon": "clear",
            "precipAccumulation": 0.421259842519685,
            "precipProbability": 0.8,
            "summary": "Clear",
            "temperature": 23,
          },
        }
      `)
      expect(res.body.beans).toMatchSnapshot()
    })

    it('returns individual error instead of data', async (ctx) => {
      nockGetBlockChildren('quests-id', { reply: { results: [] } })

      nockNotion({
        method: 'post',
        path: '/v1/databases/beans-id/query',
        reply: { results: [] },
      })

      nock('https://weatherkit.apple.com')
      .matchHeader('authorization', `Bearer ${token}`)
      .get(`${weatherUrlBasePath}&dataSets=currentWeather,forecastHourly&hourlyStart=2022-12-28T05:00:00.000Z&hourlyEnd=2022-12-28T06:00:00.000Z`)
      .reply(500, { message: 'could not get weather' })

      mockFs({
        'data': {
          'garage-data.json': JSON.stringify({ garage: 'data' }),
        },
      })

      const res = await ctx.request.get('/dashboard/key?location=lat,lng&notionToken=notion-token&notionQuestsId=quests-id&notionBeansId=beans-id')

      expect(res.status).to.equal(200)
      expect(res.body.garage).to.deep.equal({ data: { garage: 'data' } })
      expect(res.body.quests).to.deep.equal({ data: [] })
      expect(res.body.beans).to.deep.equal({ data: [] })

      expect(res.body.weather.error).to.deep.equal({
        code: 'ERR_BAD_RESPONSE',
        message: 'Request failed with status code 500',
        name: 'AxiosError',
        response: { message: 'could not get weather' },
        status: 500,
        statusText: null,
      })
    })

    it('sends error if no location specified', async (ctx) => {
      const res = await ctx.request.get('/dashboard/key?notionToken=notion-token&notionQuestsId=quests-id&notionBeansId=beans-id')

      expect(res.status).to.equal(200)
      expect(res.body).to.deep.equal({ error: { message: 'Must include location in query' } })
    })

    it('sends error if no notionToken specified', async (ctx) => {
      const res = await ctx.request.get('/dashboard/key?location=lat,lng&notionQuestsId=quests-id&notionBeansId=beans-id')

      expect(res.status).to.equal(200)
      expect(res.body).to.deep.equal({ error: { message: 'Must include notionToken in query' } })
    })

    it('sends error if no notionQuestsId specified', async (ctx) => {
      const res = await ctx.request.get('/dashboard/key?location=lat,lng&notionToken=notion-token&notionBeansId=beans-id')

      expect(res.status).to.equal(200)
      expect(res.body).to.deep.equal({ error: { message: 'Must include notionQuestsId in query' } })
    })

    it('sends error if no notionBeansId specified', async (ctx) => {
      const res = await ctx.request.get('/dashboard/key?location=lat,lng&notionToken=notion-token&notionQuestsId=quests-id')

      expect(res.status).to.equal(200)
      expect(res.body).to.deep.equal({ error: { message: 'Must include notionBeansId in query' } })
    })

    it('sends 403 if key does not match', async (ctx) => {
      const res = await ctx.request.get('/dashboard/nope')

      expect(res.status).to.equal(403)
    })
  })
})
