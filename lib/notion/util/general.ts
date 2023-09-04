import type {
  ApiColor,
  BlockObjectResponse,
  RichTextItemResponse,
} from '@notionhq/client/build/src/api-endpoints'
import type { Block, NotionBlock, OwnBlock } from '../types'
import { richTextToPlainText } from './conversions'

export function getRichText (block: OwnBlock): RichTextItemResponse[] | undefined {
  return 'rich_text' in block.content ? block.content.rich_text : undefined
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
