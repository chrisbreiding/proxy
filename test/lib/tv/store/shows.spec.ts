import nock from 'nock'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const apikey = process.env.THETVDB_API_KEY = 'api-key'
const pin = process.env.THETVDB_PIN = 'pin'

import { baseUrl } from '../../../../lib/tv/source/util'
import { fixtureContents } from '../../notion/util'
import { nockLogin } from '../util'
import { startServer } from '../../../../index'
import { handleServer } from '../../../support/util'
import {
  addCollectionToDoc,
  addDoc,
  deleteDoc,
  getDoc,
  getDocWhere,
  updateDoc,
} from '../../../../lib/tv/store/firebase'
import { clone } from '../../../../lib/util/collections'

function makeSearchResultShow (num: number) {
  return {
    description: `Show ${num} description`,
    firstAired: `Show ${num} firstAired`,
    id: `show-${num}-id`,
    name: `Show ${num} name`,
    network: `Show ${num} network`,
    poster: `Show ${num} poster`,
    status: 'Ended' as const,
  }
}

function makeEpisode (num: number) {
  return {
    title: `Episode ${num}`,
  }
}

interface ShowUsers {
  [key: string]: {
    displayName: string
    fileName: string
    searchName: string
  }
}

function makeShow (num: number, episodes: any[], users: number[]) {
  return {
    episodes,
    id: `show-${num}-id`,
    name: `Show ${num} name`,
    users: users.reduce((memo, userNum) => {
      return {
        ...memo,
        [`user-${userNum}`]: {
          displayName: `user-${userNum} display name`,
          fileName: `user-${userNum} file name`,
          searchName: `user-${userNum} search name`,
        },
      }
    }, {} as ShowUsers),
  }
}

vi.mock('../../../../lib/tv/store/firebase', () => {
  return {
    addDoc: vi.fn(),
    addCollectionToDoc: vi.fn(),
    getCollection: vi.fn().mockResolvedValue([
      makeShow(1, [
        makeEpisode(1),
        makeEpisode(2),
      ], [1]),
      makeShow(2, [
        makeEpisode(3),
        makeEpisode(4),
      ], [1, 2]),
      makeShow(3, [
        makeEpisode(5),
        makeEpisode(6),
      ], [2]),
    ]),
    getDoc: vi.fn(),
    getDocWhere: vi.fn(),
    deleteDoc: vi.fn(),
    updateDoc: vi.fn(),
  }
})

describe('lib/tv/store/shows', () => {
  handleServer(startServer)

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('user validation', () => {
    it('sends 401 if no api key', async (ctx) => {
      // @ts-ignore
      getDocWhere.mockResolvedValue(undefined)

      const res = await ctx.request.get('/tv/shows')

      expect(res.status).to.equal(401)
      expect(res.body).to.deep.equal({ error: 'Must specify `api-key` header' })
    })

    it('sends 401 if api key does not match any users', async (ctx) => {
      const res = await ctx.request.get('/tv/shows').set('api-key', 'no-match')

      expect(res.status).to.equal(401)
      expect(res.body).to.deep.equal({ error: 'Could not find user with api key: no-match' })
    })
  })

  describe('GET /tv/shows', () => {
    it('returns shows from store for user', async (ctx) => {
      // @ts-ignore
      getDocWhere.mockResolvedValue({ id: 'user-1' })

      const res = await ctx.request.get('/tv/shows').set('api-key', 'user-1-api-key')

      expect(res.status).to.equal(200)
      expect(res.body).toMatchSnapshot()
    })
  })

  describe('POST /tv/shows', () => {
    it('gets the show data, saves it, and adds the show to the user if it does not already exist', async (ctx) => {
      nockLogin(apikey, pin)

      nock(baseUrl)
      .get('/v4/series/show-2-id/episodes/default?page=0')
      .reply(200, fixtureContents('tv/episodes'))

      // @ts-ignore
      getDocWhere.mockResolvedValue({ id: 'user-1' })
      // @ts-ignore
      getDoc.mockResolvedValue(undefined)

      const searchShow = makeSearchResultShow(2)
      const res = await ctx.request.post('/tv/shows')
      .set('api-key', 'user-1-api-key')
      .send({ show: searchShow })

      expect(addDoc).toBeCalledWith(`shows/${searchShow.id}`, {
        id: searchShow.id,
        name: searchShow.name,
        poster: searchShow.poster,
        status: searchShow.status,
        users: {
          'user-1': {
            displayName: searchShow.name,
            fileName: searchShow.name,
            searchName: searchShow.name,
          },
        },
      })
      expect(addCollectionToDoc).toBeCalledWith(`shows/${searchShow.id}/episodes`, expect.arrayContaining([{
        airdate: '2009-02-17T05:00:00.000Z',
        episodeNumber: 1,
        season: 0,
        sourceId: 3859781,
        title: 'Good Cop Bad Cop',
      }]))
      expect(res.status).to.equal(200)
      expect(res.body).toMatchSnapshot()
    })

    it('adds the show to the user if it already exists', async (ctx) => {
      const show = makeShow(3, [makeEpisode(1)], [2])

      // @ts-ignore
      getDocWhere.mockResolvedValue({ id: 'user-1' })
      // @ts-ignore
      getDoc.mockResolvedValue(show)

      const searchShow = makeSearchResultShow(3)
      const res = await ctx.request.post('/tv/shows')
      .set('api-key', 'user-1-api-key')
      .send({ show: searchShow })

      const users = clone(show.users)

      users['user-1'] = {
        displayName: searchShow.name,
        fileName: searchShow.name,
        searchName: searchShow.name,
      }

      expect(updateDoc).toBeCalledWith(`shows/${searchShow.id}`, { users })
      expect(res.status).to.equal(200)
      expect(res.body).toMatchSnapshot()
    })

    it('send 204 status if show already exist and belongs to user', async (ctx) => {
      const show = makeShow(1, [makeEpisode(1)], [1])

      // @ts-ignore
      getDocWhere.mockResolvedValue({ id: 'user-1' })
      // @ts-ignore
      getDoc.mockResolvedValue(show)

      const searchShow = makeSearchResultShow(3)
      const res = await ctx.request.post('/tv/shows')
      .set('api-key', 'user-1-api-key')
      .send({ show: searchShow })

      expect(res.status).to.equal(204)
    })
  })

  describe('PUT /tv/shows/:id', () => {
    it('updates the show and returns it', async (ctx) => {
      const show = makeShow(1, [makeEpisode(1)], [1])

      // @ts-ignore
      getDocWhere.mockResolvedValue({ id: 'user-1' })
      // @ts-ignore
      getDoc.mockResolvedValue(show)

      const showUpdate = {
        displayName: 'new display name',
        fileName: 'new file name',
        searchName: 'new search name',
      }

      const res = await ctx.request.put(`/tv/shows/${show.id}`)
      .set('api-key', 'user-1-api-key')
      .send({ show: showUpdate })

      expect(updateDoc).toBeCalledWith(`shows/${show.id}`, {
        id: 'show-1-id',
        name: 'Show 1 name',
        users: {
          'user-1': {
            displayName: 'new display name',
            fileName: 'new file name',
            searchName: 'new search name',
          },
        },
      })
      expect(res.status).to.equal(200)
      expect(res.body).toMatchSnapshot()
    })

    it('sends 204 if the show does not exist in store', async (ctx) => {
      // @ts-ignore
      getDocWhere.mockResolvedValue({ id: 'user-1' })
      // @ts-ignore
      getDoc.mockResolvedValue(undefined)

      const res = await ctx.request.put('/tv/shows/id')
      .set('api-key', 'user-1-api-key')
      .send({ show: {} })

      expect(res.status).to.equal(204)
    })
  })

  describe('DELETE /tv/shows/:id', () => {
    it('deletes the show if no other users reference it', async (ctx) => {
      const show = makeShow(1, [makeEpisode(1)], [1])

      // @ts-ignore
      getDocWhere.mockResolvedValue({ id: 'user-1' })
      // @ts-ignore
      getDoc.mockResolvedValue(show)

      const res = await ctx.request.delete('/tv/shows/id')
      .set('api-key', 'user-1-api-key')

      expect(deleteDoc).toBeCalledWith('shows/id')
      expect(res.status).to.equal(204)
    })

    it('removes the show from the user if another user references it', async (ctx) => {
      const show = makeShow(1, [makeEpisode(1)], [1, 2])

      // @ts-ignore
      getDocWhere.mockResolvedValue({ id: 'user-1' })
      // @ts-ignore
      getDoc.mockResolvedValue(show)

      const res = await ctx.request.delete('/tv/shows/id')
      .set('api-key', 'user-1-api-key')

      expect(updateDoc).toBeCalledWith('shows/id', {
        'user-2': {
          displayName: 'user-2 display name',
          fileName: 'user-2 file name',
          searchName: 'user-2 search name',
        },
      })
      expect(res.status).to.equal(204)
    })

    it('does nothing if show does not exist', async (ctx) => {
      // @ts-ignore
      getDocWhere.mockResolvedValue({ id: 'user-1' })
      // @ts-ignore
      getDoc.mockResolvedValue(undefined)

      const res = await ctx.request.delete('/tv/shows/id')
      .set('api-key', 'user-1-api-key')

      expect(deleteDoc).not.toBeCalled
      expect(updateDoc).not.toBeCalled
      expect(res.status).to.equal(204)
    })

    it('does nothing if show does not have current user', async (ctx) => {
      const show = makeShow(1, [makeEpisode(1)], [2])

      // @ts-ignore
      getDocWhere.mockResolvedValue({ id: 'user-1' })
      // @ts-ignore
      getDoc.mockResolvedValue(show)

      const res = await ctx.request.delete('/tv/shows/id')
      .set('api-key', 'user-1-api-key')

      expect(deleteDoc).not.toBeCalled
      expect(updateDoc).not.toBeCalled
      expect(res.status).to.equal(204)
    })
  })
})
