import { getBlockChildren, getBlockPlainText, NotionBlock } from './util'

async function findUpcomingId (blocks: NotionBlock[]) {
  const block = blocks.find((block) => {
    return block.type === 'toggle' && getBlockPlainText(block) === 'Upcoming'
  })

  if (!block) {
    throw new Error('Could not find Upcoming block')
  }

  return block.id
}

interface GetAllOptions {
  notionToken: string
  pageId: string
}

export async function getAllQuests ({ notionToken, pageId }: GetAllOptions) {
  const questBlocks = await getBlockChildren({ notionToken, pageId })
  const upcomingId = await findUpcomingId(questBlocks)
  const upcomingBlocks = await getBlockChildren({ notionToken, pageId: upcomingId })

  return [...questBlocks, ...upcomingBlocks]
}
