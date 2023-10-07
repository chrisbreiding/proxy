import { action } from './actions'
import { addMeal as addFactorMeal, getMeals as getFactorMeals } from './factor/meals'
import { addQuest } from './quests'
import { onSocket } from './shopping'
import { getBlockChildren } from './util/queries'

interface GetDataOptions {
  notionToken: string
  notionPageId: string
}

export function getNotionData ({ notionToken, notionPageId }: GetDataOptions) {
  return getBlockChildren({ notionToken, pageId: notionPageId })
}

export {
  action,
  addFactorMeal,
  addQuest,
  getFactorMeals,
  onSocket,
}
