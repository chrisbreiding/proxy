import type { firestore } from 'firebase-admin'
import Mixpanel from 'mixpanel'
import nock from 'nock'
import { beforeEach, describe, expect, it, Mock, vi } from 'vitest'

import { startServer } from '../../../../index'
import { baseUrl } from '../../../../lib/tv/source/util'
import { getDocWhere, initializeApp } from '../../../../lib/util/firebase'
import { fixtureContents, handleServer } from '../../../util'
import { mockMixpanel, nockLogin } from '../util'

const apikey = process.env.THETVDB_API_KEY!
const pin = process.env.THETVDB_PIN!
const dbMock = {} as firestore.Firestore

vi.mock('mixpanel', () => {
  return {
    default: {
      init: vi.fn(),
    },
  }
})

vi.mock('../../../../lib/util/firebase', () => {
  return {
    getDocWhere: vi.fn(),
    initializeApp: vi.fn(),
  }
})

describe('lib/tv/source/shows', () => {
  handleServer(startServer)

  beforeEach(() => {
    (Mixpanel.init as Mock).mockReturnValue(mockMixpanel())
  })

  it('throws error if unable to authenticate', async (ctx) => {
    nock(baseUrl)
    .post('/v4/login', { apikey, pin })
    .reply(200, { data: {}, status: 'fail' })
    ;(getDocWhere as Mock).mockResolvedValue({ id: 'user-1' })
    ;(initializeApp as Mock).mockReturnValue(dbMock)

    const res = await ctx.request.get('/tv/shows/search?query=Breaking+Bad')
    .set('api-key', 'user-1-api-key')

    expect(res.status).to.equal(500)
    expect(res.body).deep.equal({ error: 'Could not authenticate with TheTVDB, status: fail' })
  })

  describe('GET /tv/shows/search', () => {
    beforeEach(() => {
      vi.clearAllMocks()
      nock.cleanAll()

      nockLogin({ apikey, pin })
      ;(getDocWhere as Mock).mockResolvedValue({ id: 'user-1' })
    })

    it('returns shows found in search', async (ctx) => {
      nock(baseUrl)
      .matchHeader('Authorization', 'Bearer token')
      .get('/v4/search?query=Breaking+Bad&type=series')
      .reply(200, fixtureContents('tv/search-shows'))

      const res = await ctx.request.get('/tv/shows/search?query=Breaking+Bad')
      .set('api-key', 'user-1-api-key')

      expect(res.status).to.equal(200)
      expect(res.body).toMatchSnapshot()
    })

    it('sends 500 on error', async (ctx) => {
      nock(baseUrl)
      .matchHeader('Authorization', 'Bearer token')
      .get('/v4/search?query=Breaking+Bad&type=series')
      .replyWithError('search failure')

      const res = await ctx.request.get('/tv/shows/search?query=Breaking+Bad')
      .set('api-key', 'user-1-api-key')

      expect(res.status).to.equal(500)
      expect(res.body.error).to.equal('search failure')
    })
  })
})
