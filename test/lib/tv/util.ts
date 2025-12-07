import nock from 'nock'
import { Mock, vi } from 'vitest'

import { baseUrl } from '../../../lib/tv/source/util'

export function nockLogin ({ apikey, pin, times = 1 }: { apikey: string, pin: string, times?: number }) {
  return nock(baseUrl)
  .post('/v4/login', { apikey, pin })
  .times(times)
  .reply(200, { data: { token: 'token' } })
}

export interface MixpanelMock {
  people: {
    set: Mock<(...args: any[]) => any>
  }
  track: Mock<(...args: any[]) => any>
}

export function mockMixpanel () {
  return {
    people: {
      set: vi.fn(),
    },
    track: vi.fn(),
  }
}
