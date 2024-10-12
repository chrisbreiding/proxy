import type { firestore } from 'firebase-admin'
import Mixpanel from 'mixpanel'
import { beforeEach, describe, expect, it, Mock, vi } from 'vitest'

import { startServer } from '../../../../index'
import { getDoc, getDocWhere, initializeApp, updateDoc } from '../../../../lib/util/firebase'
import type { User } from './../../../../lib/tv/store/users'
import { handleServer } from '../../../util'
import { mockMixpanel } from '../util'

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
    getDoc: vi.fn(),
    getDocWhere: vi.fn(),
    initializeApp: vi.fn(),
    updateDoc: vi.fn(),
  }
})

describe('lib/tv/store/users', () => {
  handleServer(startServer)

  let user: User

  beforeEach(() => {
    user = {
      apiKey: 'api-key',
      id: 'user-id',
      hideSpecialEpisodes: true,
      hideTBAEpisodes: 'NONE',
      isAdmin: true,
      searchLinks: [{
        name: 'link name',
        showLink: 'show link',
        episodeLink: 'episode link',
      }],
      username: 'user name',
    }

    ;(getDocWhere as Mock).mockResolvedValue(user)
    ;(initializeApp as Mock).mockReturnValue(dbMock)
    ;(Mixpanel.init as Mock).mockReturnValue(mockMixpanel())
  })

  describe('GET /tv/user', () => {
    it('returns user info and settings', async (ctx) => {
      (getDoc as Mock).mockResolvedValue(user)

      const res = await ctx.request.get('/tv/user').set('api-key', 'api-key')

      expect(res.status).to.equal(200)
      expect(res.body).to.deep.equal({
        hideSpecialEpisodes: true,
        hideTBAEpisodes: 'NONE',
        isAdmin: true,
        searchLinks: [{
          name: 'link name',
          showLink: 'show link',
          episodeLink: 'episode link',
        }],
        username: 'user name',
      })
    })

    it('sends 404 if user is not found', async (ctx) => {
      (getDoc as Mock).mockResolvedValue(undefined)

      const res = await ctx.request.get('/tv/user').set('api-key', 'api-key')

      expect(res.status).to.equal(404)
      expect(res.body).to.deep.equal({ error: 'User with id \'user-id\' not found' })
    })

    it('sends 500 on error', async (ctx) => {
      (getDoc as Mock).mockRejectedValue(new Error('failed'))

      const res = await ctx.request.get('/tv/user').set('api-key', 'api-key')

      expect(res.status).to.equal(500)
      expect(res.body.error).to.equal('failed')
    })
  })

  describe('PUT /tv/user', () => {
    it('updates user props and returns updated user', async (ctx) => {
      const update = {
        hideTBAEpisodes: 'ALL',
        searchLinks: [{
          name: 'new link name',
          showLink: 'new show link',
          episodeLink: 'new episode link',
        }],
      }

      ;(getDoc as Mock).mockResolvedValue({
        ...user,
        ...update,
      })

      const res = await ctx.request.put('/tv/user')
      .set('api-key', 'api-key')
      .send(update)

      expect(updateDoc).toBeCalledWith(dbMock, 'users/user-id', update)
      expect(res.status).to.equal(200)
      expect(res.body).to.deep.equal({
        hideSpecialEpisodes: true,
        hideTBAEpisodes: 'ALL',
        searchLinks: [{
          name: 'new link name',
          showLink: 'new show link',
          episodeLink: 'new episode link',
        }],
        username: 'user name',
      })
    })

    it('sends 404 if user is not found', async (ctx) => {
      (getDoc as Mock).mockResolvedValue(undefined)

      const res = await ctx.request.put('/tv/user').set('api-key', 'api-key')

      expect(res.status).to.equal(404)
      expect(res.body).to.deep.equal({ error: 'User with id \'user-id\' not found' })
    })

    it('sends 500 on error', async (ctx) => {
      (getDoc as Mock).mockRejectedValue(new Error('failed'))

      const res = await ctx.request.put('/tv/user').set('api-key', 'api-key').send({})

      expect(res.status).to.equal(500)
      expect(res.body.error).to.equal('failed')
    })
  })
})
