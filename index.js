const bodyParser = require('body-parser')
const cors = require('cors')
const express = require('express')
const rp = require('request-promise')

const app = express()

app.use(cors({
  origin: [
    /^http:\/\/(\w+\.)?local(host)?:\d{4}$/,
    /^https?:\/\/\w+\.crbapps\.com$/,
  ],
}))
app.use(bodyParser.json())
app.use((req, res, next) => {
  res.set('Content-Type', 'application/json')
  next()
})

const oneDay = 24 * 60 * 60 * 1000
const fifteenMinutes = 15 * 60 * 1000

const LOCATION_SEARCH_BASE_URL = 'https://maps.googleapis.com/maps/api/place/autocomplete/json'
let locationSearchCache = {}

app.get('/location-search', (req, res) => {
  const query = req.query.query
  if (locationSearchCache[query]) {
    res.send(locationSearchCache[query])
    return
  }

  rp(`${LOCATION_SEARCH_BASE_URL}?key=${process.env.GOOGLE_API_KEY}&input=${query}`)
  .then((result) => {
    locationSearchCache[query] = result
    res.send(result)
  })
  .catch((err) => {
    res.status(500).json({ error: err })
  })
})

const LOCATION_DETAILS_PLACE_ID_BASE_URL = 'https://maps.googleapis.com/maps/api/place/details/json'
const LOCATION_DETAILS_LAT_LNG_BASE_URL = 'https://maps.googleapis.com/maps/api/geocode/json'

let locationDetailsCache = {}
setInterval(() => {
  locationSearchCache = {}
  locationDetailsCache = {}
}, oneDay)

app.get('/location-details', (req, res) => {
  const placeId = req.query.placeid
  const key = placeId ? 'placeid' : 'latlng'
  const value = placeId || req.query.latlng
  const baseUrl = placeId ? LOCATION_DETAILS_PLACE_ID_BASE_URL : LOCATION_DETAILS_LAT_LNG_BASE_URL

  if (locationDetailsCache[value]) {
    res.send(locationDetailsCache[value])
    return
  }

  rp(`${baseUrl}?key=${process.env.GOOGLE_API_KEY}&${key}=${value}`)
  .then((result) => {
    locationDetailsCache[value] = result
    res.send(result)
  })
  .catch((err) => {
    res.status(500).json({ error: err })
  })
})

const WEATHER_BASE_URL = `https://api.darksky.net/forecast/${process.env.DARK_SKY_API_KEY}`

let weatherCache = {}
setInterval(() => {
  weatherCache = {}
}, fifteenMinutes)

app.get('/weather', (req, res) => {
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
})

const port = process.env.PORT || 3333

app.listen(port, () => {
  console.log(`listening on port ${port}...`) // eslint-disable-line no-console
})
