import dayjs from 'dayjs'
import Debug from 'debug'
import minimist from 'minimist'
import type { BlockObjectResponse } from '@notionhq/client/build/src/api-endpoints'

import {
  appendBlockChildren,
  BlockContent,
  getBlockChildren,
  getBlockChildrenDeep,
  getBlockContent,
  getMonthNameFromIndex,
  getMonths,
  getBlockPlainText,
  makeBlock,
  textFilter,
} from './util'
import { clone, compact } from '../util/collections'
import { getEnv } from '../util/env'

const debug = Debug('proxy:scripts')

interface YearTemplateItem {
  rule: string | undefined
  quests: BlockContent[]
}

async function getYearTemplate (yearTemplateId: string, notionToken: string): Promise<YearTemplateItem[]> {
  const { results } = await getBlockChildren({ notionToken, pageId: yearTemplateId })

  const blocks = (results as BlockObjectResponse[]).filter((block) => {
    return block.has_children
  })

  return Promise.all(blocks.map(async (block) => {
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
  [key: string]: BlockContent[]
}

interface DateAndQuests {
  date: string
  quests: BlockContent[]
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
    [key: string]: BlockContent[]
  }
}

async function getExtras (extrasId: string, notionToken: string) {
  const { results } = await getBlockChildren({ notionToken, pageId: extrasId })

  const months = {} as Extras
  let currentMonth
  let currentDate

  for (const block of (results as BlockObjectResponse[])) {
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

    const content = await getBlockContent({ notionToken, block, filter: textFilter })
    months[currentMonth][currentDate].push(content!)
  }

  return months
}

function getMonthsData (yearTemplateItem: YearTemplateItem[], extras: Extras) {
  return getStartingMonthsData().map((month) => {
    for (const templateItem of yearTemplateItem) {
      for (const matchesPattern of patterns) {
        const result = matchesPattern(templateItem.rule || '', month.index)

        if (result.matches) {
          const quests = clone(templateItem.quests)
          month.dates[result.date] = (month.dates[result.date] || []).concat(quests)
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

const makeBlocks = (monthsData: MonthData[], year: number): BlockContent[] => {
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
  }).flat() as (BlockContent | undefined)[]

  return compact(blocks)
}

function findId (
  blocks: BlockObjectResponse[],
  filter: (block: BlockObjectResponse) => boolean,
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
  const response = await getBlockChildren({ notionToken, pageId: futurePageId })
  const results = response.results as BlockObjectResponse[]

  const extrasId = findId(results, (block) => {
    return block.type === 'child_page' && block.child_page.title === `${year}`
  })

  const dropZoneId = findId(results, (block) => {
    return block.type === 'synced_block'
  }, 'Could not find drop zone')

  const yearTemplateId = findId(results, (block) => {
    return block.type === 'child_page' && block.child_page.title === 'Year Template'
  }, 'Could not find year template')

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

  debug('addYear: %o', {
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

    // eslint-disable-next-line no-console
    console.log('Successfully added year')

    process.exit(0)
  } catch (error: any) {
    // eslint-disable-next-line no-console
    console.log('Adding year failed:')
    // eslint-disable-next-line no-console
    console.log(error?.stack || error)

    process.exit(1)
  }
}
