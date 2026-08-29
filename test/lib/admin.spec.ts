import crypto from 'crypto'
import { readJsonSync } from 'fs-extra'
import mockFs from 'mock-fs'
import nock from 'nock'
import path from 'path'
import { afterEach, describe, expect, it, TestContext, vi } from 'vitest'

import { startServer } from '../../index'
import { getJobsData, jobs, PersistentDataStructure, setBree } from '../../lib/jobs'
import type { PersistentDataStructure as WeatherPersistentDataStructure } from '../../lib/weather-location'
import { handleServer } from '../util'

const geocodeResult = {
  results: [
    {
      address_components: [
        { long_name: 'Pittsburgh', short_name: 'Pittsburgh', types: ['locality', 'political'] },
        { long_name: 'Pennsylvania', short_name: 'PA', types: ['administrative_area_level_1', 'political'] },
      ],
      formatted_address: '123 Main St, Pittsburgh, PA 15201, USA',
    },
  ],
}

const location = {
  coordinates: '40.1,-80.2',
  name: 'Pittsburgh, PA',
}

const password = 'super-secret-password'
const passwordHash = crypto.createHash('sha256').update(password).digest('hex')

function getSessionToken (hash: string) {
  return crypto.createHmac('sha256', hash).update('admin_session').digest('hex')
}

function mockData (data: PersistentDataStructure | null, weatherData: WeatherPersistentDataStructure = {}) {
  mockFs({
    'data': {
      'jobs-data.json': JSON.stringify(data),
      'weather-data.json': JSON.stringify(weatherData),
    },
    'views': mockFs.load(path.resolve(process.cwd(), 'views')),
  })
}

function getWeatherData () {
  return readJsonSync('./data/weather-data.json')
}

function nockGeocode (reply: object) {
  return nock('https://maps.googleapis.com')
  .get('/maps/api/geocode/json?key=key&latlng=40.1%2C-80.2')
  .reply(200, reply)
}

async function login (ctx: TestContext) {
  const res = await ctx.request.post('/admin/login').send({ password })

  return res.headers['set-cookie'][0].split(';')[0]
}

describe('lib/admin', () => {
  handleServer(startServer)

  afterEach(() => {
    mockFs.restore()
    setBree(undefined)
    delete process.env.ADMIN_PASSWORD_HASH
    process.env.WEATHER_LOCATION = 'lat,lng'
  })

  describe('GET /admin', () => {
    it('renders the login view if not authenticated', async (ctx) => {
      mockData(null)

      const res = await ctx.request.get('/admin')

      expect(res.status).to.equal(200)
      expect(res.headers['content-type']).to.equal('text/html; charset=utf-8')
      expect(res.text).to.include('Log In')
    })

    it('renders the login view if the cookie does not match', async (ctx) => {
      process.env.ADMIN_PASSWORD_HASH = passwordHash
      mockData(null)

      const res = await ctx.request.get('/admin').set('Cookie', 'admin_session=nope')

      expect(res.status).to.equal(200)
      expect(res.text).to.include('Log In')
    })

    it('renders the login view if the cookie is the wrong length', async (ctx) => {
      process.env.ADMIN_PASSWORD_HASH = passwordHash
      mockData(null)

      const res = await ctx.request.get('/admin').set('Cookie', 'admin_session=short')

      expect(res.status).to.equal(200)
      expect(res.text).to.include('Log In')
    })

    it('renders the login view if no admin password is configured', async (ctx) => {
      mockData(null)

      const res = await ctx.request.get('/admin').set('Cookie', 'admin_session=nope')

      expect(res.status).to.equal(200)
      expect(res.text).to.include('Log In')
    })

    it('ignores cookie fragments without a name/value separator', async (ctx) => {
      process.env.ADMIN_PASSWORD_HASH = passwordHash
      mockData(null)

      const res = await ctx.request.get('/admin').set('Cookie', 'malformed; admin_session=nope')

      expect(res.status).to.equal(200)
      expect(res.text).to.include('Log In')
    })

    it('renders the login view if no cookie header is sent at all', async (ctx) => {
      process.env.ADMIN_PASSWORD_HASH = passwordHash
      mockData(null)

      const res = await ctx.request.get('/admin')

      expect(res.status).to.equal(200)
      expect(res.text).to.include('Log In')
    })

    it('renders the login view if the cookie header has no matching cookie', async (ctx) => {
      process.env.ADMIN_PASSWORD_HASH = passwordHash
      mockData(null)

      const res = await ctx.request.get('/admin').set('Cookie', 'foo=bar')

      expect(res.status).to.equal(200)
      expect(res.text).to.include('Log In')
    })

    it('renders the jobs view with the current job data if authenticated', async (ctx) => {
      process.env.ADMIN_PASSWORD_HASH = passwordHash
      mockData(null)

      const cookie = getSessionToken(passwordHash)
      const res = await ctx.request.get('/admin').set('Cookie', ` admin_session=${cookie} `)

      expect(res.status).to.equal(200)
      expect(res.text).to.include('id="jobs"')
      expect(res.text).to.include(jobs[0]!.name)
    })

    it('renders the weather location view with the current location if authenticated', async (ctx) => {
      process.env.ADMIN_PASSWORD_HASH = passwordHash
      mockData(null, { location })

      const cookie = getSessionToken(passwordHash)
      const res = await ctx.request.get('/admin').set('Cookie', `admin_session=${cookie}`)

      expect(res.status).to.equal(200)
      expect(res.text).to.include('id="weather"')
      expect(res.text).to.include(JSON.stringify({ location, defaultCoordinates: 'lat,lng' }))
    })

    it('escapes `<` in the serialized jobs data', async (ctx) => {
      process.env.ADMIN_PASSWORD_HASH = passwordHash
      mockData({
        jobs: [
          { name: jobs[0]!.name, fileName: jobs[0]!.fileName, enabled: true, interval: '</script><script>alert(1)</script>' },
        ],
      })

      const cookie = getSessionToken(passwordHash)
      const res = await ctx.request.get('/admin').set('Cookie', `admin_session=${cookie}`)

      expect(res.status).to.equal(200)
      expect(res.text).not.to.include('</script><script>alert')
      expect(res.text).to.include('\\u003c/script>\\u003cscript>alert')
    })
  })

  describe('POST /admin/login', () => {
    it('returns 500 if no admin password is configured', async (ctx) => {
      const res = await ctx.request.post('/admin/login').send({ password })

      expect(res.status).to.equal(500)
      expect(res.body).to.deep.equal({ error: 'No admin password is configured' })
    })

    it('returns 401 if the password is missing', async (ctx) => {
      process.env.ADMIN_PASSWORD_HASH = passwordHash

      const res = await ctx.request.post('/admin/login').send({})

      expect(res.status).to.equal(401)
      expect(res.body).to.deep.equal({ error: 'Incorrect password' })
    })

    it('returns 401 if no body is sent at all', async (ctx) => {
      process.env.ADMIN_PASSWORD_HASH = passwordHash

      const res = await ctx.request.post('/admin/login')

      expect(res.status).to.equal(401)
      expect(res.body).to.deep.equal({ error: 'Incorrect password' })
    })

    it('returns 401 if the password is incorrect', async (ctx) => {
      process.env.ADMIN_PASSWORD_HASH = passwordHash

      const res = await ctx.request.post('/admin/login').send({ password: 'wrong' })

      expect(res.status).to.equal(401)
      expect(res.body).to.deep.equal({ error: 'Incorrect password' })
    })

    it('sets a session cookie and returns ok if the password is correct', async (ctx) => {
      process.env.ADMIN_PASSWORD_HASH = passwordHash

      const res = await ctx.request.post('/admin/login').send({ password })

      expect(res.status).to.equal(200)
      expect(res.body).to.deep.equal({ ok: true })
      expect(res.headers['set-cookie'][0]).to.include(`admin_session=${getSessionToken(passwordHash)}`)
    })
  })

  describe('POST /admin/logout', () => {
    it('clears the session cookie and returns ok', async (ctx) => {
      const res = await ctx.request.post('/admin/logout')

      expect(res.status).to.equal(200)
      expect(res.body).to.deep.equal({ ok: true })
      expect(res.headers['set-cookie'][0]).to.include('admin_session=;')
    })
  })

  describe('GET /admin/jobs', () => {
    it('returns 401 if not authenticated', async (ctx) => {
      const res = await ctx.request.get('/admin/jobs')

      expect(res.status).to.equal(401)
      expect(res.body).to.deep.equal({ error: 'Not authenticated' })
    })

    it('returns the current job data if authenticated', async (ctx) => {
      process.env.ADMIN_PASSWORD_HASH = passwordHash
      mockData(null)

      const cookie = await login(ctx)
      const res = await ctx.request.get('/admin/jobs').set('Cookie', cookie)

      expect(res.status).to.equal(200)
      expect(res.body.jobs).to.deep.equal(await getJobsData())
    })
  })

  describe('POST /admin/jobs', () => {
    it('returns 401 if not authenticated', async (ctx) => {
      const res = await ctx.request.post('/admin/jobs').send({ jobs: [] })

      expect(res.status).to.equal(401)
      expect(res.body).to.deep.equal({ error: 'Not authenticated' })
    })

    it('returns 400 for an unknown job', async (ctx) => {
      process.env.ADMIN_PASSWORD_HASH = passwordHash
      mockData(null)

      const cookie = await login(ctx)
      const res = await ctx.request.post('/admin/jobs').set('Cookie', cookie).send({
        jobs: [{ fileName: 'does-not-exist', enabled: true }],
      })

      expect(res.status).to.equal(400)
      expect(res.body).to.deep.equal({ error: 'Unknown job: does-not-exist' })
    })

    it('returns 422 with errors and saves nothing if an interval is invalid', async (ctx) => {
      process.env.ADMIN_PASSWORD_HASH = passwordHash
      mockData(null)

      const cookie = await login(ctx)
      const beforeData = await getJobsData()

      const res = await ctx.request.post('/admin/jobs').set('Cookie', cookie).send({
        jobs: [
          { fileName: jobs[0]!.fileName, interval: 'not a valid interval' },
          { fileName: jobs[1]!.fileName, interval: 'also not valid' },
        ],
      })

      expect(res.status).to.equal(422)
      expect(res.body).to.deep.equal({
        errors: {
          [jobs[0]!.fileName]: 'Not a valid interval',
          [jobs[1]!.fileName]: 'Not a valid interval',
        },
      })
      expect(await getJobsData()).to.deep.equal(beforeData)
    })

    it('defaults to an empty jobs list if none is provided', async (ctx) => {
      process.env.ADMIN_PASSWORD_HASH = passwordHash
      mockData(null)

      const cookie = await login(ctx)
      const beforeData = await getJobsData()

      const res = await ctx.request.post('/admin/jobs').set('Cookie', cookie).send({})

      expect(res.status).to.equal(200)
      expect(res.body).to.deep.equal({ jobs: beforeData })
    })

    it('updates and persists enabled state and interval, leaving unspecified jobs unchanged', async (ctx) => {
      process.env.ADMIN_PASSWORD_HASH = passwordHash
      mockData(null)

      const cookie = await login(ctx)
      const beforeData = await getJobsData()
      const [firstJob, secondJob] = beforeData

      const res = await ctx.request.post('/admin/jobs').set('Cookie', cookie).send({
        jobs: [
          { fileName: firstJob!.fileName, enabled: !firstJob!.enabled, interval: 'every 3 minutes' },
        ],
      })

      expect(res.status).to.equal(200)

      const updatedFirst = res.body.jobs.find((job: any) => job.fileName === firstJob!.fileName)
      const updatedSecond = res.body.jobs.find((job: any) => job.fileName === secondJob!.fileName)

      expect(updatedFirst).to.deep.equal({
        ...firstJob,
        enabled: !firstJob!.enabled,
        interval: 'every 3 minutes',
      })
      expect(updatedSecond).to.deep.equal(secondJob)
      expect(await getJobsData()).to.deep.equal(res.body.jobs)
    })

    it('keeps existing enabled/interval when an update omits them', async (ctx) => {
      process.env.ADMIN_PASSWORD_HASH = passwordHash
      mockData(null)

      const cookie = await login(ctx)
      const beforeData = await getJobsData()
      const [firstJob] = beforeData

      const res = await ctx.request.post('/admin/jobs').set('Cookie', cookie).send({
        jobs: [{ fileName: firstJob!.fileName }],
      })

      expect(res.status).to.equal(200)

      const updatedFirst = res.body.jobs.find((job: any) => job.fileName === firstJob!.fileName)

      expect(updatedFirst).to.deep.equal(firstJob)
    })

    it('adds and starts a bree job when it becomes enabled', async (ctx) => {
      process.env.ADMIN_PASSWORD_HASH = passwordHash
      mockData({
        jobs: jobs.map((job) => ({ name: job.name, fileName: job.fileName, enabled: false, interval: job.defaultInterval })),
      })

      const bree = {
        remove: vi.fn(),
        add: vi.fn(),
        start: vi.fn(),
      }

      setBree(bree as any)

      const cookie = await login(ctx)

      await ctx.request.post('/admin/jobs').set('Cookie', cookie).send({
        jobs: [{ fileName: jobs[0]!.fileName, enabled: true }],
      })

      expect(bree.remove).not.toHaveBeenCalled()
      expect(bree.add).toHaveBeenCalledWith(expect.objectContaining({ name: jobs[0]!.fileName }))
      expect(bree.start).toHaveBeenCalledWith(jobs[0]!.fileName)
    })

    it('removes a bree job when it becomes disabled', async (ctx) => {
      process.env.ADMIN_PASSWORD_HASH = passwordHash
      mockData(null)

      const bree = {
        remove: vi.fn(),
        add: vi.fn(),
        start: vi.fn(),
      }

      setBree(bree as any)

      const cookie = await login(ctx)

      await ctx.request.post('/admin/jobs').set('Cookie', cookie).send({
        jobs: [{ fileName: jobs[0]!.fileName, enabled: false }],
      })

      expect(bree.remove).toHaveBeenCalledWith(jobs[0]!.fileName)
      expect(bree.add).not.toHaveBeenCalled()
    })

    it('removes and re-adds a bree job when its interval changes', async (ctx) => {
      process.env.ADMIN_PASSWORD_HASH = passwordHash
      mockData(null)

      const bree = {
        remove: vi.fn(),
        add: vi.fn(),
        start: vi.fn(),
      }

      setBree(bree as any)

      const cookie = await login(ctx)

      await ctx.request.post('/admin/jobs').set('Cookie', cookie).send({
        jobs: [{ fileName: jobs[0]!.fileName, interval: 'every 7 minutes' }],
      })

      expect(bree.remove).toHaveBeenCalledWith(jobs[0]!.fileName)
      expect(bree.add).toHaveBeenCalledWith(expect.objectContaining({ name: jobs[0]!.fileName, interval: 'every 7 minutes' }))
      expect(bree.start).toHaveBeenCalledWith(jobs[0]!.fileName)
    })

    it('does not touch bree when nothing changes for a job', async (ctx) => {
      process.env.ADMIN_PASSWORD_HASH = passwordHash
      mockData(null)

      const bree = {
        remove: vi.fn(),
        add: vi.fn(),
        start: vi.fn(),
      }

      setBree(bree as any)

      const cookie = await login(ctx)
      const beforeData = await getJobsData()

      await ctx.request.post('/admin/jobs').set('Cookie', cookie).send({
        jobs: [{ fileName: beforeData[0]!.fileName, enabled: beforeData[0]!.enabled }],
      })

      expect(bree.remove).not.toHaveBeenCalled()
      expect(bree.add).not.toHaveBeenCalled()
    })
  })
  describe('GET /admin/weather-location', () => {
    it('returns 401 if not authenticated', async (ctx) => {
      const res = await ctx.request.get('/admin/weather-location')

      expect(res.status).to.equal(401)
      expect(res.body).to.deep.equal({ error: 'Not authenticated' })
    })

    it('returns the persisted location', async (ctx) => {
      process.env.ADMIN_PASSWORD_HASH = passwordHash
      mockData(null, { location })

      const cookie = await login(ctx)
      const res = await ctx.request.get('/admin/weather-location').set('Cookie', cookie)

      expect(res.status).to.equal(200)
      expect(res.body).to.deep.equal({ location, defaultCoordinates: 'lat,lng' })
    })

    it('returns the environment location when none is persisted', async (ctx) => {
      process.env.ADMIN_PASSWORD_HASH = passwordHash
      mockData(null)

      const cookie = await login(ctx)
      const res = await ctx.request.get('/admin/weather-location').set('Cookie', cookie)

      expect(res.status).to.equal(200)
      expect(res.body).to.deep.equal({ location: null, defaultCoordinates: 'lat,lng' })
    })

    it('returns null for both when nothing is set', async (ctx) => {
      process.env.ADMIN_PASSWORD_HASH = passwordHash
      delete process.env.WEATHER_LOCATION
      mockData(null)

      const cookie = await login(ctx)
      const res = await ctx.request.get('/admin/weather-location').set('Cookie', cookie)

      expect(res.status).to.equal(200)
      expect(res.body).to.deep.equal({ location: null, defaultCoordinates: null })
    })
  })

  describe('POST /admin/weather-location', () => {
    it('returns 401 if not authenticated', async (ctx) => {
      const res = await ctx.request.post('/admin/weather-location').send({ latitude: 40.1, longitude: -80.2 })

      expect(res.status).to.equal(401)
      expect(res.body).to.deep.equal({ error: 'Not authenticated' })
    })

    it('persists the location with the name looked up from the coordinates', async (ctx) => {
      process.env.ADMIN_PASSWORD_HASH = passwordHash
      mockData(null)
      nockGeocode(geocodeResult)

      const cookie = await login(ctx)
      const res = await ctx.request.post('/admin/weather-location').set('Cookie', cookie).send({
        latitude: 40.1,
        longitude: -80.2,
      })

      expect(res.status).to.equal(200)
      expect(res.body).to.deep.equal({ location, defaultCoordinates: 'lat,lng' })
      expect(getWeatherData()).to.deep.equal({ location })
    })

    it('accepts coordinates sent as strings', async (ctx) => {
      process.env.ADMIN_PASSWORD_HASH = passwordHash
      mockData(null)
      nockGeocode(geocodeResult)

      const cookie = await login(ctx)
      const res = await ctx.request.post('/admin/weather-location').set('Cookie', cookie).send({
        latitude: '40.1',
        longitude: '-80.2',
      })

      expect(res.status).to.equal(200)
      expect(res.body.location).to.deep.equal(location)
    })

    it('falls back to the coordinates when no name is found', async (ctx) => {
      process.env.ADMIN_PASSWORD_HASH = passwordHash
      mockData(null)
      nockGeocode({ results: [] })

      const cookie = await login(ctx)
      const res = await ctx.request.post('/admin/weather-location').set('Cookie', cookie).send({
        latitude: 40.1,
        longitude: -80.2,
      })

      expect(res.status).to.equal(200)
      expect(res.body.location).to.deep.equal({ coordinates: '40.1,-80.2', name: '40.1,-80.2' })
    })

    it('falls back to the coordinates when the name lookup errors', async (ctx) => {
      process.env.ADMIN_PASSWORD_HASH = passwordHash
      mockData(null)

      nock('https://maps.googleapis.com')
      .get('/maps/api/geocode/json?key=key&latlng=40.1%2C-80.2')
      .reply(500)

      const cookie = await login(ctx)
      const res = await ctx.request.post('/admin/weather-location').set('Cookie', cookie).send({
        latitude: 40.1,
        longitude: -80.2,
      })

      expect(res.status).to.equal(200)
      expect(res.body.location).to.deep.equal({ coordinates: '40.1,-80.2', name: '40.1,-80.2' })
    })

    it('returns 422 and saves nothing if the latitude is not a number', async (ctx) => {
      process.env.ADMIN_PASSWORD_HASH = passwordHash
      mockData(null)

      const cookie = await login(ctx)
      const res = await ctx.request.post('/admin/weather-location').set('Cookie', cookie).send({
        latitude: 'nope',
        longitude: -80.2,
      })

      expect(res.status).to.equal(422)
      expect(res.body).to.deep.equal({ error: 'Latitude must be a number between -90 and 90' })
      expect(getWeatherData()).to.deep.equal({})
    })

    it('returns 422 if the latitude is out of range', async (ctx) => {
      process.env.ADMIN_PASSWORD_HASH = passwordHash
      mockData(null)

      const cookie = await login(ctx)
      const res = await ctx.request.post('/admin/weather-location').set('Cookie', cookie).send({
        latitude: 91,
        longitude: -80.2,
      })

      expect(res.status).to.equal(422)
      expect(res.body).to.deep.equal({ error: 'Latitude must be a number between -90 and 90' })
    })

    it('returns 422 if the longitude is missing', async (ctx) => {
      process.env.ADMIN_PASSWORD_HASH = passwordHash
      mockData(null)

      const cookie = await login(ctx)
      const res = await ctx.request.post('/admin/weather-location').set('Cookie', cookie).send({
        latitude: 40.1,
      })

      expect(res.status).to.equal(422)
      expect(res.body).to.deep.equal({ error: 'Longitude must be a number between -180 and 180' })
    })

    it('returns 422 if the longitude is out of range', async (ctx) => {
      process.env.ADMIN_PASSWORD_HASH = passwordHash
      mockData(null)

      const cookie = await login(ctx)
      const res = await ctx.request.post('/admin/weather-location').set('Cookie', cookie).send({
        latitude: 40.1,
        longitude: 181,
      })

      expect(res.status).to.equal(422)
      expect(res.body).to.deep.equal({ error: 'Longitude must be a number between -180 and 180' })
    })

    it('returns 422 if no body is sent at all', async (ctx) => {
      process.env.ADMIN_PASSWORD_HASH = passwordHash
      mockData(null)

      const cookie = await login(ctx)
      const res = await ctx.request.post('/admin/weather-location').set('Cookie', cookie)

      expect(res.status).to.equal(422)
      expect(res.body).to.deep.equal({ error: 'Latitude must be a number between -90 and 90' })
    })
  })

  describe('DELETE /admin/weather-location', () => {
    it('returns 401 if not authenticated', async (ctx) => {
      const res = await ctx.request.delete('/admin/weather-location')

      expect(res.status).to.equal(401)
      expect(res.body).to.deep.equal({ error: 'Not authenticated' })
    })

    it('clears the location so the environment one is used', async (ctx) => {
      process.env.ADMIN_PASSWORD_HASH = passwordHash
      mockData(null, { location })

      const cookie = await login(ctx)
      const res = await ctx.request.delete('/admin/weather-location').set('Cookie', cookie)

      expect(res.status).to.equal(200)
      expect(res.body).to.deep.equal({ location: null, defaultCoordinates: 'lat,lng' })
      expect(getWeatherData()).to.deep.equal({})
    })
  })
})
