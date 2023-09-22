import type express from 'express'
import type { ToDoBlockObjectResponse } from '@notionhq/client/build/src/api-endpoints'

import type { Block, NotionBlock } from './types'
import { getBlockPlainText, makeBlock, sendHtml } from './util/general'
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

function errorPart (label: string, value: string) {
  if (!value) return ''

  return `
    <p>${label}</p>
    <pre>${value}</pre>
  `
}

export async function clearCompleted (req: express.Request, res: express.Response) {
  try {
    const { notionToken, pageId } = req.query

    if (!notionToken || typeof notionToken !== 'string') {
      return sendHtml(res, 400, '<p>A value for <em>notionToken</em> must be provided in the query string</p>')
    }
    if (!pageId || typeof pageId !== 'string') {
      return sendHtml(res, 400, '<p>A value for <em>pageId</em> must be provided in the query string</p>')
    }

    await clearPage({ notionToken, pageId })

    sendHtml(res, 200, '<h3>Successfully cleared completed items</h3>')
  } catch (error: any) {
    sendHtml(res, 500, `
      <style>
        body {
          padding: 20px;
        }
        pre {
          background: #f8f8f8;
          border: solid 1px #d7d7d7;
          overflow: auto;
          padding: 10px;
        }
      </style>
      <h3>Clearing completed failed with the following error:</h3>
      ${errorPart('Code', error?.code)}
      ${errorPart('Message', error?.message)}
      ${errorPart('Stack', error?.stack)}
      ${errorPart('Data code', error?.response?.data?.code)}
      ${errorPart('Data status', error?.response?.data?.status)}
      ${errorPart('Data message', error?.response?.data?.message)}
    `)
  }
}