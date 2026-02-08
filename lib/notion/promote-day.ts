import type express from 'express'

import { getBlockPlainText } from './util/general'
import type { NotionBlock, SendError, SendSuccess } from './types'
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

    /* v8 ignore next -- @preserve -- ignores the implicit else */
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
    ...(afterId && { position: 'afterBlock' as const }),
  })

  for (const { id } of blocks) {
    await deleteBlock({ id, notionToken })
  }
}

export async function promoteDay (
  req: express.Request,
  sendSuccess: SendSuccess,
  sendError: SendError,
) {
  try {
    const { notionToken, upcomingId, questsId } = req.query

    if (!notionToken || typeof notionToken !== 'string') {
      return sendError(null, 'A value for <em>notionToken</em> must be provided in the query string', 400)
    }
    if (!upcomingId || typeof upcomingId !== 'string') {
      return sendError(null, 'A value for <em>upcomingId</em> must be provided in the query string', 400)
    }
    if (!questsId || typeof questsId !== 'string') {
      return sendError(null, 'A value for <em>questsId</em> must be provided in the query string', 400)
    }

    await moveNextDayUp({ notionToken, questsId, upcomingId })

    sendSuccess('Day successfully promoted!')
  } catch (error: any) {
    sendError(error, 'Promoting day failed with the following error:')
  }
}
