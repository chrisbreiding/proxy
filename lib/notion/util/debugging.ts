import { getBlockPlainText, getRichText } from './general'
import { debug } from '../../util/debug'
import type { NotionBlock } from '../types'

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
