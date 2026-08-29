import { describe, it, expect } from 'vitest'

import { getIntervalOccurrences, isValidInterval } from '../../../lib/util/interval'

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

  describe('#getIntervalOccurrences', () => {
    const day = new Date(2026, 7, 29)

    it('returns an empty array if the interval is not valid', () => {
      expect(getIntervalOccurrences('nope', day)).to.deep.equal([])
    })

    it('returns the minutes of the day a schedule runs', () => {
      expect(getIntervalOccurrences('at 1:07 am', day)).to.deep.equal([67])
      expect(getIntervalOccurrences('at 1:07 am and 1:07 pm', day)).to.deep.equal([67, 787])
    })

    it('returns every minute a repeating schedule runs', () => {
      const occurrences = getIntervalOccurrences('every 60 minutes starting on the 22nd minute', day)

      expect(occurrences).to.have.length(24)
      expect(occurrences.slice(0, 3)).to.deep.equal([22, 82, 142])
    })

    it('treats a plain duration as starting one interval after midnight', () => {
      expect(getIntervalOccurrences('6 hours', day)).to.deep.equal([360, 720, 1080])
    })

    it('does not count the next day as an occurrence', () => {
      const occurrences = getIntervalOccurrences('every 15 minutes', day)

      expect(occurrences).to.have.length(96)
      expect(occurrences[0]).to.equal(0)
      expect(occurrences[95]).to.equal(1425)
    })

    it('returns an empty array if the schedule never runs on the day', () => {
      expect(getIntervalOccurrences('at 1:07 am on the 15th day of the month', day)).to.deep.equal([])
    })

    it('returns an empty array if the interval runs too often to chart', () => {
      // a schedule, a duration, and a duration shorter than the chart's
      // minute-level resolution
      expect(getIntervalOccurrences('every 5 minutes', day)).to.deep.equal([])
      expect(getIntervalOccurrences('10 minutes', day)).to.deep.equal([])
      expect(getIntervalOccurrences('30 seconds', day)).to.deep.equal([])
    })
  })

})
