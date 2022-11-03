import dayjs from 'dayjs'
import Debug from 'debug'

import { BlockContent, getBlockChildrenDeep, getBlockPlainText, makeTextPart, updateBlock } from './util'
import { compact, mapPromisesSerially } from '../util/collections'
import { getEnv } from '../util/env'

const debug = Debug('proxy:scripts')

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

function getDateFromBlock (block: BlockContent) {
  const text = (getBlockPlainText(block) || '').trim()
  const date = dayjs(text)

  return date.isValid() ? date : undefined
}

function getHistoricalDates (blocks: BlockContent[]) {
  return blocks.reduce((memo, block) => {
    const text = (getBlockPlainText(block) || '').trim()

    if (!['Historical', 'Recent'].includes(text)) return memo

    const dates = compact(block[block.type].children!.map(getDateFromBlock)) as dayjs.Dayjs[]

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

function getExtrapolatedDateBlocks (blocks: BlockContent[]) {
  const block = blocks.find((block) => {
    const text = getBlockPlainText(block) || ''

    return text.includes('Extrapolated')
  }) as BlockContent

  return block[block.type].children!.filter((b: BlockContent) => {
    return b.type === 'bulleted_list_item'
  })
}

interface DatesAndBlocks {
  date: dayjs.Dayjs
  block: BlockContent
}

function getExtrapolatedDates (historicalDates: dayjs.Dayjs[], blocks: BlockContent[]) {
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
      bulleted_list_item: {
        rich_text: [makeTextPart(date.format('YYYY-MM-DD'))],
        color: 'default' as const,
      },
    }

    return updateBlock({ notionToken, block: content, blockId: block.id! })
  })
}

interface UpdateDateExtrapolationOptions {
  notionToken: string
  dateExtrapolationId: string
}

export async function updateDateExtrapolation ({ notionToken, dateExtrapolationId }: UpdateDateExtrapolationOptions) {
  const blocks = await getCategoryBlocks({ notionToken, dateExtrapolationId })
  const historicalDates = getHistoricalDates(blocks)
  const extrapolatedDates = getExtrapolatedDates(historicalDates, blocks)

  await updateDates({ extrapolatedDates, notionToken })
}

export default async function main () {
  const notionToken = getEnv('NOTION_SARAH_TOKEN')!
  const dateExtrapolationId = getEnv('NOTION_DATE_EXTRAPOLATION_ID')!

  debug('ENV:', {
    notionToken,
    dateExtrapolationId,
  })

  try {
    // eslint-disable-next-line no-console
    console.log('Updating date extrapolation...')

    await updateDateExtrapolation({ notionToken, dateExtrapolationId })

    // eslint-disable-next-line no-console
    console.log('Successfully updated date extrapolation')
  } catch (error: any) {
    // eslint-disable-next-line no-console
    console.log('Updating date extrapolation failed:')
    // eslint-disable-next-line no-console
    console.log(error?.stack || error)
  }
}
