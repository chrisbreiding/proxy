import type {
  BlockObjectResponse,
  DatabaseObjectResponse,
  ListBlockChildrenResponse,
  ListDatabasesResponse,
  QueryDatabaseBodyParameters,
} from '@notionhq/client/build/src/api-endpoints'

import { convertNotionBlockToOwnBlock } from './conversions'
import { makeRequest } from './requests'
import type { NotionBlock } from '../types'
import { compact } from '../../util/collections'

interface GetBlockChildrenOptions {
  notionToken: string
  pageId: string
}

export async function getBlockChildren ({ notionToken, pageId }: GetBlockChildrenOptions) {
  const { results } = await makeRequest<ListBlockChildrenResponse>({
    notionToken,
    path: `blocks/${pageId}/children`,
  }) as { results: BlockObjectResponse[] }

  return results.map(convertNotionBlockToOwnBlock)
}

interface GetBlockChildrenDeepOptions {
  filter?: (block: NotionBlock) => boolean
  includeId?: boolean
  notionToken: string
  pageId: string
}

export async function getBlockChildrenDeep ({ notionToken, pageId, filter, includeId }: GetBlockChildrenDeepOptions): Promise<NotionBlock[]> {
  const blocks = await getBlockChildren({ notionToken, pageId })
  const filteredBlocks = filter ? blocks.filter(filter) : blocks
  const blocksWithChildren = await Promise.all(filteredBlocks.map(async (block) => {
    if (block.has_children && block.type !== 'child_page') {
      block.children = await getBlockChildrenDeep({ notionToken, pageId: block.id, includeId })
    }

    return block
  }))

  return compact(blocksWithChildren)
}

interface GetColumnBlocksOptions {
  columnListId: string
  notionToken: string
}

export async function getColumnBlocks ({ columnListId, notionToken }: GetColumnBlocksOptions) {
  const columns = await getBlockChildren({ notionToken, pageId: columnListId })
  const columnsBlocks = await Promise.all(columns.map(async (column) => {
    return getBlockChildrenDeep({ notionToken, pageId: column.id })
  }))

  return columnsBlocks.flat()
}

interface QueryDatabasesOptions {
  notionToken: string
  databaseId: string
  filter?: QueryDatabaseBodyParameters['filter']
  startCursor?: QueryDatabaseBodyParameters['start_cursor']
}

export function queryDatabases ({ notionToken, databaseId, filter, startCursor }: QueryDatabasesOptions) {
  const body: QueryDatabaseBodyParameters = {}

  if (filter) {
    body.filter = filter
  }

  if (startCursor) {
    body.start_cursor = startCursor
  }

  return makeRequest<ListDatabasesResponse>({
    notionToken,
    method: 'post',
    path: `databases/${databaseId}/query`,
    body: (filter || startCursor) ? body : undefined,
  })
}

interface GetDatabasePagesOptions {
  databaseId: string
  notionToken: string
  results?: DatabaseObjectResponse[]
  startCursor?: string
}

export async function getDatabasePages (options: GetDatabasePagesOptions): Promise<DatabaseObjectResponse[]> {
  const { databaseId, notionToken, startCursor } = options

  const { next_cursor, has_more, results } = await queryDatabases({
    databaseId,
    notionToken,
    startCursor,
  })

  if (!has_more) {
    return (options.results || []).concat(results as DatabaseObjectResponse[])
  }

  return getDatabasePages({
    databaseId,
    notionToken,
    results: results as DatabaseObjectResponse[],
    startCursor: next_cursor!,
  })
}
