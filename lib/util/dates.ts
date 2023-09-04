import dayjs from 'dayjs'

export function getMonthNameFromIndex (monthIndex: number, short = false) {
  return dayjs().month(monthIndex).format(short ? 'MMM' : 'MMMM')
}

export function getMonths ({ short }: { short?: boolean } = {}) {
  return Array.from(new Array(12)).map((_, i) => {
    return getMonthNameFromIndex(i, short)
  })
}

export const dateRegex = /^(?:Sun|Mon|Tue|Wed|Thu|Fri|Sat), (\d{1,2}\/\d{1,2})/

export function getDateFromText (text: string) {
  const [dateText] = text.trim().match(dateRegex) || []

  if (!dateText) return {}

  const currentDate = dayjs()
  // originally assume the date's year matches the current year
  let date = dayjs(`${dateText}/${currentDate.year()}`, 'M/D/YYYY')
  // if the current month is after the date's month, we've crossed over years
  // and the date's year should be the next year. usually, it's because it's
  // currently December, but the date's month is January. this can be
  // generically applied, so it will work if it's currently June, but we're
  // trying to get the weather for April. we don't want past weather, only
  // future weather, so assume it's for the following year.
  if (currentDate.month() > date.month()) {
    date = date.add(1, 'year')
  }

  return { date, dateText }
}
