import nock from 'nock'
import { describe, expect, it } from 'vitest'

import { handleServer } from '../util'
import { startServer } from '../../index'

const mapUrlBase = 'https://maps.visualcrossing.com'
const mapPath = '/VisualCrossingWebServices/rest/api/v1/map'

describe('lib/weather-map', () => {
  handleServer(startServer)

  describe('GET /weather-map/tile/:element/:z/:x/:y.:format', () => {
    it('returns tile image from Visual Crossing with api key', async (ctx) => {
      const image = Buffer.from('tile-image')

      nock(mapUrlBase)
      .get(`${mapPath}/tile/temp/6/17/24.webp`)
      .query({ apikey: 'visual-crossing-key', time: 'latest', unitGroup: 'us' })
      .reply(200, image)

      const res = await ctx.request.get('/weather-map/tile/temp/6/17/24.webp?time=latest&unitGroup=us')

      expect(res.status).to.equal(200)
      expect(res.headers['content-type']).to.equal('image/webp')
      expect(res.headers['cache-control']).to.equal('public, max-age=300')
      expect(res.body.toString()).to.equal('tile-image')
    })

    it('does not pass through unknown query params', async (ctx) => {
      nock(mapUrlBase)
      .get(`${mapPath}/tile/wind/6/17/24.png`)
      .query({ apikey: 'visual-crossing-key' })
      .reply(200, Buffer.from('tile-image'))

      const res = await ctx.request.get('/weather-map/tile/wind/6/17/24.png?__t=123&apikey=other')

      expect(res.status).to.equal(200)
      expect(res.headers['content-type']).to.equal('image/png')
    })

    it('sends 404 for unknown element', async (ctx) => {
      const res = await ctx.request.get('/weather-map/tile/nope/6/17/24.webp')

      expect(res.status).to.equal(404)
    })

    it('sends 404 for unknown format', async (ctx) => {
      const res = await ctx.request.get('/weather-map/tile/temp/6/17/24.geojson')

      expect(res.status).to.equal(404)
    })

    it('sends 404 for non-numeric coordinates', async (ctx) => {
      const res = await ctx.request.get('/weather-map/tile/temp/6/17/abc.webp')

      expect(res.status).to.equal(404)
    })

    it('sends upstream status if error', async (ctx) => {
      nock(mapUrlBase)
      .get(`${mapPath}/tile/temp/6/17/24.webp`)
      .query(true)
      .reply(429)

      const res = await ctx.request.get('/weather-map/tile/temp/6/17/24.webp')

      expect(res.status).to.equal(429)
    })

    it('sends 500 if error has no response', async (ctx) => {
      nock(mapUrlBase)
      .get(`${mapPath}/tile/temp/6/17/24.webp`)
      .query(true)
      .replyWithError('network error')

      const res = await ctx.request.get('/weather-map/tile/temp/6/17/24.webp')

      expect(res.status).to.equal(500)
    })
  })

  describe('GET /weather-map/legend/:element', () => {
    it('returns legend from Visual Crossing with api key', async (ctx) => {
      const legend = [{ min: 0, max: 11.18, color: '#cdeaf3', label: '0–12 mph' }]

      nock(mapUrlBase)
      .get(`${mapPath}/legend/wind`)
      .query({ apikey: 'visual-crossing-key', unitGroup: 'us' })
      .reply(200, legend)

      const res = await ctx.request.get('/weather-map/legend/wind?unitGroup=us')

      expect(res.status).to.equal(200)
      expect(res.body).to.deep.equal(legend)
    })

    it('sends 404 for unknown element', async (ctx) => {
      const res = await ctx.request.get('/weather-map/legend/nope')

      expect(res.status).to.equal(404)
    })

    it('sends 500 with error if error', async (ctx) => {
      nock(mapUrlBase)
      .get(`${mapPath}/legend/temp`)
      .query(true)
      .reply(500, { message: 'could not get legend' })

      const res = await ctx.request.get('/weather-map/legend/temp')

      expect(res.status).to.equal(500)
      expect(res.body.data).to.deep.equal({ message: 'could not get legend' })
    })
  })
})
