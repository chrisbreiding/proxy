const {
  getBlockChildren,
  getPlainText,
} = require('./util')

const findUpcomingId = async (blocks) => {
  const block = blocks.find((block) => {
    return block.type === 'toggle' && getPlainText(block) === 'Upcoming'
  })

  if (!block) {
    throw new Error('Could not find Upcoming block')
  }

  return block.id
}

const getAll = async ({ notionToken, pageId }) => {
  const { results: questBlocks } = await getBlockChildren({ notionToken, pageId })
  const upcomingId = await findUpcomingId(questBlocks)
  const { results: upcomingBlocks } = await getBlockChildren({ notionToken, pageId: upcomingId })

  return [...questBlocks, ...upcomingBlocks]
}

module.exports = {
  getAll,
}
