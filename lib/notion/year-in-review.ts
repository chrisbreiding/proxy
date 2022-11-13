import type { ChildPageBlockObjectResponse } from '@notionhq/client/build/src/api-endpoints'
import minimist from 'minimist'

import {
  appendBlockChildrenDeep,
  dateRegex,
  getBlockChildren,
  getBlockPlainText,
  makeBlock,
  NotionBlock,
} from './util'
import { compact } from '../util/collections'
import { debug, debugVerbose } from '../util/debug'
import { getEnv } from '../util/env'
import { patienceDiffPlus } from '../util/patience-diff'

function findId (
  blocks: NotionBlock[],
  filter: (block: NotionBlock) => boolean,
  error?: string,
) {
  const block = blocks.find(filter)

  if (block) {
    return block.id
  }

  if (error) {
    throw new Error(error)
  }
}

interface MonthBlock {
  id: string
  name: string
}

interface MonthDataItem {
  dates: string[],
  quest: string,
}

interface GetPageIdsOptions {
  donePageId: string
  notionToken: string
  year: string | number
}

async function getPageIds ({ donePageId, notionToken, year }: GetPageIdsOptions) {
  const doneBlocks = await getBlockChildren({ notionToken, pageId: donePageId })

  const yearId = findId(doneBlocks, (block) => {
    return (
      block.type === 'child_page'
      && 'title' in block.content
      && block.content.title === `${year}`
    )
  }, `Could not find page for year: ${year}`)!

  const yearBlocks = await getBlockChildren({ notionToken, pageId: yearId })

  const months = compact(yearBlocks.map((block) => {
    if (block.type !== 'child_page') return

    return {
      id: block.id,
      name: (block.content as ChildPageBlockObjectResponse['child_page']).title,
    } as MonthBlock
  }))

  return {
    months,
    yearId,
  }
}

function getSimilarity (string1: string, string2: string) {
  const diff = patienceDiffPlus(string1.split(' '), string2.split(' '))

  return (
    diff.lines.length - diff.lineCountMoved - diff.lineCountDeleted - diff.lineCountInserted
  ) / (diff.lines.length - diff.lineCountMoved)
}

function withoutEmoji (text: string) {
  return text.replace(/([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF])/g, '').trim()
}

const whitespaceRegex = /\W+/g

function normalizeWhitespace (text: string) {
  return text.replace(whitespaceRegex, ' ')
}

interface Match {
  exact: boolean
  addTo: MonthDataItem | MonthDataItem[]
}

const findMatching = (data: MonthDataItem[][], quest: string): Match | undefined => {
  const normalizedQuestName = normalizeWhitespace(quest)
  const questNameWithoutEmoji = withoutEmoji(normalizedQuestName)

  for (const storedQuests of data) {
    let hasSimilarity = false

    for (const storedQuest of storedQuests) {
      const normalizedStoredQuestName = normalizeWhitespace(storedQuest.quest)

      if (normalizedStoredQuestName === normalizedQuestName) {
        return { exact: true, addTo: storedQuest }
      }

      if (getSimilarity(withoutEmoji(normalizedStoredQuestName), questNameWithoutEmoji) > 0.5) {
        hasSimilarity = true
      }
    }

    if (hasSimilarity) {
      return { exact: false, addTo: storedQuests }
    }
  }
}

interface GetMonthDataOptions {
  data: MonthDataItem[][]
  month: MonthBlock
  notionToken: string
}

async function getMonthData ({ data, month, notionToken }: GetMonthDataOptions) {
  const blocks = await getBlockChildren({ notionToken, pageId: month.id })

  let date: string | undefined = undefined

  for (const block of blocks) {
    const text = getBlockPlainText(block)

    if (!text) continue

    const [, dateMatch] = text.match(dateRegex) || []

    if (dateMatch) {
      date = dateMatch

      continue
    }

    // TODO
    if (!date) continue

    const match = findMatching(data, text)

    if (!match) {
      data.push([{
        dates: [date],
        quest: text,
      }])

      continue
    }

    if (match.exact) {
      (match.addTo as MonthDataItem).dates.push(date)
    } else {
      (match.addTo as MonthDataItem[]).push({
        dates: [date],
        quest: text,
      })
    }
  }

  return data
}

const getDates = (quests: MonthDataItem[]) => quests.map((q) => q.dates).flat()

interface GetDataOptions {
  months: MonthBlock[]
  notionToken: string
}

async function getData ({ months, notionToken }: GetDataOptions) {
  let data: (MonthDataItem[][]) = []

  for (const month of months) {
    data = await getMonthData({ data, month, notionToken })
  }

  return data
  .filter((quests) => {
    return getDates(quests).length > 3
  })
  .map((quests) => {
    return quests.sort((a, b) => a.quest.length - b.quest.length)
  })
  .sort((a, b) => getDates(b).length - getDates(a).length)
}

function makeBlocks (data: MonthDataItem[][]) {
  return data.map((quests) => {
    return makeBlock({
      text: `${quests[0].quest} (${getDates(quests).length})`,
      type: 'toggle',
      children: quests.map(({ quest, dates }) => {
        return makeBlock({
          text: `${quest} (${dates.length}) [${dates.join(', ')}]`,
          type: 'bulleted_list_item',
        })
      }),
    })
  })
}

interface YearInReviewOptions {
  donePageId: string
  notionToken: string
  year: number | string
}

export async function yearInReview ({ donePageId, notionToken, year }: YearInReviewOptions) {
  const { months, yearId } = await getPageIds({ donePageId, notionToken, year })
  const data = await getData({ months, notionToken })
  const blocks = makeBlocks(data)

  await appendBlockChildrenDeep({ blocks, notionToken, pageId: yearId })
}

export default async function main () {
  const notionToken = getEnv('NOTION_TOKEN')!
  const donePageId = getEnv('NOTION_DONE_ID')!

  debugVerbose('ENV:', {
    notionToken,
    donePageId,
  })

  try {
    const { year } = minimist(process.argv.slice(2)) as { year?: number | string }

    if (!year) {
      throw new Error('Must specify --year')
    }

    await yearInReview({
      donePageId,
      notionToken,
      year,
    })

    debug('Successfully added Year In Review')

    process.exit(0)
  } catch (error: any) {
    debug('Adding Year In Review failed:')
    debug(error?.stack || error)

    process.exit(1)
  }
}
