const rp = require('request-promise')
const { getEnv } = require('./util/env')

const WEATHER_BASE_URL = `https://api.darksky.net/forecast/${getEnv('DARK_SKY_API_KEY')}`

const getData = ({ location }) => {
  return rp({
    uri: `${WEATHER_BASE_URL}/${location}`,
    qs: {
      exclude: 'minutely,flags',
      extend: 'hourly',
    },
    json: true,
  })
}

const get = (req, res) => {
  getData(req.query)
  .then((result) => {
    res.json(result)
  })
  .catch((error) => {
    res.status(500).json({ error })
  })
}

module.exports = {
  get,
  getData,
}
