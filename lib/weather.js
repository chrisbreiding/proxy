const rp = require('request-promise')

const fifteenMinutes = 15 * 60 * 1000
const WEATHER_BASE_URL = `https://api.darksky.net/forecast/${process.env.DARK_SKY_API_KEY}`

let weatherCache = {}

setInterval(() => {
  weatherCache = {}
}, fifteenMinutes)

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
  const location = req.query.location

  if (weatherCache[location]) {
    res.json(weatherCache[location])

    return
  }

  getData(req.query)
  .then((result) => {
    weatherCache[location] = result
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
