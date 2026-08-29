import nock from 'nock'
import { describe, expect, it, vi } from 'vitest'

import { handleServer } from '../util'
import { startServer } from '../../index'
import { getLocationName } from '../../lib/location'

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

  describe('#getLocationName', () => {
    function nockGeocode (reply: object) {
      nock('https://maps.googleapis.com')
      .get('/maps/api/geocode/json?key=key&latlng=40.1%2C-80.2')
      .reply(200, reply)
    }

    function component (longName: string, shortName: string, ...types: string[]) {
      return { long_name: longName, short_name: shortName, types }
    }

    it('returns the city and state of the first result', async () => {
      nockGeocode({
        results: [
          {
            address_components: [
              component('123', '123', 'street_number'),
              component('Pittsburgh', 'Pittsburgh', 'locality', 'political'),
              component('Pennsylvania', 'PA', 'administrative_area_level_1', 'political'),
            ],
            formatted_address: '123 Main St, Pittsburgh, PA 15201, USA',
          },
        ],
      })

      expect(await getLocationName('40.1,-80.2')).to.equal('Pittsburgh, PA')
    })

    it('falls back to a sublocality when there is no locality', async () => {
      nockGeocode({
        results: [
          {
            address_components: [
              component('Brooklyn', 'Brooklyn', 'sublocality', 'political'),
              component('New York', 'NY', 'administrative_area_level_1', 'political'),
            ],
          },
        ],
      })

      expect(await getLocationName('40.1,-80.2')).to.equal('Brooklyn, NY')
    })

    it('falls back to the third-level area when there is no locality or sublocality', async () => {
      nockGeocode({
        results: [
          {
            address_components: [
              component('Ross Township', 'Ross Twp', 'administrative_area_level_3', 'political'),
              component('Pennsylvania', 'PA', 'administrative_area_level_1', 'political'),
            ],
          },
        ],
      })

      expect(await getLocationName('40.1,-80.2')).to.equal('Ross Township, PA')
    })

    it('falls back to the formatted address when the city or state is missing', async () => {
      nockGeocode({
        results: [
          {
            address_components: [
              component('Pennsylvania', 'PA', 'administrative_area_level_1', 'political'),
            ],
            formatted_address: 'Pennsylvania, USA',
          },
        ],
      })

      expect(await getLocationName('40.1,-80.2')).to.equal('Pennsylvania, USA')
    })

    it('falls back to the formatted address when there are no address components', async () => {
      nockGeocode({
        results: [{ formatted_address: 'Pennsylvania, USA' }],
      })

      expect(await getLocationName('40.1,-80.2')).to.equal('Pennsylvania, USA')
    })

    it('returns undefined when there are no results', async () => {
      nockGeocode({ results: [] })

      expect(await getLocationName('40.1,-80.2')).to.equal(undefined)
    })

    it('returns undefined when the response has no results property', async () => {
      nockGeocode({})

      expect(await getLocationName('40.1,-80.2')).to.equal(undefined)
    })
  })
})
