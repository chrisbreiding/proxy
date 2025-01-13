import { readJsonSync } from 'fs-extra'
import mockFs from 'mock-fs'
import nock from 'nock'
import path from 'path'
import { afterAll, beforeEach, describe, expect, it, TestContext } from 'vitest'

import { handleServer, replaceStackLines } from '../util'
import { startServer } from '../../index'
import { getGarageData, GarageState, PersistentDataStructure } from '../../lib/garage'

process.env.API_KEY = 'key'

const defaultData = {
  left: 'closed' as const,
  right: 'closed' as const,
}

function mockData (data: PersistentDataStructure | null) {
  mockFs({
    'data': {
      'garage-data.json': JSON.stringify(data),
    },
    'views': mockFs.load(path.resolve(process.cwd(), 'views')),
  })
}

function mockError () {
  mockFs({
    'data': {},
    'views': mockFs.load(path.resolve(process.cwd(), 'views')),
  })
}

function getData () {
  return readJsonSync('./data/garage-data.json')
}

describe('lib/garage', () => {
  handleServer(startServer)

  beforeEach(() => {
    nock.cleanAll()
  })

  afterAll(() => {
    mockFs.restore()
  })

  describe('GET /garage-states/:key', () => {
    it('returns garage states from persistent data', async (ctx) => {
      mockData(defaultData)

      const res = await ctx.request.get('/garage-states/key')

      expect(res.status).to.equal(200)
      expect(res.body).to.deep.equal(defaultData)
    })

    it('returns unknown states if no data', async (ctx) => {
      mockData(null)

      const res = await ctx.request.get('/garage-states/key')

      expect(res.status).to.equal(200)
      expect(res.body).to.deep.equal({
        left: 'unknown',
        right: 'unknown',
      })
    })

    it('returns unknown states if error', async (ctx) => {
      mockError()

      const res = await ctx.request.get('/garage-states/key')

      expect(res.status).to.equal(200)
      expect(res.body).to.deep.equal({
        left: 'unknown',
        right: 'unknown',
      })
    })

    it('status 403 if key does not match', async (ctx) => {
      const res = await ctx.request.get('/garage-states/nope')

      expect(res.status).to.equal(403)
    })
  })

  describe('POST /garage-states/:door/:state/:key', () => {
    function nockNotify (message: string, optional = false) {
      process.env.IFTTT_WEBHOOK_KEY = 'iftttkey'

      return nock('https://maker.ifttt.com')
      .get(`/trigger/notify/with/key/iftttkey?value1=${encodeURIComponent(message)}`)
      .optionally(optional)
      .reply(200)
    }

    async function assertNoNotifications (ctx: TestContext, states: PersistentDataStructure, newState: GarageState) {
      const notifyFailed = nockNotify('The left garage door failed to close!')
      const notifyOpened = nockNotify('The left garage door opened')

      mockData(states)

      await ctx.request.post(`/garage-states/left/${newState}/key`)

      expect(notifyFailed.isDone(), 'notification was sent').to.be.false
      expect(notifyOpened.isDone(), 'notification was sent').to.be.false

      nock.abortPendingRequests()
    }

    it('returns an empty object', async (ctx) => {
      mockData(defaultData)

      const res = await ctx.request.post('/garage-states/left/open/key')

      expect(res.status).to.equal(200)
      expect(res.body).to.deep.equal({})
    })

    it('handles empty persistent data', async (ctx) => {
      mockData(null)

      const res = await ctx.request.post('/garage-states/left/open/key')

      expect(res.status).to.equal(200)
      expect(res.body).to.deep.equal({})
    })

    it('returns an empty object if error', async (ctx) => {
      mockError()

      const res = await ctx.request.post('/garage-states/left/open/key')

      expect(res.status).to.equal(200)
      expect(res.body).to.deep.equal({})
    })

    it('sets garage states in persistent data', async (ctx) => {
      mockData(defaultData)

      await ctx.request.post('/garage-states/left/open/key')

      expect(getData()).to.deep.equal({
        left: 'open',
        right: 'closed',
      })
    })

    it('notifies if new and previous states are open', async (ctx) => {
      const notifyFailed = nockNotify('The left garage door failed to close!')

      mockData({
        left: 'open',
        right: 'open',
      })

      await ctx.request.post('/garage-states/left/open/key')

      expect(notifyFailed.isDone(), 'notification was not sent').to.be.true
    })

    it('notifies if open and notifyOnOpen: true', async (ctx) => {
      const notifyOpened = nockNotify('The left garage door opened')

      mockData({
        left: 'closed',
        right: 'open',
        notifyOnOpen: true,
      })

      await ctx.request.post('/garage-states/left/open/key')

      expect(notifyOpened.isDone(), 'notification was not sent').to.be.true
    })

    it('does not notify if new and previous states are closed', async (ctx) => {
      await assertNoNotifications(ctx, {
        left: 'closed',
        right: 'closed',
      }, 'closed')
    })

    it('does not notify if new and previous states are different', async (ctx) => {
      await assertNoNotifications(ctx, {
        left: 'closed',
        right: 'closed',
      }, 'open')
    })

    it('does not notify if state is open and notifyOnOpen is false', async (ctx) => {
      await assertNoNotifications(ctx, {
        left: 'closed',
        right: 'closed',
        notifyOnOpen: false,
      }, 'open')
    })

    it('ignores notify errors', async (ctx) => {
      process.env.IFTTT_WEBHOOK_KEY = 'iftttkey'

      nock('https://maker.ifttt.com')
      .get(`/trigger/notify/with/key/iftttkey?value1=${encodeURIComponent('The left garage door opened')}`)
      .reply(500)

      mockData({
        left: 'closed',
        right: 'open',
        notifyOnOpen: true,
      })

      await ctx.request.post('/garage-states/left/open/key')
    })
  })

  describe('POST /garage/notify-on-open/:notifyOnOpen/:key', () => {
    it('sets notifyOnOpen in persistent data', async (ctx) => {
      mockData(defaultData)

      await ctx.request.post('/garage/notify-on-open/true/key')

      expect(getData()).to.deep.equal({
        left: 'closed',
        right: 'closed',
        notifyOnOpen: true,
      })

      await ctx.request.post('/garage/notify-on-open/false/key')

      expect(getData()).to.deep.equal({
        left: 'closed',
        right: 'closed',
        notifyOnOpen: false,
      })
    })

    it('handles empty persistent data', async (ctx) => {
      mockData(null)

      const res = await ctx.request.post('/garage/notify-on-open/true/key')

      expect(res.status).to.equal(200)
      expect(res.body).to.deep.equal({})
    })

    it('returns empty object if error', async (ctx) => {
      mockError()

      const res = await ctx.request.post('/garage/notify-on-open/true/key')

      expect(res.status).to.equal(200)
      expect(res.body).to.deep.equal({})
    })

    it('status 403 if key does not match', async (ctx) => {
      const res = await ctx.request.post('/garage/notify-on-open/true/nope')

      expect(res.status).to.equal(403)
    })
  })

  describe('GET /garage/:key', () => {
    it('renders garage view', async (ctx) => {
      mockData({
        left: 'closed',
        right: 'open',
      })

      const res = await ctx.request.get('/garage/key')

      expect(res.status).to.equal(200)
      expect(res.headers['content-type']).to.equal('text/html; charset=utf-8')

      mockFs.restore()
      expect(res.text).toMatchSnapshot()
    })

    it('handles empty persistent data', async (ctx) => {
      mockData(null)

      const res = await ctx.request.get('/garage/key')

      expect(res.status).to.equal(200)
      expect(res.headers['content-type']).to.equal('text/html; charset=utf-8')

      mockFs.restore()
      expect(res.text).toMatchSnapshot()
    })

    it('renders error view if error', async (ctx) => {
      mockError()

      const res = await ctx.request.get('/garage/key')

      expect(res.status).to.equal(200)
      expect(res.headers['content-type']).to.equal('text/html; charset=utf-8')

      mockFs.restore()
      expect(replaceStackLines(res.text)).toMatchSnapshot()
    })

    it('status 403 if key does not match', async (ctx) => {
      const res = await ctx.request.get('/garage/nope')

      expect(res.status).to.equal(403)
    })
  })

  describe('#getGarageData', () => {
    it('returns persistent data', async () => {
      mockData(defaultData)

      const res = await getGarageData()

      expect(res).to.deep.equal(defaultData)
    })
  })
})
