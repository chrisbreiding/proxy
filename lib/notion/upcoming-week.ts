import dayjs from 'dayjs'
import type express from 'express'

import {
  appendBlockChildren,
  getBlockChildren,
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
const monthsConditionRegex = new RegExp(`( ?if (${monthPattern}(?:(?:, )${monthPattern})*))`)
const variableRegex = /\${(\w+)}/

interface GetVariablesOptions {
  blocks: NotionBlock[]
  notionToken: string
}

async function getVariables ({ blocks, notionToken }: GetVariablesOptions) {
  const variablesBlock = blocks.find((block) => {
    return block.type === 'toggle' && getBlockPlainText(block) === 'Variables'
  })

  if (!variablesBlock) return {}

  const variableBlocks = await getBlockChildren({ notionToken, pageId: variablesBlock.id })

  return variableBlocks.reduce((memo, block) => {
    const text = getBlockPlainText(block)

    if (!text) return memo

    const [name, ...values] = text.split(': ')

    return {
      ...memo,
      [name]: values.join(': '),
    }
  }, {} as { [key: string]: string })
}

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
  currentDate?: dayjs.Dayjs
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

  if (!condition || !currentDate) return { text }

  const months = monthsString.split(', ')
  const currentMonth = currentDate.format('MMM')

  if (!months.includes(currentMonth)) return {}

  return { text: text.replace(condition, '') }
}

interface GetDayBlocksOptions {
  notionToken: string
  weekTemplatePageId: string
  startDate: string
}

interface BlocksMemo {
  blocks: OwnBlock[]
  currentDate?: dayjs.Dayjs
  finished: boolean
}

async function getDayBlocks ({ notionToken, weekTemplatePageId, startDate }: GetDayBlocksOptions) {
  const blocks = await getBlockChildrenDeep({ notionToken, pageId: weekTemplatePageId })
  const variables = await getVariables({ blocks, notionToken })
  const dates = getDates(startDate)

  return {
    dates,
    blocks: blocks.reduce((memo, block) => {
      if (memo.finished) return memo

      const textResult = getText({ block, dates, currentDate: memo.currentDate })
      const date = textResult.date
      let text = textResult.text

      if (date) {
        memo.currentDate = date
      }

      if (block.type === 'heading_3' && text === 'Extras') {
        memo.finished = true

        return memo
      }

      if (text) {
        const [, variableName] = text.match(variableRegex) || []
        const variableValue = variables[variableName]

        if (variableName && variableValue) {
          text = text.replace(`\${${variableName}}`, variableValue)
        }

        memo.blocks.push(makeBlock({
          text,
          type: block.type,
          children: block.children,
        }))
      }

      return memo
    }, { blocks: [], finished: false } as BlocksMemo).blocks,
  }
}

interface Query {
  addFollowingWeekButtonId: string
  notionToken: string
  startDate: string
  upcomingId: string
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
    `addFollowingWeekButtonId=${query.addFollowingWeekButtonId}`,
    `notionToken=${query.notionToken}`,
    `startDate=${dates.nextDate}`,
    `upcomingId=${query.upcomingId}`,
    `weekTemplatePageId=${query.weekTemplatePageId}`,
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

interface GetLastUpcomingBlockIdOptions {
  addFollowingWeekButtonId: string
  notionToken: string
  upcomingId: string
}

async function getLastUpcomingBlockId ({ addFollowingWeekButtonId, notionToken, upcomingId }: GetLastUpcomingBlockIdOptions) {
  const blocks = await getBlockChildren({ notionToken, pageId: upcomingId })

  const addFollowingWeekButtonIndex = blocks.findIndex((block) => {
    return block.id === addFollowingWeekButtonId
  })

  if (addFollowingWeekButtonIndex === -1) return

  return blocks[addFollowingWeekButtonIndex - 1].id
}

async function addFollowingWeekAndUpdateButton ({ query, params }: { query: Query, params: Params }) {
  const { addFollowingWeekButtonId, weekTemplatePageId, notionToken, startDate, upcomingId } = query
  const { blocks, dates } = await getDayBlocks({ notionToken, weekTemplatePageId, startDate })
  const afterId = await getLastUpcomingBlockId({ addFollowingWeekButtonId, notionToken, upcomingId })

  await appendBlockChildren({ afterId, notionToken, blocks, pageId: upcomingId })
  await updateAddFollowingWeekButton({ query, params, dates })
}

export async function addUpcomingWeek (req: express.Request, res: express.Response) {
  const { query, params } = req

  try {
    [
      'addFollowingWeekButtonId',
      'notionToken',
      'startDate',
      'upcomingId',
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
        notionToken: query.notionToken as string,
        startDate: query.startDate as string,
        upcomingId: query.upcomingId as string,
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
    res.status(500).json({ error: error.message })
  }
}

export async function upcomingWeekView (req: express.Request, res: express.Response) {
  res.set('Content-Type', 'text/html')
  res.render('upcoming-week', { layout: false })
}
