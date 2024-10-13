import type { Request, Response } from 'express'
import type { firestore } from 'firebase-admin'
import { getDoc, initializeApp, setDoc } from './util/firebase'
import { guard } from './util/routing'
import dayjs from 'dayjs'

let db: firestore.Firestore | undefined

function getDb () {
  if (!db) {
    db = initializeApp('sync')
  }

  return db
}

export const get = guard(async (req: Request, res: Response) => {
  const { user, app } = req.params as { user: string, app: string }

  const data = await getDoc(getDb(), `${user}/${app}`)

  res.json(data || {})
})

export const set = guard(async (req: Request, res: Response) => {
  const { user, app } = req.params as { user: string, app: string }
  const { data } = req.body as { data: any }

  await setDoc(getDb(), `${user}/${app}`, {
    data,
    updatedAt: dayjs().toISOString(),
  })

  res.json({})
})
