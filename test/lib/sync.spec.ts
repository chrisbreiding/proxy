import type { firestore } from 'firebase-admin'
import { afterEach, beforeEach, describe, expect, it, Mock, vi } from 'vitest'

import { startServer } from '../../index'
import {
  getDoc,
  initializeApp,
  setDoc,
} from '../../lib/util/firebase'
import { handleServer } from '../util'

const dbMock = {} as firestore.Firestore

vi.mock('../../lib/util/firebase', () => {
  return {
    getDoc: vi.fn(),
    initializeApp: vi.fn(),
    setDoc: vi.fn(),
  }
})

describe('lib/sync', () => {
  handleServer(startServer)

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2024, 0, 1))
    ;(getDoc as Mock).mockResolvedValue({ id: 'user-1' })
    ;(initializeApp as Mock).mockReturnValue(dbMock)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('GET /sync/:user/:app/:key', () => {
    it('returns the data for the user/app', async (ctx) => {
      (getDoc as Mock).mockResolvedValue({
        data: { foo: 'bar' },
        updatedAt: '2024-01-01T00:00:00.000Z',
      })

      const res = await ctx.request.get('/sync/user-1/app-1/key')

      expect(res.status).to.equal(200)
      expect(res.body).to.deep.equal({
        data: { foo: 'bar' },
        updatedAt: '2024-01-01T00:00:00.000Z',
      })
    })

    it('returns {} if no data for user', async (ctx) => {
      (getDoc as Mock).mockResolvedValue(undefined)

      const res = await ctx.request.get('/sync/user-1/app-1/key')

      expect(res.status).to.equal(200)
      expect(res.body).to.deep.equal({})
    })

    it('returns {} if no data for app', async (ctx) => {
      (getDoc as Mock).mockResolvedValue(undefined)

      const res = await ctx.request.get('/sync/user-1/app-1/key')

      expect(res.status).to.equal(200)
      expect(res.body).to.deep.equal({})
    })

    it('sends 403 if key does not match', async (ctx) => {
      const res = await ctx.request.get('/sync/user-1/app-1/nope')

      expect(res.status).to.equal(403)
    })
  })

  describe('POST /sync/:user/:app/:key', () => {
    it('saves the data with updatedAt for the user/app', async (ctx) => {
      const res = await ctx.request
      .post('/sync/user-1/app-1/key')
      .set('api-key', 'user-1-api-key')
      .send({ data: { foo: 'bar' } })

      expect(res.status).to.equal(200)
      expect(setDoc).toBeCalledWith(dbMock, 'user-1/app-1', {
        data: { foo: 'bar' },
        updatedAt: '2024-01-01T05:00:00.000Z',
      })
    })

    it('sends 500 on error', async (ctx) => {
      (setDoc as Mock).mockRejectedValue(new Error('failed'))

      const res = await ctx.request
      .post('/sync/user-1/app-1/key')
      .send({ data: { foo: 'bar' } })

      expect(res.status).to.equal(500)
      expect(res.body.error).to.equal('failed')
    })

    it('sends 403 if key does not match', async (ctx) => {
      const res = await ctx.request.post('/sync/user-1/app-1/nope')

      expect(res.status).to.equal(403)
    })
  })
})
