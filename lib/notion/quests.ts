import type { BlockObjectResponse } from '@notionhq/client/build/src/api-endpoints'

import { getBlockChildren, getBlockPlainText } from './util'

async function findUpcomingId (blocks: BlockObjectResponse[]) {
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
  const questResponse = await getBlockChildren({ notionToken, pageId })
  const questBlocks = questResponse.results as BlockObjectResponse[]
  const upcomingId = await findUpcomingId(questBlocks)
  const upcomingResponse = await getBlockChildren({ notionToken, pageId: upcomingId })
  const upcomingBlocks = upcomingResponse.results as BlockObjectResponse[]

  return [...questBlocks, ...upcomingBlocks]
}
