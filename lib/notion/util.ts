import type { Method } from 'axios'
import dayjs from 'dayjs'
import type {
  ApiColor,
  BlockObjectResponse,
  BookmarkBlockObjectResponse,
  BulletedListItemBlockObjectResponse,
  CalloutBlockObjectResponse,
  ChildDatabaseBlockObjectResponse,
  ChildPageBlockObjectResponse,
  ColumnBlockObjectResponse,
  ColumnListBlockObjectResponse,
  DividerBlockObjectResponse,
  EmbedBlockObjectResponse,
  EquationBlockObjectResponse,
  FileBlockObjectResponse,
  Heading1BlockObjectResponse,
  Heading2BlockObjectResponse,
  Heading3BlockObjectResponse,
  ImageBlockObjectResponse,
  LinkPreviewBlockObjectResponse,
  LinkToPageBlockObjectResponse,
  ListBlockChildrenResponse,
  ListDatabasesResponse,
  NumberedListItemBlockObjectResponse,
  ParagraphBlockObjectResponse,
  PdfBlockObjectResponse,
  QuoteBlockObjectResponse,
  RichTextItemResponse,
  SyncedBlockBlockObjectResponse,
  TableBlockObjectResponse,
  TableOfContentsBlockObjectResponse,
  TableRowBlockObjectResponse,
  TemplateBlockObjectResponse,
  ToDoBlockObjectResponse,
  ToggleBlockObjectResponse,
  UnsupportedBlockObjectResponse,
  UpdateBlockBodyParameters,
  VideoBlockObjectResponse,
} from '@notionhq/client/build/src/api-endpoints'

import { clone, compact } from '../util/collections'
import { debug } from '../util/debug'
import { request } from '../util/network'

export const dateRegex = /(?:Sun|Mon|Tue|Wed|Thu|Fri|Sat), (\d{1,2}\/\d{1,2})/

export function getDateFromText (dateText: string) {
  const currentDate = dayjs()
  // originally assume the date's year matches the current year
  const date = dayjs(`${dateText}/${currentDate.year()}`, 'M/D/YYYY')
  // if the current month is after the date's month, we've crossed over years
  // and the date's year should be the next year. usually, it's because it's
  // currently December, but the date's month is January. this can be
  // generically applied, so it will work if it's currently June, but we're
  // trying to get the weather for April. we don't want past weather, only
  // future weather, so assume it's for the following year.
  if (currentDate.month() > date.month()) {
    return date.add(1, 'year')
  }

  return date
}

interface MakeRequestOptions {
  body?: object
  method?: Method
  notionToken: string
  path: string
}

function makeRequest<T> (options: MakeRequestOptions): Promise<T> {
  const { notionToken, body, path, method = 'get' } = options

  return request({
    method,
    body,
    url: `https://api.notion.com/v1/${path}`,
    headers: {
      'Authorization': `Bearer ${notionToken}`,
      'Notion-Version': '2022-06-28',
    },
  })
}

interface GetBlockChildrenOptions {
  notionToken: string
  pageId: string
}

export async function getBlockChildren ({ notionToken, pageId }: GetBlockChildrenOptions) {
  const { results } = await makeRequest<ListBlockChildrenResponse>({ notionToken, path: `blocks/${pageId}/children` }) as { results: BlockObjectResponse[] }

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

type Content = BookmarkBlockObjectResponse['bookmark']
| BulletedListItemBlockObjectResponse['bulleted_list_item']
| CalloutBlockObjectResponse['callout']
| ChildDatabaseBlockObjectResponse['child_database']
| ChildPageBlockObjectResponse['child_page']
| ColumnBlockObjectResponse['column']
| ColumnListBlockObjectResponse['column_list']
| DividerBlockObjectResponse['divider']
| EmbedBlockObjectResponse['embed']
| EquationBlockObjectResponse['equation']
| FileBlockObjectResponse['file']
| Heading1BlockObjectResponse['heading_1']
| Heading2BlockObjectResponse['heading_2']
| Heading3BlockObjectResponse['heading_3']
| ImageBlockObjectResponse['image']
| LinkPreviewBlockObjectResponse['link_preview']
| LinkToPageBlockObjectResponse['link_to_page']
| NumberedListItemBlockObjectResponse['numbered_list_item']
| ParagraphBlockObjectResponse['paragraph']
| PdfBlockObjectResponse['pdf']
| QuoteBlockObjectResponse['quote']
| SyncedBlockBlockObjectResponse['synced_block']
| TableBlockObjectResponse['table']
| TableOfContentsBlockObjectResponse['table_of_contents']
| TableRowBlockObjectResponse['table_row']
| TemplateBlockObjectResponse['template']
| ToDoBlockObjectResponse['to_do']
| ToggleBlockObjectResponse['toggle']
| UnsupportedBlockObjectResponse['unsupported']
| VideoBlockObjectResponse['video']

export interface OwnBlock {
  children?: OwnBlock[] | NotionBlock[]
  type: BlockObjectResponse['type']
  content: Content
}

export interface NotionBlock extends OwnBlock {
  children?: NotionBlock[]
  has_children: boolean
  id: string
}

export type Block = OwnBlock | NotionBlock

function getRichText (block: OwnBlock): RichTextItemResponse[] | undefined {
  return 'rich_text' in block.content ? block.content.rich_text : undefined
}

interface MakeAppendRequestOptions {
  blocks: OutgoingBlock[]
  notionToken: string
  pageId: string
}

export function makeAppendRequest ({ notionToken, pageId, blocks }: MakeAppendRequestOptions) {
  return makeRequest<ListBlockChildrenResponse>({
    notionToken,
    method: 'patch',
    path: `blocks/${pageId}/children`,
    body: {
      children: blocks,
    },
  })
  // don't understand why this fails converage
  /* c8 ignore next */
}

interface AppendBlockChildrenOptions {
  blocks: OwnBlock[]
  notionToken: string
  pageId: string
}

export async function appendBlockChildrenDeep ({ notionToken, pageId, blocks }: AppendBlockChildrenOptions) {
  function moveChildren (blocks: NotionBlock[] | OwnBlock[]) {
    return blocks.map((block) => {
      const convertedBlock = convertBlockToOutgoingBlock(block)

      if (!block.children) return convertedBlock

      // @ts-ignore
      convertedBlock[block.type].children = moveChildren(block.children)

      return convertedBlock
    })
  }

  return makeAppendRequest({ notionToken, pageId, blocks: moveChildren(blocks) })
}

export async function appendBlockChildren ({ notionToken, pageId, blocks }: AppendBlockChildrenOptions) {
  let toAppend: OutgoingBlock[] = []

  for (const block of blocks) {
    const convertedBlock = convertBlockToOutgoingBlock(block)

    if (block.children) {
      const children = block.children

      toAppend.push(convertedBlock)

      const { results } = await makeAppendRequest({ notionToken, pageId, blocks: toAppend })
      toAppend = []

      await appendBlockChildren({
        notionToken,
        pageId: results[results.length - 1].id,
        blocks: children,
      })
    } else {
      toAppend.push(convertedBlock)
    }
  }

  if (toAppend.length) {
    return makeAppendRequest({
      notionToken,
      pageId,
      blocks: toAppend,
    })
  }
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

interface QueryDatabasesOptions {
  notionToken: string
  databaseId: string
}

export function queryDatabases ({ notionToken, databaseId }: QueryDatabasesOptions) {
  return makeRequest<ListDatabasesResponse>({
    notionToken,
    method: 'post',
    path: `databases/${databaseId}/query`,
  })
}

export function convertNotionBlockToOwnBlock (block: BlockObjectResponse): NotionBlock {
  const type = block.type

  return {
    // @ts-ignore
    content: clone(block[type] as Content),
    has_children: block.has_children,
    id: block.id,
    type,
  }
  // don't understand why this fails converage
  /* c8 ignore next */
}

type OutgoingBlock = UpdateBlockBodyParameters & {
  object: string
  type: BlockObjectResponse['type']
}

export function convertBlockToOutgoingBlock (block: Block): OutgoingBlock {
  return {
    object: 'block',
    type: block.type,
    [block.type]: block.content,
  }
  // don't understand why this fails converage
  /* c8 ignore next */
}

interface MakeBlockOptions {
  annotations?: Partial<RichTextItemResponse['annotations']>
  children?: OwnBlock[] | NotionBlock[]
  text: string
  type: BlockObjectResponse['type']
}

export function makeBlock ({ text, type = 'paragraph', annotations, children }: MakeBlockOptions) {
  return {
    type,
    children,
    content: {
      rich_text: [
        {
          type: 'text',
          text: {
            content: text,
          },
          annotations,
          plain_text: text,
        },
      ],
    },
  } as OwnBlock
}

export function richTextToPlainText (richText: RichTextItemResponse[]) {
  return richText
  .map(({ plain_text }) => plain_text)
  .join('')
  .trim()
}

export function getBlockPlainText (block: Block) {
  const richText = getRichText(block)

  if (!richText) return

  return richTextToPlainText(richText)
}

interface RichTextItem {
  text: {
    content: string
    link?: { url: string } | null
  }
  type?: 'text'
  annotations?: {
    bold?: boolean
    italic?: boolean
    strikethrough?: boolean
    underline?: boolean
    code?: boolean
    color?: ApiColor
  }
}

export function makeTextPart (content: string, color?: ApiColor) {
  const textPart = { text: { content } } as RichTextItem

  if (color) {
    textPart.annotations = { color }
  }

  return textPart
}

export function getMonthNameFromIndex (monthIndex: number, short = false) {
  return dayjs().month(monthIndex).format(short ? 'MMM' : 'MMMM')
}

export function getMonths ({ short }: { short?: boolean } = {}) {
  return Array.from(new Array(12)).map((_, i) => {
    return getMonthNameFromIndex(i, short)
  })
}

/* c8 ignore start */
const getDisplayPrefix = (block: NotionBlock) => {
  switch (block.type) {
    case 'paragraph': return ''
    case 'heading_1': return '# '
    case 'heading_2': return '## '
    case 'heading_3': return '### '
    case 'to_do': return `[${'checked' in block.content && block.content.checked ? '✓' : ' '}] `
    case 'bulleted_list_item': return '• '
    case 'numbered_list_item': return '1. '
    case 'toggle': return '> '
    case 'code': return '<> '
    case 'quote': return '| '
    case 'callout': return '" '
    default: return ''
  }
}

function getDisplayText (block: NotionBlock) {
  if (block.type === 'child_page') {
    return `[${'title' in block.content ? block.content.title : '<untitled>'}]`
  }

  if (block.type === 'divider') {
    return '-----'
  }

  if (getRichText(block)) {
    return `${getDisplayPrefix(block)}${getBlockPlainText(block)}`
  }

  return `(${block.type})`
}

// displays block for logging/debugging purposes
export function displayBlocks (blocks: NotionBlock[]) {
  blocks.forEach((block) => {
    debug(`[${block.id}] ${getDisplayText(block)}${block.has_children ? ' (parent)' : ''}`)
  })
}
/* c8 ignore stop */
