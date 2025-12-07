import { createReadStream, readFileSync } from 'fs-extra'
import type { firestore } from 'firebase-admin'
import Mixpanel from 'mixpanel'
import nock from 'nock'
import { beforeEach, describe, expect, it, Mock, vi } from 'vitest'

import { startServer } from '../../../../index'
import { baseUrl } from '../../../../lib/tv/source/util'
import {
  addDoc,
  deleteDoc,
  getCollection,
  getDoc,
  getDocWhere,
  initializeApp,
  updateDoc,
} from '../../../../lib/util/firebase'
import { clone } from '../../../../lib/util/collections'
import { fixture, fixtureContents, handleServer } from '../../../util'
import { mockMixpanel, nockLogin } from '../util'

const apikey = process.env.THETVDB_API_KEY!
const pin = process.env.THETVDB_PIN!
const dbMock = {} as firestore.Firestore

function makeSearchResultShow (num: number) {
  return {
    description: `Show ${num} description`,
    firstAired: `Show ${num} firstAired`,
    id: num,
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

function makeShow (num: number, users: number[], episodes?: any[]) {
  return {
    episodes,
    id: `${num}`,
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

vi.mock('mixpanel', () => {
  return {
    default: {
      init: vi.fn(),
    },
  }
})

vi.mock('../../../../lib/util/firebase', () => {
  return {
    addDoc: vi.fn(),
    deleteDoc: vi.fn(),
    getCollection: vi.fn(),
    getDoc: vi.fn(),
    getDocWhere: vi.fn(),
    initializeApp: vi.fn(),
    updateDoc: vi.fn(),
  }
})

describe('lib/tv/store/shows', () => {
  handleServer(startServer)

  beforeEach(() => {
    vi.clearAllMocks()
    ;(getDocWhere as Mock).mockResolvedValue({ id: 'user-1' })
    ;(initializeApp as Mock).mockReturnValue(dbMock)
    ;(Mixpanel.init as Mock).mockReturnValue(mockMixpanel())
  })

  describe('user validation', () => {
    it('sends 401 if no api key', async (ctx) => {
      const res = await ctx.request.get('/tv/shows')

      expect(res.status).to.equal(401)
      expect(res.body).to.deep.equal({ error: 'Must specify `api-key` header' })
    })

    it('sends 401 if api key does not match any users', async (ctx) => {
      (getDocWhere as Mock).mockResolvedValue(undefined)

      const res = await ctx.request.get('/tv/shows').set('api-key', 'no-match')

      expect(res.status).to.equal(401)
      expect(res.body).to.deep.equal({ error: 'Could not find user with api key: no-match' })
    })
  })

  describe('GET /tv/shows', () => {
    it('returns shows from store for user', async (ctx) => {
      (getCollection as Mock).mockResolvedValue([
        makeShow(1, [1]),
        makeShow(2, [1, 2]),
        makeShow(3, [2]),
      ])
      ;(getDoc as Mock).mockImplementation((_db, path: string) => {
        return {
          'shows/1/episodes/all': { episodes: [
            makeEpisode(1),
            makeEpisode(2),
          ] },
          'shows/2/episodes/all': { episodes: [
            makeEpisode(3),
            makeEpisode(4),
          ] },
        }[path]
      })

      const res = await ctx.request.get('/tv/shows').set('api-key', 'user-1-api-key')

      expect(res.status).to.equal(200)
      expect(res.body).toMatchSnapshot()
    })

    it('handles episodes not existing', async (ctx) => {
      (getCollection as Mock).mockResolvedValue([
        makeShow(1, [1]),
        makeShow(2, [1, 2]),
        makeShow(3, [2]),
      ])
      ;(getDoc as Mock).mockResolvedValue(undefined)

      const res = await ctx.request.get('/tv/shows').set('api-key', 'user-1-api-key')

      expect(res.status).to.equal(200)
      expect(res.body).toMatchSnapshot()
    })

    it('sends 500 on error', async (ctx) => {
      (getCollection as Mock).mockRejectedValue(new Error('failed'))

      const res = await ctx.request.get('/tv/shows').set('api-key', 'user-1-api-key')

      expect(res.status).to.equal(500)
      expect(res.body.error).to.equal('failed')
    })
  })

  describe('POST /tv/shows', () => {
    it('gets the show data, saves it, and adds the show to the user if it does not already exist', async (ctx) => {
      nockLogin({ apikey, pin, times: 2 })

      const show = {
        description: 'Show description',
        firstAired: '2022-02-02',
        id: 2,
        name: 'Show name',
        image: 'Show poster',
        status: {
          name: 'Continuing',
        },
      }

      nock(baseUrl)
      .get('/v4/series/2')
      .reply(200, { data: show })

      nock(baseUrl)
      .get('/v4/series/2/episodes/default?page=0')
      .reply(200, fixtureContents('tv/episodes'))

      ;(getDoc as Mock).mockResolvedValue(undefined)

      const searchShow = makeSearchResultShow(2)
      const res = await ctx.request.post('/tv/shows')
      .set('api-key', 'user-1-api-key')
      .send({ show: searchShow })

      expect(addDoc).toBeCalledWith(dbMock, `shows/${searchShow.id}`, {
        id: `${show.id}`,
        name: show.name,
        network: searchShow.network,
        poster: show.image,
        status: show.status.name,
        users: {
          'user-1': {
            displayName: show.name,
            fileName: show.name,
            searchName: show.name,
          },
        },
      })
      expect(addDoc).toBeCalledWith(dbMock, `shows/${searchShow.id}/episodes/all`, { episodes: expect.arrayContaining([{
        airdate: '2009-02-17T05:00:00.000Z',
        number: 1,
        season: 0,
        id: '3859781',
        title: 'Good Cop Bad Cop',
      }]) })
      expect(res.status).to.equal(200)
      expect(res.body).toMatchSnapshot()
    })

    it('adds the show to the user if it already exists', async (ctx) => {
      const episodes = [makeEpisode(1)]
      const show = makeShow(3, [2], episodes)

      ;(getDoc as Mock).mockResolvedValue(show)
      ;(getCollection as Mock).mockResolvedValue(episodes)

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

      expect(updateDoc).toBeCalledWith(dbMock, `shows/${searchShow.id}`, { users })
      expect(res.status).to.equal(200)
      expect(res.body).toMatchSnapshot()
    })

    it('send 204 status if show already exist and belongs to user', async (ctx) => {
      const show = makeShow(1, [1], [makeEpisode(1)])

      ;(getDoc as Mock).mockResolvedValue(show)

      const searchShow = makeSearchResultShow(3)
      const res = await ctx.request.post('/tv/shows')
      .set('api-key', 'user-1-api-key')
      .send({ show: searchShow })

      expect(res.status).to.equal(204)
    })

    it('sends 500 on source error', async (ctx) => {
      nockLogin({ apikey, pin })

      nock(baseUrl)
      .get('/v4/series/2')
      .replyWithError('source failure')

      ;(getDoc as Mock).mockResolvedValue(undefined)

      const searchShow = makeSearchResultShow(2)
      const res = await ctx.request.post('/tv/shows')
      .set('api-key', 'user-1-api-key')
      .send({ show: searchShow })

      expect(res.status).to.equal(500)
      expect(res.body.error).to.equal('source failure')
    })

    it('sends 500 on store error', async (ctx) => {
      (getDoc as Mock).mockRejectedValue(new Error('failed'))

      const res = await ctx.request.post('/tv/shows')
      .set('api-key', 'user-1-api-key')
      .send({ show: { the: 'show' } })

      expect(res.status).to.equal(500)
      expect(res.body.error).to.equal('failed')
    })
  })

  describe('PUT /tv/shows/:id', () => {
    it('updates the show and returns it', async (ctx) => {
      const show = makeShow(1, [1], [makeEpisode(1)])

      ;(getDoc as Mock).mockResolvedValue(show)

      const showUpdate = {
        displayName: 'new display name',
        fileName: 'new file name',
        searchName: 'new search name',
      }

      const res = await ctx.request.put(`/tv/shows/${show.id}`)
      .set('api-key', 'user-1-api-key')
      .send({ show: showUpdate })

      expect(updateDoc).toBeCalledWith(dbMock, `shows/${show.id}`, {
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
      (getDoc as Mock).mockResolvedValue(undefined)

      const res = await ctx.request.put('/tv/shows/id')
      .set('api-key', 'user-1-api-key')
      .send({ show: {} })

      expect(res.status).to.equal(204)
    })

    it('sends 500 on error', async (ctx) => {
      (getDoc as Mock).mockRejectedValue(new Error('failed'))

      const res = await ctx.request.put('/tv/shows/id')
      .set('api-key', 'user-1-api-key')
      .send({ show: {} })

      expect(res.status).to.equal(500)
      expect(res.body.error).to.equal('failed')
    })
  })

  describe('DELETE /tv/shows/:id', () => {
    it('deletes the show if no other users reference it', async (ctx) => {
      const show = makeShow(1, [1], [makeEpisode(1)])

      ;(getDoc as Mock).mockResolvedValue(show)

      const res = await ctx.request.delete('/tv/shows/show-id')
      .set('api-key', 'user-1-api-key')

      expect(deleteDoc).toBeCalledWith(dbMock, 'shows/show-id/episodes/all')
      expect(deleteDoc).toBeCalledWith(dbMock, 'shows/show-id')
      expect(res.status).to.equal(204)
    })

    it('removes the show from the user if another user references it', async (ctx) => {
      const show = makeShow(1, [1, 2], [makeEpisode(1)])

      ;(getDoc as Mock).mockResolvedValue(show)

      const res = await ctx.request.delete('/tv/shows/show-id')
      .set('api-key', 'user-1-api-key')

      expect(updateDoc).toBeCalledWith(dbMock, 'shows/show-id', {
        'user-2': {
          displayName: 'user-2 display name',
          fileName: 'user-2 file name',
          searchName: 'user-2 search name',
        },
      })
      expect(res.status).to.equal(204)
    })

    it('does nothing if show does not exist', async (ctx) => {
      (getDoc as Mock).mockResolvedValue(undefined)

      const res = await ctx.request.delete('/tv/shows/id')
      .set('api-key', 'user-1-api-key')

      expect(deleteDoc).not.toBeCalled()
      expect(updateDoc).not.toBeCalled()
      expect(res.status).to.equal(204)
    })

    it('does nothing if show does not have current user', async (ctx) => {
      const show = makeShow(1, [2], [makeEpisode(1)])

      ;(getDoc as Mock).mockResolvedValue(show)

      const res = await ctx.request.delete('/tv/shows/id')
      .set('api-key', 'user-1-api-key')

      expect(deleteDoc).not.toBeCalled()
      expect(updateDoc).not.toBeCalled()
      expect(res.status).to.equal(204)
    })

    it('sends 500 on error', async (ctx) => {
      (getDoc as Mock).mockRejectedValue(new Error('failed'))

      const res = await ctx.request.delete('/tv/shows/id')
      .set('api-key', 'user-1-api-key')

      expect(res.status).to.equal(500)
      expect(res.body.error).to.equal('failed')
    })
  })

  describe('GET /tv/shows/poster/:poster', () => {
    function binaryParser (res: any, callback: any) {
      res.setEncoding('binary')
      res.data = ''
      res.on('data', (chunk: string) => {
        res.data += chunk
      })
      res.on('end', () => {
        callback(null, Buffer.from(res.data, 'binary'))
      })
    }

    it('streams proxied poster', async (ctx) => {
      const base64Poster = Buffer.from('https://example.com/poster').toString('base64')
      const posterBuffer = readFileSync(fixture('tv/pixel.png'))

      nock('https://example.com')
      .get('/poster')
      .reply(200, () => {
        return createReadStream(fixture('tv/pixel.png'))
      })

      const res = await ctx.request.get(`/tv/shows/poster/${base64Poster}`)
      .set('api-key', 'user-1-api-key')
      .buffer()
      .parse(binaryParser)

      expect(res.status).to.equal(200)
      expect(Buffer.compare(posterBuffer, res.body)).to.equal(0)
    })

    it('sends 500 on error', async (ctx) => {
      (getCollection as Mock).mockRejectedValue(new Error('failed'))

      const res = await ctx.request.get('/tv/shows').set('api-key', 'user-1-api-key')

      expect(res.status).to.equal(500)
      expect(res.body.error).to.equal('failed')
    })
  })
})
