import Mixpanel from 'mixpanel'
import { beforeEach, describe, expect, it, Mock, vi } from 'vitest'

const mixpanelToken = process.env.MIXPANEL_TOKEN = 'mixpanel-token'

import { startServer } from '../../../index'
import { getDocWhere } from '../../../lib/tv/store/firebase'
import { handleServer } from '../../util'
import { MixpanelMock, mockMixpanel } from './util'

vi.mock('mixpanel', () => {
  return {
    default: {
      init: vi.fn(),
    },
  }
})

vi.mock('../../../lib/tv/store/firebase', () => {
  return {
    getDocWhere: vi.fn(),
  }
})

describe('lib/tv/stats', () => {
  let mixpanelMock: MixpanelMock
  handleServer(startServer)

  beforeEach(() => {
    vi.clearAllMocks()

    mixpanelMock = mockMixpanel()

    ;(Mixpanel.init as Mock).mockReturnValue(mixpanelMock)
    ;(getDocWhere as Mock).mockResolvedValue({
      apiKey: 'api-key',
      id: 'user-1',
      username: 'user1',
    })
  })

  describe('POST /tv/stats', () => {
    it('sends the event and data to mixpanel and returns 204', async (ctx) => {
      const event = 'decathlon'
      const data = { some: 'deets' }
      const res = await ctx.request.post('/tv/stats')
      .set('api-key', 'api-key')
      .send({ event, data })

      expect(res.status).to.equal(204)
      expect(Mixpanel.init).toBeCalledWith(mixpanelToken)
      expect(mixpanelMock.people.set).toBeCalledWith('api-key', { username: 'user1' })
      expect(mixpanelMock.track).toBeCalledWith(event, {
        distinct_id: 'api-key',
        some: 'deets',
      })
    })

    it('allows request to have no api key', async (ctx) => {
      (getDocWhere as Mock).mockResolvedValue(undefined)

      const event = 'decathlon'
      const data = { some: 'deets' }
      const res = await ctx.request.post('/tv/stats')
      .set('api-key', 'wrong')
      .send({ event, data })

      expect(res.status).to.equal(204)
      expect(Mixpanel.init).toBeCalledWith(mixpanelToken)
      expect(mixpanelMock.people.set).not.toBeCalled
      expect(mixpanelMock.track).toBeCalledWith(event, { some: 'deets' })
    })

    it('allows request to be unauthenticated', async (ctx) => {
      const event = 'decathlon'
      const data = { some: 'deets' }
      const res = await ctx.request.post('/tv/stats')
      .send({ event, data })

      expect(res.status).to.equal(204)
      expect(Mixpanel.init).toBeCalledWith(mixpanelToken)
      expect(mixpanelMock.people.set).not.toBeCalled
      expect(mixpanelMock.track).toBeCalledWith(event, { some: 'deets' })
    })

    it('ignores init errors', async (ctx) => {
      (Mixpanel.init as Mock).mockImplementation(() => {
        throw new Error('mixpanel init error')
      })

      const res = await ctx.request.post('/tv/stats')
      .set('api-key', 'api-key')
      .send({})

      expect(res.status).to.equal(204)
    })

    it('ignores people.set errors', async (ctx) => {
      mixpanelMock.people.set.mockImplementation(() => {
        throw new Error('mixpanel people.set error')
      })

      const res = await ctx.request.post('/tv/stats')
      .set('api-key', 'api-key')
      .send({})

      expect(res.status).to.equal(204)
    })

    it('ignores track errors', async (ctx) => {
      mixpanelMock.track.mockImplementation(() => {
        throw new Error('mixpanel track error')
      })

      const res = await ctx.request.post('/tv/stats')
      .set('api-key', 'api-key')
      .send({})

      expect(res.status).to.equal(204)
    })
  })
})
