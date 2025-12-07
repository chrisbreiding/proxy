import dayjs from 'dayjs'

import { getBlockPlainText, makeTextPart } from './util/general'
import { compact, mapPromisesSerially } from '../util/collections'
import { debug, debugVerbose } from '../util/debug'
import { getEnv } from '../util/env'
import { getBlockChildrenDeep } from './util/queries'
import type { Block, NotionBlock, OwnBlock } from './types'
import { updateBlock } from './util/updates'

interface GetCategoryBlocksOptions {
  notionToken: string
  dateExtrapolationId: string
}

function getCategoryBlocks ({ notionToken, dateExtrapolationId }: GetCategoryBlocksOptions) {
  return getBlockChildrenDeep({
    notionToken,
    pageId: dateExtrapolationId,
    includeId: true,
    filter: (block) => block.type === 'toggle',
  })
}

function validateBlocks (blocks: NotionBlock[]) {
  const blocksSought = blocks.reduce((sought, block) => {
    // already guaranteed it's a toggle, so it definitely has string text
    const text = getBlockPlainText(block)!.trim()

    if (text === 'Historical' && block.children?.length) {
      sought.historical = true
    }

    if (text === 'Recent' && block.children?.length) {
      sought.recent = true
    }

    if (text === 'Extrapolated' && block.type === 'toggle' && block.children?.length) {
      sought.extrapolated = true
    }

    return sought
  }, { historical: false, recent: false, extrapolated: false })

  const errors: string[] = []

  if (!blocksSought.historical) errors.push('Page must have a "Historical" toggle block with dates')
  if (!blocksSought.recent) errors.push('Page must have a "Recent" toggle block with dates')
  if (!blocksSought.extrapolated) errors.push('Page must have a "Extrapolated" toggle block with dates')

  return errors
}

function getDateFromBlock (block: Block) {
  const text = (getBlockPlainText(block) || '').trim()
  const date = dayjs(text)

  return date.isValid() ? date : undefined
}

function getHistoricalDates (blocks: NotionBlock[]) {
  return blocks.reduce((memo, block) => {
    // already validated these, so they definitely has string text
    const text = getBlockPlainText(block)!.trim()

    if (!['Historical', 'Recent'].includes(text)) return memo

    const maybeDates = block.children!.map(getDateFromBlock)
    const dates = compact(maybeDates) as dayjs.Dayjs[]

    dates.sort((a, b) => a.valueOf() - b.valueOf())

    return memo.concat(dates)
  }, [] as dayjs.Dayjs[])
}

function getIntervals (dates: dayjs.Dayjs[]) {
  return dates.reduce((memo, date, index) => {
    const nextDate = dates[index + 1]

    if (!nextDate) return memo

    return memo.concat(nextDate.diff(date, 'day'))
  }, [] as number[])
}

function getSum (nums: number[]) {
  return nums.reduce((sum, num) => sum + num, 0)
}

function getAverage (nums: number[]) {
  return Math.round(getSum(nums) / nums.length)
}

function getExtrapolatedDateBlocks (blocks: NotionBlock[]) {
  const block = blocks.find((block) => {
    // already validated this, so it definitely has string text
    return getBlockPlainText(block)!.includes('Extrapolated')
  })

  return block!.children!.filter((child) => {
    return child.type === 'bulleted_list_item'
  }) as NotionBlock[]
}

interface DatesAndBlocks {
  date: dayjs.Dayjs
  block: NotionBlock
}

function getExtrapolatedDates (historicalDates: dayjs.Dayjs[], blocks: NotionBlock[]) {
  const extrapolatedDateBlocks = getExtrapolatedDateBlocks(blocks)
  const intervals = getIntervals(historicalDates)
  const averageInterval = getAverage(intervals)
  const lastHistoricalDate = historicalDates[historicalDates.length - 1]

  return extrapolatedDateBlocks.reduce((memo, block) => {
    const date = memo.lastDate.add(averageInterval, 'days')

    return {
      lastDate: date,
      dates: memo.dates.concat({ date, block }),
    }
  }, { lastDate: lastHistoricalDate, dates: [] as DatesAndBlocks[] }).dates
}

interface UpdateDatesOptions {
  extrapolatedDates: DatesAndBlocks[]
  notionToken: string
}

async function updateDates ({ extrapolatedDates, notionToken }: UpdateDatesOptions) {
  return mapPromisesSerially(extrapolatedDates, ({ date, block }) => {
    const content = {
      type: 'bulleted_list_item' as const,
      content: {
        rich_text: [makeTextPart(date.format('YYYY-MM-DD'))],
      },
    } as OwnBlock

    return updateBlock({ notionToken, block: content, blockId: block.id! })
  })
}

interface UpdateDateExtrapolationOptions {
  notionToken: string
  dateExtrapolationId: string
}

export async function updateDateExtrapolation ({ notionToken, dateExtrapolationId }: UpdateDateExtrapolationOptions) {
  const blocks = await getCategoryBlocks({ notionToken, dateExtrapolationId })
  const errors = validateBlocks(blocks)

  if (errors.length) {
    throw new Error(`The following validation error(s) was/were found:\n- ${errors.join('\n- ')}`)
  }

  const historicalDates = getHistoricalDates(blocks)
  const extrapolatedDates = getExtrapolatedDates(historicalDates, blocks)

  await updateDates({ extrapolatedDates, notionToken })
}

/* v8 ignore next 21 -- @preserve */
export default async function main () {
  const notionToken = getEnv('NOTION_SARAH_TOKEN')!
  const dateExtrapolationId = getEnv('NOTION_DATE_EXTRAPOLATION_ID')!

  debugVerbose('ENV:', {
    notionToken,
    dateExtrapolationId,
  })

  try {
    debug('Updating date extrapolation...')

    await updateDateExtrapolation({ notionToken, dateExtrapolationId })

    debug('Successfully updated date extrapolation')
  } catch (error: any) {
    debug('Updating date extrapolation failed:')
    debug(error?.stack || error)

    throw error
  }
}
