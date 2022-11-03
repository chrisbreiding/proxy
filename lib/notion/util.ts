import type { Method } from 'axios'
import dayjs from 'dayjs'
import type {
  BlockObjectResponse,
  ListBlockChildrenResponse,
  ParagraphBlockObjectResponse,
  RichTextItemResponse,
  Heading2BlockObjectResponse,
  Heading1BlockObjectResponse,
  Heading3BlockObjectResponse,
  BulletedListItemBlockObjectResponse,
  NumberedListItemBlockObjectResponse,
  ToDoBlockObjectResponse,
  ToggleBlockObjectResponse,
  ChildPageBlockObjectResponse,
  ChildDatabaseBlockObjectResponse,
  EmbedBlockObjectResponse,
  ImageBlockObjectResponse,
  VideoBlockObjectResponse,
  FileBlockObjectResponse,
  PdfBlockObjectResponse,
  BookmarkBlockObjectResponse,
  CalloutBlockObjectResponse,
  QuoteBlockObjectResponse,
  EquationBlockObjectResponse,
  DividerBlockObjectResponse,
  TableOfContentsBlockObjectResponse,
  ColumnListBlockObjectResponse,
  ColumnBlockObjectResponse,
  LinkPreviewBlockObjectResponse,
  SyncedBlockBlockObjectResponse,
  TemplateBlockObjectResponse,
  LinkToPageBlockObjectResponse,
  TableBlockObjectResponse,
  TableRowBlockObjectResponse,
  UnsupportedBlockObjectResponse,
  ApiColor,
  TextRichTextItemResponse,
} from '@notionhq/client/build/src/api-endpoints'

import { request } from '../util/network'
import { compact } from '../util/collections'

export const dateRegex = /(?:Sun|Mon|Tue|Wed|Thu|Fri|Sat), (\d{1,2}\/\d{1,2})/

export function getDateFromText (dateText: string) {
  const currentDate = dayjs()
  // originally assume the date's year matches the current year
  const date = dayjs(`${dateText}/${dayjs().year()}`, 'M/D/YYYY')
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

export function makeRequest<T> (options: MakeRequestOptions): Promise<T> {
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

export function getBlockChildren ({ notionToken, pageId }: GetBlockChildrenOptions) {
  return makeRequest<ListBlockChildrenResponse>({ notionToken, path: `blocks/${pageId}/children` })
}

interface GetBlockChildrenDeepOptions {
  filter?: (block: BlockObjectResponse) => boolean
  includeId?: boolean
  notionToken: string
  pageId: string
}

export async function getBlockChildrenDeep ({ notionToken, pageId, filter, includeId }: GetBlockChildrenDeepOptions): Promise<BlockContent[]> {
  const { results } = await getBlockChildren({ notionToken, pageId })

  const blocks = await Promise.all(results.map((block: BlockObjectResponse) => {
    return getBlockContent({
      notionToken,
      block: block as BlockObjectResponse,
      filter,
      includeId,
    })
  }))

  return compact(blocks)
}

export type BlockContent = Partial<BlockObjectResponse> & {
  type: BlockObjectResponse['type']
}

function getBlockTypeObject (block: BlockObjectResponse | BlockContent) {
  switch (block.type) {
    case 'paragraph': return (block as ParagraphBlockObjectResponse).paragraph
    case 'heading_1': return (block as Heading1BlockObjectResponse).heading_1
    case 'heading_2': return (block as Heading2BlockObjectResponse).heading_2
    case 'heading_3': return (block as Heading3BlockObjectResponse).heading_3
    case 'bulleted_list_item': return (block as BulletedListItemBlockObjectResponse).bulleted_list_item
    case 'numbered_list_item': return (block as NumberedListItemBlockObjectResponse).numbered_list_item
    case 'to_do': return (block as ToDoBlockObjectResponse).to_do
    case 'toggle': return (block as ToggleBlockObjectResponse).toggle
    case 'child_page': return (block as ChildPageBlockObjectResponse).child_page
    case 'child_database': return (block as ChildDatabaseBlockObjectResponse).child_database
    case 'embed': return (block as EmbedBlockObjectResponse).embed
    case 'image': return (block as ImageBlockObjectResponse).image
    case 'video': return (block as VideoBlockObjectResponse).video
    case 'file': return (block as FileBlockObjectResponse).file
    case 'pdf': return (block as PdfBlockObjectResponse).pdf
    case 'bookmark': return (block as BookmarkBlockObjectResponse).bookmark
    case 'callout': return (block as CalloutBlockObjectResponse).callout
    case 'quote': return (block as QuoteBlockObjectResponse).quote
    case 'equation': return (block as EquationBlockObjectResponse).equation
    case 'divider': return (block as DividerBlockObjectResponse).divider
    case 'table_of_contents': return (block as TableOfContentsBlockObjectResponse).table_of_contents
    case 'column': return (block as ColumnBlockObjectResponse).column
    case 'column_list': return (block as ColumnListBlockObjectResponse).column_list
    case 'link_preview': return (block as LinkPreviewBlockObjectResponse).link_preview
    case 'synced_block': return (block as SyncedBlockBlockObjectResponse).synced_block
    case 'template': return (block as TemplateBlockObjectResponse).template
    case 'link_to_page': return (block as LinkToPageBlockObjectResponse).link_to_page
    case 'table': return (block as TableBlockObjectResponse).table
    case 'table_row': return (block as TableRowBlockObjectResponse).table_row
    default: return (block as UnsupportedBlockObjectResponse).unsupported
  }
}

function getRichText (block: BlockObjectResponse | BlockContent): RichTextItemResponse[] | undefined {
  const blockTypeObject = getBlockTypeObject(block)

  return 'rich_text' in blockTypeObject ? blockTypeObject.rich_text : undefined
}

interface GetBlockContentOptions {
  notionToken: string
  block: BlockObjectResponse
  filter?: (block: BlockObjectResponse) => boolean
  includeId?: boolean
}

interface BlockTypeObject {
  children?: BlockContent[]
  rich_text?: RichTextItemResponse
}

export async function getBlockContent ({ notionToken, block, filter, includeId = false }: GetBlockContentOptions) {
  if (filter && !filter(block)) return

  const children = block.has_children
    ? (await getBlockChildrenDeep({ notionToken, pageId: block.id, includeId }))
    : undefined
  const richText = getRichText(block)
  const blockTypeObject = { children } as BlockTypeObject

  if (richText) {
    blockTypeObject.rich_text = richText
  }

  const content = {
    object: 'block',
    type: block.type,
    [block.type]: blockTypeObject,
  } as BlockContent

  if (includeId) {
    content.id = block.id
  }

  return content
}

export function textFilter (block: BlockObjectResponse) {
  return !!(getRichText(block) || [])[0].plain_text.trim()
}

interface AppendBlockChildrenOptions {
  notionToken: string
  pageId: string
  blocks: BlockContent[]
}

export function makeAppendRequest ({ notionToken, pageId, blocks }: AppendBlockChildrenOptions) {
  return makeRequest<ListBlockChildrenResponse>({
    notionToken,
    method: 'patch',
    path: `blocks/${pageId}/children`,
    body: {
      children: blocks,
    },
  })
}

export async function appendBlockChildren ({ notionToken, pageId, blocks }: AppendBlockChildrenOptions) {
  let toAppend: BlockContent[] = []

  for (const block of blocks) {
    if (block[block.type].children) {
      const children = block[block.type].children
      delete block[block.type].children
      toAppend.push(block)

      const { results } = await makeAppendRequest({ notionToken, pageId, blocks: toAppend })
      toAppend = []

      await appendBlockChildren({
        notionToken,
        pageId: results[results.length - 1].id,
        blocks: children,
      })
    } else {
      toAppend.push(block)
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
  block: BlockContent
}

export function updateBlock ({ notionToken, blockId, block }: UpdateBlockOptions) {
  return makeRequest<void>({
    notionToken,
    method: 'patch',
    path: `blocks/${blockId}`,
    body: block,
  })
}

interface MakeBlockOptions {
  annotations?: Partial<RichTextItemResponse['annotations']>
  children?: BlockContent[]
  text: string
  type: BlockContent['type']
}

export function makeBlock ({ text, type = 'paragraph', annotations, children }: MakeBlockOptions): BlockContent {
  return {
    type,
    object: 'block',
    [type]: {
      rich_text: [
        {
          type: 'text',
          text: {
            content: text,
          },
          annotations,
          plain_text: text,
        },
        children,
      ],
    },
  } as BlockContent
}

export function richTextToPlainText (richText: RichTextItemResponse[]) {
  return richText
  .map(({ plain_text }) => plain_text)
  .join('')
  .trim()
}

export function getBlockPlainText (block: BlockObjectResponse | BlockContent) {
  if (!block) return

  const richText = getRichText(block)

  if (!richText) return

  return richTextToPlainText(richText)
}

export function makeTextPart (content: string, color?: ApiColor): TextRichTextItemResponse {
  return {
    type: 'text',
    text: {
      content,
      link: null,
    },
    annotations: {
      bold: false,
      italic: false,
      strikethrough: false,
      underline: false,
      code: false,
      color: color || 'default',
    },
    plain_text: content,
    href: null,
  }
}

export function getMonthNameFromIndex (monthIndex: number, short = false) {
  return dayjs().month(monthIndex).format(short ? 'MMM' : 'MMMM')
}

export function getMonths ({ short }: { short?: boolean } = {}) {
  return Array.from(new Array(12)).map((_, i) => {
    return getMonthNameFromIndex(i, short)
  })
}

const getDisplayPrefix = (block: BlockObjectResponse) => {
  switch (block.type) {
    case 'paragraph': return ''
    case 'heading_1': return '# '
    case 'heading_2': return '## '
    case 'heading_3': return '### '
    case 'to_do': return `[${block.to_do.checked ? '✓' : ' '}] `
    case 'bulleted_list_item': return '• '
    case 'numbered_list_item': return '1. '
    case 'toggle': return '> '
    case 'code': return '<> '
    case 'quote': return '| '
    case 'callout': return '" '
    default: return ''
  }
}

function getDisplayText (block: BlockObjectResponse) {
  if (block.type === 'child_page') {
    return `[${block.child_page.title}]`
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
export function displayBlocks (blocks: BlockObjectResponse[]) {
  blocks.forEach((block) => {
    // eslint-disable-next-line no-console
    console.log(`[${block.id}] ${getDisplayText(block)}${block.has_children ? ' (parent)' : ''}`)
  })
}
