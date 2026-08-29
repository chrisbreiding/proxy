import type { ScheduleData } from '@breejs/later'

// bree parses interval strings with `later.parse.text` and, failing that,
// `human-interval` / `ms`. re-use its parser so the admin page accepts exactly
// the same values bree does
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { parseValue } = require('bree/src/job-utils') as { parseValue: (value: string) => unknown }

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
