import admin, { firestore } from 'firebase-admin'
import { readJsonSync } from 'fs-extra'
import path from 'path'

import { getEnv } from './env'
import { basePath } from './persistent-data'

const apps = {
  tv: {
    credentialsPath: 'firebase-tv-credentials.json',
    databaseURL: getEnv('FIREBASE_TV_DATABASE_URL'),
  },
  sync: {
    credentialsPath: 'firebase-sync-credentials.json',
    databaseURL: getEnv('FIREBASE_SYNC_DATABASE_URL'),
  },
}

export function initializeApp (appName: keyof typeof apps) {
  const app = apps[appName]

  if (!app) {
    throw new Error(`Unknown app: ${appName}`)
  }

  const serviceAccount = readJsonSync(path.join(basePath, app.credentialsPath), { throws: false })

  // this should only happen when testing
  if (!serviceAccount) {
    throw new Error(`No service account found for ${appName}`)
  }

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: app.databaseURL,
  })

  const db = admin.firestore()

  db.settings({ ignoreUndefinedProperties: true })

  return db
}

type Snapshot = admin.firestore.QuerySnapshot<admin.firestore.DocumentData>

function getDataFromSnapshot<T> (snapshot: Snapshot): Promise<T[]> {
  return Promise.all(snapshot.docs.map(async (docSnapshot) => {
    const doc = await docSnapshot.ref.get()

    return Object.assign(doc.data()!, {
      id: doc.id,
    }) as T
  }))
}

export async function getCollection<T> (db: firestore.Firestore, collectionName: string): Promise<T[]> {
  const snapshot = await db.collection(collectionName).get()

  return getDataFromSnapshot<T>(snapshot)
}

interface Identifiable {
  id: string
}

export async function getSubCollections<T extends Identifiable, U> (db: firestore.Firestore, data: T[], collection1Name: string, collection2Name: string): Promise<U[]> {
  return Promise.all(data.map(async (datum: T) => {
    const snapshot = await db.collection(`${collection1Name}/${datum.id}/${collection2Name}`).get()

    const collections = await Promise.all(snapshot.docs.map(async (docSnapshot) => {
      return (await docSnapshot.ref.get()).data()!
    }))

    return Object.assign(datum, {
      [collection2Name]: collections,
    }) as U
  }))
}

export async function getDoc<T> (db: firestore.Firestore, docPath: string): Promise<T | undefined> {
  const doc = await db.doc(docPath).get()

  return doc.data() as T
}

type Condition = [string, admin.firestore.WhereFilterOp, any]

export async function getDocWhere<T> (db: firestore.Firestore, collectionName: string, condition: Condition): Promise<T | undefined> {
  const [fieldPath, opStr, value] = condition
  const snapshot = await db.collection(collectionName).where(fieldPath, opStr, value).get()

  if (snapshot.empty) {
    return
  }

  return (await getDataFromSnapshot<T>(snapshot))[0]
}

export async function addDoc (db: firestore.Firestore, docPath: string, value: any) {
  await db.doc(docPath).set(value)
}

export async function setDoc (db: firestore.Firestore, docPath: string, value: any) {
  await db.doc(docPath).set(value)
}

export async function updateDoc (db: firestore.Firestore, docPath: string, value: any) {
  await db.doc(docPath).update(value)
}

export async function deleteDoc (db: firestore.Firestore, docPath: string) {
  await db.doc(docPath).delete()
}
