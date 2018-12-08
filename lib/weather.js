const rp = require('request-promise')

const fifteenMinutes = 15 * 60 * 1000
const WEATHER_BASE_URL = `https://api.darksky.net/forecast/${process.env.DARK_SKY_API_KEY}`

let weatherCache = {}

setInterval(() => {
  weatherCache = {}
}, fifteenMinutes)

const get = (req, res) => {
  const location = req.query.location

  if (weatherCache[location]) {
    res.end(weatherCache[location])

    return
  }

  rp(`${WEATHER_BASE_URL}/${location}?exclude=minutely,flags&extend=hourly`)
  .then((result) => {
    weatherCache[location] = result
    res.send(result)
  })
  .catch((error) => {
    res.status(500).json({ error })
  })
}

module.exports = {
  get,
}
