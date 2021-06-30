const bodyParser = require('body-parser')
const cors = require('cors')
const express = require('express')
const handlebars = require('express-handlebars')
const http = require('http')
const morgan = require('morgan')
const socketIO = require('socket.io')

const dashboard = require('./lib/dashboard')
const garage = require('./lib/garage')
const location = require('./lib/location')
const notion = require('./lib/notion')
const weather = require('./lib/weather')

const app = express()
const server = http.createServer(app)
const io = socketIO(server, {
  serveClient: false,
})

app.engine('.hbs', handlebars({ extname: '.hbs' }))
app.set('view engine', '.hbs')

if (process.env.NODE_ENV === 'development') {
  app.use(morgan('tiny'))
}

const corsOrigins = [
  /^http:\/\/(\w+\.)?local(host)?:\d{4}$/,
  /^https:\/\/\w+\.crbapps\.com$/,
]

if (process.env.ALLOW_NGROK === 'TRUE') {
  corsOrigins.push(/^https:\/\/[A-Za-z0-9]+\.ngrok\.io$/)
}

app.use(express.static('public'))
app.use(cors({ origin: corsOrigins }))
app.use(bodyParser.json())
app.use((req, res, next) => {
  res.set('Content-Type', 'application/json')
  next()
})

const ensureApiKey = (req, res, next) => {
  if (req.params.key !== process.env.API_KEY) {
    return res.sendStatus(403)
  }

  next()
}

app.get('/dashboard/:key', ensureApiKey, dashboard.get)
app.get('/garage-states/:key', ensureApiKey, garage.get)
app.post('/garage-states/:door/:state/:key', ensureApiKey, garage.set)
app.post('/garage/notify-on-open/:notifyOnOpen/:key', ensureApiKey, garage.setNotifyOnOpen)
app.get('/garage/:key', ensureApiKey, garage.view)
app.get('/notion/upcoming-week/:key', ensureApiKey, notion.addUpcomingWeek)
app.get('/location-search', location.search)
app.get('/location-details', location.details)
app.get('/weather', weather.get)

app.get('/test', (req, res) => {
  res.json({ ok: true })
})

const port = process.env.PORT || 3333

io.on('connection', (socket) => {
  notion.onSocket(socket)
})

server.listen(port, () => {
  console.log(`listening on port ${port}...`) // eslint-disable-line no-console
})
