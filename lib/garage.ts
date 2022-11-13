import type express from 'express'

import { debug } from './util/debug'
import { request } from './util/network'
import { GarageState, PersistentData } from './util/persistent-data'

const defaultData = {
  left: 'unknown',
  right: 'unknown',
}

const persistentData = new PersistentData('garage-data')

export async function get (req: express.Request, res: express.Response) {
  try {
    const data = await persistentData.get()

    if (data) {
      res.json(Object.assign({}, defaultData, data))
    } else {
      res.json(defaultData)
    }
  } catch (error) {
    res.json(defaultData)
  }
}

async function notify (message: string) {
  const query = `?value1=${encodeURIComponent(message)}`
  const url = `https://maker.ifttt.com/trigger/notify/with/key/${process.env.IFTTT_WEBHOOK_KEY}${query}`

  try {
    await request({ url })
  } catch (error: any) {
    /* c8 ignore next */
    debug('IFTTT webhook request errored:', error?.stack || error)
  }
}

type Door = 'left' | 'right'

export async function set (req: express.Request, res: express.Response) {
  const { door, state } = req.params as { door: Door, state: GarageState }

  try {
    const data = (await persistentData.get()) || {}
    const previousState = data[door]

    if (previousState === 'open' && state === 'open') {
      // if the door state was 'open' twice in a row, the door failed to close.
      // send a request to IFTTT, which will trigger a push notification.
      notify(`The ${door} garage door failed to close!`)
    } else if (state === 'open' && data.notifyOnOpen) {
      notify(`The ${door} garage door opened`)
    }

    const update = {
      [door]: state,
    }

    await persistentData.set(Object.assign({}, data, update))
  } catch (error: any) {
    /* c8 ignore next */
    debug(`Setting garage state (${door} => ${state}) errored:`, error?.stack || error)
  } finally {
    res.json({})
  }
}

export async function setNotifyOnOpen (req: express.Request, res: express.Response) {
  const notifyOnOpen = req.params.notifyOnOpen === 'true'

  try {
    const data = (await persistentData.get()) || {}

    await persistentData.set(Object.assign(data, { notifyOnOpen }))
  } catch (error: any) {
    /* c8 ignore next */
    debug(`Setting notifyOnOpen to ${notifyOnOpen} errored:`, error?.stack || error)
  } finally {
    res.json({})
  }
}

export async function view (req: express.Request, res: express.Response) {
  res.set('Content-Type', 'text/html')

  try {
    const data = Object.assign({}, defaultData, (await persistentData.get()) || {})

    res.render('garages', { states: data, layout: false })
  } catch (error: any) {
    res.render('error', { message: error.message, stack: error.stack, layout: false })
  }
}

export const getGarageData = persistentData.get.bind(persistentData)
