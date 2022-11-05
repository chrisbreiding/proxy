import bodyParser from 'body-parser'
import cors from 'cors'
import express from 'express'
import { engine as handlebars } from 'express-handlebars'
import http from 'http'
import morgan from 'morgan'
import { Server } from 'socket.io'

import * as dashboard from './lib/dashboard'
import * as garage from './lib/garage'
import * as location from './lib/location'
import * as notion from './lib/notion'
import { debug } from './lib/util/debug'
import * as weather from './lib/weather'

export function startServer (port: number) {
  const app = express()
  const server = http.createServer(app)
  const io = new Server(server, {
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
  app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
    res.set('Content-Type', 'application/json')
    next()
  })

  function ensureApiKey (req: express.Request, res: express.Response, next: express.NextFunction) {
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
  app.get('/notion/upcoming-week/:key', ensureApiKey, notion.upcomingWeekView)
  app.post('/notion/upcoming-week/:key', ensureApiKey, notion.addUpcomingWeek)
  app.get('/location-search', location.search)
  app.get('/location-details', location.details)
  app.get('/weather', weather.get)

  app.get('/test', (req: express.Request, res: express.Response) => {
    res.json({ ok: true })
  })

  io.on('connection', notion.onSocket)

  server.listen(port, () => {
    debug(`listening on port ${port}...`)
  })

  return server
}

if (require.main === module) {
  startServer(Number(process.env.PORT) || 3333)
}
