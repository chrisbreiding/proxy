import type { BlockObjectResponse, RichTextItemResponse } from '@notionhq/client'
import type { Block, NotionBlock, OutgoingBlock } from '../types'
import { clone } from '../../util/collections'

export function convertNotionBlockToOwnBlock (block: BlockObjectResponse): NotionBlock {
  const type = block.type
  // @ts-ignore
  const content = block[type] as Content
  // @ts-ignore
  const parentId = block.parent[block.parent.type]

  return {
    content: clone(content),
    has_children: block.has_children,
    id: block.id,
    parentId,
    type,
  }
}

function stripNullValues (obj: Record<string, any>): Record<string, any> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, value]) => value !== null),
  )
}

export function convertBlockToOutgoingBlock (block: Block): OutgoingBlock {
  return {
    object: 'block',
    type: block.type,
    [block.type]: stripNullValues(block.content as Record<string, any>),
  }
}

export function richTextToPlainText (richText: RichTextItemResponse[]) {
  return richText
  .map(({ plain_text }) => plain_text)
  .join('')
  .trim()
}
