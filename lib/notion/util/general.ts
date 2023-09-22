import type express from 'express'
import type {
  ApiColor,
  BlockObjectResponse,
  RichTextItemResponse,
} from '@notionhq/client/build/src/api-endpoints'

import type { Block, Content, NotionBlock, OwnBlock } from '../types'
import { richTextToPlainText } from './conversions'

export function getRichText (block: OwnBlock): RichTextItemResponse[] | undefined {
  return 'rich_text' in block.content ? block.content.rich_text : undefined
  /* c8 ignore next */
}

interface MakeBlockOptions {
  annotations?: Partial<RichTextItemResponse['annotations']>
  children?: OwnBlock[] | NotionBlock[]
  content?: Content
  text?: string
  type: BlockObjectResponse['type']
}

export function makeBlock (options: MakeBlockOptions) {
  const { annotations, children, content, text, type = 'paragraph' } = options

  return {
    type,
    children,
    content: content || {
      rich_text: typeof text === 'string' ? [
        {
          type: 'text',
          text: {
            content: text,
          },
          annotations,
          plain_text: text,
        },
      ] : [],
    },
  } as OwnBlock
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

// compare guids without dashes in case one does not include dashes
export function areIdsEqual (id1: string, id2: string) {
  return id1.replaceAll('-', '') === id2.replaceAll('-', '')
}

function getBlockChildrenDepth (block: Block, depth: number): number {
  if (!block.children) {
    return depth
  }

  return getBlocksChildrenDepth(block.children, depth + 1)
}

export function getBlocksChildrenDepth (blocks: Block[], depth = 0) {
  if (!blocks.length) return depth

  return Math.max(...blocks.map((block) => getBlockChildrenDepth(block, depth)))
}

export function sendHtml (res: express.Response, statusCode: number, message: string) {
  res
  .status(statusCode)
  .set('Content-Type', 'text/html')
  .send(message)
}
