import crypto from 'crypto'
import express from 'express'

import {
  getBree,
  getJobsData,
  JobData,
  setJobsData,
  toBreeJob,
} from './jobs'
import { getLocationName } from './location'
import { debug } from './util/debug'
import { getEnv } from './util/env'
import { getIntervalOccurrences, isValidInterval } from './util/interval'
import { guard } from './util/routing'
import { getWeatherLocation, setWeatherLocation, WeatherLocation } from './weather-location'

const cookieName = 'admin_session'
const cookieMaxAge = 30 * 24 * 60 * 60 * 1000 // 30 days

function hashPassword (password: string) {
  return crypto.createHash('sha256').update(password).digest('hex')
}

// the cookie holds a token derived from the password hash instead of the hash
// itself, so the hash can't be lifted out of a browser and reused elsewhere
function getSessionToken (passwordHash: string) {
  return crypto.createHmac('sha256', passwordHash).update(cookieName).digest('hex')
}

function isEqual (a: string, b: string) {
  const aBuffer = Buffer.from(a)
  const bBuffer = Buffer.from(b)

  if (aBuffer.length !== bBuffer.length) return false

  return crypto.timingSafeEqual(aBuffer, bBuffer)
}

function getCookie (req: express.Request, name: string) {
  const cookies = (req.headers.cookie || '').split(';')

  for (const cookie of cookies) {
    const separatorIndex = cookie.indexOf('=')

    if (separatorIndex === -1) continue

    if (cookie.slice(0, separatorIndex).trim() === name) {
      return decodeURIComponent(cookie.slice(separatorIndex + 1).trim())
    }
  }
}

function isAuthenticated (req: express.Request) {
  const passwordHash = getEnv('ADMIN_PASSWORD_HASH')

  if (!passwordHash) return false

  const token = getCookie(req, cookieName)

  if (!token) return false

  return isEqual(token, getSessionToken(passwordHash))
}

function ensureAuthenticated (req: express.Request, res: express.Response, next: express.NextFunction) {
  if (!isAuthenticated(req)) {
    return res.status(401).json({ error: 'Not authenticated' })
  }

  next()
}

// syncs bree with the jobs whose enabled state or interval changed. an interval
// change is a remove + add, since bree has no way to re-schedule in place
async function updateBreeJobs (previousJobs: JobData[], newJobs: JobData[]) {
  const bree = getBree()

  /* v8 ignore next -- @preserve */
  if (!bree) return

  for (const job of newJobs) {
    const previous = previousJobs.find(({ fileName }) => fileName === job.fileName)
    const wasEnabled = !!previous?.enabled
    const intervalChanged = previous?.interval !== job.interval

    try {
      if (wasEnabled && (!job.enabled || intervalChanged)) {
        await bree.remove(job.fileName)
      }

      if (job.enabled && (!wasEnabled || intervalChanged)) {
        await bree.add(toBreeJob(job))
        bree.start(job.fileName)
      }
    } catch (error: any) {
      /* v8 ignore next -- @preserve */
      debug(`Updating bree job (${job.fileName}) errored:`, error?.stack || error)
    }
  }
}

function toCoordinate (value: unknown, limit: number) {
  const coordinate = typeof value === 'string' ? Number(value) : value

  if (typeof coordinate !== 'number' || !Number.isFinite(coordinate)) return
  if (Math.abs(coordinate) > limit) return

  return coordinate
}

// the browser and the manual inputs both send a latitude / longitude pair, so
// the name is looked up here rather than trusted from the client
async function toWeatherLocation (body: any): Promise<WeatherLocation | string> {
  const latitude = toCoordinate(body?.latitude, 90)
  const longitude = toCoordinate(body?.longitude, 180)

  if (latitude === undefined) return 'Latitude must be a number between -90 and 90'
  if (longitude === undefined) return 'Longitude must be a number between -180 and 180'

  const coordinates = `${latitude},${longitude}`

  try {
    return { coordinates, name: (await getLocationName(coordinates)) || coordinates }
  } catch (error: any) {
    /* v8 ignore next -- @preserve */
    debug('Getting location name errored:', error?.stack || error)

    // a failed lookup shouldn't prevent setting the location, since the
    // coordinates are all the weather scripts actually need
    return { coordinates, name: coordinates }
  }
}

// the chart needs to know when each job runs, which only the interval parser
// can say, so it's worked out here rather than in the browser. disabled jobs
// are included so the chart can update as they're toggled, before saving
function getOccurrencesData (jobsData: JobData[]) {
  const occurrences = {} as { [fileName: string]: number[] }

  for (const job of jobsData) {
    occurrences[job.fileName] = getIntervalOccurrences(job.interval)
  }

  return occurrences
}

async function getWeatherLocationData () {
  return {
    location: (await getWeatherLocation()) || null,
    defaultCoordinates: getEnv('WEATHER_LOCATION') || null,
  }
}

// escaped so a value containing `</script>` can't break out of the tag
function toJson (data: unknown) {
  return JSON.stringify(data).replace(/</g, '\\u003c')
}

function render (res: express.Response, view: string, data: object = {}) {
  res.set('Content-Type', 'text/html')
  res.render(view, { ...data, layout: false })
}

export function createAdminRoutes () {
  const router = express.Router()

  router.get('/', guard(async (req, res) => {
    if (!isAuthenticated(req)) {
      return render(res, 'admin-login')
    }

    const jobsData = await getJobsData()

    render(res, 'admin', {
      jobsJson: toJson(jobsData),
      occurrencesJson: toJson(getOccurrencesData(jobsData)),
      weatherJson: toJson(await getWeatherLocationData()),
    })
  }))

  router.post('/login', guard(async (req, res) => {
    const passwordHash = getEnv('ADMIN_PASSWORD_HASH')

    if (!passwordHash) {
      return res.status(500).json({ error: 'No admin password is configured' })
    }

    const { password } = req.body || {}

    if (typeof password !== 'string' || !isEqual(hashPassword(password), passwordHash)) {
      return res.status(401).json({ error: 'Incorrect password' })
    }

    res.cookie(cookieName, getSessionToken(passwordHash), {
      httpOnly: true,
      maxAge: cookieMaxAge,
      sameSite: 'lax',
      /* v8 ignore next -- @preserve */
      secure: process.env.NODE_ENV === 'production',
    })

    res.json({ ok: true })
  }))

  router.post('/logout', guard(async (req, res) => {
    res.clearCookie(cookieName)
    res.json({ ok: true })
  }))

  router.get('/jobs', ensureAuthenticated, guard(async (req, res) => {
    res.json({ jobs: await getJobsData() })
  }))

  router.post('/jobs', ensureAuthenticated, guard(async (req, res) => {
    const updates = (req.body?.jobs || []) as Partial<JobData>[]
    const currentJobs = await getJobsData()
    const errors = {} as { [fileName: string]: string }

    for (const update of updates) {
      const fileName = update.fileName!

      if (!currentJobs.find((job) => job.fileName === fileName)) {
        return res.status(400).json({ error: `Unknown job: ${fileName}` })
      }

      if (update.interval !== undefined && !isValidInterval(update.interval)) {
        errors[fileName] = 'Not a valid interval'
      }
    }

    // it's all or nothing. if any interval is invalid, nothing is saved
    if (Object.keys(errors).length) {
      return res.status(422).json({ errors })
    }

    const newJobs = currentJobs.map((job) => {
      const update = updates.find(({ fileName }) => fileName === job.fileName)

      if (!update) return job

      return {
        ...job,
        enabled: update.enabled === undefined ? job.enabled : !!update.enabled,
        interval: update.interval === undefined ? job.interval : update.interval.trim(),
      }
    })

    await setJobsData(newJobs)
    await updateBreeJobs(currentJobs, newJobs)

    res.json({ jobs: newJobs })
  }))

  router.get('/weather-location', ensureAuthenticated, guard(async (req, res) => {
    res.json(await getWeatherLocationData())
  }))

  router.post('/weather-location', ensureAuthenticated, guard(async (req, res) => {
    const location = await toWeatherLocation(req.body)

    if (typeof location === 'string') {
      return res.status(422).json({ error: location })
    }

    await setWeatherLocation(location)

    res.json(await getWeatherLocationData())
  }))

  // clearing it makes the weather scripts fall back to the environment
  router.delete('/weather-location', ensureAuthenticated, guard(async (req, res) => {
    await setWeatherLocation(undefined)

    res.json(await getWeatherLocationData())
  }))

  return router
}
