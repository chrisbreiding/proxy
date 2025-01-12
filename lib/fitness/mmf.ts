import { debug } from '../util/debug'
import { request } from '../util/network'
import type { ChallengeDetails, MMFChallengeDetails } from './types'

export async function fetchChallengeDetails (token: string, apiKey: string, userId: string) {
  debug('Getting challenge details...')

  const url = 'https://api.mapmyfitness.com/challenges/challenge/yvty2025/details'
  const headers = {
    authorization: `Bearer ${token}`,
    apiKey,
  }
  const params = {
    mmfUserId: userId,
    timezone: 'America/New_York',
  }

  const response = await request<MMFChallengeDetails>({ url, headers, params })

  return {
    progress: {
      goal: response.progress.goal,
      currentScore: response.progress.currentScore,
    },
    stats: response.stats.reduce((memo, stat) => {
      memo[stat.name] = stat.value
      return memo
    }, {} as ChallengeDetails['stats']),
  } as ChallengeDetails
}
