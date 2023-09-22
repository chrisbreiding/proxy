import type express from 'express'

import { getBlockPlainText, makeBlock } from './util/general'
import { getEnv } from '../util/env'
import type { NotionBlock } from './types'
import { getBlockChildren } from './util/queries'
import { dateRegex } from '../util/dates'
import { appendBlockChildren } from './util/updates'

const notionToken = getEnv('NOTION_TOKEN')!
const questsId = getEnv('NOTION_QUESTS_ID')!

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

function isNextDate (block: NotionBlock, index: number) {
  return (
    index !== 0
    && dateRegex.test(getBlockPlainText(block) || '')
  )
}

async function getNewQuestAfterId (blocks: NotionBlock[]) {
  const index = blocks.findIndex((block, index) => {
    return isNextDate(block, index) || block.type === 'divider'
  })

  if (index === -1) return

  return blocks[index - 1].id
}

export async function addQuest (req: express.Request, res: express.Response) {
  const quest = req.body.quest
  const questBlocks = await getBlockChildren({
    notionToken,
    pageId: questsId,
  })
  const afterId = await getNewQuestAfterId(questBlocks)

  await appendBlockChildren({
    afterId,
    blocks: [makeBlock({
      text: quest,
      type: 'bulleted_list_item',
    })],
    notionToken,
    pageId: questsId,
  })

  res.sendStatus(200)
}
