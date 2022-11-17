import axios from 'axios'
import express from 'express'
import { debug } from '../util/debug'
import { searchShows } from './source/shows'
import { getMetaData } from './store/metadata'
import { addShow, deleteShow, getShowsWithEpisodesForUser, updateShow } from './store/shows'
import { getUser, getUserByApiKey, updateUser, User } from './store/users'
import Mixpanel from 'mixpanel'
import { getEnv } from '../util/env'

const userMap = {} as { [key: string]: User }

async function ensureAndSetUser (req: express.Request, res: express.Response, next: express.NextFunction) {
  const apiKey = req.headers['api-key'] || req.query.apiKey

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

  const mixpanel = Mixpanel.init(getEnv('MIXPANEL_TOKEN')!)

  res.locals.mixpanel = mixpanel
  mixpanel.people.set(apiKey, { username: user.username })

  next()
}

function guard (handler: (req: express.Request, res: express.Response) => void) {
  return async (req: express.Request, res: express.Response) => {
    try {
      return await handler(req, res)
    } catch (error: any) {
      debug('tv route error:', error?.stack)

      res.status(500).json({ error: error.message })
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
    const shows = await getShowsWithEpisodesForUser(res.locals.user)

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

  router.get('/shows/poster/:poster', guard(async (req: express.Request, res: express.Response) => {
    const response = await axios({
      method: 'get',
      url: Buffer.from(req.params.poster, 'base64').toString(),
      responseType: 'stream',
    })

    response.data.pipe(res)
  }))

  router.get('/user', guard(async (req: express.Request, res: express.Response) => {
    const id = res.locals.user.id
    const user = await getUser(id)

    if (!user) {
      return res.status(404).send({ error: `User with id '${id}' not found` })
    }

    res.json({
      lastUpdated: (await getMetaData()).lastUpdated,
      searchLinks: user.searchLinks,
      username: user.username,
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

  router.post('/stats', guard(async (req: express.Request, res: express.Response) => {
    const { apiKey } = res.locals.user
    const { event, data } = req.body

    try {
      res.locals.mixpanel.track(apiKey, event, data || {})
    } catch (error: any) {
      debug('Mixpanel error for event \'%s\': %s', event, error.stack)
    }

    res.sendStatus(204)
  }))

  return router
}
