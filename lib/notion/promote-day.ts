import type express from 'express'

import { getBlockPlainText, sendHtml, sendHtmlError } from './util/general'
import type { NotionBlock } from './types'
import { getBlockChildren, getBlockChildrenDeep } from './util/queries'
import { appendBlockChildren, deleteBlock } from './util/updates'

const daysOfWeekRegex = /(Sun|Mon|Tue|Wed|Thu|Fri|Sat),/

interface PageDetails {
  notionToken: string
  pageId: string
}

async function getAfterId ({ notionToken, pageId }: PageDetails) {
  const questBlocks = await getBlockChildren({ notionToken, pageId })

  // get the id of the block before the first divider found
  return questBlocks.reduce((memo, block) => {
    if (memo.id) return memo

    if (block.type === 'divider') {
      memo.id = memo.lastId
    }

    memo.lastId = block.id

    return memo
  }, {} as { id?: string, lastId?: string }).id
}

async function getBlocksToPromote ({ notionToken, pageId }: PageDetails) {
  const upcomingBlocks = await getBlockChildrenDeep({ notionToken, pageId })
  const startingMemo = {
    blocks: [] as NotionBlock[],
    finished: false,
    foundDate: false,
  }

  return upcomingBlocks.reduce((memo, block) => {
    if (memo.finished) return memo

    const text = getBlockPlainText(block)
    const isDate = daysOfWeekRegex.test(text || '')

    if (isDate && memo.foundDate) {
      memo.finished = true

      return memo
    }

    if (isDate) {
      memo.foundDate = true
    }

    if (memo.foundDate) {
      memo.blocks.push(block)
    }

    return memo
  }, startingMemo).blocks
}

interface Details {
  notionToken: string
  questsId: string
  upcomingId: string
}

async function moveNextDayUp ({ notionToken, questsId, upcomingId }: Details) {
  const afterId = await getAfterId({ notionToken, pageId: questsId })
  const blocks = await getBlocksToPromote({ notionToken, pageId: upcomingId })

  await appendBlockChildren({
    afterId,
    blocks,
    notionToken,
    pageId: questsId,
  })

  for (const { id } of blocks) {
    await deleteBlock({ id, notionToken })
  }
}

export async function promoteDay (req: express.Request, res: express.Response) {
  const { query } = req

  try {
    [
      'notionToken',
      'upcomingId',
      'questsId',
    ].forEach((name) => {
      const value = req.query[name]

      if (!value || typeof value !== 'string') {
        throw new Error(`A value for '${name}' must be provided in the query string`)
      }
    })

    await moveNextDayUp({
      notionToken: query.notionToken as string,
      questsId: query.questsId as string,
      upcomingId: query.upcomingId as string,
    })

    sendHtml(res, 200,
      `<!DOCTYPE html>
      <html>
        <body>
          <h2 style="margin: 20px;">Day successfully promoted!<h2>
        </body>
      </html>`,
    )
  } catch (error: any) {
    sendHtmlError({
      error,
      message: 'Promoting day failed with the following error:',
      res,
      statusCode: 500,
    })
  }
}
