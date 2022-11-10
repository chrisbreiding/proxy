import express from 'express'
import { addShow, deleteShow, getShows, updateShow } from './store/shows'
import { getUserByApiKey } from './store/users'

async function ensureAndSetUser (req: express.Request, res: express.Response, next: express.NextFunction) {
  const apiKey = req.headers['api-key']

  if (typeof apiKey !== 'string') {
    return res.status(401).json({
      error: 'Must specify `api-key` header',
    })
  }

  const user = await getUserByApiKey(apiKey as string)

  if (!user) {
    return res.status(401).json({
      error: `Could not find user with api key: ${apiKey}`,
    })
  }

  res.locals.user = user

  next()
}

export function createTvRoutes () {
  const router = express.Router()

  router.use(ensureAndSetUser)

  router.get('/shows', async (req: express.Request, res: express.Response) => {
    const shows = await getShows(res.locals.user)

    res.json(shows)
  })

  router.post('/shows', async (req: express.Request, res: express.Response) => {
    const show = await addShow(req.body.show, res.locals.user)

    if (!show) {
      return res.sendStatus(204)
    }

    res.json(show)
  })

  router.put('/shows/:id', async (req: express.Request, res: express.Response) => {
    const show = await updateShow(req.params.id, req.body.show, res.locals.user)

    if (!show) {
      return res.sendStatus(204)
    }

    res.json(show)
  })

  router.delete('/shows/:id', async (req: express.Request, res: express.Response) => {
    await deleteShow(req.params.id, res.locals.user)

    res.sendStatus(204)
  })

  // TODO:
  // getSettings: GET /settings/1 -> { setting }
  // updateSettings: PUT /settings/1 { setting }

  // searchSourceShows: GET /source_shows ?query={query}
  // sendStats: POST /stats { event, data }

  return router
}
