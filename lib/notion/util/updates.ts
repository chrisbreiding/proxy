import type {
  BlockObjectResponse,
  CreatePageResponse,
  ContentPositionSchema,
  ListBlockChildrenResponse,
  PartialBlockObjectResponse,
} from '@notionhq/client'
import type { Block, NotionBlock, OutgoingBlock, OwnBlock } from '../types'
import { makeRequest } from './requests'
import { convertBlockToOutgoingBlock } from './conversions'
import { getBlocksChildrenDepth } from './general'
import { chunk } from '../../util/collections'

interface MakeAppendRequestOptions {
  blocks: OutgoingBlock[]
  notionToken: string
  pageId: string
  position?: ContentPositionSchema
}

export function makeAppendRequest ({ blocks, notionToken, pageId, position }: MakeAppendRequestOptions) {
  return makeRequest<ListBlockChildrenResponse>({
    notionToken,
    method: 'patch',
    path: `blocks/${pageId}/children`,
    body: {
      ...(position && { position }),
      children: blocks,
    },
  })
  // don't understand why this fails coverage
  /* v8 ignore next -- @preserve */
}

async function appendContiguousChildren ({ blocks, notionToken, pageId, position }: MakeAppendRequestOptions) {
  const chunksOfBlocks = chunk(blocks, 100)
  let allResults = [] as (PartialBlockObjectResponse | BlockObjectResponse)[]
  let currentPosition = position

  for (const chunkOfBlocks of chunksOfBlocks) {
    const { results } = await makeAppendRequest({
      blocks: chunkOfBlocks,
      notionToken,
      pageId,
      position: currentPosition,
    })

    if (position) {
      currentPosition = {
        type: 'after_block',
        after_block: { id: results[results.length - 1].id },
      }
    }

    allResults = allResults.concat(results)
  }

  return { results: allResults }
}

export type AppendBlockChildrenPosition = 'start' | 'end' | 'afterBlock'

export interface AppendBlockChildrenOptions {
  afterId?: string
  blocks: OwnBlock[]
  notionToken: string
  pageId: string
  position?: AppendBlockChildrenPosition
}

interface InternalAppendBlockChildrenOptions {
  blocks: OwnBlock[]
  notionToken: string
  pageId: string
  position?: ContentPositionSchema
}

function toBlockChildrenPosition (
  position: AppendBlockChildrenPosition | undefined,
  afterId: string | undefined,
): ContentPositionSchema | undefined {
  if (position === 'start') return { type: 'start' }
  if (position === 'afterBlock' && afterId) return { type: 'after_block', after_block: { id: afterId } }
  return undefined // 'end' or default
}

// appends block children with a limit of 2 levels of nesting
async function appendBlockChildrenWithUpToTwoLevelsOfNesting ({ blocks, notionToken, pageId, position }: InternalAppendBlockChildrenOptions) {
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
    blocks: moveChildren(blocks),
    notionToken,
    pageId,
    position,
  })
}

// appends blocks children with no limit to the levels of nesting
async function appendBlockChildrenWithUnlimitedNesting ({ blocks, notionToken, pageId, position }: InternalAppendBlockChildrenOptions) {
  let currentPosition = position
  let toAppend: OutgoingBlock[] = []

  for (const block of blocks) {
    const convertedBlock = convertBlockToOutgoingBlock(block)

    if (block.children) {
      const children = block.children

      toAppend.push(convertedBlock)

      const { results } = await appendContiguousChildren({
        blocks: toAppend,
        notionToken,
        pageId,
        position: currentPosition,
      })

      const lastAddedId = results[results.length - 1].id
      if (position) {
        currentPosition = { type: 'after_block', after_block: { id: lastAddedId } }
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
    blocks: toAppend,
    notionToken,
    pageId,
    position: currentPosition,
  })
}

export async function appendBlockChildren (options: AppendBlockChildrenOptions) {
  const internalOptions: InternalAppendBlockChildrenOptions = {
    blocks: options.blocks,
    notionToken: options.notionToken,
    pageId: options.pageId,
    position: toBlockChildrenPosition(options.position, options.afterId),
  }
  if (getBlocksChildrenDepth(options.blocks) > 2) {
    return appendBlockChildrenWithUnlimitedNesting(internalOptions)
  }
  return appendBlockChildrenWithUpToTwoLevelsOfNesting(internalOptions)
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

interface AddDataSourcePageOptions<T> {
  dataSourceId: string
  notionToken: string
  properties: T
}

export async function addDataSourcePage<T> (options: AddDataSourcePageOptions<T>): Promise<void> {
  const { dataSourceId, notionToken, properties } = options

  await makeRequest<CreatePageResponse>({
    notionToken,
    method: 'post',
    path: 'pages',
    body: {
      parent: {
        data_source_id: dataSourceId,
      },
      properties,
    },
  })
}
