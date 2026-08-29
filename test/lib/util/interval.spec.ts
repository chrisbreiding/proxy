import { describe, it, expect } from 'vitest'

import { isValidInterval } from '../../../lib/util/interval'

describe('lib/util/interval', () => {
  describe('#isValidInterval', () => {
    it('returns false if value is not a string', () => {
      expect(isValidInterval(undefined)).to.equal(false)
      expect(isValidInterval(123)).to.equal(false)
    })

    it('returns false if value is blank', () => {
      expect(isValidInterval('')).to.equal(false)
      expect(isValidInterval('   ')).to.equal(false)
    })

    it('returns true for a valid later.js text schedule', () => {
      expect(isValidInterval('every 15 minutes')).to.equal(true)
      expect(isValidInterval('  at 1:07 am  ')).to.equal(true)
    })

    it('returns false if later.js parses the value with an error', () => {
      expect(isValidInterval('at 25:99 am')).to.equal(false)
    })

    it('returns false if parsing throws', () => {
      expect(isValidInterval('not a valid interval at all')).to.equal(false)
    })
  })
})
