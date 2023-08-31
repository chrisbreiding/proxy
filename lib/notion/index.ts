import { addMeal as addFactorMeal, getMeals as getFactorMeals } from './factor/meals'
import { onSocket } from './shopping'
import { addUpcomingWeek, upcomingWeekView } from './upcoming-week'
import { getBlockChildren } from './util'

interface GetDataOptions {
  notionToken: string
  notionPageId: string
}

export function getNotionData ({ notionToken, notionPageId }: GetDataOptions) {
  return getBlockChildren({ notionToken, pageId: notionPageId })
}

export {
  addFactorMeal,
  addUpcomingWeek,
  getFactorMeals,
  onSocket,
  upcomingWeekView,
}
