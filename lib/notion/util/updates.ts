import type {
  BlockObjectResponse,
  ListBlockChildrenResponse,
  ListDatabasesResponse,
  PartialBlockObjectResponse,
} from '@notionhq/client/build/src/api-endpoints'
import type { Block, NotionBlock, OutgoingBlock, OwnBlock } from '../types'
import { makeRequest } from './requests'
import { convertBlockToOutgoingBlock } from './conversions'
import { areIdsEqual, getBlocksChildrenDepth } from './general'
import { chunk } from '../../util/collections'

interface MakeAppendRequestOptions {
  afterId?: string
  blocks: OutgoingBlock[]
  notionToken: string
  pageId: string
}

export function makeAppendRequest ({ afterId, notionToken, pageId, blocks }: MakeAppendRequestOptions) {
  return makeRequest<ListBlockChildrenResponse>({
    notionToken,
    method: 'patch',
    path: `blocks/${pageId}/children`,
    body: {
      after: afterId,
      children: blocks,
    },
  })
  // don't understand why this fails coverage
  /* c8 ignore next */
}

async function appendContiguousChildren ({ afterId, blocks, notionToken, pageId }: MakeAppendRequestOptions) {
  const chunksOfBlocks = chunk(blocks, 100)
  let allResults = [] as (PartialBlockObjectResponse | BlockObjectResponse)[]
  let currentAfterId = afterId

  for (const chunkOfBlocks of chunksOfBlocks) {
    const { results } = await makeAppendRequest({
      afterId: currentAfterId,
      blocks: chunkOfBlocks,
      notionToken,
      pageId,
    })

    if (afterId) {
      currentAfterId = getAfterId({
        numAdded: chunkOfBlocks.length,
        previousAfterId: currentAfterId,
        results,
      })
    }

    allResults = allResults.concat(results)
  }

  return { results: allResults }
}

interface AppendBlockChildrenOptions {
  afterId?: string
  blocks: OwnBlock[]
  notionToken: string
  pageId: string
}

// appends block children with a limit of 2 levels of nesting
async function appendBlockChildrenWithUpToTwoLevelsOfNesting ({ afterId, notionToken, pageId, blocks }: AppendBlockChildrenOptions) {
  function moveChildren (blocks: NotionBlock[] | OwnBlock[]) {
    return blocks.map((block) => {
      const convertedBlock = convertBlockToOutgoingBlock(block)

      if (!block.children) return convertedBlock

      // @ts-ignore
      convertedBlock[block.type].children = moveChildren(block.children)

      return convertedBlock
    })
  }

  return appendContiguousChildren({
    afterId,
    blocks: moveChildren(blocks),
    notionToken,
    pageId,
  })
}

interface GetAfterIdOptions {
  numAdded: number
  previousAfterId?: string
  results: (BlockObjectResponse | PartialBlockObjectResponse)[]
}

function getAfterId ({ numAdded, previousAfterId, results }: GetAfterIdOptions) {
  if (!previousAfterId) return results[results.length - 1].id

  const previousAfterIndex = results.findIndex((block) => areIdsEqual(block.id, previousAfterId))
  const nextAfter = results[previousAfterIndex + numAdded]

  return nextAfter.id
}

// appends blocks children with no limit to the levels of nesting
async function appendBlockChildrenWithUnlimitedNesting ({ afterId, notionToken, pageId, blocks }: AppendBlockChildrenOptions) {
  let currentAfterId = afterId
  let toAppend: OutgoingBlock[] = []

  for (const block of blocks) {
    const convertedBlock = convertBlockToOutgoingBlock(block)

    if (block.children) {
      const children = block.children

      toAppend.push(convertedBlock)

      const { results } = await appendContiguousChildren({
        afterId: currentAfterId,
        notionToken,
        pageId,
        blocks: toAppend,
      })

      const lastAddedId = getAfterId({
        numAdded: toAppend.length,
        previousAfterId: currentAfterId,
        results,
      })

      if (afterId) {
        currentAfterId = lastAddedId
      }

      toAppend = []

      await appendBlockChildrenWithUnlimitedNesting({
        notionToken,
        pageId: lastAddedId,
        blocks: children,
      })
    } else {
      toAppend.push(convertedBlock)
    }
  }

  if (!toAppend.length) return

  return appendContiguousChildren({
    afterId: currentAfterId,
    notionToken,
    pageId,
    blocks: toAppend,
  })
}

export async function appendBlockChildren (options: AppendBlockChildrenOptions) {
  if (getBlocksChildrenDepth(options.blocks) > 2) {
    return appendBlockChildrenWithUnlimitedNesting(options)
  }

  return appendBlockChildrenWithUpToTwoLevelsOfNesting(options)
}

interface UpdateBlockOptions {
  notionToken: string
  blockId: string
  block: Block
}

export function updateBlock ({ notionToken, blockId, block }: UpdateBlockOptions) {
  const convertedBlock = convertBlockToOutgoingBlock(block)

  return makeRequest<void>({
    notionToken,
    method: 'patch',
    path: `blocks/${blockId}`,
    body: convertedBlock,
  })
}

interface DeleteBlockOptions {
  id: string
  notionToken: string
}

export function deleteBlock ({ id, notionToken }: DeleteBlockOptions) {
  return makeRequest({
    notionToken,
    method: 'delete',
    path: `blocks/${id}`,
  })
}

interface UpdatePageOptions {
  notionToken: string
  pageId: string
  properties: {
    [key: string]: {
      date: {
        start: string
      }
    }
  }
}

export function updatePage ({ notionToken, pageId, properties }: UpdatePageOptions) {
  return makeRequest<void>({
    notionToken,
    body: { properties },
    method: 'patch',
    path: `pages/${pageId}`,
  })
}

interface AddDatabasePageOptions<T> {
  databaseId: string
  notionToken: string
  properties: T
}

export async function addDatabasePage<T> (options: AddDatabasePageOptions<T>): Promise<void> {
  const { databaseId, notionToken, properties } = options

  await makeRequest<ListDatabasesResponse>({
    notionToken,
    method: 'post',
    path: 'pages',
    body: {
      parent: {
        database_id: databaseId,
      },
      properties,
    },
  })
}
