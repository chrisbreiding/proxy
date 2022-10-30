import {
  describe,
  it,
  expect,
  vi,
} from 'vitest'

import { handleServer } from '../support/setup'

const garage = require('../../lib/garage')
const notion = require('../../lib/notion')
const weather = require('../../lib/weather')

import { startServer } from '../../index'

describe('lib/dashboard', () => {
  describe('GET /dashboard/:key', () => {
    handleServer(startServer)

    it('returns garage, notion, and weather data', async (ctx) => {
      process.env.API_KEY = 'key'

      const garageData = {}
      const notionData = {}
      const weatherData = {}

      garage.getData = vi.fn().mockResolvedValue(garageData)
      notion.getData = vi.fn().mockResolvedValue(notionData)
      weather.getData = vi.fn().mockResolvedValue(weatherData)

      const res = await ctx.request.get('/dashboard/key')

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

      garage.getData = vi.fn().mockRejectedValue(garageError)
      notion.getData = vi.fn().mockResolvedValue(notionData)
      weather.getData = vi.fn().mockResolvedValue(weatherData)

      const res = await ctx.request.get('/dashboard/key')

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
