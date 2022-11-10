import nock from 'nock'
import { describe, expect, it } from 'vitest'

const apikey = process.env.THETVDB_API_KEY = 'api-key'
const pin = process.env.THETVDB_PIN = 'pin'

import { baseUrl } from '../../../../lib/tv/source/util'
import { getShowsUpdatedSince, searchShows } from '../../../../lib/tv/source/shows'
import { fixtureContents } from '../../../support/util'
import { nockLogin } from '../util'

describe('lib/tv/source/shows', () => {
  describe('#searchShows', () => {
    it('returns shows', async () => {
      nockLogin(apikey, pin)

      nock(baseUrl)
      .matchHeader('Authorization', 'Bearer token')
      .get('/v4/search?query=Breaking+Bad&type=series')
      .reply(200, fixtureContents('tv/search-shows'))

      const result = await searchShows('Breaking Bad')

      expect(result).toMatchSnapshot()
    })
  })

  describe('#getShowsUpdatedSince', () => {
    it('returns shows updated since date', async () => {
      nockLogin(apikey, pin)

      nock(baseUrl)
      .matchHeader('Authorization', 'Bearer token')
      .get('/v4/updates?action=update&type=series&since=1667707200')
      .reply(200, fixtureContents('tv/updated-shows'))

      const result = await getShowsUpdatedSince('2022-11-06')

      expect(result).toMatchSnapshot()
    })
  })
})
