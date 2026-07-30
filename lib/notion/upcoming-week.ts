import type dayjs from 'dayjs'
import type express from 'express'
import type { RichTextItemResponse } from '@notionhq/client'

import { getBlockPlainText, getRichText, isChildPageWithTitle, makeBlock, makeRichText } from './util/general'
import { getDateFromText, getMonths } from '../util/dates'
import type { Content, NotionBlock, OwnBlock, SendError, SendSuccess } from './types'
import { richTextToPlainText } from './util/conversions'
import { getBlockChildren, getBlockChildrenDeep } from './util/queries'
import { appendBlockChildren, deleteBlock } from './util/updates'

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

function makeDateString (date: dayjs.Dayjs) {
  return date.format('YYYY-MM-DD')
}

function findMatchingDay (dayString: string, minimumDate: dayjs.Dayjs): dayjs.Dayjs {
  if (dayString.includes(minimumDate.format('ddd'))) {
    return minimumDate
  }

  return findMatchingDay(dayString, minimumDate.add(1, 'day'))
}

interface GetTextOptions {
  block: NotionBlock
  currentDate?: dayjs.Dayjs
  minimumDate: dayjs.Dayjs
}

interface TextDate {
  richText?: RichTextItemResponse[]
  date?: dayjs.Dayjs
}

// replace the first occurrence of `search` within the rich text, preserving
// the links, annotations, and other attributes of the surrounding text, and
// dropping any text piece that becomes empty as a result of the replacement
function editRichText (richText: RichTextItemResponse[], search: string, replacement: string) {
  let replaced = false

  return richText
  .map((piece) => {
    if (replaced || piece.type !== 'text' || !piece.plain_text.includes(search)) {
      return piece
    }

    replaced = true
    const content = piece.text.content.replace(search, replacement)

    return {
      ...piece,
      text: { ...piece.text, content },
      plain_text: content,
    }
  })
  .filter((piece) => piece.type !== 'text' || piece.plain_text !== '')
}

function getText ({ block, currentDate, minimumDate }: GetTextOptions): TextDate {
  const richText = getRichText(block)

  if (!richText) return {}

  const text = richTextToPlainText(richText)

  if (!text) return {}

  const [, day] = text.match(daysOfWeekRegex) || []

  if (day) {
    const date = findMatchingDay(day, minimumDate)
    const dateText = `${day}, ${date.month() + 1}/${date.date()}`

    return { date, richText: [makeRichText(dateText)] }
  }

  const [, condition, monthsString] = text.match(monthsConditionRegex) || []

  if (!condition || !currentDate) return { richText }

  const months = monthsString.split(', ')
  const currentMonth = currentDate.format('MMM')

  if (!months.includes(currentMonth)) return {}

  return { richText: editRichText(richText, condition, '') }
}

interface ExtrasMemo {
  currentDate?: dayjs.Dayjs
  extras: { [key: string]: { id: string, block?: OwnBlock }[] }
  lastDate?: dayjs.Dayjs
  lastQuestId?: string
  numDividersFound: number
  weekTemplateId?: string
}

function getRelevantPieces (upcomingBlocks: NotionBlock[]) {
  const extrasMemo = {
    extras: {},
    numDividersFound: 0,
  } as ExtrasMemo

  const {
    extras,
    lastDate,
    lastQuestId,
    weekTemplateId,
  } = upcomingBlocks.reduce((memo, block) => {
    if (block.type === 'divider') {
      memo.numDividersFound++

      return memo
    }

    // get the date last found until the first divider
    if (memo.numDividersFound === 0) {
      const text = getBlockPlainText(block)

      if (!text) return memo

      const { date } = getDateFromText(text)

      if (date) {
        memo.lastDate = date
      } else {
        memo.lastQuestId = block.id
      }
    }

    if (memo.numDividersFound !== 2) {
      if (isChildPageWithTitle(block, (title) => title.includes('Week Template'))) {
        memo.weekTemplateId = block.id

        return memo
      }

      return memo
    }

    // extras exist between the 2nd and 3rd dividers
    const text = getBlockPlainText(block)

    if (!text) return memo

    const { date } = getDateFromText(text)

    if (date) {
      memo.currentDate = date
      memo.extras[makeDateString(date)] = [{
        id: block.id,
      }]

      return memo
    }

    // ignore if we haven't hit a date yet
    if (!memo.currentDate) return memo

    memo.extras[makeDateString(memo.currentDate)]!.push({
      id: block.id,
      block: makeBlock({
        text,
        type: block.type,
        children: block.children,
      }),
    })

    return memo
  }, extrasMemo)

  if (!lastDate) {
    throw new Error('Could not find a date to put the upcoming week after. There should be at least one date present in the first part of Upcoming.')
  }

  if (!weekTemplateId) {
    throw new Error('Could not find the Week Template. It should be a page after the third divider.')
  }

  return {
    extras,
    lastQuestId,
    startDate: lastDate.add(1, 'day'),
    weekTemplateId,
  }
}

interface GetDayBlocksOptions {
  notionToken: string
  upcomingBlocks: NotionBlock[]
}

interface BlocksMemo {
  blocks: OwnBlock[]
  currentDate?: dayjs.Dayjs
  finished: boolean
  idsOfExtrasUsed: string[]
}

async function getDayBlocks ({ notionToken, upcomingBlocks }: GetDayBlocksOptions) {
  const { extras, lastQuestId, startDate, weekTemplateId } = getRelevantPieces(upcomingBlocks)
  const weekTemplateBlocks = await getBlockChildrenDeep({ notionToken, pageId: weekTemplateId })
  const variables = await getVariables({ blocks: weekTemplateBlocks, notionToken })
  const startingMemo = {
    blocks: [],
    idsOfExtrasUsed: [],
    finished: false,
  } as BlocksMemo

  function flushExtrasFor (memo: BlocksMemo, date: dayjs.Dayjs) {
    const dateString = makeDateString(date)

    if (extras[dateString]?.length) {
      extras[dateString].forEach(({ id, block }) => {
        if (block) {
          memo.blocks.push(block)
        }
        memo.idsOfExtrasUsed.push(id)
      })
    }
  }

  const resultMemo = weekTemplateBlocks.reduce((memo, block) => {
    if (memo.finished) return memo

    if (block.type === 'divider') {
      memo.finished = true

      // this is the end of the template, so the last date's items are done
      // and any extras for it should be added to the end of the list
      if (memo.currentDate) {
        flushExtrasFor(memo, memo.currentDate)
      }

      return memo
    }

    const textResult = getText({
      block,
      currentDate: memo.currentDate,
      minimumDate: memo.currentDate || startDate,
    })
    const date = textResult.date
    let richText = textResult.richText

    // if there's a date established and we're about to change dates, meaning
    // we're at the end of items for the date, check for extras and add them
    // to the end of the list
    if (memo.currentDate && date) {
      flushExtrasFor(memo, memo.currentDate)
    }

    if (date) {
      memo.currentDate = date
    }

    if (!memo.currentDate) return memo

    if (richText && richText.length) {
      const [, variableName] = richTextToPlainText(richText).match(variableRegex) || []
      const variableValue = variables[variableName]

      if (variableName && variableValue) {
        richText = editRichText(richText, `\${${variableName}}`, variableValue)
      }

      // preserve the original block's content (links, annotations, color, etc.),
      // swapping in the transformed rich text
      memo.blocks.push(makeBlock({
        content: { ...block.content, rich_text: richText } as Content,
        type: block.type,
        children: block.children,
      }))
    }

    return memo
  }, startingMemo)

  // if the template ended without a trailing divider, the last date's
  // extras were never flushed above, so flush them now
  if (!resultMemo.finished && resultMemo.currentDate) {
    flushExtrasFor(resultMemo, resultMemo.currentDate)
  }

  return {
    blocks: resultMemo.blocks,
    idsOfExtrasUsed: resultMemo.idsOfExtrasUsed,
    lastQuestId,
  }
}

interface Details {
  notionToken: string
  upcomingId: string
}

interface DeleteExtrasUsedOptions {
  idsOfExtrasUsed: string[]
  notionToken: string
}

async function deleteExtrasUsed ({ idsOfExtrasUsed, notionToken }: DeleteExtrasUsedOptions) {
  for (const id of idsOfExtrasUsed) {
    await deleteBlock({ id, notionToken })
  }
}

async function addFollowingWeek ({ notionToken, upcomingId }: Details) {
  const upcomingBlocks = await getBlockChildrenDeep({ notionToken, pageId: upcomingId })
  const { blocks, idsOfExtrasUsed, lastQuestId } = await getDayBlocks({ notionToken, upcomingBlocks })

  await appendBlockChildren({
    ...(lastQuestId && { afterId: lastQuestId, position: 'afterBlock' as const }),
    blocks,
    notionToken,
    pageId: upcomingId,
  })
  await deleteExtrasUsed({ idsOfExtrasUsed, notionToken })
}

export async function addUpcomingWeek (
  req: express.Request,
  sendSuccess: SendSuccess,
  sendError: SendError,
) {
  try {
    const { notionToken, upcomingId } = req.query

    if (!notionToken || typeof notionToken !== 'string') {
      return sendError(null, 'A value for <em>notionToken</em> must be provided in the query string', 400)
    }
    if (!upcomingId || typeof upcomingId !== 'string') {
      return sendError(null, 'A value for <em>upcomingId</em> must be provided in the query string', 400)
    }

    await addFollowingWeek({ notionToken, upcomingId })

    sendSuccess('Following week successfully added!')
  } catch (error: any) {
    sendError(error, 'Adding upcoming week failed with the following error:')
  }
}
