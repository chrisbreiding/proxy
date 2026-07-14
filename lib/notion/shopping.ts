import type express from 'express'

import { getBlockPlainText, makeBlock } from './util/general'
import { getEnv } from '../util/env'
import type { NotionBlock } from './types'
import { getBlockChildren } from './util/queries'
import { appendBlockChildren, updateBlock } from './util/updates'

const notionToken = getEnv('NOTION_TOKEN')!

type ShoppingType = 'Grocery' | 'Misc'

function normalize (text: string) {
  return text.toLowerCase().replace(/[^a-z0-9]/g, '')
}

function getPageId (type: ShoppingType) {
  return getEnv(type === 'Misc' ? 'NOTION_MISC_ID' : 'NOTION_GROCERIES_ID')!
}

function isNonEmptyParagraph (block: NotionBlock) {
  return block.type === 'paragraph' && !!getBlockPlainText(block)
}

function isEmptyTodo (block: NotionBlock | undefined) {
  return !!block && block.type === 'to_do' && !getBlockPlainText(block)
}

interface Insertion {
  pageId: string
  afterId?: string
  // when set, fill in this existing empty to_do rather than appending a new one
  updateId?: string
}

// a section's items live between its heading paragraph and the next paragraph,
// so insert the new item just before that next paragraph (i.e. at the end of
// the section's items), or at the end of the container if there is no next one.
function insertionAtEndOfSection (blocks: NotionBlock[], pageId: string, sectionIndex: number): Insertion {
  // reuse an empty to_do placeholder sitting directly after the store name
  const nextBlock = blocks[sectionIndex + 1]

  if (isEmptyTodo(nextBlock)) {
    return { pageId, updateId: nextBlock.id }
  }

  const nextParagraphIndex = blocks.findIndex((block, index) => {
    return index > sectionIndex && block.type === 'paragraph'
  })

  // no following paragraph, so append to the end of this container
  if (nextParagraphIndex === -1) {
    return { pageId }
  }

  // insert before the next paragraph, i.e. after the block preceding it
  return {
    pageId,
    afterId: blocks[nextParagraphIndex - 1].id,
  }
}

// find where to insert the item within a matching store's section
function findStoreInsertion (blocks: NotionBlock[], pageId: string, normalizedStore: string): Insertion | undefined {
  const storeIndex = blocks.findIndex((block) => {
    if (block.type !== 'paragraph') return false

    const text = getBlockPlainText(block)

    return !!text && normalize(text) === normalizedStore
  })

  if (storeIndex === -1) return

  return insertionAtEndOfSection(blocks, pageId, storeIndex)
}

interface Column {
  pageId: string
  blocks: NotionBlock[]
}

// the store lists live in `column` blocks inside a `column_list` at the page
// root, so resolve those columns (and their blocks) to search within. if there
// is no column layout, treat the page's root blocks as a single column.
async function getStoreColumns (rootBlocks: NotionBlock[], pageId: string): Promise<Column[]> {
  const columnList = rootBlocks.find((block) => block.type === 'column_list')

  if (!columnList) return [{ pageId, blocks: rootBlocks }]

  const columns = await getBlockChildren({ notionToken, pageId: columnList.id })

  return Promise.all(
    columns
    .filter((column) => column.type === 'column')
    .map(async (column) => ({
      pageId: column.id,
      blocks: await getBlockChildren({ notionToken, pageId: column.id }),
    })),
  )
}

// for "Any", treat the first non-empty paragraph as the section to add to
function findAnyInsertion (blocks: NotionBlock[], pageId: string): Insertion {
  const firstParagraphIndex = blocks.findIndex(isNonEmptyParagraph)

  // no non-empty paragraph, so append to the end of the container
  if (firstParagraphIndex === -1) return { pageId }

  return insertionAtEndOfSection(blocks, pageId, firstParagraphIndex)
}

async function findInsertion (type: ShoppingType | undefined, store: string): Promise<Insertion> {
  // fetch each page's columns at most once
  const columnsCache = new Map<ShoppingType, Column[]>()

  async function getColumns (pageType: ShoppingType) {
    if (!columnsCache.has(pageType)) {
      const pageId = getPageId(pageType)
      const rootBlocks = await getBlockChildren({ notionToken, pageId })

      columnsCache.set(pageType, await getStoreColumns(rootBlocks, pageId))
    }

    return columnsCache.get(pageType)!
  }

  // when the type is specified, only search that page; when it isn't, search
  // both pages so a known store can be found regardless of which page it's on
  const searchTypes: ShoppingType[] = store === 'Any'
    ? []
    : type
      ? [type]
      : ['Grocery', 'Misc']

  const normalizedStore = normalize(store)

  for (const searchType of searchTypes) {
    const columns = await getColumns(searchType)

    for (const column of columns) {
      const insertion = findStoreInsertion(column.blocks, column.pageId, normalizedStore)

      if (insertion) return insertion
    }
  }

  // "Any", or the store wasn't found: fall back to the first store in the first
  // column of the specified page, defaulting to the grocery page
  const fallbackType = type || 'Grocery'
  const [firstColumn] = await getColumns(fallbackType)

  if (firstColumn) {
    return findAnyInsertion(firstColumn.blocks, firstColumn.pageId)
  }

  // no columns at all, so append to the end of the page
  return { pageId: getPageId(fallbackType) }
}

export async function addShoppingItem (req: express.Request, res: express.Response) {
  const item: string | undefined = req.body.item
  const store: string = req.body.store || 'Any'
  const type: ShoppingType | undefined = req.body.type

  if (!item) {
    return res.sendStatus(200)
  }

  const insertion = await findInsertion(type, store)
  const todo = makeBlock({ text: item, type: 'to_do' })

  if (insertion.updateId) {
    await updateBlock({
      notionToken,
      blockId: insertion.updateId,
      block: todo,
    })
  } else {
    await appendBlockChildren({
      afterId: insertion.afterId,
      blocks: [todo],
      notionToken,
      pageId: insertion.pageId,
      ...(insertion.afterId && { position: 'afterBlock' as const }),
    })
  }

  res.sendStatus(200)
}
