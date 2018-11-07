const bodyParser = require('body-parser')
const cors = require('cors')
const express = require('express')

const location = require('./lib/location')
const weather = require('./lib/weather')

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

app.get('/location-search', location.search)
app.get('/location-details', location.details)
app.get('/weather', weather.get)

app.get('/test', (req, res) => {
  res.json({ ok: true })
})

const port = process.env.PORT || 3333

app.listen(port, () => {
  console.log(`listening on port ${port}...`) // eslint-disable-line no-console
})
