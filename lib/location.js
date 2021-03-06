const rp = require('request-promise')

const oneDay = 24 * 60 * 60 * 1000
const LOCATION_DETAILS_PLACE_ID_BASE_URL = 'https://maps.googleapis.com/maps/api/place/details/json'
const LOCATION_DETAILS_LAT_LNG_BASE_URL = 'https://maps.googleapis.com/maps/api/geocode/json'

let locationDetailsCache = {}

setInterval(() => {
  locationSearchCache = {}
  locationDetailsCache = {}
}, oneDay)

const details = (req, res) => {
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
}

const LOCATION_SEARCH_BASE_URL = 'https://maps.googleapis.com/maps/api/place/autocomplete/json'
let locationSearchCache = {}

const search = (req, res) => {
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
}

module.exports = {
  details,
  search,
}
