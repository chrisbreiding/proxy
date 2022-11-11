import express from 'express'
import { debug } from '../util/debug'
import { searchShows } from './source/shows'
import { addShow, deleteShow, getShows, updateShow } from './store/shows'
import { getUser, getUserByApiKey, updateUser, User } from './store/users'

const userMap = {} as { [key: string]: User }

async function ensureAndSetUser (req: express.Request, res: express.Response, next: express.NextFunction) {
  const apiKey = req.headers['api-key']

  if (typeof apiKey !== 'string') {
    return res.status(401).json({
      error: 'Must specify `api-key` header',
    })
  }

  const user = userMap[apiKey] || await getUserByApiKey(apiKey as string)

  if (!user) {
    return res.status(401).json({
      error: `Could not find user with api key: ${apiKey}`,
    })
  }

  userMap[apiKey] = user
  res.locals.user = user

  next()
}

function guard (handler: (req: express.Request, res: express.Response) => void) {
  return async (req: express.Request, res: express.Response) => {
    try {
      return await handler(req, res)
    } catch (error: any) {
      debug('tv route error:', error?.stack)

      res.status(500).json({
        error: error?.message || error,
      })
    }
  }
}

export function createTvRoutes () {
  const router = express.Router()

  router.use(ensureAndSetUser)

  router.get('/shows/search', guard(async (req: express.Request, res: express.Response) => {
    const query = req.query.query as string
    const shows = await searchShows(query)

    res.json(shows)
  }))

  router.get('/shows', guard(async (req: express.Request, res: express.Response) => {
    const shows = await getShows(res.locals.user)

    res.json(shows)
  }))

  router.post('/shows', guard(async (req: express.Request, res: express.Response) => {
    const show = await addShow(req.body.show, res.locals.user)

    if (!show) {
      return res.sendStatus(204)
    }

    res.json(show)
  }))

  router.put('/shows/:id', guard(async (req: express.Request, res: express.Response) => {
    const show = await updateShow(req.params.id, req.body.show, res.locals.user)

    if (!show) {
      return res.sendStatus(204)
    }

    res.json(show)
  }))

  router.delete('/shows/:id', guard(async (req: express.Request, res: express.Response) => {
    await deleteShow(req.params.id, res.locals.user)

    res.sendStatus(204)
  }))

  router.get('/user', guard(async (req: express.Request, res: express.Response) => {
    const id = res.locals.user.id
    const user = await getUser(id)

    if (!user) {
      return res.status(404).send({ error: `User with id '${id}' not found` })
    }

    res.json({
      username: user.username,
      searchLinks: user.searchLinks,
    })
  }))

  router.put('/user', guard(async (req: express.Request, res: express.Response) => {
    const id = res.locals.user.id
    const user = await updateUser(id, { searchLinks: req.body.searchLinks })

    if (!user) {
      return res.status(404).send({ error: `User with id '${id}' not found` })
    }

    res.json({
      username: user.username,
      searchLinks: user.searchLinks,
    })
  }))

  return router
}
