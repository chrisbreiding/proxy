import { addUpcomingWeek, upcomingWeekView } from './upcoming-week'
import { getBlockChildren } from './util'
import { onSocket } from './shopping'

interface GetDataOptions {
  notionToken: string
  notionPageId: string
}

export function getNotionData ({ notionToken, notionPageId }: GetDataOptions) {
  return getBlockChildren({ notionToken, pageId: notionPageId })
}

export {
  addUpcomingWeek,
  upcomingWeekView,
  onSocket,
}
