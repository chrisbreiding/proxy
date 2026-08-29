import type { ScheduleData } from '@breejs/later'

// bree parses interval strings with `later.parse.text` and, failing that,
// `human-interval` / `ms`. re-use its parser so the admin page accepts exactly
// the same values bree does
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { parseValue } = require('bree/src/job-utils') as { parseValue: (value: string) => unknown }
// eslint-disable-next-line @typescript-eslint/no-require-imports
const later = require('@breejs/later') as typeof import('@breejs/later')

// bree does the same, so schedules resolve against the server's timezone
later.date.localTime()

const minutesPerDay = 24 * 60
const msPerMinute = 60 * 1000
const msPerDay = minutesPerDay * msPerMinute

// a job that runs more often than every 15 minutes would fill the chart with a
// solid block of bars, which conveys less than leaving it out entirely
const maxOccurrences = minutesPerDay / 15

export function isValidInterval (value: unknown): value is string {
  if (typeof value !== 'string' || !value.trim()) return false

  try {
    const parsedValue = parseValue(value.trim()) as ScheduleData

    if (parsedValue.error >= 0) return false

    return true
  } catch (_) {
    return false
  }
}

function getMinuteOfDay (date: Date) {
  return date.getHours() * 60 + date.getMinutes()
}

// the times an interval runs over a single day, as minutes since midnight. an
// interval that never runs, isn't valid, or runs too often to chart is empty
export function getIntervalOccurrences (value: unknown, day: Date = new Date()): number[] {
  if (!isValidInterval(value)) return []

  const start = new Date(day)

  start.setHours(0, 0, 0, 0)

  const end = new Date(start.getTime() + msPerDay)
  const parsed = parseValue(value.trim())
  const minutes = [] as number[]

  if (typeof parsed === 'number') {
    // bree runs a plain duration relative to when it starts the job, so there's
    // no real clock time to chart. assume the day starts one interval in
    if (parsed < msPerMinute) return []

    for (let time = start.getTime() + parsed; time < end.getTime(); time += parsed) {
      if (minutes.length >= maxOccurrences) return []

      minutes.push(getMinuteOfDay(new Date(time)))
    }
  } else {
    const next = later.schedule(parsed as ScheduleData).next(maxOccurrences + 1, start, end)
    const dates = (Array.isArray(next) ? next : [next])
    // later treats the end of the range as inclusive, so the next day's
    // midnight can come back as a final occurrence
    .filter((date) => date instanceof Date && date.getTime() < end.getTime())

    if (dates.length > maxOccurrences) return []

    for (const date of dates) {
      minutes.push(getMinuteOfDay(date))
    }
  }

  return [...new Set(minutes)].sort((a, b) => a - b)
}
