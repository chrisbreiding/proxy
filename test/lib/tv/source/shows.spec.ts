import nock from 'nock'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const apikey = process.env.THETVDB_API_KEY = 'api-key'
const pin = process.env.THETVDB_PIN = 'pin'

import { startServer } from '../../../../index'
import { getShowsUpdatedSince } from '../../../../lib/tv/source/shows'
import { baseUrl } from '../../../../lib/tv/source/util'
import { getDocWhere } from '../../../../lib/tv/store/firebase'
import { fixtureContents, handleServer } from '../../../util'
import { nockLogin } from '../util'

vi.mock('../../../../lib/tv/store/firebase', () => {
  return {
    getDocWhere: vi.fn(),
  }
})

describe('lib/tv/source/shows', () => {
  handleServer(startServer)

  it('throws error if unable to authenticate', async (ctx) => {
    nock(baseUrl)
    .post('/v4/login', { apikey, pin })
    .reply(200, { data: {}, status: 'fail' })
    // @ts-ignore
    getDocWhere.mockResolvedValue({ id: 'user-1' })

    const res = await ctx.request.get('/tv/shows/search?query=Breaking+Bad')
    .set('api-key', 'user-1-api-key')

    expect(res.status).to.equal(500)
    expect(res.body).deep.equal({ error: 'Could not authenticate with TheTVDB, status: fail' })
  })

  describe('GET /tv/shows/search', () => {
    beforeEach(() => {
      vi.clearAllMocks()
      nock.cleanAll()

      nockLogin(apikey, pin)
      // @ts-ignore
      getDocWhere.mockResolvedValue({ id: 'user-1' })
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

  describe('#getShowsUpdatedSince', () => {
    beforeEach(() => {
      vi.clearAllMocks()
      nock.cleanAll()

      nockLogin(apikey, pin)
    })

    it('returns shows updated since date', async () => {
      nock(baseUrl)
      .matchHeader('Authorization', 'Bearer token')
      .get('/v4/updates?action=update&type=series&since=1667707200')
      .reply(200, fixtureContents('tv/updated-shows'))

      const result = await getShowsUpdatedSince('2022-11-06')

      expect(result).toMatchSnapshot()
    })

    it('re-throws errors', async () => {
      nock(baseUrl)
      .matchHeader('Authorization', 'Bearer token')
      .get('/v4/updates?action=update&type=series&since=1667707200')
      .replyWithError(new Error('getting updates failed'))

      await expect(() => {
        return getShowsUpdatedSince('2022-11-06')
      }).rejects.toThrowError('getting updates failed')
    })
  })
})
