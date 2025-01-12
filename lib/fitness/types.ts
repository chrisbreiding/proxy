export interface MMFChallengeStat {
  name: 'calories_burned' | 'total_time' | 'total_workouts'
  label: string
  value: number
}

export interface MMFChallengeDetails {
  progress: {
    unitLabel: string
    goal: number
    currentScore: number
    progressHeader: string
    progressTagline: string
  }
  stats: MMFChallengeStat[]
}

export interface ChallengeDetails {
  progress: {
    goal: number
    currentScore: number
  }
  stats: Record<MMFChallengeStat['name'], number>
}

export interface Breakdown {
  aheadOfGoalForToday: boolean
  aheadOfGoalForWeek: boolean
  daysLeftThroughWeekendExcludingToday: number
  milesNeededToBeOnTrackToday: number
  milesPerDayNeededToBeOnTrackThroughWeekend: number
  totalProgressMade: number
  untilEndOfTodayDifference: number
  untilEndOfWeekendDifference: number
  yearlyGoal: number
  yearlyPercentComplete: number
}

export interface Stats {
  caloriesBurned: string
  totalTime: string
  totalWorkouts: string
}

export type MMFUserId = string

export interface CacheValue {
  date: string
  details: ChallengeDetails
}
