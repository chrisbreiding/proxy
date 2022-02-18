const { addUpcomingWeek, upcomingWeekView } = require('./upcoming-week')
const { getBlockChildren } = require('./util')
const { onSocket } = require('./shopping')

const getData = ({ notionToken, notionPageId }) => {
  return getBlockChildren({ notionToken, pageId: notionPageId })
}

module.exports = {
  addUpcomingWeek,
  upcomingWeekView,
  getData,
  onSocket,
}
