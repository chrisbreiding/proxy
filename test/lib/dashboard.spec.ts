import {
  describe,
  it,
  expect,
  vi,
} from 'vitest'

import { handleServer } from '../support/setup'

import { getGarageData } from '../../lib/garage'
import { getNotionData } from '../../lib/notion'
import { getWeatherData } from '../../lib/weather'

// TODO: use nock instead of mocking

vi.mock('../../lib/garage', () => {
  return {
    getGarageData: vi.fn(),
    get: () => {},
    set: () => {},
    setNotifyOnOpen: () => {},
    view: () => {},
  }
})

vi.mock('../../lib/notion', () => {
  return {
    getNotionData: vi.fn(),
    upcomingWeekView: () => {},
    addUpcomingWeek: () => {},
    onSocket: () => {},
  }
})

vi.mock('../../lib/weather', () => {
  return {
    getWeatherData: vi.fn(),
    get: () => {},
  }
})

import { startServer } from '../../index'

describe('lib/dashboard', () => {
  describe('GET /dashboard/:key', () => {
    handleServer(startServer)

    it('returns garage, notion, and weather data', async (ctx) => {
      process.env.API_KEY = 'key'

      const garageData = {}
      const notionData = {}
      const weatherData = {}

      // @ts-ignore
      getGarageData.mockResolvedValue(garageData)
      // @ts-ignore
      getNotionData.mockResolvedValue(notionData)
      // @ts-ignore
      getWeatherData.mockResolvedValue(weatherData)

      const res = await ctx.request.get('/dashboard/key?location=lat,lng&notionToken=token&notionPageId=page-id')

      expect(res.status).to.equal(200)
      expect(res.body).to.deep.equal({
        garage: { data: garageData },
        notion: { data: notionData },
        weather: { data: weatherData },
      })
    })

    it('returns individual error instead of data', async (ctx) => {
      process.env.API_KEY = 'key'

      const garageError = {
        name: 'Error',
        message: 'failed',
        stack: 'the stack',
      }
      const notionData = {}
      const weatherData = {}

      // @ts-ignore
      getGarageData.mockRejectedValue(garageError)
      // @ts-ignore
      getNotionData.mockResolvedValue(notionData)
      // @ts-ignore
      getWeatherData.mockResolvedValue(weatherData)

      const res = await ctx.request.get('/dashboard/key?location=lat,lng&notionToken=token&notionPageId=page-id')

      expect(res.status).to.equal(200)
      expect(res.body).to.deep.equal({
        garage: garageError,
        notion: { data: notionData },
        weather: { data: weatherData },
      })
    })

    it('status 403 if key does not match', async (ctx) => {
      process.env.API_KEY = 'key'

      const res = await ctx.request.get('/dashboard/nope')

      expect(res.status).to.equal(403)
    })
  })
})
