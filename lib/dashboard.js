const garage = require('./garage')
const notion = require('./notion')
const weather = require('./weather')

const wrap = (who, fn) => {
  return fn()
  .then((data) => {
    return { data }
  })
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.log('Getting', who, 'data errored:', error.stack)

    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    }
  })
}

const get = (req, res) => {
  Promise.all([
    wrap('garage', () => garage.getData()),
    wrap('notion', () => notion.getData(req.query)),
    wrap('weather', () => weather.getData(req.query)),
  ])
  .then(([garage, notion, weather]) => {
    res.json({ garage, notion, weather })
  })
}

module.exports = {
  get,
}
