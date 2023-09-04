import type { BlockObjectResponse, RichTextItemResponse } from '@notionhq/client/build/src/api-endpoints'
import type { Block, NotionBlock, OutgoingBlock } from '../types'
import { clone } from '../../util/collections'

export function convertNotionBlockToOwnBlock (block: BlockObjectResponse): NotionBlock {
  const type = block.type
  // @ts-ignore
  const content = block[type] as Content

  return {
    content: clone(content),
    has_children: block.has_children,
    id: block.id,
    type,
  }
}

export function convertBlockToOutgoingBlock (block: Block): OutgoingBlock {
  return {
    object: 'block',
    type: block.type,
    [block.type]: block.content,
  }
}

export function richTextToPlainText (richText: RichTextItemResponse[]) {
  return richText
  .map(({ plain_text }) => plain_text)
  .join('')
  .trim()
}
