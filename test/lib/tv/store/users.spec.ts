import { beforeEach, describe, expect, it, vi } from 'vitest'

import { startServer } from '../../../../index'
import { getDoc, getDocWhere, updateDoc } from '../../../../lib/tv/store/firebase'
import type { User } from './../../../../lib/tv/store/users'
import { handleServer } from '../../../util'
import { testError } from '../util'

vi.mock('../../../../lib/tv/store/firebase', () => {
  return {
    getDoc: vi.fn(),
    getDocWhere: vi.fn(),
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
      searchLinks: [{
        name: 'link name',
        showLink: 'show link',
        episodeLink: 'episode link',
      }],
      username: 'user name',
    }

    // @ts-ignore
    getDocWhere.mockResolvedValue(user)
  })

  describe('GET /tv/user', () => {
    it('returns username and search links', async (ctx) => {
      // @ts-ignore
      getDoc.mockResolvedValue(user)

      const res = await ctx.request.get('/tv/user').set('api-key', 'api-key')

      expect(res.status).to.equal(200)
      expect(res.body).to.deep.equal({
        searchLinks: [{
          name: 'link name',
          showLink: 'show link',
          episodeLink: 'episode link',
        }],
        username: 'user name',
      })
    })

    it('sends 404 if user is not found', async (ctx) => {
      // @ts-ignore
      getDoc.mockResolvedValue(undefined)

      const res = await ctx.request.get('/tv/user').set('api-key', 'api-key')

      expect(res.status).to.equal(404)
      expect(res.body).to.deep.equal({ error: 'User with id \'user-id\' not found' })
    })

    it('sends 500 on error', (ctx) => {
      return testError(getDoc, () => {
        return ctx.request.get('/tv/user').set('api-key', 'api-key')
      })
    })
  })

  describe('PUT /tv/user', () => {
    it('updates user props and returns updated user', async (ctx) => {
      const update = {
        searchLinks: [{
          name: 'new link name',
          showLink: 'new show link',
          episodeLink: 'new episode link',
        }],
      }

      // @ts-ignore
      getDoc.mockResolvedValue({
        ...user,
        ...update,
      })

      const res = await ctx.request.put('/tv/user')
      .set('api-key', 'api-key')
      .send(update)

      expect(updateDoc).toBeCalledWith('users/user-id', update)
      expect(res.status).to.equal(200)
      expect(res.body).to.deep.equal({
        searchLinks: [{
          name: 'new link name',
          showLink: 'new show link',
          episodeLink: 'new episode link',
        }],
        username: 'user name',
      })
    })

    it('sends 404 if user is not found', async (ctx) => {
      // @ts-ignore
      getDoc.mockResolvedValue(undefined)

      const res = await ctx.request.put('/tv/user').set('api-key', 'api-key')

      expect(res.status).to.equal(404)
      expect(res.body).to.deep.equal({ error: 'User with id \'user-id\' not found' })
    })

    it('sends 500 on error', (ctx) => {
      return testError(getDoc, () => {
        return ctx.request.put('/tv/user').set('api-key', 'api-key').send({})
      })
    })
  })
})
