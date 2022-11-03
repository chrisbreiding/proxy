import nock from 'nock'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { PersistentData } = require('../../lib/util/persistent-data')

import { handleServer } from '../support/setup'
import { startServer } from '../../index'
import { getData } from '../../lib/garage'

process.env.API_KEY = 'key'

const defaultData = {
  left: 'closed',
  right: 'closed',
}

function resolveGetData (value) {
  PersistentData.prototype.get = vi
  .fn()
  .mockResolvedValue(value)
}

function rejectGetData () {
  PersistentData.prototype.get = vi
  .fn()
  .mockRejectedValue(new Error('fail'))
}

function resolveSetData () {
  PersistentData.prototype.set = vi
  .fn()
  .mockImplementation((value) => {
    return Promise.resolve(value)
  })
}

function rejectSetData () {
  PersistentData.prototype.set = vi
  .fn()
  .mockRejectedValue(new Error('fail'))
}

describe('lib/garage', () => {
  handleServer(startServer)

  beforeEach(() => {
    nock.cleanAll()
  })

  describe('GET /garage-states/:key', () => {
    it('returns garage states from persistent data', async (ctx) => {
      resolveGetData(defaultData)

      const res = await ctx.request.get('/garage-states/key')

      expect(res.status).to.equal(200)
      expect(res.body).to.deep.equal(defaultData)
    })

    it('returns unknown states if no data', async (ctx) => {
      resolveGetData(undefined)

      const res = await ctx.request.get('/garage-states/key')

      expect(res.status).to.equal(200)
      expect(res.body).to.deep.equal({
        left: 'unknown',
        right: 'unknown',
      })
    })

    it('returns unknown states if error', async (ctx) => {
      rejectGetData()

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
    function mockNotify (message, optional = false) {
      process.env.IFTTT_WEBHOOK_KEY = 'iftttkey'

      return nock('https://maker.ifttt.com')
      .get(`/trigger/notify/with/key/iftttkey?value1=${encodeURIComponent(message)}`)
      .optionally(optional)
      .reply(200)
    }

    async function assertNoNotifications (ctx, states, newState) {
      const notifyFailed = mockNotify('The left garage door failed to close!')
      const notifyOpened = mockNotify('The left garage door opened')

      resolveGetData(states)
      resolveSetData()

      await ctx.request.post(`/garage-states/left/${newState}/key`)

      expect(notifyFailed.isDone(), 'notification was sent').to.be.false
      expect(notifyOpened.isDone(), 'notification was sent').to.be.false

      nock.abortPendingRequests()
    }

    it('returns an empty object', async (ctx) => {
      resolveGetData(defaultData)
      resolveSetData()

      const res = await ctx.request.post('/garage-states/left/open/key')

      expect(res.status).to.equal(200)
      expect(res.body).to.deep.equal({})
    })

    it('returns an empty object if error', async (ctx) => {
      resolveGetData(defaultData)
      rejectSetData()

      const res = await ctx.request.post('/garage-states/left/open/key')

      expect(res.status).to.equal(200)
      expect(res.body).to.deep.equal({})
    })

    it('sets garage states in persistent data', async (ctx) => {
      resolveGetData(defaultData)
      resolveSetData()

      await ctx.request.post('/garage-states/left/open/key')

      expect(PersistentData.prototype.set).toBeCalledWith({
        left: 'open',
        right: 'closed',
      })
    })

    it('notifies if new and previous states are open', async (ctx) => {
      const notifyFailed = mockNotify('The left garage door failed to close!')

      resolveGetData({
        left: 'open',
        right: 'open',
      })
      resolveSetData()

      await ctx.request.post('/garage-states/left/open/key')

      expect(notifyFailed.isDone(), 'notification was not sent').to.be.true
    })

    it('notifies if open and notifyOnOpen: true', async (ctx) => {
      const notifyOpened = mockNotify('The left garage door opened')

      resolveGetData({
        left: 'closed',
        right: 'open',
        notifyOnOpen: true,
      })
      resolveSetData()

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
  })

  describe('POST /garage/notify-on-open/:notifyOnOpen/:key', () => {
    it('set notifyOnOpen in persistent data', async (ctx) => {
      resolveGetData(defaultData)
      resolveSetData()

      await ctx.request.post('/garage/notify-on-open/true/key')

      expect(PersistentData.prototype.set).toBeCalledWith({
        left: 'closed',
        right: 'closed',
        notifyOnOpen: true,
      })

      await ctx.request.post('/garage/notify-on-open/false/key')

      expect(PersistentData.prototype.set).toBeCalledWith({
        left: 'closed',
        right: 'closed',
        notifyOnOpen: false,
      })
    })

    it('returns empty object', async (ctx) => {
      resolveGetData(undefined)
      resolveSetData()

      const res = await ctx.request.post('/garage/notify-on-open/true/key')

      expect(res.status).to.equal(200)
      expect(res.body).to.deep.equal({})
    })

    it('returns empty object if error', async (ctx) => {
      rejectGetData()
      resolveSetData()

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
      resolveGetData({
        left: 'closed',
        right: 'open',
      })

      const res = await ctx.request.get('/garage/key')

      expect(res.status).to.equal(200)
      expect(res.headers['content-type']).to.equal('text/html; charset=utf-8')
      expect(res.text).to.include('state-icon-closed')
      expect(res.text).to.include('url(/garage-closed.png)')
      expect(res.text).to.include('state-icon-open')
      expect(res.text).to.include('url(/garage-open.png)')
    })

    it('renders error view if error', async (ctx) => {
      rejectGetData()

      const res = await ctx.request.get('/garage/key')

      expect(res.status).to.equal(200)
      expect(res.headers['content-type']).to.equal('text/html; charset=utf-8')
      expect(res.text).to.include('<h1>An Error Occurred</h1>')
      expect(res.text).to.include('<h2>Error Message</h2>')
      expect(res.text).to.include('<p>fail</p>')
      expect(res.text).to.include('<h2>Error Stack</h2>')
      expect(res.text).to.include('<pre>Error: fail')
    })

    it('status 403 if key does not match', async (ctx) => {
      const res = await ctx.request.get('/garage/nope')

      expect(res.status).to.equal(403)
    })
  })

  describe('#getData', () => {
    it('returns persistent data', async () => {
      resolveGetData(defaultData)

      const res = await getData()

      expect(res).to.deep.equal(defaultData)
    })
  })
})
