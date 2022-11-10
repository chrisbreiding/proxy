import nock from 'nock'
import { describe, expect, it } from 'vitest'

const apikey = process.env.THETVDB_API_KEY = 'api-key'
const pin = process.env.THETVDB_PIN = 'pin'

import { baseUrl } from '../../../../lib/tv/source/util'
import { fixtureContents } from '../../../support/util'
import { getEpisodesForShow } from '../../../../lib/tv/source/episodes'
import { nockLogin } from '../util'
import { clone } from '../../../../lib/util/collections'

const episodes = fixtureContents('tv/episodes')

describe('lib/tv/source/episodes', () => {
  describe('#getEpisodesForShow', () => {
    it('returns episodes for show', async () => {
      nockLogin(apikey, pin)

      nock(baseUrl)
      .matchHeader('Authorization', 'Bearer token')
      .get('/v4/series/12345/episodes/default?page=0')
      .reply(200, episodes)

      const result = await getEpisodesForShow('12345')

      expect(result).toMatchSnapshot()
    })

    it('returns all episodes for show if there are paginated results', async () => {
      nockLogin(apikey, pin)

      const page0Episodes = clone(episodes)
      page0Episodes.links.next = 1

      nock(baseUrl)
      .matchHeader('Authorization', 'Bearer token')
      .get('/v4/series/67890/episodes/default?page=0')
      .reply(200, page0Episodes)

      const page1Episodes = clone(episodes)
      page1Episodes.links.prev = 0

      nock(baseUrl)
      .matchHeader('Authorization', 'Bearer token')
      .get('/v4/series/67890/episodes/default?page=1')
      .reply(200, page1Episodes)

      const result = await getEpisodesForShow('67890')

      expect(result).toMatchSnapshot()
    })
  })
})
