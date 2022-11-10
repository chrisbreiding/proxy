import { describe, expect, it, vi } from 'vitest'

import { getUserByApiKey } from '../../../../lib/tv/store/users'
import { getDocWhere } from '../../../../lib/tv/store/firebase'

vi.mock('../../../../lib/tv/store/firebase', () => {
  return {
    getDocWhere: vi.fn(),
  }
})

describe('lib/tv/store/users', () => {
  describe('#getUserByApiKey', () => {
    it('returns user with api key', async () => {
      const user = {}

      // @ts-ignore
      getDocWhere.mockResolvedValue(user)

      const result = await getUserByApiKey('api-key')

      expect(result).to.equal(user)
    })

    it('returns undefined if no match', async () => {
      // @ts-ignore
      getDocWhere.mockResolvedValue(undefined)

      const result = await getUserByApiKey('api-key')

      expect(result).to.be.undefined
    })
  })
})
