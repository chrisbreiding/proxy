import bodyParser from 'body-parser'
import Bree from 'bree'
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
import * as dogs from './lib/dogs'
import * as sync from './lib/sync'
import { createTvRoutes } from './lib/tv'
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

  /* c8 ignore next 4 */
  if (process.env.NODE_ENV === 'development') {
    app.use(morgan('tiny'))
  }

  const corsOrigins: (string | RegExp)[] = [
    /^http:\/\/(\w+\.)?local(host)?:\d{4}$/,
    /^https:\/\/\w+\.crbapps\.com$/,
  ]

  /* c8 ignore next 4 */
  if (process.env.ALLOW_NGROK === 'TRUE') {
    corsOrigins.push(/^https:\/\/[A-Za-z0-9]+\.ngrok\.io$/)
  }

  app.use(express.static('public'))
  app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
    const origin = req.url === `/notion/factor-meals/${process.env.API_KEY}`
      ? corsOrigins.concat('https://www.factor75.com')
      : corsOrigins
    return cors({ origin })(req, res, next)
  })
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
  app.post('/notion/quests/:key', ensureApiKey, notion.addQuest)
  app.post('/notion/sarah/todo/:key', ensureApiKey, notion.addSarahTodo)
  app.get('/notion/action/:key', ensureApiKey, notion.action)
  app.post('/notion/action/:key', ensureApiKey, notion.action)
  app.get('/notion/factor-meals/:key', ensureApiKey, notion.getFactorMeals)
  app.post('/notion/factor-meals/:key', ensureApiKey, notion.addFactorMeal)
  app.get('/location-search', location.search)
  app.get('/location-details', location.details)
  app.get('/weather', weather.get)
  app.get('/dogs/:id', dogs.get)
  app.get('/dogs', dogs.search)
  app.get('/sync/:user/:app/:key', ensureApiKey, sync.get)
  app.post('/sync/:user/:app/:key', ensureApiKey, sync.set)

  app.use('/tv', createTvRoutes())

  app.get('/test', (req: express.Request, res: express.Response) => {
    res.json({ ok: true })
  })

  io.on('connection', notion.onSocket)

  server.listen(port, () => {
    debug(`Listening on port ${port}...`)
  })

  return server
}

/* c8 ignore start */
async function startBree () {
  if (process.env.NODE_ENV !== 'production') return

  const bree = new Bree({})

  await bree.start()
}

if (require.main === module) {
  startServer(Number(process.env.PORT) || 3333)
  startBree()
}
/* c8 ignore stop */
