import nock from 'nock'
import { describe, expect, it, vi } from 'vitest'

process.env.GOOGLE_API_KEY = 'key'

import { handleServer } from '../support/setup'
import { startServer } from '../../index'

describe('lib/location', () => {
  handleServer(startServer)

  describe('GET /location-details', () => {
    it('returns location details when place id is specified', async (ctx) => {
      nock('https://maps.googleapis.com')
      .get('/maps/api/place/details/json?key=key&placeid=placeid')
      .reply(200, {
        the: 'location details',
      })

      const res = await ctx.request.get('/location-details?placeid=placeid')

      expect(res.status).to.equal(200)
      expect(res.body).to.deep.equal({
        the: 'location details',
      })
    })

    it('returns location details when latlng is specified', async (ctx) => {
      nock('https://maps.googleapis.com')
      .get('/maps/api/geocode/json?key=key&latlng=latlng')
      .reply(200, {
        the: 'location details',
      })

      const res = await ctx.request.get('/location-details?latlng=latlng')

      expect(res.status).to.equal(200)
      expect(res.body).to.deep.equal({
        the: 'location details',
      })
    })

    it('status 500 with error if error', async (ctx) => {
      nock('https://maps.googleapis.com')
      .get('/maps/api/place/details/json?key=key&placeid=placeid')
      .reply(500, {
        message: 'could not get location details',
      })

      const res = await ctx.request.get('/location-details?placeid=placeid')

      expect(res.status).to.equal(500)
      expect(res.body.data).to.deep.equal({
        message: 'could not get location details',
      })
      expect(res.body.error.code).to.equal('ERR_BAD_RESPONSE')
    })
  })

  describe('GET /location-search', () => {
    it('returns search results', async (ctx) => {
      nock('https://maps.googleapis.com')
      .get('/maps/api/place/autocomplete/json?key=key&input=query1')
      .reply(200, {
        the: 'query1 search results',
      })

      const res = await ctx.request.get('/location-search?query=query1')

      expect(res.status).to.equal(200)
      expect(res.body).to.deep.equal({
        the: 'query1 search results',
      })
    })

    it('returns cached results', async (ctx) => {
      const counter = vi.fn()

      nock('https://maps.googleapis.com')
      .get('/maps/api/place/autocomplete/json?key=key&input=query2')
      .reply(200, (_, __, cb) => {
        counter()

        cb(null, {
          the: 'query2 location data',
        })
      })

      const res1 = await ctx.request.get('/location-search?query=query2')
      const res2 = await ctx.request.get('/location-search?query=query2')

      expect(counter.mock.calls.length).to.equal(1)
      expect(res1.body).to.deep.equal({
        the: 'query2 location data',
      })
      expect(res2.body).to.deep.equal({
        the: 'query2 location data',
      })
    })

    it('status 500 with error if error', async (ctx) => {
      nock('https://maps.googleapis.com')
      .get('/maps/api/place/autocomplete/json?key=key&input=query3')
      .reply(500, {
        message: 'query3 could not get search results',
      })

      const res = await ctx.request.get('/location-search?query=query3')

      expect(res.status).to.equal(500)
      expect(res.body.data).to.deep.equal({
        message: 'query3 could not get search results',
      })
      expect(res.body.error.code).to.equal('ERR_BAD_RESPONSE')
    })
  })
})
