import nock from 'nock'
import { describe, expect, it } from 'vitest'

import { handleServer } from '../util'
import { startServer } from '../../index'

function createError () {
  const error = new Error('failed') as Error & { response: { status: number, data: any } }

  error.response = {
    status: 401,
    data: {
      more: 'info',
    },
  }

  return error
}

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

    it('sends 500 on error', async (ctx) => {
      const error = createError()

      nock('https://prod-hal-api.homeatlastdogrescue.com')
      .get('/dogs/1234')
      .replyWithError(error)

      const res = await ctx.request.get('/dogs/1234')

      expect(res.status).to.equal(500)
      expect(res.body.error.message).to.equal('failed')
      expect(res.body.data).to.deep.equal({ more: 'info' })
    })
  })

  describe('GET /dogs', () => {
    const query = '?includePhotos=true'

    handleServer(startServer)

    it('returns dogs from HAL', async (ctx) => {
      nock('https://prod-hal-api.homeatlastdogrescue.com')
      .get(`/dogs/search${query}`)
      .reply(200, { results: [] })

      const res = await ctx.request.get(`/dogs${query}`)

      expect(res.status).to.equal(200)
      expect(res.body).to.deep.equal({ results: [] })
    })

    it('sends 500 on error', async (ctx) => {
      const error = createError()

      nock('https://prod-hal-api.homeatlastdogrescue.com')
      .get(`/dogs/search${query}`)
      .replyWithError(error)

      const res = await ctx.request.get(`/dogs${query}`)

      expect(res.status).to.equal(500)
      expect(res.body.error.message).to.equal('failed')
      expect(res.body.data).to.deep.equal({ more: 'info' })
    })
  })
})
