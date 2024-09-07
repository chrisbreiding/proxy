import nock from 'nock'
import { describe, expect, it } from 'vitest'

import { handleServer } from '../util'
import { startServer } from '../../index'

describe('lib/dogs', () => {
  describe('GET /dogs/:id', () => {
    handleServer(startServer)

    it('returns dog from HAL', async (ctx) => {
      nock('https://prod-hal-api.homeatlastdogrescue.com')
      .get('/dogs/1234')
      .reply(200, { id: 1234 })

      const res = await ctx.request.get('/dogs/1234')

      expect(res.status).to.equal(200)
      expect(res.body).to.deep.equal({ id: 1234 })
    })
  })

  describe('GET /dogs', () => {
    handleServer(startServer)

    it('returns dogs from HAL', async (ctx) => {
      const query = '?includePhotos=true'

      nock('https://prod-hal-api.homeatlastdogrescue.com')
      .get(`/dogs/search${query}`)
      .reply(200, { results: [] })

      const res = await ctx.request.get(`/dogs${query}`)

      expect(res.status).to.equal(200)
      expect(res.body).to.deep.equal({ results: [] })
    })
  })
})
