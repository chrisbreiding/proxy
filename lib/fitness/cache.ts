import deepEqual from 'deep-equal'

import type { CacheValue, ChallengeDetails, MMFUserId } from './types'
import dayjs from 'dayjs'

const cache = new Map<MMFUserId, CacheValue>()

function isCachedValueValid (latestChallengeDetails: ChallengeDetails, value?: CacheValue) {
  return (
    !!value
    && value.date === dayjs().format('YYYY-MM-DD')
    && deepEqual(value.details, latestChallengeDetails)
  )
}

export function areChallengeDetailsUnchangedToday (userId: MMFUserId, latestChallengeDetails: ChallengeDetails) {
  const cachedValue = cache.get(userId)

  return isCachedValueValid(latestChallengeDetails, cachedValue)
}

export function setCachedValue (userId: MMFUserId, value: ChallengeDetails) {
  cache.set(userId, {
    date: dayjs().format('YYYY-MM-DD'),
    details: value,
  })
}
