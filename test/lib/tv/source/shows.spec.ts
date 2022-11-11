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
  beforeEach(() => {
    nockLogin(apikey, pin)
  })

  describe('GET /tv/shows/search', () => {
    handleServer(startServer)

    beforeEach(() => {
      vi.clearAllMocks()
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
    it('returns shows updated since date', async () => {
      nock(baseUrl)
      .matchHeader('Authorization', 'Bearer token')
      .get('/v4/updates?action=update&type=series&since=1667707200')
      .reply(200, fixtureContents('tv/updated-shows'))

      const result = await getShowsUpdatedSince('2022-11-06')

      expect(result).toMatchSnapshot()
    })
  })
})
