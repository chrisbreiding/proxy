import type express from 'express'
import type { ToDoBlockObjectResponse } from '@notionhq/client/build/src/api-endpoints'

import type { Block, NotionBlock, SendError, SendSuccess } from './types'
import { getBlockPlainText, makeBlock } from './util/general'
import { getBlockChildren, getColumnBlocks } from './util/queries'
import { appendBlockChildren, deleteBlock } from './util/updates'

interface Store {
  block: NotionBlock
  items: NotionBlock[]
}

function getStores (blocks: NotionBlock[]) {
  let currentStoreName: string | undefined
  const stores: Record<string, Store> = {}

  for (const block of blocks) {
    if (block.type === 'paragraph') {
      const text = getBlockPlainText(block)

      if (text && text.trim()) {
        currentStoreName = text
        stores[currentStoreName] = {
          block,
          items: [],
        }
      }

      continue
    }

    if (!currentStoreName) continue

    if (
      block.type === 'to_do'
    ) {
      stores[currentStoreName].items.push(block)
    }
  }

  const storesWithBlocksToClear: Record<string, NotionBlock[]> = {}
  const storesToResupply: NotionBlock[] = []

  for (const [storeName, store] of Object.entries(stores)) {
    const blocksToClear = store.items.filter((block) => {
      return (block.content as ToDoBlockObjectResponse['to_do']).checked
    })

    if (!blocksToClear.length) {
      continue
    }

    storesWithBlocksToClear[storeName] = blocksToClear

    if (store.items.length === blocksToClear.length) {
      storesToResupply.push(store.block)
    }
  }

  return {
    storesWithBlocksToClear,
    storesToResupply,
  }
}

interface ClearPageOptions {
  notionToken: string
  pageId: string
}

async function getRelevantPieces ({ notionToken, pageId }: ClearPageOptions) {
  const blocks = await getBlockChildren({ notionToken, pageId })
  let recentlyClearedToggle: NotionBlock | undefined
  let listBlocks: NotionBlock[] | undefined

  for (const block of blocks) {
    if (block.type === 'toggle' && getBlockPlainText(block) === 'Recently Cleared') {
      recentlyClearedToggle = block

      continue
    }

    if (block.type === 'column_list') {
      listBlocks = await getColumnBlocks({ columnListId: block.id, notionToken })
    }
  }

  return {
    listBlocks,
    recentlyClearedToggle,
  }
}

async function getRecentlyClearedDivider ({ notionToken, pageId }: ClearPageOptions) {
  const blocks = await getBlockChildren({ notionToken, pageId })
  let foundFirstDivider = false

  for (const block of blocks) {
    if (block.type === 'divider') {
      if (foundFirstDivider) {
        return block.id
      } else {
        foundFirstDivider = true
      }
    }
  }
  /* c8 ignore next */
}

async function clearPage ({ notionToken, pageId }: ClearPageOptions) {
  const { listBlocks, recentlyClearedToggle } = await getRelevantPieces({ notionToken, pageId })

  if (!listBlocks || !listBlocks.length) return

  const { storesWithBlocksToClear, storesToResupply } = getStores(listBlocks)
  const blocksToAppend: Block[] = []

  for (const [storeName, blocks] of Object.entries(storesWithBlocksToClear)) {
    for (const block of blocks) {
      await deleteBlock({ id: block.id, notionToken })
    }

    const modifiedBlocks = blocks.map((block) => makeBlock({
      content: {
        ...(block.content as ToDoBlockObjectResponse['to_do']),
        checked: false,
      },
      children: block.children,
      type: block.type,
    }))

    blocksToAppend.push(
      makeBlock({ text: storeName, type: 'paragraph' }),
      ...modifiedBlocks,
    )
  }

  for (const block of storesToResupply) {
    await appendBlockChildren({
      afterId: block.id,
      blocks: [makeBlock({ type: 'to_do' })],
      notionToken,
      pageId: block.parentId,
    })
  }

  if (!recentlyClearedToggle || !blocksToAppend.length) return

  const dividerId = await getRecentlyClearedDivider({ notionToken, pageId: recentlyClearedToggle.id })

  await appendBlockChildren({
    afterId: dividerId,
    blocks: blocksToAppend,
    notionToken,
    pageId: recentlyClearedToggle.id,
  })

  return
}

export async function clearCompleted (
  req: express.Request,
  sendSuccess: SendSuccess,
  sendError: SendError,
) {
  try {
    const { notionToken, pageId } = req.query

    if (!notionToken || typeof notionToken !== 'string') {
      return sendError(null, 'A value for <em>notionToken</em> must be provided in the query string', 400)
    }
    if (!pageId || typeof pageId !== 'string') {
      return sendError(null, 'A value for <em>pageId</em> must be provided in the query string', 400)
    }

    await clearPage({ notionToken, pageId })

    sendSuccess('Successfully cleared completed items!')
  } catch (error: any) {
    sendError(error, 'Clearing completed failed with the following error:')
  }
}

interface DeleteClearedOptions {
  notionToken: string
  recentlyClearedId: string
}

async function getBlocksToDelete ({ notionToken, recentlyClearedId }: DeleteClearedOptions) {
  const blocks = await getBlockChildren({ notionToken, pageId: recentlyClearedId })

  return blocks.reduce((memo, block) => {
    if (memo.foundSecondDivider) {
      memo.blocks.push(block)

      return memo
    }

    if (block.type === 'divider') {
      if (memo.foundFirstDivider) {
        memo.foundSecondDivider = true
      } else {
        memo.foundFirstDivider = true
      }
    }

    return memo
  }, {
    foundFirstDivider: false,
    foundSecondDivider: false,
    blocks: [] as NotionBlock[],
  }).blocks
}

async function deleteCleared ({ notionToken, recentlyClearedId }: DeleteClearedOptions) {
  const blocks = await getBlocksToDelete({ notionToken, recentlyClearedId })

  for (const block of blocks) {
    await deleteBlock({ id: block.id, notionToken })
  }
}

export async function deleteRecentlyCleared (
  req: express.Request,
  sendSuccess: SendSuccess,
  sendError: SendError,
) {
  try {
    const { notionToken, recentlyClearedId } = req.query

    if (!notionToken || typeof notionToken !== 'string') {
      return sendError(null, 'A value for <em>notionToken</em> must be provided in the query string', 400)
    }
    if (!recentlyClearedId || typeof recentlyClearedId !== 'string') {
      return sendError(null, 'A value for <em>recentlyClearedId</em> must be provided in the query string', 400)
    }

    await deleteCleared({ notionToken, recentlyClearedId })

    sendSuccess('Successfully deleted recently cleared items!')
  } catch (error: any) {
    sendError(error, 'Deleting recently cleared failed with the following error:')
  }
}
