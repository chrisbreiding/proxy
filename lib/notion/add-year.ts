import dayjs from 'dayjs'
import minimist from 'minimist'

import {
  appendBlockChildren,
  getBlockChildren,
  getBlockChildrenDeep,
  getBlockPlainText,
  getMonthNameFromIndex,
  getMonths,
  makeBlock,
  NotionBlock,
  OwnBlock,
  textFilter,
} from './util'
import { compact } from '../util/collections'
import { debug, debugVerbose } from '../util/debug'
import { getEnv } from '../util/env'

interface YearTemplateItem {
  rule: string | undefined
  quests: OwnBlock[]
}

async function getYearTemplate (yearTemplateId: string, notionToken: string): Promise<YearTemplateItem[]> {
  const blocks = await getBlockChildren({ notionToken, pageId: yearTemplateId })

  const blocksWithChildren = blocks.filter((block) => {
    return block.has_children
  })

  return Promise.all(blocksWithChildren.map(async (block) => {
    return {
      rule: getBlockPlainText(block),
      quests: await getBlockChildrenDeep({
        notionToken,
        pageId: block.id,
        filter: textFilter,
      }),
    }
  }))
}

interface DatesObject {
  [key: string]: OwnBlock[]
}

interface DateAndQuests {
  date: string
  quests: OwnBlock[]
}

interface StartingMonthData {
  name: string
  index: number
  dates: DatesObject
}

interface MonthData {
  name: string
  index: number
  dates: DateAndQuests[]
}

function getStartingMonthsData (): StartingMonthData[] {
  return getMonths().map((name, index) => {
    return {
      name,
      index,
      dates: {} as DatesObject,
    }
  })
}

const everyMonthRegex = /Every month( on (\d{1,2})\w{2})?/
const evenMonthsRegex = /Even months( on (\d{1,2}\w{2}))?/
const oddsMonthsRegex = /Odd months( on (\d{1,2}\w{2}))?/
const monthPattern = `(?:${getMonths().join('|')})`
const monthRegex = new RegExp(monthPattern)
const monthsRegex = new RegExp(`(${monthPattern}(?:(?:, )${monthPattern})*)`)
const dateRegex = / on (\d{1,2})[a-z]{2}/
const numberRegex = /^\d+$/
const noMatch = { matches: false, date: 0 }
const matchesFirst = { matches: true, date: 1 }
const matchesNumber = (numString: string) => ({ matches: true, date: Number(numString) })

const patterns = [
  // Every month [on <date>] (or assume 1st)
  (templateString: string) => {
    const match = templateString.match(everyMonthRegex)

    if (!match) return noMatch

    if (!match[2]) return matchesFirst

    return matchesNumber(match[2])
  },
  // Even months [on <date>] (or assume 1st)
  (templateString: string, monthIndex: number) => {
    if (monthIndex % 2 === 0) return noMatch

    const match = templateString.match(evenMonthsRegex)

    if (!match) return noMatch

    if (!match[2]) return matchesFirst

    return matchesNumber(match[2])
  },
  // Odd months [on <date>] (or assume 1st)
  (templateString: string, monthIndex: number) => {
    if (monthIndex % 2 !== 0) return noMatch

    const match = templateString.match(oddsMonthsRegex)

    if (!match) return noMatch

    if (!match[2]) return matchesFirst

    return matchesNumber(match[2])
  },
  // <month>[, <month>...]
  (templateString: string, monthIndex: number) => {
    const monthsMatch = templateString.match(monthsRegex)
    const dateMatch = templateString.match(dateRegex)

    if (!monthsMatch) return noMatch

    const matchedMonths = monthsMatch[1].split(/\s*,\s*/)
    const monthName = getMonthNameFromIndex(monthIndex)

    if (!matchedMonths.includes(monthName)) return noMatch

    if (!dateMatch || !dateMatch[1]) return matchesFirst

    return matchesNumber(dateMatch[1])
  },
]

const ascending = (a: string, b: string) => Number(a) - Number(b)

function datesObjectToSortedArray (dates: DatesObject): DateAndQuests[] {
  return Object.keys(dates).sort(ascending).map((date) => {
    return { date, quests: dates[date] }
  })
}

interface Extras {
  [key: string]: {
    [key: string]: OwnBlock[]
  }
}

async function getExtras (extrasId: string, notionToken: string) {
  const blocks = await getBlockChildrenDeep({ notionToken, pageId: extrasId })

  const months = {} as Extras
  let currentMonth
  let currentDate

  for (const block of blocks) {
    const text = getBlockPlainText(block)

    if (!text) {
      currentMonth = undefined
      currentDate = undefined

      continue
    }

    if (monthRegex.test(text)) {
      months[text] = {}
      currentMonth = text

      continue
    }

    if (numberRegex.test(text)) {
      if (!currentMonth) {
        throw new Error(`Tried to add the following date, but could not determine the month: '${text}'`)
      }

      months[currentMonth][text] = []
      currentDate = text

      continue
    }

    if (!currentMonth) {
      throw new Error(`Tried to add the following quest, but could not determine the month: '${text}'`)
    }

    if (!currentDate) {
      throw new Error(`Tried to add the following quest, but could not determine the date: '${text}'`)
    }

    if (textFilter(block)) {
      months[currentMonth][currentDate].push(block)
    }
  }

  return months
}

function getMonthsData (yearTemplateItem: YearTemplateItem[], extras: Extras) {
  return getStartingMonthsData().map((month) => {
    for (const templateItem of yearTemplateItem) {
      for (const matchesPattern of patterns) {
        const result = matchesPattern(templateItem.rule || '', month.index)

        if (result.matches) {
          month.dates[result.date] = (
            month.dates[result.date] || []
          ).concat(templateItem.quests)
        }
      }
    }

    const monthExtras = extras[month.name]

    if (monthExtras) {
      for (const date in monthExtras) {
        month.dates[date] = (month.dates[date] || []).concat(monthExtras[date])
      }
    }

    return {
      ...month,
      dates: datesObjectToSortedArray(month.dates),
    }
  })
}

function getDateString (year: string | number, month: string | number, date: string | number) {
  return dayjs(`${year}/${month}/${date}`, 'YYYY/M/D').format('ddd, M/D')
}

const makeBlocks = (monthsData: MonthData[], year: number): OwnBlock[] => {
  const blocks = monthsData.map(({ name, index, dates }) => {
    if (!dates.length) return

    return [
      makeBlock({
        text: '',
        type: 'paragraph',
      }),
      makeBlock({
        text: name,
        type: 'paragraph',
        annotations: {
          bold: true,
        },
      }),
      ...dates.map(({ date, quests }) => {
        return [
          makeBlock({
            text: getDateString(year, index + 1, date),
            type: 'paragraph',
          }),
          ...quests,
        ]
      }),
    ]
  }).flat() as (OwnBlock | undefined)[]

  return compact(blocks)
}

function findId (
  blocks: NotionBlock[],
  filter: (block: NotionBlock) => boolean,
  error?: string,
) {
  const block = blocks.find(filter)

  if (block) {
    return block.id
  }

  if (!block && error) {
    throw new Error(error)
  }
}

async function getPageIds (year: number | string, notionToken: string, futurePageId: string) {
  const blocks = await getBlockChildren({ notionToken, pageId: futurePageId })

  const extrasId = findId(blocks, (block) => {
    return (
      block.type === 'child_page'
      && 'title' in block.content
      && block.content.title === `${year}`
    )
  })

  const dropZoneId = findId(blocks, (block) => {
    return block.type === 'synced_block'
  }, 'Could not find drop zone')!

  const yearTemplateId = findId(blocks, (block) => {
    return (
      block.type === 'child_page'
      && 'title' in block.content
      && block.content.title === 'Year Template'
    )
  }, 'Could not find year template')!

  return {
    extrasId,
    dropZoneId,
    yearTemplateId,
  }
}

interface AddYearOptions {
  futurePageId: string
  notionToken: string
  year: number
}

export async function addYear ({ notionToken, futurePageId, year }: AddYearOptions) {
  const { yearTemplateId, dropZoneId, extrasId } = await getPageIds(year, notionToken, futurePageId)

  const yearTemplateBlocks = await getYearTemplate(yearTemplateId, notionToken)
  const extras = extrasId ? await getExtras(extrasId, notionToken) : {}
  const monthsData = getMonthsData(yearTemplateBlocks, extras)
  const blocks = makeBlocks(monthsData, year)

  await appendBlockChildren({ notionToken, blocks, pageId: dropZoneId })
}

export default async function main () {
  const notionToken = getEnv('NOTION_TOKEN')!
  const futurePageId = getEnv('NOTION_FUTURE_ID')!
  const { year } = minimist(process.argv.slice(2))

  debugVerbose('addYear: %o', {
    notionToken,
    futurePageId,
    year,
  })

  try {
    if (!year) {
      throw new Error('Must specify --year')
    }

    await addYear({
      notionToken,
      futurePageId,
      year,
    })

    debug('Successfully added year')

    process.exit(0)
  } catch (error: any) {
    debug('Adding year failed:')
    debug(error?.stack || error)

    process.exit(1)
  }
}
