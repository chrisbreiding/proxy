import deepEqual from 'deep-equal'

import type { CacheValue, ChallengeDetails, MMFUserId } from './types'
import dayjs from 'dayjs'
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

function isCachedValueValid (latestChallengeDetails: ChallengeDetails, value?: CacheValue) {
  return (
    !!value
    && value.date === dayjs().format('YYYY-MM-DD')
    && deepEqual(value.details, latestChallengeDetails)
  )
}

export async function areChallengeDetailsUnchangedToday (userId: MMFUserId, latestChallengeDetails: ChallengeDetails) {
  const cachedValue = await getCache(userId)

  return isCachedValueValid(latestChallengeDetails, cachedValue)
}

export async function setCachedValue (userId: MMFUserId, value: ChallengeDetails) {
  await setCache(userId, {
    date: dayjs().format('YYYY-MM-DD'),
    details: value,
  })
}
