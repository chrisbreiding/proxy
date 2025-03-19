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
  const startOfYear = dayjs(`${now.year()}-01-01`)
  const daysPassedIncludingToday = Math.ceil((now.diff(startOfYear, 'day')))
  const daysLeftThroughWeekendExcludingToday = now.day() === 0 ? 0 : 7 - now.day() // through Sunday
  const daysPassedAtEndOfWeek = daysPassedIncludingToday + daysLeftThroughWeekendExcludingToday

  return {
    daysLeftThroughWeekendExcludingToday,
    daysPassedAtEndOfWeek,
    daysPassedIncludingToday,
    now,
  }
}

function getBreakdown (progress: ChallengeDetails['progress'], dates: ReturnType<typeof getDates>) {
  const { daysLeftThroughWeekendExcludingToday, daysPassedAtEndOfWeek, daysPassedIncludingToday } = dates

  const yearlyGoal = (progress.goal / 1000) * 0.621371 // miles
  const dailyGoal = yearlyGoal / 365
  const totalProgressMade = (progress.currentScore / 1000) * 0.621371 // miles
  const yearlyPercentComplete = totalProgressMade / yearlyGoal * 100

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

  return {
    aheadOfGoalForToday,
    aheadOfGoalForWeek,
    daysLeftThroughWeekendExcludingToday,
    milesNeededToBeOnTrackToday,
    milesPerDayNeededToBeOnTrackThroughWeekend,
    totalProgressMade,
    untilEndOfTodayDifference,
    untilEndOfWeekendDifference: Math.abs(untilEndOfWeekendDifference),
    yearlyGoal,
    yearlyPercentComplete,
  }
}

function getStats (stats: ChallengeDetails['stats']) {
  const caloriesBurned = stats.calories_burned
  const _totalTime = stats.total_time
  const totalTime = _totalTime ? dayjs.duration(_totalTime, 'seconds').format('H:mm:ss') : undefined
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
    aheadOfGoalForToday,
    aheadOfGoalForWeek,
    daysLeftThroughWeekendExcludingToday,
    milesNeededToBeOnTrackToday,
    milesPerDayNeededToBeOnTrackThroughWeekend,
    totalProgressMade,
    untilEndOfTodayDifference,
    untilEndOfWeekendDifference,
    yearlyGoal,
    yearlyPercentComplete,
  } = breakdown
  const { caloriesBurned, totalTime, totalWorkouts } = stats

  const todayDebugStatus = aheadOfGoalForToday ?
    `You're ${toTwoDecimals(untilEndOfTodayDifference)} ${pluralize(untilEndOfTodayDifference, 'mile')} ahead!`
    : `Needed to be on track today
    - ${toTwoDecimals(milesNeededToBeOnTrackToday)} ${pluralize(milesNeededToBeOnTrackToday, 'mile')}`

  const weekDebugStatus = aheadOfGoalForWeek ?
    `You're ${toTwoDecimals(untilEndOfWeekendDifference)} ${pluralize(untilEndOfWeekendDifference, 'mile')} ahead!`
    : `Needed to be on track this week
    - ${toTwoDecimals(untilEndOfWeekendDifference)} ${pluralize(untilEndOfWeekendDifference, 'mile')} / ${daysLeftThroughWeekendExcludingToday} ${pluralize(daysLeftThroughWeekendExcludingToday, 'day')}
    - ${toTwoDecimals(milesPerDayNeededToBeOnTrackThroughWeekend)} ${pluralize(milesPerDayNeededToBeOnTrackThroughWeekend, 'mile')} per day`

  debug(`
    ${toTwoDecimals(yearlyPercentComplete)}% complete
    ${toTwoDecimals(totalProgressMade)} / ${Math.round(yearlyGoal)} miles
    ---
    ${todayDebugStatus}
    ${weekDebugStatus}
    ---
    Stats
    - ${caloriesBurned} calories burned
    - ${totalTime} total time
    - ${totalWorkouts} total workouts
  `)
}

function getTodayStatus (breakdown: Breakdown) {
  const { aheadOfGoalForToday, milesNeededToBeOnTrackToday, untilEndOfTodayDifference } = breakdown

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
    aheadOfGoalForWeek,
    milesNeededToBeOnTrackToday,
    untilEndOfWeekendDifference,
    daysLeftThroughWeekendExcludingToday,
    milesPerDayNeededToBeOnTrackThroughWeekend,
  } = breakdown

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

async function updateFitnessDashboard (breakdown: Breakdown, stats: Stats, token: string, blockId: string, date: Dayjs) {
  const {
    totalProgressMade,
    yearlyGoal,
    yearlyPercentComplete,
  } = breakdown
  const { caloriesBurned, totalTime, totalWorkouts } = stats

  await clearExistingBlocks(token, blockId)

  logDashboardToDebug(breakdown, stats)

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
  mmfToken: string
  mmfApiKey: string
  mmfUserId: string
  notionToken: string
  notionFitnessId: string
}

export async function updateFitness (props: UpdateFitnessProps) {
  const { mmfToken, mmfApiKey, mmfUserId, notionToken, notionFitnessId } = props
  const dates = getDates()
  const { changed, challengeDetails } = await getChallengeDetails(mmfToken, mmfApiKey, mmfUserId, dates.now)

  if (!changed) {
    debug('Challenge details have not changed, skipping update')

    return
  }

  const breakdown = getBreakdown(challengeDetails.progress, dates)
  const stats = getStats(challengeDetails.stats)

  await updateFitnessDashboard(breakdown, stats, notionToken, notionFitnessId, dates.now)
  await setCachedValue(mmfUserId, challengeDetails, dates.now)
}
