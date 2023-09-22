import type express from 'express'
import { addMeal as addFactorMeal, getMeals as getFactorMeals } from './factor/meals'
import { addQuest } from './quests'
import { onSocket } from './shopping'
import { addUpcomingWeek, upcomingWeekView } from './upcoming-week'
import { getBlockChildren } from './util/queries'
import { clearCompleted } from './clear-completed'
import { sendHtml } from './util/general'

interface GetDataOptions {
  notionToken: string
  notionPageId: string
}

export function getNotionData ({ notionToken, notionPageId }: GetDataOptions) {
  return getBlockChildren({ notionToken, pageId: notionPageId })
}

export function action (req: express.Request, res: express.Response) {
  const action = req.query.action

  if (!action) {
    sendHtml(res, 400, '<p>A value for <em>action</em> must be provided in the query string</p>')

    return
  }

  switch (action) {
    case 'clearCompleted':
      return clearCompleted(req, res)
    default:
      sendHtml(res, 400, `<p>Action not supported: ${action}</p>`)
  }
}

export {
  addFactorMeal,
  addQuest,
  addUpcomingWeek,
  getFactorMeals,
  onSocket,
  upcomingWeekView,
}
