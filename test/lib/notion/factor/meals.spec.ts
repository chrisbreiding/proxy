import nock from 'nock'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

process.env.API_KEY = 'key'
process.env.NOTION_TOKEN = 'notion-token'
process.env.NOTION_FACTOR_MEALS_DATABASE_ID = 'meals-id'

import { startServer } from '../../../../index'
import { nockNotion, notionFixtureContents } from '../util'
import { handleServer, snapshotBody } from '../../../util'

class RequestError extends Error {
  constructor (message: string, extras: object) {
    super(message)

    Object.assign(this, extras)
  }
}

describe('lib/notion/factor/meals', () => {
  handleServer(startServer)

  describe('GET /notion/factor-meals/:key', () => {
    it('returns factor meals', async (ctx) => {
      nockNotion({
        method: 'post',
        path: '/v1/databases/meals-id/query',
        fixture: 'factor/meals-2',
      })

      const res = await ctx.request.get('/notion/factor-meals/key')

      expect(res.status).to.equal(200)
      expect(res.body).toMatchSnapshot()
    })

    it('returns factor meals with multiple pages of meals', async (ctx) => {
      nockNotion({
        method: 'post',
        path: '/v1/databases/meals-id/query',
        fixture: 'factor/meals',
      })

      nockNotion({
        method: 'post',
        path: '/v1/databases/meals-id/query',
        fixture: 'factor/meals-2',
        body: { start_cursor: 'meals-2' },
      })

      const res = await ctx.request.get('/notion/factor-meals/key')

      expect(res.status).to.equal(200)
      expect(res.body).toMatchSnapshot()
    })

    it('sends 500 with error if request errors', async (ctx) => {
      const error = new RequestError('notion error', {
        code: 42,
        response: {
          data: 'error data',
        },
      })

      nockNotion({
        error,
        method: 'post',
        path: '/v1/databases/meals-id/query',
      })

      const res = await ctx.request.get('/notion/factor-meals/key')

      expect(res.status).to.equal(500)
      expect(res.body).to.deep.equal({
        error: {
          code: 42,
          message: 'notion error',
        },
        data: 'error data',
      })
    })

    it('status 403 if key does not match', async (ctx) => {
      const res = await ctx.request.get('/notion/factor-meals/nope')

      expect(res.status).to.equal(403)
    })
  })

  describe('POST /notion/factor-meals/:key', () => {
    beforeEach(() => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date(2021, 10, 24))
    })

    afterEach(() => {
      vi.useRealTimers()
      nock.cleanAll()
    })

    it('adds meal to database', async (ctx) => {
      snapshotBody(nockNotion({
        method: 'post',
        path: '/v1/pages',
      }))

      const res = await ctx.request.post('/notion/factor-meals/key')
      .send({
        date: 'Thu, Dec 1',
        description: 'meal description',
        name: 'meal name',
        rating: 'Considering',
      })

      expect(res.status).to.equal(200)
      expect(res.body).to.deep.equal({})
    })

    it('uses the right year for "earlier" month', async (ctx) => {
      snapshotBody(nockNotion({
        method: 'post',
        path: '/v1/pages',
      }))

      const res = await ctx.request.post('/notion/factor-meals/key')
      .send({
        date: 'Wed, Jan 18',
        description: 'meal description',
        name: 'meal name',
        rating: 'Uninterested',
      })

      expect(res.status).to.equal(200)
      expect(res.body).to.deep.equal({})
    })

    it('date can be omitted', async (ctx) => {
      snapshotBody(nockNotion({
        method: 'post',
        path: '/v1/pages',
      }))

      const res = await ctx.request.post('/notion/factor-meals/key')
      .send({
        name: 'meal name',
        description: 'meal description',
        rating: 'Diet-restricted',
      })

      expect(res.status).to.equal(200)
      expect(res.body).to.deep.equal({})
    })

    it('sends 500 with error if request errors', async (ctx) => {
      const error = new RequestError('notion error', {
        code: 42,
        response: {
          data: 'error data',
        },
      })

      nockNotion({
        error,
        method: 'post',
        path: '/v1/pages',
      })

      const res = await ctx.request.post('/notion/factor-meals/key')
      .send({
        name: 'meal name',
        description: 'meal description',
        date: 'Wed, Jan 18',
      })

      expect(res.status).to.equal(500)
      expect(res.body).to.deep.equal({
        error: {
          code: 42,
          message: 'notion error',
        },
        data: 'error data',
      })
    })

    it('status 403 if key does not match', async (ctx) => {
      const res = await ctx.request.post('/notion/factor-meals/nope')

      expect(res.status).to.equal(403)
    })
  })
})
