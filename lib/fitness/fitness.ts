import dayjs, { Dayjs } from 'dayjs'
import duration from 'dayjs/plugin/duration'

import { makeBlock, makeDivider, makeRichText } from '../notion/util/general'
import { getBlockChildren } from '../notion/util/queries'
import { appendBlockChildren, deleteBlock } from '../notion/util/updates'
import { compact } from '../util/collections'
import { debug } from '../util/debug'
import { fetchChallengeDetails } from './mmf'
import type { Breakdown, ChallengeDetails, Stats } from './types'
import { areChallengeDetailsUnchangedToday, setCachedValue } from './cache'

dayjs.extend(duration)

function getDates () {
  const now = dayjs()
  const isOver = now.isAfter(dayjs('2025-12-31'))
  const startOfYear = dayjs('2025-01-01').startOf('day')
  const endOfYear = dayjs('2025-12-31').endOf('day')
  const daysLeftInYear = isOver ? 0 : endOfYear.startOf('day').diff(now, 'day') + 1
  const daysPassedIncludingToday = now.startOf('day').diff(startOfYear, 'day') + 1
  const daysInWeek = daysLeftInYear < 7 ? daysLeftInYear : 7
  // through Sunday unless it's the final week of the year
  const daysLeftThroughWeekendExcludingToday = now.day() === 0 ? 0 : daysInWeek - now.day()
  const daysPassedAtEndOfWeek = daysPassedIncludingToday + daysLeftThroughWeekendExcludingToday

  return {
    daysLeftInYear,
    daysLeftThroughWeekendExcludingToday,
    daysPassedAtEndOfWeek,
    daysPassedIncludingToday,
    isOver,
    now,
  }
}

function getBreakdown (progress: ChallengeDetails['progress'], dates: ReturnType<typeof getDates>): Breakdown {
  const { daysLeftInYear, daysLeftThroughWeekendExcludingToday, daysPassedAtEndOfWeek, daysPassedIncludingToday, isOver } = dates
  const yearlyGoal = (progress.goal / 1000) * 0.621371 // miles
  const dailyGoal = yearlyGoal / 365
  const totalProgressMade = (progress.currentScore / 1000) * 0.621371 // miles
  const _yearlyPercentComplete = totalProgressMade / yearlyGoal * 100
  const yearlyPercentComplete = _yearlyPercentComplete > 100 ? 100 : _yearlyPercentComplete
  const accomplishedChallenge = yearlyPercentComplete === 100
  const milesNeededToCompleteChallenge = Math.abs(yearlyGoal - totalProgressMade)

  if (isOver) {
    return {
      accomplishedChallenge,
      aheadOfGoalForToday: false,
      aheadOfGoalForWeek: false,
      daysLeftInYear,
      daysLeftThroughWeekendExcludingToday: 0,
      isOver,
      milesNeededToBeOnTrackToday: 0,
      milesNeededToCompleteChallenge,
      milesPerDayNeededToBeOnTrackThroughWeekend: 0,
      milesPerDayNeededToBeOnTrackThroughYear: 0,
      totalProgressMade,
      untilEndOfTodayDifference: 0,
      untilEndOfWeekendDifference: 0,
      yearlyGoal,
      yearlyPercentComplete,
    }
  }

  const untilEndOfTodayGoal = dailyGoal * daysPassedIncludingToday
  const untilEndOfTodayDifference = totalProgressMade - untilEndOfTodayGoal
  const aheadOfGoalForToday = untilEndOfTodayDifference >= 0
  const milesNeededToBeOnTrackToday = aheadOfGoalForToday ? 0 : Math.abs(untilEndOfTodayDifference)

  const untilEndOfWeekendGoal = daysPassedAtEndOfWeek * dailyGoal
  const untilEndOfWeekendDifference = totalProgressMade - untilEndOfWeekendGoal
  const aheadOfGoalForWeek = untilEndOfWeekendDifference >= 0


  const milesPerDayNeededToBeOnTrackThroughWeekend = (() => {
    if (daysLeftThroughWeekendExcludingToday === 0) return 0
    if (aheadOfGoalForWeek) return 0

    return Math.abs(untilEndOfWeekendDifference) / daysLeftThroughWeekendExcludingToday
  })()

  const milesPerDayNeededToBeOnTrackThroughYear = (() => {
    if (yearlyPercentComplete === 100) return 0

    return Math.abs(yearlyGoal - totalProgressMade) / daysLeftInYear
  })()

  return {
    accomplishedChallenge,
    aheadOfGoalForToday,
    aheadOfGoalForWeek,
    daysLeftInYear,
    daysLeftThroughWeekendExcludingToday,
    isOver,
    milesNeededToBeOnTrackToday,
    milesNeededToCompleteChallenge,
    milesPerDayNeededToBeOnTrackThroughWeekend,
    milesPerDayNeededToBeOnTrackThroughYear,
    totalProgressMade,
    untilEndOfTodayDifference,
    untilEndOfWeekendDifference: Math.abs(untilEndOfWeekendDifference),
    yearlyGoal,
    yearlyPercentComplete,
  }
}

const getTotalTime = (statTime?: number) => {
  if (!statTime) return undefined

  const formattedTime = dayjs.duration(statTime, 'seconds').format('HHH:mm:ss')

  // remove extra zeros when under 10/100 hours
  return formattedTime.replace(/^0+/, '')
}

function getStats (stats: ChallengeDetails['stats']) {
  const caloriesBurned = stats.calories_burned?.toLocaleString('en-US')
  const totalTime = getTotalTime(stats.total_time)
  const totalWorkouts = stats.total_workouts

  return {
    caloriesBurned: caloriesBurned ? `${caloriesBurned}` : '<unknown>',
    totalTime: totalTime ? `${totalTime}` : '<unknown>',
    totalWorkouts: totalWorkouts ? `${totalWorkouts}` : '<unknown>',
  }
}

async function getChallengeDetails (token: string, apiKey: string, userId: string, date: Dayjs) {
  const challengeDetails = await fetchChallengeDetails(token, apiKey, userId)

  if (await areChallengeDetailsUnchangedToday(userId, challengeDetails, date)) {
    return {
      changed: false,
      challengeDetails,
    }
  }

  return {
    changed: true,
    challengeDetails,
  }
}

function makeStat (value: string, label: string) {
  return makeBlock({
    content: {
      rich_text: [makeRichText(value, { bold: true }), makeRichText(label)],
    },
    type: 'bulleted_list_item',
  })
}

function t (text: string, bold = false) {
  return makeRichText(text, { bold })
}

type Color = 'default' | 'green' | 'orange' | 'red' | 'blue' | 'gray'

function b (type: 'paragraph' | 'bulleted_list_item', richTexts: ReturnType<typeof t>[], color: Color = 'default') {
  return makeBlock({
    content: { rich_text: richTexts, color },
    type,
  })
}

function p (richTexts: ReturnType<typeof t>[], color: Color = 'default') {
  return b('paragraph', richTexts, color)
}

function li (richTexts: ReturnType<typeof t>[], color: Color = 'default') {
  return b('bulleted_list_item', richTexts, color)
}

async function clearExistingBlocks (token: string, blockId: string) {
  debug('Deleting existing blocks...')

  const existingBlocks = await getBlockChildren({ notionToken: token, pageId: blockId })

  for (const block of existingBlocks) {
    await deleteBlock({ notionToken: token, id: block.id })
  }
}

function pluralize (value: number, label: string) {
  return toTwoDecimals(value) === 1 ? label : `${label}s`
}

function logDashboardToDebug (breakdown: Breakdown, stats: Stats) {
  const {
    accomplishedChallenge,
    aheadOfGoalForToday,
    aheadOfGoalForWeek,
    daysLeftThroughWeekendExcludingToday,
    daysLeftInYear,
    isOver,
    milesNeededToBeOnTrackToday,
    milesNeededToCompleteChallenge,
    milesPerDayNeededToBeOnTrackThroughWeekend,
    milesPerDayNeededToBeOnTrackThroughYear,
    totalProgressMade,
    untilEndOfTodayDifference,
    untilEndOfWeekendDifference,
    yearlyGoal,
    yearlyPercentComplete,
  } = breakdown
  const { caloriesBurned, totalTime, totalWorkouts } = stats

  const todayDebugStatus = (() => {
    if (isOver) return ''

    if (aheadOfGoalForToday) {
      return `You're ${toTwoDecimals(untilEndOfTodayDifference)} ${pluralize(untilEndOfTodayDifference, 'mile')} ahead!`
    }

    return (
      `Needed to be on track today
    - ${toTwoDecimals(milesNeededToBeOnTrackToday)} ${pluralize(milesNeededToBeOnTrackToday, 'mile')}`
    )
  })()

  const weekDebugStatus = (() => {
    if (isOver) return ''

    if (aheadOfGoalForWeek) {
      return `You're ${toTwoDecimals(untilEndOfWeekendDifference)} ${pluralize(untilEndOfWeekendDifference, 'mile')} ahead!`
    }

    return (
      `Needed to be on track this week
    - ${toTwoDecimals(untilEndOfWeekendDifference)} ${pluralize(untilEndOfWeekendDifference, 'mile')} / ${daysLeftThroughWeekendExcludingToday} ${pluralize(daysLeftThroughWeekendExcludingToday, 'day')}
    - ${toTwoDecimals(milesPerDayNeededToBeOnTrackThroughWeekend)} ${pluralize(milesPerDayNeededToBeOnTrackThroughWeekend, 'mile')} per day`
    )
  })()

  const yearDebugStatus = accomplishedChallenge ?
    'You completed the challenge!'
    : `Needed to complete the challenge
    - ${toTwoDecimals(milesNeededToCompleteChallenge)} ${pluralize(milesNeededToCompleteChallenge, 'mile')} / ${daysLeftInYear} ${pluralize(daysLeftInYear, 'day')}
    - ${toTwoDecimals(milesPerDayNeededToBeOnTrackThroughYear)} ${pluralize(milesPerDayNeededToBeOnTrackThroughYear, 'mile')} per day`

  debug(`
    ${toTwoDecimals(yearlyPercentComplete)}% complete
    ${toTwoDecimals(totalProgressMade)} / ${Math.round(yearlyGoal)} miles
    ---
    ${todayDebugStatus}
    ${weekDebugStatus}
    ${yearDebugStatus}
    ---
    Stats
    - ${caloriesBurned} calories burned
    - ${totalTime} total time
    - ${totalWorkouts} total workouts
  `)
}

function getTodayStatus (breakdown: Breakdown) {
  const {
    accomplishedChallenge,
    aheadOfGoalForToday,
    isOver,
    milesNeededToBeOnTrackToday,
    untilEndOfTodayDifference,
  } = breakdown

  if (isOver || accomplishedChallenge) {
    return []
  }

  if (aheadOfGoalForToday) {
    return [
      p([
        t('You\'re '),
        t(`${toTwoDecimals(untilEndOfTodayDifference)}`, true),
        t(` ${pluralize(untilEndOfTodayDifference, 'mile')} ahead for today!`),
      ], 'green'),
    ]
  }

  return [
    p([t('Needed to be on track today')]),
    li([
      t(`${toTwoDecimals(milesNeededToBeOnTrackToday)}`, true),
      t(` ${pluralize(milesNeededToBeOnTrackToday, 'mile')}`),
    ]),
  ]
}

function getWeekStatus (breakdown: Breakdown) {
  const {
    accomplishedChallenge,
    aheadOfGoalForWeek,
    isOver,
    milesNeededToBeOnTrackToday,
    untilEndOfWeekendDifference,
    daysLeftThroughWeekendExcludingToday,
    milesPerDayNeededToBeOnTrackThroughWeekend,
  } = breakdown

  if (isOver || accomplishedChallenge) {
    return []
  }

  if (aheadOfGoalForWeek) {
    return [
      p([
        t('You\'re '),
        t(`${toTwoDecimals(untilEndOfWeekendDifference)}`, true),
        t(` ${pluralize(untilEndOfWeekendDifference, 'mile')} ahead for the week!`),
      ], 'green'),
    ]
  }

  if (daysLeftThroughWeekendExcludingToday === 0) {
    return [
      p([t('Needed to be on track this week')]),
      li([
        t(`${toTwoDecimals(milesNeededToBeOnTrackToday)}`, true),
        t(` ${pluralize(milesNeededToBeOnTrackToday, 'mile')} today`),
      ]),
    ]
  }

  return [
    p([t('Needed to be on track this week')]),
    li([
      t(`${toTwoDecimals(untilEndOfWeekendDifference)}`, true),
      t(` ${pluralize(untilEndOfWeekendDifference, 'mile')} / ${daysLeftThroughWeekendExcludingToday} ${pluralize(daysLeftThroughWeekendExcludingToday, 'day')}`),
    ]),
    li([
      t(`${toTwoDecimals(milesPerDayNeededToBeOnTrackThroughWeekend)}`, true),
      t(` ${pluralize(milesPerDayNeededToBeOnTrackThroughWeekend, 'mile')} per day`),
    ]),
  ]
}

function getYearStatus (breakdown: Breakdown) {
  const {
    accomplishedChallenge,
    isOver,
    milesNeededToCompleteChallenge,
    daysLeftInYear,
    milesPerDayNeededToBeOnTrackThroughYear,
  } = breakdown

  if (accomplishedChallenge) {
    return [
      p([t('🎉 You completed the challenge! 🎉')], 'green'),
    ]
  }

  if (isOver) {
    return [
      p([
        t('😭 You failed the challenge by '),
        t(`${toTwoDecimals(milesNeededToCompleteChallenge)}`, true),
        t(` ${pluralize(milesNeededToCompleteChallenge, 'mile')}`),
      ], 'red'),
    ]
  }

  return [
    p([t('Needed to complete the challenge')]),
    li([
      t(`${toTwoDecimals(milesNeededToCompleteChallenge)}`, true),
      t(` ${pluralize(milesNeededToCompleteChallenge, 'mile')} / ${daysLeftInYear} ${pluralize(daysLeftInYear, 'day')}`),
    ]),
    li([
      t(`${toTwoDecimals(milesPerDayNeededToBeOnTrackThroughYear)}`, true),
      t(` ${pluralize(milesPerDayNeededToBeOnTrackThroughYear, 'mile')} per day`),
    ]),
  ]
}
async function updateFitnessDashboard (breakdown: Breakdown, stats: Stats, token: string, blockId: string, date: Dayjs, isDryRun: boolean) {
  const {
    totalProgressMade,
    yearlyGoal,
    yearlyPercentComplete,
  } = breakdown
  const { caloriesBurned, totalTime, totalWorkouts } = stats

  logDashboardToDebug(breakdown, stats)

  if (isDryRun) {
    return
  }

  await clearExistingBlocks(token, blockId)

  const blocks = compact([
    p([
      t(`${toTwoDecimals(yearlyPercentComplete)}%`, true),
      t(' complete'),
    ]),
    p([
      t(`${toTwoDecimals(totalProgressMade)}`, true),
      t(` / ${Math.round(yearlyGoal)} miles`),
    ]),
    makeDivider(),
    ...getTodayStatus(breakdown),
    ...getWeekStatus(breakdown),
    ...getYearStatus(breakdown),
    makeDivider(),
    p([t('Stats')]),
    makeStat(caloriesBurned, ' calories burned'),
    makeStat(totalTime, ' total time'),
    makeStat(totalWorkouts, ' total workouts'),
    makeDivider(),
    p([t('Updated '), t(`${date.format('MMM D, h:mma')}`)], 'gray'),
  ])

  debug('Adding blocks...')

  await appendBlockChildren({ notionToken: token, pageId: blockId, blocks })
}

function toTwoDecimals (value: number) {
  return Number(value.toFixed(2))
}

interface UpdateFitnessProps {
  isDryRun: boolean
  mmfToken: string
  mmfApiKey: string
  mmfUserId: string
  notionToken: string
  notionFitnessId: string
}

export async function updateFitness (props: UpdateFitnessProps) {
  const { isDryRun, mmfToken, mmfApiKey, mmfUserId, notionToken, notionFitnessId } = props

  debug(isDryRun ? 'Dry run' : 'Updating fitness')

  const dates = getDates()
  const { changed, challengeDetails } = await getChallengeDetails(mmfToken, mmfApiKey, mmfUserId, dates.now)

  if (!changed) {
    debug('Challenge details have not changed, skipping update')

    return
  }

  const breakdown = getBreakdown(challengeDetails.progress, dates)
  const stats = getStats(challengeDetails.stats)

  await updateFitnessDashboard(breakdown, stats, notionToken, notionFitnessId, dates.now, isDryRun)

  if (!isDryRun) {
    await setCachedValue(mmfUserId, challengeDetails, dates.now)
  }
}
