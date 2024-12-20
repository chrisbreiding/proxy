import axios from 'axios'
import express from 'express'
import type { firestore } from 'firebase-admin'
import Mixpanel from 'mixpanel'

import { debug, debugVerbose } from '../util/debug'
import { getEnv } from '../util/env'
import { searchShows } from './source/shows'
import { initializeApp } from '../util/firebase'
import { getMetaData } from './store/metadata'
import { addShow, deleteShow, getShowsWithEpisodesForUser, updateShow } from './store/shows'
import { getUser, getUserByApiKey, updateUser, User } from './store/users'
import { guard } from '../util/routing'

interface Locals {
  db: firestore.Firestore
  user?: User
}

const userMap = {} as { [key: string]: User }
let db: firestore.Firestore | undefined

function setupMixpanel (res: express.Response, user?: User) {
  try {
    const mixpanel = Mixpanel.init(getEnv('MIXPANEL_TOKEN')!)
    res.locals.mixpanel = mixpanel

    if (user) {
      mixpanel.people.set(user.apiKey, { username: user.username })
    }
  } catch (error: any) {
    debug('Mixpanel.init error:', error.stack)
  }
}

function ensureDb (req: express.Request, res: express.Response, next: express.NextFunction) {
  if (!db) {
    db = initializeApp('tv')
  }

  if (!res.locals.db) {
    res.locals.db = db
  }

  next()
}

function getDb (res: express.Response) {
  return (res.locals as Locals).db
}

async function ensureAndSetUser (req: express.Request, res: express.Response, next: express.NextFunction) {
  function proceed (user?: User) {
    setupMixpanel(res, user)
    next()
  }

  // the /stats route is unauthenticated. set user if possible, but otherwise
  // allow it to go through without sending 401
  const isStats = req.path === '/stats'
  const apiKey = req.headers['api-key'] || req.query.apiKey

  if (typeof apiKey !== 'string') {
    if (isStats) return proceed()

    return res.status(401).json({
      error: 'Must specify `api-key` header',
    })
  }

  const db = getDb(res)
  const user = userMap[apiKey] || await getUserByApiKey(db, apiKey as string)

  if (!user) {
    if (isStats) return proceed()

    return res.status(401).json({
      error: `Could not find user with api key: ${apiKey}`,
    })
  }

  userMap[apiKey] = user
  res.locals.user = user

  proceed(user)
}

export function createTvRoutes () {
  const router = express.Router()

  router.use(ensureDb)
  router.use(ensureAndSetUser)

  router.get('/shows/search', guard(async (req: express.Request, res: express.Response) => {
    const query = req.query.query as string
    const shows = await searchShows(query)

    res.json(shows)
  }))

  router.get('/shows', guard(async (req: express.Request, res: express.Response) => {
    const shows = await getShowsWithEpisodesForUser(getDb(res), res.locals.user)

    res.json(shows)
  }))

  router.post('/shows', guard(async (req: express.Request, res: express.Response) => {
    const show = await addShow(getDb(res), req.body.show, res.locals.user)

    if (!show) {
      return res.sendStatus(204)
    }

    res.json(show)
  }))

  router.put('/shows/:id', guard(async (req: express.Request, res: express.Response) => {
    const show = await updateShow(getDb(res), req.params.id, req.body.show, res.locals.user)

    if (!show) {
      return res.sendStatus(204)
    }

    res.json(show)
  }))

  router.delete('/shows/:id', guard(async (req: express.Request, res: express.Response) => {
    await deleteShow(getDb(res), req.params.id, res.locals.user)

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
    const user = await getUser(getDb(res), id)

    if (!user) {
      return res.status(404).send({ error: `User with id '${id}' not found` })
    }

    const metadata = await getMetaData(getDb(res))

    res.json({
      hideSpecialEpisodes: user.hideSpecialEpisodes,
      hideTBAEpisodes: user.hideTBAEpisodes,
      isAdmin: user.isAdmin,
      lastUpdated: metadata.lastUpdated,
      searchLinks: user.searchLinks,
      username: user.username,
    })
  }))

  router.put('/user', guard(async (req: express.Request, res: express.Response) => {
    const id = res.locals.user.id
    const user = await updateUser(getDb(res), id, {
      hideSpecialEpisodes: req.body.hideSpecialEpisodes,
      hideTBAEpisodes: req.body.hideTBAEpisodes,
      searchLinks: req.body.searchLinks,
    })

    if (!user) {
      return res.status(404).send({ error: `User with id '${id}' not found` })
    }

    res.json({
      hideSpecialEpisodes: user.hideSpecialEpisodes,
      hideTBAEpisodes: user.hideTBAEpisodes,
      searchLinks: user.searchLinks,
      username: user.username,
    })
  }))

  router.post('/stats', guard(async (req: express.Request, res: express.Response) => {
    const { apiKey } = res.locals.user || {}
    const { event, data } = req.body

    try {
      debugVerbose('Send mixpanel event \'%s\' with data: %o', event, data)

      res.locals.mixpanel.track(event, {
        ...(data || {}),
        distinct_id: apiKey,
      })
    } catch (error: any) {
      debug('Mixpanel error for event \'%s\': %s', event, error.stack)
    }

    res.sendStatus(204)
  }))

  return router
}
