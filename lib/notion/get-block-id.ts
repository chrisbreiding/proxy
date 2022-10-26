import minimist from 'minimist'
import Debug from 'debug'
import type { BlockObjectResponse } from '@notionhq/client/build/src/api-endpoints'

import { getBlockChildren, getBlockPlainText } from './util'
import { getEnv } from '../util/env'

const debug = Debug('proxy:scripts')

const notionToken = getEnv('NOTION_TOKEN')!

interface SearchOptions {
  pageId: string
  text: string
  parent?: boolean
}

async function searchBlocks ({ pageId, text, parent = false }: SearchOptions): Promise<string | undefined> {
  const response = await getBlockChildren({ notionToken, pageId })
  const blockWithChildrenIds: string[] = []

  for (const block of (response.results as BlockObjectResponse[])) {
    const blockText = getBlockPlainText(block)

    debug('Checking block: %o', { text: blockText, children: block.has_children })

    if (blockText && blockText.includes(text)) {
      return block.id
    }

    if (block.has_children && block.type !== 'child_page') {
      blockWithChildrenIds.push(block.id)
    }
  }

  for (const blockId of blockWithChildrenIds) {
    debug('--- Children of %s ---', blockId)
    const id = await searchBlocks({ pageId: blockId, text })

    if (id) {
      return parent ? blockId : id
    }
  }
}

async function getBlockId () {
  try {
    const args = minimist(process.argv.slice(2)) as Partial<SearchOptions>

    if (!args.pageId) {
      throw new Error('Must specify page ID with --page-id')
    }

    if (!args.text) {
      throw new Error('Must specify search text with --text')
    }

    const id = await searchBlocks({
      pageId: args.pageId!,
      text: args.text!,
      parent: args.parent,
    })
    const message = args.parent ? 'Parent block ID is:' : 'Block ID is:'

    // eslint-disable-next-line no-console
    console.log(message, id)

    process.exit(0)
  } catch (error: any) {
    // eslint-disable-next-line no-console
    console.log('Getting blocks failed:')
    // eslint-disable-next-line no-console
    console.log(error?.stack || error)

    process.exit(1)
  }
}

getBlockId()
