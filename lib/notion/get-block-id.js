const minimist = require('minimist')
const debug = require('debug')('proxy:scripts')

const { getBlockChildren, getPlainText } = require('./util')
const { getEnv } = require('../util/env')

const notionToken = getEnv('NOTION_TOKEN')

const searchBlocks = async ({ pageId, text, parent = false }) => {
  const blocks = await getBlockChildren({ notionToken, pageId })
  const blocksWithChildren = []

  for (let block of blocks.results) {
    const blockText = getPlainText(block[block.type])

    debug('Checking block: %o', { text: blockText, children: block.has_children })

    if (blockText && blockText.includes(text)) {
      return block.id
    }

    if (block.has_children && block.type !== 'child_page') {
      blocksWithChildren.push(block.id)
    }
  }

  for (let blockId of blocksWithChildren) {
    debug('--- Children of %s ---', blockId)
    const id = await searchBlocks({ pageId: blockId, text })

    if (id) {
      return parent ? blockId : id
    }
  }
}

const getBlockId = async () => {
  try {
    const args = minimist(process.argv.slice(2))
    const id = await searchBlocks(args)
    const message = args.parent ? 'Parent block ID is:' : 'Block ID is:'

    // eslint-disable-next-line no-console
    console.log(message, id)

    process.exit(0)
  } catch (error) {
    // eslint-disable-next-line no-console
    console.log('Getting blocks failed:')
    // eslint-disable-next-line no-console
    console.log(error.stack)

    process.exit(1)
  }
}

getBlockId()
