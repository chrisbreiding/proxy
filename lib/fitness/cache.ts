import deepEqual from 'deep-equal'

import type { CacheValue, ChallengeDetails, MMFUserId } from './types'
import type { Dayjs } from 'dayjs'
import { PersistentData } from '../util/persistent-data'

export interface PersistentDataStructure {
  cache: {
    [key: string]: CacheValue
  }
}

const persistentData = new PersistentData<PersistentDataStructure>('fitness-data')

async function getCache (userId: MMFUserId) {
  const data = await persistentData.get()

  return (data?.cache || {})[userId]
}

async function setCache (userId: MMFUserId, value: CacheValue) {
  const data = (await persistentData.get()) || { cache: {} }

  data.cache[userId] = value

  await persistentData.set(data)
}

function isCachedValueValid (latestChallengeDetails: ChallengeDetails, date: Dayjs, value?: CacheValue) {
  return (
    !!value
    && value.date === date.format('YYYY-MM-DD')
    && deepEqual(value.details, latestChallengeDetails)
  )
}

export async function areChallengeDetailsUnchangedToday (userId: MMFUserId, latestChallengeDetails: ChallengeDetails, date: Dayjs) {
  const cachedValue = await getCache(userId)

  return isCachedValueValid(latestChallengeDetails, date, cachedValue)
}

export async function setCachedValue (userId: MMFUserId, value: ChallengeDetails, date: Dayjs) {
  await setCache(userId, {
    date: date.format('YYYY-MM-DD'),
    details: value,
  })
}
