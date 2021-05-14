const garage = require('./garage')
const notion = require('./notion')
const weather = require('./weather')

const catchAndLog = (who, fn) => {
  return fn()
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.log('Getting', who, 'data errored:', error.stack)
  })
}

const get = (req, res) => {
  Promise.all([
    catchAndLog('garage', () => garage.getData()),
    catchAndLog('notion', () => notion.getData(req.query)),
    catchAndLog('weather', () => weather.getData(req.query)),
  ])
  .then(([garage, notion, weather]) => {
    res.json({ garage, notion, weather })
  })
  .catch(() => {
    res.json({})
  })
}

module.exports = {
  get,
}
