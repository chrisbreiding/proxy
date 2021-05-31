const { addUpcomingWeek } = require('./upcoming-week')
const { getData } = require('./data')
const { onSocket } = require('./shopping')

module.exports = {
  addUpcomingWeek,
  getData,
  onSocket,
}
