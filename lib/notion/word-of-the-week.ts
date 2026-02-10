import type { ToDoBlockObjectResponse } from '@notionhq/client'
import dayjs from 'dayjs'
import type express from 'express'
import Parser from 'rss-parser'

import { compact } from '../util/collections'
import { debug, debugVerbose } from '../util/debug'
import { getEnv } from '../util/env'
import type { SendError, SendSuccess } from './types'
import { makeBlock, makeRichText } from './util/general'
import { getBlockChildren } from './util/queries'
import { appendBlockChildren, deleteBlock, updateBlock } from './util/updates'

const WOTD_FEED_URL = 'https://www.merriam-webster.com/wotd/feed/rss2'

interface WordOfTheDayFeedItem {
  title?: string
  link?: string
  pubDate?: string
  'merriam:shortdef'?: string
}

interface WordOfTheDay {
  title: string
  link: string
  pubDate: dayjs.Dayjs
  shortDef: string
}

function parseItem (item: WordOfTheDayFeedItem): WordOfTheDay {
  return {
    title: item.title || '',
    link: item.link || '',
    pubDate: dayjs(item.pubDate),
    shortDef: item['merriam:shortdef'] || '',
  }
}

export async function getRecentWordsOfTheDay (): Promise<WordOfTheDay[]> {
  debug('Fetching Word of the Day RSS feed...')

  const parser = new Parser<Parser.Output<WordOfTheDayFeedItem>, WordOfTheDayFeedItem>({
    customFields: {
      item: ['merriam:shortdef'],
    },
  })

  const feed = await parser.parseURL(WOTD_FEED_URL)

  return feed.items
  .map(parseItem)
  // sort with newest first
  .sort((a, b) => b.pubDate.diff(a.pubDate))
}

interface UpdateWordOfTheWeekOptions {
  notionToken: string
  wordOfTheWeekHeadingId: string
}

export async function updateWordOfTheWeek ({ notionToken, wordOfTheWeekHeadingId }: UpdateWordOfTheWeekOptions) {
  const wordsOfTheDay = await getRecentWordsOfTheDay()
  const children = await getBlockChildren({ notionToken, pageId: wordOfTheWeekHeadingId })
  const toDoBlocks = children.filter((block): block is typeof children[0] & { type: 'to_do' } => block.type === 'to_do')

  for (const block of toDoBlocks) {
    debugVerbose('Deleting block %s', block.id)
    await deleteBlock({ id: block.id, notionToken })
  }

  const blocks = wordsOfTheDay.map((word) => {
    if (!word.title || !word.shortDef) return undefined

    return makeBlock({
      type: 'to_do',
      content: {
        rich_text: [
          makeRichText(word.title, {
            annotations: { bold: true, color: 'blue' },
            link: word.link ? { url: word.link } : undefined,
          }),
          makeRichText(`: ${word.shortDef}`),
          makeRichText(` (${word.pubDate.format('MMM D')})`, {
            annotations: { italic: true },
          }),
        ],
        checked: false,
      },
    })
  })

  await appendBlockChildren({
    pageId: wordOfTheWeekHeadingId,
    blocks: compact(blocks),
    notionToken,
    position: 'start',
  })
}

interface Details {
  notionToken: string
  headingId: string
  wordId: string
}

async function moveWord ({ notionToken, headingId, wordId }: Details) {
  const children = await getBlockChildren({ notionToken, pageId: headingId })
  const toDoBlocks = children.filter((block): block is typeof children[0] & { type: 'to_do' } => block.type === 'to_do')
  const checked = toDoBlocks.find((block) => (block.content as ToDoBlockObjectResponse['to_do']).checked)

  if (!checked) return

  const richText = (checked.content as ToDoBlockObjectResponse['to_do']).rich_text

  await updateBlock({
    notionToken,
    blockId: wordId,
    block: {
      type: 'bulleted_list_item',
      content: { rich_text: richText },
    },
  })
}

export async function promoteWordOfTheWeek (req: express.Request, sendSuccess: SendSuccess, sendError: SendError) {
  try {
    const { notionToken, headingId, wordId } = req.query

    if (!notionToken || typeof notionToken !== 'string') {
      return sendError(null, 'A value for <em>notionToken</em> must be provided in the query string', 400)
    }
    if (!headingId || typeof headingId !== 'string') {
      return sendError(null, 'A value for <em>headingId</em> must be provided in the query string', 400)
    }
    if (!wordId || typeof wordId !== 'string') {
      return sendError(null, 'A value for <em>wordId</em> must be provided in the query string', 400)
    }

    await moveWord({ notionToken, headingId, wordId })

    sendSuccess('Word of the Week successfully promoted!')
  } catch (error: any) {
    sendError(error, 'Promoting Word of the Week failed with the following error:')
  }
}

/* v8 ignore next 25 -- @preserve */
export default async function main () {
  const notionToken = getEnv('NOTION_TOKEN')!
  const wordOfTheWeekHeadingId = getEnv('WORD_OF_THE_WEEK_HEADING_ID')!

  debugVerbose('ENV:', {
    notionToken,
    wordOfTheWeekHeadingId,
  })

  try {
    debug('Updating Word of the Week...')

    await updateWordOfTheWeek({
      notionToken,
      wordOfTheWeekHeadingId,
    })

    debug('Successfully updated Word of the Week')
  } catch (error: any) {
    debug('Updating Word of the Week failed:')
    debug(error?.stack || error)

    throw error
  }
}
