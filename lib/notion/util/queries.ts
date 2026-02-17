import type {
  BlockObjectResponse,
  ListBlockChildrenResponse,
  QueryDataSourceBodyParameters,
  QueryDataSourceResponse,
} from '@notionhq/client'

import { compact } from '../../util/collections'
import type { DataSource, NotionBlock } from '../types'
import { convertNotionBlockToOwnBlock } from './conversions'
import { makeRequest } from './requests'

interface GetBlockOptions {
  notionToken: string
  blockId: string
}

export async function getBlock ({ notionToken, blockId }: GetBlockOptions) {
  const block = await makeRequest<BlockObjectResponse>({
    notionToken,
    path: `blocks/${blockId}`,
  })

  return convertNotionBlockToOwnBlock(block)
}

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

interface QueryDataSourcesOptions {
  notionToken: string
  dataSourceId: string
  filter?: QueryDataSourceBodyParameters['filter']
  startCursor?: QueryDataSourceBodyParameters['start_cursor']
}

export function queryDataSources ({ notionToken, dataSourceId, filter, startCursor }: QueryDataSourcesOptions) {
  const body: QueryDataSourceBodyParameters = {}

  if (filter) {
    body.filter = filter
  }

  if (startCursor) {
    body.start_cursor = startCursor
  }

  return makeRequest<QueryDataSourceResponse>({
    notionToken,
    method: 'post',
    path: `data_sources/${dataSourceId}/query`,
    body: (filter || startCursor) ? body : undefined,
  })
}

interface GetDataSourcesOptions {
  dataSourceId: string
  notionToken: string
  results?: DataSource[]
  startCursor?: string
}

export async function getDataSources (options: GetDataSourcesOptions): Promise<DataSource[]> {
  const { dataSourceId, notionToken, startCursor } = options

  const { next_cursor, has_more, results: _results } = await queryDataSources({
    dataSourceId,
    notionToken,
    startCursor,
  })

  const results = _results as DataSource[]

  if (!has_more) {
    return (options.results || []).concat(results)
  }

  return getDataSources({
    dataSourceId,
    notionToken,
    results,
    startCursor: next_cursor!,
  })
}
