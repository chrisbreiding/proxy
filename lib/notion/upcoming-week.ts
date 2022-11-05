import dayjs from 'dayjs'
import type express from 'express'

import {
  appendBlockChildren,
  getBlockChildrenDeep,
  getBlockPlainText,
  getMonths,
  makeBlock,
  NotionBlock,
  OwnBlock,
  updateBlock,
} from './util'

const daysOfWeek = 'Sun|Mon|Tue|Wed|Thu|Fri|Sat'.split('|')
const daysOfWeekRegex = /(Sun|Mon|Tue|Wed|Thu|Fri|Sat),/
const monthPattern = `(?:${getMonths({ short: true }).join('|')})`
const monthsConditionRegex = new RegExp(`( if (${monthPattern}(?:(?:, )${monthPattern})*))`)

type DatesObject = { [key: string]: dayjs.Dayjs }

interface DatesTracker {
  dates: DatesObject
  nextDate: string
}

function getDates (startDate: string): DatesTracker {
  const { nextDate, dates } = daysOfWeek.reduce((memo, day) => {
    memo.dates[day] = memo.nextDate
    memo.nextDate = memo.nextDate.add(1, 'day')

    return memo
  }, { nextDate: dayjs(startDate), dates: {} as DatesObject })

  return {
    dates,
    nextDate: nextDate.toISOString(),
  }
}

interface GetTextOptions {
  block: NotionBlock
  dates: DatesTracker
  currentDate: string
}

interface TextDate {
  text?: string
  date?: dayjs.Dayjs
}

function getText ({ block, dates, currentDate }: GetTextOptions): TextDate {
  const text = getBlockPlainText(block)

  if (!text) return {}

  const [, day] = text.match(daysOfWeekRegex) || []

  if (day) {
    const date = dates.dates[day]
    const text = `${day}, ${date.month() + 1}/${date.date()}`

    return { date, text }
  }

  const [, condition, monthsString] = text.match(monthsConditionRegex) || []

  if (!condition) return { text }

  const months = monthsString.split(', ')
  const currentMonth = dayjs(currentDate).format('MMM')

  if (!months.includes(currentMonth)) return {}

  return { text: text.replace(condition, '') }
}

interface GetDayBlocksOptions {
  notionToken: string
  weekTemplatePageId: string
  startDate: string
}

interface BlocksMemo {
  currentDate?: dayjs.Dayjs
  blocks: OwnBlock[]
}

async function getDayBlocks ({ notionToken, weekTemplatePageId, startDate }: GetDayBlocksOptions) {
  const blocks = await getBlockChildrenDeep({ notionToken, pageId: weekTemplatePageId })
  const dates = getDates(startDate)

  let currentDate: string

  return {
    dates,
    blocks: blocks.reduce((memo, block) => {
      const { text, date } = getText({ block, dates, currentDate })

      if (date) {
        memo.currentDate = date
      }

      if (text) {
        memo.blocks.push(makeBlock({
          text,
          type: block.type,
          children: block.children,
        }))
      }

      return memo
    }, { blocks: [] } as BlocksMemo).blocks,
  }
}

interface Query {
  addFollowingWeekButtonId: string
  appendToId: string
  notionToken: string
  startDate: string
  weekTemplatePageId: string
}

interface Params {
  key: string
}

interface UpdateAddFollowingWeekButtonOptions {
  query: Query
  params: Params
  dates: DatesTracker
}

function updateAddFollowingWeekButton ({ query, params, dates }: UpdateAddFollowingWeekButtonOptions) {
  const { notionToken } = query
  const urlQuery = [
    `weekTemplatePageId=${query.weekTemplatePageId}`,
    `appendToId=${query.appendToId}`,
    `addFollowingWeekButtonId=${query.addFollowingWeekButtonId}`,
    `notionToken=${query.notionToken}`,
    `startDate=${dates.nextDate}`,
  ].join('&')
  const url = `https://proxy.crbapps.com/notion/upcoming-week/${params.key}?${urlQuery}`
  const block = {
    type: 'embed' as const,
    content: {
      url,
      caption: [],
    },
  }

  return updateBlock({ notionToken, block, blockId: query.addFollowingWeekButtonId })
}

async function addFollowingWeekAndUpdateButton ({ query, params }: { query: Query, params: Params }) {
  const { weekTemplatePageId, notionToken, startDate, appendToId } = query
  const { blocks, dates } = await getDayBlocks({ notionToken, weekTemplatePageId, startDate })

  await appendBlockChildren({ notionToken, blocks, pageId: appendToId })
  await updateAddFollowingWeekButton({ query, params, dates })
}

export async function addUpcomingWeek (req: express.Request, res: express.Response) {
  const { query, params } = req

  try {
    [
      'addFollowingWeekButtonId',
      'appendToId',
      'notionToken',
      'startDate',
      'weekTemplatePageId',
    ].forEach((name) => {
      const value = req.query[name]

      if (!value || typeof value !== 'string') {
        throw new Error(`A value for '${name}' must be provided in the query string`)
      }
    })

    await addFollowingWeekAndUpdateButton({
      query: {
        addFollowingWeekButtonId: query.addFollowingWeekButtonId as string,
        appendToId: query.appendToId as string,
        notionToken: query.notionToken as string,
        startDate: query.startDate as string,
        weekTemplatePageId: query.weekTemplatePageId as string,
      },
      params: {
        key: params.key,
      },
    })

    res.set('Content-Type', 'text/html')
    res.send(
      `<!DOCTYPE html>
      <html>
        <body>
          <h2 style="margin: 20px;">Following week successfully added!<h2>
        </body>
      </html>`,
    )
  } catch (error: any) {
    res.status(500).json({
      name: error.name,
      message: error.message,
      stack: error.stack,
    })
  }
}

export async function upcomingWeekView (req: express.Request, res: express.Response) {
  res.set('Content-Type', 'text/html')
  res.render('upcoming-week', { layout: false })
}
